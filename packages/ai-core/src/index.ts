export type Genre = "xuanhuan" | "urban" | "romance" | "suspense" | "infinite-flow" | "other";

export type ProviderKind = "mock" | "openai-compatible";

export type ProviderPresetId = "custom" | "shared-gpu" | "deepseek" | "doubao" | "qwen" | "ollama";

export interface ProviderPreset {
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  modelOptions?: string[];
  jsonMode: boolean;
  needsApiKey: boolean;
  notice?: string;
}

export interface LLMProviderConfig {
  id: string;
  kind: ProviderKind;
  baseUrl?: string;
  model: string;
  apiKeyRef?: string;
  capabilities: {
    jsonMode: boolean;
    streaming: boolean;
    maxContextTokens: number;
  };
}

export interface ReferenceChapterInput {
  title: string;
  genre: Genre;
  text: string;
}

export interface UserChapterInput {
  title: string;
  text: string;
  rubricId: string;
}

export interface StoryPrinciple {
  id: string;
  title: string;
  sourceObservation: string;
  reusableRule: string;
  migrationQuestion: string;
}

export interface RubricMetric {
  id: string;
  name: string;
  description: string;
  scale: {
    low: string;
    medium: string;
    high: string;
  };
}

export interface RubricResult {
  mode: string;
  reference: {
    title: string;
    genre: string;
    platform: string;
    audience: string;
    readingMode: string;
    oneSentenceSummary: string;
  };
  styleProfile?: {
    platform: string;
    audience: string;
    readingMode: string;
    pace: string;
    emotion: string;
    hookDensity: string;
    language: string;
    setupTolerance: string;
  };
  marketProfile?: {
    category: string;
    theme: string;
    tags: string[];
    explicitKeywords: string[];
    implicitExpectations: string[];
    positioningPromise: string;
    readerExpectationModel: string[];
  };
  principles: Array<{
    id: string;
    title: string;
    sourceObservation: string;
    reusableRule: string;
    migrationQuestion: string;
  }>;
  rubric: {
    id: string;
    genre: string;
    platform?: string;
    audience?: string;
    readingMode?: string;
    styleProfile?: Record<string, string>;
    category?: string;
    theme?: string;
    marketProfile?: Record<string, unknown>;
    metrics: RubricMetric[];
  };
  editorNote: string;
}

export interface ScoreResult {
  mode: string;
  chapterTitle: string;
  totalScore: number;
  scores: Array<{
    metricId: string;
    name: string;
    score: number;
    reason: string;
    evidence: string;
    fix: string;
    referencePrincipleId?: string;
  }>;
  strongestPoint: string;
  weakestPoint: string;
  styleFit?: {
    score: number;
    platformRisk: string;
    audienceRisk: string;
    readingModeRisk: string;
  };
  marketFit?: {
    score: number;
    categoryRisk: string;
    themeRisk: string;
    keywordRisk: string;
    frontloadRisk: string;
  };
  platformStrategyFit?: {
    score: number;
    recommendationRisk: string;
    competitionRisk: string;
    pushBottleneck: string;
    trafficEntryAction: string;
  };
  performanceFit?: {
    hasData: boolean;
    funnelSummary: string;
    impressionDiagnosis: string;
    clickDiagnosis: string;
    read30sDiagnosis: string;
    read60sDiagnosis: string;
    bottomDiagnosis: string;
    followDiagnosis: string;
    validReadDiagnosis?: string;
    avgReadProgressDiagnosis?: string;
    paidUnlockDiagnosis?: string;
    bookshelfDiagnosis?: string;
    firstChapterCompletionDiagnosis?: string;
    nextChapterClickDiagnosis?: string;
    threeChapterRetentionDiagnosis?: string;
    priority: string;
  };
  selfTestFit?: {
    enabled: boolean;
    summary: string;
    dialogueMaskDiagnosis: string;
    jumpReadDiagnosis: string;
    emotionDiagnosis: string;
    settingRecapDiagnosis: string;
    deleteSentenceDiagnosis: string;
    aiTraceDiagnosis: string;
    promptAddons: string[];
  };
  nextRevisionMove: string;
  rewriteBrief?: {
    target: string;
    strategy: string;
  };
  revisionPrompt?: {
    title: string;
    prompt: string;
  };
}

export type RecommendedPlatformId =
  | "qidian"
  | "fanqie"
  | "jinjiang"
  | "qimao"
  | "wechat-short"
  | "other";

export interface RecommendedPlatform {
  id: RecommendedPlatformId;
  label: string;
  fit: string;
  reason: string;
}

export interface QuickReviewResult {
  title: string;
  genre: string;
  positioning: string;
  sellingPoints: string[];
  mainProblem: string;
  actionableFixes: string[];
  recommendedPlatforms: RecommendedPlatform[];
  readyForFullReview: boolean;
  readyReason: string;
  quickScore: number;
  confidence: number;
}

export interface MetricScore {
  metricId: string;
  score: number;
  reason: string;
  evidence: string;
  fix: string;
  referencePrincipleId?: string;
}

export interface ChapterScoreReport {
  totalScore: number;
  scores: MetricScore[];
  strongestPoint: string;
  weakestPoint: string;
  nextRevisionMove: string;
}

export const DEFAULT_RUBRIC_METRICS: RubricMetric[] = [
  {
    id: "chapter-goal",
    name: "主角目标清晰度",
    description: "读者是否能快速知道主角这一章想得到什么或避免什么。",
    scale: {
      low: "主角只是被事件推着走，目标不清。",
      medium: "目标存在，但压力和结果不够具体。",
      high: "目标、代价、完成标志都很明确。",
    },
  },
  {
    id: "conflict-pressure",
    name: "冲突压力",
    description: "阻碍是否具体，是否会造成损失、羞辱、危机或机会流失。",
    scale: {
      low: "只有态度冲突，没有实际后果。",
      medium: "有阻碍，但压迫对象或损失不够尖锐。",
      high: "阻碍具体且会逼迫主角立刻行动。",
    },
  },
  {
    id: "emotion-debt",
    name: "情绪债",
    description: "章节是否让读者积累愤怒、期待、心疼、好奇等待兑现情绪。",
    scale: {
      low: "读者没有明显情绪等待释放。",
      medium: "有情绪，但铺垫或延迟不足。",
      high: "情绪债清晰，读者期待主角反击或真相揭开。",
    },
  },
  {
    id: "hook",
    name: "追读钩子",
    description: "结尾是否留下下一章不可延迟的危机、奖励、秘密或反转。",
    scale: {
      low: "自然收尾，没有新期待。",
      medium: "留下问题，但不够紧迫。",
      high: "结尾制造明确升级，读者想立刻进入下一章。",
    },
  },
];

export function createPreviewReport(input: UserChapterInput): ChapterScoreReport {
  const textLength = input.text.trim().length;
  const score = textLength > 800 ? 6.8 : 5.2;

  return {
    totalScore: score,
    strongestPoint: "章节已经具备可分析文本，适合进入指标化质检。",
    weakestPoint: "当前仍需要真实 LLM Provider 读取证据段落后再给出稳定判断。",
    nextRevisionMove: "先检查本章目标、冲突、情绪债和结尾钩子，再决定是否局部改写。",
    scores: DEFAULT_RUBRIC_METRICS.map((metric) => ({
      metricId: metric.id,
      score,
      reason: `${metric.name} 已进入待评估状态。`,
      evidence: "MVP 预览端点不截取原文证据，后续由分析 Worker 生成。",
      fix: `按「${metric.description}」补充可执行改法。`,
    })),
  };
}
