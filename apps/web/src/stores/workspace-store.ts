import { create } from "zustand";

export type ProviderKind = "mock" | "openai-compatible" | "ai-horde";
export type ProviderPresetId =
	| "custom"
	| "ai-horde"
	| "openrouter-free"
	| "shared-gpu"
	| "deepseek"
	| "doubao"
	| "qwen"
	| "ollama";

export interface ProviderForm {
	preset: ProviderPresetId;
	kind: ProviderKind;
	baseUrl: string;
	apiKey: string;
	model: string;
	temperature: number;
	jsonMode: boolean;
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
	referencePrincipleId?: string;
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
		name: "AI 味识别",
		description: "AI 识别专属细节弱、情绪浅、伏笔短线化和语言模板化风险。",
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
		nodes: Array<{ id: string; label: string; type: string }>;
		edges: Array<{ source: string; target: string; label: string; tension: string }>;
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
		chapterMaps: Array<{
			chapterId: string;
			order: number;
			title: string;
			summary: string;
			plotFunction: string;
			hook: string;
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
		chapterMaps: unknown[];
		notice: string;
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

interface WorkspaceStoreState {
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
	rubricResult: RubricResult | null;
	scoreResult: ScoreResult | null;
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
	setRubricResult: StoreSetter<RubricResult | null>;
	setScoreResult: StoreSetter<ScoreResult | null>;
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
}

export type WorkspaceStore = WorkspaceStoreState & WorkspaceStoreActions;

const initialWorkspaceState: WorkspaceStoreState = {
	provider: {
		preset: "ai-horde",
		kind: "ai-horde",
		baseUrl: "https://aihorde.net/api/v2",
		apiKey: "",
		model: "aphrodite/TheDrummer/Cydonia-24B-v4.3",
		temperature: 0.2,
		jsonMode: false,
	},
	referenceTitle: "第一章 少年被逐",
	genre: "xuanhuan",
	platform: "fanqie",
	audience: "male-fast-paced",
	readingMode: "mobile-fragmented",
	category: "都市神医",
	theme: "逆袭打脸",
	tags: "神医，退婚，豪门，隐藏身份",
	explicitKeywords: "退婚，银针，豪门千金",
	implicitExpectations: "被低估，公开羞辱，医术反转，身份揭露",
	positioningPromise: "退婚当天，我用九根银针救下豪门千金",
	recommendationSignals: "点击率，有效阅读，触底/完读，加书架，追更",
	competitionLevel: "high",
	competitionNotes: "同质化爽点多，需要更早给出差异化钩子。",
	pushStage: "cold-start",
	trafficEntry: "推荐流，分类页，关键词标签",
	impressions: "12000",
	clickThroughRate: "7.5",
	validReadRate: "52",
	read30sRate: "58",
	read60sRate: "31",
	bottomRate: "42",
	followRate: "12",
	bookshelfRate: "18",
	firstChapterCompletionRate: "46",
	nextChapterClickRate: "33",
	threeChapterRetentionRate: "24",
	avgReadProgressRate: "64",
	paidUnlockRate: "8",
	aiSelfTestEnabled: true,
	enabledAiSelfTests: aiSelfTests.map((test) => test.id),
	referenceText: defaultReferenceText,
	referenceFileName: "",
	chapterTitle: "第一章 考场重逢",
	chapterText: defaultUserText,
	rubricResult: null,
	scoreResult: null,
	referenceProfileProgress: [],
	scoreProgress: [],
	bookTitle: "示例长篇小说",
	bookGenre: "xuanhuan",
	bookText: defaultBookText,
	bookFile: null,
	bookUpload: null,
	bookHistory: [],
	uploadHistory: [],
	bookAnalysisResult: null,
	bookJob: null,
	persistedResearchLibrary: null,
	selectedResearchJobIds: [],
	comparisonFocus: "对比开局承诺、卖点组合、情绪策略、章末钩子和可重组方向",
	researchComparison: null,
	researchQuestion: "这些样本的开局承诺有什么共同点，哪个点最容易被新手忽略？",
	researchQaResult: null,
};

export const useWorkspaceStore = create<WorkspaceStore>((set) => {
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
		setRubricResult: makeSetter("rubricResult"),
		setScoreResult: makeSetter("scoreResult"),
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
	};
});
