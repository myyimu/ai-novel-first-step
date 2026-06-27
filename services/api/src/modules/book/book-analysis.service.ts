import { BadRequestException, Injectable } from "@nestjs/common";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";
import { parseJsonWithRepair } from "@/modules/ai-provider/json-repair";
import { ModelProviderService } from "@/modules/ai-provider/model-provider.service";
import { asText, asTextList, clampNumber } from "@/modules/analysis/shared/coercion";
import { AnalyzeBookDto } from "@/modules/analysis/dto/analyze-book.dto";
import { PreprocessBookDto } from "@/modules/analysis/dto/preprocess-book.dto";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import {
  BookAnalysisJobProgress,
  BookAnalysisJobSnapshot,
  BookAnalysisJobService,
} from "./book-analysis-job.service";
import {
  BookExportService,
  type BookExportFormat,
  type BookExportMode,
} from "./book-export.service";
import { BookUploadService, type UploadedTxtFile } from "./book-upload.service";
import {
  BookPreprocessResult,
  ChapterSegment,
  TextPreprocessorService,
} from "./text-preprocessor.service";

interface ChapterMapResult {
  chapterId: string;
  order: number;
  title: string;
  analysisDepth: "outline" | "deep";
  focusScore?: number;
  chunkStartOffset: number;
  chunkEndOffset: number;
  splitBy: ChapterSegment["splitBy"];
  summary: string;
  plotFunction: string;
  chapterGoal?: string;
  conflict?: string;
  characterSignals: string[];
  worldbuildingSignals: string[];
  relationshipSignals: string[];
  timelineEvents: string[];
  emotionalBeats?: string[];
  foreshadowingSetups?: string[];
  payoffSignals?: string[];
  sourceRiskSignals: string[];
  originalizationSeeds: string[];
  hook: string;
  evidenceSnippets: string[];
  sourceAnchors: Array<{
    anchorId: string;
    label: string;
    quote: string;
    startOffset: number;
    endOffset: number;
  }>;
}

type RawChapterMapResult = Partial<
  Omit<
    ChapterMapResult,
    "chunkStartOffset" | "chunkEndOffset" | "splitBy" | "sourceAnchors"
  >
> & {
  evidenceSnippets?: string[];
  sourceAnchors?: Array<{
    label?: string;
    quote?: string;
  }>;
};

export interface BookChunkEvidenceHit {
  chapterId: string;
  order: number;
  title: string;
  summary: string;
  plotFunction: string;
  hook: string;
  score: number;
  matchedKeywords: string[];
  evidenceSnippets: string[];
  sourceAnchors: Array<{
    anchorId: string;
    label: string;
    quote: string;
    startOffset: number;
    endOffset: number;
  }>;
  chunkStartOffset: number;
  chunkEndOffset: number;
}

@Injectable()
export class BookAnalysisService {
  constructor(
    private readonly textPreprocessor: TextPreprocessorService,
    private readonly bookJobs: BookAnalysisJobService,
    private readonly bookUploads: BookUploadService,
    private readonly modelProviders: ModelProviderService,
    private readonly persistence: AnalysisPersistenceRepository,
    private readonly bookExports: BookExportService,
  ) {}

  async analyzeBook(_input: AnalyzeBookDto) {
    throw new BadRequestException(
      "Synchronous full-book analysis is disabled. Use /analysis/book/jobs or /analysis/book/uploads/:uploadId/jobs instead.",
    );
  }

  preprocessBook(input: PreprocessBookDto) {
    return this.textPreprocessor.preprocess(input.text, input.maxChapterChars);
  }

  async createBookAnalysisJob(input: AnalyzeBookDto) {
    return this.bookJobs.create(
      {
        title: input.title,
        genre: input.genre,
        textLength: input.text.length,
      },
      async (jobId) => {
        await this.bookJobs.markRunning(jobId);
        const result = await this.runBookMapReduce(
          input,
          async (progress) => {
            await this.bookJobs.updateProgress(jobId, progress);
          },
          async (preprocessing) => {
            await this.bookJobs.setPreprocessing(jobId, preprocessing);
          },
          async (chapterMap, mapCount, totalChapters, metadata) => {
            await this.bookJobs.recordChapterMap({
              jobId,
              chapterMap,
              mapCount,
              totalChapters,
              analysisStrategy: metadata?.analysisStrategy,
              outlineCount: metadata?.outlineCount,
              deepTargetOrders: metadata?.deepTargetOrders,
              deepCompletedCount: metadata?.deepCompletedCount,
              phase: metadata?.phase,
            });
          },
        );
        await this.bookJobs.complete(jobId, result);
        return result;
      },
    );
  }

  getBookAnalysisJob(jobId: string, options?: { includeResult?: boolean }) {
    return this.readBookAnalysisJobWithDerivedResult(jobId, options);
  }

  deleteBookAnalysisJob(jobId: string) {
    return this.bookJobs.delete(jobId);
  }

  async searchBookAnalysisEvidence(
    jobId: string,
    query: string,
    limit?: number,
  ) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new BadRequestException("Search query is required.");
    }

    const job = await this.readBookAnalysisJobWithDerivedResult(jobId, {
      includeResult: true,
    });
    if (!job.result) {
      throw new BadRequestException(
        "This book-analysis job does not have searchable chunk evidence yet.",
      );
    }

    const result = job.result as {
      mapReduce?: {
        chunkEvidenceIndex?: Array<{
          chapterId: string;
          order: number;
          title: string;
          summary: string;
          plotFunction: string;
          hook: string;
          chunkStartOffset: number;
          chunkEndOffset: number;
          keywords: string[];
          evidenceSnippets: string[];
          sourceAnchors: BookChunkEvidenceHit["sourceAnchors"];
        }>;
      };
    };
    const index = result.mapReduce?.chunkEvidenceIndex || [];
    const queryTokens = this.normalizeSearchTokens(trimmedQuery);
    const hits = index
      .map((chunk) => this.scoreChunkEvidenceHit(chunk, queryTokens))
      .filter((hit): hit is BookChunkEvidenceHit => Boolean(hit))
      .sort((left, right) => right.score - left.score)
      .slice(0, Math.min(Math.max(limit || 8, 1), 20));

    return {
      mode: "book-evidence-search",
      jobId,
      title: job.inputSummary.title,
      query: trimmedQuery,
      tokenCount: queryTokens.length,
      totalChunks: index.length,
      hitCount: hits.length,
      hits,
    };
  }

  async resumeBookAnalysisJob(input: {
    jobId: string;
    provider: ProviderConfigDto;
  }) {
    const job = await this.bookJobs.get(input.jobId);
    if (!job.uploadId) {
      throw new BadRequestException(
        "Only jobs created from uploaded TXT files can be resumed.",
      );
    }

    const upload = await this.bookUploads.getUpload(job.uploadId);
    const text = await this.bookUploads.readNormalizedText(job.uploadId);
    const analysisInput: AnalyzeBookDto = {
      provider: input.provider,
      title: upload.title,
      genre: upload.genre,
      text,
    };

    return this.bookJobs.resume(input.jobId, async (jobId) => {
      await this.bookJobs.markRunning(jobId);
      const result = await this.runBookMapReduce(
        analysisInput,
        async (progress) => {
          await this.bookJobs.updateProgress(jobId, progress);
        },
        async (preprocessing) => {
          await this.bookJobs.setPreprocessing(jobId, preprocessing);
        },
        async (chapterMap, mapCount, totalChapters, metadata) => {
          await this.bookJobs.recordChapterMap({
            jobId,
            chapterMap,
            mapCount,
            totalChapters,
            analysisStrategy: metadata?.analysisStrategy,
            outlineCount: metadata?.outlineCount,
            deepTargetOrders: metadata?.deepTargetOrders,
            deepCompletedCount: metadata?.deepCompletedCount,
            phase: metadata?.phase,
          });
        },
        { jobId },
      );
      await this.bookJobs.complete(jobId, result);
      return result;
    });
  }

  async uploadBookFile(input: {
    title?: string;
    genre: string;
    file: UploadedTxtFile;
  }) {
    const upload = await this.bookUploads.createUpload(input);
    return this.bookUploads.toPublicUpload(upload);
  }

  async getBookUpload(uploadId: string) {
    const upload = await this.bookUploads.getUpload(uploadId);
    return this.bookUploads.toPublicUpload(upload);
  }

  async listBookUploads(limit?: number) {
    const uploads = await this.bookUploads.listUploads(limit);
    return uploads.map((upload) => this.bookUploads.toPublicUpload(upload));
  }

  async listBookAnalysisJobs(limit?: number) {
    const jobs = await this.persistence.listJobs(limit);
    return jobs.map(
      ({ preprocessing: _preprocessing, result: _result, ...job }) => job,
    );
  }

  async exportBookAnalysisJob(
    jobId: string,
    format: BookExportFormat,
    mode: BookExportMode = "notes",
  ) {
    const job = await this.readBookAnalysisJobWithDerivedResult(jobId, {
      includeResult: true,
    });
    if (!job.result) {
      throw new BadRequestException(
        "This book-analysis job does not have exportable assets yet.",
      );
    }

    return this.bookExports.export(job.result, format, mode);
  }

  private async readBookAnalysisJobWithDerivedResult(
    jobId: string,
    options?: { includeResult?: boolean },
  ) {
    const job = await this.bookJobs.get(jobId, options);
    if (options?.includeResult === false || job.result || !job.partialResult) {
      return job;
    }

    const derivedResult = await this.buildPartialBookAnalysisResult(job);
    if (!derivedResult) {
      return job;
    }

    return {
      ...job,
      result: derivedResult,
    };
  }

  async createBookAnalysisJobFromUpload(input: {
    uploadId: string;
    provider: ProviderConfigDto;
  }) {
    const upload = await this.bookUploads.getUpload(input.uploadId);
    const text = await this.bookUploads.readNormalizedText(input.uploadId);
    const analysisInput: AnalyzeBookDto = {
      provider: input.provider,
      title: upload.title,
      genre: upload.genre,
      text,
    };

    return this.bookJobs.create(
      {
        title: upload.title,
        genre: upload.genre,
        textLength: text.length,
      },
      async (jobId) => {
        await this.bookJobs.markRunning(jobId);
        const result = await this.runBookMapReduce(
          analysisInput,
          async (progress) => {
            await this.bookJobs.updateProgress(jobId, progress);
          },
          async (preprocessing) => {
            await this.bookJobs.setPreprocessing(jobId, preprocessing);
          },
          async (chapterMap, mapCount, totalChapters, metadata) => {
            await this.bookJobs.recordChapterMap({
              jobId,
              chapterMap,
              mapCount,
              totalChapters,
              analysisStrategy: metadata?.analysisStrategy,
              outlineCount: metadata?.outlineCount,
              deepTargetOrders: metadata?.deepTargetOrders,
              deepCompletedCount: metadata?.deepCompletedCount,
              phase: metadata?.phase,
            });
          },
        );
        await this.bookJobs.complete(jobId, result);
        return result;
      },
      input.uploadId,
    );
  }

  private async runBookMapReduce(
    input: AnalyzeBookDto,
    onProgress?: (progress: BookAnalysisJobProgress) => void | Promise<void>,
    onPreprocess?: (
      preprocessing: BookPreprocessResult,
    ) => void | Promise<void>,
    onChapterMap?: (
      chapterMap: ChapterMapResult,
      mapCount: number,
      totalChapters: number,
      metadata?: {
        phase: "outline" | "deep";
        analysisStrategy: string;
        outlineCount: number;
        deepTargetOrders: number[];
        deepCompletedCount: number;
      },
    ) => void | Promise<void>,
    options: { jobId?: string } = {},
  ) {
    const analysisStrategy =
      "preprocess -> outline index all chunks -> selectively deep-map priority chunks -> reduce";
    await onProgress?.({
      stage: "preprocess",
      current: 0,
      total: 1,
      message: "正在清洗 TXT 并切分章节。",
    });

    const preprocessing = this.textPreprocessor.preprocess(input.text);
    const chapters = preprocessing.chapters;
    await onPreprocess?.(preprocessing);

    const savedMaps: ChapterMapResult[] = options.jobId
      ? (
          await this.bookJobs.readChapterMaps<ChapterMapResult>(options.jobId)
        ).slice(0, chapters.length)
      : [];
    const savedJob = options.jobId
      ? await this.bookJobs.get(options.jobId, { includeResult: false })
      : undefined;
    const chapterMapByOrder = new Map<number, ChapterMapResult>();
    for (const chapterMap of savedMaps) {
      chapterMapByOrder.set(chapterMap.order, chapterMap);
    }

    const pendingOutlineChapters = chapters.filter(
      (chapter) => !chapterMapByOrder.has(chapter.order),
    );
    const outlineTotal = chapters.length;
    let outlineCompleted = outlineTotal - pendingOutlineChapters.length;
    await onProgress?.({
      stage: "map",
      current: outlineCompleted,
      total: outlineTotal,
      message:
        outlineCompleted > 0
          ? `已恢复 ${outlineCompleted}/${outlineTotal} 个片段的轻索引结果。`
          : `已切分 ${outlineTotal} 个章节片段，先建立全书轻索引。`,
    });

    if (pendingOutlineChapters.length) {
      const outlineConcurrency = input.provider.kind === "mock" ? 1 : 6;
      if (input.provider.kind !== "mock") {
        await this.runWithConcurrency(
          pendingOutlineChapters,
          outlineConcurrency,
          async (chapter) => {
            const chapterMap = await this.analyzeChapterOutline(input, chapter);
            chapterMapByOrder.set(chapter.order, chapterMap);
            outlineCompleted += 1;
            await onChapterMap?.(chapterMap, outlineCompleted, outlineTotal, {
              phase: "outline",
              analysisStrategy,
              outlineCount: outlineCompleted,
              deepTargetOrders: [],
              deepCompletedCount: 0,
            });
            await onProgress?.({
              stage: "map",
              current: outlineCompleted,
              total: outlineTotal,
              message: `已完成 ${outlineCompleted}/${outlineTotal} 个片段的轻索引。`,
            });
          },
        );
      } else {
        for (const chapter of pendingOutlineChapters) {
          const chapterMap = this.mockChapterMap(input, chapter, "outline");
          chapterMapByOrder.set(chapter.order, chapterMap);
          outlineCompleted += 1;
          await onChapterMap?.(chapterMap, outlineCompleted, outlineTotal, {
            phase: "outline",
            analysisStrategy,
            outlineCount: outlineCompleted,
            deepTargetOrders: [],
            deepCompletedCount: 0,
          });
          await onProgress?.({
            stage: "map",
            current: outlineCompleted,
            total: outlineTotal,
            message: `已完成 ${outlineCompleted}/${outlineTotal} 个片段的轻索引。`,
          });
        }
      }
    }

    const outlineMaps = chapters
      .map((chapter) => chapterMapByOrder.get(chapter.order))
      .filter((chapterMap): chapterMap is ChapterMapResult =>
        Boolean(chapterMap),
      );
    const savedDeepTargets = savedJob?.partialResult?.deepTargetOrders || [];
    const deepTargetOrders = savedDeepTargets.length
      ? savedDeepTargets
      : this.selectDeepDiveTargetOrders(chapters, outlineMaps);
    if (options.jobId && outlineMaps.length) {
      await this.bookJobs.updatePartialPlan({
        jobId: options.jobId,
        analysisStrategy,
        outlineCount: outlineMaps.length,
        deepTargetOrders,
        deepCompletedCount: outlineMaps.filter(
          (item) => item.analysisDepth === "deep",
        ).length,
      });
    }

    const deepTargets = chapters.filter((chapter) =>
      deepTargetOrders.includes(chapter.order),
    );
    const deepPending = deepTargets.filter(
      (chapter) =>
        chapterMapByOrder.get(chapter.order)?.analysisDepth !== "deep",
    );
    let deepCompleted = deepTargets.length - deepPending.length;
    const deepTotal = deepTargets.length;
    if (deepTotal > 0) {
      await onProgress?.({
        stage: "map",
        current: deepCompleted,
        total: deepTotal,
        message: `已选出 ${deepTotal} 个重点片段，开始深拆。`,
      });
    }

    if (deepPending.length) {
      const deepConcurrency = input.provider.kind === "mock" ? 1 : 3;
      if (input.provider.kind !== "mock") {
        await this.runWithConcurrency(
          deepPending,
          deepConcurrency,
          async (chapter) => {
            const baseMap = chapterMapByOrder.get(chapter.order);
            const chapterMap = await this.analyzeChapterMap(
              input,
              chapter,
              baseMap,
            );
            chapterMapByOrder.set(chapter.order, chapterMap);
            deepCompleted += 1;
            await onChapterMap?.(
              chapterMap,
              outlineTotal + deepCompleted,
              outlineTotal + deepTotal,
              {
                phase: "deep",
                analysisStrategy,
                outlineCount: outlineMaps.length,
                deepTargetOrders,
                deepCompletedCount: deepCompleted,
              },
            );
            if (options.jobId) {
              await this.bookJobs.updatePartialPlan({
                jobId: options.jobId,
                analysisStrategy,
                outlineCount: outlineMaps.length,
                deepTargetOrders,
                deepCompletedCount: deepCompleted,
              });
            }
            await onProgress?.({
              stage: "map",
              current: deepCompleted,
              total: deepTotal,
              message: `已完成 ${deepCompleted}/${deepTotal} 个重点片段深拆。`,
            });
          },
        );
      } else {
        for (const chapter of deepPending) {
          const baseMap = chapterMapByOrder.get(chapter.order);
          const chapterMap = this.mockChapterMap(
            input,
            chapter,
            "deep",
            baseMap?.focusScore,
          );
          chapterMapByOrder.set(chapter.order, chapterMap);
          deepCompleted += 1;
          await onChapterMap?.(
            chapterMap,
            outlineTotal + deepCompleted,
            outlineTotal + deepTotal,
            {
              phase: "deep",
              analysisStrategy,
              outlineCount: outlineMaps.length,
              deepTargetOrders,
              deepCompletedCount: deepCompleted,
            },
          );
          await onProgress?.({
            stage: "map",
            current: deepCompleted,
            total: deepTotal,
            message: `已完成 ${deepCompleted}/${deepTotal} 个重点片段深拆。`,
          });
        }
      }
    }

    const chapterMaps = chapters
      .map((chapter) => chapterMapByOrder.get(chapter.order))
      .filter((chapterMap): chapterMap is ChapterMapResult =>
        Boolean(chapterMap),
      );

    await onProgress?.({
      stage: "reduce",
      current: chapterMaps.length,
      total: chapterMaps.length + 1,
      message: "正在把片段索引和深拆结果 reduce 成整书资产。",
    });

    const reduced =
      input.provider.kind === "mock"
        ? this.mockBookReduce(input, preprocessing, chapterMaps)
        : await this.reduceBookMaps(input, preprocessing, chapterMaps);
    const normalized = this.normalizeBookAnalysisResult(input, reduced);

    return {
      ...normalized,
      preprocessing: {
        cleaning: preprocessing.cleaning,
        chapters: chapters.map(({ text: _text, ...chapter }) => chapter),
      },
      mapReduce: {
        strategy: analysisStrategy,
        mapCount: chapterMaps.length,
        chapterMaps,
        chunkCount: chapterMaps.length,
        outlineCount: outlineMaps.length,
        deepCount: chapterMaps.filter((item) => item.analysisDepth === "deep")
          .length,
        deepTargetOrders,
        chunkEvidenceIndex: this.buildChunkEvidenceIndex(chapterMaps),
        reducerNote: "先做全量轻索引，再只对重点片段深拆，最后汇总成整书资产。",
      },
    };
  }

  private async buildPartialBookAnalysisResult(
    job: BookAnalysisJobSnapshot,
  ): Promise<Record<string, unknown> | null> {
    if (!job.partialResult || !job.preprocessing) {
      return null;
    }

    const chapterMaps = (
      await this.bookJobs.readChapterMaps<ChapterMapResult>(job.id)
    ).sort((left, right) => left.order - right.order);
    if (!chapterMaps.length) {
      return null;
    }

    const input: AnalyzeBookDto = {
      title: job.inputSummary.title,
      genre: job.inputSummary.genre,
      text: "",
      provider: {
        kind: "mock",
        preset: "custom",
      },
    };
    const preprocessing: BookPreprocessResult = {
      cleaning: job.preprocessing.cleaning,
      chapters: job.preprocessing.chapters.map((chapter) => ({
        ...chapter,
        text: "",
      })),
    };
    const base = this.mockBookReduce(
      input,
      preprocessing,
      chapterMaps,
    ) as Record<string, unknown>;
    const partial = this.buildPartialChapterMapAssets(
      input,
      preprocessing,
      chapterMaps,
      job.partialResult,
    );
    const normalized = this.normalizeBookAnalysisResult(input, {
      ...base,
      ...partial,
    }) as Record<string, unknown>;

    return {
      ...normalized,
      preprocessing: {
        cleaning: preprocessing.cleaning,
        chapters: preprocessing.chapters.map(
          ({ text: _text, ...chapter }) => chapter,
        ),
      },
      mapReduce: {
        strategy:
          job.partialResult.analysisStrategy ||
          "partial chapter-map aggregation preview",
        mapCount: chapterMaps.length,
        chapterMaps,
        chunkCount: chapterMaps.length,
        outlineCount: job.partialResult.outlineCount ?? chapterMaps.length,
        deepCount: chapterMaps.filter((item) => item.analysisDepth === "deep")
          .length,
        deepTargetOrders: job.partialResult.deepTargetOrders || [],
        chunkEvidenceIndex: this.buildChunkEvidenceIndex(chapterMaps),
        reducerNote: `Partial preview generated from ${chapterMaps.length}/${job.partialResult.totalChapters} analyzed chunks. Unmapped chapters are not included yet.`,
      },
      partialAnalysis: {
        isPartial: true,
        stage: job.partialResult.stage,
        mapCount: chapterMaps.length,
        totalChapters: job.partialResult.totalChapters,
        notice: job.partialResult.notice,
        savedAt: job.partialResult.savedAt,
      },
    };
  }

  private normalizeBookAnalysisResult(input: AnalyzeBookDto, value: unknown) {
    const defaults = this.mockBookAnalysis(input);
    const source = (value || {}) as Record<string, any>;
    const defaultRecord = defaults as Record<string, any>;
    const hasSourcePayload = Object.keys(source).length > 0;
    const normalizedCharacters = this.normalizeBookCharacters(
      source.characters,
      hasSourcePayload ? [] : defaults.characters,
    );
    const normalizedRelationships = this.normalizeBookRelationships({
      rawRelationships: source.relationships,
      characters: normalizedCharacters,
      worldbuilding: hasSourcePayload
        ? source.worldbuilding
        : defaults.worldbuilding,
      fallback: defaults.relationships,
    });
    const relationshipGraphQuality = this.buildRelationshipGraphQuality(
      normalizedRelationships,
    );

    return {
      ...defaults,
      ...source,
      book: {
        ...defaults.book,
        ...source.book,
        coreAppeal: this.arrayOrDefault(
          source.book?.coreAppeal,
          defaults.book.coreAppeal,
        ),
      },
      transferableStyleCard: {
        ...defaultRecord.transferableStyleCard,
        ...source.transferableStyleCard,
        coreStyleTags: this.arrayOrDefault(
          source.transferableStyleCard?.coreStyleTags,
          defaultRecord.transferableStyleCard.coreStyleTags,
        ),
        sensoryFocus: this.arrayOrDefault(
          source.transferableStyleCard?.sensoryFocus,
          defaultRecord.transferableStyleCard.sensoryFocus,
        ),
        pleasureMechanisms: this.arrayOrDefault(
          source.transferableStyleCard?.pleasureMechanisms,
          defaultRecord.transferableStyleCard.pleasureMechanisms,
        ),
        hookPatterns: this.arrayOrDefault(
          source.transferableStyleCard?.hookPatterns,
          defaultRecord.transferableStyleCard.hookPatterns,
        ),
        styleRules: this.arrayOrDefault(
          source.transferableStyleCard?.styleRules,
          defaultRecord.transferableStyleCard.styleRules,
        ),
        antiPatterns: this.arrayOrDefault(
          source.transferableStyleCard?.antiPatterns,
          defaultRecord.transferableStyleCard.antiPatterns,
        ),
      },
      worldbuilding: {
        ...defaults.worldbuilding,
        ...source.worldbuilding,
        worldRules: this.arrayOrDefault(
          source.worldbuilding?.worldRules,
          defaults.worldbuilding.worldRules,
        ),
        powerSystem: this.arrayOrDefault(
          source.worldbuilding?.powerSystem,
          defaults.worldbuilding.powerSystem,
        ),
        locations: this.arrayOrDefault(
          source.worldbuilding?.locations,
          defaults.worldbuilding.locations,
        ),
        factions: this.arrayOrDefault(
          source.worldbuilding?.factions,
          defaults.worldbuilding.factions,
        ),
        itemsAndTerms: this.arrayOrDefault(
          source.worldbuilding?.itemsAndTerms,
          defaults.worldbuilding.itemsAndTerms,
        ),
      },
      characters: normalizedCharacters,
      relationships: normalizedRelationships,
      relationshipGraphQuality,
      plotlines: this.arrayOrDefault(source.plotlines, defaults.plotlines),
      chronicle: this.arrayOrDefault(source.chronicle, defaults.chronicle),
      historyBook: {
        ...defaults.historyBook,
        ...source.historyBook,
      },
      writingSupport: {
        ...defaults.writingSupport,
        ...source.writingSupport,
        chapterFunctionTable: this.arrayOrDefault(
          source.writingSupport?.chapterFunctionTable,
          defaults.writingSupport.chapterFunctionTable,
        ),
        foreshadowingLedger: this.arrayOrDefault(
          source.writingSupport?.foreshadowingLedger,
          defaults.writingSupport.foreshadowingLedger,
        ),
        emotionalBeatMap: this.arrayOrDefault(
          source.writingSupport?.emotionalBeatMap,
          defaults.writingSupport.emotionalBeatMap,
        ),
        pacingCurve: this.arrayOrDefault(
          source.writingSupport?.pacingCurve,
          defaults.writingSupport.pacingCurve,
        ),
        readerPromiseChecklist: this.arrayOrDefault(
          source.writingSupport?.readerPromiseChecklist,
          defaults.writingSupport.readerPromiseChecklist,
        ),
        conflictMatrix: this.arrayOrDefault(
          source.writingSupport?.conflictMatrix,
          defaults.writingSupport.conflictMatrix,
        ),
        continuationPack: {
          ...defaults.writingSupport.continuationPack,
          ...source.writingSupport?.continuationPack,
        },
        qualityDiagnosis: {
          ...defaults.writingSupport.qualityDiagnosis,
          ...source.writingSupport?.qualityDiagnosis,
        },
      },
      generationAssets: {
        ...defaults.generationAssets,
        ...source.generationAssets,
        worldBook: {
          ...defaults.generationAssets.worldBook,
          ...source.generationAssets?.worldBook,
          entries: this.arrayOrDefault(
            source.generationAssets?.worldBook?.entries,
            defaults.generationAssets.worldBook.entries,
          ),
          activationRules: this.arrayOrDefault(
            source.generationAssets?.worldBook?.activationRules,
            defaults.generationAssets.worldBook.activationRules,
          ),
        },
        styleBible: {
          ...defaults.generationAssets.styleBible,
          ...source.generationAssets?.styleBible,
        },
        volumePlan: this.arrayOrDefault(
          source.generationAssets?.volumePlan,
          defaults.generationAssets.volumePlan,
        ),
        sceneTemplates: this.arrayOrDefault(
          source.generationAssets?.sceneTemplates,
          defaults.generationAssets.sceneTemplates,
        ),
        characterVoiceGuide: this.arrayOrDefault(
          source.generationAssets?.characterVoiceGuide,
          defaults.generationAssets.characterVoiceGuide,
        ),
        antagonistPressurePlan: this.arrayOrDefault(
          source.generationAssets?.antagonistPressurePlan,
          defaults.generationAssets.antagonistPressurePlan,
        ),
        titleSynopsisKeywordPack: {
          ...defaults.generationAssets.titleSynopsisKeywordPack,
          ...source.generationAssets?.titleSynopsisKeywordPack,
        },
        consistencyChecklist: this.arrayOrDefault(
          source.generationAssets?.consistencyChecklist,
          defaults.generationAssets.consistencyChecklist,
        ),
      },
      sourceAssetArchive: {
        ...defaultRecord.sourceAssetArchive,
        ...source.sourceAssetArchive,
      },
      exportPackage: {
        ...defaults.exportPackage,
        ...source.exportPackage,
      },
      originalizationReport: {
        ...defaults.originalizationReport,
        ...source.originalizationReport,
      },
      referenceBoundaryCheck: {
        ...defaultRecord.referenceBoundaryCheck,
        ...source.referenceBoundaryCheck,
        learnablePatterns: this.arrayOrDefault(
          source.referenceBoundaryCheck?.learnablePatterns,
          defaultRecord.referenceBoundaryCheck.learnablePatterns,
        ),
        doNotReuse: this.arrayOrDefault(
          source.referenceBoundaryCheck?.doNotReuse,
          defaultRecord.referenceBoundaryCheck.doNotReuse,
        ),
        needsTransformation: this.arrayOrDefault(
          source.referenceBoundaryCheck?.needsTransformation,
          defaultRecord.referenceBoundaryCheck.needsTransformation,
        ),
        nameAndTermRisks: this.arrayOrDefault(
          source.referenceBoundaryCheck?.nameAndTermRisks,
          defaultRecord.referenceBoundaryCheck.nameAndTermRisks,
        ),
        plotSimilarityRisks: this.arrayOrDefault(
          source.referenceBoundaryCheck?.plotSimilarityRisks,
          defaultRecord.referenceBoundaryCheck.plotSimilarityRisks,
        ),
        safeRewriteMoves: this.arrayOrDefault(
          source.referenceBoundaryCheck?.safeRewriteMoves,
          defaultRecord.referenceBoundaryCheck.safeRewriteMoves,
        ),
      },
      usageRiskNotice: {
        ...defaultRecord.usageRiskNotice,
        ...source.usageRiskNotice,
      },
    };
  }

  private arrayOrDefault<T>(value: unknown, fallback: T[]): T[] {
    return Array.isArray(value) && value.length > 0 ? (value as T[]) : fallback;
  }

  private buildPartialChapterMapAssets(
    input: AnalyzeBookDto,
    preprocessing: BookPreprocessResult,
    chapterMaps: ChapterMapResult[],
    partialResult: NonNullable<BookAnalysisJobSnapshot["partialResult"]>,
  ) {
    const characterFrequency = new Map<string, number>();
    const characterFirstSeen = new Map<string, number>();
    const relationshipAccumulator = new Map<
      string,
      {
        source: string;
        target: string;
        label: string;
        tension: string;
        relation: Set<string>;
        evidence: Set<string>;
        positivity: number;
        weight: number;
        confidence: number;
        firstSeenChapter: number;
      }
    >();
    const worldSignals = new Set<string>();
    const timelineEvents = new Set<string>();
    const plotFunctions = new Set<string>();

    for (const chapter of chapterMaps) {
      const names = this.extractEntityCandidates(chapter.characterSignals);
      names.forEach((name) => {
        characterFrequency.set(name, (characterFrequency.get(name) || 0) + 1);
        if (!characterFirstSeen.has(name)) {
          characterFirstSeen.set(name, chapter.order);
        }
      });

      chapter.worldbuildingSignals.forEach((signal) => {
        const text = asText(signal);
        if (text) {
          worldSignals.add(text);
        }
      });
      chapter.timelineEvents.forEach((event) => {
        const text = asText(event);
        if (text) {
          timelineEvents.add(text);
        }
      });
      if (chapter.plotFunction) {
        plotFunctions.add(chapter.plotFunction);
      }

      const chapterPairs = names.flatMap((source, sourceIndex) =>
        names.slice(sourceIndex + 1).map((target) => [source, target] as const),
      );
      for (const [source, target] of chapterPairs) {
        const edgeKey = [source, target].sort().join("::");
        const existing = relationshipAccumulator.get(edgeKey);
        const label = asText(chapter.relationshipSignals[0]) || "同章互动";
        const evidence = [
          ...chapter.evidenceSnippets,
          ...chapter.sourceAnchors.map((anchor) => anchor.quote),
        ]
          .map((item) => asText(item))
          .filter(Boolean)
          .slice(0, 6) as string[];
        const positivity = this.partialRelationshipPositivity(label);
        if (existing) {
          evidence.forEach((item) => existing.evidence.add(item));
          if (label) {
            existing.relation.add(label);
          }
          existing.weight += 1;
          existing.confidence = Math.min(0.98, existing.confidence + 0.1);
          existing.positivity = (existing.positivity + positivity) / 2;
          continue;
        }
        relationshipAccumulator.set(edgeKey, {
          source,
          target,
          label,
          tension:
            positivity < -0.1 ? "high" : positivity > 0.1 ? "low" : "medium",
          relation: new Set(label ? [label] : []),
          evidence: new Set(evidence),
          positivity,
          weight: 1,
          confidence: 0.45 + Math.min(0.35, evidence.length * 0.08),
          firstSeenChapter: chapter.order,
        });
      }
    }

    const sortedCharacters = [...characterFrequency.entries()]
      .sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, 24);
    const characters = sortedCharacters.map(([name, frequency]) => ({
      sourceName: name,
      role:
        /主角|protagonist|hero/i.test(name) ||
        (characterFirstSeen.get(name) || 99) === 1
          ? "主角"
          : frequency >= 3
            ? "核心角色"
            : "角色",
      archetype: `从已分析章节中提取的角色信号（出现 ${frequency} 次）`,
      personalityCore: this.mergeReducerList(
        chapterMaps
          .filter((chapter) =>
            this.extractEntityCandidates(chapter.characterSignals).includes(
              name,
            ),
          )
          .flatMap((chapter) => chapter.emotionalBeats || []),
        4,
      ),
      desire: "待后续章节补全角色长期目标",
      fearOrWound: "待更多章节证据补全",
      capability: "待更多章节证据补全",
      relationshipFunction: "基于当前已拆章节生成的临时角色卡",
      names: [name],
      mainCharacter:
        /主角|protagonist|hero/i.test(name) ||
        (characterFirstSeen.get(name) || 99) === 1,
      originalCharacterCard: {
        namePlaceholder: `${name}（待原创化命名）`,
        summary: `基于已拆章节生成的临时角色卡。当前能确认 ${frequency} 次出场信号，建议在全书拆完后再补全人物弧线。`,
        personality:
          "待更多章节证据补全 personality / speech / contradiction。",
        scenario: `适合放入当前已分析章节相关场景，首见约在第 ${characterFirstSeen.get(name) || "?"} 章。`,
        firstMessage:
          "这是基于半拆结果生成的临时角色卡，建议补完全书后再定稿。",
        doNotCopy: [name],
      },
    }));

    const relationships = {
      nodes: characters.map((character) => ({
        id: character.sourceName,
        label: character.sourceName,
        type: "character",
        names: character.names,
        mainCharacter: character.mainCharacter,
        description: character.archetype,
      })),
      edges: [...relationshipAccumulator.values()].map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: edge.label,
        tension: edge.tension,
        relation: [...edge.relation].slice(0, 4),
        weight: edge.weight,
        positivity: edge.positivity,
        evidence: [...edge.evidence].slice(0, 6),
        firstSeenChapter: edge.firstSeenChapter,
        confidence: Number(edge.confidence.toFixed(2)),
      })),
    };

    const chapterFunctionTable = chapterMaps.map((chapter) => ({
      chapterOrder: chapter.order,
      title: chapter.title,
      function: chapter.plotFunction,
      goal: chapter.chapterGoal || "待后续章节补全",
      conflict: chapter.conflict || "待后续章节补全",
      hook: chapter.hook,
    }));

    return {
      book: {
        title: input.title,
        genre: input.genre,
        chapterCountEstimate: preprocessing.chapters.length,
        oneSentencePremise: this.mergeReducerList(
          chapterMaps.slice(0, 2).map((chapter) => chapter.summary),
          2,
        ).join(" / "),
        coreAppeal: this.mergeReducerList(
          [
            ...plotFunctions,
            ...chapterMaps.slice(0, 3).map((chapter) => chapter.hook),
            `已拆 ${chapterMaps.length}/${partialResult.totalChapters} 章`,
          ],
          6,
        ),
      },
      characters,
      relationships,
      worldbuilding: {
        worldRules: [...worldSignals].slice(0, 8),
        powerSystem: [...worldSignals]
          .filter((signal) => /能力|力量|规则|体系|血脉|法则/i.test(signal))
          .slice(0, 6),
        locations: [],
        factions: [],
        itemsAndTerms: [...worldSignals].slice(0, 8).map((signal) => ({
          name: signal,
          function: "从已拆章节中的世界观信号提取",
          risk: "partial",
        })),
      },
      chronicle: [...timelineEvents].slice(0, 24).map((event, index) => ({
        order: index + 1,
        event,
        impact: "从已完成章节 map 中归纳的临时时间线事件",
        storyFunction: index === 0 ? "开局信息" : "推进事件",
      })),
      writingSupport: {
        chapterFunctionTable,
        foreshadowingLedger: chapterMaps.flatMap((chapter) =>
          (chapter.foreshadowingSetups || []).slice(0, 2).map((setup) => ({
            setup,
            setupChapter: chapter.order,
            payoff: chapter.payoffSignals?.[0] || "待后续章节回收",
            status: "open",
            risk: "当前为半拆结果，回收关系仍需更多章节验证。",
          })),
        ),
        emotionalBeatMap: chapterMaps.map((chapter) => ({
          chapterOrder: chapter.order,
          beats: chapter.emotionalBeats?.length
            ? chapter.emotionalBeats
            : ["冲突推进", "待补全情绪曲线"],
          intensity: chapter.analysisDepth === "deep" ? "high" : "medium",
          readerPromise: chapter.hook,
        })),
        pacingCurve: chapterMaps.map((chapter) => ({
          chapterOrder: chapter.order,
          informationDensity: chapter.worldbuildingSignals.length
            ? "medium"
            : "low",
          conflictIntensity: chapter.conflict ? "high" : "medium",
          hookStrength: chapter.hook ? "high" : "medium",
          risk: "基于半拆结果推断，仍需全书 reduce 后复核。",
        })),
        readerPromiseChecklist: chapterMaps.slice(0, 8).map((chapter) => ({
          promise: chapter.hook,
          status: "pending",
          nextCheck: `补齐第 ${chapter.order} 章后的后续回收与升级。`,
        })),
        conflictMatrix: relationships.edges.slice(0, 12).map((edge) => ({
          parties: [edge.source, edge.target],
          conflict: edge.label,
          level: edge.tension,
          nextEscalation: "待更多章节确认冲突升级路径。",
        })),
        continuationPack: {
          currentState: `当前已拆 ${chapterMaps.length}/${partialResult.totalChapters} 章，临时资产仅覆盖已完成章节。`,
          nextChapterGoal: "优先补齐未拆章节，再复核角色弧线与关系图谱。",
          openThreads: this.mergeReducerList(
            chapterMaps.flatMap((chapter) => chapter.foreshadowingSetups || []),
            8,
          ),
          oocGuards: ["当前角色卡为半拆草稿，定稿前不要直接当成完整人物设定。"],
          settingGuards: ["当前图谱只反映已分析章节，不代表全书最终关系结构。"],
          styleConstraints: ["补完全书后再做最终原创化整理与导出。"],
          aiPrompt:
            "这是基于半拆结果自动生成的临时续写上下文，使用前请先人工复核。",
        },
        qualityDiagnosis: {
          strengths: ["已能从部分章节提取角色、冲突与世界观信号。"],
          weaknesses: ["未覆盖全书，角色弧线和关系图仍可能缺边或误边。"],
          priorityFixes: [
            "继续补拆剩余章节",
            "复核低证据关系边",
            "补全主角目标、代价、回收链条",
          ],
        },
      },
      generationAssets: {
        worldBook: {
          entries: [...worldSignals].slice(0, 8).map((signal, index) => ({
            keys: [signal],
            secondaryKeys: [],
            category: "partial-signal",
            content: `从已拆章节提取的临时世界设定信号：${signal}`,
            insertionOrder: 100 + index * 10,
            priority: 50,
            constant: false,
            selective: true,
            sourceRisk: "partial",
            originalizationNote: "半拆草稿，需要在全书完成后再原创化和校准。",
          })),
          activationRules: [
            "仅在半拆结果复盘时作为线索参考，不要直接视为全书定稿世界书。",
          ],
          importNotes: "当前 world book 为 partial preview。",
        },
        styleBible: {
          narrativePOV: "待全书完成后归纳",
          toneKeywords: this.mergeReducerList(
            chapterMaps.flatMap((chapter) => chapter.emotionalBeats || []),
            6,
          ),
          proseRules: ["当前风格规则来自已拆章节草稿，后续需整体复核。"],
          dialogueRules: [],
          tabooList: ["未完成全书拆解前，不要把当前临时资产当成最终定稿。"],
        },
        volumePlan: [],
        sceneTemplates: [],
        characterVoiceGuide: characters.slice(0, 8).map((character) => ({
          character: character.sourceName,
          speechStyle: "待更多章节证据补全",
          forbiddenTone: ["半拆草稿，不要直接定稿语气"],
        })),
        antagonistPressurePlan: [],
        titleSynopsisKeywordPack: {
          titleKeywords: this.mergeReducerList(
            chapterMaps.flatMap((chapter) => chapter.characterSignals),
            6,
          ),
          synopsisSellingPoints: this.mergeReducerList(
            chapterMaps.slice(0, 4).map((chapter) => chapter.summary),
            4,
          ),
          searchTags: this.mergeReducerList([...worldSignals], 8),
          openingKeywords: this.mergeReducerList(
            chapterMaps.slice(0, 3).map((chapter) => chapter.hook),
            4,
          ),
        },
        consistencyChecklist: [
          "当前图谱/角色卡只覆盖已拆章节。",
          "先补完剩余章节，再做最终世界书和角色卡定稿。",
        ],
      },
      exportPackage: {
        tavernCharacterCards: characters.map((character) => ({
          name: character.originalCharacterCard.namePlaceholder,
          description: character.originalCharacterCard.summary,
          personality: character.originalCharacterCard.personality,
          scenario: character.originalCharacterCard.scenario,
          first_mes: character.originalCharacterCard.firstMessage,
          creator_notes:
            "Partial preview generated from incomplete chapter maps.",
        })),
        worldBookEntries: [...worldSignals].slice(0, 8).map((signal) => ({
          keys: [signal],
          content: `Partial preview signal: ${signal}`,
          insertion_order: 100,
        })),
        writingConstraints: [
          "Partial preview only.",
          "Complete the remaining chapters before final export.",
        ],
        doNotCopyList: characters
          .slice(0, 8)
          .map((character) => character.sourceName),
      },
      originalizationReport: {
        riskLevel: "partial-preview",
        safeToLearn: ["角色/关系/世界观线索提取方式"],
        mustTransform: ["所有临时角色名、关系和设定都需要在全书完成后再复核"],
        rewriteStrategy: ["先补全全书拆解，再进行原创化整理。"],
        fanFictionWarning:
          "Current assets are partial previews derived from incomplete chapter coverage.",
      },
      usageRiskNotice: {
        summary:
          "This preview is derived from incomplete chapter maps and should be treated as a draft.",
        recommendedUse: [
          "图谱草稿复核",
          "角色卡方向预览",
          "继续补拆前的中间检查",
        ],
        higherRiskUse: ["直接当最终角色卡发布", "直接作为完整世界书导出"],
        userResponsibility: "补完全书并人工复核后再视为正式资产。",
      },
    };
  }

  private extractEntityCandidates(signals: string[]) {
    return this.mergeReducerList(
      signals.flatMap((signal) =>
        asText(signal)
          .split(/[、,，/|｜;；]/)
          .flatMap((token) => token.split(/\s*(?:与|和|对|vs\.?|VS|->|→)\s*/))
          .map((token) =>
            token
              .trim()
              .replace(/^[【[(（"'“]+|[】\])）"'”.,，。:：;；!?！？]+$/g, ""),
          )
          .filter(
            (token) =>
              token.length >= 2 &&
              token.length <= 24 &&
              !/角色|人物|关系|主线|冲突|世界|设定|事件|线索|章节/.test(token),
          ),
      ),
      24,
    );
  }

  private partialRelationshipPositivity(label: string) {
    if (/支持|合作|守护|依赖|亲近|盟友|信任/.test(label)) {
      return 0.65;
    }
    if (/敌|压迫|对抗|冲突|背叛|威胁|利用/.test(label)) {
      return -0.65;
    }
    return 0;
  }

  private normalizeBookCharacters(value: unknown, fallback: unknown[]) {
    const rawCharacters = this.arrayOrDefault(value, fallback);
    return rawCharacters
      .filter((item): item is Record<string, any> =>
        Boolean(item && typeof item === "object"),
      )
      .map((character, index) => {
        const sourceName =
          asText(character.sourceName) ||
          asText(character.common_name) ||
          asText(character.name) ||
          `角色 ${index + 1}`;
        const names = this.mergeReducerList(
          [
            sourceName,
            ...asTextList(character.names),
            ...asTextList(character.aliases),
          ],
          12,
        );
        const graphId =
          typeof character.id === "number" && Number.isFinite(character.id)
            ? String(character.id)
            : asText(character.id);
        return {
          id: graphId || sourceName,
          sourceName,
          role:
            asText(character.role) ||
            (character.main_character || character.mainCharacter
              ? "主角"
              : "配角"),
          archetype:
            asText(character.archetype) ||
            asText(character.description) ||
            "待归纳角色原型",
          personalityCore: this.arrayOrDefault(
            character.personalityCore,
            asText(character.description)
              ? [asText(character.description)]
              : ["待补充性格底色"],
          ),
          desire: asText(character.desire) || "待归纳核心欲望",
          fearOrWound: asText(character.fearOrWound) || "待归纳创伤或顾虑",
          capability: asText(character.capability) || "待归纳能力功能",
          relationshipFunction:
            asText(character.relationshipFunction) ||
            asText(character.description) ||
            "待归纳关系功能",
          names,
          mainCharacter: Boolean(
            character.main_character || character.mainCharacter,
          ),
          portraitPrompt:
            asText(character.portraitPrompt) ||
            asText(character.portrait_prompt) ||
            asText(character.avatarPrompt),
          originalCharacterCard: {
            namePlaceholder:
              character.originalCharacterCard?.namePlaceholder ||
              "原创角色名占位",
            summary:
              character.originalCharacterCard?.summary ||
              asText(character.description) ||
              `${sourceName} 的原创化角色简介待补充。`,
            personality:
              character.originalCharacterCard?.personality ||
              asText(character.description) ||
              "待补充原创化性格描述。",
            scenario:
              character.originalCharacterCard?.scenario ||
              "待补充适合开局或关键冲突的场景。",
            firstMessage:
              character.originalCharacterCard?.firstMessage ||
              "待补充角色开场白。",
            doNotCopy: this.arrayOrDefault(
              character.originalCharacterCard?.doNotCopy,
              names,
            ),
          },
        };
      });
  }

  private normalizeBookRelationships(input: {
    rawRelationships: unknown;
    characters: unknown[];
    worldbuilding: unknown;
    fallback: {
      nodes: Array<{ id: string; label: string; type: string }>;
      edges: Array<{
        source: string;
        target: string;
        label: string;
        tension: string;
      }>;
    };
  }) {
    const raw = (input.rawRelationships || {}) as Record<string, any>;
    const nodes = new Map<
      string,
      {
        id: string;
        label: string;
        type: string;
        names: string[];
        mainCharacter: boolean;
        description: string;
        portraitPrompt: string;
      }
    >();
    const aliases = new Map<string, string>();

    const toGraphText = (value: unknown) =>
      typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : asText(value);

    const registerAlias = (alias: unknown, id: string) => {
      const text = toGraphText(alias);
      if (!text) {
        return;
      }
      aliases.set(text, id);
      aliases.set(this.normalizeGraphKey(text), id);
    };

    const addNode = (node: Record<string, any>) => {
      const label =
        asText(node.label) ||
        asText(node.common_name) ||
        asText(node.sourceName) ||
        asText(node.name) ||
        toGraphText(node.id);
      if (!label) {
        return undefined;
      }
      const id =
        toGraphText(node.id) ||
        toGraphText(node.nodeId) ||
        this.normalizeGraphKey(label);
      const existing = nodes.get(id);
      const names = this.mergeReducerList(
        [
          ...(existing?.names || []),
          label,
          ...asTextList(node.names),
          ...asTextList(node.aliases),
        ],
        12,
      );
      const next = {
        id,
        label: existing?.label || label,
        type:
          asText(node.type) ||
          existing?.type ||
          (node.role || node.archetype ? "character" : "unknown"),
        names,
        mainCharacter:
          Boolean(node.mainCharacter) ||
          Boolean(node.main_character) ||
          existing?.mainCharacter ||
          /主角|protagonist|main/i.test(
            `${asText(node.role)} ${asText(node.archetype)}`,
          ),
        description:
          asText(node.description) ||
          asText(node.relationshipFunction) ||
          existing?.description ||
          "",
        portraitPrompt:
          asText(node.portraitPrompt) ||
          asText(node.portrait_prompt) ||
          asText(node.avatarPrompt) ||
          existing?.portraitPrompt ||
          "",
      };
      nodes.set(id, next);
      registerAlias(id, id);
      registerAlias(label, id);
      names.forEach((name) => registerAlias(name, id));
      return next;
    };

    const hasRelationshipSource =
      Array.isArray(raw.nodes) ||
      Array.isArray(raw.edges) ||
      Array.isArray(raw.relations) ||
      input.characters.length > 0;
    const rawNodes =
      Array.isArray(raw.nodes) && raw.nodes.length
        ? raw.nodes
        : hasRelationshipSource
          ? []
          : input.fallback.nodes;

    rawNodes.forEach((node) => {
      if (node && typeof node === "object") {
        addNode(node as Record<string, any>);
      }
    });
    input.characters.forEach((character) => {
      if (character && typeof character === "object") {
        const item = character as Record<string, any>;
        addNode({
          ...item,
          label: item.sourceName || item.common_name || item.name,
          type: "character",
          names: item.names || item.aliases,
          description: item.relationshipFunction || item.description,
          portraitPrompt: item.portraitPrompt || item.portrait_prompt,
        });
      }
    });

    const worldbuilding = (input.worldbuilding || {}) as Record<string, any>;
    this.asObjectList(worldbuilding.locations).forEach((location) =>
      addNode({
        id: asText(location.name),
        label: location.name,
        type: "location",
        description: location.function,
      }),
    );
    this.asObjectList(worldbuilding.factions).forEach((faction) =>
      addNode({
        id: asText(faction.name),
        label: faction.name,
        type: "faction",
        description: faction.conflictRole || faction.goal,
      }),
    );

    const resolveNodeId = (value: unknown) => {
      const text = toGraphText(value);
      if (!text) {
        return "";
      }
      return (
        aliases.get(text) || aliases.get(this.normalizeGraphKey(text)) || ""
      );
    };
    const rawEdges =
      Array.isArray(raw.edges) && raw.edges.length
        ? raw.edges
        : Array.isArray(raw.relations) && raw.relations.length
          ? raw.relations
          : hasRelationshipSource
            ? []
            : input.fallback.edges;
    const edgeMap = new Map<
      string,
      {
        source: string;
        target: string;
        label: string;
        tension: string;
        relation: string[];
        weight: number;
        positivity: number;
        evidence: string[];
        firstSeenChapter?: number;
        confidence: number;
      }
    >();
    let duplicateMergeCount = 0;

    rawEdges.forEach((edge) => {
      if (!edge || typeof edge !== "object") {
        return;
      }
      const item = edge as Record<string, any>;
      const source =
        resolveNodeId(item.source) ||
        resolveNodeId(item.id1) ||
        resolveNodeId(item.from);
      const target =
        resolveNodeId(item.target) ||
        resolveNodeId(item.id2) ||
        resolveNodeId(item.to);
      if (!source || !target || source === target) {
        return;
      }
      const [left, right] = [source, target].sort();
      const key = `${left}--${right}`;
      const relation = this.mergeReducerList(
        [
          ...asTextList(item.relation),
          asText(item.label),
          asText(item.type),
        ],
        8,
      );
      const existing = edgeMap.get(key);
      if (existing) {
        duplicateMergeCount += 1;
      }
      const weight = clampNumber(
        Number(item.weight ?? item.strength ?? 1),
        1,
        10,
        1,
      );
      const positivity = clampNumber(
        Number(item.positivity ?? item.sentiment ?? 0),
        -1,
        1,
        0,
      );
      const evidence = this.mergeReducerList(
        [
          ...(existing?.evidence || []),
          ...asTextList(item.evidence),
          ...asTextList(item.evidenceSnippets),
        ],
        6,
      );
      edgeMap.set(key, {
        source: existing?.source || source,
        target: existing?.target || target,
        label:
          relation[0] || existing?.label || asText(item.label) || "关系",
        tension:
          asText(item.tension) ||
          existing?.tension ||
          this.relationshipTensionFromPositivity(positivity),
        relation: this.mergeReducerList(
          [...(existing?.relation || []), ...relation],
          8,
        ),
        weight: existing ? Math.max(existing.weight, weight) : weight,
        positivity: existing
          ? clampNumber((existing.positivity + positivity) / 2, -1, 1, 0)
          : positivity,
        evidence,
        firstSeenChapter:
          typeof item.firstSeenChapter === "number"
            ? item.firstSeenChapter
            : existing?.firstSeenChapter,
        confidence: clampNumber(
          Number(item.confidence ?? existing?.confidence ?? 0.7),
          0,
          1,
          0.7,
        ),
      });
    });

    return {
      nodes: [...nodes.values()].map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        names: node.names,
        mainCharacter: node.mainCharacter,
        description: node.description,
        portraitPrompt: node.portraitPrompt,
      })),
      edges: [...edgeMap.values()],
      duplicateMergeCount,
    };
  }

  private buildRelationshipGraphQuality(relationships: {
    nodes: Array<{ id: string; label: string; type?: string }>;
    edges: Array<{
      source: string;
      target: string;
      label?: string;
      relation?: string[];
      evidence?: string[];
      confidence?: number;
    }>;
    duplicateMergeCount?: number;
  }) {
    const nodeDegree = new Map<string, number>();
    const nodeLabels = new Map(
      relationships.nodes.map((node) => [node.id, node.label]),
    );
    relationships.nodes.forEach((node) => nodeDegree.set(node.id, 0));
    relationships.edges.forEach((edge) => {
      nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
      nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
    });

    const isolatedNodes = relationships.nodes
      .filter((node) => (nodeDegree.get(node.id) || 0) === 0)
      .map((node) => ({
        id: node.id,
        label: node.label,
        type: node.type || "unknown",
        suggestedQuery: node.label,
        reviewAction: "检索该节点名称，确认它是否应并入已有角色、势力或地点。",
      }));
    const weakEvidenceEdges = relationships.edges
      .map((edge) => {
        const evidenceCount = edge.evidence?.length || 0;
        const confidence = clampNumber(
          Number(edge.confidence ?? 0.7),
          0,
          1,
          0.7,
        );
        const reasons = [
          evidenceCount === 0 ? "缺少文本证据" : "",
          confidence < 0.55 ? "置信度偏低" : "",
        ].filter(Boolean);
        if (!reasons.length) {
          return undefined;
        }
        const sourceLabel = nodeLabels.get(edge.source) || edge.source;
        const targetLabel = nodeLabels.get(edge.target) || edge.target;
        const label = edge.relation?.length
          ? edge.relation.join("、")
          : edge.label || `${sourceLabel}->${targetLabel}`;
        return {
          source: edge.source,
          target: edge.target,
          sourceLabel,
          targetLabel,
          label,
          confidence,
          evidenceCount,
          reason: reasons.join("；"),
          suggestedQuery: [sourceLabel, targetLabel, label]
            .filter(Boolean)
            .join(" "),
          reviewAction: "检索双方名称和关系词，补充证据后再用于图谱学习。",
        };
      })
      .filter(
        (
          item,
        ): item is {
          source: string;
          target: string;
          sourceLabel: string;
          targetLabel: string;
          label: string;
          confidence: number;
          evidenceCount: number;
          reason: string;
          suggestedQuery: string;
          reviewAction: string;
        } => Boolean(item),
      );

    const nodeCount = relationships.nodes.length;
    const edgeCount = relationships.edges.length;
    const averageConfidence =
      edgeCount > 0
        ? Number(
            (
              relationships.edges.reduce(
                (sum, edge) =>
                  sum +
                  clampNumber(Number(edge.confidence ?? 0.7), 0, 1, 0.7),
                0,
              ) / edgeCount
            ).toFixed(2),
          )
        : 0;
    const evidenceCoverage =
      edgeCount > 0
        ? Number(
            (
              relationships.edges.filter((edge) => edge.evidence?.length)
                .length / edgeCount
            ).toFixed(2),
          )
        : 0;
    const isolatedRatio = nodeCount > 0 ? isolatedNodes.length / nodeCount : 1;
    const weakEdgeRatio =
      edgeCount > 0 ? weakEvidenceEdges.length / edgeCount : 1;
    const riskLevel =
      edgeCount === 0 || nodeCount < 2 || weakEdgeRatio >= 0.7
        ? "weak"
        : isolatedRatio > 0.45 ||
            weakEdgeRatio > 0.35 ||
            averageConfidence < 0.6
          ? "needs-review"
          : "good";
    const recommendedFixes = [
      edgeCount === 0
        ? "没有抽到关系边，建议补充更多章节或启用深拆后重跑。"
        : "",
      isolatedNodes.length
        ? "存在孤立节点，建议检查角色别名、势力名和地点名是否被正确合并。"
        : "",
      weakEvidenceEdges.length
        ? "部分关系缺少证据或置信度偏低，建议回到章节证据索引补证据后再用于仿写。"
        : "",
      (relationships.duplicateMergeCount || 0) > 0
        ? "系统已合并重复关系，建议优先查看合并后的关系标签是否语义一致。"
        : "",
    ].filter(Boolean);

    return {
      nodeCount,
      edgeCount,
      duplicateMergeCount: relationships.duplicateMergeCount || 0,
      isolatedNodes,
      weakEvidenceEdges,
      averageConfidence,
      evidenceCoverage,
      riskLevel,
      recommendedFixes,
    };
  }

  private asObjectList(value: unknown): Array<Record<string, any>> {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, any> =>
          Boolean(item && typeof item === "object"),
        )
      : [];
  }

  private normalizeGraphKey(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fa5-]/g, "");
  }

  private relationshipTensionFromPositivity(value: number) {
    if (value < -0.1) {
      return "冲突/对抗";
    }
    if (value > 0.1) {
      return "支持/亲近";
    }
    return "中性/博弈";
  }

  private normalizeChapterMapResult(
    chapter: ChapterSegment,
    raw: RawChapterMapResult,
    options?: {
      analysisDepth?: "outline" | "deep";
      focusScore?: number;
      fallback?: Partial<ChapterMapResult>;
    },
  ): ChapterMapResult {
    const fallback = options?.fallback;
    const evidenceSnippets = this.mergeReducerList(
      asTextList(raw.evidenceSnippets)
        .concat(
          (raw.sourceAnchors || []).map((item) => asText(item?.quote)),
        )
        .concat(fallback?.evidenceSnippets || []),
      3,
    );

    return {
      chapterId: raw.chapterId || chapter.id,
      order: typeof raw.order === "number" ? raw.order : chapter.order,
      title: raw.title?.trim() || chapter.title,
      analysisDepth:
        options?.analysisDepth || fallback?.analysisDepth || "deep",
      focusScore: options?.focusScore ?? fallback?.focusScore,
      chunkStartOffset: chapter.startOffset,
      chunkEndOffset: chapter.endOffset,
      splitBy: chapter.splitBy,
      summary:
        raw.summary?.trim() ||
        fallback?.summary ||
        `${chapter.title} 展示本段主要事件、冲突升级和追读问题。`,
      plotFunction:
        raw.plotFunction?.trim() ||
        fallback?.plotFunction ||
        "推进主线并制造后续期待",
      chapterGoal:
        raw.chapterGoal?.trim() || fallback?.chapterGoal || undefined,
      conflict: raw.conflict?.trim() || fallback?.conflict || undefined,
      characterSignals:
        asTextList(raw.characterSignals).length > 0
          ? asTextList(raw.characterSignals)
          : fallback?.characterSignals || [],
      worldbuildingSignals:
        asTextList(raw.worldbuildingSignals).length > 0
          ? asTextList(raw.worldbuildingSignals)
          : fallback?.worldbuildingSignals || [],
      relationshipSignals:
        asTextList(raw.relationshipSignals).length > 0
          ? asTextList(raw.relationshipSignals)
          : fallback?.relationshipSignals || [],
      timelineEvents:
        asTextList(raw.timelineEvents).length > 0
          ? asTextList(raw.timelineEvents)
          : fallback?.timelineEvents || [],
      emotionalBeats:
        asTextList(raw.emotionalBeats).length > 0
          ? asTextList(raw.emotionalBeats)
          : fallback?.emotionalBeats || [],
      foreshadowingSetups:
        asTextList(raw.foreshadowingSetups).length > 0
          ? asTextList(raw.foreshadowingSetups)
          : fallback?.foreshadowingSetups || [],
      payoffSignals:
        asTextList(raw.payoffSignals).length > 0
          ? asTextList(raw.payoffSignals)
          : fallback?.payoffSignals || [],
      sourceRiskSignals:
        asTextList(raw.sourceRiskSignals).length > 0
          ? asTextList(raw.sourceRiskSignals)
          : fallback?.sourceRiskSignals || [],
      originalizationSeeds:
        asTextList(raw.originalizationSeeds).length > 0
          ? asTextList(raw.originalizationSeeds)
          : fallback?.originalizationSeeds || [],
      hook:
        raw.hook?.trim() ||
        fallback?.hook ||
        "本段结尾留下新的冲突或待揭示信息",
      evidenceSnippets,
      sourceAnchors: this.buildSourceAnchors(chapter, raw, evidenceSnippets),
    };
  }

  private buildSourceAnchors(
    chapter: ChapterSegment,
    raw: RawChapterMapResult,
    evidenceSnippets: string[],
  ) {
    const requestedAnchors = (raw.sourceAnchors || [])
      .map((item, index) => ({
        label: asText(item?.label) || `证据 ${index + 1}`,
        quote: asText(item?.quote),
      }))
      .filter((item) => item.quote);
    const fallbackAnchors = evidenceSnippets.map((quote, index) => ({
      label: `摘录 ${index + 1}`,
      quote,
    }));
    const anchors = requestedAnchors.length
      ? requestedAnchors
      : fallbackAnchors;

    return anchors
      .map((anchor, index) => {
        const range = this.locateQuoteRange(chapter.text, anchor.quote);
        if (!range) {
          return null;
        }

        return {
          anchorId: `${chapter.id}-anchor-${index + 1}`,
          label: anchor.label,
          quote: anchor.quote,
          startOffset: chapter.startOffset + range.start,
          endOffset: chapter.startOffset + range.end,
        };
      })
      .filter(
        (
          anchor,
        ): anchor is {
          anchorId: string;
          label: string;
          quote: string;
          startOffset: number;
          endOffset: number;
        } => Boolean(anchor),
      );
  }

  private locateQuoteRange(text: string, quote: string) {
    const normalizedQuote = quote.trim();
    if (!normalizedQuote) {
      return null;
    }

    const directIndex = text.indexOf(normalizedQuote);
    if (directIndex >= 0) {
      return {
        start: directIndex,
        end: directIndex + normalizedQuote.length,
      };
    }

    const compactText = text.replace(/\s+/g, "");
    const compactQuote = normalizedQuote.replace(/\s+/g, "");
    const compactIndex = compactText.indexOf(compactQuote);
    if (compactIndex < 0) {
      return null;
    }

    let compactCursor = 0;
    let start = -1;
    let end = -1;
    for (let index = 0; index < text.length; index += 1) {
      if (/\s/.test(text[index] || "")) {
        continue;
      }
      if (compactCursor === compactIndex) {
        start = index;
      }
      compactCursor += 1;
      if (compactCursor === compactIndex + compactQuote.length) {
        end = index + 1;
        break;
      }
    }

    return start >= 0 && end >= 0 ? { start, end } : null;
  }

  private async analyzeChapterOutline(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
  ) {
    const content = await this.modelProviders.chat(
      input.provider,
      [
        {
          role: "system",
          content:
            "你是中文长篇小说分块索引助手。只返回合法 JSON，不使用 Markdown，不长篇复述正文。",
        },
        {
          role: "user",
          content: this.bookChapterOutlinePrompt(input, chapter),
        },
      ],
      { maxOutputTokens: 900 },
    );

    const raw = (await parseJsonWithRepair(
      this.modelProviders,
      input.provider,
      content,
      `章节轻索引 ${chapter.title || chapter.id}`,
    )) as RawChapterMapResult;

    return this.normalizeChapterMapResult(chapter, raw, {
      analysisDepth: "outline",
      focusScore: this.scoreOutlinePriority(chapter, raw),
    });
  }

  private async analyzeChapterMap(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
    fallback?: ChapterMapResult,
  ) {
    const content = await this.modelProviders.chat(
      input.provider,
      [
        {
          role: "system",
          content:
            "你是中文长篇小说拆书架构师。你只返回合法 JSON，不使用 Markdown，不输出版权文本长摘录。",
        },
        {
          role: "user",
          content: this.bookChapterMapPrompt(input, chapter, fallback),
        },
      ],
      { maxOutputTokens: 1800 },
    );

    const raw = (await parseJsonWithRepair(
      this.modelProviders,
      input.provider,
      content,
      `章节拆解 ${chapter.title || chapter.id}`,
    )) as RawChapterMapResult;

    return this.normalizeChapterMapResult(chapter, raw, {
      analysisDepth: "deep",
      focusScore:
        fallback?.focusScore ?? this.scoreOutlinePriority(chapter, raw),
      fallback,
    });
  }

  private async reduceBookMaps(
    input: AnalyzeBookDto,
    preprocessing: BookPreprocessResult,
    chapterMaps: ChapterMapResult[],
  ) {
    const reducerChapterMaps = this.prepareReducerChapterMaps(chapterMaps);
    const content = await this.modelProviders.chat(
      input.provider,
      [
        {
          role: "system",
          content:
            "你是中文长篇小说拆书架构师。你只返回合法 JSON，不使用 Markdown，不输出版权文本长摘录。",
        },
        {
          role: "user",
          content: this.bookReducePrompt(
            input,
            preprocessing,
            reducerChapterMaps,
          ),
        },
      ],
      { maxOutputTokens: 3072 },
    );

    return parseJsonWithRepair(this.modelProviders, input.provider, content, "整书汇总");
  }

  private bookChapterOutlinePrompt(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
  ): string {
    return `
You are building a lightweight outline index for one chunk of a long web novel.
Focus on structural signals instead of exhaustive interpretation.
All natural-language JSON values must be written in Simplified Chinese. Keep JSON keys and enum-like status tokens in English only when the schema requires them.

Book title: ${input.title}
Genre: ${input.genre}
Chunk order: ${chapter.order}
Chunk title: ${chapter.title}

Chunk text:
${chapter.text}

Return valid JSON only:
{
  "chapterId": "${chapter.id}",
  "order": ${chapter.order},
  "title": "${chapter.title}",
  "summary": "本片段一句话摘要",
  "plotFunction": "本片段在故事中的结构功能",
  "chapterGoal": "本片段的可见目标",
  "conflict": "本片段的主要冲突或压力",
  "characterSignals": ["简短人物事实信号"],
  "worldbuildingSignals": ["简短设定事实信号"],
  "relationshipSignals": ["简短关系变化信号"],
  "timelineEvents": ["事件卡片"],
  "emotionalBeats": ["简短情绪节拍"],
  "foreshadowingSetups": ["未解线索或伏笔"],
  "payoffSignals": ["已回收的期待或兑现"],
  "sourceRiskSignals": ["有复用风险的姓名、专名或桥段链"],
  "originalizationSeeds": ["可迁移的结构种子"],
  "hook": "核心悬念、转折或追读期待",
  "evidenceSnippets": ["最多 3 条短摘录，每条不超过 24 字"],
  "sourceAnchors": [
    {
      "label": "证据标签",
      "quote": "原文短摘录，不超过 24 字"
    }
  ]
}
Requirements:
1. Only analyze the visible chunk.
2. Keep each field concise.
3. Evidence must come from this chunk exactly.
4. Prefer indexing signals over long explanation.
5. Do not output English prose for summary, hook, promise, goal, conflict, timeline, relationship, foreshadowing, payoff, style, or diagnosis fields.
`.trim();
  }

  private bookChapterMapPrompt(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
    outline?: ChapterMapResult,
  ): string {
    const outlineContext = outline
      ? `\nExisting outline index for this chunk:\n${JSON.stringify(
          {
            summary: outline.summary,
            plotFunction: outline.plotFunction,
            chapterGoal: outline.chapterGoal,
            conflict: outline.conflict,
            characterSignals: outline.characterSignals,
            worldbuildingSignals: outline.worldbuildingSignals,
            relationshipSignals: outline.relationshipSignals,
            timelineEvents: outline.timelineEvents,
            emotionalBeats: outline.emotionalBeats ?? [],
            foreshadowingSetups: outline.foreshadowingSetups ?? [],
            payoffSignals: outline.payoffSignals ?? [],
            hook: outline.hook,
          },
          null,
          2,
        )}\nUse it as a starting index, then deepen and correct it from the chunk text.\n`
      : "";

    return `
请对整本小说中的一个章节片段做 map 阶段拆解。只分析当前章节，不要推测不可见全文，不要大段复述原文。

作品标题：${input.title}
作品题材：${input.genre}
章节序号：${chapter.order}
章节标题：${chapter.title}

章节正文：
${chapter.text}
${outlineContext}

请严格返回这个 JSON 结构：
{
  "chapterId": "${chapter.id}",
  "order": ${chapter.order},
  "title": "${chapter.title}",
  "summary": "本章一句话摘要",
  "plotFunction": "本章在整书里的叙事功能",
  "chapterGoal": "本章主角或叙事目标",
  "conflict": "本章主要冲突和压力来源",
  "characterSignals": ["人物性格、欲望、创伤、能力等信号"],
  "worldbuildingSignals": ["世界规则、地点、势力、物品、术语等信号"],
  "relationshipSignals": ["人物/势力之间的关系变化"],
  "timelineEvents": ["可进入大事纪的事件"],
  "emotionalBeats": ["爽点、虐点、甜点、悬念点、打脸点、反转点"],
  "foreshadowingSetups": ["本章埋下的伏笔或未解问题"],
  "payoffSignals": ["本章回收了哪些期待、伏笔或情绪债"],
  "sourceRiskSignals": ["直接复用时可能有辨识度的姓名、专名、关系或桥段"],
  "originalizationSeeds": ["可抽象迁移成原创素材的结构功能"],
  "hook": "本章结尾或核心追读钩子",
  "evidenceSnippets": ["最多 3 条短摘录，每条不超过 24 字，必须原样来自当前片段"],
  "sourceAnchors": [
    {
      "label": "对应 summary / conflict / hook 的证据标签",
      "quote": "原样短摘录，不超过 24 字"
    }
  ]
}
要求：
1. 只基于当前可见片段，不要补全整书未知内容。
2. evidenceSnippets 和 sourceAnchors.quote 必须是当前片段里的原文短摘录。
3. 不要返回 startOffset / endOffset，我会在服务端按摘录回查原文位置。
4. 所有字段尽量短，优先输出结构化事实卡片，而不是长段解释。
5. 除 JSON key、枚举值和必要英文专名外，所有面向作者阅读的自然语言字段必须使用简体中文；不要输出英文句子。
`.trim();
  }

  private bookReducePrompt(
    input: AnalyzeBookDto,
    preprocessing: BookPreprocessResult,
    chapterMaps: ChapterMapResult[],
  ): string {
    return `
请把章节 map 结果 reduce 成整书级创作资产。目标不是复刻原作，而是帮助作者理解结构，并导出“原创化”角色/世界书/写作约束。

作品标题：${input.title}
作品题材：${input.genre}
清洗统计：${JSON.stringify(preprocessing.cleaning)}
章节数：${preprocessing.chapters.length}

章节 map 结果：
${JSON.stringify(chapterMaps, null, 2)}

请严格返回这个 JSON 结构：
{
  "mode": "book-asset-analysis",
  "book": {
    "title": "作品标题",
    "genre": "题材",
    "chapterCountEstimate": 0,
    "oneSentencePremise": "一句话概括",
    "coreAppeal": ["核心吸引力"]
  },
  "transferableStyleCard": {
    "coreStyleTags": ["可迁移风格标签，不能写成仿写某作者"],
    "narrativeVoice": "叙事视角、声音、信息遮蔽方式",
    "sentenceRhythm": "句长、长短句切换、口语/书面比例",
    "paragraphPattern": "段落长度、换行节奏、移动端可读性",
    "dialoguePattern": "对白比例、说话标签、人物声音差异",
    "sensoryFocus": ["视觉/触觉/听觉/味觉/嗅觉等主导感官"],
    "pleasureMechanisms": ["力量型/地位型/情感型/认知型/探索型爽点"],
    "hookPatterns": ["悬念型/危机型/转折型/期待型/揭示型钩子"],
    "styleRules": ["可迁移写法规则，要求可自检"],
    "antiPatterns": ["写同类原创故事时必须避免的做法"]
  },
  "worldbuilding": {
    "worldRules": ["世界运行规则"],
    "powerSystem": ["能力/修炼/技术体系"],
    "locations": [{"name":"地点","function":"叙事功能","originalizationNote":"原创化时如何替换"}],
    "factions": [{"name":"势力","goal":"目标","conflictRole":"冲突功能","originalizationNote":"原创化时如何替换"}],
    "itemsAndTerms": [{"name":"专有名词","function":"功能","risk":"direct-copy-risk|generic|low"}]
  },
  "characters": [
    {
      "sourceName": "原作角色名或代号",
      "role": "主角/反派/导师/配角",
      "archetype": "抽象原型",
      "personalityCore": ["性格底色"],
      "desire": "核心欲望",
      "fearOrWound": "恐惧或创伤",
      "capability": "能力功能，不复制专名",
      "relationshipFunction": "在关系网中的叙事功能",
      "portraitPrompt": "可选，抽象化人物肖像提示，不复用原作专有视觉元素",
      "originalCharacterCard": {
        "namePlaceholder": "原创角色名占位",
        "summary": "可导入写作软件的原创化角色简介",
        "personality": "原创化性格描述",
        "scenario": "适合开局场景",
        "firstMessage": "角色开场白草稿",
        "doNotCopy": ["必须避开的原作可识别元素"]
      }
    }
  ],
  "relationships": {
    "nodes": [
      {
        "id": "c1",
        "label": "角色常用名",
        "type": "character|faction|location",
        "names": ["别名、称号、代称"],
        "mainCharacter": true,
        "description": "在故事和关系网中的功能",
        "portraitPrompt": "可选，适合头像或人物卡的原创化视觉提示"
      }
    ],
    "edges": [
      {
        "source": "c1",
        "target": "c2",
        "label": "关系摘要",
        "relation": ["师徒", "敌对", "交易", "暧昧", "亲属", "同盟"],
        "tension": "冲突/依赖/暧昧/师徒/交易/压迫等",
        "weight": 1,
        "positivity": 0,
        "evidence": ["来自章节 map 的短证据或关系信号"],
        "firstSeenChapter": 1,
        "confidence": 0.8
      }
    ]
  },
  "plotlines": [
    {
      "name": "故事线名称",
      "type": "主线/成长线/感情线/副本线/阴谋线",
      "start": "起点",
      "turningPoints": ["关键转折"],
      "payoff": "阶段兑现",
      "reusablePattern": "可学习的结构模式"
    }
  ],
  "chronicle": [
    {"order": 1, "event": "大事纪事件", "impact": "影响", "storyFunction": "叙事功能"}
  ],
  "historyBook": {
    "ancientHistory": ["远古史/背景史"],
    "recentHistory": ["近代事件"],
    "publicMyths": ["世界内流传的传说"],
    "hiddenTruths": ["隐藏真相，不要大段复述原文"]
  },
  "writingSupport": {
    "chapterFunctionTable": [
      {
        "chapterOrder": 1,
        "title": "章节标题",
        "function": "铺设定/立人设/制造冲突/升级矛盾/释放爽点/埋钩子",
        "goal": "本章目标",
        "conflict": "本章冲突",
        "hook": "本章钩子"
      }
    ],
    "foreshadowingLedger": [
      {
        "setup": "伏笔或未解问题",
        "setupChapter": 1,
        "payoff": "已回收方式或建议回收方向",
        "status": "open|paid|partial",
        "risk": "如果忘记会造成什么断裂"
      }
    ],
    "emotionalBeatMap": [
      {
        "chapterOrder": 1,
        "beats": ["爽点/虐点/甜点/悬念点/打脸点/反转点"],
        "intensity": "low|medium|high",
        "readerPromise": "本章给读者的情绪承诺"
      }
    ],
    "pacingCurve": [
      {
        "chapterOrder": 1,
        "informationDensity": "low|medium|high",
        "conflictIntensity": "low|medium|high",
        "hookStrength": "low|medium|high",
        "risk": "拖沓/过快/信息重复/钩子弱等风险"
      }
    ],
    "readerPromiseChecklist": [
      {
        "promise": "标题、简介或开局承诺给读者的东西",
        "evidence": "已兑现或已铺垫的证据摘要",
        "status": "delivered|pending|broken",
        "nextCheck": "后续章节需要继续检查什么"
      }
    ],
    "conflictMatrix": [
      {
        "parties": ["角色或势力A", "角色或势力B"],
        "conflict": "冲突原因",
        "level": "short-term|long-term|core",
        "nextEscalation": "下一次升级方向"
      }
    ],
    "continuationPack": {
      "currentState": "当前剧情状态",
      "nextChapterGoal": "下一章建议目标",
      "openThreads": ["未解决线索、伏笔、关系或冲突"],
      "oocGuards": ["人物不能 OOC 的约束"],
      "settingGuards": ["设定不能冲突的约束"],
      "styleConstraints": ["续写时必须保持的节奏、视角和情绪规则"],
      "aiPrompt": "可复制给写作 AI 的续写提示词"
    },
    "qualityDiagnosis": {
      "strengths": ["整书结构强项"],
      "weaknesses": ["潜在短板"],
      "priorityFixes": ["最优先修正项"]
    }
  },
  "generationAssets": {
    "worldBook": {
      "entries": [
        {
          "keys": ["主触发关键词"],
          "secondaryKeys": ["辅助触发关键词"],
          "category": "world-rule|power-system|location|faction|item|relationship|timeline|style",
          "content": "可导入 AI 写作软件的原创化世界书条目",
          "insertionOrder": 100,
          "priority": 50,
          "constant": false,
          "selective": true,
          "sourceRisk": "low|medium|high",
          "originalizationNote": "如何避免直接复制原作"
        }
      ],
      "activationRules": ["什么时候应该触发这些世界书条目"],
      "importNotes": "导入酒馆或其他 AI 写作软件时的注意事项"
    },
    "styleBible": {
      "narrativePOV": "叙事视角",
      "toneKeywords": ["语气关键词"],
      "proseRules": ["文风规则"],
      "dialogueRules": ["对话规则"],
      "tabooList": ["续写时不要出现的风格问题"]
    },
    "volumePlan": [
      {
        "volume": "卷名或阶段名",
        "goal": "本卷目标",
        "mainConflict": "本卷主要冲突",
        "climax": "高潮",
        "endingHook": "卷末钩子"
      }
    ],
    "sceneTemplates": [
      {
        "name": "场景模板名",
        "useWhen": "什么时候使用",
        "beats": ["场景节拍"],
        "avoid": ["不要复刻的桥段"]
      }
    ],
    "characterVoiceGuide": [
      {
        "character": "角色或角色原型",
        "speechStyle": "说话方式",
        "catchphrases": ["可原创化的口头表达方向"],
        "forbiddenTone": ["不能写成什么样"]
      }
    ],
    "antagonistPressurePlan": [
      {
        "antagonist": "反派或压力来源",
        "pressureMethod": "施压方式",
        "escalationSteps": ["升级步骤"],
        "defeatCost": "主角击败它需要付出的代价"
      }
    ],
    "titleSynopsisKeywordPack": {
      "titleKeywords": ["标题关键词"],
      "synopsisSellingPoints": ["简介卖点"],
      "searchTags": ["平台搜索/分类标签"],
      "openingKeywords": ["开局应自然命中的关键词"]
    },
    "consistencyChecklist": ["长篇续写一致性检查项"]
  },
  "sourceAssetArchive": {
    "usageNotice": "原作拆解笔记，仅供学习、研究、合法授权或个人私用场景；商业复用需自行确认权利边界。",
    "sourceCharacterNotes": [
      {
        "name": "原作角色名或代号",
        "role": "角色定位",
        "recognizableTraits": ["可识别特征摘要"],
        "relationshipNotes": ["关系笔记"],
        "plotFunction": "在原作中的功能"
      }
    ],
    "sourceWorldNotes": ["原作世界观笔记"],
    "sourceTimelineNotes": ["原作大事纪笔记"],
    "sourceRelationshipNotes": ["原作关系网笔记"],
    "sourceTermNotes": ["原作专有名词笔记"]
  },
  "exportPackage": {
    "tavernCharacterCards": [
      {
        "name": "原创角色名占位",
        "description": "角色卡描述",
        "personality": "性格",
        "scenario": "场景",
        "first_mes": "开场白",
        "creator_notes": "原创化说明和避险提醒"
      }
    ],
    "worldBookEntries": [
      {"keys":["关键词"],"content":"原创化世界书条目","insertion_order":100}
    ],
    "writingConstraints": ["给 AI 小说生成器的写作约束"],
    "doNotCopyList": ["不能直接复制的专名、关系、桥段、事件链"]
  },
  "originalizationReport": {
    "riskLevel": "low|medium|high",
    "safeToLearn": ["可以学习的抽象原则"],
    "mustTransform": ["必须重写或替换的可识别元素"],
    "fanFictionWarning": "同人/换皮/商业化风险提示",
    "rewriteStrategy": ["原创化迁移策略"]
  },
  "referenceBoundaryCheck": {
    "summary": "参考边界一句话结论：学结构，不复用可识别内容",
    "learnablePatterns": ["可学习的节奏、爽点、钩子、情绪工程"],
    "doNotReuse": ["不能复用的姓名、专名、关系、对白、桥段顺序"],
    "needsTransformation": ["必须重组的角色功能、世界规则、事件链"],
    "nameAndTermRisks": ["专有名词、能力名、组织名、地名风险"],
    "plotSimilarityRisks": ["核心情节、人物关系、冲突模式的雷同风险"],
    "safeRewriteMoves": ["安全迁移动作：换目标、换代价、换关系、换场景、换信息释放顺序"]
  },
  "usageRiskNotice": {
    "summary": "工具只做文本拆解和格式转换，不判断用户最终用途是否合法。",
    "recommendedUse": ["读书笔记", "学习分析", "合法授权素材整理", "个人私用角色扮演", "原创化迁移参考"],
    "higherRiskUse": ["商业化使用原作可识别角色", "复制专有名词和关系网", "换皮复刻关键事件链"],
    "userResponsibility": "用户应确认自己对上传文本、导出素材和后续使用方式拥有必要权利或合法依据。"
  }
}

要求：
1. Reduce 只能基于章节 map 结果汇总，不要补写不存在的原文细节。
2. 不要大段复述原文。
3. 可以保留原作拆解笔记，但必须和原创化导出包分区。
4. 对角色和世界观必须同时输出“原作拆解笔记”和“抽象原型 + 原创化导出卡”。
5. chapterCountEstimate 必须使用章节数 ${preprocessing.chapters.length}。
6. transferableStyleCard 只描述可迁移写法，不要鼓励“仿写某作者”；必须覆盖叙事声音、句式节奏、段落、对白、爽点、钩子和反面清单。
7. referenceBoundaryCheck 必须替代模糊的“原创化风险”，用“可学/不可复用/必须改造/安全迁移”说清边界。
8. writingSupport 必须服务“后续继续写”，重点输出章节功能、伏笔回收、情绪点、节奏风险和可复制给写作 AI 的续写提示词。
9. generationAssets 必须服务“导入 AI 写作软件/世界书/长期续写”，世界书条目要有 keys、category、priority、sourceRisk 和 originalizationNote。
10. relationships 必须按多轮图谱审校思路生成：先列候选角色/势力/地点，再做证据对齐，再消解重复/冲突，最后只保留可解释的最终图谱。
11. relationships 必须吸收人物关系图谱规则：角色节点要保留 names/别名、mainCharacter 和可选 portraitPrompt；关系边必须给 relation 数组、weight 1-10、positivity -1 到 1、evidence 和 firstSeenChapter。
12. relationships.edges 只能连接 relationships.nodes 中存在的 id；不要用 label 混用 id。重复关系必须合并成一条边，relation 可合并，weight 取更强关系，positivity 表达总体情绪倾向。
13. 不要为了“完整”虚构角色关系；无法从章节 map 支撑的关系不要输出，confidence 低于 0.5 的关系宁可省略。
14. 除 JSON key、枚举值和必要英文专名外，所有面向作者阅读的自然语言字段必须使用简体中文；尤其是 hook、readerPromise、promise、nextCheck、risk、summary、reusablePattern、styleRules、safeRewriteMoves 不要输出英文句子。
`.trim();
  }

  private scoreOutlinePriority(
    chapter: ChapterSegment,
    raw: Partial<RawChapterMapResult>,
  ): number {
    let score = 0;
    const textLength = chapter.text.trim().length;

    score += Math.min(4, Math.ceil(textLength / 2500));
    score += Math.min(4, raw.sourceAnchors?.length ?? 0);
    score += Math.min(3, raw.foreshadowingSetups?.length ?? 0);
    score += Math.min(3, raw.payoffSignals?.length ?? 0);
    score += Math.min(2, raw.timelineEvents?.length ?? 0);
    score += Math.min(2, raw.relationshipSignals?.length ?? 0);

    if (raw.conflict?.trim()) {
      score += 2;
    }
    if (raw.hook?.trim()) {
      score += 2;
    }
    if (chapter.order === 1) {
      score += 2;
    }

    return Math.max(1, Math.min(10, score));
  }

  private selectDeepDiveTargetOrders(
    chapters: ChapterSegment[],
    outlineMaps: ChapterMapResult[],
  ): number[] {
    if (!chapters.length) {
      return [];
    }

    const outlineByOrder = new Map(
      outlineMaps.map((item) => [item.order, item]),
    );
    const desiredCount = Math.min(
      chapters.length,
      Math.max(6, Math.min(18, Math.ceil(chapters.length * 0.35))),
    );

    const scored = chapters.map((chapter) => {
      const outline = outlineByOrder.get(chapter.order);
      let score = outline?.focusScore ?? 0;

      score += (outline?.sourceAnchors.length ?? 0) * 3;
      score += (outline?.foreshadowingSetups?.length ?? 0) * 2;
      score += (outline?.payoffSignals?.length ?? 0) * 2;
      score += outline?.timelineEvents.length ?? 0;

      if (outline?.conflict?.trim()) {
        score += 4;
      }
      if (outline?.hook?.trim()) {
        score += 4;
      }
      if (chapter.order === 1 || chapter.order === chapters.length) {
        score += 6;
      }

      return { order: chapter.order, score };
    });

    const selected = new Set(
      scored
        .sort(
          (left, right) => right.score - left.score || left.order - right.order,
        )
        .slice(0, desiredCount)
        .map((item) => item.order),
    );

    selected.add(chapters[0].order);
    selected.add(chapters[chapters.length - 1].order);

    return [...selected].sort((left, right) => left - right);
  }

  private prepareReducerChapterMaps(
    chapterMaps: ChapterMapResult[],
  ): ChapterMapResult[] {
    const maxReducerEntries = 18;
    let reducedMaps = [...chapterMaps];

    while (reducedMaps.length > maxReducerEntries) {
      const groupSize = Math.ceil(reducedMaps.length / maxReducerEntries);
      const nextLevel: ChapterMapResult[] = [];

      for (let index = 0; index < reducedMaps.length; index += groupSize) {
        nextLevel.push(
          this.mergeReducerChapterGroup(
            reducedMaps.slice(index, index + groupSize),
            nextLevel.length + 1,
          ),
        );
      }

      reducedMaps = nextLevel;
    }

    return reducedMaps;
  }

  private mergeReducerChapterGroup(
    chapterMaps: ChapterMapResult[],
    order: number,
  ): ChapterMapResult {
    const first = chapterMaps[0];
    const last = chapterMaps[chapterMaps.length - 1];

    return {
      chapterId: `chunk-${String(order).padStart(3, "0")}`,
      order,
      title: `${first.title} ~ ${last.title}`,
      analysisDepth: "deep",
      focusScore: Math.max(
        ...chapterMaps.map((chapter) => chapter.focusScore ?? 0),
      ),
      chunkStartOffset: first.chunkStartOffset,
      chunkEndOffset: last.chunkEndOffset,
      splitBy: first.splitBy,
      summary: this.joinReducerText(
        chapterMaps.map(
          (chapter) =>
            `${chapter.title}: ${chapter.summary} / ${chapter.plotFunction}`,
        ),
        480,
      ),
      plotFunction: this.joinReducerText(
        chapterMaps.map((chapter) => chapter.plotFunction),
        180,
      ),
      chapterGoal: this.joinReducerText(
        chapterMaps
          .map((chapter) => chapter.chapterGoal)
          .filter((value): value is string => Boolean(value)),
        180,
      ),
      conflict: this.joinReducerText(
        chapterMaps
          .map((chapter) => chapter.conflict)
          .filter((value): value is string => Boolean(value)),
        180,
      ),
      characterSignals: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.characterSignals),
      ),
      worldbuildingSignals: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.worldbuildingSignals),
      ),
      relationshipSignals: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.relationshipSignals),
      ),
      timelineEvents: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.timelineEvents),
      ),
      emotionalBeats: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.emotionalBeats ?? []),
      ),
      foreshadowingSetups: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.foreshadowingSetups ?? []),
      ),
      payoffSignals: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.payoffSignals ?? []),
      ),
      sourceRiskSignals: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.sourceRiskSignals),
      ),
      originalizationSeeds: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.originalizationSeeds),
      ),
      hook: this.joinReducerText(
        chapterMaps.map((chapter) => chapter.hook),
        180,
      ),
      evidenceSnippets: this.mergeReducerList(
        chapterMaps.flatMap((chapter) => chapter.evidenceSnippets),
        4,
      ),
      sourceAnchors: chapterMaps
        .flatMap((chapter) => chapter.sourceAnchors)
        .slice(0, 6),
    };
  }

  private mergeReducerList(items: string[], limit = 8): string[] {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))].slice(
      0,
      limit,
    );
  }

  private joinReducerText(items: string[], maxLength: number): string {
    const value = items
      .map((item) => item.trim())
      .filter(Boolean)
      .join(" | ");
    return value.length > maxLength
      ? `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
      : value;
  }

  private buildChunkEvidenceIndex(chapterMaps: ChapterMapResult[]) {
    return chapterMaps.map((chapter) => ({
      chapterId: chapter.chapterId,
      order: chapter.order,
      title: chapter.title,
      summary: chapter.summary,
      plotFunction: chapter.plotFunction,
      hook: chapter.hook,
      chunkStartOffset: chapter.chunkStartOffset,
      chunkEndOffset: chapter.chunkEndOffset,
      splitBy: chapter.splitBy,
      keywords: this.mergeReducerList([
        ...chapter.characterSignals,
        ...chapter.worldbuildingSignals,
        ...chapter.relationshipSignals,
        ...(chapter.foreshadowingSetups ?? []),
        ...(chapter.payoffSignals ?? []),
      ]),
      evidenceSnippets: chapter.evidenceSnippets,
      sourceAnchors: chapter.sourceAnchors,
    }));
  }

  private scoreChunkEvidenceHit(
    chunk: {
      chapterId: string;
      order: number;
      title: string;
      summary: string;
      plotFunction: string;
      hook: string;
      chunkStartOffset: number;
      chunkEndOffset: number;
      keywords: string[];
      evidenceSnippets: string[];
      sourceAnchors: BookChunkEvidenceHit["sourceAnchors"];
    },
    queryTokens: string[],
  ): BookChunkEvidenceHit | null {
    if (!queryTokens.length) {
      return null;
    }

    const normalizedFields = {
      title: this.normalizeSearchText(chunk.title),
      summary: this.normalizeSearchText(chunk.summary),
      plotFunction: this.normalizeSearchText(chunk.plotFunction),
      hook: this.normalizeSearchText(chunk.hook),
      keywords: chunk.keywords.map((item) => this.normalizeSearchText(item)),
      evidence: chunk.evidenceSnippets.map((item) =>
        this.normalizeSearchText(item),
      ),
      anchors: chunk.sourceAnchors.map((item) =>
        this.normalizeSearchText(item.quote),
      ),
    };
    let score = 0;
    const matchedKeywords = new Set<string>();

    for (const token of queryTokens) {
      if (!token) {
        continue;
      }
      if (normalizedFields.title.includes(token)) {
        score += 5;
        matchedKeywords.add(token);
      }
      if (normalizedFields.summary.includes(token)) {
        score += 4;
        matchedKeywords.add(token);
      }
      if (normalizedFields.plotFunction.includes(token)) {
        score += 3;
        matchedKeywords.add(token);
      }
      if (normalizedFields.hook.includes(token)) {
        score += 3;
        matchedKeywords.add(token);
      }
      if (normalizedFields.keywords.some((item) => item.includes(token))) {
        score += 4;
        matchedKeywords.add(token);
      }
      if (normalizedFields.evidence.some((item) => item.includes(token))) {
        score += 5;
        matchedKeywords.add(token);
      }
      if (normalizedFields.anchors.some((item) => item.includes(token))) {
        score += 6;
        matchedKeywords.add(token);
      }
    }

    if (score <= 0) {
      return null;
    }

    return {
      chapterId: chunk.chapterId,
      order: chunk.order,
      title: chunk.title,
      summary: chunk.summary,
      plotFunction: chunk.plotFunction,
      hook: chunk.hook,
      score,
      matchedKeywords: [...matchedKeywords],
      evidenceSnippets: chunk.evidenceSnippets,
      sourceAnchors: chunk.sourceAnchors,
      chunkStartOffset: chunk.chunkStartOffset,
      chunkEndOffset: chunk.chunkEndOffset,
    };
  }

  private normalizeSearchTokens(query: string) {
    const normalizedQuery = this.normalizeSearchText(query);
    const phraseTokens = normalizedQuery
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2);
    const cjkPairs = normalizedQuery.match(/[\u4e00-\u9fff]{2,}/g) || [];
    return [...new Set([...phraseTokens, ...cjkPairs])].slice(0, 16);
  }

  private normalizeSearchText(value: string) {
    return value.toLowerCase().replace(/\s+/g, "");
  }

  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<void>,
  ) {
    const limit = Math.max(1, Math.min(concurrency, items.length || 1));
    let cursor = 0;
    const runners = Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await worker(items[index]!, index);
      }
    });
    await Promise.all(runners);
  }

  private mockChapterMap(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
    analysisDepth: "outline" | "deep" = "deep",
    focusScore?: number,
  ): ChapterMapResult {
    const excerpt = chapter.text.slice(0, 80);
    const evidenceSnippets = this.mergeReducerList(
      chapter.text
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((item) => item.slice(0, 24)),
      3,
    );

    return {
      chapterId: chapter.id,
      order: chapter.order,
      title: chapter.title,
      analysisDepth,
      focusScore: focusScore ?? 6,
      chunkStartOffset: chapter.startOffset,
      chunkEndOffset: chapter.endOffset,
      splitBy: chapter.splitBy,
      summary: `${chapter.title} 展示了主角压力、线索推进和阶段性钩子。`,
      plotFunction:
        chapter.order === 1 ? "建立主角困境和核心期待" : "推进线索并升级冲突",
      chapterGoal:
        chapter.order === 1 ? "让主角保住关键机会" : "追查旧线索并扩大优势",
      conflict:
        chapter.order === 1
          ? "主角被公开否定，机会和尊严同时受损"
          : "新线索引出更高层级的阻碍",
      characterSignals: [
        "主角在压力下保持克制",
        "主角拥有尚未公开的能力或旧案线索",
      ],
      worldbuildingSignals: [
        `${input.genre} 题材下的资源分配规则`,
        "公开评价场景会放大身份压迫",
      ],
      relationshipSignals: ["主角与评审/权力机构存在压迫和反击关系"],
      timelineEvents: [`${chapter.order}. ${chapter.title}：${excerpt}`],
      emotionalBeats: [
        chapter.order === 1 ? "被当众否定的压抑感" : "线索推进的期待感",
        "反击前的延迟满足",
      ],
      foreshadowingSetups: [
        chapter.order === 1 ? "旧案信物来源不明" : "更高层敌人尚未露面",
      ],
      payoffSignals: [
        chapter.order === 1 ? "主角没有立刻认输" : "旧线索得到阶段性推进",
      ],
      sourceRiskSignals: ["原作姓名、专有物品名、机构名和关键事件顺序需要避开"],
      originalizationSeeds: [
        "公开否定 -> 发现线索 -> 阶段反击 -> 更大危机",
        "隐藏能力用作反击工具，同时引出新敌人",
      ],
      hook: "旧线索或新敌人把单章冲突升级为长期追读问题。",
      evidenceSnippets,
      sourceAnchors: this.buildSourceAnchors(
        chapter,
        {
          chapterId: chapter.id,
          order: chapter.order,
          title: chapter.title,
          summary: "",
          plotFunction: "",
          characterSignals: [],
          worldbuildingSignals: [],
          relationshipSignals: [],
          timelineEvents: [],
          sourceRiskSignals: [],
          originalizationSeeds: [],
          hook: "",
          evidenceSnippets,
        },
        evidenceSnippets,
      ),
    };
  }

  private mockBookReduce(
    input: AnalyzeBookDto,
    preprocessing: BookPreprocessResult,
    chapterMaps: ChapterMapResult[],
  ) {
    const result = this.mockBookAnalysis(input);
    const timelineEvents = chapterMaps.flatMap((item) => item.timelineEvents);
    const chapterFunctionTable = chapterMaps.map((chapter) => ({
      chapterOrder: chapter.order,
      title: chapter.title,
      function: chapter.plotFunction,
      goal: chapter.chapterGoal || "推进本章目标",
      conflict: chapter.conflict || "制造阶段冲突",
      hook: chapter.hook,
    }));
    const emotionalBeatMap = chapterMaps.map((chapter) => ({
      chapterOrder: chapter.order,
      beats: chapter.emotionalBeats?.length
        ? chapter.emotionalBeats
        : ["冲突推进", "追读悬念"],
      intensity: chapter.order === 1 ? "high" : "medium",
      readerPromise: chapter.hook,
    }));

    return {
      ...result,
      book: {
        ...result.book,
        chapterCountEstimate: preprocessing.chapters.length,
        coreAppeal: [...result.book.coreAppeal, "章节级 map-reduce 结构拆解"],
      },
      chronicle: timelineEvents.length
        ? timelineEvents.map((event, index) => ({
            order: index + 1,
            event,
            impact: "从章节 map 阶段提取，可继续人工校准。",
            storyFunction: index === 0 ? "开局冲突" : "冲突升级",
          }))
        : result.chronicle,
      writingSupport: {
        ...result.writingSupport,
        chapterFunctionTable: chapterFunctionTable.length
          ? chapterFunctionTable
          : result.writingSupport.chapterFunctionTable,
        emotionalBeatMap: emotionalBeatMap.length
          ? emotionalBeatMap
          : result.writingSupport.emotionalBeatMap,
        pacingCurve: chapterMaps.length
          ? chapterMaps.map((chapter) => ({
              chapterOrder: chapter.order,
              informationDensity: chapter.worldbuildingSignals.length
                ? "medium"
                : "low",
              conflictIntensity: chapter.conflict ? "high" : "medium",
              hookStrength: chapter.hook ? "high" : "medium",
              risk:
                chapter.order === 1
                  ? "开局信息要继续贴近主角目标，避免设定先行。"
                  : "注意每章都要产生新信息或新压力，避免只复述线索。",
            }))
          : result.writingSupport.pacingCurve,
        foreshadowingLedger: chapterMaps.length
          ? chapterMaps.flatMap((chapter) =>
              (chapter.foreshadowingSetups || []).map((setup) => ({
                setup,
                setupChapter: chapter.order,
                payoff:
                  chapter.payoffSignals?.[0] ||
                  "后续章节需要安排阶段性回收或反转。",
                status: "open",
                risk: "如果长期不回收，会削弱读者对线索和钩子的信任。",
              })),
            )
          : result.writingSupport.foreshadowingLedger,
      },
      sourceAssetArchive: {
        ...result.sourceAssetArchive,
        sourceTimelineNotes: timelineEvents.length
          ? timelineEvents
          : result.sourceAssetArchive.sourceTimelineNotes,
      },
    };
  }

  private mockBookAnalysis(input: AnalyzeBookDto) {
    return {
      mode: "book-asset-analysis",
      book: {
        title: input.title,
        genre: input.genre,
        chapterCountEstimate: Math.max(1, Math.ceil(input.text.length / 3000)),
        oneSentencePremise:
          "一个被低估的主角在压力中发现隐藏能力，并被卷入更大的势力冲突。",
        coreAppeal: ["低谷开局", "能力觉醒", "身份反转", "升级危机"],
      },
      transferableStyleCard: {
        coreStyleTags: [
          "低谷逆袭",
          "强目标开局",
          "阶段反击",
          "线索驱动",
          "章末升级",
        ],
        narrativeVoice: "第三人称有限视角，贴近主角观察和判断，少做全知解释。",
        sentenceRhythm:
          "中短句为主，冲突段落压缩句长，线索段落用少量中句承接因果。",
        paragraphPattern:
          "移动端友好的短段落，每段承担一个动作、反应、信息或情绪点。",
        dialoguePattern: "对白用于施压、试探和暴露信息差，避免长篇解释设定。",
        sensoryFocus: ["视觉压迫", "动作细节", "道具线索", "公开场面反应"],
        pleasureMechanisms: [
          "地位型爽点：被轻视后反击",
          "认知型爽点：旧案线索逐步揭开",
          "力量型爽点：隐藏能力阶段展示",
        ],
        hookPatterns: [
          "信物揭示型钩子",
          "更高层敌人危机型钩子",
          "能力代价悬念型钩子",
        ],
        styleRules: [
          "开章尽快给出目标、阻碍和失败代价。",
          "设定必须通过冲突、道具或选择进入。",
          "每章结尾保留一个更高层级的问题、奖励或威胁。",
          "爽点释放前先建立具体压迫和情绪债。",
        ],
        antiPatterns: [
          "不要先解释大段世界观。",
          "不要让能力无代价解决所有问题。",
          "不要复用原作姓名、专名、组织和关键事件顺序。",
          "不要把可迁移风格写成仿写某作者。",
        ],
      },
      worldbuilding: {
        worldRules: [
          "资源、身份和能力共同决定角色社会位置。",
          "公开场合的评价会转化为情绪债和后续反击期待。",
        ],
        powerSystem: ["隐藏能力来源", "阶段性解锁", "能力展示带来新敌人"],
        locations: [
          {
            name: "考场/演武场",
            function: "公开评价和身份压迫的舞台",
            originalizationNote:
              "替换为原创机构、公司考核、试炼场或医院急诊等场景。",
          },
        ],
        factions: [
          {
            name: "家族/学院/评审机构",
            goal: "维护既有秩序和资源分配",
            conflictRole: "压迫主角并制造反击舞台",
            originalizationNote: "更换组织名称、制度、利益来源和内部派系。",
          },
        ],
        itemsAndTerms: [
          {
            name: "特殊石碑/玉牌/信物",
            function: "触发隐藏身份或旧案线索",
            risk: "generic",
          },
        ],
      },
      characters: [
        {
          sourceName: "主角原型",
          role: "主角",
          archetype: "被低估的隐忍型成长主角",
          personalityCore: ["克制", "重承诺", "抗压", "不轻易解释"],
          desire: "证明自身价值并夺回被剥夺的尊严和资源",
          fearOrWound: "重要关系或过去失败造成的自我怀疑",
          capability: "一个尚未被公众理解的特殊能力来源",
          relationshipFunction: "承载读者代入、压抑和反击期待",
          originalCharacterCard: {
            namePlaceholder: "原创主角名",
            summary:
              "出身普通或被边缘化的青年，表面沉默，实际掌握一项尚未公开的关键能力。",
            personality: "少言、敏锐、重承诺，在被压迫时优先观察局势再反击。",
            scenario:
              "主角在公开考核中被取消资格，却发现一件旧案信物指向更大的阴谋。",
            firstMessage: "你们可以取消我的资格，但这件信物，最好解释清楚。",
            doNotCopy: [
              "原作姓名",
              "原作专有能力名",
              "原作导师设定",
              "原作关键事件链",
            ],
          },
        },
      ],
      relationships: {
        nodes: [
          {
            id: "c1",
            label: "原创主角名",
            type: "character",
            names: ["主角原型", "原创主角名"],
            mainCharacter: true,
            description: "承载代入、压迫和反击期待。",
          },
          {
            id: "f1",
            label: "原创评审机构",
            type: "faction",
            names: ["评审机构", "资源分配方"],
            mainCharacter: false,
            description: "制造公开评价和资源压迫。",
          },
          {
            id: "l1",
            label: "公开考核场",
            type: "location",
            names: ["考核场", "公开评价舞台"],
            mainCharacter: false,
            description: "放大羞辱、评价和反击的公共场景。",
          },
        ],
        edges: [
          {
            source: "c1",
            target: "f1",
            label: "被压制/反击",
            relation: ["压迫", "反击"],
            tension: "冲突",
            weight: 8,
            positivity: -0.7,
            evidence: ["公开否定主角资格", "主角准备反击"],
            firstSeenChapter: 1,
            confidence: 0.9,
          },
          {
            source: "c1",
            target: "l1",
            label: "身份被公开评价",
            tension: "压力",
            relation: ["公开评价", "身份压力"],
            weight: 5,
            positivity: -0.2,
            evidence: ["主角在公开场合被评价"],
            firstSeenChapter: 1,
            confidence: 0.8,
          },
        ],
      },
      plotlines: [
        {
          name: "主角成长线",
          type: "主线",
          start: "主角被公开否定并失去机会",
          turningPoints: ["发现旧案线索", "展示隐藏能力", "引出更高层敌人"],
          payoff: "主角获得阶段性认可，但危机升级",
          reusablePattern: "压迫 -> 暗示底牌 -> 反击 -> 更大危机",
        },
      ],
      chronicle: [
        {
          order: 1,
          event: "主角在公开场合被取消资格",
          impact: "建立情绪债和反击期待",
          storyFunction: "开局冲突",
        },
        {
          order: 2,
          event: "旧案信物出现",
          impact: "把个人羞辱升级为长期阴谋",
          storyFunction: "追读钩子",
        },
      ],
      historyBook: {
        ancientHistory: ["某个旧制度长期决定能力者的资源分配。"],
        recentHistory: ["三年前发生过一场影响主角命运的旧案。"],
        publicMyths: ["公众相信考核公平，强者自然上位。"],
        hiddenTruths: ["考核背后存在利益操控，主角旧案并非意外。"],
      },
      writingSupport: {
        chapterFunctionTable: [
          {
            chapterOrder: 1,
            title: "开局压迫",
            function: "建立主角困境、制造情绪债、埋下长期线索",
            goal: "主角想保住资格或夺回被剥夺的机会",
            conflict: "权力机构公开否定主角，造成身份和资源损失",
            hook: "旧案信物出现，把单章羞辱升级为长期阴谋",
          },
          {
            chapterOrder: 2,
            title: "线索推进",
            function: "升级矛盾、展示底牌、引出更高层敌人",
            goal: "主角追查信物来源并验证隐藏能力",
            conflict: "新敌人试图夺走线索或封锁真相",
            hook: "更高层势力注意到主角",
          },
        ],
        foreshadowingLedger: [
          {
            setup: "旧案信物为什么会出现在评审身上",
            setupChapter: 1,
            payoff: "后续通过调查揭露旧案和当前考核之间的利益链",
            status: "open",
            risk: "如果长期不回收，旧案线会变成无效悬念。",
          },
          {
            setup: "主角隐藏能力的来源和代价",
            setupChapter: 1,
            payoff: "每次能力展示都应同时推进真相并制造新代价",
            status: "partial",
            risk: "能力如果只用于解决问题，会削弱升级压力。",
          },
        ],
        emotionalBeatMap: [
          {
            chapterOrder: 1,
            beats: ["压抑", "羞辱", "反击期待", "悬念"],
            intensity: "high",
            readerPromise: "读者期待主角证明自己并让压迫者付出代价。",
          },
          {
            chapterOrder: 2,
            beats: ["线索推进", "能力展示", "危机升级"],
            intensity: "medium",
            readerPromise: "读者期待隐藏能力和旧案真相逐步揭开。",
          },
        ],
        pacingCurve: [
          {
            chapterOrder: 1,
            informationDensity: "medium",
            conflictIntensity: "high",
            hookStrength: "high",
            risk: "开局要避免先解释世界规则，必须让冲突先落到主角身上。",
          },
          {
            chapterOrder: 2,
            informationDensity: "medium",
            conflictIntensity: "medium",
            hookStrength: "high",
            risk: "线索推进不能只靠对话说明，需要转化为新选择或新损失。",
          },
        ],
        readerPromiseChecklist: [
          {
            promise: "低谷逆袭",
            evidence: "主角被公开否定，但旧案信物和隐藏能力提供反击空间。",
            status: "pending",
            nextCheck: "后续章节必须给出阶段性打脸或资源夺回。",
          },
          {
            promise: "旧案追查",
            evidence: "旧案信物把个人羞辱和长期阴谋连接起来。",
            status: "pending",
            nextCheck: "每个小卷都要推进一个可验证的新真相。",
          },
        ],
        conflictMatrix: [
          {
            parties: ["原创主角名", "原创评审机构"],
            conflict: "资格、资源和旧案真相的控制权",
            level: "core",
            nextEscalation: "评审机构派出更高层代表压制主角调查。",
          },
          {
            parties: ["原创主角名", "旧案相关人"],
            conflict: "真相揭露会动摇既有秩序",
            level: "long-term",
            nextEscalation: "旧案相关人抛出半真半假的证据误导主角。",
          },
        ],
        continuationPack: {
          currentState:
            "主角刚从公开压迫中发现旧案线索，个人羞辱已升级为长期调查线。",
          nextChapterGoal:
            "让主角主动追查信物来源，同时设置一个必须立刻解决的小阻碍。",
          openThreads: [
            "旧案信物来源",
            "隐藏能力代价",
            "评审机构背后的真正操盘者",
          ],
          oocGuards: [
            "主角可以克制，但不能被动等人救场。",
            "主角反击要基于观察和证据，不要突然莽撞。",
          ],
          settingGuards: [
            "公开考核必须影响资源分配。",
            "隐藏能力每次使用都要带来新问题或新代价。",
          ],
          styleConstraints: [
            "每章前半段给出明确目标和阻碍。",
            "每章至少有一个新信息或新压力。",
            "章末用危机、奖励、秘密或反转卡追读。",
          ],
          aiPrompt:
            "请续写下一章：保留主角隐忍、敏锐、重承诺的性格；本章目标是追查旧案信物来源；必须制造一个来自评审机构的新阻碍；不要解释大量设定；结尾用更高层敌人或新证据制造追读钩子。",
        },
        qualityDiagnosis: {
          strengths: ["开局压迫清楚", "情绪债明确", "旧案线能支撑长期追读"],
          weaknesses: ["能力代价需要尽早明确", "关系线需要更多可持续张力"],
          priorityFixes: [
            "补强每章目标和失败代价",
            "建立伏笔回收节奏",
            "让能力展示带来新敌人或新限制",
          ],
        },
      },
      generationAssets: {
        worldBook: {
          entries: [
            {
              keys: ["公开考核", "资源分配"],
              secondaryKeys: ["资格", "评审机构", "身份评价"],
              category: "world-rule",
              content:
                "原创世界中，公开考核决定资源、身份和后续机会。考核结果会影响角色能否进入更高层级的任务、资源池或权力结构。",
              insertionOrder: 100,
              priority: 70,
              constant: false,
              selective: true,
              sourceRisk: "low",
              originalizationNote:
                "保留公开评价造成压力的功能，替换制度名称、流程、奖惩和具体组织。",
            },
            {
              keys: ["旧案信物", "残图", "旧案"],
              secondaryKeys: ["三年前", "失踪评审长", "隐藏真相"],
              category: "timeline",
              content:
                "三年前的旧案留下了多个物证。信物和残图不是奖励道具，而是把主角个人遭遇连接到长期阴谋的线索。",
              insertionOrder: 110,
              priority: 80,
              constant: false,
              selective: true,
              sourceRisk: "medium",
              originalizationNote:
                "不要复用原作具体物件、图案和旧案顺序；只保留旧线索连接长期阴谋的结构。",
            },
            {
              keys: ["隐藏能力", "银针", "能力代价"],
              secondaryKeys: ["阶段性解锁", "反击", "新敌人"],
              category: "power-system",
              content:
                "主角的隐藏能力适合用于阶段性反击，但每次展示都应引出更高层级的新问题、新敌人或新代价。",
              insertionOrder: 120,
              priority: 75,
              constant: false,
              selective: true,
              sourceRisk: "medium",
              originalizationNote:
                "替换能力外观、名称、触发条件和代价，避免直接照搬原作能力体系。",
            },
            {
              keys: ["评审机构", "操盘者"],
              secondaryKeys: ["压制", "封锁真相", "更高层敌人"],
              category: "faction",
              content:
                "评审机构表面维护秩序，实际内部存在利益链。它的叙事功能是持续给主角制造资格、资源和真相层面的阻力。",
              insertionOrder: 130,
              priority: 65,
              constant: false,
              selective: true,
              sourceRisk: "low",
              originalizationNote:
                "更换组织名、利益来源、层级结构和代表人物，保留压迫与反击功能。",
            },
          ],
          activationRules: [
            "当剧情出现考核、资格、资源争夺时触发 world-rule 条目。",
            "当剧情出现旧案、信物、残图、匿名信时触发 timeline 条目。",
            "当主角使用能力、解释能力限制或反击时触发 power-system 条目。",
            "当评审、组织、幕后势力施压时触发 faction 条目。",
          ],
          importNotes:
            "导入酒馆或 AI 写作软件时，建议把高频世界规则设为 selective，不要全部 constant，避免上下文被设定淹没。",
        },
        styleBible: {
          narrativePOV: "第三人称有限视角，优先贴近主角观察和判断。",
          toneKeywords: ["克制", "高压", "线索推进", "阶段反击", "章末升级"],
          proseRules: [
            "开章尽快给出目标、阻碍和失败代价。",
            "设定必须通过冲突、道具或选择进入，不单独长篇解释。",
            "每章结尾保留一个更高层级的问题、奖励或威胁。",
          ],
          dialogueRules: [
            "主角少解释，多用观察和反问推进压迫感。",
            "反派对白要带有资源、资格或身份上的威胁。",
            "配角对白要暴露信息差，而不是单纯解释设定。",
          ],
          tabooList: [
            "不要让主角突然变成话痨。",
            "不要连续多段解释世界观。",
            "不要让能力无代价解决所有问题。",
          ],
        },
        volumePlan: [
          {
            volume: "第一卷：旧案信物",
            goal: "主角从公开压迫中夺回主动权，并确认旧案不是意外。",
            mainConflict: "主角追查旧案 vs 评审机构封锁真相。",
            climax: "主角用隐藏能力反制评审机构的第一次公开围堵。",
            endingHook: "旧案背后出现更高层操盘者。",
          },
          {
            volume: "第二卷：幕后关系网",
            goal: "主角进入更大的资源场，拆开旧案利益链。",
            mainConflict: "主角要拿证据，幕后势力要切断所有证人。",
            climax: "关键证人反转，旧案真相只揭开一半。",
            endingHook: "主角发现自己的能力来源也在局中。",
          },
        ],
        sceneTemplates: [
          {
            name: "公开压迫场",
            useWhen: "需要快速建立情绪债、身份差和反击期待时。",
            beats: [
              "公开评价",
              "具体损失",
              "旁人反应",
              "主角克制",
              "线索或底牌出现",
            ],
            avoid: ["不要复刻原作台词", "不要复制同样的考核规则"],
          },
          {
            name: "线索反转场",
            useWhen: "需要把单章目标升级成长期阴谋时。",
            beats: [
              "发现物证",
              "排除表层解释",
              "出现阻挠",
              "确认更大问题",
              "章末威胁",
            ],
            avoid: ["不要让线索直接说明全部真相", "不要让反转脱离主角行动"],
          },
        ],
        characterVoiceGuide: [
          {
            character: "原创主角名",
            speechStyle: "短句、克制、带观察后的反问，不主动解释底牌。",
            catchphrases: ["这件事，还没结束。", "你确定要现在落印？"],
            forbiddenTone: ["轻浮嘴炮", "长篇自白", "无证据的鲁莽威胁"],
          },
          {
            character: "原创评审代表",
            speechStyle: "制度化、压迫感强，用规则包装私利。",
            catchphrases: ["规矩就是规矩。", "资格不是你说有就有。"],
            forbiddenTone: ["直接承认阴谋", "低智反派式叫嚣"],
          },
        ],
        antagonistPressurePlan: [
          {
            antagonist: "原创评审机构",
            pressureMethod: "通过资格、资源、舆论和证据封锁持续施压。",
            escalationSteps: [
              "取消资格",
              "安排不公平测试",
              "夺取旧案物证",
              "威胁旧案相关人",
              "引出更高层操盘者",
            ],
            defeatCost: "主角必须暴露部分能力，并因此被更高层敌人盯上。",
          },
        ],
        titleSynopsisKeywordPack: {
          titleKeywords: ["低谷逆袭", "旧案", "隐藏能力", "公开打脸"],
          synopsisSellingPoints: [
            "主角被公开否定后发现旧案信物。",
            "隐藏能力不是外挂爽点，而是调查旧案的钥匙。",
            "每次反击都会引出更高层敌人。",
          ],
          searchTags: ["逆袭", "打脸", "旧案", "升级", "势力博弈"],
          openingKeywords: ["资格", "考核", "信物", "旧案", "反击"],
        },
        consistencyChecklist: [
          "主角必须主动观察和选择，不能长期被动等事件发生。",
          "每次能力展示都要记录代价、见证者和后续风险。",
          "旧案线索必须有埋设、误导、验证和阶段回收。",
          "评审机构的行动要符合维护利益链的逻辑。",
          "不要让世界规则只在解释段出现，必须影响角色选择。",
        ],
      },
      sourceAssetArchive: {
        usageNotice:
          "原作拆解笔记，仅供学习、研究、合法授权或个人私用场景；商业复用需自行确认权利边界。",
        sourceCharacterNotes: [
          {
            name: "主角原型",
            role: "主角",
            recognizableTraits: [
              "被公开否定",
              "隐忍观察",
              "隐藏能力",
              "旧案关联",
            ],
            relationshipNotes: [
              "与评审机构存在压迫关系",
              "与旧案人物存在潜在线索关系",
            ],
            plotFunction: "承载代入、压抑、反击和追查旧案的主线功能",
          },
        ],
        sourceWorldNotes: [
          "公开考核决定资源分配。",
          "旧案信物连接个人遭遇和更大阴谋。",
        ],
        sourceTimelineNotes: [
          "三年前发生旧案。",
          "主角被取消资格。",
          "主角发现信物并开始调查。",
        ],
        sourceRelationshipNotes: [
          "主角与评审机构：压迫/反击。",
          "主角与旧案线索：调查/揭露。",
        ],
        sourceTermNotes: ["考核场", "旧案信物", "隐藏能力"],
      },
      exportPackage: {
        tavernCharacterCards: [
          {
            name: "原创主角名",
            description:
              "被低估的青年，表面沉默克制，实际掌握能改变局势的隐藏能力。",
            personality: "隐忍、敏锐、重承诺、反击时果断。",
            scenario:
              "公开考核现场，主角被当众剥夺资格，却发现评审身上有旧案信物。",
            first_mes: "这场考核我可以不参加，但你腰间那枚信物，从哪里来的？",
            creator_notes:
              "这是原创化角色卡。不要使用原作姓名、专有能力名、组织名或关键桥段。",
          },
        ],
        worldBookEntries: [
          {
            keys: ["公开考核", "旧案信物", "隐藏能力"],
            content:
              "在这个原创世界中，公开考核决定资源分配。旧案信物会触发主角调查线，隐藏能力用于阶段性反击。",
            insertion_order: 100,
          },
          {
            keys: ["评审机构", "操盘者"],
            content:
              "评审机构负责分配资格与资源，内部存在维护旧案利益链的派系。它持续给主角制造制度化阻力。",
            insertion_order: 130,
          },
        ],
        writingConstraints: [
          "保持主角隐忍但不软弱。",
          "每次能力展示都必须带来更高层级的新问题。",
          "不要复制原作专有名词、地名、功法、组织名和事件链。",
        ],
        doNotCopyList: [
          "原作角色名",
          "原作组织名",
          "原作能力体系专名",
          "原作关键桥段顺序",
        ],
      },
      originalizationReport: {
        riskLevel: "medium",
        safeToLearn: [
          "压迫-反击结构",
          "隐藏能力的阶段性揭示",
          "公开评价场景的情绪债",
        ],
        mustTransform: [
          "姓名",
          "专有名词",
          "人物关系网",
          "关键事件链",
          "世界历史具体事件",
        ],
        fanFictionWarning:
          "同人或换皮商业化存在风险。应抽象人物底色和结构功能，再重写姓名、关系、设定规则和事件链。",
        rewriteStrategy: [
          "把角色换成原创身份、原创创伤和原创关系。",
          "把世界规则改成新的资源分配逻辑。",
          "保留情绪模型，不保留具体桥段。",
        ],
      },
      referenceBoundaryCheck: {
        summary:
          "可以学习节奏、爽点、钩子和情绪工程，但不能复用可识别人物、专名、关系网和事件链。",
        learnablePatterns: [
          "公开压迫先建立情绪债，再释放阶段反击。",
          "旧案信物把单章冲突升级为长期追读线。",
          "能力展示同时带来新敌人或新代价。",
          "章末用危机、秘密、奖励或反转推动下一章。",
        ],
        doNotReuse: [
          "原作角色名",
          "原作组织名",
          "原作能力体系专名",
          "原作关键桥段顺序",
          "原作对白和连续表达",
        ],
        needsTransformation: [
          "把公开考核改成新的资源分配制度。",
          "把旧案信物改成新的物证类型和因果链。",
          "把压迫者关系改成新的利益冲突。",
          "把能力来源、限制和代价全部重写。",
        ],
        nameAndTermRisks: [
          "能力名、组织名、地名、道具名不能沿用。",
          "高辨识度称号和专属设定要替换。",
        ],
        plotSimilarityRisks: [
          "被取消资格后立刻发现同款信物的顺序过近。",
          "导师、旧案、隐藏能力如果组合不变，会形成换皮风险。",
        ],
        safeRewriteMoves: [
          "换主角目标和失败代价。",
          "换冲突场景和资源制度。",
          "换线索类型和回收顺序。",
          "换人物关系和利益链。",
          "换爽点释放方式但保留期待-延迟-兑现结构。",
        ],
      },
      usageRiskNotice: {
        summary: "工具只做文本拆解和格式转换，不判断用户最终用途是否合法。",
        recommendedUse: [
          "读书笔记",
          "学习分析",
          "合法授权素材整理",
          "个人私用角色扮演",
          "原创化迁移参考",
        ],
        higherRiskUse: [
          "商业化使用原作可识别角色",
          "复制专有名词和关系网",
          "换皮复刻关键事件链",
        ],
        userResponsibility:
          "用户应确认自己对上传文本、导出素材和后续使用方式拥有必要权利或合法依据。",
      },
    };
  }
}
