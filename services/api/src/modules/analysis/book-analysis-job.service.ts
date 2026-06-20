import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleInit,
} from "@nestjs/common";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import { BookPreprocessResult } from "./text-preprocessor.service";

export type BookAnalysisJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export interface BookAnalysisJobProgress {
  stage: "queued" | "preprocess" | "map" | "reduce" | "succeeded" | "failed";
  current: number;
  total: number;
  message: string;
}

export interface BookAnalysisPartialResult {
  partial: true;
  type: "book-map-reduce-partial";
  stage: "map" | "reduce" | "failed";
  savedAt: string;
  mapCount: number;
  totalChapters: number;
  artifactDir: string;
  notice: string;
  analysisStrategy?: string;
  outlineCount?: number;
  deepTargetOrders?: number[];
  deepCompletedCount?: number;
}

export interface BookAnalysisJobSnapshot {
  id: string;
  type: "book-map-reduce-analysis";
  status: BookAnalysisJobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  inputSummary: {
    title: string;
    genre: string;
    textLength: number;
  };
  progress: BookAnalysisJobProgress;
  preprocessing?: Omit<BookPreprocessResult, "chapters"> & {
    chapters: Array<Omit<BookPreprocessResult["chapters"][number], "text">>;
  };
  partialResult?: BookAnalysisPartialResult;
  result?: unknown;
  error?: string;
  uploadId?: string;
}

interface StoredBookAnalysisJob extends BookAnalysisJobSnapshot {}

@Injectable()
export class BookAnalysisJobService implements OnModuleInit {
  private readonly logger = new Logger(BookAnalysisJobService.name);
  private readonly jobs = new Map<string, StoredBookAnalysisJob>();
  private readonly storageRoot =
    process.env.ANALYSIS_STORAGE_DIR?.trim() ||
    join(process.cwd(), ".local", "analysis");
  private readonly artifactRoot =
    process.env.ANALYSIS_ARTIFACT_DIR?.trim() ||
    join(process.cwd(), ".local", "artifacts");

  constructor(private readonly repository: AnalysisPersistenceRepository) {}

  async onModuleInit() {
    await this.repository.markInterruptedJobsFailed();
  }

  async create(
    inputSummary: BookAnalysisJobSnapshot["inputSummary"],
    processor: (jobId: string) => Promise<unknown>,
    uploadId?: string,
  ): Promise<BookAnalysisJobSnapshot> {
    const now = new Date().toISOString();
    const id = `book_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const job: StoredBookAnalysisJob = {
      id,
      type: "book-map-reduce-analysis",
      status: "queued",
      createdAt: now,
      updatedAt: now,
      inputSummary,
      progress: {
        stage: "queued",
        current: 0,
        total: 1,
        message: "Job has been queued.",
      },
      uploadId,
    };

    this.jobs.set(id, job);
    await this.repository.createJob(job, uploadId);
    setTimeout(() => {
      void processor(id).catch((error: unknown) => {
        void this.fail(id, error);
      });
    }, 0);

    return this.snapshot(job);
  }

  async get(
    jobId: string,
    options?: { includeResult?: boolean },
  ): Promise<BookAnalysisJobSnapshot> {
    const inMemory = this.jobs.get(jobId);
    if (inMemory) {
      return this.snapshot(inMemory, options);
    }

    const persisted = await this.repository.getJob(jobId, options);
    if (!persisted) {
      throw new NotFoundException(`Book analysis job not found: ${jobId}`);
    }

    return persisted;
  }

  async delete(jobId: string) {
    const job = await this.get(jobId, { includeResult: false });
    if (job.status === "queued" || job.status === "running") {
      throw new BadRequestException(
        "Running book analysis jobs cannot be deleted.",
      );
    }

    const deleted = await this.repository.deleteJob(jobId);
    if (!deleted) {
      throw new NotFoundException(`Book analysis job not found: ${jobId}`);
    }

    this.jobs.delete(jobId);
    await Promise.all([
      rm(join(this.artifactRoot, jobId), { recursive: true, force: true }),
      rm(join(this.storageRoot, "jobs", jobId), {
        recursive: true,
        force: true,
      }),
    ]);

    return {
      deleted: true as const,
      jobId,
    };
  }

  async resume(
    jobId: string,
    processor: (jobId: string) => Promise<unknown>,
  ): Promise<BookAnalysisJobSnapshot> {
    let job = this.jobs.get(jobId);
    if (!job) {
      const persisted = await this.repository.getJob(jobId, {
        includeResult: true,
      });
      if (!persisted) {
        throw new NotFoundException(`Book analysis job not found: ${jobId}`);
      }
      job = { ...persisted };
      this.jobs.set(jobId, job);
    }

    if (job.status === "running" || job.status === "queued") {
      return this.snapshot(job);
    }

    const now = new Date().toISOString();
    job.status = "queued";
    job.error = undefined;
    job.finishedAt = undefined;
    job.updatedAt = now;
    job.progress = {
      stage: "queued",
      current:
        job.partialResult?.deepCompletedCount ??
        job.partialResult?.mapCount ??
        0,
      total:
        job.partialResult?.deepTargetOrders?.length ||
        job.partialResult?.totalChapters ||
        1,
      message: job.partialResult
        ? "Found previous partial progress and queued it for resume."
        : "Job has been re-queued.",
    };
    await this.repository.updateJob(jobId, {
      status: job.status,
      progress: job.progress,
      error: null,
      finishedAt: null,
    });

    setTimeout(() => {
      void processor(jobId).catch((error: unknown) => {
        void this.fail(jobId, error);
      });
    }, 0);

    return this.snapshot(job);
  }

  async markRunning(jobId: string) {
    const job = this.read(jobId);
    const now = new Date().toISOString();
    job.status = "running";
    job.startedAt = now;
    job.updatedAt = now;
    await this.repository.updateJob(jobId, {
      status: job.status,
      progress: job.progress,
      startedAt: now,
    });
  }

  async updateProgress(jobId: string, progress: BookAnalysisJobProgress) {
    const job = this.read(jobId);
    job.progress = progress;
    job.updatedAt = new Date().toISOString();
    await this.repository.updateJob(jobId, { progress });
  }

  async setPreprocessing(jobId: string, preprocessing: BookPreprocessResult) {
    const job = this.read(jobId);
    job.preprocessing = {
      cleaning: preprocessing.cleaning,
      chapters: preprocessing.chapters.map(
        ({ text: _text, ...chapter }) => chapter,
      ),
    };
    job.updatedAt = new Date().toISOString();
    await this.repository.updateJob(jobId, {
      preprocessing: job.preprocessing,
    });
  }

  async recordChapterMap(input: {
    jobId: string;
    chapterMap: unknown;
    mapCount: number;
    totalChapters: number;
    analysisStrategy?: string;
    outlineCount?: number;
    deepTargetOrders?: number[];
    deepCompletedCount?: number;
    phase?: "outline" | "deep";
  }) {
    const job = this.read(input.jobId);
    const artifactDir = join(this.artifactRoot, input.jobId);
    const mapId = this.chapterMapFileId(input.chapterMap, input.mapCount);
    await mkdir(artifactDir, { recursive: true });
    await writeFile(
      join(artifactDir, `map-${mapId}.json`),
      JSON.stringify(input.chapterMap, null, 2),
      "utf8",
    );

    const now = new Date().toISOString();
    const mapCount = input.mapCount;
    job.partialResult = {
      partial: true,
      type: "book-map-reduce-partial",
      stage: "map",
      savedAt: now,
      mapCount: input.mapCount,
      totalChapters: input.totalChapters,
      artifactDir,
      notice:
        input.phase === "deep"
          ? `Deep analysis ${input.deepCompletedCount || 0}/${input.deepTargetOrders?.length || 0} completed.`
          : `Outline index ${mapCount}/${input.totalChapters} completed.`,
      analysisStrategy: input.analysisStrategy,
      outlineCount: input.outlineCount,
      deepTargetOrders: input.deepTargetOrders,
      deepCompletedCount: input.deepCompletedCount,
    };
    job.updatedAt = now;
    await this.repository.updateJob(input.jobId, {
      partialResult: job.partialResult,
    });
  }

  async updatePartialPlan(
    input: Pick<
      BookAnalysisPartialResult,
      | "analysisStrategy"
      | "outlineCount"
      | "deepTargetOrders"
      | "deepCompletedCount"
    > & { jobId: string },
  ) {
    const job = this.read(input.jobId);
    if (!job.partialResult) {
      return;
    }

    const nextPartial: BookAnalysisPartialResult = {
      ...job.partialResult,
      savedAt: new Date().toISOString(),
      analysisStrategy:
        input.analysisStrategy ?? job.partialResult.analysisStrategy,
      outlineCount: input.outlineCount ?? job.partialResult.outlineCount,
      deepTargetOrders:
        input.deepTargetOrders ?? job.partialResult.deepTargetOrders,
      deepCompletedCount:
        input.deepCompletedCount ?? job.partialResult.deepCompletedCount,
    };
    job.partialResult = nextPartial;
    job.updatedAt = nextPartial.savedAt;
    await this.repository.updateJob(input.jobId, {
      partialResult: nextPartial,
    });
  }

  async readChapterMaps<T = unknown>(jobId: string): Promise<T[]> {
    const artifactDirs = [
      join(this.artifactRoot, jobId),
      join(this.storageRoot, "jobs", jobId, "maps"),
    ];
    for (const artifactDir of artifactDirs) {
      let files: string[];
      try {
        files = await readdir(artifactDir);
      } catch {
        continue;
      }

      const jsonFiles = files
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .sort((left, right) => left.localeCompare(right));
      if (!jsonFiles.length) {
        continue;
      }

      const maps: T[] = [];
      for (const file of jsonFiles) {
        const content = await readFile(join(artifactDir, file), "utf8");
        maps.push(JSON.parse(content) as T);
      }
      return maps;
    }

    return [];
  }

  async complete(jobId: string, result: unknown) {
    const job = this.read(jobId);
    const now = new Date().toISOString();
    job.status = "succeeded";
    job.finishedAt = now;
    job.updatedAt = now;
    job.result = result;
    job.progress = {
      stage: "succeeded",
      current: job.progress.total,
      total: job.progress.total,
      message: "Book analysis completed.",
    };
    await this.repository.updateJob(jobId, {
      status: job.status,
      progress: job.progress,
      result,
      finishedAt: now,
    });
    this.jobs.delete(jobId);
  }

  async fail(jobId: string, error: unknown) {
    const job = this.read(jobId);
    const now = new Date().toISOString();
    job.status = "failed";
    job.finishedAt = now;
    job.updatedAt = now;
    job.error = error instanceof Error ? error.message : String(error);
    if (job.partialResult) {
      job.partialResult = {
        ...job.partialResult,
        stage: "failed",
        savedAt: now,
      };
    }
    job.progress = {
      stage: "failed",
      current: job.progress.current,
      total: job.progress.total,
      message: job.error,
    };
    await this.repository.updateJob(jobId, {
      status: job.status,
      progress: job.progress,
      partialResult: job.partialResult,
      error: job.error,
      finishedAt: now,
    });
    this.jobs.delete(jobId);
    this.logger.warn(`Book analysis job failed: ${jobId} ${job.error}`);
  }

  private read(jobId: string): StoredBookAnalysisJob {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Book analysis job not found: ${jobId}`);
    }

    return job;
  }

  private snapshot(
    job: StoredBookAnalysisJob,
    options?: { includeResult?: boolean },
  ): BookAnalysisJobSnapshot {
    return {
      ...job,
      progress: { ...job.progress },
      inputSummary: { ...job.inputSummary },
      result: options?.includeResult === false ? undefined : job.result,
      partialResult: job.partialResult
        ? {
            partial: job.partialResult.partial,
            type: job.partialResult.type,
            stage: job.partialResult.stage,
            savedAt: job.partialResult.savedAt,
            mapCount: job.partialResult.mapCount,
            totalChapters: job.partialResult.totalChapters,
            artifactDir: job.partialResult.artifactDir,
            notice: job.partialResult.notice,
            analysisStrategy: job.partialResult.analysisStrategy,
            outlineCount: job.partialResult.outlineCount,
            deepTargetOrders: job.partialResult.deepTargetOrders,
            deepCompletedCount: job.partialResult.deepCompletedCount,
          }
        : undefined,
    };
  }

  private chapterMapFileId(chapterMap: unknown, fallbackOrder: number) {
    const source = chapterMap as { chapterId?: unknown; order?: unknown };
    const rawId =
      typeof source?.chapterId === "string" && source.chapterId.trim()
        ? source.chapterId
        : typeof source?.order === "number"
          ? `ch-${String(source.order).padStart(4, "0")}`
          : `ch-${String(fallbackOrder).padStart(4, "0")}`;

    return rawId.replace(/[^a-zA-Z0-9._-]/g, "-");
  }
}
