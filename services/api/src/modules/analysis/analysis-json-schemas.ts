const stringSchema = { type: "string" };
const numberSchema = { type: "number" };
const booleanSchema = { type: "boolean" };
const stringArraySchema = { type: "array", items: stringSchema };

function objectSchema(
  properties: Record<string, unknown>,
  required = Object.keys(properties),
) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function arraySchema(items: Record<string, unknown>) {
  return {
    type: "array",
    items,
  };
}

const recommendedPlatformSchema = objectSchema({
  id: {
    type: "string",
    enum: ["qidian", "fanqie", "jinjiang", "qimao", "wechat-short", "other"],
  },
  label: stringSchema,
  fit: stringSchema,
  reason: stringSchema,
});

export const quickReviewJsonSchema = objectSchema({
  title: stringSchema,
  genre: {
    type: "string",
    enum: [
      "xuanhuan",
      "urban",
      "romance",
      "suspense",
      "infinite-flow",
      "other",
    ],
  },
  positioning: stringSchema,
  sellingPoints: stringArraySchema,
  mainProblem: stringSchema,
  actionableFixes: stringArraySchema,
  recommendedPlatforms: arraySchema(recommendedPlatformSchema),
  readyForFullReview: booleanSchema,
  readyReason: stringSchema,
  quickScore: numberSchema,
  confidence: numberSchema,
});

export const referenceProfileJsonSchema = objectSchema({
  mode: stringSchema,
  referenceTitle: stringSchema,
  genre: {
    type: "string",
    enum: [
      "xuanhuan",
      "urban",
      "romance",
      "suspense",
      "infinite-flow",
      "other",
    ],
  },
  category: stringSchema,
  theme: stringSchema,
  tags: stringArraySchema,
  explicitKeywords: stringArraySchema,
  implicitExpectations: stringArraySchema,
  positioningPromise: stringSchema,
  confidence: numberSchema,
  evidence: stringArraySchema,
  notes: stringSchema,
});

const styleProfileSchema = objectSchema({
  platform: stringSchema,
  audience: stringSchema,
  readingMode: stringSchema,
  pace: stringSchema,
  emotion: stringSchema,
  hookDensity: stringSchema,
  language: stringSchema,
  setupTolerance: stringSchema,
  pleasureDensity: stringSchema,
  dataPriority: stringSchema,
});

const marketProfileSchema = objectSchema({
  category: stringSchema,
  theme: stringSchema,
  tags: stringArraySchema,
  explicitKeywords: stringArraySchema,
  implicitExpectations: stringArraySchema,
  positioningPromise: stringSchema,
  readerExpectationModel: stringArraySchema,
});

const platformStrategyProfileSchema = objectSchema({
  recommendationSignals: stringArraySchema,
  competitionLevel: stringSchema,
  competitionRisk: stringSchema,
  pushStage: stringSchema,
  trafficEntry: stringArraySchema,
  strategyNote: stringSchema,
});

const principleSchema = objectSchema({
  id: stringSchema,
  title: stringSchema,
  sourceObservation: stringSchema,
  reusableRule: stringSchema,
  migrationQuestion: stringSchema,
});

const rubricMetricSchema = objectSchema({
  id: stringSchema,
  name: stringSchema,
  description: stringSchema,
  scale: objectSchema({
    low: stringSchema,
    medium: stringSchema,
    high: stringSchema,
  }),
  referencePrincipleId: stringSchema,
});

const rubricBodySchema = objectSchema({
  id: stringSchema,
  genre: stringSchema,
  platform: stringSchema,
  audience: stringSchema,
  readingMode: stringSchema,
  category: stringSchema,
  theme: stringSchema,
  styleProfile: styleProfileSchema,
  marketProfile: marketProfileSchema,
  metrics: arraySchema(rubricMetricSchema),
});

export const rubricJsonSchema = objectSchema({
  mode: stringSchema,
  reference: objectSchema({
    title: stringSchema,
    genre: stringSchema,
    platform: stringSchema,
    audience: stringSchema,
    readingMode: stringSchema,
    oneSentenceSummary: stringSchema,
  }),
  styleProfile: styleProfileSchema,
  marketProfile: marketProfileSchema,
  platformStrategyProfile: platformStrategyProfileSchema,
  principles: arraySchema(principleSchema),
  rubric: rubricBodySchema,
  editorNote: stringSchema,
});

const scoreItemSchema = objectSchema({
  metricId: stringSchema,
  name: stringSchema,
  score: numberSchema,
  reason: stringSchema,
  evidence: stringSchema,
  fix: stringSchema,
  referencePrincipleId: stringSchema,
});

export const scoreJsonSchema = objectSchema({
  mode: stringSchema,
  chapterTitle: stringSchema,
  totalScore: numberSchema,
  scores: arraySchema(scoreItemSchema),
  strongestPoint: stringSchema,
  weakestPoint: stringSchema,
  styleFit: objectSchema({
    score: numberSchema,
    platformRisk: stringSchema,
    audienceRisk: stringSchema,
    readingModeRisk: stringSchema,
  }),
  marketFit: objectSchema({
    score: numberSchema,
    categoryRisk: stringSchema,
    themeRisk: stringSchema,
    keywordRisk: stringSchema,
    frontloadRisk: stringSchema,
  }),
  platformStrategyFit: objectSchema({
    score: numberSchema,
    recommendationRisk: stringSchema,
    competitionRisk: stringSchema,
    pushBottleneck: stringSchema,
    trafficEntryAction: stringSchema,
  }),
  performanceFit: objectSchema({
    hasData: booleanSchema,
    funnelSummary: stringSchema,
    impressionDiagnosis: stringSchema,
    clickDiagnosis: stringSchema,
    validReadDiagnosis: stringSchema,
    read30sDiagnosis: stringSchema,
    read60sDiagnosis: stringSchema,
    bottomDiagnosis: stringSchema,
    followDiagnosis: stringSchema,
    bookshelfDiagnosis: stringSchema,
    firstChapterCompletionDiagnosis: stringSchema,
    avgReadProgressDiagnosis: stringSchema,
    paidUnlockDiagnosis: stringSchema,
    nextChapterClickDiagnosis: stringSchema,
    threeChapterRetentionDiagnosis: stringSchema,
    priority: stringSchema,
  }),
  selfTestFit: objectSchema({
    enabled: booleanSchema,
    summary: stringSchema,
    dialogueMaskDiagnosis: stringSchema,
    jumpReadDiagnosis: stringSchema,
    emotionDiagnosis: stringSchema,
    settingRecapDiagnosis: stringSchema,
    deleteSentenceDiagnosis: stringSchema,
    aiTraceDiagnosis: stringSchema,
    promptAddons: stringArraySchema,
  }),
  nextRevisionMove: stringSchema,
  rewriteBrief: objectSchema({
    target: stringSchema,
    strategy: stringSchema,
  }),
  revisionPrompt: objectSchema({
    title: stringSchema,
    prompt: stringSchema,
  }),
});

const researchFindingSchema = objectSchema({
  claim: stringSchema,
  sourceIds: stringArraySchema,
  promptUse: stringSchema,
});

export const researchQaJsonSchema = objectSchema({
  answer: stringSchema,
  keyFindings: arraySchema(researchFindingSchema),
  sourceGaps: stringArraySchema,
  nextQuestions: stringArraySchema,
});
