import { BadRequestException } from "@nestjs/common";
import { BookAnalysisService } from "./book-analysis.service";

function createBookService(options?: {
  modelProviders?: { chat: jest.Mock };
  persistence?: { listJobs?: jest.Mock };
  bookJobs?: { delete?: jest.Mock; get?: jest.Mock };
}) {
  return new BookAnalysisService(
    {} as never,
    (options?.bookJobs ?? {}) as never,
    {} as never,
    (options?.modelProviders ?? { chat: jest.fn() }) as never,
    (options?.persistence ?? {}) as never,
    {} as never,
  );
}

describe("BookAnalysisService", () => {
  it("should reject the legacy synchronous full-book endpoint", async () => {
    const service = createBookService();

    await expect(
      service.analyzeBook({
        provider: { preset: "shared-gpu", kind: "openai-compatible" },
        title: "Long-form test",
        genre: "xuanhuan",
        text: "body",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("should return lightweight summaries when listing book jobs", async () => {
    const persistence = {
      listJobs: jest.fn(async () => [
        {
          id: "job-1",
          type: "book-map-reduce-analysis",
          status: "succeeded",
          createdAt: "2026-06-20T00:00:00.000Z",
          updatedAt: "2026-06-20T00:10:00.000Z",
          inputSummary: {
            title: "Long-form test",
            genre: "xuanhuan",
            textLength: 12000,
          },
          progress: {
            stage: "succeeded",
            current: 10,
            total: 10,
            message: "done",
          },
          preprocessing: {
            cleaning: {
              rawLength: 12000,
              cleanedLength: 11800,
              paragraphCount: 200,
              removedNoise: [],
            },
            chapters: [],
          },
          result: { huge: true },
        },
      ]),
    };
    const service = createBookService({ persistence });

    const jobs = await service.listBookAnalysisJobs(10);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).not.toHaveProperty("result");
    expect(jobs[0]).not.toHaveProperty("preprocessing");
  });

  it("should pass includeResult through when reading a single book job", async () => {
    const bookJobs = {
      get: jest.fn(async () => ({
        id: "job-1",
        type: "book-map-reduce-analysis",
        status: "running",
      })),
    };
    const service = new BookAnalysisService(
      {} as never,
      bookJobs as never,
      {} as never,
      { chat: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    await service.getBookAnalysisJob("job-1", { includeResult: false });

    expect(bookJobs.get).toHaveBeenCalledWith("job-1", {
      includeResult: false,
    });
  });

  it("should delete a completed book-analysis history job", async () => {
    const bookJobs = {
      delete: jest.fn(async () => ({ deleted: true, jobId: "job-1" })),
    };
    const service = createBookService({ bookJobs });

    await expect(service.deleteBookAnalysisJob("job-1")).resolves.toEqual({
      deleted: true,
      jobId: "job-1",
    });
    expect(bookJobs.delete).toHaveBeenCalledWith("job-1");
  });

  it("should condense large chapter maps before book-level reduce", () => {
    const service = createBookService();

    const reducedMaps = (
      service as unknown as {
        prepareReducerChapterMaps: (
          chapterMaps: Array<{
            chapterId: string;
            order: number;
            title: string;
            analysisDepth: "outline" | "deep";
            focusScore?: number;
            chunkStartOffset: number;
            chunkEndOffset: number;
            splitBy: "heading" | "auto-chunk";
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
          }>,
        ) => Array<{ chapterId: string; title: string }>;
      }
    ).prepareReducerChapterMaps(
      Array.from({ length: 40 }, (_, index) => ({
        chapterId: `ch-${index + 1}`,
        order: index + 1,
        title: `Chapter ${index + 1}`,
        analysisDepth: "deep",
        focusScore: 8,
        chunkStartOffset: index * 1000,
        chunkEndOffset: index * 1000 + 800,
        splitBy: "heading",
        summary: `Chapter ${index + 1} pushes a new clue forward`,
        plotFunction: "advance the main plot",
        chapterGoal: "obtain key intelligence",
        conflict: "a rival gets there first",
        characterSignals: [`character-${index % 5}`],
        worldbuildingSignals: [`setting-${index % 4}`],
        relationshipSignals: [`relationship-${index % 3}`],
        timelineEvents: [`event-${index + 1}`],
        emotionalBeats: [`emotion-${index % 2}`],
        foreshadowingSetups: [`setup-${index % 6}`],
        payoffSignals: [`payoff-${index % 4}`],
        sourceRiskSignals: [`risk-${index % 3}`],
        originalizationSeeds: [`seed-${index % 5}`],
        hook: `hook-${index + 1}`,
        evidenceSnippets: [`evidence-${index + 1}`],
        sourceAnchors: [
          {
            anchorId: `anchor-${index + 1}`,
            label: "evidence",
            quote: `evidence-${index + 1}`,
            startOffset: index * 1000,
            endOffset: index * 1000 + 4,
          },
        ],
      })),
    );

    expect(reducedMaps).toHaveLength(14);
    expect(reducedMaps[0]).toEqual(
      expect.objectContaining({
        chapterId: "chunk-001",
        title: "Chapter 1 ~ Chapter 3",
      }),
    );
  });

  it("should normalize chargraph-style character relations into stable graph data", () => {
    const service = createBookService();
    const normalize = (
      service as unknown as {
        normalizeBookAnalysisResult: (
          input: { title: string; genre: string; text: string },
          value: unknown,
        ) => {
          relationships: {
            nodes: Array<{
              id: string;
              label: string;
              names?: string[];
              mainCharacter?: boolean;
              portraitPrompt?: string;
            }>;
            edges: Array<{
              source: string;
              target: string;
              relation: string[];
              weight: number;
              positivity: number;
              evidence: string[];
            }>;
          };
          relationshipGraphQuality: {
            edgeCount: number;
            nodeCount: number;
            duplicateMergeCount: number;
            averageConfidence: number;
            evidenceCoverage: number;
            riskLevel: "good" | "needs-review" | "weak";
            isolatedNodes: Array<{ id: string; label: string; type: string }>;
            weakEvidenceEdges: Array<{
              source: string;
              target: string;
              sourceLabel?: string;
              targetLabel?: string;
              label: string;
              reason: string;
              suggestedQuery?: string;
            }>;
          };
        };
      }
    ).normalizeBookAnalysisResult.bind(service);

    const result = normalize(
      {
        title: "Graph test",
        genre: "xuanhuan",
        text: "chapter text",
      },
      {
        characters: [
          {
            id: 1,
            common_name: "阿青",
            names: ["阿青", "青少爷"],
            main_character: true,
            description: "被压迫后反击的主角。",
            portrait_prompt: "young fighter with a restrained silhouette",
          },
          {
            id: 2,
            common_name: "评审长",
            names: ["评审长"],
            main_character: false,
          },
        ],
        relationships: {
          relations: [
            {
              id1: 1,
              id2: 2,
              relation: ["压迫", "反击"],
              weight: 8,
              positivity: -0.75,
              evidence: ["评审长当众否定阿青"],
            },
            {
              id1: 2,
              id2: 1,
              relation: ["敌对"],
              weight: 6,
              positivity: -0.5,
            },
          ],
        },
      },
    );

    expect(result.relationships.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "1",
          label: "阿青",
          names: expect.arrayContaining(["青少爷"]),
          mainCharacter: true,
          portraitPrompt: "young fighter with a restrained silhouette",
        }),
      ]),
    );
    expect(result.relationships.edges).toHaveLength(1);
    expect(result.relationships.edges[0]).toEqual(
      expect.objectContaining({
        source: "1",
        target: "2",
        relation: expect.arrayContaining(["压迫", "反击", "敌对"]),
        weight: 8,
        evidence: expect.arrayContaining(["评审长当众否定阿青"]),
      }),
    );
    expect(result.relationships.edges[0].positivity).toBeLessThan(0);
    expect(result.relationshipGraphQuality).toEqual(
      expect.objectContaining({
        nodeCount: 2,
        edgeCount: 1,
        duplicateMergeCount: 1,
        evidenceCoverage: 1,
        riskLevel: "good",
      }),
    );
    expect(result.relationshipGraphQuality.isolatedNodes).toHaveLength(0);
    expect(result.relationshipGraphQuality.weakEvidenceEdges).toHaveLength(0);
  });

  it("should create review queries for weak relationship evidence", () => {
    const service = createBookService();
    const normalize = (
      service as unknown as {
        normalizeBookAnalysisResult: (
          input: { title: string; genre: string; text: string },
          value: unknown,
        ) => {
          relationshipGraphQuality: {
            riskLevel: "good" | "needs-review" | "weak";
            isolatedNodes: Array<{
              label: string;
              suggestedQuery?: string;
              reviewAction?: string;
            }>;
            weakEvidenceEdges: Array<{
              sourceLabel?: string;
              targetLabel?: string;
              label: string;
              reason: string;
              suggestedQuery?: string;
              reviewAction?: string;
            }>;
          };
        };
      }
    ).normalizeBookAnalysisResult.bind(service);

    const result = normalize(
      {
        title: "Weak graph test",
        genre: "xuanhuan",
        text: "chapter text",
      },
      {
        characters: [
          { id: "c1", common_name: "阿青" },
          { id: "c2", common_name: "神秘导师" },
          { id: "c3", common_name: "孤立商会" },
        ],
        relationships: {
          relations: [
            {
              id1: "c1",
              id2: "c2",
              relation: ["疑似指引"],
              confidence: 0.4,
            },
          ],
        },
      },
    );

    expect(result.relationshipGraphQuality.riskLevel).toBe("weak");
    expect(result.relationshipGraphQuality.weakEvidenceEdges[0]).toEqual(
      expect.objectContaining({
        sourceLabel: "阿青",
        targetLabel: "神秘导师",
        reason: expect.stringContaining("缺少文本证据"),
        suggestedQuery: expect.stringContaining("阿青 神秘导师 疑似指引"),
      }),
    );
    expect(
      result.relationshipGraphQuality.weakEvidenceEdges[0].reviewAction,
    ).toContain("补充证据");
    expect(result.relationshipGraphQuality.isolatedNodes[0]).toEqual(
      expect.objectContaining({
        label: "孤立商会",
        suggestedQuery: "孤立商会",
      }),
    );
  });

  it("should search chunk evidence index from a succeeded book job", async () => {
    const bookJobs = {
      get: jest.fn(),
    };
    const service = createBookService({ bookJobs });
    const job = {
      id: "job-search",
      type: "book-map-reduce-analysis",
      status: "succeeded",
      inputSummary: {
        title: "Whole book test",
        genre: "suspense",
        textLength: 8000,
      },
      progress: {
        stage: "succeeded",
        current: 3,
        total: 3,
        message: "done",
      },
      result: {
        mapReduce: {
          chunkEvidenceIndex: [
            {
              chapterId: "ch-1",
              order: 1,
              title: "Chapter 1 Old Case",
              summary:
                "The protagonist finds an old-case token and starts digging.",
              plotFunction: "establish the core suspense",
              hook: "the old case points at a bigger enemy",
              chunkStartOffset: 0,
              chunkEndOffset: 800,
              keywords: ["old case", "token", "investigate"],
              evidenceSnippets: ["she saw the old-case token"],
              sourceAnchors: [
                {
                  anchorId: "a-1",
                  label: "old-case token",
                  quote: "she saw the old-case token",
                  startOffset: 120,
                  endOffset: 130,
                },
              ],
            },
            {
              chapterId: "ch-2",
              order: 2,
              title: "Chapter 2 Rival",
              summary: "The rival applies open pressure.",
              plotFunction: "escalate the external conflict",
              hook: "a larger threat appears",
              chunkStartOffset: 801,
              chunkEndOffset: 1600,
              keywords: ["rival", "pressure"],
              evidenceSnippets: ["the rival pressures the room"],
              sourceAnchors: [],
            },
          ],
        },
      },
    };
    bookJobs.get.mockResolvedValue(job);

    const result = await service.searchBookAnalysisEvidence(
      "job-search",
      "token",
      5,
    );

    expect(result.mode).toBe("book-evidence-search");
    expect(result.hitCount).toBe(1);
    expect(result.hits[0]).toEqual(
      expect.objectContaining({
        chapterId: "ch-1",
        matchedKeywords: expect.arrayContaining(["token"]),
      }),
    );
  });

  it("should run the full mock book map-reduce flow and return structured results", async () => {
    const bookJobs = {
      create: jest.fn(
        async (
          _inputSummary: unknown,
          processor: (jobId: string) => Promise<unknown>,
        ) => {
          await processor("job-mock-1");
          return {
            id: "job-mock-1",
            type: "book-map-reduce-analysis",
            status: "queued",
          };
        },
      ),
      markRunning: jest.fn(),
      updateProgress: jest.fn(),
      setPreprocessing: jest.fn(),
      recordChapterMap: jest.fn(),
      updatePartialPlan: jest.fn(),
      complete: jest.fn(),
      readChapterMaps: jest.fn(async () => []),
      get: jest.fn(async () => ({
        id: "job-mock-1",
        status: "queued",
      })),
    };

    const textPreprocessor = {
      preprocess: jest.fn(() => ({
        chapters: [
          {
            id: "ch-1",
            order: 1,
            title: "第一章",
            text: "主角进入考场，发现考官是仇人。他必须在一炷香内证明自己。",
            splitBy: "heading",
            charCount: 30,
            wordCount: 30,
            startOffset: 0,
            endOffset: 30,
          },
          {
            id: "ch-2",
            order: 2,
            title: "第二章",
            text: "主角证明了自己，但更大的危机在等着他。",
            splitBy: "heading",
            charCount: 20,
            wordCount: 20,
            startOffset: 30,
            endOffset: 50,
          },
        ],
        cleaning: {
          rawLength: 50,
          cleanedLength: 50,
          removedNoise: [],
          paragraphCount: 2,
        },
      })),
    };

    const service = new BookAnalysisService(
      textPreprocessor as never,
      bookJobs as never,
      {} as never,
      { chat: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    const job = await service.createBookAnalysisJob({
      provider: { kind: "mock" },
      title: "测试书",
      genre: "xuanhuan",
      text: "主角进入考场...",
    });

    expect(job.id).toBe("job-mock-1");
    expect(bookJobs.markRunning).toHaveBeenCalled();
    expect(bookJobs.complete).toHaveBeenCalled();

    const completedResult = bookJobs.complete.mock.calls[0]?.[1];
    expect(completedResult).toHaveProperty("mapReduce");
    expect(completedResult.mapReduce).toHaveProperty("chapterMaps");
    expect(completedResult.mapReduce.chapterMaps).toHaveLength(2);
    expect(completedResult.mapReduce.strategy).toContain("preprocess");
  });
});
