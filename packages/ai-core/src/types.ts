export type Genre = "xuanhuan" | "urban" | "romance" | "suspense" | "infinite-flow" | "other";

export type ProviderKind = "mock" | "openai-compatible";

export type ProviderPresetId =
  | "mock"
  | "custom"
  | "shared-gpu"
  | "deepseek"
  | "doubao"
  | "qwen"
  | "ollama"
  | "new-api";

export interface ProviderBaseUrlOption {
  label: string;
  url: string;
}

export interface ProviderPreset {
  label: string;
  kind: ProviderKind;
  baseUrl: string;
  baseUrlOptions?: ProviderBaseUrlOption[];
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

export type QuickReviewInputKind = "human-draft" | "ai-draft" | "idea" | "outline" | "prompt";

export type GateDecision = "continue" | "revise" | "rebuild" | "discard";

export type DiagnosisIssueSeverity = "critical" | "high" | "medium" | "low";

export type DiagnosisIssueCategory =
  | "opening"
  | "hook"
  | "character_goal"
  | "conflict_pressure"
  | "payoff"
  | "pacing"
  | "setting_load"
  | "prose_ai_flavor"
  | "prompt_constraint"
  | "market_promise"
  | "other";

export interface DiagnosisEvidenceAnchor {
  quote: string;
  locationHint: string;
  confidence: number;
}

export interface DiagnosisIssue {
  id: string;
  severity: DiagnosisIssueSeverity;
  category: DiagnosisIssueCategory;
  title: string;
  description: string;
  evidence: DiagnosisEvidenceAnchor[];
  readerImpact: string;
  fixAction: string;
  promptConstraint: string;
  blocksNextStep: boolean;
}

export interface MethodologyCard {
  id: string;
  sourceIssueId: string;
  type:
    | "opening_rule"
    | "prompt_rule"
    | "pacing_rule"
    | "hook_rule"
    | "payoff_rule"
    | "anti_pattern";
  title: string;
  triggerProblem: string;
  reusableRule: string;
  selfCheckQuestion: string;
  promptTemplate?: string;
  exampleBefore?: string;
  exampleAfter?: string;
  createdAt?: string;
  usageCount?: number;
}

export interface QuickReviewResult {
  title: string;
  genre: string;
  inputKind?: QuickReviewInputKind;
  positioning: string;
  sellingPoints: string[];
  mainProblem: string;
  actionableFixes: string[];
  recommendedPlatforms: RecommendedPlatform[];
  readyForFullReview: boolean;
  readyReason: string;
  quickScore: number;
  confidence: number;
  gateDecision?: GateDecision;
  gateReason?: string;
  oneLineDiagnosis?: string;
  issues?: DiagnosisIssue[];
  strengths?: Array<{
    title: string;
    evidence?: string;
    keepAction: string;
  }>;
  revisionPlan?: {
    priorityIssueIds: string[];
    keep: string[];
    change: string[];
    avoid: string[];
    checkpoints: string[];
  };
  promptDiagnosis?: {
    originalPrompt?: string;
    missingConstraints: string[];
    vagueInstructions: string[];
    improvedPromptPrinciples: string[];
  };
  nextPrompt?: {
    title: string;
    prompt: string;
    linkedIssueIds: string[];
    whyThisWorks: string[];
  };
  methodologyCards?: MethodologyCard[];
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
