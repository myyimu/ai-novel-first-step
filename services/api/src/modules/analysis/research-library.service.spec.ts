import { ResearchLibraryService } from "./research-library.service";

const sampleResult = (title: string, coreAppeal: string[]) => ({
  book: {
    title,
    genre: "xuanhuan",
    oneSentencePremise: `${title} 用公开压迫制造反击承诺。`,
    coreAppeal,
  },
  characters: [{ sourceName: "主角", role: "protagonist" }],
  relationships: { edges: [{ source: "主角", target: "敌人", label: "压迫" }] },
  chronicle: [{ event: "主角被否定", impact: "制造反击期待" }],
  writingSupport: {
    readerPromiseChecklist: [
      {
        promise: "公开羞辱后反击",
        evidence: "开局制造情绪债",
        nextCheck: "前三章兑现一次",
      },
    ],
    emotionalBeatMap: [
      {
        beats: ["压抑", "反击期待"],
        intensity: "high",
        readerPromise: "等主角证明自己",
      },
    ],
    pacingCurve: [
      {
        informationDensity: "medium",
        conflictIntensity: "high",
        hookStrength: "high",
        risk: "解释过多会拖慢节奏",
      },
    ],
    foreshadowingLedger: [{ setup: "旧案信物", payoff: "引出主线秘密" }],
  },
  plotlines: [
    {
      type: "main",
      reusablePattern: "公开否定 -> 发现线索 -> 阶段反击",
      payoff: "身份和能力被重新评估",
    },
  ],
  originalizationReport: {
    riskLevel: "medium",
    safeToLearn: ["压迫-反击结构"],
    mustTransform: ["角色名", "专有名词"],
    rewriteStrategy: ["保留情绪模型，重写事件链"],
  },
});

describe("ResearchLibraryService", () => {
  const jobs = [
    {
      id: "job-a",
      status: "succeeded",
      result: sampleResult("样本A", ["废柴逆袭", "旧案悬念"]),
    },
    {
      id: "job-b",
      status: "succeeded",
      result: sampleResult("样本B", ["废柴逆袭", "公开打脸"]),
    },
    {
      id: "job-running",
      status: "running",
      result: null,
    },
  ];
  const repository = {
    listJobs: jest.fn(async () => jobs),
  };
  const modelProviders = {
    chat: jest.fn(),
  };
  const service = new ResearchLibraryService(
    repository as any,
    modelProviders as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds persisted research-library summary from succeeded jobs", async () => {
    const result = await service.getLibrary(10);

    expect(result.sourceSummary).toMatchObject({
      completedBooks: 2,
      runningJobs: 1,
      comparisonReadiness: "ready-for-basic-compare",
    });
    expect(result.graphAssets).toHaveLength(2);
    expect(result.comparisonSamples[0]).toMatchObject({
      jobId: "job-a",
      title: "样本A",
      compareUse: "适合比较情绪节奏和追读结构",
    });
  });

  it("compares selected succeeded books with evidence and prompt seed", async () => {
    const result = await service.compareBooks({
      jobIds: ["job-a", "job-b"],
      focus: "对比开局承诺",
      includePromptSeed: true,
    });

    expect(result.mode).toBe("multi-book-research-comparison");
    expect(result.sampleCount).toBe(2);
    expect(result.commonPatterns.length).toBeGreaterThan(0);
    expect(result.evidenceMatrix).toHaveLength(2);
    expect(result.promptSeed).toContain("对比开局承诺");
  });

  it("answers research questions from stored citations in mock mode", async () => {
    const result = await service.answerQuestion({
      provider: { kind: "mock" },
      jobIds: ["job-a", "job-b"],
      question: "这些样本的开局承诺有什么共同点？",
      answerMode: "beginner",
    });

    expect(result.mode).toBe("research-library-qa");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.keyFindings).toHaveLength(3);
    expect(modelProviders.chat).not.toHaveBeenCalled();
  });
});
