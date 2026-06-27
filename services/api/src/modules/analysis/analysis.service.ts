import { Injectable } from "@nestjs/common";
import type {
  DiagnosisIssue,
  DiagnosisIssueCategory,
  DiagnosisIssueSeverity,
  GateDecision,
  MethodologyCard,
  QuickReviewResult,
  QuickReviewInputKind,
  RecommendedPlatform,
  RecommendedPlatformId,
  RubricMetric,
} from "@ai-novel-diagnosis/ai-core";
import {
  buildChapterScorePrompt,
  buildChapterTriagePrompt,
  createPreviewReport,
  DEFAULT_RUBRIC_METRICS,
} from "@ai-novel-diagnosis/ai-core";
import { ProviderConfigDto } from "@/modules/ai-provider/dto/provider-config.dto";
import { parseJsonWithRepair } from "@/modules/ai-provider/json-repair";
import { ModelProviderService } from "@/modules/ai-provider/model-provider.service";
import { BuildRubricDto } from "./dto/build-rubric.dto";
import { InferReferenceProfileDto } from "./dto/infer-reference-profile.dto";
import { PreviewAnalysisDto } from "./dto/preview-analysis.dto";
import { QuickReviewDto } from "./dto/quick-review.dto";
import { ScoreChapterDto } from "./dto/score-chapter.dto";
import {
  quickReviewJsonSchema,
  referenceProfileJsonSchema,
  rubricJsonSchema,
  scoreJsonSchema,
} from "./analysis-json-schemas";
import { asText, asTextList, clampNumber } from "./shared/coercion";

const baseRubricMetrics = [
  {
    id: "chapter-goal",
    name: "主角目标清晰度",
    description: "读者是否能快速知道主角这一章想得到什么或避免什么。",
    scale: {
      low: "0-3：主角只是被事件推着走，目标不清。",
      medium: "4-6：目标存在，但压力和结果不够具体。",
      high: "7-10：目标、代价、完成标志都很明确。",
    },
  },
  {
    id: "conflict-pressure",
    name: "冲突压力",
    description: "阻碍是否具体，是否会造成损失、羞辱、危机或机会流失。",
    scale: {
      low: "0-3：只有态度冲突，没有实际后果。",
      medium: "4-6：有阻碍，但压迫对象或损失不够尖锐。",
      high: "7-10：阻碍具体且会逼迫主角立刻行动。",
    },
  },
  {
    id: "emotion-debt",
    name: "情绪债",
    description: "章节是否让读者积累愤怒、期待、心疼、好奇等待兑现情绪。",
    scale: {
      low: "0-3：读者没有明显情绪等待释放。",
      medium: "4-6：有情绪，但铺垫或延迟不足。",
      high: "7-10：情绪债清晰，读者期待主角反击或真相揭开。",
    },
  },
  {
    id: "payoff",
    name: "爽点/期待兑现",
    description: "前文制造的期待是否得到阶段性兑现，并带来情绪释放。",
    scale: {
      low: "0-3：没有兑现，或兑现和铺垫无关。",
      medium: "4-6：有释放，但力度、时机或结果偏弱。",
      high: "7-10：兑现清楚，读者能获得明确情绪回报。",
    },
  },
  {
    id: "information-gain",
    name: "信息增量",
    description: "本章是否新增了会改变局势、人物关系或读者判断的信息。",
    scale: {
      low: "0-3：重复已知信息，删掉也不影响故事。",
      medium: "4-6：有新信息，但和主线压力连接不紧。",
      high: "7-10：新信息直接改变期待或冲突等级。",
    },
  },
  {
    id: "pacing-density",
    name: "节奏密度",
    description: "段落是否持续承担推进、情绪、信息或铺垫功能。",
    scale: {
      low: "0-3：大量段落只在解释或空转。",
      medium: "4-6：核心情节可读，但铺垫和重复偏多。",
      high: "7-10：段落功能清晰，几乎没有无效停顿。",
    },
  },
  {
    id: "opening-promise",
    name: "开局承诺强度",
    description: "开头是否快速交代主角处境、核心矛盾、失败代价和继续读的理由。",
    scale: {
      low: "0-3：开头只铺背景或寒暄，读者不知道为什么要继续看。",
      medium: "4-6：有冲突或卖点，但目标、代价、期待不够早或不够清楚。",
      high: "7-10：前段就给出强冲突、明确代价和可追读的问题。",
    },
  },
  {
    id: "pleasure-structure",
    name: "爽点结构完整度",
    description: "爽点是否完成压制、蓄力、反击、兑现和余波，而不是只写结果。",
    scale: {
      low: "0-3：直接给主角胜利或奖励，缺少前置压迫和情绪释放。",
      medium: "4-6：有爽点，但对手压力、反击收益或余波推动不足。",
      high: "7-10：压迫具体、反击成立、兑现有力度，余波能推动下一章。",
    },
  },
  {
    id: "hook-rotation",
    name: "钩子轮换与回收",
    description:
      "章节钩子是否轮换悬念、危机、反转、期待、情感或信息揭示，并在后续有回收可能。",
    scale: {
      low: "0-3：自然收尾或重复同一种断章，下一章没有清楚承接点。",
      medium: "4-6：有钩子，但类型单一、强度一般或回收承诺不清。",
      high: "7-10：钩子类型明确，强度匹配章节位置，并给下一章前段留下回收点。",
    },
  },
  {
    id: "prose-naturalness",
    name: "文本自然度",
    description: "语言是否避免模板化升华、空泛排比、同质句式和旁观者讲解腔。",
    scale: {
      low: "0-3：大量空泛判断、模板句、同质化表达，角色和场景缺少专属细节。",
      medium: "4-6：整体可读，但局部有机械总结、情绪标签或说明腔。",
      high: "7-10：表达贴合角色和场景，句式有变化，细节具体且不油腻。",
    },
  },
  {
    id: "character-drive",
    name: "人物驱动力",
    description: "主角行动是否来自明确欲望、恐惧、承诺或价值判断。",
    scale: {
      low: "0-3：主角像工具人，行动动机薄弱。",
      medium: "4-6：动机存在，但和本章选择连接不够强。",
      high: "7-10：主角选择稳定地展示性格和长期欲望。",
    },
  },
  {
    id: "platform-fit",
    name: "平台节奏匹配度",
    description: "章节节奏、信息直给程度和情绪反馈是否符合目标平台读者习惯。",
    scale: {
      low: "0-3：写法明显偏离目标平台，读者进入成本高。",
      medium: "4-6：大方向匹配，但节奏或表达不够贴平台。",
      high: "7-10：节奏、表达、卡点都贴合目标平台阅读习惯。",
    },
  },
  {
    id: "audience-fit",
    name: "目标读者匹配度",
    description: "人物标签、情绪类型、冲突形态是否满足目标读者的主要期待。",
    scale: {
      low: "0-3：读者画像和章节卖点错位。",
      medium: "4-6：有匹配点，但核心情绪或卖点不够集中。",
      high: "7-10：章节明确服务目标读者的高频期待。",
    },
  },
  {
    id: "category-fit",
    name: "分类期待匹配度",
    description: "章节是否符合细分分类读者默认期待，而不是只停留在大题材层面。",
    scale: {
      low: "0-3：分类卖点缺席，读者点进来会觉得货不对板。",
      medium: "4-6：有分类元素，但出现太晚或没有形成期待。",
      high: "7-10：分类核心期待清楚出现并参与推进冲突。",
    },
  },
  {
    id: "theme-promise",
    name: "主题承诺清晰度",
    description:
      "章节是否让读者明确感到主题承诺，比如逆袭、救赎、追妻或悬疑解谜。",
    scale: {
      low: "0-3：主题模糊，读者不知道该期待什么情绪回报。",
      medium: "4-6：主题存在，但表达不够集中。",
      high: "7-10：主题承诺明确，并和主角目标/冲突绑定。",
    },
  },
  {
    id: "keyword-hit",
    name: "关键词与标签命中度",
    description: "显性关键词和隐性期待是否自然进入章节，不是机械堆词。",
    scale: {
      low: "0-3：关键词缺席或堆砌，隐性期待没有对应结构。",
      medium: "4-6：部分命中，但与剧情推进连接弱。",
      high: "7-10：关键词自然出现，隐性期待转化为冲突和钩子。",
    },
  },
  {
    id: "selling-point-frontload",
    name: "卖点前置程度",
    description: "分类、主题、能力、人设或关系卖点是否足够早地出现。",
    scale: {
      low: "0-3：开头看不出卖点，读者需要等太久。",
      medium: "4-6：卖点有暗示，但不够清楚或不够早。",
      high: "7-10：卖点在前段清楚可感，能支撑点击后的继续阅读。",
    },
  },
  {
    id: "hook",
    name: "追读钩子",
    description: "结尾是否留下下一章不可延迟的危机、奖励、秘密或反转。",
    scale: {
      low: "0-3：自然收尾，没有新期待。",
      medium: "4-6：留下问题，但不够紧迫。",
      high: "7-10：结尾制造明确升级，读者想立刻进入下一章。",
    },
  },
];

const platformProfiles: Record<string, Record<string, string>> = {
  qidian: {
    pace: "中高节奏，允许一定设定铺垫",
    emotion: "目标感、成长感、长期期待并重",
    hookDensity: "章节末要有清楚升级或新问题",
    language: "信息清楚，设定和行动逻辑要站得住",
    setupTolerance: "中等",
    pleasureDensity: "小爽点约1500字一个，大爽点约5000字一个，重逻辑支撑",
    dataPriority: "首章完读、收藏/书架、下一章点击、前三章留存、追更",
  },
  fanqie: {
    pace: "快节奏",
    emotion: "直给、强反馈、低理解成本",
    hookDensity: "高",
    language: "白话、短句、情绪明确",
    setupTolerance: "低",
    pleasureDensity: "高密度爽点，约800字一个小释放，类型要轮换",
    dataPriority: "点击、有效阅读、30秒阅读、触底/完读、加书架、追更",
  },
  jinjiang: {
    pace: "中节奏，重人物关系推进",
    emotion: "细腻情绪、关系张力、人物选择",
    hookDensity: "中高，偏关系变化和情感悬念",
    language: "情绪辨识度和人物声音要强",
    setupTolerance: "中等",
    pleasureDensity: "以关系推进和情感兑现为主，不宜连续硬打脸",
    dataPriority: "收藏、评论反馈、首章完读、关系钩子、追更",
  },
  qimao: {
    pace: "快节奏",
    emotion: "强冲突、强爽点、强反转",
    hookDensity: "高",
    language: "直白、场景转换快",
    setupTolerance: "低",
    pleasureDensity: "高频传统爽点，需用代价和反转避免疲劳",
    dataPriority: "点击、有效阅读、完读/触底、加书架、追更",
  },
  "wechat-short": {
    pace: "极快节奏",
    emotion: "强刺激、强反转、强付费卡点",
    hookDensity: "极高",
    language: "极低理解成本，开头必须迅速进入冲突",
    setupTolerance: "极低",
    pleasureDensity: "约500字一个小刺激点，付费点前必须堆足情绪债",
    dataPriority: "点击、全文完读、平均阅读进度、付费解锁",
  },
  other: {
    pace: "按题材和目标读者调整",
    emotion: "按目标读者期待调整",
    hookDensity: "中等",
    language: "清楚优先",
    setupTolerance: "中等",
    pleasureDensity: "按题材、平台和读者反馈校准",
    dataPriority: "先收集点击、完读、收藏/加书架和追读数据",
  },
};

const labelMaps = {
  platform: {
    qidian: "起点",
    fanqie: "番茄",
    jinjiang: "晋江",
    qimao: "七猫",
    "wechat-short": "微信短篇/小程序文",
    other: "其他平台",
  },
  audience: {
    "male-fast-paced": "男频快节奏爽文读者",
    "female-emotional": "女频情绪流读者",
    "setting-heavy": "设定党/世界观读者",
    "light-reader": "快节奏小白文读者",
    "suspense-brainstorm": "悬疑脑洞读者",
    other: "其他读者",
  },
  readingMode: {
    "long-serialization": "长篇追更",
    "mobile-fragmented": "移动端碎片阅读",
    "short-paid": "短篇付费",
    other: "其他场景",
  },
};

const recommendedPlatformLabels: Record<RecommendedPlatformId, string> = {
  qidian: "起点中文网",
  fanqie: "番茄小说",
  jinjiang: "晋江文学城",
  qimao: "七猫小说",
  "wechat-short": "微信短篇/小程序文",
  other: "其他平台",
};

@Injectable()
export class AnalysisService {
  constructor(private readonly modelProviders: ModelProviderService) {}

  previewScore(input: PreviewAnalysisDto) {
    const report = createPreviewReport(input);
    const metricNames = new Map(
      DEFAULT_RUBRIC_METRICS.map((metric) => [metric.id, metric.name]),
    );

    return {
      productName: "AI网文诊断台",
      mode: "statistical-preview",
      title: input.title,
      rubricId: input.rubricId,
      totalScore: report.totalScore,
      strongestPoint: report.strongestPoint,
      weakestPoint: report.weakestPoint,
      nextRevisionMove: report.nextRevisionMove,
      scores: report.scores.map((score) => ({
        ...score,
        name: metricNames.get(score.metricId) || score.metricId,
      })),
    };
  }

  async quickReview(input: QuickReviewDto) {
    const provider = this.resolveQuickReviewProvider(input.provider);
    if (provider.kind === "mock") {
      return this.mockQuickReview(input);
    }

    const textSample =
      input.chapterText.trim().length <= 7000
        ? input.chapterText.trim()
        : `${input.chapterText.trim().slice(0, 5200)}\n\n……中间内容省略……\n\n${input.chapterText.trim().slice(-1600)}`;

    const prompt = this.buildQuickReviewPrompt(input, textSample);
    const content = await this.modelProviders.chat(provider, prompt.messages, {
      maxOutputTokens: 2200,
      jsonSchema: {
        name: "quick_review_result",
        schema: quickReviewJsonSchema,
      },
    });

    return this.normalizeQuickReviewResult(
      await parseJsonWithRepair(this.modelProviders, provider, content, "章节急诊"),
      input,
    );
  }

  private buildQuickReviewPrompt(input: QuickReviewDto, textSample: string) {
    const prompt = buildChapterTriagePrompt({
      title: input.title || "未命名章节",
      text: textSample,
      rubricId: "quick-review",
    });

    return {
      ...prompt,
      messages: [
        {
          ...prompt.messages[0],
          content: `${prompt.messages[0].content}
你只返回合法 JSON，不使用 Markdown，不解释过程。`,
        },
        {
          ...prompt.messages[1],
          content: `${prompt.messages[1].content}

类型提示：${input.genre || "请自行判断"}
输入来源：${this.normalizeQuickReviewInputKind(input.inputKind)}
上一条 Prompt：${input.previousPrompt?.trim() || "未提供"}

严格返回这个 JSON 结构：
{
  "title": "章节标题（如正文有标题则用正文的）",
  "genre": "xuanhuan | urban | romance | suspense | infinite-flow | other",
  "inputKind": "human-draft | ai-draft | idea | outline | prompt",
  "positioning": "一句话定位这章在市场上的位置",
  "sellingPoints": ["本章 2-3 个主要卖点"],
  "mainProblem": "本章最大的一个问题，不超过 50 字",
  "actionableFixes": ["3 条可执行的改稿建议，每条不超过 40 字"],
  "recommendedPlatforms": [
    {
      "id": "fanqie",
      "label": "番茄小说",
      "fit": "优先发布",
      "reason": "一句话说明为什么适合这个平台"
    }
  ],
  "readyForFullReview": true或false,
  "readyReason": "是否适合做完整评分的一句话理由",
  "quickScore": 6.5,
  "confidence": 0.8,
  "gateDecision": "continue | revise | rebuild | discard",
  "gateReason": "为什么当前建议继续、修改、重构或废稿",
  "oneLineDiagnosis": "一句话说明这稿最该先解决什么",
  "issues": [
    {
      "id": "issue-1",
      "severity": "critical | high | medium | low",
      "category": "opening | hook | character_goal | conflict_pressure | payoff | pacing | setting_load | prose_ai_flavor | prompt_constraint | market_promise | other",
      "title": "问题标题",
      "description": "问题说明",
      "evidence": [{"quote": "原文短证据", "locationHint": "开头/中段/结尾/第N段", "confidence": 0.8}],
      "readerImpact": "读者会如何流失或降低期待",
      "fixAction": "下一步具体改法",
      "promptConstraint": "下一轮改稿 Prompt 必须加入的约束",
      "blocksNextStep": true
    }
  ],
  "strengths": [{"title": "可保留优点", "evidence": "可选证据", "keepAction": "下一版如何保留"}],
  "revisionPlan": {
    "priorityIssueIds": ["issue-1"],
    "keep": ["必须保留的内容"],
    "change": ["必须修改的内容"],
    "avoid": ["下一版不要做什么"],
    "checkpoints": ["复诊时检查什么"]
  },
  "promptDiagnosis": {
    "originalPrompt": "如果用户提供则原样摘要，否则空字符串",
    "missingConstraints": ["上一条 Prompt 缺了什么约束"],
    "vagueInstructions": ["哪些指令太泛"],
    "improvedPromptPrinciples": ["下一条 Prompt 应该遵守的原则"]
  },
  "nextPrompt": {
    "title": "下一轮改稿 Prompt",
    "prompt": "可直接复制给写作 AI 的改稿 Prompt",
    "linkedIssueIds": ["issue-1"],
    "whyThisWorks": ["这条 Prompt 如何对应解决问题"]
  },
  "methodologyCards": [
    {
      "id": "method-1",
      "sourceIssueId": "issue-1",
      "type": "opening_rule | prompt_rule | pacing_rule | hook_rule | payoff_rule | anti_pattern",
      "title": "可复用方法论标题",
      "triggerProblem": "什么问题触发这条规则",
      "reusableRule": "下次可复用的规则",
      "selfCheckQuestion": "作者自查问题",
      "promptTemplate": "可复用 Prompt 模板"
    }
  ]
}

要求：
1. genre 只能选 xuanhuan、urban、romance、suspense、infinite-flow、other 之一。
2. quickScore 是 0-10 分，代表网文追读吸引力的快速估分。
3. actionableFixes 必须是具体可执行的改法，不要空洞建议。
4. recommendedPlatforms 返回 1-3 个中文网文平台，优先从 qidian、fanqie、jinjiang、qimao、wechat-short 中选择。
5. fit 只能写“优先发布”“可作为第二选择”或“更适合短篇测试”之一。
6. confidence 是 0 到 1 的数字，文本太短时降低。
7. issues 返回 1-3 条，必须有原文证据；没有证据时降低 confidence。
8. gateDecision 只表示当前稿件改稿优先级，不预测平台流量。
9. 如果提供上一条 Prompt，promptDiagnosis 必须指出 Prompt 缺口；未提供则返回空数组。
10. nextPrompt 必须能直接复制给写作 AI，用于改这一版稿，不要另起炉灶。`,
        },
      ],
    };
  }

  private normalizeQuickReviewResult(
    result: unknown,
    input: QuickReviewDto,
  ): QuickReviewResult {
    const source =
      result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : {};
    const requestedGenre = this.normalizeQuickReviewGenre(input.genre);
    const genre =
      this.normalizeQuickReviewGenre(source.genre) || requestedGenre || "other";
    const inputKind = this.normalizeQuickReviewInputKind(
      source.inputKind || input.inputKind,
    );
    const mainProblem =
      asText(source.mainProblem) ||
      "模型没有返回明确问题，请重试或进入完整点评。";
    const actionableFixes = asTextList(source.actionableFixes).slice(0, 4);
    const issues = this.normalizeDiagnosisIssues(source.issues, {
      mainProblem,
      actionableFixes,
      confidence: clampNumber(source.confidence, 0, 1, 0.5),
      text: input.chapterText,
    });
    const gateDecision = this.normalizeGateDecision(
      source.gateDecision,
      issues,
    );
    const nextPrompt = this.normalizeNextPrompt(source.nextPrompt, {
      positioning: asText(source.positioning),
      sellingPoints: asTextList(source.sellingPoints),
      mainProblem,
      actionableFixes,
      issues,
      previousPrompt: input.previousPrompt,
    });
    const methodologyCards = this.normalizeMethodologyCards(
      source.methodologyCards,
      issues,
      nextPrompt.prompt,
    );

    return {
      title: asText(source.title) || input.title || "未命名章节",
      genre,
      inputKind,
      positioning:
        asText(source.positioning) ||
        "模型没有返回明确定位，请重试或进入完整点评。",
      sellingPoints: asTextList(source.sellingPoints).slice(0, 4),
      mainProblem,
      actionableFixes,
      recommendedPlatforms: this.normalizeRecommendedPlatforms(
        source.recommendedPlatforms,
        genre,
        input.chapterText.trim().length,
      ),
      readyForFullReview:
        typeof source.readyForFullReview === "boolean"
          ? source.readyForFullReview
          : input.chapterText.trim().length >= 300,
      readyReason:
        asText(source.readyReason) ||
        "如果结果不完整，建议重试一次或进入完整评分。",
      quickScore: clampNumber(source.quickScore, 0, 10, 0),
      confidence: clampNumber(source.confidence, 0, 1, 0.5),
      gateDecision,
      gateReason:
        asText(source.gateReason) ||
        this.buildGateReason(gateDecision, issues),
      oneLineDiagnosis:
        asText(source.oneLineDiagnosis) ||
        `这稿最该先解决：${mainProblem}`,
      issues,
      strengths: this.normalizeStrengths(source.strengths),
      revisionPlan: this.normalizeRevisionPlan(source.revisionPlan, issues),
      promptDiagnosis: this.normalizePromptDiagnosis(
        source.promptDiagnosis,
        input.previousPrompt,
      ),
      nextPrompt,
      methodologyCards,
    };
  }

  private normalizeQuickReviewInputKind(value: unknown): QuickReviewInputKind {
    const inputKind = asText(value).toLowerCase();
    if (
      ["human-draft", "ai-draft", "idea", "outline", "prompt"].includes(
        inputKind,
      )
    ) {
      return inputKind as QuickReviewInputKind;
    }

    return "human-draft";
  }

  private normalizeQuickReviewGenre(value: unknown) {
    const genre = asText(value).toLowerCase();
    if (
      [
        "xuanhuan",
        "urban",
        "romance",
        "suspense",
        "infinite-flow",
        "other",
      ].includes(genre)
    ) {
      return genre;
    }
    if (genre === "xuanhua" || genre === "fantasy") return "xuanhuan";
    return "";
  }

  private normalizeDiagnosisIssues(
    value: unknown,
    fallback: {
      mainProblem: string;
      actionableFixes: string[];
      confidence: number;
      text: string;
    },
  ): DiagnosisIssue[] {
    const issues = Array.isArray(value)
      ? value
          .map((item, index) => this.normalizeDiagnosisIssue(item, index))
          .filter((item): item is DiagnosisIssue => item !== null)
          .slice(0, 3)
      : [];

    if (issues.length > 0) {
      return issues;
    }

    const quote = this.pickEvidenceQuote(fallback.text);
    return [
      {
        id: "issue-1",
        severity: "high",
        category: "other",
        title: fallback.mainProblem,
        description: fallback.mainProblem,
        evidence: quote
          ? [
              {
                quote,
                locationHint: "正文片段",
                confidence: fallback.confidence,
              },
            ]
          : [],
        readerImpact:
          "读者还没有获得足够明确的继续阅读理由，可能会在开头或中段流失。",
        fixAction:
          fallback.actionableFixes[0] ||
          "先补清主角目标、失败代价、阻碍和章末钩子。",
        promptConstraint:
          fallback.actionableFixes[0] ||
          "改写时优先解决最大追读问题，不要只做文笔润色。",
        blocksNextStep: true,
      },
    ];
  }

  private normalizeDiagnosisIssue(
    value: unknown,
    index: number,
  ): DiagnosisIssue | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const source = value as Record<string, unknown>;
    const title = asText(source.title) || asText(source.description);
    if (!title) {
      return null;
    }

    return {
      id: asText(source.id) || `issue-${index + 1}`,
      severity: this.normalizeIssueSeverity(source.severity),
      category: this.normalizeIssueCategory(source.category),
      title,
      description: asText(source.description) || title,
      evidence: this.normalizeEvidenceAnchors(source.evidence),
      readerImpact:
        asText(source.readerImpact) ||
        "读者可能无法形成明确期待，继续阅读动力会下降。",
      fixAction:
        asText(source.fixAction) ||
        "先围绕这个问题做局部改写，不要整章重写。",
      promptConstraint:
        asText(source.promptConstraint) ||
        "下一轮 Prompt 必须明确要求解决这个问题。",
      blocksNextStep:
        typeof source.blocksNextStep === "boolean"
          ? source.blocksNextStep
          : this.normalizeIssueSeverity(source.severity) === "critical",
    };
  }

  private normalizeIssueSeverity(value: unknown): DiagnosisIssueSeverity {
    const severity = asText(value).toLowerCase();
    if (["critical", "high", "medium", "low"].includes(severity)) {
      return severity as DiagnosisIssueSeverity;
    }
    return "medium";
  }

  private normalizeIssueCategory(value: unknown): DiagnosisIssueCategory {
    const category = asText(value).toLowerCase();
    const allowed: DiagnosisIssueCategory[] = [
      "opening",
      "hook",
      "character_goal",
      "conflict_pressure",
      "payoff",
      "pacing",
      "setting_load",
      "prose_ai_flavor",
      "prompt_constraint",
      "market_promise",
      "other",
    ];
    return allowed.includes(category as DiagnosisIssueCategory)
      ? (category as DiagnosisIssueCategory)
      : "other";
  }

  private normalizeEvidenceAnchors(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const source = item as Record<string, unknown>;
        const quote = asText(source.quote);
        if (!quote) return null;
        return {
          quote: quote.slice(0, 180),
          locationHint: asText(source.locationHint) || "正文片段",
          confidence: clampNumber(source.confidence, 0, 1, 0.5),
        };
      })
      .filter(
        (
          item,
        ): item is {
          quote: string;
          locationHint: string;
          confidence: number;
        } => item !== null,
      )
      .slice(0, 3);
  }

  private pickEvidenceQuote(text: string) {
    return text.trim().replace(/\s+/g, " ").slice(0, 120);
  }

  private normalizeGateDecision(
    value: unknown,
    issues: DiagnosisIssue[],
  ): GateDecision {
    const gate = asText(value).toLowerCase();
    if (["continue", "revise", "rebuild", "discard"].includes(gate)) {
      return gate as GateDecision;
    }

    if (issues.some((issue) => issue.severity === "critical")) {
      return "rebuild";
    }
    if (issues.some((issue) => issue.severity === "high")) {
      return "revise";
    }
    return "continue";
  }

  private buildGateReason(gate: GateDecision, issues: DiagnosisIssue[]) {
    const topIssue = issues[0]?.title || "最大追读问题";
    const reasonMap: Record<GateDecision, string> = {
      continue: "当前稿件有可用基础，可以继续打磨或进入深度质检。",
      revise: `当前稿件有潜力，但需要先解决“${topIssue}”。`,
      rebuild: `当前稿件的关键承诺或结构需要重构，优先处理“${topIssue}”。`,
      discard: "当前版本投入产出偏低，建议换角度重写或保留经验后另开一版。",
    };
    return reasonMap[gate];
  }

  private normalizeStrengths(
    value: unknown,
  ): NonNullable<QuickReviewResult["strengths"]> {
    if (!Array.isArray(value)) return [];
    return value
      .flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const source = item as Record<string, unknown>;
        const title = asText(source.title);
        if (!title) return [];
        const evidence = asText(source.evidence);
        return [
          {
            title,
            ...(evidence ? { evidence } : {}),
            keepAction:
              asText(source.keepAction) || "下一版保留这个已有优势。",
          },
        ];
      })
      .slice(0, 3);
  }

  private normalizeRevisionPlan(
    value: unknown,
    issues: DiagnosisIssue[],
  ): QuickReviewResult["revisionPlan"] {
    const source =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const priorityIssueIds = asTextList(source.priorityIssueIds).slice(
      0,
      3,
    );
    const change = asTextList(source.change).slice(0, 4);
    const checkpoints = asTextList(source.checkpoints).slice(0, 4);
    return {
      priorityIssueIds:
        priorityIssueIds.length > 0
          ? priorityIssueIds
          : issues.slice(0, 1).map((issue) => issue.id),
      keep: asTextList(source.keep).slice(0, 4),
      change:
        change.length > 0
          ? change
          : issues.slice(0, 3).map((issue) => issue.fixAction),
      avoid: asTextList(source.avoid).slice(0, 4),
      checkpoints:
        checkpoints.length > 0
          ? checkpoints
          : issues
              .slice(0, 3)
              .map((issue) => `复诊时检查：${issue.title} 是否已被解决。`),
    };
  }

  private normalizePromptDiagnosis(
    value: unknown,
    previousPrompt?: string,
  ): QuickReviewResult["promptDiagnosis"] {
    const source =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    return {
      originalPrompt:
        asText(source.originalPrompt) ||
        previousPrompt?.trim() ||
        undefined,
      missingConstraints: asTextList(source.missingConstraints).slice(
        0,
        4,
      ),
      vagueInstructions: asTextList(source.vagueInstructions).slice(0, 4),
      improvedPromptPrinciples: asTextList(
        source.improvedPromptPrinciples,
      ).slice(0, 4),
    };
  }

  private normalizeNextPrompt(
    value: unknown,
    fallback: {
      positioning: string;
      sellingPoints: string[];
      mainProblem: string;
      actionableFixes: string[];
      issues: DiagnosisIssue[];
      previousPrompt?: string;
    },
  ): NonNullable<QuickReviewResult["nextPrompt"]> {
    const source =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const prompt = asText(source.prompt);
    const linkedIssueIds = asTextList(source.linkedIssueIds);
    return {
      title: asText(source.title) || "下一轮改稿 Prompt",
      prompt:
        prompt ||
        this.buildFallbackNextPrompt(
          fallback.positioning,
          fallback.sellingPoints,
          fallback.mainProblem,
          fallback.actionableFixes,
          fallback.issues,
          fallback.previousPrompt,
        ),
      linkedIssueIds:
        linkedIssueIds.length > 0
          ? linkedIssueIds.slice(0, 3)
          : fallback.issues.slice(0, 3).map((issue) => issue.id),
      whyThisWorks:
        asTextList(source.whyThisWorks).slice(0, 3).length > 0
          ? asTextList(source.whyThisWorks).slice(0, 3)
          : fallback.issues
              .slice(0, 2)
              .map((issue) => `对应解决“${issue.title}”：${issue.fixAction}`),
    };
  }

  private buildFallbackNextPrompt(
    positioning: string,
    sellingPoints: string[],
    mainProblem: string,
    actionableFixes: string[],
    issues: DiagnosisIssue[],
    previousPrompt?: string,
  ) {
    return [
      "请帮我改写这一章，但不要另起炉灶。",
      previousPrompt?.trim()
        ? `上一条 Prompt 的基础：${previousPrompt.trim().slice(0, 400)}`
        : "",
      `当前定位：${positioning || "请根据正文判断定位"}`,
      `保留卖点：${sellingPoints.length ? sellingPoints.join("；") : "保留已有冲突、人物关系和主线信息"}`,
      `优先解决：${mainProblem}`,
      `具体改法：${actionableFixes.length ? actionableFixes.join("；") : issues.map((issue) => issue.fixAction).join("；")}`,
      `必须加入的约束：${issues.map((issue) => issue.promptConstraint).join("；")}`,
      "改写边界：保留人物、场景、已发生事件和核心设定；不要只润色句子；不要新增无关设定。",
      "输出格式：1. 改写策略 2. 需要改的段落 3. 改写正文 4. 为什么这样改。",
    ]
      .filter(Boolean)
      .join("\n");
  }

  private normalizeMethodologyCards(
    value: unknown,
    issues: DiagnosisIssue[],
    prompt: string,
  ): MethodologyCard[] {
    const cards = Array.isArray(value)
      ? value
          .map((item, index) =>
            this.normalizeMethodologyCard(item, index, issues, prompt),
          )
          .filter((item): item is MethodologyCard => item !== null)
          .slice(0, 3)
      : [];

    if (cards.length > 0) {
      return cards;
    }

    const issue = issues[0];
    if (!issue) return [];
    return [
      {
        id: "method-1",
        sourceIssueId: issue.id,
        type: issue.category === "hook" ? "hook_rule" : "prompt_rule",
        title: `下次避免：${issue.title}`,
        triggerProblem: issue.title,
        reusableRule: issue.fixAction,
        selfCheckQuestion: `提交前自查：${issue.readerImpact}`,
        promptTemplate: prompt,
        usageCount: 0,
      },
    ];
  }

  private normalizeMethodologyCard(
    value: unknown,
    index: number,
    issues: DiagnosisIssue[],
    prompt: string,
  ): MethodologyCard | null {
    if (!value || typeof value !== "object") {
      return null;
    }
    const source = value as Record<string, unknown>;
    const title = asText(source.title);
    if (!title) return null;
    const sourceIssueId =
      asText(source.sourceIssueId) ||
      issues[0]?.id ||
      `issue-${index + 1}`;
    return {
      id: asText(source.id) || `method-${index + 1}`,
      sourceIssueId,
      type: this.normalizeMethodologyType(source.type),
      title,
      triggerProblem:
        asText(source.triggerProblem) ||
        issues.find((issue) => issue.id === sourceIssueId)?.title ||
        title,
      reusableRule:
        asText(source.reusableRule) ||
        issues.find((issue) => issue.id === sourceIssueId)?.fixAction ||
        "下次遇到同类问题时，先明确读者期待和改稿约束。",
      selfCheckQuestion:
        asText(source.selfCheckQuestion) ||
        "这版是否已经让读者知道为什么要继续看？",
      promptTemplate: asText(source.promptTemplate) || prompt,
      exampleBefore: asText(source.exampleBefore) || undefined,
      exampleAfter: asText(source.exampleAfter) || undefined,
      usageCount: 0,
    };
  }

  private normalizeMethodologyType(value: unknown): MethodologyCard["type"] {
    const type = asText(value).toLowerCase();
    const allowed: MethodologyCard["type"][] = [
      "opening_rule",
      "prompt_rule",
      "pacing_rule",
      "hook_rule",
      "payoff_rule",
      "anti_pattern",
    ];
    return allowed.includes(type as MethodologyCard["type"])
      ? (type as MethodologyCard["type"])
      : "prompt_rule";
  }

  private resolveQuickReviewProvider(
    provider?: ProviderConfigDto,
  ): ProviderConfigDto {
    if (provider?.kind) {
      return provider;
    }

    return {
      preset: "shared-gpu",
      kind: "openai-compatible",
    };
  }

  private normalizeRecommendedPlatforms(
    value: unknown,
    genre: string,
    textLength: number,
  ): RecommendedPlatform[] {
    const recommended = Array.isArray(value)
      ? value
          .map((item) => this.normalizeRecommendedPlatform(item))
          .filter((item): item is RecommendedPlatform => item !== null)
          .slice(0, 3)
      : [];

    if (recommended.length > 0) {
      return recommended;
    }

    return this.buildFallbackRecommendedPlatforms(genre, textLength);
  }

  private normalizeRecommendedPlatform(
    value: unknown,
  ): RecommendedPlatform | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const source = value as Record<string, unknown>;
    const id = this.normalizeRecommendedPlatformId(source.id);
    if (!id) {
      return null;
    }

    return {
      id,
      label: asText(source.label) || recommendedPlatformLabels[id],
      fit: this.normalizeRecommendedFit(source.fit),
      reason:
        asText(source.reason) ||
        "题材和节奏与该平台当前常见消费方式更匹配。",
    };
  }

  private normalizeRecommendedPlatformId(
    value: unknown,
  ): RecommendedPlatformId | null {
    const platformId = asText(
      value,
    ).toLowerCase() as RecommendedPlatformId;
    if (
      [
        "qidian",
        "fanqie",
        "jinjiang",
        "qimao",
        "wechat-short",
        "other",
      ].includes(platformId)
    ) {
      return platformId;
    }

    return null;
  }

  private normalizeRecommendedFit(value: unknown) {
    const fit = asText(value);
    if (
      fit === "优先发布" ||
      fit === "可作为第二选择" ||
      fit === "更适合短篇测试"
    ) {
      return fit;
    }

    return "可作为第二选择";
  }

  private buildFallbackRecommendedPlatforms(
    genre: string,
    textLength: number,
  ): RecommendedPlatform[] {
    const isShortFormCandidate = textLength > 0 && textLength <= 1800;

    const byGenre: Record<string, RecommendedPlatform[]> = {
      xuanhuan: [
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "优先发布",
          reason: "玄幻爽点和直给冲突更容易在快节奏分发环境里测出反馈。",
        },
        {
          id: "qidian",
          label: recommendedPlatformLabels.qidian,
          fit: "可作为第二选择",
          reason: "如果后续能把成长线和设定厚度继续做深，长篇连载空间更大。",
        },
        {
          id: "qimao",
          label: recommendedPlatformLabels.qimao,
          fit: "可作为第二选择",
          reason: "强冲突和高爽点题材在大众向免费阅读里也有机会。",
        },
      ],
      urban: [
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "优先发布",
          reason: "都市题材适合先用低理解成本和强冲突测试点击与留存。",
        },
        {
          id: "qimao",
          label: recommendedPlatformLabels.qimao,
          fit: "可作为第二选择",
          reason: "如果打脸、反转和爽点释放够密，商业向适配度会比较好。",
        },
        {
          id: "qidian",
          label: recommendedPlatformLabels.qidian,
          fit: "可作为第二选择",
          reason: "当职业线、成长线更完整时，连载价值会更稳定。",
        },
      ],
      romance: [
        {
          id: "jinjiang",
          label: recommendedPlatformLabels.jinjiang,
          fit: "优先发布",
          reason: "关系推进、情绪张力和人物选择型内容更容易找到核心读者。",
        },
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "可作为第二选择",
          reason: "如果冲突直给、开局钩子强，也适合先测大众化反馈。",
        },
        {
          id: "wechat-short",
          label: recommendedPlatformLabels["wechat-short"],
          fit: isShortFormCandidate ? "更适合短篇测试" : "可作为第二选择",
          reason: "情绪反转明确、付费卡点清楚时，短篇分发也有转化空间。",
        },
      ],
      suspense: [
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "优先发布",
          reason: "悬念和反转密度高的章节适合先看分发环境里的读完反馈。",
        },
        {
          id: "wechat-short",
          label: recommendedPlatformLabels["wechat-short"],
          fit: isShortFormCandidate ? "更适合短篇测试" : "可作为第二选择",
          reason: "如果章节以强钩子和连续反转驱动，短篇测试会更直接。",
        },
        {
          id: "qidian",
          label: recommendedPlatformLabels.qidian,
          fit: "可作为第二选择",
          reason: "当谜面、线索链和长期伏笔更完整时，连载价值更高。",
        },
      ],
      "infinite-flow": [
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "优先发布",
          reason: "副本开局、规则压力和即时刺激更适合快节奏平台起量。",
        },
        {
          id: "qidian",
          label: recommendedPlatformLabels.qidian,
          fit: "可作为第二选择",
          reason: "世界规则和副本升级线继续做深后，长篇追更潜力更强。",
        },
        {
          id: "qimao",
          label: recommendedPlatformLabels.qimao,
          fit: "可作为第二选择",
          reason: "规则求生和高压冲突在大众阅读分发里也容易拿到反馈。",
        },
      ],
      other: [
        {
          id: "fanqie",
          label: recommendedPlatformLabels.fanqie,
          fit: "优先发布",
          reason: "题材未完全定型时，先看快节奏平台的真实点击和留存更高效。",
        },
        {
          id: "qidian",
          label: recommendedPlatformLabels.qidian,
          fit: "可作为第二选择",
          reason: "如果后续形成更稳定的世界观和成长主线，适合长篇连载验证。",
        },
      ],
    };

    return byGenre[genre] || byGenre.other;
  }

  private mockQuickReview(input: QuickReviewDto) {
    const textLength = input.chapterText.trim().length;
    const quickScore = textLength >= 300 ? 6.2 : 5.4;
    const genre = this.normalizeQuickReviewGenre(input.genre) || "other";
    const issue: DiagnosisIssue = {
      id: "issue-1",
      severity: "high",
      category: "other",
      title: "演示模式不会判断真实剧情质量。",
      description:
        "当前使用 mock provider，只能验证诊断报告结构，不能代表真实编辑判断。",
      evidence: [
        {
          quote: this.pickEvidenceQuote(input.chapterText),
          locationHint: "输入开头",
          confidence: 0,
        },
      ].filter((item) => item.quote),
      readerImpact: "如果只看演示结果，作者无法知道真实读者会在哪个位置流失。",
      fixAction: "切换共享站或付费模型后重试快速点评。",
      promptConstraint:
        "使用真实模型时，要求它基于正文证据输出问题、读者影响和改稿动作。",
      blocksNextStep: true,
    };
    const nextPrompt = this.normalizeNextPrompt(null, {
      positioning: "本地演示模式只验证快速点评结构，不调用外部模型。",
      sellingPoints: ["已有章节正文入口", "可以进入完整 Rubric 评分流程"],
      mainProblem: issue.title,
      actionableFixes: [
        "切换共享站或付费模型后重试快速点评。",
        "如果使用付费模型，请确认 Base URL、Model 和 API Key 都已填写。",
        "需要完整证据链时进入章节质检并生成 Rubric。",
      ],
      issues: [issue],
      previousPrompt: input.previousPrompt,
    });

    return {
      title: input.title || "未命名章节",
      genre,
      inputKind: this.normalizeQuickReviewInputKind(input.inputKind),
      positioning: "本地演示模式只验证快速点评结构，不调用外部模型。",
      sellingPoints: ["已有章节正文入口", "可以进入完整 Rubric 评分流程"],
      mainProblem: issue.title,
      actionableFixes: [
        "切换共享站或付费模型后重试快速点评。",
        "如果使用付费模型，请确认 Base URL、Model 和 API Key 都已填写。",
        "需要完整证据链时进入章节质检并生成 Rubric。",
      ],
      recommendedPlatforms: this.buildFallbackRecommendedPlatforms(
        genre,
        textLength,
      ),
      readyForFullReview: textLength >= 80,
      readyReason: "当前是本地演示结果；真实点评需要使用可用模型服务。",
      quickScore,
      confidence: 0,
      gateDecision: "revise",
      gateReason: "当前是演示结构，真实稿件判断需要切换可用模型。",
      oneLineDiagnosis: `这稿最该先解决：${issue.title}`,
      issues: [issue],
      strengths: [
        {
          title: "已经有可诊断文本入口",
          keepAction: "下一步切换真实模型后保留相同输入复测。",
        },
      ],
      revisionPlan: this.normalizeRevisionPlan(null, [issue]),
      promptDiagnosis: this.normalizePromptDiagnosis(
        null,
        input.previousPrompt,
      ),
      nextPrompt,
      methodologyCards: this.normalizeMethodologyCards(
        null,
        [issue],
        nextPrompt.prompt,
      ),
    };
  }

  getPipeline() {
    return {
      stages: [
        "ingest_reference_chapters",
        "clean_txt_text",
        "split_book_into_chapters",
        "build_style_profile",
        "build_market_profile",
        "extract_story_principles",
        "build_genre_rubric",
        "score_user_chapter",
        "enqueue_book_analysis_job",
        "map_chapter_assets",
        "reduce_book_assets",
        "critic_pass",
        "generate_revision_plan",
      ],
      providerModes: ["mock", "openai-compatible"],
      providerPresets: this.modelProviders.getPresets(),
      storagePolicy:
        "local-first; user text stays in the deployment; API keys are not persisted; async jobs persist status, preprocessing, and chapter map partial results locally",
    };
  }

  async testProvider(provider: ProviderConfigDto) {
    return this.modelProviders.test(provider);
  }

  getProviderPresets() {
    return this.modelProviders.getPresets();
  }

  async inferReferenceProfile(input: InferReferenceProfileDto) {
    if (input.provider.kind === "mock") {
      return this.mockReferenceProfile(input);
    }

    const content = await this.modelProviders.chat(
      input.provider,
      [
        {
          role: "system",
          content:
            "你是资深中文网文市场编辑。你只返回合法 JSON，不使用 Markdown，不解释过程。",
        },
        {
          role: "user",
          content: this.inferReferenceProfilePrompt(input),
        },
      ],
      {
        maxOutputTokens: 1400,
        jsonSchema: {
          name: "reference_profile_result",
          schema: referenceProfileJsonSchema,
        },
      },
    );

    return parseJsonWithRepair(
      this.modelProviders,
      input.provider,
      content,
      "参考章节市场定位识别",
    );
  }

  async buildRubric(input: BuildRubricDto) {
    if (input.provider.kind === "mock") {
      return this.mockRubric(input);
    }

    const content = await this.modelProviders.chat(
      input.provider,
      [
        {
          role: "system",
          content:
            "你是资深中文网文编辑和拆书教练。你只返回合法 JSON，不使用 Markdown。",
        },
        {
          role: "user",
          content: this.buildRubricPrompt(input),
        },
      ],
      {
        maxOutputTokens: 4096,
        jsonSchema: {
          name: "rubric_result",
          schema: rubricJsonSchema,
        },
      },
    );

    try {
      return await parseJsonWithRepair(
        this.modelProviders,
        input.provider,
        content,
        "评分标准生成",
      );
    } catch (error) {
      const fallback = this.mockRubric(input);
      return {
        ...fallback,
        mode: "fallback-rubric",
        editorNote: `模型已返回内容，但 JSON 格式连续解析失败，系统临时使用本地通用评分标准兜底。你可以继续评分，也可以稍后点“重新分析”重试模型。原始错误：${(error as Error).message}`,
      };
    }
  }

  async scoreChapter(input: ScoreChapterDto) {
    if (input.provider.kind === "mock") {
      return this.mockScore(input);
    }

    const content = await this.modelProviders.chat(
      input.provider,
      this.buildScoreChapterMessages(input),
      {
        maxOutputTokens: 3072,
        jsonSchema: {
          name: "score_result",
          schema: scoreJsonSchema,
        },
      },
    );

    return parseJsonWithRepair(this.modelProviders, input.provider, content, "章节评分");
  }

  private buildRubricPrompt(input: BuildRubricDto): string {
    const styleProfile = this.buildStyleProfile(input);
    const marketProfile = this.buildMarketProfile(input);
    const platformStrategy = this.buildPlatformStrategyProfile(input);
    return `
请拆解一章成熟中文网文，提炼它为什么能让读者继续读，并生成可迁移的评分 Rubric。

作品类型：${input.genre}
目标平台：${styleProfile.platformLabel}
目标读者：${styleProfile.audienceLabel}
阅读场景：${styleProfile.readingModeLabel}
平台风格画像：${JSON.stringify(styleProfile.profile)}
平台推荐策略假设：${platformStrategy.summary}
细分分类：${marketProfile.category}
主题承诺：${marketProfile.theme}
标签：${marketProfile.tags.join("、") || "无"}
显性关键词：${marketProfile.explicitKeywords.join("、") || "无"}
隐性期待：${marketProfile.implicitExpectations.join("、") || "无"}
标题/简介承诺：${marketProfile.positioningPromise || "无"}
章节标题：${input.referenceTitle}

成熟章节：
${input.referenceText}

请严格返回这个 JSON 结构：
{
  "mode": "llm-rubric",
  "reference": {
    "title": "章节标题",
    "genre": "作品类型",
    "platform": "目标平台",
    "audience": "目标读者",
    "readingMode": "阅读场景",
    "oneSentenceSummary": "本章一句话功能"
  },
  "styleProfile": {
    "platform": "目标平台",
    "audience": "目标读者",
    "readingMode": "阅读场景",
    "pace": "节奏要求",
    "emotion": "情绪要求",
    "hookDensity": "钩子密度要求",
    "language": "语言风格要求",
    "setupTolerance": "铺垫容忍度",
    "pleasureDensity": "爽点密度要求",
    "dataPriority": "该平台优先观察的数据指标"
  },
  "marketProfile": {
    "category": "细分分类",
    "theme": "主题承诺",
    "tags": ["标签"],
    "explicitKeywords": ["显性关键词"],
    "implicitExpectations": ["隐性期待"],
    "positioningPromise": "标题或简介承诺",
    "readerExpectationModel": ["该市场定位下读者默认期待的结构元素"]
  },
  "platformStrategyProfile": {
    "recommendationSignals": ["推荐信号假设"],
    "competitionLevel": "赛道竞争程度",
    "competitionRisk": "同质化和差异化风险",
    "pushStage": "推流阶段",
    "trafficEntry": ["可能入口"],
    "strategyNote": "这只是平台策略假设，不是内部算法结论"
  },
  "principles": [
    {
      "id": "p1",
      "title": "可复用原则名称",
      "sourceObservation": "从参考章节观察到的具体优点，不要大段复述原文",
      "reusableRule": "抽象成其他作品也能迁移的写作原则",
      "migrationQuestion": "用户写自己章节时应该自问的问题"
    }
  ],
  "rubric": {
    "id": "rubric-webnovel-v1",
    "genre": "${input.genre}",
    "platform": "${input.platform}",
    "audience": "${input.audience}",
    "readingMode": "${input.readingMode}",
    "category": "${input.category}",
    "theme": "${input.theme}",
    "styleProfile": {},
    "marketProfile": {},
    "metrics": [
      {
        "id": "chapter-goal",
        "name": "主角目标清晰度",
        "description": "指标定义",
        "scale": {
          "low": "0-3 分标准",
          "medium": "4-6 分标准",
          "high": "7-10 分标准"
        },
        "referencePrincipleId": "p1"
      }
    ]
  },
  "editorNote": "这份 Rubric 最适合检查什么类型的章节"
}

Rubric 必须包含这些指标：${baseRubricMetrics.map((item) => item.name).join("、")}。
Rubric 必须按目标平台和目标读者校准，不要只判断文学质量。
Rubric 必须判断分类、主题、标签、关键词和隐性期待是否命中。
Rubric 必须参考平台推荐策略假设，但不能声称掌握平台内部算法；要把它当作外部流量环境和编辑经验假设。
Rubric 必须吸收网文结构检查：黄金三章/黄金开局是否建立期待，爽点是否完成“期待建立 -> 延迟 -> 兑现”，章末钩子属于悬念、危机、转折、期待或揭示中的哪一种。
Rubric 必须检查节奏密度：小高潮间隔、信息释放、情绪余韵和下一个期待种子，不要只说“节奏快慢”。
Rubric 必须吸收爽点疲劳管理：连续同类爽点要扣分；要检查强度波动、类型轮换、代价、余波和下一轮期待。
Rubric 必须吸收题材选择评分：平台匹配、作者储备、读者承诺、前三章钩子、差异化、风险成本；对单章评分时重点落到平台匹配、读者承诺、前三章钩子和差异化。
Rubric 必须把“文本自然度”作为质量项，只诊断模板化、空泛升华、同质句式和专属细节不足，不承诺规避检测或过审。
关键词不是词频统计，而是读者点击期待信号。显性关键词要自然出现，隐性期待要落实到结构。
如果参考章节优点和目标平台风格不完全一致，请明确哪些原则可迁移、哪些不该迁移。
每个指标必须能用于评分，不要写空泛表述。
`.trim();
  }

  private buildScoreChapterMessages(input: ScoreChapterDto) {
    const rubric = input.rubric as Record<string, unknown>;
    const prompt = buildChapterScorePrompt(
      {
        title: input.chapterTitle,
        text: input.chapterText,
        rubricId: asText(rubric.id) || "score-chapter",
      },
      this.extractPromptMetrics(input.rubric),
    );

    return [
      {
        ...prompt.messages[0],
        content: `${prompt.messages[0].content}
你只返回合法 JSON，不使用 Markdown，所有评分必须给出具体证据和可执行改法。`,
      },
      {
        ...prompt.messages[1],
        content: `${prompt.messages[1].content}

${this.scoreChapterPrompt(input)}`,
      },
    ];
  }

  private extractPromptMetrics(
    rubric: Record<string, unknown>,
  ): RubricMetric[] {
    const metrics = Array.isArray(rubric.metrics) ? rubric.metrics : [];
    const normalized = metrics
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const source = item as Record<string, unknown>;
        const id = asText(source.id);
        const name = asText(source.name);
        if (!id || !name) {
          return null;
        }

        return {
          id,
          name,
          description: asText(source.description) || name,
          scale:
            source.scale && typeof source.scale === "object"
              ? (source.scale as RubricMetric["scale"])
              : {
                  low: "低分：缺少可读证据或读者驱动力。",
                  medium: "中分：方向存在，但压力、情绪或兑现不足。",
                  high: "高分：正文证据清楚，能推动读者继续读。",
                },
        };
      })
      .filter((item): item is RubricMetric => item !== null);

    return normalized.length > 0 ? normalized : DEFAULT_RUBRIC_METRICS;
  }

  private scoreChapterPrompt(input: ScoreChapterDto): string {
    const styleProfile = this.buildStyleProfile(input);
    const marketProfile = this.buildMarketProfile(input);
    const platformStrategy = this.buildPlatformStrategyProfile(input);
    const performanceSnapshot = this.buildPerformanceSnapshot(
      input.performanceSnapshot,
      input,
    );
    const aiSelfTest = this.buildAiSelfTestProfile(input.aiSelfTest);
    return `
补充上下文与严格输出要求：

目标平台：${styleProfile.platformLabel}
目标读者：${styleProfile.audienceLabel}
阅读场景：${styleProfile.readingModeLabel}
平台风格画像：${JSON.stringify(styleProfile.profile)}
平台推荐策略假设：${platformStrategy.summary}
细分分类：${marketProfile.category}
主题承诺：${marketProfile.theme}
标签：${marketProfile.tags.join("、") || "无"}
显性关键词：${marketProfile.explicitKeywords.join("、") || "无"}
隐性期待：${marketProfile.implicitExpectations.join("、") || "无"}
标题/简介承诺：${marketProfile.positioningPromise || "无"}
数据表现快照：${performanceSnapshot.summary}
数据指标口径：${performanceSnapshot.guidance}
AI 自测增强：${aiSelfTest.summary}

Rubric：
${JSON.stringify(input.rubric, null, 2)}

请严格返回这个 JSON 结构：
{
  "mode": "llm-score",
  "chapterTitle": "用户章节标题",
  "totalScore": 6.5,
  "scores": [
    {
      "metricId": "chapter-goal",
      "name": "主角目标清晰度",
      "score": 7,
      "reason": "为什么这么打分",
      "evidence": "用户文本中的具体证据，控制在 40 字以内",
      "fix": "可执行修改建议",
      "referencePrincipleId": "p1"
    }
  ],
  "strongestPoint": "最强项",
  "weakestPoint": "最大短板",
  "styleFit": {
    "score": 7,
    "platformRisk": "和目标平台不匹配的最大风险",
    "audienceRisk": "和目标读者不匹配的最大风险",
    "readingModeRisk": "和阅读场景不匹配的最大风险"
  },
  "marketFit": {
    "score": 7,
    "categoryRisk": "和细分分类不匹配的最大风险",
    "themeRisk": "主题承诺不清或兑现不足的风险",
    "keywordRisk": "显性关键词或隐性期待命中不足的风险",
    "frontloadRisk": "卖点没有足够前置的风险"
  },
  "platformStrategyFit": {
    "score": 7,
    "recommendationRisk": "正文对推荐信号假设的最大不匹配",
    "competitionRisk": "赛道竞争下的同质化或差异化不足",
    "pushBottleneck": "当前推流阶段最可能卡住的位置",
    "trafficEntryAction": "按入口标签/推荐场景最该优先改什么"
  },
  "performanceFit": {
    "hasData": true,
    "funnelSummary": "用一句话总结数据漏斗",
    "impressionDiagnosis": "展现量对应的入口/分发问题；没有数据则写未提供",
    "clickDiagnosis": "点击率对应的标题、分类、关键词承诺问题；没有数据则写未提供",
    "validReadDiagnosis": "有效阅读率对应的平台有效阅读口径、开头承诺和跳出问题；没有数据或平台不适用则写未提供/不适用",
    "read30sDiagnosis": "阅读30s对应的开头理解成本和初始钩子问题；没有数据则写未提供",
    "read60sDiagnosis": "阅读60s对应的冲突升级和情绪维持问题；长篇追更场景只作为低权重辅助，不能当核心指标；没有数据则写未提供",
    "bottomDiagnosis": "触底率对应的中后段节奏、信息密度和段落功能问题；没有数据则写未提供",
    "followDiagnosis": "追更对应的结尾钩子、长期目标和系列承诺问题；没有数据则写未提供",
    "bookshelfDiagnosis": "加书架率对应的长期收藏价值、设定吸引力和追读承诺问题；没有数据则写未提供",
    "firstChapterCompletionDiagnosis": "首章完读率对应的首章结构、爽点兑现和信息负担问题；没有数据则写未提供",
    "avgReadProgressDiagnosis": "短篇付费平均阅读进度对应的全文节奏、付费前后断点和弃读位置问题；没有数据或长篇不适用则写未提供/不适用",
    "paidUnlockDiagnosis": "短篇付费解锁率对应的付费点前置、情绪债和付费理由问题；没有数据或长篇不适用则写未提供/不适用",
    "nextChapterClickDiagnosis": "章末下一章点击率对应的断章钩子和未完成期待问题；没有数据则写未提供",
    "threeChapterRetentionDiagnosis": "前3章留存率对应的连续承诺兑现、主线清晰度和节奏稳定性问题；没有数据则写未提供",
    "priority": "最该先修的漏斗环节"
  },
  "selfTestFit": {
    "enabled": true,
    "summary": "一句话总结 AI 自测发现的核心问题；未启用则写未启用",
    "dialogueMaskDiagnosis": "遮挡人名后，对话是否还能区分人物声音；未启用则写未启用",
    "jumpReadDiagnosis": "随机跳过 3 段后，主线是否仍连贯；未启用则写未启用",
    "emotionDiagnosis": "悲伤/激动/爽点情节是否产生真实情绪，而不是只写情绪词；未启用则写未启用",
    "settingRecapDiagnosis": "人物年龄、身份、关键事件和设定是否前后自洽；未启用则写未启用",
    "deleteSentenceDiagnosis": "删掉环境/心理描写后剧情是否几乎不受影响，判断注水风险；未启用则写未启用",
    "aiTraceDiagnosis": "文本自然度诊断：是否有模板化升华、空泛排比、专属细节弱、句式过齐等问题；未启用则写未启用",
    "promptAddons": ["应该写进改文提示词的具体约束"]
  },
  "nextRevisionMove": "下一步最该改什么",
  "rewriteBrief": {
    "target": "建议局部重写的位置",
    "strategy": "重写策略，不直接整章代写"
  },
  "revisionPrompt": {
    "title": "给写作 AI 的改文提示词标题",
    "prompt": "一段可以直接复制给写作 AI 的提示词，必须包含修改目标、平台风格、市场定位、需要保留的内容、重点改法、禁止事项、输出格式"
  }
}

要求：
1. 每个 Rubric 指标都必须评分。
2. score 是 0 到 10 的数字。
3. evidence 必须来自用户章节，不要引用参考章节。
4. fix 必须是可执行改法，不要只说“加强描写”。
5. 评分不是文学奖评分，而是目标平台读者是否愿意继续读的商业阅读体验评分。
6. 如果关键词没有直接出现但隐性期待已经被结构满足，要说明；如果关键词出现但没有承载期待，也要扣分。
7. 数据表现只做归因辅助，不要把低数据直接等同于文本差；要结合章节证据判断可能原因。
8. 必须按目标平台和阅读场景判断指标权重：长篇追更以首章完读、加书架/收藏、下一章点击、前3章留存、追更为核心；短篇付费以全文完读、平均阅读进度、付费解锁为核心；阅读60s在长篇里只作低权重参考。
9. 平台推荐策略只能作为假设和经验归因，不能写成平台内部算法结论；要结合正文证据判断是否能提高点击、有效阅读、收藏/追更或付费转化。
10. revisionPrompt 要写给另一个“负责改文的 AI”，让它知道怎么改文；不要让它重新开新故事。
11. 如果启用 AI 自测增强，必须由你基于用户章节自行执行测试，不要要求用户填结果；测试结论只能作为辅助证据，仍要回到章节文本和 Rubric。
12. revisionPrompt 必须吸收 selfTestFit.promptAddons，把“遮挡人名、跳读、共情、设定复盘、删句、文本自然度”转化为改文 AI 可执行的约束。
13. 必须额外诊断爽点疲劳：如果连续用同一种打脸、隐藏实力或围观惊呼填充，要给出类型轮换、代价或关系推进的改法。
14. 必须额外诊断钩子回收：章末钩子要说明属于悬念、危机、反转、期待、情感或信息揭示，并指出下一章前段应如何回收。
`.trim();
  }

  private inferReferenceProfilePrompt(input: InferReferenceProfileDto): string {
    const styleProfile = this.buildStyleProfile(input);
    const referenceSample = this.buildReferenceProfileSample(
      input.referenceText,
    );
    return `
请根据参考章节内容，识别它最适合用于后续拆解和质检的市场定位。你要像网文平台编辑一样判断，而不是只做关键词匹配。

已知上下文：
- 目标平台：${styleProfile.platformLabel}
- 目标读者：${styleProfile.audienceLabel}
- 阅读场景：${styleProfile.readingModeLabel}
- 用户提供的参考标题：${input.referenceTitle || "未提供"}

参考章节：
${referenceSample}

请严格返回这个 JSON 结构：
{
  "mode": "ai-reference-profile",
  "referenceTitle": "如果正文有章节标题则用正文标题，否则用用户提供标题，否则概括一个短标题",
  "genre": "xuanhuan | urban | romance | suspense | infinite-flow | other",
  "category": "更细分的市场分类，最长 20 字",
  "theme": "本章最核心的读者承诺，最长 20 字",
  "tags": ["3到6个读者能理解的标签"],
  "explicitKeywords": ["3到6个可见关键词或高频意象"],
  "implicitExpectations": ["3到6个隐性期待，例如被低估、反转、后悔、规则破解、情绪拉扯"],
  "positioningPromise": "一句话标题/简介承诺，说明读者点进来期待看到什么",
  "confidence": 0.82,
  "evidence": ["最多3条来自参考章节的判断依据，每条不超过30字"],
  "notes": "需要用户校正的风险点；如果没有就写空字符串"
}

要求：
1. genre 必须只能是 xuanhuan、urban、romance、suspense、infinite-flow、other 之一。
2. 不要机械抓词。要判断这些词背后的读者期待和平台消费语境。
3. 如果题材混合，genre 选主导消费类型，category 写更细分的混合定位。
4. tags、explicitKeywords、implicitExpectations 不能空。
5. confidence 是 0 到 1 的数字。文本太短或信息不足时降低 confidence，并在 notes 说明。
`.trim();
  }

  private buildReferenceProfileSample(text: string): string {
    const normalized = text.trim();
    if (normalized.length <= 7000) {
      return normalized;
    }

    return `${normalized.slice(0, 5200)}

……中间内容已省略，用于加快市场定位识别……

${normalized.slice(-1600)}`;
  }

  private mockRubric(input: BuildRubricDto) {
    const styleProfile = this.buildStyleProfile(input);
    const marketProfile = this.buildMarketProfile(input);
    return {
      mode: "mock-rubric",
      reference: {
        title: input.referenceTitle,
        genre: input.genre,
        platform: input.platform,
        audience: input.audience,
        readingMode: input.readingMode,
        oneSentenceSummary:
          "用具体压迫和延迟兑现建立读者期待，再把期待转成可追读的问题。",
      },
      styleProfile: {
        platform: styleProfile.platformLabel,
        audience: styleProfile.audienceLabel,
        readingMode: styleProfile.readingModeLabel,
        ...styleProfile.profile,
      },
      marketProfile: {
        ...marketProfile,
        readerExpectationModel: [
          `${marketProfile.category} 的核心卖点要尽早出现`,
          `${marketProfile.theme} 需要绑定主角目标和冲突`,
          "显性关键词要自然进入场景，隐性期待要转化为情绪债和钩子",
        ],
      },
      principles: [
        {
          id: "p1",
          title: "具体损失制造情绪债",
          sourceObservation:
            "参考章节通过可感知的损失或羞辱，让读者等待主角反击。",
          reusableRule:
            "不要只写态度冲突，要让阻碍造成资格、资源、关系或身份损失。",
          migrationQuestion: "我的主角这一章如果失败，会失去什么具体东西？",
        },
        {
          id: "p2",
          title: "结尾用升级问题推动追读",
          sourceObservation: "章节结尾没有自然停住，而是抛出更高一级的新风险。",
          reusableRule: "结尾要把已解决的小冲突转成更大的危机、秘密或奖励。",
          migrationQuestion: "读者看完本章后，会立刻想知道哪个具体问题的答案？",
        },
        {
          id: "p3",
          title: "市场关键词不是堆词，而是期待兑现",
          sourceObservation:
            "成熟章节会让分类卖点自然进入冲突，不把关键词孤立摆放。",
          reusableRule:
            "把标签和关键词翻译成读者期待的结构元素，例如低估、反转、关系破裂或能力展示。",
          migrationQuestion:
            "我的关键词是否真的带来了读者期待的事件、情绪或反转？",
        },
        {
          id: "p4",
          title: "爽点要有压制、兑现和余波",
          sourceObservation:
            "成熟章节不会只写主角赢，而会先让对手造成具体压力，再让反击带来局势变化。",
          reusableRule:
            "爽点按压制、蓄力、反击、兑现、余波拆开，余波要制造下一轮期待。",
          migrationQuestion:
            "我的爽点是否只是奖励结果，还是改变了关系、资源、风险或下一章目标？",
        },
        {
          id: "p5",
          title: "自然表达来自角色和场景",
          sourceObservation:
            "有效章节用具体动作、道具和人物反应承载情绪，不靠空泛总结拔高。",
          reusableRule:
            "删掉模板化升华和同质句式，把判断改成角色动作、场景细节或可验证后果。",
          migrationQuestion:
            "这一段如果去掉抽象评价，还剩下哪些只属于本角色和本场景的细节？",
        },
      ],
      rubric: {
        id: `rubric-${input.genre}-mock-v1`,
        genre: input.genre,
        platform: input.platform,
        audience: input.audience,
        readingMode: input.readingMode,
        category: input.category,
        theme: input.theme,
        styleProfile: {
          platform: styleProfile.platformLabel,
          audience: styleProfile.audienceLabel,
          readingMode: styleProfile.readingModeLabel,
          ...styleProfile.profile,
        },
        marketProfile: {
          ...marketProfile,
          readerExpectationModel: [
            `${marketProfile.category} 的核心卖点要尽早出现`,
            `${marketProfile.theme} 需要绑定主角目标和冲突`,
            "显性关键词要自然进入场景，隐性期待要转化为情绪债和钩子",
          ],
        },
        metrics: baseRubricMetrics.map((metric, index) => ({
          ...metric,
          referencePrincipleId:
            metric.id === "pleasure-structure"
              ? "p4"
              : metric.id === "prose-naturalness"
                ? "p5"
                : index < 4
                  ? "p1"
                  : index < 12
                    ? "p2"
                    : "p3",
        })),
      },
      editorNote: "这份 Rubric 适合先验证开局和单章追读能力。",
    };
  }

  private mockReferenceProfile(input: InferReferenceProfileDto) {
    return {
      mode: "mock-reference-profile",
      referenceTitle: input.referenceTitle?.trim() || "参考章节",
      genre: "other",
      category: "待模型识别",
      theme: "待模型识别",
      tags: ["待识别"],
      explicitKeywords: ["待识别"],
      implicitExpectations: ["待识别"],
      positioningPromise:
        "演示模式不读取真实市场定位；配置真实模型后可自动识别。",
      confidence: 0,
      evidence: [],
      notes:
        "当前是演示模式，只验证接口结构；请配置真实 Provider 获得 AI 识别结果。",
    };
  }

  private mockScore(input: ScoreChapterDto) {
    const styleProfile = this.buildStyleProfile(input);
    const marketProfile = this.buildMarketProfile(input);
    const platformStrategy = this.buildPlatformStrategyProfile(input);
    const performanceSnapshot = this.buildPerformanceSnapshot(
      input.performanceSnapshot,
      input,
    );
    const aiSelfTest = this.buildAiSelfTestProfile(input.aiSelfTest);
    const lengthScore = input.chapterText.length > 800 ? 6.8 : 5.4;
    const rubric = input.rubric as {
      metrics?: Array<{ id: string; name: string }>;
    };
    const rubricMetrics = rubric.metrics?.length
      ? rubric.metrics
      : baseRubricMetrics;

    return {
      mode: "mock-score",
      chapterTitle: input.chapterTitle,
      totalScore: lengthScore,
      scores: rubricMetrics.map((metric) => ({
        metricId: metric.id,
        name: metric.name,
        score: lengthScore,
        reason: "演示模式只验证接口和报告结构，不判断真实文本质量。",
        evidence: input.chapterText.slice(0, 40),
        fix: "接入真实 OpenAI-compatible Provider 后，让模型给出证据段落和局部改法。",
        referencePrincipleId: "p1",
      })),
      strongestPoint: "章节已经可以进入结构化质检流程。",
      weakestPoint: "演示模式不会读取真实剧情逻辑。",
      styleFit: {
        score: lengthScore,
        platformRisk: `${styleProfile.platformLabel} 需要按平台节奏重新验证真实文本。`,
        audienceRisk: `${styleProfile.audienceLabel} 的核心期待需要真实模型判断。`,
        readingModeRisk: `${styleProfile.readingModeLabel} 下的卡点强度需要进一步校准。`,
      },
      marketFit: {
        score: lengthScore,
        categoryRisk: `${marketProfile.category} 的分类期待需要真实模型检查是否前置。`,
        themeRisk: `${marketProfile.theme} 是否清楚绑定本章目标和冲突，需要真实模型判断。`,
        keywordRisk: `显性关键词「${marketProfile.explicitKeywords.join("、") || "无"}」与隐性期待「${marketProfile.implicitExpectations.join("、") || "无"}」需要验证是否自然命中。`,
        frontloadRisk:
          "卖点是否出现在前段并支撑点击后的继续阅读，需要真实模型判断。",
      },
      platformStrategyFit: {
        score: lengthScore,
        recommendationRisk: platformStrategy.recommendationSignals.length
          ? `已接收推荐信号假设：${platformStrategy.recommendationSignals.join("、")}；真实模型会检查正文是否支撑这些信号。`
          : "未提供推荐信号假设。",
        competitionRisk:
          platformStrategy.competitionLevel === "high"
            ? "高竞争赛道下，需要更早给出差异化钩子，避免只复用常见开局。"
            : `${platformStrategy.competitionLabel}赛道下，仍需检查卖点辨识度。`,
        pushBottleneck: `当前推流阶段假设为${platformStrategy.pushStageLabel}，演示模式不判断真实卡点。`,
        trafficEntryAction: platformStrategy.trafficEntry.length
          ? `优先让前段兑现入口标签：${platformStrategy.trafficEntry.join("、")}。`
          : "未提供入口标签，建议补充推荐流、分类页或关键词入口。",
      },
      performanceFit: {
        hasData: performanceSnapshot.hasData,
        funnelSummary: performanceSnapshot.hasData
          ? `演示模式已接收数据漏斗。${performanceSnapshot.guidance}`
          : "未提供数据表现快照，仅进行文本结构评分。",
        impressionDiagnosis: performanceSnapshot.values.impressions
          ? `展现量 ${performanceSnapshot.values.impressions}，需要结合平台分发和标签命中判断入口问题。`
          : "未提供展现量。",
        clickDiagnosis: performanceSnapshot.values.clickThroughRate
          ? `点击率 ${performanceSnapshot.values.clickThroughRate}%，优先检查标题/简介承诺和正文卖点是否一致。`
          : "未提供点击率。",
        validReadDiagnosis: performanceSnapshot.values.validReadRate
          ? `有效阅读 ${performanceSnapshot.values.validReadRate}%，优先检查点击后前段是否快速兑现承诺，避免平台判定无效阅读或快速跳出。`
          : performanceSnapshot.context.isAlgorithmPlatform
            ? "未提供有效阅读率。"
            : "当前平台口径下不作为核心指标。",
        read30sDiagnosis: performanceSnapshot.values.read30sRate
          ? `阅读30s ${performanceSnapshot.values.read30sRate}%，优先检查开头500字是否快速建立目标、冲突和卖点。`
          : "未提供阅读30s。",
        read60sDiagnosis: performanceSnapshot.values.read60sRate
          ? performanceSnapshot.context.isLongSerialization
            ? `阅读60s ${performanceSnapshot.values.read60sRate}%，长篇场景只作低权重参考，优先回看首章完读、下一章点击和前三章留存。`
            : `阅读60s ${performanceSnapshot.values.read60sRate}%，优先检查冲突是否持续升级。`
          : "未提供阅读60s。",
        bottomDiagnosis: performanceSnapshot.values.bottomRate
          ? `触底率 ${performanceSnapshot.values.bottomRate}%，优先检查中后段是否空转或信息重复。`
          : "未提供触底率。",
        followDiagnosis: performanceSnapshot.values.followRate
          ? `追更 ${performanceSnapshot.values.followRate}%，优先检查章节末钩子和长期目标是否足够明确。`
          : "未提供追更。",
        bookshelfDiagnosis: performanceSnapshot.values.bookshelfRate
          ? `加书架 ${performanceSnapshot.values.bookshelfRate}%，优先检查首章是否给出足够强的长期收藏理由。`
          : "未提供加书架率。",
        firstChapterCompletionDiagnosis: performanceSnapshot.values
          .firstChapterCompletionRate
          ? performanceSnapshot.context.isShortForm
            ? `全文完读 ${performanceSnapshot.values.firstChapterCompletionRate}%，优先检查短篇中后段是否持续兑现情绪和付费承诺。`
            : `首章完读 ${performanceSnapshot.values.firstChapterCompletionRate}%，优先检查首章中段是否空转或信息负担过重。`
          : performanceSnapshot.context.isShortForm
            ? "未提供全文完读率。"
            : "未提供首章完读率。",
        avgReadProgressDiagnosis: performanceSnapshot.values.avgReadProgressRate
          ? `平均阅读进度 ${performanceSnapshot.values.avgReadProgressRate}%，优先定位短篇在哪个段落开始掉读。`
          : performanceSnapshot.context.isShortForm
            ? "未提供平均阅读进度。"
            : "长篇场景不作为核心指标。",
        paidUnlockDiagnosis: performanceSnapshot.values.paidUnlockRate
          ? `付费解锁 ${performanceSnapshot.values.paidUnlockRate}%，优先检查付费点前的情绪债、悬念和收益承诺是否足够。`
          : performanceSnapshot.context.isShortForm
            ? "未提供付费解锁率。"
            : "长篇场景不适用。",
        nextChapterClickDiagnosis: performanceSnapshot.values
          .nextChapterClickRate
          ? `章末下一章点击 ${performanceSnapshot.values.nextChapterClickRate}%，优先检查断章钩子是否制造未完成期待。`
          : performanceSnapshot.context.isShortForm
            ? "短篇付费不使用章末下一章点击作为核心指标。"
            : "未提供章末下一章点击率。",
        threeChapterRetentionDiagnosis: performanceSnapshot.values
          .threeChapterRetentionRate
          ? `前3章留存 ${performanceSnapshot.values.threeChapterRetentionRate}%，优先检查前三章承诺是否连续兑现、主线是否稳定。`
          : performanceSnapshot.context.isShortForm
            ? "短篇付费不使用前3章留存作为核心指标。"
            : "未提供前3章留存率。",
        priority: performanceSnapshot.hasData
          ? performanceSnapshot.context.isShortForm
            ? "短篇先看点击、全文完读、平均阅读进度和付费解锁。"
            : "长篇先看点击、30s、首章完读、加书架/收藏、下一章点击、前3章留存和追更。"
          : "先补充平台后台数据，再做漏斗归因。",
      },
      selfTestFit: {
        enabled: aiSelfTest.enabled,
        summary: aiSelfTest.enabled
          ? `演示模式已启用 AI 自测增强：${aiSelfTest.enabledLabels.join("、")}。真实模型会直接根据章节文本执行这些测试，不需要用户手填结果。`
          : "未启用 AI 自测增强。",
        dialogueMaskDiagnosis: aiSelfTest.enabled
          ? "真实模型会遮挡人名检查对话声音辨识度，避免所有角色说话像同一个人。"
          : "未启用。",
        jumpReadDiagnosis: aiSelfTest.enabled
          ? "真实模型会模拟跳读检查主线是否断裂，定位过渡和逻辑割裂风险。"
          : "未启用。",
        emotionDiagnosis: aiSelfTest.enabled
          ? "真实模型会检查情绪是否由动作、场面和选择触发，而不是只写难过、激动等标签。"
          : "未启用。",
        settingRecapDiagnosis: aiSelfTest.enabled
          ? "真实模型会复盘人物身份、关键事件和设定约束，检查前后矛盾。"
          : "未启用。",
        deleteSentenceDiagnosis: aiSelfTest.enabled
          ? "真实模型会检查环境和心理描写是否承担信息、情绪或节奏功能，识别注水段落。"
          : "未启用。",
        aiTraceDiagnosis: aiSelfTest.enabled
          ? "真实模型会识别模板化升华、空泛排比、专属细节不足、句式过齐和说明腔。"
          : "未启用。",
        promptAddons: aiSelfTest.promptAddons,
      },
      nextRevisionMove:
        "配置真实模型后重新评分，重点检查目标、冲突、情绪债和钩子。",
      rewriteBrief: {
        target: "待真实模型判断",
        strategy: "先保持剧情事实，只做目标和冲突增强。",
      },
      revisionPrompt: {
        title: "按网文点评报告局部改写章节",
        prompt: this.buildMockRevisionPrompt(input, {
          styleProfile,
          marketProfile,
          performanceSnapshot,
          aiSelfTest,
        }),
      },
    };
  }

  private buildStyleProfile(input: {
    platform: string;
    audience: string;
    readingMode: string;
  }) {
    return {
      platformLabel:
        labelMaps.platform[input.platform as keyof typeof labelMaps.platform] ||
        input.platform,
      audienceLabel:
        labelMaps.audience[input.audience as keyof typeof labelMaps.audience] ||
        input.audience,
      readingModeLabel:
        labelMaps.readingMode[
          input.readingMode as keyof typeof labelMaps.readingMode
        ] || input.readingMode,
      profile: platformProfiles[input.platform] || platformProfiles.other,
    };
  }

  private buildMarketProfile(input: {
    category: string;
    theme: string;
    tags?: string[];
    explicitKeywords?: string[];
    implicitExpectations?: string[];
    positioningPromise?: string;
  }) {
    return {
      category: input.category,
      theme: input.theme,
      tags: this.cleanList(input.tags),
      explicitKeywords: this.cleanList(input.explicitKeywords),
      implicitExpectations: this.cleanList(input.implicitExpectations),
      positioningPromise: input.positioningPromise?.trim() || "",
    };
  }

  private buildPlatformStrategyProfile(input: {
    recommendationSignals?: string[];
    competitionLevel?: string;
    competitionNotes?: string;
    pushStage?: string;
    trafficEntry?: string[];
  }) {
    const recommendationSignals = this.cleanList(input.recommendationSignals);
    const trafficEntry = this.cleanList(input.trafficEntry);
    const competitionLevel = input.competitionLevel || "unknown";
    const pushStage = input.pushStage || "unknown";
    const competitionLabels: Record<string, string> = {
      low: "低竞争",
      medium: "中等竞争",
      high: "高竞争",
      unknown: "未知",
    };
    const pushStageLabels: Record<string, string> = {
      "cold-start": "冷启动",
      "second-push": "二轮推流",
      stable: "稳定推荐",
      recycle: "复推/召回",
      unknown: "未知",
    };
    const summary = [
      `推荐信号：${recommendationSignals.join("、") || "未提供"}`,
      `赛道竞争：${competitionLabels[competitionLevel] || competitionLevel}`,
      input.competitionNotes?.trim()
        ? `竞争备注：${input.competitionNotes.trim()}`
        : "竞争备注：未提供",
      `推流阶段：${pushStageLabels[pushStage] || pushStage}`,
      `可能入口：${trafficEntry.join("、") || "未提供"}`,
    ].join("；");

    return {
      recommendationSignals,
      competitionLevel,
      competitionLabel: competitionLabels[competitionLevel] || competitionLevel,
      competitionNotes: input.competitionNotes?.trim() || "",
      pushStage,
      pushStageLabel: pushStageLabels[pushStage] || pushStage,
      trafficEntry,
      summary,
    };
  }

  private cleanList(value?: string[]) {
    return [
      ...new Set((value || []).map((item) => item.trim()).filter(Boolean)),
    ];
  }

  private buildPerformanceSnapshot(
    value?: ScoreChapterDto["performanceSnapshot"],
    context?: Pick<ScoreChapterDto, "platform" | "readingMode">,
  ) {
    const isShortForm =
      context?.readingMode === "short-paid" ||
      context?.platform === "wechat-short";
    const isLongSerialization = context?.readingMode === "long-serialization";
    const isAlgorithmPlatform =
      context?.platform === "fanqie" ||
      context?.platform === "qimao" ||
      context?.platform === "wechat-short";
    const values = {
      impressions: value?.impressions,
      clickThroughRate: value?.clickThroughRate,
      validReadRate: value?.validReadRate,
      bottomRate: value?.bottomRate,
      read30sRate: value?.read30sRate,
      read60sRate: value?.read60sRate,
      followRate: value?.followRate,
      bookshelfRate: value?.bookshelfRate,
      firstChapterCompletionRate: value?.firstChapterCompletionRate,
      avgReadProgressRate: value?.avgReadProgressRate,
      paidUnlockRate: value?.paidUnlockRate,
      nextChapterClickRate: value?.nextChapterClickRate,
      threeChapterRetentionRate: value?.threeChapterRetentionRate,
    };
    const labels: Record<keyof typeof values, string> = {
      impressions: "展现量",
      clickThroughRate: "点击率",
      validReadRate: "有效阅读率",
      bottomRate: isShortForm ? "全文触底率" : "触底率",
      read30sRate: "阅读30s",
      read60sRate: isLongSerialization ? "阅读60s（长篇低权重）" : "阅读60s",
      followRate: "追更率",
      bookshelfRate:
        context?.platform === "jinjiang"
          ? "收藏率"
          : context?.platform === "qidian"
            ? "收藏/书架率"
            : isShortForm
              ? "收藏意向"
              : "加书架率",
      firstChapterCompletionRate: isShortForm ? "全文完读率" : "首章完读率",
      avgReadProgressRate: "平均阅读进度",
      paidUnlockRate: "付费解锁率",
      nextChapterClickRate: "章末下一章点击率",
      threeChapterRetentionRate: "前3章留存率",
    };
    const entries = Object.entries(values).filter(
      ([, item]) => item !== undefined,
    ) as Array<[keyof typeof values, number]>;
    const guidance = isShortForm
      ? "当前按短篇付费/小程序文口径归因：核心看点击、有效阅读、全文完读、平均阅读进度、付费解锁；追更、下一章点击、前3章留存不作为核心指标。"
      : isLongSerialization
        ? "当前按长篇追更口径归因：核心看点击、阅读30s、首章完读、加书架/收藏、章末下一章点击、前3章留存和追更；阅读60s只作低权重辅助。"
        : "当前按移动端连载口径归因：核心看点击、有效阅读、阅读30s/60s、触底、加书架/收藏、章末下一章点击和前3章留存。";

    return {
      hasData: entries.length > 0,
      values,
      context: {
        isShortForm,
        isLongSerialization,
        isAlgorithmPlatform,
      },
      guidance,
      summary: entries.length
        ? entries.map(([key, item]) => `${labels[key]}: ${item}`).join(", ")
        : "未提供数据表现快照",
    };
  }

  private buildAiSelfTestProfile(value?: ScoreChapterDto["aiSelfTest"]) {
    const allTests = [
      "dialogue-mask",
      "jump-read",
      "emotion",
      "setting-recap",
      "delete-sentence",
      "ai-trace",
    ];
    const labelMap: Record<string, string> = {
      "dialogue-mask": "遮挡人名测试：删除人物名后检查对话声音是否可区分",
      "jump-read": "跳读测试：随机跳过 3 段后检查主线是否仍连贯",
      emotion: "共情测试：检查情绪是否由场景、动作和选择触发",
      "setting-recap": "复盘设定测试：核对人物身份、关键事件和设定自洽",
      "delete-sentence": "删句测试：检查描写删掉后是否影响剧情和情绪",
      "ai-trace":
        "文本自然度测试：识别模板化升华、空泛排比、专属细节弱、句式过齐和说明腔",
    };
    const promptAddonMap: Record<string, string> = {
      "dialogue-mask":
        "改写时让主要角色的对话在遮掉人名后仍能区分身份、立场和情绪，不要所有人使用同一种句式。",
      "jump-read":
        "改写时补齐关键转场、因果词和行动目标，让读者跳过少量段落后仍能理解主线推进。",
      emotion:
        "改写时用动作、场景反应、具体选择和代价制造情绪，不要只用“难过、激动、愤怒”等标签。",
      "setting-recap":
        "改写时保持人物身份、年龄、能力边界、时间线和关键事件前后一致，新增设定必须服务本章冲突。",
      "delete-sentence":
        "改写时删除或合并不承担信息、情绪、节奏、伏笔功能的环境和心理描写。",
      "ai-trace":
        "改写时删掉模板化升华、空泛排比和说明腔，增加只属于本角色/本场景的细节、动作后果和长线伏笔。",
    };
    const requestedTests = value?.tests?.length ? value.tests : allTests;
    const enabled = value?.enabled !== false && requestedTests.length > 0;
    const tests = enabled
      ? [...new Set(requestedTests)].filter((test) => allTests.includes(test))
      : [];
    const enabledLabels = tests.map((test) => labelMap[test]);

    return {
      enabled,
      tests,
      enabledLabels,
      promptAddons: tests.map((test) => promptAddonMap[test]),
      summary: enabled
        ? `启用。请由模型自行执行这些测试：${enabledLabels.join("；")}。用户不提供测试答案。`
        : "未启用。",
    };
  }

  private buildMockRevisionPrompt(
    input: ScoreChapterDto,
    context: {
      styleProfile: ReturnType<AnalysisService["buildStyleProfile"]>;
      marketProfile: ReturnType<AnalysisService["buildMarketProfile"]>;
      performanceSnapshot: ReturnType<
        AnalysisService["buildPerformanceSnapshot"]
      >;
      aiSelfTest: ReturnType<AnalysisService["buildAiSelfTestProfile"]>;
    },
  ) {
    const { styleProfile, marketProfile, performanceSnapshot, aiSelfTest } =
      context;
    return `
你是负责改文的中文网文写作 AI。请基于下面的定位和问题，对章节做“局部增强式改写”，不要另起炉灶。

目标平台：${styleProfile.platformLabel}
目标读者：${styleProfile.audienceLabel}
阅读场景：${styleProfile.readingModeLabel}
平台风格要求：${JSON.stringify(styleProfile.profile)}

细分分类：${marketProfile.category}
主题承诺：${marketProfile.theme}
标签：${marketProfile.tags.join("、") || "无"}
显性关键词：${marketProfile.explicitKeywords.join("、") || "无"}
隐性期待：${marketProfile.implicitExpectations.join("、") || "无"}
标题/简介承诺：${marketProfile.positioningPromise || "无"}

数据表现：${performanceSnapshot.summary}
数据口径：${performanceSnapshot.guidance}
AI 自测约束：${aiSelfTest.summary}

请优先修改：
1. 前 500 字更早亮出分类卖点和主角目标。
2. 把标签和关键词转化为事件、冲突、情绪债，不要机械堆词。
3. 增强目标平台需要的节奏、情绪反馈和结尾钩子。
4. 保留原章节的基本人物、场景和剧情事实，只调整表达、顺序、冲突强度和钩子。
5. 爽点按“压制、蓄力、反击、兑现、余波”补齐，避免只写主角赢或围观惊呼。
6. 章末钩子必须明确属于悬念、危机、反转、期待、情感或信息揭示，并给下一章前段留下回收点。
7. 删除模板化升华、空泛排比和说明腔，用角色动作、道具细节和具体后果替代。
${aiSelfTest.promptAddons
  .map((item, index) => `${index + 8}. ${item}`)
  .join("\n")}

禁止：
1. 不要新增无关世界观和大量设定说明。
2. 不要把整章改成完全不同的故事。
3. 不要只润色文笔，必须解决目标、冲突、卖点前置和追读问题。
4. 不要输出分析过程。

输出格式：
{
  "revisionStrategy": "一句话说明改写策略",
  "changedSections": ["改动了哪些段落功能"],
  "revisedChapter": "改写后的章节正文",
  "whyItWorks": ["对应解决了哪些追读/点击/留存问题"]
}

待改章节标题：${input.chapterTitle}
待改章节正文：
${input.chapterText}
`.trim();
  }
}
