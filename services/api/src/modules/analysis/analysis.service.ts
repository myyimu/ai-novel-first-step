import { BadRequestException, Injectable } from "@nestjs/common";
import type {
  QuickReviewResult,
  RecommendedPlatform,
  RecommendedPlatformId,
} from "@ai-novel-first-step/ai-core";
import {
  BookAnalysisJobProgress,
  BookAnalysisJobService,
} from "./book-analysis-job.service";
import { AnalyzeBookDto } from "./dto/analyze-book.dto";
import { BuildRubricDto } from "./dto/build-rubric.dto";
import { PreprocessBookDto } from "./dto/preprocess-book.dto";
import { PreviewAnalysisDto } from "./dto/preview-analysis.dto";
import { ProviderConfigDto } from "./dto/provider-config.dto";
import { QuickReviewDto } from "./dto/quick-review.dto";
import { ScoreChapterDto } from "./dto/score-chapter.dto";
import {
  BookPreprocessResult,
  ChapterSegment,
  TextPreprocessorService,
} from "./text-preprocessor.service";
import { InferReferenceProfileDto } from "./dto/infer-reference-profile.dto";
import { AnalysisPersistenceRepository } from "./analysis-persistence.repository";
import {
  BookExportService,
  type BookExportFormat,
  type BookExportMode,
} from "./book-export.service";
import { BookUploadService, type UploadedTxtFile } from "./book-upload.service";
import {
  quickReviewJsonSchema,
  referenceProfileJsonSchema,
  rubricJsonSchema,
  scoreJsonSchema,
} from "./analysis-json-schemas";
import { extractJson } from "./json-extract";
import { ModelProviderService } from "./model-provider.service";

const metrics = [
  {
    metricId: "chapter-goal",
    name: "主角目标清晰度",
    fix: "把本章目标写成读者能立刻理解的一句话，并补上失败代价。",
  },
  {
    metricId: "conflict-pressure",
    name: "冲突压力",
    fix: "把阻碍改成具体损失，例如资格、资源、身份、关系或生命风险。",
  },
  {
    metricId: "emotion-debt",
    name: "情绪债",
    fix: "增加可被兑现的羞辱、误解、秘密或承诺，让读者等待释放。",
  },
  {
    metricId: "hook",
    name: "追读钩子",
    fix: "结尾加入更高一级的危机、奖励、身份暴露风险或反转信息。",
  },
];

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
export class AnalysisService {
  constructor(
    private readonly textPreprocessor: TextPreprocessorService,
    private readonly bookJobs: BookAnalysisJobService,
    private readonly bookUploads: BookUploadService,
    private readonly modelProviders: ModelProviderService,
    private readonly persistence: AnalysisPersistenceRepository,
    private readonly bookExports: BookExportService,
  ) {}

  previewScore(input: PreviewAnalysisDto) {
    const score = input.text.length > 800 ? 6.8 : 5.2;

    return {
      productName: "新手AI小说第一步",
      mode: "mock-preview",
      title: input.title,
      rubricId: input.rubricId,
      totalScore: score,
      strongestPoint: "API 链路已可接收章节并返回结构化评分报告。",
      weakestPoint:
        "尚未接入用户自己的 LLM Key，证据段落与真实评分由 Worker 补齐。",
      nextRevisionMove: "先跑通目标、冲突、情绪债、追读钩子四项硬指标。",
      scores: metrics.map((metric) => ({
        metricId: metric.metricId,
        name: metric.name,
        score,
        reason: `${metric.name} 已进入预览评分，正式任务会要求模型给出文本证据。`,
        evidence: "preview endpoint does not quote user text",
        fix: metric.fix,
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

    const content = await this.modelProviders.chat(
      provider,
      [
        {
          role: "system",
          content:
            "你是资深中文网文编辑。读完章节后给出快速点评。只返回合法 JSON，不使用 Markdown，不解释过程。",
        },
        {
          role: "user",
          content: `请阅读以下章节，给出快速点评。

章节标题：${input.title || "未提供"}
类型：${input.genre || "请自行判断"}

章节正文：
${textSample}

严格返回这个 JSON 结构：
{
  "title": "章节标题（如正文有标题则用正文的）",
  "genre": "xuanhuan | urban | romance | suspense | infinite-flow | other",
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
  "confidence": 0.8
}

要求：
1. genre 只能选 xuanhuan、urban、romance、suspense、infinite-flow、other 之一。
2. quickScore 是 0-10 分，代表网文追读吸引力的快速估分。
3. actionableFixes 必须是具体可执行的改法，不要空洞建议。
4. recommendedPlatforms 返回 1-3 个中文网文平台，优先从 qidian、fanqie、jinjiang、qimao、wechat-short 中选择。
5. fit 只能写“优先发布”“可作为第二选择”或“更适合短篇测试”之一。
6. confidence 是 0 到 1 的数字，文本太短时降低。
7. 每个字段都要简短，确保完整 JSON 可以在 512 token 内返回。`,
        },
      ],
      {
        maxOutputTokens: 1400,
        jsonSchema: {
          name: "quick_review_result",
          schema: quickReviewJsonSchema,
        },
      },
    );

    return this.normalizeQuickReviewResult(
      await this.parseJsonWithRepair(provider, content, "章节急诊"),
      input,
    );
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

    return {
      title: this.asText(source.title) || input.title || "未命名章节",
      genre,
      positioning:
        this.asText(source.positioning) ||
        "模型没有返回明确定位，请重试或进入完整点评。",
      sellingPoints: this.asTextList(source.sellingPoints).slice(0, 4),
      mainProblem:
        this.asText(source.mainProblem) ||
        "模型没有返回明确问题，请重试或进入完整点评。",
      actionableFixes: this.asTextList(source.actionableFixes).slice(0, 4),
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
        this.asText(source.readyReason) ||
        "如果结果不完整，建议重试一次或进入完整评分。",
      quickScore: this.clampNumber(source.quickScore, 0, 10, 0),
      confidence: this.clampNumber(source.confidence, 0, 1, 0.5),
    };
  }

  private normalizeQuickReviewGenre(value: unknown) {
    const genre = this.asText(value).toLowerCase();
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

  private asText(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private asTextList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => this.asText(item))
      .filter((item) => item.length > 0);
  }

  private clampNumber(
    value: unknown,
    min: number,
    max: number,
    fallback: number,
  ): number {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, numeric));
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
      label: this.asText(source.label) || recommendedPlatformLabels[id],
      fit: this.normalizeRecommendedFit(source.fit),
      reason:
        this.asText(source.reason) ||
        "题材和节奏与该平台当前常见消费方式更匹配。",
    };
  }

  private normalizeRecommendedPlatformId(
    value: unknown,
  ): RecommendedPlatformId | null {
    const platformId = this.asText(
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
    const fit = this.asText(value);
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

    return {
      title: input.title || "未命名章节",
      genre,
      positioning: "本地演示模式只验证快速点评结构，不调用外部模型。",
      sellingPoints: ["已有章节正文入口", "可以进入完整 Rubric 评分流程"],
      mainProblem: "演示模式不会判断真实剧情质量。",
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

    return this.parseJsonWithRepair(
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
      return await this.parseJsonWithRepair(
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
      [
        {
          role: "system",
          content:
            "你是严谨的中文网文点评官。你只返回合法 JSON，所有评分必须给出具体证据和可执行改法。",
        },
        {
          role: "user",
          content: this.scoreChapterPrompt(input),
        },
      ],
      {
        maxOutputTokens: 3072,
        jsonSchema: {
          name: "score_result",
          schema: scoreJsonSchema,
        },
      },
    );

    return this.parseJsonWithRepair(input.provider, content, "章节评分");
  }

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
    return this.bookJobs.get(jobId, options);
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

    const job = await this.bookJobs.get(jobId, { includeResult: true });
    if (job.status !== "succeeded" || !job.result) {
      throw new BadRequestException(
        "Only succeeded book-analysis jobs can be searched.",
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
    const uploads = await this.persistence.listUploads(limit);
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
    const job = await this.bookJobs.get(jobId);
    if (job.status !== "succeeded" || !job.result) {
      throw new BadRequestException(
        "Only succeeded jobs with results can be exported.",
      );
    }

    return this.bookExports.export(job.result, format, mode);
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

  private async parseJsonWithRepair(
    provider: ProviderConfigDto,
    content: string,
    taskLabel: string,
  ) {
    try {
      return extractJson(content);
    } catch (error) {
      if (provider.kind === "mock") {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown JSON parse error";
      const repaired = await this.modelProviders.chat(
        provider,
        [
          {
            role: "system",
            content:
              "你是 JSON 修复器。把用户提供的内容修复成合法 JSON。只返回修复后的 JSON，不要解释，不要 Markdown。",
          },
          {
            role: "user",
            content: `下面是 ${taskLabel} 的模型原始输出。它应该是 JSON，但当前无法解析。

请尽量保留原始字段和值，只修复 JSON 语法问题。如果有明显截断或缺失，优先保留能确定的结构，不要编造新字段。

解析错误：
${errorMessage}

原始输出：
${content}`,
          },
        ],
        { maxOutputTokens: 3200 },
      );

      try {
        return extractJson(repaired);
      } catch (repairError) {
        const repairMessage =
          repairError instanceof Error
            ? repairError.message
            : "Unknown repaired JSON parse error";
        throw new BadRequestException(
          `${errorMessage}；自动修复后仍无法解析：${repairMessage}`,
        );
      }
    }
  }

  private parseJson(content: string) {
    return extractJson(content);
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

  private normalizeBookAnalysisResult(input: AnalyzeBookDto, value: unknown) {
    const defaults = this.mockBookAnalysis(input);
    const source = (value || {}) as Record<string, any>;
    const defaultRecord = defaults as Record<string, any>;

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
      characters: this.arrayOrDefault(source.characters, defaults.characters),
      relationships: {
        ...defaults.relationships,
        ...source.relationships,
        nodes: this.arrayOrDefault(
          source.relationships?.nodes,
          defaults.relationships.nodes,
        ),
        edges: this.arrayOrDefault(
          source.relationships?.edges,
          defaults.relationships.edges,
        ),
      },
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
      this.asTextList(raw.evidenceSnippets)
        .concat(
          (raw.sourceAnchors || []).map((item) => this.asText(item?.quote)),
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
        this.asTextList(raw.characterSignals).length > 0
          ? this.asTextList(raw.characterSignals)
          : fallback?.characterSignals || [],
      worldbuildingSignals:
        this.asTextList(raw.worldbuildingSignals).length > 0
          ? this.asTextList(raw.worldbuildingSignals)
          : fallback?.worldbuildingSignals || [],
      relationshipSignals:
        this.asTextList(raw.relationshipSignals).length > 0
          ? this.asTextList(raw.relationshipSignals)
          : fallback?.relationshipSignals || [],
      timelineEvents:
        this.asTextList(raw.timelineEvents).length > 0
          ? this.asTextList(raw.timelineEvents)
          : fallback?.timelineEvents || [],
      emotionalBeats:
        this.asTextList(raw.emotionalBeats).length > 0
          ? this.asTextList(raw.emotionalBeats)
          : fallback?.emotionalBeats || [],
      foreshadowingSetups:
        this.asTextList(raw.foreshadowingSetups).length > 0
          ? this.asTextList(raw.foreshadowingSetups)
          : fallback?.foreshadowingSetups || [],
      payoffSignals:
        this.asTextList(raw.payoffSignals).length > 0
          ? this.asTextList(raw.payoffSignals)
          : fallback?.payoffSignals || [],
      sourceRiskSignals:
        this.asTextList(raw.sourceRiskSignals).length > 0
          ? this.asTextList(raw.sourceRiskSignals)
          : fallback?.sourceRiskSignals || [],
      originalizationSeeds:
        this.asTextList(raw.originalizationSeeds).length > 0
          ? this.asTextList(raw.originalizationSeeds)
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
        label: this.asText(item?.label) || `证据 ${index + 1}`,
        quote: this.asText(item?.quote),
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

    const raw = (await this.parseJsonWithRepair(
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

    const raw = (await this.parseJsonWithRepair(
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

    return this.parseJsonWithRepair(input.provider, content, "整书汇总");
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

  private bookChapterOutlinePrompt(
    input: AnalyzeBookDto,
    chapter: ChapterSegment,
  ): string {
    return `
You are building a lightweight outline index for one chunk of a long web novel.
Focus on structural signals instead of exhaustive interpretation.

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
  "summary": "one-sentence summary",
  "plotFunction": "what this chunk does in the larger story",
  "chapterGoal": "visible goal in this chunk",
  "conflict": "main conflict or pressure in this chunk",
  "characterSignals": ["short factual signals"],
  "worldbuildingSignals": ["short factual signals"],
  "relationshipSignals": ["short factual signals"],
  "timelineEvents": ["event cards"],
  "emotionalBeats": ["short beats"],
  "foreshadowingSetups": ["open threads or setups"],
  "payoffSignals": ["resolved expectations or payoffs"],
  "sourceRiskSignals": ["copy-risk names, terms, or chains"],
  "originalizationSeeds": ["transferable structural seeds"],
  "hook": "core suspense / turn / expectation hook",
  "evidenceSnippets": ["up to 3 short quotes, each <= 24 chars"],
  "sourceAnchors": [
    {
      "label": "evidence label",
      "quote": "short exact quote <= 24 chars"
    }
  ]
}
Requirements:
1. Only analyze the visible chunk.
2. Keep each field concise.
3. Evidence must come from this chunk exactly.
4. Prefer indexing signals over long explanation.
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
4. 所有字段尽量短，优先输出结构化事实卡片，而不是长段解释。`.trim();
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
    "nodes": [{"id":"c1","label":"角色","type":"character|faction|location"}],
    "edges": [{"source":"c1","target":"c2","label":"关系","tension":"冲突/依赖/暧昧/师徒等"}]
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
`.trim();
  }

  private analyzeBookPrompt(input: AnalyzeBookDto): string {
    return `
请把一本文本小说拆解成可复用的创作资产。目标不是复刻原作，而是帮助作者理解结构，并导出“原创化”角色/世界书/写作约束。

作品标题：${input.title}
作品题材：${input.genre}

小说正文：
${input.text}

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
    "nodes": [{"id":"c1","label":"角色","type":"character|faction|location"}],
    "edges": [{"source":"c1","target":"c2","label":"关系","tension":"冲突/依赖/暧昧/师徒等"}]
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
1. 不要大段复述原文。
2. 可以保留原作拆解笔记，但必须和原创化导出包分区。
3. 原作拆解笔记用于学习、研究、合法授权或个人私用场景；原创化导出包用于低风险迁移。
4. 不要鼓励未授权商业化复制原作姓名、专有名词、人物关系网、关键事件链。
5. 对角色和世界观必须同时输出“原作拆解笔记”和“抽象原型 + 原创化导出卡”。
6. 如果输入文本很长，只基于当前可见文本做分析，并在结果中提示 chapterCountEstimate 是估算。
7. transferableStyleCard 只描述可迁移写法，不要鼓励“仿写某作者”；必须覆盖叙事声音、句式节奏、段落、对白、爽点、钩子和反面清单。
8. referenceBoundaryCheck 必须替代模糊的“原创化风险”，用“可学/不可复用/必须改造/安全迁移”说清边界。
9. writingSupport 必须服务“后续继续写”，重点输出章节功能、伏笔回收、情绪点、节奏风险和可复制给写作 AI 的续写提示词。
10. generationAssets 必须服务“导入 AI 写作软件/世界书/长期续写”，世界书条目要有 keys、category、priority、sourceRisk 和 originalizationNote。
`.trim();
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
请使用给定 Rubric 质检用户章节。你要像网文编辑一样严格打分，并指出具体证据、问题和改法。

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

用户章节标题：${input.chapterTitle}

用户章节：
${input.chapterText}

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
          { id: "c1", label: "原创主角名", type: "character" },
          { id: "f1", label: "原创评审机构", type: "faction" },
          { id: "l1", label: "公开考核场", type: "location" },
        ],
        edges: [
          { source: "c1", target: "f1", label: "被压制/反击", tension: "冲突" },
          {
            source: "c1",
            target: "l1",
            label: "身份被公开评价",
            tension: "压力",
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
