import { BadRequestException, Injectable } from "@nestjs/common";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import { AskResearchLibraryDto } from "./dto/ask-research-library.dto";
import { CompareResearchBooksDto } from "./dto/compare-research-books.dto";
import { ModelProviderService } from "./model-provider.service";
import { researchQaJsonSchema } from "./analysis-json-schemas";
import { extractJson } from "./json-extract";

interface ResearchBookResult {
  book?: {
    title?: string;
    genre?: string;
    oneSentencePremise?: string;
    coreAppeal?: string[];
  };
  plotlines?: Array<{
    name?: string;
    type?: string;
    reusablePattern?: string;
    payoff?: string;
  }>;
  historyBook?: {
    ancientHistory?: string[];
    recentHistory?: string[];
    publicMyths?: string[];
    hiddenTruths?: string[];
  };
  characters?: unknown[];
  worldbuilding?: {
    worldRules?: string[];
    powerSystem?: string[];
    locations?: unknown[];
    factions?: unknown[];
    itemsAndTerms?: unknown[];
  };
  relationships?: {
    edges?: unknown[];
  };
  chronicle?: unknown[];
  writingSupport?: {
    chapterFunctionTable?: unknown[];
    foreshadowingLedger?: unknown[];
    readerPromiseChecklist?: unknown[];
    emotionalBeatMap?: unknown[];
    pacingCurve?: unknown[];
    conflictMatrix?: unknown[];
  };
  originalizationReport?: {
    riskLevel?: string;
    safeToLearn?: string[];
    mustTransform?: string[];
    rewriteStrategy?: string[];
  };
}

interface ResearchCitation {
  sourceId: string;
  title: string;
  field: string;
  snippet: string;
}

@Injectable()
export class ResearchLibraryService {
  constructor(
    private readonly persistence: AnalysisPersistenceRepository,
    private readonly modelProviders: ModelProviderService,
  ) {}

  async getLibrary(limit = 50) {
    const jobs = await this.persistence.listJobs(limit);
    const succeededJobs = jobs.filter((job) => job.status === "succeeded");
    const graphAssets = succeededJobs
      .filter((job) => job.result)
      .map((job) =>
        this.buildPersistedResearchGraphAsset(
          job.id,
          job.result as ResearchBookResult,
        ),
      );
    const comparisonSamples = succeededJobs
      .filter((job) => job.result)
      .map((job) =>
        this.buildPersistedComparisonSample(
          job.id,
          job.result as ResearchBookResult,
        ),
      );
    const completedBooks = comparisonSamples.length;

    return {
      mode: "persisted-research-library",
      updatedAt: new Date().toISOString(),
      sourceSummary: {
        totalJobs: jobs.length,
        completedBooks,
        runningJobs: jobs.filter((job) => job.status === "running").length,
        failedJobs: jobs.filter((job) => job.status === "failed").length,
        comparisonReadiness:
          completedBooks >= 5
            ? "ready-for-pattern-mining"
            : completedBooks >= 2
              ? "ready-for-basic-compare"
              : "needs-more-samples",
      },
      graphAssets,
      comparisonSamples,
      questionTemplates: [
        "这些样本的开局承诺有什么共同点，哪个点最容易被新手忽略？",
        "它们的爆点组合哪里偏离了常见平均值，哪些可以低风险重组？",
        "我的题材和样本相比，差异化卖点不足在哪里？",
        "第一条写作提示词应该锁定哪些受众、情绪、题材组合和禁区？",
        "新书方向按平台匹配、读者承诺、前三章钩子、差异化和风险成本分别能打几分？",
      ],
      recommendedNextActions:
        completedBooks >= 2
          ? [
              "选择同赛道样本做卖点组合对比。",
              "对比开局承诺、爽点密度、人物关系钩子和差异化风险。",
              "把共同规律和偏离平均值的组合转成第一条写作提示词。",
            ]
          : [
              "先完成至少 2 本整书拆解，形成可对比样本池。",
              "优先上传同赛道成熟样本，不要混合过多题材。",
              "每本书都保留人物、事件、伏笔、情绪节奏和改写边界。",
            ],
    };
  }

  async compareBooks(input: CompareResearchBooksDto) {
    const jobs = await this.getSucceededResearchJobs(input.jobIds);
    if (jobs.length < 2) {
      throw new BadRequestException(
        "At least 2 succeeded book jobs are needed.",
      );
    }

    const samples = jobs.map((job) =>
      this.buildDetailedResearchSample(
        job.id,
        job.result as ResearchBookResult,
      ),
    );
    const commonPatterns = this.buildCommonResearchPatterns(samples);
    const differentiationMap = samples.map((sample) => ({
      jobId: sample.jobId,
      title: sample.title,
      genre: sample.genre,
      uniqueSignals: this.findUniqueSignals(sample, samples),
      reusableStrengths: sample.reusablePatterns.slice(0, 4),
      riskBoundary: sample.riskBoundary,
    }));
    const evidenceMatrix = samples.map((sample) => ({
      jobId: sample.jobId,
      title: sample.title,
      openingPromise: sample.openingPromise,
      appealCombination: sample.appealCombination,
      emotionStrategy: sample.emotionStrategy,
      hookStrategy: sample.hookStrategy,
      sourceCoverage: sample.sourceCoverage,
    }));
    const beginnerTakeaways = [
      commonPatterns[0] || "先让读者明白这本书承诺提供什么情绪回报。",
      "爆款规律要拆成可执行约束：卖点、情绪、信息增量和章末钩子。",
      "差异化不是硬拼设定，而是在同赛道高频期待里找到可记忆的偏离点。",
    ];

    return {
      mode: "multi-book-research-comparison",
      updatedAt: new Date().toISOString(),
      focus: input.focus?.trim() || "爆款规律、差异化机会和第一条写作提示词",
      sampleCount: samples.length,
      samples,
      commonPatterns,
      differentiationMap,
      evidenceMatrix,
      beginnerTakeaways,
      promptSeed:
        input.includePromptSeed === false
          ? undefined
          : this.buildComparisonPromptSeed({
              focus:
                input.focus?.trim() || "从多本已拆解样本中提炼可复用的新书方向",
              commonPatterns,
              differentiationMap,
              evidenceMatrix,
            }),
      limits:
        samples.length < 5
          ? "当前样本少于 5 本，只适合基础对比；归纳赛道规律建议积累 5-10 本同赛道样本。"
          : "当前样本量可用于初步赛道规律归纳，但仍应优先比较同平台、同题材样本。",
    };
  }

  async answerQuestion(input: AskResearchLibraryDto) {
    const jobs = await this.getSucceededResearchJobs(input.jobIds, 6);
    if (!jobs.length) {
      throw new BadRequestException(
        "No succeeded book jobs are available for research Q&A.",
      );
    }

    const citations = this.buildResearchCitations(
      jobs.map((job) => ({
        jobId: job.id,
        result: job.result as ResearchBookResult,
      })),
      input.question,
    );
    if (input.provider.kind !== "mock") {
      const content = await this.modelProviders.chat(
        input.provider,
        [
          {
            role: "system",
            content:
              "你是中文网文研究库问答助手。只能基于提供的资料摘录回答；资料不足时必须说明不足。只返回合法 JSON，不使用 Markdown。",
          },
          {
            role: "user",
            content: this.buildResearchQaPrompt(input, citations),
          },
        ],
        {
          maxOutputTokens: 1800,
          jsonSchema: {
            name: "research_qa_result",
            schema: researchQaJsonSchema,
          },
        },
      );
      try {
        return this.normalizeResearchQaAnswer(
          input,
          citations,
          this.parseJson(content),
        );
      } catch {
        const fallback = this.mockResearchQaAnswer(input, citations);
        return {
          ...fallback,
          answer:
            "模型已返回内容，但结构化 JSON 解析失败。系统已基于当前研究库证据生成兜底回答；你可以稍后重试模型问答。",
          sourceGaps: [
            "本次模型问答输出格式异常，未能可靠读取模型原始结论。",
            ...fallback.sourceGaps,
          ].slice(0, 5),
        };
      }
    }

    return this.mockResearchQaAnswer(input, citations);
  }

  private async getSucceededResearchJobs(
    jobIds?: string[],
    fallbackLimit = 50,
  ) {
    const requestedIds = this.cleanList(jobIds);
    const jobs = await this.persistence.listJobs(
      requestedIds.length ? Math.max(200, requestedIds.length) : fallbackLimit,
    );
    const succeededJobs = jobs.filter(
      (job) => job.status === "succeeded" && job.result,
    );

    if (!requestedIds.length) {
      return succeededJobs.slice(0, fallbackLimit);
    }

    const requestedSet = new Set(requestedIds);
    const selectedJobs = succeededJobs.filter((job) =>
      requestedSet.has(job.id),
    );
    const foundSet = new Set(selectedJobs.map((job) => job.id));
    const missing = requestedIds.filter((jobId) => !foundSet.has(jobId));

    if (missing.length) {
      throw new BadRequestException(
        `These jobs are missing, unfinished, or failed: ${missing.join(", ")}`,
      );
    }

    return selectedJobs;
  }

  private buildDetailedResearchSample(
    jobId: string,
    result: ResearchBookResult,
  ) {
    const support = result.writingSupport || {};
    const coreAppeal = this.cleanList(result.book?.coreAppeal);
    const readerPromises = this.objectStringValues(
      support.readerPromiseChecklist,
      ["promise", "evidence", "nextCheck"],
    );
    const emotionalBeats = this.objectStringValues(support.emotionalBeatMap, [
      "beats",
      "intensity",
      "readerPromise",
    ]);
    const pacingSignals = this.objectStringValues(support.pacingCurve, [
      "informationDensity",
      "conflictIntensity",
      "hookStrength",
      "risk",
    ]);
    const chapterHooks = this.objectStringValues(support.chapterFunctionTable, [
      "function",
      "goal",
      "conflict",
      "hook",
    ]);
    const reusablePatterns = this.objectStringValues(result.plotlines, [
      "reusablePattern",
      "payoff",
      "type",
    ]);
    const originalitySignals = [
      ...this.cleanList(result.originalizationReport?.safeToLearn),
      ...this.cleanList(result.originalizationReport?.rewriteStrategy),
    ];
    const riskBoundary = this.cleanList(
      result.originalizationReport?.mustTransform,
    ).slice(0, 5);

    return {
      jobId,
      title: result.book?.title || "未命名样本",
      genre: result.book?.genre || "unknown",
      openingPromise:
        result.book?.oneSentencePremise ||
        readerPromises[0] ||
        coreAppeal[0] ||
        "未提取到明确开局承诺",
      coreAppeal,
      appealCombination: coreAppeal.slice(0, 4).join(" + ") || "待补卖点组合",
      readerPromises: readerPromises.slice(0, 6),
      emotionStrategy:
        emotionalBeats.slice(0, 4).join("；") || "待补情绪曲线证据",
      hookStrategy:
        [...chapterHooks, ...pacingSignals].slice(0, 4).join("；") ||
        "待补章末钩子证据",
      reusablePatterns: reusablePatterns.slice(0, 6),
      originalitySignals: originalitySignals.slice(0, 6),
      riskBoundary,
      sourceCoverage: [
        result.characters?.length ? "人物" : "",
        result.relationships?.edges?.length ? "关系" : "",
        result.chronicle?.length ? "事件链" : "",
        support.foreshadowingLedger?.length ? "伏笔" : "",
        support.readerPromiseChecklist?.length ? "读者承诺" : "",
        support.emotionalBeatMap?.length ? "情绪曲线" : "",
        support.pacingCurve?.length ? "节奏曲线" : "",
      ].filter(Boolean),
      signalBag: this.normalizeSignals([
        ...coreAppeal,
        ...readerPromises,
        ...emotionalBeats,
        ...chapterHooks,
        ...reusablePatterns,
        ...originalitySignals,
      ]),
    };
  }

  private buildCommonResearchPatterns(
    samples: Array<
      ReturnType<ResearchLibraryService["buildDetailedResearchSample"]>
    >,
  ) {
    const counts = new Map<string, number>();
    for (const sample of samples) {
      for (const signal of new Set(sample.signalBag)) {
        counts.set(signal, (counts.get(signal) || 0) + 1);
      }
    }

    const threshold = Math.max(2, Math.ceil(samples.length * 0.5));
    const shared = [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([signal, count]) => `${signal}（${count}/${samples.length} 本出现）`,
      );

    return shared.length
      ? shared.slice(0, 8)
      : [
          "样本共同点不足，说明题材/平台混杂；建议先选择同赛道样本。",
          "仍可先比较每本书的开局承诺、核心情绪和章末钩子方式。",
        ];
  }

  private findUniqueSignals(
    sample: ReturnType<ResearchLibraryService["buildDetailedResearchSample"]>,
    samples: Array<
      ReturnType<ResearchLibraryService["buildDetailedResearchSample"]>
    >,
  ) {
    const otherSignals = new Set(
      samples
        .filter((item) => item.jobId !== sample.jobId)
        .flatMap((item) => item.signalBag),
    );

    return sample.signalBag
      .filter((signal) => !otherSignals.has(signal))
      .slice(0, 6);
  }

  private buildComparisonPromptSeed(input: {
    focus: string;
    commonPatterns: string[];
    differentiationMap: Array<{
      title: string;
      uniqueSignals: string[];
      reusableStrengths: string[];
      riskBoundary: string[];
    }>;
    evidenceMatrix: Array<{
      title: string;
      openingPromise: string;
      appealCombination: string;
      emotionStrategy: string;
      hookStrategy: string;
    }>;
  }) {
    return `
你是网文选题产品经理。请基于下面的多书拆解结论，帮我设计一个“偏离平均值但仍符合读者期待”的新书方向。

对比目标：${input.focus}

共同规律：
${input.commonPatterns.map((item, index) => `${index + 1}. ${item}`).join("\n")}

样本证据：
${input.evidenceMatrix
  .map(
    (item, index) => `${index + 1}. 《${item.title}》
- 开局承诺：${item.openingPromise}
- 卖点组合：${item.appealCombination}
- 情绪策略：${item.emotionStrategy}
- 钩子策略：${item.hookStrategy}`,
  )
  .join("\n\n")}

差异化素材：
${input.differentiationMap
  .map(
    (item) =>
      `《${item.title}》独有信号：${item.uniqueSignals.join("、") || "暂无"}；可学结构：${item.reusableStrengths.join("、") || "暂无"}；必须避开的可识别元素：${item.riskBoundary.join("、") || "暂无"}`,
  )
  .join("\n")}

请输出：
1. 3 个可写的新书方向，每个都说明目标读者、卖点组合、情绪主轴、差异化点。
2. 给每个方向做 1-5 分选题评分：平台匹配、读者承诺、前三章钩子、差异化、风险成本；总分低于18分的方向只建议试写或回炉。
3. 最推荐的 1 个方向，并说明为什么它偏离平均值但仍符合读者期待。
4. 第一条给写作 AI 的提示词，必须包含受众、题材、主角、开局承诺、前三章目标、爽点轮换、钩子回收和禁区。
`.trim();
  }

  private buildResearchCitations(
    sources: Array<{ jobId: string; result: ResearchBookResult }>,
    question: string,
  ): ResearchCitation[] {
    const queryTokens = this.normalizeSignals([question]);
    const citations = sources.flatMap(({ jobId, result }) =>
      this.buildBookCitations(jobId, result),
    );
    const scored = citations
      .map((citation) => ({
        citation,
        score: this.normalizeSignals([citation.snippet, citation.field]).filter(
          (token) => queryTokens.includes(token),
        ).length,
      }))
      .sort((a, b) => b.score - a.score);
    const matched = scored
      .filter((item) => item.score > 0)
      .map((item) => item.citation);

    return (matched.length ? matched : citations).slice(0, 18);
  }

  private buildBookCitations(
    jobId: string,
    result: ResearchBookResult,
  ): ResearchCitation[] {
    const title = result.book?.title || "未命名样本";
    const citations: ResearchCitation[] = [];
    const push = (field: string, values: unknown) => {
      for (const snippet of this.flattenStrings(values).slice(0, 6)) {
        citations.push({
          sourceId: jobId,
          title,
          field,
          snippet: this.truncateText(snippet, 180),
        });
      }
    };

    push("一句话承诺", result.book?.oneSentencePremise);
    push("核心卖点", result.book?.coreAppeal);
    push("剧情线", result.plotlines);
    push("事件链", result.chronicle);
    push("读者承诺", result.writingSupport?.readerPromiseChecklist);
    push("情绪曲线", result.writingSupport?.emotionalBeatMap);
    push("节奏曲线", result.writingSupport?.pacingCurve);
    push("伏笔回收", result.writingSupport?.foreshadowingLedger);
    push("人物", result.characters);
    push("关系", result.relationships?.edges);
    push("世界设定", result.worldbuilding);
    push("可学习结构", result.originalizationReport?.safeToLearn);
    push("原创化边界", result.originalizationReport?.mustTransform);
    push("重写策略", result.originalizationReport?.rewriteStrategy);

    return citations;
  }

  private buildResearchQaPrompt(
    input: AskResearchLibraryDto,
    citations: ResearchCitation[],
  ) {
    return `
问题：${input.question}
回答模式：${input.answerMode || "beginner"}

资料摘录：
${citations
  .map(
    (citation, index) =>
      `${index + 1}. [${citation.sourceId}｜${citation.title}｜${citation.field}] ${citation.snippet}`,
  )
  .join("\n")}

要求：
1. 只能基于资料摘录回答，不能补外部知识。
2. 结论要适合 AI 写作新手理解，先讲“为什么”，再讲“怎么变成提示词约束”。
3. 每条结论都要引用 sourceId 和 field。
4. 如果资料不足，明确列出缺口。

返回 JSON：
{
  "answer": "直接回答问题",
  "keyFindings": [
    {"claim": "结论", "sourceIds": ["job id"], "promptUse": "如何转成提示词约束"}
  ],
  "sourceGaps": ["资料不足点"],
  "nextQuestions": ["下一步更好的问题"]
}
`.trim();
  }

  private normalizeResearchQaAnswer(
    input: AskResearchLibraryDto,
    citations: ResearchCitation[],
    value: unknown,
  ) {
    const source = (value || {}) as Record<string, any>;
    return {
      mode: "research-library-qa",
      answerMode: input.answerMode || "beginner",
      question: input.question,
      answer:
        typeof source.answer === "string"
          ? source.answer
          : "资料库已返回，但模型没有给出可用回答。",
      keyFindings: Array.isArray(source.keyFindings)
        ? source.keyFindings.slice(0, 6)
        : [],
      sourceGaps: this.cleanList(source.sourceGaps).slice(0, 5),
      nextQuestions: this.cleanList(source.nextQuestions).slice(0, 4),
      citations,
    };
  }

  private mockResearchQaAnswer(
    input: AskResearchLibraryDto,
    citations: ResearchCitation[],
  ) {
    const groupedTitles = [...new Set(citations.map((item) => item.title))];
    const topCitations = citations.slice(0, 6);
    const findings = topCitations.slice(0, 3).map((citation) => ({
      claim: `《${citation.title}》在“${citation.field}”里提供了可学习信号：${citation.snippet}`,
      sourceIds: [citation.sourceId],
      promptUse: `把“${citation.field}”改写成第一条提示词里的硬约束，要求 AI 在前三章明确呈现。`,
    }));

    return {
      mode: "research-library-qa",
      answerMode: input.answerMode || "beginner",
      question: input.question,
      answer: citations.length
        ? `基于 ${groupedTitles.length} 本已拆解样本，当前最可靠的回答是：先抓住资料中反复出现的卖点、情绪和钩子证据，再把它们压缩成写作提示词约束。不要让 AI 泛泛写“爽文”，要指定开局承诺、读者情绪、前三章信息增量和禁用的可识别元素。`
        : "当前没有足够资料回答这个问题，请先完成至少一本整书拆解。",
      keyFindings: findings,
      sourceGaps:
        citations.length < 6
          ? ["资料摘录数量偏少，回答只能作为初步判断。"]
          : [],
      nextQuestions: [
        "这些样本共同的开局承诺是什么？",
        "哪一个卖点组合最容易被新手误解成套路堆砌？",
        "如果我要写同赛道新书，前三章应该避免什么？",
      ],
      citations,
    };
  }

  private buildPersistedResearchGraphAsset(
    jobId: string,
    result: ResearchBookResult,
  ) {
    const characterCount = result.characters?.length || 0;
    const locationCount = result.worldbuilding?.locations?.length || 0;
    const factionCount = result.worldbuilding?.factions?.length || 0;
    const eventCount = result.chronicle?.length || 0;
    const foreshadowingCount =
      result.writingSupport?.foreshadowingLedger?.length || 0;
    const promiseCount =
      result.writingSupport?.readerPromiseChecklist?.length || 0;
    const edgeCount = result.relationships?.edges?.length || 0;
    const nodeCount =
      characterCount +
      locationCount +
      factionCount +
      eventCount +
      foreshadowingCount +
      promiseCount;

    return {
      jobId,
      title: result.book?.title || "未命名样本",
      genre: result.book?.genre || "unknown",
      nodeCount,
      edgeCount,
      nodeBreakdown: {
        characters: characterCount,
        locations: locationCount,
        factions: factionCount,
        events: eventCount,
        foreshadowing: foreshadowingCount,
        readerPromises: promiseCount,
      },
      sourceCoverage: [
        characterCount ? "人物" : "",
        edgeCount ? "关系" : "",
        eventCount ? "事件链" : "",
        foreshadowingCount ? "伏笔" : "",
        promiseCount ? "读者承诺" : "",
      ].filter(Boolean),
      riskLevel: result.originalizationReport?.riskLevel || "unknown",
    };
  }

  private buildPersistedComparisonSample(
    jobId: string,
    result: ResearchBookResult,
  ) {
    const support = result.writingSupport;
    return {
      jobId,
      title: result.book?.title || "未命名样本",
      genre: result.book?.genre || "unknown",
      coreAppeal: this.cleanList(result.book?.coreAppeal),
      availableSignals: [
        result.characters?.length ? "人物卖点" : "",
        result.relationships?.edges?.length ? "关系钩子" : "",
        result.chronicle?.length ? "事件链" : "",
        support?.emotionalBeatMap?.length ? "情绪曲线" : "",
        support?.pacingCurve?.length ? "节奏曲线" : "",
        support?.foreshadowingLedger?.length ? "伏笔回收" : "",
      ].filter(Boolean),
      compareUse:
        support?.emotionalBeatMap?.length && support?.pacingCurve?.length
          ? "适合比较情绪节奏和追读结构"
          : "适合做基础卖点和结构对比",
    };
  }

  private parseJson(content: string) {
    return extractJson(content);
  }

  private objectStringValues(values: unknown, preferredKeys: string[]) {
    return this.flattenStrings(values, preferredKeys).slice(0, 12);
  }

  private flattenStrings(values: unknown, preferredKeys?: string[]): string[] {
    if (values === undefined || values === null) {
      return [];
    }
    if (typeof values === "string") {
      return values.trim() ? [values.trim()] : [];
    }
    if (typeof values === "number" || typeof values === "boolean") {
      return [String(values)];
    }
    if (Array.isArray(values)) {
      return values.flatMap((item) => this.flattenStrings(item, preferredKeys));
    }
    if (typeof values === "object") {
      const record = values as Record<string, unknown>;
      const keys = preferredKeys?.length ? preferredKeys : Object.keys(record);
      return keys.flatMap((key) =>
        this.flattenStrings(record[key], preferredKeys),
      );
    }

    return [];
  }

  private cleanList(value?: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return [
      ...new Set(
        value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }

  private normalizeSignals(values: string[]) {
    const stopWords = new Set([
      "一个",
      "一种",
      "以及",
      "通过",
      "没有",
      "当前",
      "读者",
      "主角",
      "章节",
      "故事",
      "情绪",
    ]);
    const tokens = values.flatMap((value) =>
      value
        .replace(/[，。！？；：、“”‘’（）()[\]{}<>《》|/\\]/g, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 18)
        .filter((item) => !stopWords.has(item)),
    );

    return [...new Set(tokens)].slice(0, 80);
  }

  private truncateText(value: string, maxLength: number) {
    return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
  }
}
