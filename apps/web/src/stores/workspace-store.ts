import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
	ProviderKind,
	ProviderPresetId,
	QuickReviewResult,
	RubricMetric,
	RubricResult,
	ScoreResult,
} from "@ai-novel-diagnosis/ai-core";

export type {
	ProviderKind,
	ProviderPresetId,
	QuickReviewResult,
	RubricMetric,
	RubricResult,
	ScoreResult,
};

export interface ProviderForm {
	preset: ProviderPresetId;
	kind: ProviderKind;
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature: number;
	jsonMode: boolean;
}

export const defaultProvider: ProviderForm = {
	preset: "shared-gpu",
	kind: "openai-compatible",
	baseUrl: "",
	apiKey: "",
	model: "",
	temperature: 0.2,
	jsonMode: false,
};

export type ScoreProgressStatus = "pending" | "checking" | "completed" | "failed";
export type AiSelfTestId =
	| "dialogue-mask"
	| "jump-read"
	| "emotion"
	| "setting-recap"
	| "delete-sentence"
	| "ai-trace";

export type ReferenceProfileProgressStepId = "sample" | "model" | "apply";

export interface ReferenceProfileProgressItem {
	id: ReferenceProfileProgressStepId;
	name: string;
	status: ScoreProgressStatus;
	detail?: string;
	facts?: Array<{
		label: string;
		value: string;
	}>;
}

export interface ScoreProgressItem {
	metricId: string;
	name: string;
	status: ScoreProgressStatus;
	score?: number;
	reason?: string;
	evidence?: string;
	fix?: string;
}

export interface AiSelfTest {
	id: AiSelfTestId;
	name: string;
	description: string;
}

export const defaultReferenceText =
	"少年站在家族演武场中央，长老当众宣布取消他的试炼资格。围观的人群低声讥笑，未婚妻也转身站到他的对手身边。少年没有辩解，只是盯着石碑上即将熄灭的名字。他知道，一旦名字彻底暗下去，母亲留下的药田也会被收回。就在长老准备落印时，石碑深处忽然亮起第二道从未出现过的金纹。";

export const defaultUserText =
	"主角进入考场，发现大家都看不起他。他想证明自己，于是准备参加测试。考官宣布规则后，主角走到队伍最后，等待自己的名字被叫到。就在这时，他看见考官腰间挂着三年前害死师父的玉牌，意识到这场测试背后还有更大的阴谋。";

export const defaultBookText = `${defaultReferenceText}

第二章 旧案信物
主角回到住处后，发现那枚玉牌与师父留下的残图纹路一致。他没有立刻声张，而是查阅旧卷，确认三年前的事故并非意外。与此同时，评审机构内部有人开始追查他的身份。

第三章 初次反击
第二轮测试中，主角被安排到最差的位置。对手以为他毫无还手之力，却没想到他用一枚普通银针改变了局势。围观者第一次意识到，这个被取消资格的人并不简单。

第四章 暗线浮出
考核结束后，主角没有接受旁人的道歉。他把玉牌、残图和考场名单放在一起，发现所有线索都指向同一个失踪多年的评审长。夜里，有人潜入他的住处，想要取走残图。主角故意放走对方，只在对方衣角留下银针记号。

第五章 更大危机
第二天，主角收到一封匿名信。信里没有解释旧案，只写着一句话：如果你继续查下去，三年前没死的人都会死。主角这才明白，自己面对的不是一次考核不公，而是一张隐藏在整个城市背后的关系网。`;

export const aiSelfTests: AiSelfTest[] = [
	{
		id: "dialogue-mask",
		name: "遮挡人名",
		description: "AI 删除人物名后检查对话能否区分角色声音和立场。",
	},
	{
		id: "jump-read",
		name: "跳读连贯",
		description: "AI 模拟跳过 3 段，检查主线是否断层、转场是否缺因果。",
	},
	{
		id: "emotion",
		name: "共情强度",
		description: "AI 判断情绪是否由动作、场面和选择触发，而不是只写情绪词。",
	},
	{
		id: "setting-recap",
		name: "设定复盘",
		description: "AI 核对人物身份、时间线、关键事件和能力边界是否前后自洽。",
	},
	{
		id: "delete-sentence",
		name: "删句注水",
		description: "AI 检查环境和心理描写是否承担推进、情绪、伏笔或节奏功能。",
	},
	{
		id: "ai-trace",
		name: "文本自然度",
		description: "AI 识别模板化升华、空泛排比、专属细节弱和说明腔风险。",
	},
];

type StoreSetter<T> = (value: T | ((current: T) => T)) => void;

function resolveStoreValue<T>(value: T | ((current: T) => T), current: T): T {
	return typeof value === "function" ? (value as (current: T) => T)(current) : value;
}

export interface BookAnalysisResult {
	mode: string;
	book: {
		title: string;
		genre: string;
		chapterCountEstimate: number;
		oneSentencePremise: string;
		coreAppeal: string[];
	};
	transferableStyleCard?: {
		coreStyleTags: string[];
		narrativeVoice: string;
		sentenceRhythm: string;
		paragraphPattern: string;
		dialoguePattern: string;
		sensoryFocus: string[];
		pleasureMechanisms: string[];
		hookPatterns: string[];
		styleRules: string[];
		antiPatterns: string[];
	};
	worldbuilding: {
		worldRules: string[];
		powerSystem: string[];
		locations: Array<{ name: string; function: string; originalizationNote: string }>;
		factions: Array<{
			name: string;
			goal: string;
			conflictRole: string;
			originalizationNote: string;
		}>;
		itemsAndTerms: Array<{ name: string; function: string; risk: string }>;
	};
	characters: Array<{
		sourceName: string;
		role: string;
		archetype: string;
		personalityCore: string[];
		desire: string;
		fearOrWound: string;
		capability: string;
		relationshipFunction: string;
		names?: string[];
		mainCharacter?: boolean;
		portraitPrompt?: string;
		originalCharacterCard: {
			namePlaceholder: string;
			summary: string;
			personality: string;
			scenario: string;
			firstMessage: string;
			doNotCopy: string[];
		};
	}>;
	relationships: {
		nodes: Array<{
			id: string;
			label: string;
			type: string;
			names?: string[];
			mainCharacter?: boolean;
			description?: string;
			portraitPrompt?: string;
		}>;
		edges: Array<{
			source: string;
			target: string;
			label: string;
			tension: string;
			relation?: string[];
			weight?: number;
			positivity?: number;
			evidence?: string[];
			firstSeenChapter?: number;
			confidence?: number;
		}>;
		duplicateMergeCount?: number;
	};
	relationshipGraphQuality?: {
		nodeCount: number;
		edgeCount: number;
		duplicateMergeCount: number;
		averageConfidence: number;
		evidenceCoverage: number;
		riskLevel: "good" | "needs-review" | "weak";
		isolatedNodes: Array<{
			id: string;
			label: string;
			type: string;
			suggestedQuery?: string;
			reviewAction?: string;
		}>;
		weakEvidenceEdges: Array<{
			source: string;
			target: string;
			sourceLabel?: string;
			targetLabel?: string;
			label: string;
			confidence: number;
			evidenceCount: number;
			reason: string;
			suggestedQuery?: string;
			reviewAction?: string;
		}>;
		recommendedFixes: string[];
	};
	plotlines: Array<{
		name: string;
		type: string;
		start: string;
		turningPoints: string[];
		payoff: string;
		reusablePattern: string;
	}>;
	chronicle: Array<{
		order: number;
		event: string;
		impact: string;
		storyFunction: string;
	}>;
	historyBook: {
		ancientHistory: string[];
		recentHistory: string[];
		publicMyths: string[];
		hiddenTruths: string[];
	};
	writingSupport?: {
		chapterFunctionTable: Array<{
			chapterOrder: number;
			title: string;
			function: string;
			goal: string;
			conflict: string;
			hook: string;
		}>;
		foreshadowingLedger: Array<{
			setup: string;
			setupChapter: number;
			payoff: string;
			status: string;
			risk: string;
		}>;
		emotionalBeatMap: Array<{
			chapterOrder: number;
			beats: string[];
			intensity: string;
			readerPromise: string;
		}>;
		pacingCurve: Array<{
			chapterOrder: number;
			informationDensity: string;
			conflictIntensity: string;
			hookStrength: string;
			risk: string;
		}>;
		readerPromiseChecklist: Array<{
			promise: string;
			evidence: string;
			status: string;
			nextCheck: string;
		}>;
		conflictMatrix: Array<{
			parties: string[];
			conflict: string;
			level: string;
			nextEscalation: string;
		}>;
		continuationPack: {
			currentState: string;
			nextChapterGoal: string;
			openThreads: string[];
			oocGuards: string[];
			settingGuards: string[];
			styleConstraints: string[];
			aiPrompt: string;
		};
		qualityDiagnosis: {
			strengths: string[];
			weaknesses: string[];
			priorityFixes: string[];
		};
	};
	generationAssets?: {
		worldBook: {
			entries: Array<{
				keys: string[];
				secondaryKeys: string[];
				category: string;
				content: string;
				insertionOrder: number;
				priority: number;
				constant: boolean;
				selective: boolean;
				sourceRisk: string;
				originalizationNote: string;
			}>;
			activationRules: string[];
			importNotes: string;
		};
		styleBible: {
			narrativePOV: string;
			toneKeywords: string[];
			proseRules: string[];
			dialogueRules: string[];
			tabooList: string[];
		};
		volumePlan: Array<{
			volume: string;
			goal: string;
			mainConflict: string;
			climax: string;
			endingHook: string;
		}>;
		sceneTemplates: Array<{
			name: string;
			useWhen: string;
			beats: string[];
			avoid: string[];
		}>;
		characterVoiceGuide: Array<{
			character: string;
			speechStyle: string;
			catchphrases: string[];
			forbiddenTone: string[];
		}>;
		antagonistPressurePlan: Array<{
			antagonist: string;
			pressureMethod: string;
			escalationSteps: string[];
			defeatCost: string;
		}>;
		titleSynopsisKeywordPack: {
			titleKeywords: string[];
			synopsisSellingPoints: string[];
			searchTags: string[];
			openingKeywords: string[];
		};
		consistencyChecklist: string[];
	};
	sourceAssetArchive?: {
		usageNotice: string;
		sourceCharacterNotes: Array<{
			name: string;
			role: string;
			recognizableTraits: string[];
			relationshipNotes: string[];
			plotFunction: string;
		}>;
		sourceWorldNotes: string[];
		sourceTimelineNotes: string[];
		sourceRelationshipNotes: string[];
		sourceTermNotes: string[];
	};
	exportPackage: {
		tavernCharacterCards: Array<{
			name: string;
			description: string;
			personality: string;
			scenario: string;
			first_mes: string;
			creator_notes: string;
		}>;
		worldBookEntries: Array<{
			keys: string[];
			content: string;
			insertion_order: number;
		}>;
		writingConstraints: string[];
		doNotCopyList: string[];
	};
	originalizationReport: {
		riskLevel: string;
		safeToLearn: string[];
		mustTransform: string[];
		fanFictionWarning: string;
		rewriteStrategy: string[];
	};
	referenceBoundaryCheck?: {
		summary: string;
		learnablePatterns: string[];
		doNotReuse: string[];
		needsTransformation: string[];
		nameAndTermRisks: string[];
		plotSimilarityRisks: string[];
		safeRewriteMoves: string[];
	};
	usageRiskNotice?: {
		summary: string;
		recommendedUse: string[];
		higherRiskUse: string[];
		userResponsibility: string;
	};
	preprocessing?: BookPreprocessingPreview;
	mapReduce?: {
		strategy: string;
		mapCount: number;
		chunkCount?: number;
		outlineCount?: number;
		deepCount?: number;
		deepTargetOrders?: number[];
		chapterMaps: Array<{
			chapterId: string;
			order: number;
			title: string;
			chunkStartOffset?: number;
			chunkEndOffset?: number;
			splitBy?: "heading" | "auto-chunk";
			summary: string;
			plotFunction: string;
			hook: string;
			evidenceSnippets?: string[];
			sourceAnchors?: Array<{
				anchorId: string;
				label: string;
				quote: string;
				startOffset: number;
				endOffset: number;
			}>;
		}>;
		chunkEvidenceIndex?: Array<{
			chapterId: string;
			order: number;
			title: string;
			summary: string;
			plotFunction: string;
			hook: string;
			chunkStartOffset: number;
			chunkEndOffset: number;
			splitBy: "heading" | "auto-chunk";
			keywords: string[];
			evidenceSnippets: string[];
			sourceAnchors: Array<{
				anchorId: string;
				label: string;
				quote: string;
				startOffset: number;
				endOffset: number;
			}>;
		}>;
		reducerNote: string;
	};
}

export interface BookPreprocessingPreview {
	cleaning: {
		rawLength: number;
		cleanedLength: number;
		paragraphCount: number;
		removedNoise: string[];
	};
	chapters: Array<{
		id: string;
		order: number;
		title: string;
		charCount: number;
		wordCount: number;
		startOffset: number;
		endOffset: number;
		splitBy: "heading" | "auto-chunk";
	}>;
}

export interface BookAnalysisJob {
	id: string;
	type: "book-map-reduce-analysis";
	status: "queued" | "running" | "succeeded" | "failed";
	inputSummary: {
		title: string;
		genre: string;
		textLength: number;
	};
	progress: {
		stage: "queued" | "preprocess" | "map" | "reduce" | "succeeded" | "failed";
		current: number;
		total: number;
		message: string;
	};
	preprocessing?: BookPreprocessingPreview;
	partialResult?: {
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
	};
	result?: BookAnalysisResult;
	error?: string;
	uploadId?: string;
}

export interface BookUploadPreview {
	id: string;
	title: string;
	genre: string;
	originalFilename: string;
	rawLength: number;
	cleanedLength: number;
	chapterCount: number;
	preprocessing: BookPreprocessingPreview;
	createdAt: string;
	updatedAt: string;
}

export interface PersistedResearchLibrary {
	mode: string;
	updatedAt: string;
	sourceSummary: {
		totalJobs: number;
		completedBooks: number;
		runningJobs: number;
		failedJobs: number;
		comparisonReadiness:
			| "ready-for-pattern-mining"
			| "ready-for-basic-compare"
			| "needs-more-samples";
	};
	graphAssets: Array<{
		jobId: string;
		title: string;
		genre: string;
		nodeCount: number;
		edgeCount: number;
		nodeBreakdown: Record<string, number>;
		sourceCoverage: string[];
		riskLevel: string;
	}>;
	comparisonSamples: Array<{
		jobId: string;
		title: string;
		genre: string;
		coreAppeal: string[];
		availableSignals: string[];
		compareUse: string;
	}>;
	questionTemplates: string[];
	recommendedNextActions: string[];
}

export interface ResearchComparisonResult {
	mode: string;
	updatedAt: string;
	focus: string;
	sampleCount: number;
	samples: Array<{
		jobId: string;
		title: string;
		genre: string;
		openingPromise: string;
		coreAppeal: string[];
		appealCombination: string;
		readerPromises: string[];
		emotionStrategy: string;
		hookStrategy: string;
		reusablePatterns: string[];
		originalitySignals: string[];
		riskBoundary: string[];
		sourceCoverage: string[];
	}>;
	commonPatterns: string[];
	differentiationMap: Array<{
		jobId: string;
		title: string;
		genre: string;
		uniqueSignals: string[];
		reusableStrengths: string[];
		riskBoundary: string[];
	}>;
	evidenceMatrix: Array<{
		jobId: string;
		title: string;
		openingPromise: string;
		appealCombination: string;
		emotionStrategy: string;
		hookStrategy: string;
		sourceCoverage: string[];
	}>;
	beginnerTakeaways: string[];
	promptSeed?: string;
	limits: string;
}

export interface ResearchQaResult {
	mode: string;
	answerMode: string;
	question: string;
	answer: string;
	keyFindings: Array<{
		claim: string;
		sourceIds: string[];
		promptUse: string;
	}>;
	sourceGaps: string[];
	nextQuestions: string[];
	citations: Array<{
		sourceId: string;
		title: string;
		field: string;
		snippet: string;
	}>;
}

export interface CachedQuickReview {
	key: string;
	updatedAt: string;
	title: string;
	genre: string;
	result: QuickReviewResult;
}

export interface CachedRubricResult {
	key: string;
	updatedAt: string;
	referenceTitle: string;
	result: RubricResult;
}

export interface CachedScoreResult {
	key: string;
	updatedAt: string;
	chapterTitle: string;
	result: ScoreResult;
}

export interface CachedBookAnalysis {
	key: string;
	updatedAt: string;
	bookTitle: string;
	job: BookAnalysisJob;
	result: BookAnalysisResult | null;
}

export interface WorkspaceStoreState {
	provider: ProviderForm;
	referenceTitle: string;
	genre: string;
	platform: string;
	audience: string;
	readingMode: string;
	category: string;
	theme: string;
	tags: string;
	explicitKeywords: string;
	implicitExpectations: string;
	positioningPromise: string;
	recommendationSignals: string;
	competitionLevel: string;
	competitionNotes: string;
	pushStage: string;
	trafficEntry: string;
	impressions: string;
	clickThroughRate: string;
	validReadRate: string;
	read30sRate: string;
	read60sRate: string;
	bottomRate: string;
	followRate: string;
	bookshelfRate: string;
	firstChapterCompletionRate: string;
	nextChapterClickRate: string;
	threeChapterRetentionRate: string;
	avgReadProgressRate: string;
	paidUnlockRate: string;
	aiSelfTestEnabled: boolean;
	enabledAiSelfTests: AiSelfTestId[];
	referenceText: string;
	referenceFileName: string;
	chapterTitle: string;
	chapterText: string;
	quickReviewGenre: string;
	rubricResult: RubricResult | null;
	scoreResult: ScoreResult | null;
	quickReviewResult: QuickReviewResult | null;
	referenceProfileProgress: ReferenceProfileProgressItem[];
	scoreProgress: ScoreProgressItem[];
	bookTitle: string;
	bookGenre: string;
	bookText: string;
	bookFile: File | null;
	bookUpload: BookUploadPreview | null;
	bookHistory: BookAnalysisJob[];
	uploadHistory: BookUploadPreview[];
	bookAnalysisResult: BookAnalysisResult | null;
	bookJob: BookAnalysisJob | null;
	persistedResearchLibrary: PersistedResearchLibrary | null;
	selectedResearchJobIds: string[];
	comparisonFocus: string;
	researchComparison: ResearchComparisonResult | null;
	researchQuestion: string;
	researchQaResult: ResearchQaResult | null;
	quickReviewCache: CachedQuickReview[];
	rubricCache: CachedRubricResult[];
	scoreCache: CachedScoreResult[];
	bookAnalysisCache: CachedBookAnalysis[];
}

interface WorkspaceStoreActions {
	setProvider: StoreSetter<ProviderForm>;
	setReferenceTitle: StoreSetter<string>;
	setGenre: StoreSetter<string>;
	setPlatform: StoreSetter<string>;
	setAudience: StoreSetter<string>;
	setReadingMode: StoreSetter<string>;
	setCategory: StoreSetter<string>;
	setTheme: StoreSetter<string>;
	setTags: StoreSetter<string>;
	setExplicitKeywords: StoreSetter<string>;
	setImplicitExpectations: StoreSetter<string>;
	setPositioningPromise: StoreSetter<string>;
	setRecommendationSignals: StoreSetter<string>;
	setCompetitionLevel: StoreSetter<string>;
	setCompetitionNotes: StoreSetter<string>;
	setPushStage: StoreSetter<string>;
	setTrafficEntry: StoreSetter<string>;
	setImpressions: StoreSetter<string>;
	setClickThroughRate: StoreSetter<string>;
	setValidReadRate: StoreSetter<string>;
	setRead30sRate: StoreSetter<string>;
	setRead60sRate: StoreSetter<string>;
	setBottomRate: StoreSetter<string>;
	setFollowRate: StoreSetter<string>;
	setBookshelfRate: StoreSetter<string>;
	setFirstChapterCompletionRate: StoreSetter<string>;
	setNextChapterClickRate: StoreSetter<string>;
	setThreeChapterRetentionRate: StoreSetter<string>;
	setAvgReadProgressRate: StoreSetter<string>;
	setPaidUnlockRate: StoreSetter<string>;
	setAiSelfTestEnabled: StoreSetter<boolean>;
	setEnabledAiSelfTests: StoreSetter<AiSelfTestId[]>;
	setReferenceText: StoreSetter<string>;
	setReferenceFileName: StoreSetter<string>;
	setChapterTitle: StoreSetter<string>;
	setChapterText: StoreSetter<string>;
	setQuickReviewGenre: StoreSetter<string>;
	setRubricResult: StoreSetter<RubricResult | null>;
	setScoreResult: StoreSetter<ScoreResult | null>;
	setQuickReviewResult: StoreSetter<QuickReviewResult | null>;
	setReferenceProfileProgress: StoreSetter<ReferenceProfileProgressItem[]>;
	setScoreProgress: StoreSetter<ScoreProgressItem[]>;
	setBookTitle: StoreSetter<string>;
	setBookGenre: StoreSetter<string>;
	setBookText: StoreSetter<string>;
	setBookFile: StoreSetter<File | null>;
	setBookUpload: StoreSetter<BookUploadPreview | null>;
	setBookHistory: StoreSetter<BookAnalysisJob[]>;
	setUploadHistory: StoreSetter<BookUploadPreview[]>;
	setBookAnalysisResult: StoreSetter<BookAnalysisResult | null>;
	setBookJob: StoreSetter<BookAnalysisJob | null>;
	setPersistedResearchLibrary: StoreSetter<PersistedResearchLibrary | null>;
	setSelectedResearchJobIds: StoreSetter<string[]>;
	setComparisonFocus: StoreSetter<string>;
	setResearchComparison: StoreSetter<ResearchComparisonResult | null>;
	setResearchQuestion: StoreSetter<string>;
	setResearchQaResult: StoreSetter<ResearchQaResult | null>;
	setQuickReviewCache: StoreSetter<CachedQuickReview[]>;
	setRubricCache: StoreSetter<CachedRubricResult[]>;
	setScoreCache: StoreSetter<CachedScoreResult[]>;
	setBookAnalysisCache: StoreSetter<CachedBookAnalysis[]>;
}

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

const initialWorkspaceState: WorkspaceStoreState = {
	provider: defaultProvider,
	referenceTitle: "",
	genre: "xuanhuan",
	platform: "fanqie",
	audience: "male-fast-paced",
	readingMode: "mobile-fragmented",
	category: "",
	theme: "",
	tags: "",
	explicitKeywords: "",
	implicitExpectations: "",
	positioningPromise: "",
	recommendationSignals: "",
	competitionLevel: "high",
	competitionNotes: "",
	pushStage: "cold-start",
	trafficEntry: "",
	impressions: "",
	clickThroughRate: "",
	validReadRate: "",
	read30sRate: "",
	read60sRate: "",
	bottomRate: "",
	followRate: "",
	bookshelfRate: "",
	firstChapterCompletionRate: "",
	nextChapterClickRate: "",
	threeChapterRetentionRate: "",
	avgReadProgressRate: "",
	paidUnlockRate: "",
	aiSelfTestEnabled: false,
	enabledAiSelfTests: aiSelfTests.map((test) => test.id),
	referenceText: "",
	referenceFileName: "",
	chapterTitle: "",
	chapterText: "",
	quickReviewGenre: "",
	rubricResult: null,
	scoreResult: null,
	quickReviewResult: null,
	referenceProfileProgress: [],
	scoreProgress: [],
	bookTitle: "",
	bookGenre: "xuanhuan",
	bookText: "",
	bookFile: null,
	bookUpload: null,
	bookHistory: [],
	uploadHistory: [],
	bookAnalysisResult: null,
	bookJob: null,
	persistedResearchLibrary: null,
	selectedResearchJobIds: [],
	comparisonFocus: "",
	researchComparison: null,
	researchQuestion: "",
	researchQaResult: null,
	quickReviewCache: [],
	rubricCache: [],
	scoreCache: [],
	bookAnalysisCache: [],
};

const localSettingsStorageKey = "ai-novel-diagnosis-local-settings";

const persistableWorkspaceKeys = [
	"provider",
	"referenceTitle",
	"genre",
	"platform",
	"audience",
	"readingMode",
	"category",
	"theme",
	"tags",
	"explicitKeywords",
	"implicitExpectations",
	"positioningPromise",
	"recommendationSignals",
	"competitionLevel",
	"competitionNotes",
	"pushStage",
	"trafficEntry",
	"impressions",
	"clickThroughRate",
	"validReadRate",
	"read30sRate",
	"read60sRate",
	"bottomRate",
	"followRate",
	"bookshelfRate",
	"firstChapterCompletionRate",
	"nextChapterClickRate",
	"threeChapterRetentionRate",
	"avgReadProgressRate",
	"paidUnlockRate",
	"aiSelfTestEnabled",
	"enabledAiSelfTests",
	"referenceText",
	"referenceFileName",
	"chapterTitle",
	"chapterText",
	"quickReviewGenre",
	"rubricResult",
	"scoreResult",
	"quickReviewResult",
	"referenceProfileProgress",
	"scoreProgress",
	"bookTitle",
	"bookGenre",
	"bookJob",
	"selectedResearchJobIds",
	"comparisonFocus",
	"researchQuestion",
	"quickReviewCache",
	"rubricCache",
	"scoreCache",
	"bookAnalysisCache",
] as const satisfies Array<keyof WorkspaceStoreState>;

type PersistedWorkspaceState = Pick<WorkspaceStoreState, (typeof persistableWorkspaceKeys)[number]>;

function toPersistedBookJob(job: BookAnalysisJob | null): BookAnalysisJob | null {
	if (!job) {
		return null;
	}

	return {
		id: job.id,
		type: job.type,
		status: job.status,
		inputSummary: { ...job.inputSummary },
		progress: { ...job.progress },
		partialResult: job.partialResult ? { ...job.partialResult } : undefined,
		error: job.error,
		uploadId: job.uploadId,
	};
}

export function partializeWorkspaceState(state: WorkspaceStoreState): PersistedWorkspaceState {
	return persistableWorkspaceKeys.reduce((result, key) => {
		if (key === "bookJob") {
			result.bookJob = toPersistedBookJob(
				state.bookJob,
			) as PersistedWorkspaceState["bookJob"];
			return result;
		}

		if (key === "bookAnalysisCache") {
			result.bookAnalysisCache = state.bookAnalysisCache.map((entry) => ({
				...entry,
				job: toPersistedBookJob(entry.job) ?? entry.job,
				result: null,
			})) as PersistedWorkspaceState["bookAnalysisCache"];
			return result;
		}

		result[key] = state[key] as never;
		return result;
	}, {} as PersistedWorkspaceState);
}

export function mergeWorkspaceState(
	persistedState: unknown,
	currentState: WorkspaceStore,
): WorkspaceStore {
	const persisted =
		persistedState && typeof persistedState === "object"
			? (persistedState as Partial<WorkspaceStoreState>)
			: {};
	const persistedProvider = persisted.provider;
	const allowedPresets: ProviderPresetId[] = [
		"custom",
		"shared-gpu",
		"deepseek",
		"doubao",
		"qwen",
		"ollama",
	];
	const safeProvider =
		persistedProvider && allowedPresets.includes(persistedProvider.preset)
			? persistedProvider
			: currentState.provider;

	return {
		...currentState,
		...persisted,
		provider: safeProvider
			? {
					...currentState.provider,
					...safeProvider,
				}
			: currentState.provider,
		bookFile: null,
	};
}

export const useWorkspaceStore = create<WorkspaceStore>()(
	persist<WorkspaceStore, [], [], PersistedWorkspaceState>(
		(set) => {
			function makeSetter<K extends keyof WorkspaceStoreState>(
				key: K,
			): StoreSetter<WorkspaceStoreState[K]> {
				return (value) =>
					set((current) => ({
						[key]: resolveStoreValue(value, current[key]),
					}));
			}

			return {
				...initialWorkspaceState,
				setProvider: makeSetter("provider"),
				setReferenceTitle: makeSetter("referenceTitle"),
				setGenre: makeSetter("genre"),
				setPlatform: makeSetter("platform"),
				setAudience: makeSetter("audience"),
				setReadingMode: makeSetter("readingMode"),
				setCategory: makeSetter("category"),
				setTheme: makeSetter("theme"),
				setTags: makeSetter("tags"),
				setExplicitKeywords: makeSetter("explicitKeywords"),
				setImplicitExpectations: makeSetter("implicitExpectations"),
				setPositioningPromise: makeSetter("positioningPromise"),
				setRecommendationSignals: makeSetter("recommendationSignals"),
				setCompetitionLevel: makeSetter("competitionLevel"),
				setCompetitionNotes: makeSetter("competitionNotes"),
				setPushStage: makeSetter("pushStage"),
				setTrafficEntry: makeSetter("trafficEntry"),
				setImpressions: makeSetter("impressions"),
				setClickThroughRate: makeSetter("clickThroughRate"),
				setValidReadRate: makeSetter("validReadRate"),
				setRead30sRate: makeSetter("read30sRate"),
				setRead60sRate: makeSetter("read60sRate"),
				setBottomRate: makeSetter("bottomRate"),
				setFollowRate: makeSetter("followRate"),
				setBookshelfRate: makeSetter("bookshelfRate"),
				setFirstChapterCompletionRate: makeSetter("firstChapterCompletionRate"),
				setNextChapterClickRate: makeSetter("nextChapterClickRate"),
				setThreeChapterRetentionRate: makeSetter("threeChapterRetentionRate"),
				setAvgReadProgressRate: makeSetter("avgReadProgressRate"),
				setPaidUnlockRate: makeSetter("paidUnlockRate"),
				setAiSelfTestEnabled: makeSetter("aiSelfTestEnabled"),
				setEnabledAiSelfTests: makeSetter("enabledAiSelfTests"),
				setReferenceText: makeSetter("referenceText"),
				setReferenceFileName: makeSetter("referenceFileName"),
				setChapterTitle: makeSetter("chapterTitle"),
				setChapterText: makeSetter("chapterText"),
				setQuickReviewGenre: makeSetter("quickReviewGenre"),
				setRubricResult: makeSetter("rubricResult"),
				setScoreResult: makeSetter("scoreResult"),
				setQuickReviewResult: makeSetter("quickReviewResult"),
				setReferenceProfileProgress: makeSetter("referenceProfileProgress"),
				setScoreProgress: makeSetter("scoreProgress"),
				setBookTitle: makeSetter("bookTitle"),
				setBookGenre: makeSetter("bookGenre"),
				setBookText: makeSetter("bookText"),
				setBookFile: makeSetter("bookFile"),
				setBookUpload: makeSetter("bookUpload"),
				setBookHistory: makeSetter("bookHistory"),
				setUploadHistory: makeSetter("uploadHistory"),
				setBookAnalysisResult: makeSetter("bookAnalysisResult"),
				setBookJob: makeSetter("bookJob"),
				setPersistedResearchLibrary: makeSetter("persistedResearchLibrary"),
				setSelectedResearchJobIds: makeSetter("selectedResearchJobIds"),
				setComparisonFocus: makeSetter("comparisonFocus"),
				setResearchComparison: makeSetter("researchComparison"),
				setResearchQuestion: makeSetter("researchQuestion"),
				setResearchQaResult: makeSetter("researchQaResult"),
				setQuickReviewCache: makeSetter("quickReviewCache"),
				setRubricCache: makeSetter("rubricCache"),
				setScoreCache: makeSetter("scoreCache"),
				setBookAnalysisCache: makeSetter("bookAnalysisCache"),
			};
		},
		{
			name: localSettingsStorageKey,
			version: 2,
			storage: createJSONStorage(() => localStorage),
			partialize: partializeWorkspaceState,
			merge: mergeWorkspaceState,
		},
	),
);
