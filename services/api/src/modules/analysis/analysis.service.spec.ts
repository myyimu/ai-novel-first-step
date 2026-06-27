import { AnalysisService } from "./analysis.service";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";

const quickReviewJson = JSON.stringify({
  title: "Chapter 1",
  genre: "xuanhuan",
  positioning: "public humiliation opens into a counterattack",
  sellingPoints: ["clear conflict", "suspenseful clue"],
  mainProblem: "the counterattack target is still not specific enough",
  actionableFixes: [
    "clarify the failure cost",
    "end with a stronger hook",
    "compress explanatory paragraphs",
  ],
  recommendedPlatforms: [
    {
      id: "fanqie",
      label: "Fanqie",
      fit: "priority release",
      reason: "strong conflict and fast pace fit broad-distribution testing",
    },
  ],
  readyForFullReview: true,
  readyReason: "enough text for a full review",
  quickScore: 6.8,
  confidence: 0.7,
});

const scoreResultJson = JSON.stringify({
  mode: "llm-score",
  chapterTitle: "第一章",
  totalScore: 7.1,
  scores: [
    {
      metricId: "opening-promise",
      name: "开局承诺强度",
      score: 7,
      reason: "冲突进入较快，但承诺兑现还不够明确。",
      evidence: "考官正是三年前废掉他经脉的人",
      fix: "提前写清主角若失败会失去什么。",
      referencePrincipleId: "p1",
    },
  ],
  strongestPoint: "冲突关系明确",
  weakestPoint: "失败代价还不够具体",
  styleFit: {
    score: 7,
    platformRisk: "开头解释略多",
    audienceRisk: "爽点兑现偏慢",
    readingModeRisk: "移动阅读下需要更早给危机",
  },
  marketFit: {
    score: 7,
    categoryRisk: "分类承诺基本成立",
    themeRisk: "反击主题还需前置",
    keywordRisk: "关键词承载不足",
    frontloadRisk: "卖点前置不足",
  },
  platformStrategyFit: {
    score: 7,
    recommendationRisk: "推荐信号需要更强点击承诺",
    competitionRisk: "同质化风险中等",
    pushBottleneck: "首章完读",
    trafficEntryAction: "强化章末钩子",
  },
  performanceFit: {
    hasData: false,
    funnelSummary: "未提供数据",
    impressionDiagnosis: "未提供",
    clickDiagnosis: "未提供",
    validReadDiagnosis: "未提供",
    read30sDiagnosis: "未提供",
    read60sDiagnosis: "未提供",
    bottomDiagnosis: "未提供",
    followDiagnosis: "未提供",
    bookshelfDiagnosis: "未提供",
    firstChapterCompletionDiagnosis: "未提供",
    avgReadProgressDiagnosis: "未提供",
    paidUnlockDiagnosis: "未提供",
    nextChapterClickDiagnosis: "未提供",
    threeChapterRetentionDiagnosis: "未提供",
    priority: "先修开头承诺",
  },
  selfTestFit: {
    enabled: false,
    summary: "未启用",
    dialogueMaskDiagnosis: "未启用",
    jumpReadDiagnosis: "未启用",
    emotionDiagnosis: "未启用",
    settingRecapDiagnosis: "未启用",
    deleteSentenceDiagnosis: "未启用",
    aiTraceDiagnosis: "未启用",
    promptAddons: [],
  },
  nextRevisionMove: "补强失败代价和章末钩子",
  rewriteBrief: {
    target: "开头 500 字",
    strategy: "前置目标、压迫和反击期待",
  },
  revisionPrompt: {
    title: "强化第一章开局承诺",
    prompt: "保留考场重逢，前置失败代价，禁止改成新故事。",
  },
});

const scoreInput = {
  provider: {
    preset: "deepseek",
    kind: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-user-owned",
    model: "deepseek-chat",
    jsonMode: false,
  } satisfies ProviderConfigDto,
  rubric: {
    id: "reference-rubric",
    metrics: [
      {
        id: "opening-promise",
        name: "开局承诺强度",
        description:
          "开头是否快速交代主角处境、核心矛盾、失败代价和继续读的理由。",
      },
    ],
  },
  platform: "fanqie",
  audience: "male-fast-paced",
  readingMode: "mobile-fragmented",
  category: "玄幻逆袭",
  theme: "被废后反击",
  tags: ["退婚", "考场", "逆袭"],
  explicitKeywords: ["废掉经脉", "考官"],
  implicitExpectations: ["公开羞辱", "反击"],
  chapterTitle: "第一章",
  chapterText:
    "主角进入考场，却发现考官正是三年前废掉他经脉的人。众人围观嘲笑，他必须在一炷香内证明自己，否则家族会被剥夺试炼资格。下一刻，考官宣布第一题就是让他亲手毁掉祖传令牌。",
};

function createService(options?: { modelProviders?: { chat: jest.Mock } }) {
  return new AnalysisService(
    (options?.modelProviders ?? { chat: jest.fn() }) as never,
  );
}

describe("AnalysisService", () => {
  it("should reuse ai-core preview scoring for the preview endpoint", () => {
    const service = createService();

    const result = service.previewScore({
      title: "第一章",
      rubricId: "default",
      text: "主角进入考场，却发现考官正是三年前废掉他经脉的人。下一刻，对方突然宣布退场即死！",
    });

    expect(result.mode).toBe("statistical-preview");
    expect(result.weakestPoint).toContain("真实 LLM Provider");
    expect(result.scores[0]).toMatchObject({
      metricId: "chapter-goal",
      name: "主角目标清晰度",
      evidence:
        "预览策略不截取原文证据，真实证据由 services/api 的 LLM 分析链生成。",
    });
  });

  it("should use the user configured paid provider when supplied", async () => {
    const modelProviders = {
      chat: jest.fn(async () => quickReviewJson),
    };
    const service = createService({ modelProviders });
    const provider: ProviderConfigDto = {
      preset: "deepseek",
      kind: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: "sk-user-owned",
      model: "deepseek-chat",
      temperature: 0.2,
      jsonMode: false,
    };

    await service.quickReview({
      provider,
      chapterText:
        "The protagonist is humiliated in public, then finds an old clue from a family case and accepts a dangerous trial on the spot.",
    });

    expect(modelProviders.chat).toHaveBeenCalledWith(
      provider,
      expect.any(Array),
      expect.objectContaining({ maxOutputTokens: 2200 }),
    );

    const [, messages] = modelProviders.chat.mock.calls[0] as unknown as [
      ProviderConfigDto,
      Array<{ content: string }>,
      unknown,
    ];
    expect(messages[0].content).toContain("网文第一章诊断编辑");
    expect(messages[1].content).toContain("Rubric ID：quick-review");
    expect(messages[1].content).toContain("检查指标：");
    expect(messages[1].content).toContain("严格返回这个 JSON 结构");
    expect(messages[1].content).toContain("gateDecision");
    expect(messages[1].content).toContain("issues");
  });

  it("should keep mock quick review local without calling the provider", async () => {
    const modelProviders = {
      chat: jest.fn(),
    };
    const service = createService({ modelProviders });

    const result = await service.quickReview({
      provider: { kind: "mock" },
      title: "第一章",
      genre: "xuanhuan",
      chapterText:
        "主角刚进入考场，就发现考官正是三年前废掉他经脉的人。旁人当场羞辱他，要求他放弃资格，否则就让家族一起赔命。",
    });

    expect(modelProviders.chat).not.toHaveBeenCalled();
    expect(result.confidence).toBe(0);
    expect(result.mainProblem).toContain("演示模式");
    expect(result.gateDecision).toBe("revise");
    expect(result.issues?.[0]?.title).toContain("演示模式");
  });

  it("should fall back to the shared provider only when no provider is supplied", async () => {
    const modelProviders = {
      chat: jest.fn(async () => quickReviewJson),
    };
    const service = createService({ modelProviders });

    await service.quickReview({
      chapterText:
        "The protagonist is humiliated in public, then finds an old clue from a family case and accepts a dangerous trial on the spot.",
    });

    expect(modelProviders.chat).toHaveBeenCalledWith(
      {
        preset: "shared-gpu",
        kind: "openai-compatible",
      },
      expect.any(Array),
      expect.objectContaining({ maxOutputTokens: 2200 }),
    );
  });

  it("should fall back to heuristic platform recommendations when the model omits them", async () => {
    const modelProviders = {
      chat: jest.fn(async () =>
        JSON.stringify({
          title: "Chapter 1",
          genre: "romance",
          positioning: "an emotionally tense misunderstanding opening",
          sellingPoints: ["clear emotional pressure"],
          mainProblem: "the escalation is still too slow",
          actionableFixes: ["front-load the relationship cost"],
          readyForFullReview: true,
          readyReason: "enough text",
          quickScore: 6.3,
          confidence: 0.66,
        }),
      ),
    };
    const service = createService({ modelProviders });

    const result = await service.quickReview({
      chapterText:
        "Before the wedding, the heroine learns that her fiance and sister have been hiding the truth and even intercepted her mother's treatment money, so she tears the facade apart on the spot.",
      genre: "romance",
    });

    expect(result.recommendedPlatforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "jinjiang", fit: "优先发布" }),
      ]),
    );
  });

  it("should score chapters with the shared ai-core scoring prompt", async () => {
    const modelProviders = {
      chat: jest.fn(async () => scoreResultJson),
    };
    const service = createService({ modelProviders });

    const result = await service.scoreChapter(scoreInput);

    expect(result.totalScore).toBe(7.1);
    expect(modelProviders.chat).toHaveBeenCalledWith(
      scoreInput.provider,
      expect.any(Array),
      expect.objectContaining({
        maxOutputTokens: 3072,
        jsonSchema: expect.objectContaining({ name: "score_result" }),
      }),
    );

    const [, messages] = modelProviders.chat.mock.calls[0] as unknown as [
      ProviderConfigDto,
      Array<{ content: string }>,
      unknown,
    ];
    expect(messages[0].content).toContain("中文网文点评官");
    expect(messages[1].content).toContain("Rubric ID：reference-rubric");
    expect(messages[1].content).toContain("评分指标：");
    expect(messages[1].content).toContain("opening-promise / 开局承诺强度");
    expect(messages[1].content).toContain("补充上下文与严格输出要求");
    expect(messages[1].content).toContain("严格返回这个 JSON 结构");
  });

  it("should repair malformed score JSON before returning the result", async () => {
    const modelProviders = {
      chat: jest.fn(async (_provider, _messages, options) =>
        options?.jsonSchema ? "{ not valid json" : scoreResultJson,
      ),
    };
    const service = createService({ modelProviders });

    const result = await service.scoreChapter(scoreInput);

    expect(result.totalScore).toBe(7.1);
    expect(modelProviders.chat).toHaveBeenCalledTimes(2);
    const [, repairMessages] = modelProviders.chat.mock.calls[1] as unknown as [
      ProviderConfigDto,
      Array<{ content: string }>,
      unknown,
    ];
    expect(repairMessages[0].content).toContain("JSON 修复器");
    expect(repairMessages[1].content).toContain("章节评分");
  });

  it("should return mock reference profile when provider is mock", async () => {
    const modelProviders = { chat: jest.fn() };
    const service = createService({ modelProviders });

    const result = await service.inferReferenceProfile({
      provider: { kind: "mock" },
      referenceTitle: "第一章",
      referenceText:
        "主角进入考场，却发现考官正是三年前废掉他经脉的人。众人围观嘲笑，他必须在一炷香内证明自己，否则家族会被剥夺试炼资格。下一刻，考官宣布第一题就是让他亲手毁掉祖传令牌。",
      platform: "fanqie",
      audience: "male-fast-paced",
      readingMode: "mobile-fragmented",
    });

    expect(modelProviders.chat).not.toHaveBeenCalled();
    expect(result).toHaveProperty("mode");
    expect(result.mode).toBe("mock-reference-profile");
  });

  it("should return mock rubric when provider is mock", async () => {
    const modelProviders = { chat: jest.fn() };
    const service = createService({ modelProviders });

    const result = await service.buildRubric({
      provider: { kind: "mock" },
      referenceTitle: "第一章",
      referenceText:
        "主角进入考场，却发现考官正是三年前废掉他经脉的人。众人围观嘲笑，他必须在一炷香内证明自己，否则家族会被剥夺试炼资格。下一刻，考官宣布第一题就是让他亲手毁掉祖传令牌。",
      genre: "xuanhuan",
      platform: "fanqie",
      audience: "male-fast-paced",
      readingMode: "mobile-fragmented",
      category: "玄幻逆袭",
      theme: "被废后反击",
      tags: ["退婚", "考场", "逆袭"],
      explicitKeywords: ["废掉经脉", "考官"],
      implicitExpectations: ["公开羞辱", "反击"],
    });

    expect(modelProviders.chat).not.toHaveBeenCalled();
    expect(result).toHaveProperty("mode");
    expect(result.mode).toBe("mock-rubric");
  });
});
