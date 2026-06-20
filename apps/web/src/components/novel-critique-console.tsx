"use client";

import {
	BookOpenCheck,
	CheckCircle2,
	FileText,
	KeyRound,
	Loader2,
	Network,
	ShieldAlert,
	Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChapterCritiqueView } from "@/components/workspace/chapter-critique-view";
import {
	BookAnalysisPanel,
	ExportView,
	type BookExportFormat,
	type BookExportMode,
} from "@/components/workspace/export-view";
import { LibraryView } from "@/components/workspace/library-view";
import { OverviewView } from "@/components/workspace/overview-view";
import { StarterView } from "@/components/workspace/starter-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import {
	buildBeginnerLearningDigest,
	buildComparisonSamples,
	buildResearchGraph,
	buildResearchPromptSeed,
	buildScoreEvidenceChain,
} from "@/lib/research-library";
import { apiUrl, type ApiEnvelope } from "@/lib/api-client";
import { providerPresets } from "@/lib/provider-presets";
import { toQuickReviewErrorMessage } from "@/lib/quick-review-errors";
import {
	askResearchLibrary as requestResearchQa,
	compactReferenceText,
	compareResearchBooks,
	createBookAnalysisJobFromUpload,
	deleteBookAnalysisJob,
	listBookHistory,
	parseList,
	readBookAnalysisJob,
	readResearchLibrary,
	requestQuickReview,
	requestReferenceProfile,
	requestRubric,
	requestScoreChapter,
	resumeBookAnalysisJob,
	testProviderConnection,
	uploadBookPreview,
	type ReferenceProfileResult,
} from "@/lib/workspace-analysis-client";
import {
	buildReferenceProfileFacts,
	useReferenceProfileProgressController,
	useScoreProgressController,
} from "@/lib/workspace-progress";
import {
	buildBookWorkspaceSummary,
	buildChapterWorkspaceSummary,
	buildOverviewNextAction,
	buildResearchWorkspaceSummary,
	getPerformanceSnapshotNote,
	getWorkspaceNavItems,
	getWorkspaceViewMeta,
} from "@/lib/workspace-view-model";
import {
	buildBookAnalysisCacheKey as createBookAnalysisCacheKey,
	buildQuickReviewCacheKey as createQuickReviewCacheKey,
	buildReferenceProfileCacheKey as createReferenceProfileCacheKey,
	buildRubricCacheKey as createRubricCacheKey,
	buildScoreCacheKey as createScoreCacheKey,
	createBookAnalysisCacheEntry,
	createQuickReviewCacheEntry,
	createRubricCacheEntry,
	createScoreCacheEntry,
	updateCachedBookAnalysisByJobId,
	upsertCacheEntry,
} from "@/lib/workspace-cache";
import { type WorkspaceView, workspaceViewRoutes } from "@/lib/workspace-routes";
import {
	type BookAnalysisResult,
	type BookAnalysisJob,
	type BookUploadPreview,
	type ProviderKind,
	type ProviderPresetId,
	type RubricResult,
	type QuickReviewResult,
	type ScoreResult,
	defaultBookText,
	defaultProvider,
	defaultReferenceText,
	defaultUserText,
	useWorkspaceStore,
} from "@/stores/workspace-store";

type LoadingState =
	| "provider"
	| "profile"
	| "rubric"
	| "score"
	| "quick"
	| "upload"
	| "book"
	| "history"
	| "research"
	| "compare"
	| "ask"
	| "export"
	| null;

const LARGE_BOOK_INLINE_BYTES = 512 * 1024;

function formatFileSize(bytes: number) {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}

	return `${bytes} B`;
}

interface InferredReferenceProfile {
	title: string;
	genre: string;
	category: string;
	theme: string;
	tags: string;
	explicitKeywords: string;
	implicitExpectations: string;
	positioningPromise: string;
}

interface InferredPlatformStrategy {
	recommendationSignals: string;
	competitionLevel: string;
	competitionNotes: string;
	pushStage: string;
	trafficEntry: string;
}

const genreProfiles: Array<{
	id: string;
	category: string;
	theme: string;
	tags: string[];
	explicitKeywords: string[];
	implicitExpectations: string[];
	keywords: string[];
}> = [
	{
		id: "urban",
		category: "都市神医",
		theme: "逆袭打脸",
		tags: ["神医", "退婚", "豪门", "隐藏身份"],
		explicitKeywords: ["退婚", "银针", "豪门千金"],
		implicitExpectations: ["被低估", "公开羞辱", "医术反转", "身份揭露"],
		keywords: ["都市", "医院", "银针", "神医", "豪门", "退婚", "公司", "考场"],
	},
	{
		id: "xuanhuan",
		category: "东方玄幻",
		theme: "废柴逆袭",
		tags: ["修炼", "家族", "试炼", "血脉"],
		explicitKeywords: ["长老", "试炼", "石碑", "金纹"],
		implicitExpectations: ["资质反转", "家族羞辱", "母亲遗物", "长期成长"],
		keywords: ["修炼", "灵力", "境界", "家族", "长老", "试炼", "丹田", "石碑", "金纹"],
	},
	{
		id: "romance",
		category: "现代言情",
		theme: "情绪拉扯",
		tags: ["误会", "追妻", "豪门", "破镜重圆"],
		explicitKeywords: ["婚约", "前任", "协议", "真相"],
		implicitExpectations: ["误会升级", "情绪亏欠", "关系反转", "后悔"],
		keywords: ["婚约", "前任", "追妻", "离婚", "夫人", "总裁", "白月光", "重逢"],
	},
	{
		id: "suspense",
		category: "悬疑脑洞",
		theme: "真相追查",
		tags: ["旧案", "线索", "反转", "危机"],
		explicitKeywords: ["玉牌", "残图", "失踪", "匿名信"],
		implicitExpectations: ["隐藏真相", "身份疑云", "危险逼近", "线索升级"],
		keywords: ["旧案", "线索", "凶手", "失踪", "尸体", "匿名信", "残图", "真相"],
	},
	{
		id: "infinite-flow",
		category: "无限流",
		theme: "副本求生",
		tags: ["副本", "规则", "求生", "团队"],
		explicitKeywords: ["系统", "任务", "副本", "规则"],
		implicitExpectations: ["规则破解", "生死倒计时", "队友博弈", "副本升级"],
		keywords: ["副本", "系统", "任务", "规则", "通关", "玩家", "倒计时", "怪谈"],
	},
];

function basenameWithoutExtension(filename: string): string {
	return filename.replace(/\.[^.]+$/, "").trim();
}

function inferReferenceTitle(text: string, fallback: string): string {
	const lines = text
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const chapterLine =
		lines.find((line) => /^第[一二三四五六七八九十百千万\d]+[章节回卷]/.test(line)) ??
		lines.find((line) => line.length <= 40 && /[章节回卷]/.test(line));

	return chapterLine ?? fallback;
}

function inferGenreProfile(text: string) {
	const normalized = text.toLowerCase();
	return genreProfiles
		.map((profile) => ({
			profile,
			score: profile.keywords.reduce(
				(total, keyword) => total + (normalized.includes(keyword.toLowerCase()) ? 1 : 0),
				0,
			),
		}))
		.sort((left, right) => right.score - left.score)[0].profile;
}

function inferReferenceProfile(text: string, filename?: string): InferredReferenceProfile {
	const fallbackTitle = filename ? basenameWithoutExtension(filename) : "参考章节";
	const title = inferReferenceTitle(text, fallbackTitle);
	const profile = inferGenreProfile(`${title}\n${text}`);
	const positioningPromise =
		title.length > 4
			? title
			: (text
					.split(/[。！？!?]/)
					.map((sentence) => sentence.trim())
					.find((sentence) => sentence.length >= 12 && sentence.length <= 60) ?? title);

	return {
		title,
		genre: profile.id,
		category: profile.category,
		theme: profile.theme,
		tags: profile.tags.join("，"),
		explicitKeywords: profile.explicitKeywords.join("，"),
		implicitExpectations: profile.implicitExpectations.join("，"),
		positioningPromise,
	};
}

function referenceProfileList(value: string | string[]): string[] {
	if (Array.isArray(value)) {
		return value;
	}

	return parseList(value);
}

function inferPlatformStrategyFromProfile(
	profile: InferredReferenceProfile | ReferenceProfileResult,
	platform: string,
	readingMode: string,
): InferredPlatformStrategy {
	const isShortForm = readingMode === "short-paid" || platform === "wechat-short";
	const isLongSerialization = readingMode === "long-serialization";
	const isAlgorithmPlatform =
		platform === "fanqie" || platform === "qimao" || platform === "wechat-short";
	const tags = referenceProfileList(profile.tags);
	const explicitKeywords = referenceProfileList(profile.explicitKeywords);
	const implicitExpectations = referenceProfileList(profile.implicitExpectations);
	const allSignals = [
		profile.category,
		profile.theme,
		...tags,
		...explicitKeywords,
		...implicitExpectations,
	].join(" ");
	const highCompetitionKeywords = [
		"逆袭",
		"打脸",
		"退婚",
		"神医",
		"豪门",
		"追妻",
		"系统",
		"废柴",
		"无限流",
		"总裁",
	];
	const competitionLevel = highCompetitionKeywords.some((keyword) => allSignals.includes(keyword))
		? "high"
		: tags.length >= 3
			? "medium"
			: "unknown";
	const recommendationSignals = isShortForm
		? "点击率，有效阅读，全文完读，平均阅读进度，付费解锁"
		: isLongSerialization
			? "点击率，阅读30s，首章完读，加书架/收藏，章末下一章点击，前3章留存，追更"
			: isAlgorithmPlatform
				? "点击率，有效阅读，阅读30s，触底/完读，加书架，追更"
				: "点击率，阅读完成度，收藏/书架，追更";
	const platformEntry =
		platform === "qidian"
			? "分类页，新书曝光，关键词搜索"
			: platform === "jinjiang"
				? "分类标签，榜单，收藏推荐"
				: platform === "wechat-short"
					? "推荐流，投放素材，小程序入口"
					: "推荐流，分类页，关键词标签";
	const trafficEntry = [
		platformEntry,
		profile.category,
		...tags.slice(0, 3),
		...explicitKeywords.slice(0, 2),
	]
		.filter(Boolean)
		.join("，");
	const competitionNotes =
		competitionLevel === "high"
			? `AI 根据市场定位预估：${profile.category}/${profile.theme} 属于高竞争表达，前 500 字需要更早给出差异化钩子，避免只停留在常见爽点。`
			: `AI 根据市场定位预估：${profile.category}/${profile.theme} 需要用标签和显性关键词明确入口承诺，再用正文事件兑现。`;

	return {
		recommendationSignals,
		competitionLevel,
		competitionNotes,
		pushStage: "cold-start",
		trafficEntry,
	};
}

function buildReferenceProfileSample(text: string): string {
	const normalized = text.trim();
	if (normalized.length <= 7000) {
		return normalized;
	}

	return `${normalized.slice(0, 5200)}\n\n……中间内容已省略，用于加快市场定位识别……\n\n${normalized.slice(-1600)}`;
}

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

interface BookJobProgressDetail {
	outline: {
		current: number;
		total: number;
		percent: number;
	};
	deep: {
		current: number;
		total: number;
		percent: number;
	};
	strategy?: string;
}

function toProgressPercent(current: number, total: number) {
	if (total <= 0) {
		return 0;
	}

	return Math.max(0, Math.min(100, Math.round((current / total) * 100)));
}

function getBookJobProgressDetail(job: BookAnalysisJob | null): BookJobProgressDetail | null {
	if (!job) {
		return null;
	}

	const totalChapters =
		job.partialResult?.totalChapters ??
		job.preprocessing?.chapters.length ??
		job.result?.mapReduce?.chunkCount ??
		job.result?.mapReduce?.mapCount ??
		0;
	const outlineCurrent =
		job.result?.mapReduce?.outlineCount ??
		job.partialResult?.outlineCount ??
		job.partialResult?.mapCount ??
		(job.status === "succeeded" ? totalChapters : 0);
	const deepTotal =
		job.result?.mapReduce?.deepTargetOrders?.length ??
		job.partialResult?.deepTargetOrders?.length ??
		0;
	const deepCurrent =
		job.result?.mapReduce?.deepCount ??
		job.partialResult?.deepCompletedCount ??
		(job.status === "succeeded" ? deepTotal : 0);

	if (totalChapters <= 0 && deepTotal <= 0) {
		return null;
	}

	return {
		outline: {
			current: Math.min(outlineCurrent, totalChapters || outlineCurrent),
			total: totalChapters,
			percent: toProgressPercent(outlineCurrent, totalChapters),
		},
		deep: {
			current: Math.min(deepCurrent, deepTotal || deepCurrent),
			total: deepTotal,
			percent: deepTotal > 0 ? toProgressPercent(deepCurrent, deepTotal) : 0,
		},
		strategy: job.result?.mapReduce?.strategy ?? job.partialResult?.analysisStrategy,
	};
}

function downloadText(filename: string, content: string, contentType: string) {
	const blob = new Blob([content], { type: contentType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

function FieldHelp({ text }: { text: string }) {
	const [open, setOpen] = useState(false);

	return (
		<span className="relative ml-1 inline-flex align-middle">
			<button
				type="button"
				className="inline-flex size-4 items-center justify-center rounded-full border border-border bg-background text-[10px] leading-none text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="查看说明"
				aria-expanded={open}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setOpen((current) => !current);
				}}
				onBlur={() => window.setTimeout(() => setOpen(false), 120)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						setOpen(false);
					}
				}}
			>
				?
			</button>
			{open ? (
				<span
					role="tooltip"
					data-field-help-panel="true"
					className="absolute right-0 top-6 z-50 w-64 rounded-md border border-border bg-popover p-3 text-left text-xs font-normal leading-5 text-popover-foreground shadow-lg sm:top-1/2 sm:left-6 sm:right-auto sm:-translate-y-1/2"
				>
					{text}
				</span>
			) : null}
		</span>
	);
}

function WorkflowGuide({ steps, note }: { steps: string[]; note: string }) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-wrap gap-2">
				{steps.map((step, index) => (
					<div
						key={step}
						className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						<span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
							{index + 1}
						</span>
						{step}
					</div>
				))}
			</div>
			<p className="mt-4 text-sm leading-6 text-muted-foreground">{note}</p>
		</section>
	);
}

const competitionLevelOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "low", label: "低竞争" },
	{ value: "medium", label: "中等竞争" },
	{ value: "high", label: "高竞争" },
];

const pushStageOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "cold-start", label: "冷启动" },
	{ value: "second-push", label: "二轮推流" },
	{ value: "stable", label: "稳定推荐" },
	{ value: "recycle", label: "复推/召回" },
];

const platformOptions = [
	{ value: "qidian", label: "起点" },
	{ value: "fanqie", label: "番茄" },
	{ value: "jinjiang", label: "晋江" },
	{ value: "qimao", label: "七猫" },
	{ value: "wechat-short", label: "微信短篇/小程序文" },
	{ value: "other", label: "其他" },
];

const audienceOptions = [
	{ value: "male-fast-paced", label: "男频快节奏爽文" },
	{ value: "female-emotional", label: "女频情绪流" },
	{ value: "setting-heavy", label: "设定党/世界观" },
	{ value: "light-reader", label: "快节奏小白文" },
	{ value: "suspense-brainstorm", label: "悬疑脑洞" },
	{ value: "other", label: "其他" },
];

const readingModeOptions = [
	{ value: "long-serialization", label: "长篇追更" },
	{ value: "mobile-fragmented", label: "移动端碎片阅读" },
	{ value: "short-paid", label: "短篇付费" },
	{ value: "other", label: "其他" },
];

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
	return options.find((option) => option.value === value)?.label ?? value;
}

export function NovelCritiqueConsole({ view = "overview" }: { view?: WorkspaceView }) {
	const router = useRouter();
	const activeView = view;
	const {
		provider,
		setProvider,
		referenceTitle,
		setReferenceTitle,
		genre,
		setGenre,
		platform,
		audience,
		readingMode,
		category,
		setCategory,
		theme,
		setTheme,
		tags,
		setTags,
		explicitKeywords,
		setExplicitKeywords,
		implicitExpectations,
		setImplicitExpectations,
		positioningPromise,
		setPositioningPromise,
		recommendationSignals,
		setRecommendationSignals,
		competitionLevel,
		setCompetitionLevel,
		competitionNotes,
		setCompetitionNotes,
		pushStage,
		setPushStage,
		trafficEntry,
		setTrafficEntry,
		impressions,
		clickThroughRate,
		validReadRate,
		read30sRate,
		read60sRate,
		bottomRate,
		followRate,
		bookshelfRate,
		firstChapterCompletionRate,
		nextChapterClickRate,
		threeChapterRetentionRate,
		avgReadProgressRate,
		paidUnlockRate,
		aiSelfTestEnabled,
		enabledAiSelfTests,
		referenceText,
		setReferenceText,
		referenceFileName,
		setReferenceFileName,
		chapterTitle,
		setChapterTitle,
		chapterText,
		setChapterText,
		quickReviewGenre,
		setQuickReviewGenre,
		rubricResult,
		setRubricResult,
		scoreResult,
		setScoreResult,
		quickReviewResult,
		setQuickReviewResult,
		referenceProfileProgress,
		setReferenceProfileProgress,
		setScoreProgress,
		bookTitle,
		setBookTitle,
		bookGenre,
		setBookGenre,
		bookText,
		setBookText,
		bookFile,
		setBookFile,
		bookUpload,
		setBookUpload,
		bookHistory,
		setBookHistory,
		uploadHistory,
		setUploadHistory,
		bookAnalysisResult,
		setBookAnalysisResult,
		bookJob,
		setBookJob,
		persistedResearchLibrary,
		setPersistedResearchLibrary,
		selectedResearchJobIds,
		setSelectedResearchJobIds,
		comparisonFocus,
		setResearchComparison,
		researchQuestion,
		setResearchQaResult,
		quickReviewCache,
		setQuickReviewCache,
		rubricCache,
		setRubricCache,
		scoreCache,
		setScoreCache,
		bookAnalysisCache,
		setBookAnalysisCache,
	} = useWorkspaceStore();
	const [status, setStatus] = useState<string>(
		"默认使用共享站；配置自己的 API Key 后，会使用你选择的模型服务。",
	);
	const [loading, setLoading] = useState<LoadingState>(null);
	const [quickReviewElapsedSeconds, setQuickReviewElapsedSeconds] = useState(0);
	const [previousQuickReviewResult, setPreviousQuickReviewResult] =
		useState<QuickReviewResult | null>(null);
	const referenceProfileCacheRef = useRef<Map<string, ReferenceProfileResult>>(new Map());
	const chapterDraftTouchedRef = useRef(false);
	const platformStrategyTouchedRef = useRef(false);
	const activeBookPollJobIdRef = useRef<string | null>(null);
	const {
		resetScoreProgress,
		initializeScoreProgress,
		revealScoreProgress,
		failCurrentScoreProgress,
	} = useScoreProgressController(setScoreProgress);
	const {
		resetReferenceProfileProgress,
		initializeReferenceProfileProgress,
		updateReferenceProfileProgress,
	} = useReferenceProfileProgressController(setReferenceProfileProgress);

	useEffect(() => {
		if (loading !== "quick") {
			setQuickReviewElapsedSeconds(0);
			return;
		}

		const startedAt = Date.now();
		setQuickReviewElapsedSeconds(0);
		const timer = window.setInterval(() => {
			setQuickReviewElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
		}, 1000);

		return () => window.clearInterval(timer);
	}, [loading]);

	function openView(view: WorkspaceView) {
		router.push(workspaceViewRoutes[view]);
	}

	const navItems = getWorkspaceNavItems();
	const activeMeta = getWorkspaceViewMeta(activeView);

	const providerPayload = useMemo(
		() => ({
			preset: provider.preset,
			kind: provider.kind,
			baseUrl: provider.baseUrl,
			apiKey: provider.apiKey,
			model: provider.model,
			temperature: provider.temperature,
			jsonMode: provider.jsonMode,
		}),
		[provider],
	);
	const selectedProviderPreset = providerPresets[provider.preset];
	const providerModelOptions = selectedProviderPreset.modelOptions ?? [];
	const selectedModelOption = providerModelOptions.includes(provider.model)
		? provider.model
		: "__custom__";
	const isBackendFreeProvider = provider.preset === "shared-gpu";
	const isShortPaidReading = readingMode === "short-paid";
	const isShortFormReading = isShortPaidReading || platform === "wechat-short";
	const isLongSerialization = readingMode === "long-serialization";
	const isAlgorithmPlatform =
		platform === "fanqie" || platform === "qimao" || platform === "wechat-short";
	const performanceSnapshotNote = getPerformanceSnapshotNote({
		isShortFormReading,
		isLongSerialization,
	});
	const providerLabel =
		provider.kind === "mock" ? "本地演示" : providerPresets[provider.preset].label;
	const referenceProfileApplied = referenceProfileProgress.some(
		(item) => item.id === "apply" && item.status === "completed",
	);
	const platformLabel = optionLabel(platformOptions, platform);
	const audienceLabel = optionLabel(audienceOptions, audience);
	const readingModeLabel = optionLabel(readingModeOptions, readingMode);
	const {
		hasChapterDraft,
		hasReferenceText,
		chapterProjectSteps,
		chapterCompletion,
		nextChapterAction,
	} = buildChapterWorkspaceSummary({
		platformLabel,
		audienceLabel,
		readingModeLabel,
		referenceText,
		referenceFileName,
		chapterText,
		quickReviewResult,
		referenceProfileApplied,
		category,
		theme,
		rubricResult,
		scoreResult,
		performanceValues: [
			impressions,
			clickThroughRate,
			validReadRate,
			read30sRate,
			read60sRate,
			bottomRate,
			followRate,
			bookshelfRate,
			firstChapterCompletionRate,
			nextChapterClickRate,
			threeChapterRetentionRate,
			avgReadProgressRate,
			paidUnlockRate,
		],
		performanceSnapshotNote,
	});
	const nextAction = buildOverviewNextAction({
		hasChapterDraft,
		quickReviewResult,
		hasReferenceText,
		referenceProfileApplied,
		rubricResult,
		scoreResult,
	});
	const { bookStatusText, bookCompletion } = buildBookWorkspaceSummary({
		bookJob,
		bookUpload,
	});
	const bookProgressDetail = getBookJobProgressDetail(bookJob);
	const quickReviewCacheHit = quickReviewCache.find(
		(item) => item.key === buildQuickReviewCacheKey(),
	);
	const rubricCacheHit = rubricCache.find((item) => item.key === buildRubricCacheKey());
	const scoreCacheHit = scoreCache.find((item) => item.key === buildScoreCacheKey());
	const bookAnalysisCacheHit = bookAnalysisCache.find(
		(item) => item.key === buildBookAnalysisCacheKey(),
	);
	const researchGraph = buildResearchGraph(bookAnalysisResult);
	const scoreEvidenceChain = buildScoreEvidenceChain(scoreResult);
	const comparisonSamples = buildComparisonSamples(bookAnalysisResult, bookHistory);
	const researchPromptSeed = buildResearchPromptSeed(
		researchGraph,
		scoreEvidenceChain,
		comparisonSamples,
	);
	const beginnerLearningDigest = buildBeginnerLearningDigest(bookAnalysisResult);
	const graphNodeCount = researchGraph.nodes.length;
	const graphEdgeCount = researchGraph.edges.length;
	const bookFileTooLargeForInlinePreview = Boolean(
		bookFile && bookFile.size > LARGE_BOOK_INLINE_BYTES && !bookText.trim(),
	);
	const foreshadowingCount = researchGraph.nodes.filter(
		(item) => item.type === "foreshadowing",
	).length;
	const evidenceScoreCount = scoreEvidenceChain.items.filter((item) => item.evidence).length;
	const comparableBookCount = comparisonSamples.samples.length;
	const { researchSourceCount, researchReadiness, researchSources } =
		buildResearchWorkspaceSummary({
			referenceText,
			chapterText,
			chapterTitle,
			referenceFileName,
			bookUpload,
			bookAnalysisResult,
			scoreResult,
			graphNodeCount,
			graphEdgeCount,
			evidenceScoreCount,
			comparableBookCount,
		});

	useEffect(() => {
		if (activeView === "library" && !persistedResearchLibrary) {
			void loadResearchLibrary();
		}
	}, [activeView, persistedResearchLibrary]);

	useEffect(() => {
		if (bookHistory.length || uploadHistory.length) {
			return;
		}

		void loadHistory({ silent: true });
	}, [bookHistory.length, uploadHistory.length]);

	useEffect(() => {
		if (!bookJob?.id) {
			return;
		}

		if (bookJob.status === "queued" || bookJob.status === "running") {
			void followBookJob(bookJob.id, {
				background: true,
				silent: true,
				maxAttempts: 600,
			});
			return;
		}

		if (bookJob.status === "succeeded" && !bookAnalysisResult) {
			void openHistoryJob(bookJob.id, { silent: true, preserveLoading: true });
		}
	}, [bookAnalysisResult, bookJob?.id, bookJob?.status]);

	function buildQuickReviewCacheKey() {
		return createQuickReviewCacheKey({
			provider,
			quickReviewGenre,
			chapterTitle,
			chapterText,
		});
	}

	function buildRubricCacheKey() {
		return createRubricCacheKey({
			provider,
			referenceTitle,
			genre,
			platform,
			audience,
			readingMode,
			category,
			theme,
			tags,
			explicitKeywords,
			implicitExpectations,
			positioningPromise,
			recommendationSignals,
			competitionLevel,
			competitionNotes,
			pushStage,
			trafficEntry,
			referenceText,
		});
	}

	function buildScoreCacheKey() {
		return createScoreCacheKey({
			provider,
			rubricResult,
			platform,
			audience,
			readingMode,
			category,
			theme,
			tags,
			explicitKeywords,
			implicitExpectations,
			positioningPromise,
			recommendationSignals,
			competitionLevel,
			competitionNotes,
			pushStage,
			trafficEntry,
			chapterTitle,
			chapterText,
			aiSelfTestEnabled,
			enabledAiSelfTests,
			performanceValues: [
				impressions,
				clickThroughRate,
				validReadRate,
				read30sRate,
				read60sRate,
				bottomRate,
				followRate,
				bookshelfRate,
				firstChapterCompletionRate,
				nextChapterClickRate,
				threeChapterRetentionRate,
				avgReadProgressRate,
				paidUnlockRate,
			],
		});
	}

	function buildBookAnalysisCacheKey() {
		return createBookAnalysisCacheKey({
			provider,
			bookGenre,
			bookTitle,
			bookText,
			bookFile,
		});
	}

	function rememberQuickReview(key: string, result: QuickReviewResult) {
		const entry = createQuickReviewCacheEntry({
			key,
			chapterTitle,
			quickReviewGenre,
			result,
		});
		setQuickReviewCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberRubric(key: string, result: RubricResult) {
		const entry = createRubricCacheEntry({
			key,
			referenceTitle,
			result,
		});
		setRubricCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberScore(key: string, result: ScoreResult) {
		const entry = createScoreCacheEntry({
			key,
			chapterTitle,
			result,
		});
		setScoreCache((current) => upsertCacheEntry(current, entry));
	}

	function rememberBookAnalysis(
		key: string,
		job: BookAnalysisJob,
		result: BookAnalysisResult | null,
	) {
		const entry = createBookAnalysisCacheEntry({
			key,
			bookTitle,
			job,
			result,
		});
		setBookAnalysisCache((current) => upsertCacheEntry(current, entry));
	}

	function updateBookAnalysisCacheByJobId(jobId: string, job: BookAnalysisJob) {
		setBookAnalysisCache((current) => updateCachedBookAnalysisByJobId(current, jobId, job));
	}

	async function testProvider() {
		setLoading("provider");
		setStatus("正在测试模型服务...");
		try {
			const result = await testProviderConnection(providerPayload);
			const providerName = providerPresets[provider.preset].label;
			const modelName =
				provider.kind === "mock"
					? "本地演示"
					: provider.model || String(result.model || "未指定模型");
			setStatus(`模型服务可用：${providerName} · ${modelName}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	function applyProviderPreset(presetId: ProviderPresetId) {
		const preset = providerPresets[presetId];
		setProvider((current) => ({
			...current,
			preset: presetId,
			kind: preset.kind,
			baseUrl: preset.baseUrl,
			model: preset.model,
			jsonMode: preset.jsonMode,
			apiKey: preset.needsApiKey ? current.apiKey : "",
		}));
	}

	function resetProviderSettings() {
		setProvider(defaultProvider);
		setStatus("已恢复默认 AI 设置，并保存到本机浏览器。");
	}

	function useExampleChapter() {
		setChapterTitle("第一章 考场重逢");
		setChapterText(defaultUserText);
		setPreviousQuickReviewResult(null);
		setQuickReviewResult(null);
		setScoreResult(null);
		setStatus("已填入示例章节。示例只用于演示，你可以直接替换成自己的正文。");
	}

	function useExampleReference() {
		setReferenceTitle("第一章 少年被逐");
		setReferenceText(defaultReferenceText);
		setReferenceFileName("");
		setRubricResult(null);
		setScoreResult(null);
		setReferenceProfileProgress([]);
		setStatus("已填入示例参考章节。示例只用于演示，市场定位仍需 AI 识别或手动校正。");
	}

	function useExampleBook() {
		setBookTitle("示例长篇小说");
		setBookText(defaultBookText);
		setBookUpload(null);
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("已填入示例整书文本。示例只用于演示，请在正式拆解前替换为自己的 TXT。");
	}

	function applyInferredPlatformStrategy(
		profile: InferredReferenceProfile | ReferenceProfileResult,
		force = false,
	) {
		if (platformStrategyTouchedRef.current && !force) {
			return;
		}

		const inferredStrategy = inferPlatformStrategyFromProfile(profile, platform, readingMode);
		setRecommendationSignals(inferredStrategy.recommendationSignals);
		setCompetitionLevel(inferredStrategy.competitionLevel);
		setCompetitionNotes(inferredStrategy.competitionNotes);
		setPushStage(inferredStrategy.pushStage);
		setTrafficEntry(inferredStrategy.trafficEntry);
	}

	function applyLocalReferenceInference(text: string, filename?: string) {
		const inferred = inferReferenceProfile(text, filename ?? referenceTitle);
		setReferenceTitle(inferred.title);
		if (!chapterDraftTouchedRef.current) {
			setChapterTitle(inferred.title);
			setChapterText(text);
		}
		setGenre(inferred.genre);
		setCategory(inferred.category);
		setTheme(inferred.theme);
		setTags(inferred.tags);
		setExplicitKeywords(inferred.explicitKeywords);
		setImplicitExpectations(inferred.implicitExpectations);
		setPositioningPromise(inferred.positioningPromise);
		applyInferredPlatformStrategy(inferred, true);
		setRubricResult(null);
		setScoreResult(null);
		resetScoreProgress();
		setStatus("本地演示结果已写入；切换到可用模型服务后可用 AI 重新识别。");
		return inferred;
	}

	function applyReferenceProfileResult(result: ReferenceProfileResult) {
		setReferenceTitle(result.referenceTitle || referenceTitle);
		if (!chapterDraftTouchedRef.current && result.referenceTitle) {
			setChapterTitle(result.referenceTitle);
		}
		setGenre(result.genre || "other");
		setCategory(result.category);
		setTheme(result.theme);
		setTags(result.tags.join("，"));
		setExplicitKeywords(result.explicitKeywords.join("，"));
		setImplicitExpectations(result.implicitExpectations.join("，"));
		setPositioningPromise(result.positioningPromise);
		applyInferredPlatformStrategy(result, true);
		setRubricResult(null);
		setScoreResult(null);
		resetScoreProgress();
		const confidence =
			typeof result.confidence === "number"
				? `，置信度 ${Math.round(result.confidence * 100)}%`
				: "";
		const suffix = result.notes ? `。${result.notes}` : "";
		setStatus(`AI 已识别市场定位${confidence}；你可以校正后生成评分标准${suffix}`);
	}

	async function inferReferenceProfileFromModel(text = referenceText, filename?: string) {
		if (!text.trim()) {
			setStatus("请先导入或粘贴成熟章节。");
			return;
		}

		initializeReferenceProfileProgress();
		if (provider.kind === "mock") {
			const inferred = applyLocalReferenceInference(text, filename);
			updateReferenceProfileProgress("sample", {
				status: "completed",
				detail: "本地演示不会请求在线模型。",
			});
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: "已生成演示用市场定位结果。",
				facts: buildReferenceProfileFacts(inferred),
			});
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已写入演示结果；切换到可用模型服务后可重新识别。",
				facts: buildReferenceProfileFacts(inferred),
			});
			return;
		}

		const sampledText = buildReferenceProfileSample(text);
		updateReferenceProfileProgress("sample", {
			status: "completed",
			detail:
				sampledText.length === text.trim().length
					? `已使用全文识别，共 ${sampledText.length} 字。`
					: `已抽取 ${sampledText.length} 字样本，保留开头和结尾以加快识别。`,
		});
		const cacheKey = createReferenceProfileCacheKey({
			provider,
			platform,
			audience,
			readingMode,
			referenceTitle: filename ? basenameWithoutExtension(filename) : referenceTitle,
			sampledText,
		});
		const cached = referenceProfileCacheRef.current.get(cacheKey);
		if (cached) {
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: "命中缓存，未重复请求模型。",
				facts: buildReferenceProfileFacts(cached),
			});
			applyReferenceProfileResult(cached);
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已把缓存识别结果写入市场定位字段。",
				facts: buildReferenceProfileFacts(cached),
			});
			setStatus("已使用缓存的 AI 识别结果；你可以校正后生成评分标准。");
			return;
		}

		setLoading("profile");
		setStatus("正在用 AI 识别市场定位...");
		updateReferenceProfileProgress("model", {
			status: "checking",
			detail: "正在请求模型识别参考章节的市场定位。",
		});
		try {
			const result = await requestReferenceProfile({
				provider: providerPayload,
				referenceTitle: filename ? basenameWithoutExtension(filename) : referenceTitle,
				platform,
				audience,
				readingMode,
				referenceText: sampledText,
			});
			referenceProfileCacheRef.current.set(cacheKey, result);
			updateReferenceProfileProgress("model", {
				status: "completed",
				detail: result.notes || "模型已返回结构化市场定位。",
				facts: buildReferenceProfileFacts(result),
			});
			applyReferenceProfileResult(result);
			updateReferenceProfileProgress("apply", {
				status: "completed",
				detail: "已把 AI 识别结果写入下面字段，仍可手动校正。",
				facts: buildReferenceProfileFacts(result),
			});
		} catch (error) {
			updateReferenceProfileProgress("model", {
				status: "failed",
				detail: (error as Error).message,
			});
			updateReferenceProfileProgress("apply", {
				status: "failed",
				detail: "AI 识别失败，未写入市场定位字段；请切换可用模型重试，或手动填写下面字段。",
			});
			setStatus(
				`${(error as Error).message}；AI 识别失败，未自动改写市场定位字段。请切换可用模型重试，或手动填写后生成评分标准。`,
			);
		} finally {
			setLoading(null);
		}
	}

	async function importReferenceFile(event: ChangeEvent<HTMLInputElement>) {
		const input = event.currentTarget;
		const file = input.files?.[0];
		if (!file) {
			return;
		}

		try {
			const text = await file.text();
			platformStrategyTouchedRef.current = false;
			setReferenceText(text);
			setReferenceFileName(file.name);
			await inferReferenceProfileFromModel(text, file.name);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			input.value = "";
		}
	}

	async function buildRubric(force = false) {
		const cacheKey = buildRubricCacheKey();
		if (!force) {
			const cached = rubricCache.find((item) => item.key === cacheKey);
			if (cached) {
				setRubricResult(cached.result);
				setScoreResult(null);
				resetScoreProgress();
				setStatus("已使用缓存的评分标准；如需让 AI 重新拆解，请点“重新分析”。");
				return;
			}
		}

		setLoading("rubric");
		setScoreResult(null);
		resetScoreProgress();
		const rubricReferenceText = compactReferenceText(referenceText);
		setStatus(
			rubricReferenceText.length === referenceText.trim().length
				? "正在拆解参考章节并生成评分标准..."
				: `参考章节超过单次分析长度，已抽取 ${rubricReferenceText.length} 字的开头和结尾生成评分标准...`,
		);
		try {
			const result = await requestRubric({
				provider: providerPayload,
				referenceTitle,
				genre,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags,
				explicitKeywords,
				implicitExpectations,
				positioningPromise,
				recommendationSignals,
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry,
				referenceText: rubricReferenceText,
			});
			setRubricResult(result);
			rememberRubric(cacheKey, result);
			setStatus(`评分标准已生成：${result.rubric.metrics.length} 个指标`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function scoreChapter(force = false) {
		if (!rubricResult) {
			setStatus("请先生成评分标准。");
			return;
		}

		const cacheKey = buildScoreCacheKey();
		if (!force) {
			const cached = scoreCache.find((item) => item.key === cacheKey);
			if (cached) {
				setScoreResult(cached.result);
				revealScoreProgress(cached.result);
				setStatus("已使用缓存的章节评分结果；如需让 AI 重新评分，请点“重新分析”。");
				return;
			}
		}

		setLoading("score");
		setScoreResult(null);
		initializeScoreProgress(rubricResult.rubric.metrics);
		setStatus("正在按评分标准质检你的章节...");
		try {
			const result = await requestScoreChapter({
				provider: providerPayload,
				rubric: rubricResult.rubric,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags,
				explicitKeywords,
				implicitExpectations,
				positioningPromise,
				recommendationSignals,
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry,
				chapterTitle,
				chapterText,
				aiSelfTestEnabled,
				enabledAiSelfTests,
				isAlgorithmPlatform,
				isShortFormReading,
				impressions,
				clickThroughRate,
				validReadRate,
				read30sRate,
				read60sRate,
				bottomRate,
				followRate,
				bookshelfRate,
				firstChapterCompletionRate,
				nextChapterClickRate,
				threeChapterRetentionRate,
				avgReadProgressRate,
				paidUnlockRate,
			});
			setScoreResult(result);
			rememberScore(cacheKey, result);
			revealScoreProgress(result);
			setStatus(`评分完成：${result.totalScore}/10`);
		} catch (error) {
			failCurrentScoreProgress();
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function runQuickExperience(force = false) {
		if (chapterText.trim().length < 50) {
			setStatus("请先粘贴至少 50 字章节正文，再运行快速点评。");
			return;
		}

		const cacheKey = buildQuickReviewCacheKey();
		if (!force) {
			const cached = quickReviewCache.find((item) => item.key === cacheKey);
			if (cached) {
				if (quickReviewResult) {
					setPreviousQuickReviewResult(quickReviewResult);
				}
				setQuickReviewResult(cached.result);
				setStatus("已使用缓存的快速点评；如需让 AI 重新点评，请点“重新分析”。");
				return;
			}
		}

		setLoading("quick");
		if (quickReviewResult) {
			setPreviousQuickReviewResult(quickReviewResult);
		}
		setQuickReviewResult(null);
		setStatus("正在读取章节...");
		const queueStatusTimer = window.setTimeout(() => {
			setStatus(
				provider.preset === "shared-gpu"
					? "共享站可能正在排队，请继续等待..."
					: "正在等待你配置的模型返回结果...",
			);
		}, 10_000);
		try {
			setStatus("正在生成快速点评...");
			const result = await requestQuickReview({
				provider: providerPayload,
				chapterText,
				chapterTitle,
				quickReviewGenre,
			});
			setQuickReviewResult(result);
			rememberQuickReview(cacheKey, result);
			setStatus(`快速点评完成：${result.quickScore}/10`);
		} catch (error) {
			setStatus(toQuickReviewErrorMessage(error));
		} finally {
			window.clearTimeout(queueStatusTimer);
			setLoading(null);
		}
	}

	async function analyzeBook(force = false) {
		const cacheKey = buildBookAnalysisCacheKey();
		if (!force) {
			const cached = bookAnalysisCache.find((item) => item.key === cacheKey);
			if (cached) {
				setBookJob(cached.job);
				if (cached.result) {
					setBookAnalysisResult(cached.result);
				}
				setStatus(
					cached.job.status === "succeeded"
						? "已使用缓存的整书拆解结果；如需让 AI 重新拆解，请点“重新拆解”。"
						: "已恢复这本书的历史任务，继续同步最新状态。",
				);
				if (cached.job.status === "queued" || cached.job.status === "running") {
					await followBookJob(cached.job.id, {
						background: true,
						silent: true,
						maxAttempts: 600,
					});
				}
				return;
			}
		}

		setLoading("book");
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在准备上传文本并创建整书异步拆解任务...");
		try {
			const upload = bookUpload ?? (await uploadBookForPreview(false));
			const createdUploadJob = await createBookAnalysisJobFromUpload(
				upload.id,
				providerPayload,
			);
			setBookJob(createdUploadJob);
			rememberBookAnalysis(cacheKey, createdUploadJob, null);
			setStatus(`任务已创建：${createdUploadJob.id}`);

			await followBookJob(createdUploadJob.id);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function resumeBookAnalysis() {
		if (!bookJob?.id) {
			setStatus("请先打开一个可继续的整书任务。");
			return;
		}

		setLoading("book");
		setBookAnalysisResult(null);
		setStatus("正在从已完成章节继续整书拆解...");
		try {
			const resumedJob = await resumeBookAnalysisJob(bookJob.id, providerPayload);
			setBookJob(resumedJob);
			await followBookJob(resumedJob.id);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function followBookJob(
		jobId: string,
		options?: {
			background?: boolean;
			silent?: boolean;
			maxAttempts?: number;
		},
	) {
		if (activeBookPollJobIdRef.current === jobId) {
			return null;
		}

		activeBookPollJobIdRef.current = jobId;
		let latestSnapshot: BookAnalysisJob | null = null;

		try {
			for (let attempt = 0; attempt < (options?.maxAttempts ?? 120); attempt += 1) {
				await wait(1000);
				const latestJob = await readBookAnalysisJob(jobId, false);
				latestSnapshot = latestJob;
				setBookJob(latestJob);
				updateBookAnalysisCacheByJobId(jobId, latestJob);
				if (!options?.silent) {
					setStatus(latestJob.progress.message);
				}

				if (latestJob.status === "succeeded") {
					const completedJob = await readBookAnalysisJob(jobId, true);
					setBookJob(completedJob);
					if (completedJob.result) {
						latestJob.result = completedJob.result;
						setBookAnalysisResult(completedJob.result);
						updateBookAnalysisCacheByJobId(jobId, completedJob);
						if (!options?.silent) {
							setStatus(
								`整书拆解完成：${latestJob.result.characters.length} 张角色卡，已分析 ${latestJob.result.mapReduce?.mapCount ?? 0} 个章节片段`,
							);
						}
					}
					return latestJob;
				}

				if (latestJob.status === "failed") {
					throw new Error(latestJob.error || "整书拆解任务失败");
				}
			}

			if (latestSnapshot && !options?.silent) {
				setStatus("整书拆解仍在后台运行，刷新页面后也会自动恢复任务状态。");
			}
			return latestSnapshot;
		} finally {
			if (activeBookPollJobIdRef.current === jobId) {
				activeBookPollJobIdRef.current = null;
			}
		}
	}

	async function uploadBookForPreview(manageLoading = true) {
		if (manageLoading) {
			setLoading("upload");
		}
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在上传 TXT 并生成章节预览...");
		try {
			const upload = await uploadBookPreview({
				bookFile,
				bookText,
				bookTitle,
				bookGenre,
			});
			setBookUpload(upload);
			setStatus(`章节预览完成：${upload.chapterCount} 个章节片段`);
			return upload;
		} catch (error) {
			setStatus((error as Error).message);
			throw error;
		} finally {
			if (manageLoading) {
				setLoading(null);
			}
		}
	}

	async function loadHistory(options?: { silent?: boolean }) {
		if (!options?.silent) {
			setLoading("history");
			setStatus("正在加载历史任务...");
		}
		try {
			const { jobs, uploads } = await listBookHistory(10);
			setBookHistory(jobs);
			setUploadHistory(uploads);
			if (!options?.silent) {
				setStatus(`历史已加载：${jobs.length} 个任务，${uploads.length} 个上传`);
			}
		} catch (error) {
			if (!options?.silent) {
				setStatus((error as Error).message);
			}
		} finally {
			if (!options?.silent) {
				setLoading(null);
			}
		}
	}

	async function deleteHistoryJob(jobId: string) {
		const target = bookHistory.find((job) => job.id === jobId);
		const title = target?.inputSummary.title || jobId;
		if (!window.confirm(`删除历史任务「${title}」？删除后不能从历史记录恢复。`)) {
			return;
		}

		setLoading("history");
		setStatus("正在删除历史任务...");
		try {
			await deleteBookAnalysisJob(jobId);
			setBookHistory((current) => current.filter((job) => job.id !== jobId));
			setBookAnalysisCache((current) => current.filter((entry) => entry.job.id !== jobId));
			setSelectedResearchJobIds((current) =>
				current.filter((selectedJobId) => selectedJobId !== jobId),
			);
			if (bookJob?.id === jobId) {
				setBookJob(null);
				setBookAnalysisResult(null);
				setResearchComparison(null);
				setResearchQaResult(null);
			}
			setStatus(`已删除历史任务：${title}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function loadResearchLibrary() {
		setLoading("research");
		setStatus("正在读取本地研究库资产...");
		try {
			const result = await readResearchLibrary(50);
			setPersistedResearchLibrary(result);
			setSelectedResearchJobIds((current) => {
				const availableIds = new Set(
					result.comparisonSamples.map((sample) => sample.jobId),
				);
				const kept = current.filter((jobId) => availableIds.has(jobId));
				if (kept.length) {
					return kept;
				}

				return result.comparisonSamples.slice(0, 3).map((sample) => sample.jobId);
			});
			setStatus(
				`研究库已更新：${result.sourceSummary.completedBooks} 本完成样本，${result.graphAssets.length} 组图谱资产`,
			);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	function toggleResearchSample(jobId: string) {
		setSelectedResearchJobIds((current) =>
			current.includes(jobId)
				? current.filter((item) => item !== jobId)
				: [...current, jobId],
		);
	}

	async function runResearchComparison() {
		if (selectedResearchJobIds.length < 2) {
			setStatus("横向对比至少需要选择 2 本已完成样本。");
			return;
		}

		setLoading("compare");
		setStatus("正在对选中样本做多书横向对比...");
		try {
			const result = await compareResearchBooks(selectedResearchJobIds, comparisonFocus);
			setResearchComparison(result);
			setStatus(`已完成 ${result.sampleCount} 本样本横向对比。`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function askResearchLibrary() {
		if (!researchQuestion.trim()) {
			setStatus("请先输入要问研究库的问题。");
			return;
		}

		setLoading("ask");
		setStatus("正在基于已拆解资料回答问题...");
		try {
			const result = await requestResearchQa({
				provider: providerPayload,
				question: researchQuestion,
				jobIds: selectedResearchJobIds.length ? selectedResearchJobIds : undefined,
			});
			setResearchQaResult(result);
			setStatus(`资料问答完成：引用 ${result.citations.length} 条资料证据。`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function openHistoryJob(
		jobId: string,
		options?: { silent?: boolean; preserveLoading?: boolean },
	) {
		if (!options?.preserveLoading) {
			setLoading("history");
		}
		if (!options?.silent) {
			setStatus("正在打开历史结果...");
		}
		try {
			const job = await readBookAnalysisJob(jobId, true);
			setBookJob(job);
			if (job.result) {
				setBookAnalysisResult(job.result);
			}
			if (bookText.trim() || bookFile) {
				rememberBookAnalysis(buildBookAnalysisCacheKey(), job, job.result ?? null);
			}
			if (!options?.silent) {
				setStatus(`已打开任务：${job.status}`);
			}
		} catch (error) {
			if (!options?.silent) {
				setStatus((error as Error).message);
			}
		} finally {
			if (!options?.preserveLoading) {
				setLoading(null);
			}
		}
	}

	async function exportBookResult(format: BookExportFormat, mode: BookExportMode) {
		if (!bookJob?.id || bookJob.status !== "succeeded") {
			setStatus("请先打开一个已完成的整书拆解任务。");
			return;
		}

		setLoading("export");
		setStatus(mode === "originalized" ? "正在生成原创化导出文件..." : "正在生成导出文件...");
		try {
			const response = await fetch(
				apiUrl(`/analysis/book/jobs/${bookJob.id}/export?format=${format}&mode=${mode}`),
			);
			if (!response.ok) {
				const payload = (await response.json()) as ApiEnvelope<unknown>;
				throw new Error(payload.message || `Export failed: ${response.status}`);
			}
			const content = await response.text();
			const disposition = response.headers.get("content-disposition") || "";
			const filenameMatch = disposition.match(/filename\*=UTF-8''([^;]+)/);
			const filename = filenameMatch
				? decodeURIComponent(filenameMatch[1])
				: `book-analysis-${format}.txt`;
			downloadText(
				filename,
				content,
				response.headers.get("content-type") || "text/plain;charset=utf-8",
			);
			setStatus(`导出完成：${filename}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function readBookFile(file: File | undefined) {
		if (!file) {
			return;
		}

		setBookFile(file);
		setBookTitle(file.name.replace(/\.[^.]+$/, ""));
		setBookUpload(null);
		setBookAnalysisResult(null);
		setBookJob(null);

		if (file.size > LARGE_BOOK_INLINE_BYTES) {
			setBookText("");
			setStatus(
				`已选择大文件 ${file.name}（${formatFileSize(file.size)}）。为避免浏览器卡顿，不再展开全文，后续会直接上传并拆解。`,
			);
			return;
		}

		const text = await file.text();
		setBookText(text);
	}

	return (
		<WorkspaceShell
			activeView={activeView}
			activeMeta={activeMeta}
			navItems={navItems}
			status={status}
			loading={loading !== null}
			onOpenView={openView}
		>
			{activeView === "overview" ? (
				<OverviewView
					nextAction={nextAction}
					providerKind={provider.kind}
					providerLabel={providerLabel}
					providerModel={provider.model}
					quickLoading={loading === "quick"}
					quickElapsedSeconds={quickReviewElapsedSeconds}
					quickReviewResult={quickReviewResult}
					previousQuickReviewResult={previousQuickReviewResult}
					quickReviewGenre={quickReviewGenre}
					chapterText={chapterText}
					chapterCompletion={chapterCompletion}
					nextChapterAction={nextChapterAction}
					referenceTitle={referenceTitle || "未导入参考章节"}
					scoreResult={scoreResult}
					bookStatus={bookJob?.status ?? (bookUpload ? "已预览" : "未启动")}
					bookStatusText={bookStatusText}
					researchReadiness={researchReadiness}
					researchSourceCount={researchSourceCount}
					graphNodeCount={graphNodeCount}
					chapterProjectSteps={chapterProjectSteps}
					platformLabel={platformLabel}
					readingModeLabel={readingModeLabel}
					competitionLevelLabel={optionLabel(competitionLevelOptions, competitionLevel)}
					pushStageLabel={optionLabel(pushStageOptions, pushStage)}
					competitionNotes={competitionNotes}
					bookTitle={bookUpload?.title || bookTitle || "未填写书名"}
					bookCompletion={bookCompletion}
					bookProgressDetail={bookProgressDetail ?? undefined}
					onChapterTextChange={(value) => {
						chapterDraftTouchedRef.current = true;
						setChapterText(value);
					}}
					onQuickReviewGenreChange={setQuickReviewGenre}
					onRunQuickExperience={runQuickExperience}
					onRerunQuickExperience={() => runQuickExperience(true)}
					hasQuickReviewCache={Boolean(quickReviewCacheHit)}
					onUseExampleChapter={useExampleChapter}
					onOpenModel={() => openView("provider")}
					onOpenCritique={() => openView("chapter")}
					onOpenBook={() => openView("book")}
					onOpenView={(view) => openView(view as WorkspaceView)}
				/>
			) : null}

			{activeView === "starter" ? (
				<StarterView
					digest={beginnerLearningDigest}
					onOpenView={(view) => openView(view as WorkspaceView)}
				/>
			) : null}

			{activeView === "library" ? (
				<LibraryView
					loading={loading}
					researchSourceCount={researchSourceCount}
					graphNodeCount={graphNodeCount}
					graphEdgeCount={graphEdgeCount}
					foreshadowingCount={foreshadowingCount}
					evidenceScoreCount={evidenceScoreCount}
					comparableBookCount={comparableBookCount}
					researchReadiness={researchReadiness}
					researchSources={researchSources}
					researchGraph={researchGraph}
					scoreEvidenceChain={scoreEvidenceChain}
					comparisonSamples={comparisonSamples}
					researchPromptSeed={researchPromptSeed}
					onLoadResearchLibrary={loadResearchLibrary}
					onToggleResearchSample={toggleResearchSample}
					onRunResearchComparison={runResearchComparison}
					onAskResearchLibrary={askResearchLibrary}
					onCopyText={(text, message) => {
						void navigator.clipboard.writeText(text);
						setStatus(message);
					}}
					onOpenView={openView}
				/>
			) : null}

			{activeView === "provider" ? (
				<section className="rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<KeyRound className="size-5 text-primary" />
							<h2 className="text-lg font-semibold">
								1. AI 设置
								<FieldHelp text="这里决定由哪个模型服务来分析小说。共享站由服务端统一配置；选择付费或本地模型时会使用你填写的 Base URL、Model 和 API Key。" />
							</h2>
						</div>
						<Button onClick={testProvider} disabled={loading !== null}>
							{loading === "provider" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							测试连接
						</Button>
					</div>
					<p className="mt-3 text-sm leading-6 text-muted-foreground">
						先测试当前模型服务是否可用。这里的设置会保存到本机浏览器，下次打开继续使用；API
						Key 不会上传到后端保存。
					</p>
					<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<span>本机默认：{providerPresets[provider.preset].label}</span>
						<span>{provider.model || "未指定模型"}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={resetProviderSettings}
						>
							恢复默认
						</Button>
					</div>
					{selectedProviderPreset.notice ? (
						<div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
							<div className="flex items-start gap-2">
								<ShieldAlert className="mt-0.5 size-4 shrink-0" />
								<p>{selectedProviderPreset.notice}</p>
							</div>
						</div>
					) : null}

					<div className="mt-5 grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="provider-kind">使用方式</Label>
							<select
								id="provider-kind"
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={provider.kind}
								onChange={(event) => {
									const nextKind = event.target.value as ProviderKind;
									setProvider((current) => ({
										...current,
										kind: nextKind,
										preset:
											current.preset === "shared-gpu" && nextKind === "mock"
												? "custom"
												: current.preset,
									}));
								}}
							>
								<option value="mock">本地演示</option>
								<option value="openai-compatible">共享站/付费模型</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="provider-preset">模型服务</Label>
							<select
								id="provider-preset"
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={provider.preset}
								onChange={(event) =>
									applyProviderPreset(event.target.value as ProviderPresetId)
								}
							>
								{Object.entries(providerPresets).map(([id, preset]) => (
									<option key={id} value={id}>
										{preset.label}
									</option>
								))}
							</select>
						</div>
						<div className="space-y-2">
							<div className="flex items-center gap-1">
								<Label htmlFor="provider-model">模型（Model）</Label>
								<FieldHelp text="不同模型擅长的内容、速度和稳定性不同。共享站的模型由服务端配置；付费模型会使用这里选择或填写的 Model。" />
							</div>
							{providerModelOptions.length ? (
								<select
									id="provider-model-option"
									aria-label="选择预设模型"
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									value={selectedModelOption}
									onChange={(event) => {
										if (event.target.value === "__custom__") {
											return;
										}
										setProvider((current) => ({
											...current,
											model: event.target.value,
										}));
									}}
								>
									{providerModelOptions.map((model) => (
										<option key={model} value={model}>
											{model}
										</option>
									))}
									<option value="__custom__">手动输入其他 Model</option>
								</select>
							) : null}
							<Input
								id="provider-model"
								value={provider.model}
								onChange={(event) =>
									setProvider((current) => ({
										...current,
										model: event.target.value,
									}))
								}
								placeholder={
									isBackendFreeProvider
										? "由共享站服务端配置决定"
										: "例如 qwen-plus-latest"
								}
								disabled={provider.preset === "shared-gpu"}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="provider-base-url">Base URL（高级）</Label>
							<Input
								id="provider-base-url"
								value={provider.baseUrl}
								onChange={(event) =>
									setProvider((current) => ({
										...current,
										preset: "custom",
										baseUrl: event.target.value,
									}))
								}
								placeholder={
									isBackendFreeProvider ? "由共享站服务端配置提供" : undefined
								}
								disabled={provider.preset === "shared-gpu"}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="provider-api-key">API Key（高级）</Label>
							{isBackendFreeProvider ? (
								<div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
									<p className="font-medium text-foreground">无需填写</p>
									<p>
										共享站由服务器统一连接。你只需要测试是否可用；如果不可用，可以切换到付费模型并填写自己的
										API Key。
									</p>
								</div>
							) : (
								<Input
									id="provider-api-key"
									type="password"
									value={provider.apiKey}
									onChange={(event) =>
										setProvider((current) => ({
											...current,
											apiKey: event.target.value,
										}))
									}
									placeholder={
										providerPresets[provider.preset].needsApiKey
											? "填写你的模型服务 API Key，只保存在本机浏览器"
											: "本地模型可留空"
									}
								/>
							)}
						</div>
					</div>
				</section>
			) : null}

			{activeView === "chapter" ? (
				<ChapterCritiqueView
					loading={loading}
					providerLabel={providerLabel}
					quickLoading={loading === "quick"}
					quickElapsedSeconds={quickReviewElapsedSeconds}
					quickReviewResult={quickReviewResult}
					previousQuickReviewResult={previousQuickReviewResult}
					quickReviewGenre={quickReviewGenre}
					importReferenceFile={importReferenceFile}
					onInferReferenceProfile={inferReferenceProfileFromModel}
					onReferenceTextChange={(value) => {
						setReferenceText(value);
						setRubricResult(null);
						setScoreResult(null);
						resetReferenceProfileProgress();
						resetScoreProgress();
					}}
					onQuickReviewGenreChange={setQuickReviewGenre}
					onRunQuickExperience={runQuickExperience}
					onRerunQuickExperience={() => runQuickExperience(true)}
					hasQuickReviewCache={Boolean(quickReviewCacheHit)}
					onUseExampleChapter={useExampleChapter}
					onUseExampleReference={useExampleReference}
					onOpenModel={() => openView("provider")}
					onOpenBook={() => openView("book")}
					onBuildRubric={buildRubric}
					onRebuildRubric={() => buildRubric(true)}
					onScoreChapter={scoreChapter}
					onRescoreChapter={() => scoreChapter(true)}
					hasRubricCache={Boolean(rubricCacheHit)}
					hasScoreCache={Boolean(scoreCacheHit)}
					onPlatformStrategyChange={(patch) => {
						platformStrategyTouchedRef.current = true;
						if (patch.recommendationSignals !== undefined) {
							setRecommendationSignals(patch.recommendationSignals);
						}
						if (patch.trafficEntry !== undefined) {
							setTrafficEntry(patch.trafficEntry);
						}
						if (patch.competitionLevel !== undefined) {
							setCompetitionLevel(patch.competitionLevel);
						}
						if (patch.pushStage !== undefined) {
							setPushStage(patch.pushStage);
						}
						if (patch.competitionNotes !== undefined) {
							setCompetitionNotes(patch.competitionNotes);
						}
					}}
					onChapterDraftChange={(patch) => {
						chapterDraftTouchedRef.current = true;
						if (patch.chapterTitle !== undefined) {
							setChapterTitle(patch.chapterTitle);
						}
						if (patch.chapterText !== undefined) {
							setChapterText(patch.chapterText);
						}
					}}
				/>
			) : null}

			{activeView === "book" ? (
				<>
					<WorkflowGuide
						steps={[
							"上传或粘贴 TXT",
							"预览章节切分",
							"启动整书拆解任务",
							"查看人物、世界观和时间线",
							"去导出中心下载素材",
						]}
						note="整书文本通常太长，不能一次分析完。这里会先切成章节，再逐章分析，最后汇总成整书资料。"
					/>
					<section className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-2">
								<Network className="size-5 text-primary" />
								<h2 className="text-lg font-semibold">
									整书 TXT 拆解
									<FieldHelp text="先上传并预览章节，确认切分合理后再启动整书拆解，避免错章影响人物和时间线。" />
								</h2>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={useExampleBook}
									disabled={loading !== null}
								>
									填入示例整书
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										void uploadBookForPreview().catch(() => undefined)
									}
									disabled={loading !== null}
								>
									{loading === "upload" ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									上传并预览章节
								</Button>
								<Button
									onClick={() => void analyzeBook()}
									disabled={loading !== null}
								>
									{loading === "book" ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									启动整书拆解
								</Button>
								{bookAnalysisCacheHit ? (
									<Button
										variant="outline"
										onClick={() => analyzeBook(true)}
										disabled={loading !== null}
									>
										重新拆解
									</Button>
								) : null}
							</div>
						</div>
						<div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
							<div className="space-y-2">
								<Label htmlFor="book-title">书名</Label>
								<Input
									id="book-title"
									value={bookTitle}
									onChange={(event) => setBookTitle(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="book-genre">题材</Label>
								<select
									id="book-genre"
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									value={bookGenre}
									onChange={(event) => setBookGenre(event.target.value)}
								>
									<option value="xuanhuan">玄幻</option>
									<option value="urban">都市</option>
									<option value="romance">言情</option>
									<option value="suspense">悬疑</option>
									<option value="infinite-flow">无限流</option>
									<option value="other">其他</option>
								</select>
							</div>
						</div>
						<div className="mt-4 space-y-2">
							<Label htmlFor="book-file">上传 TXT</Label>
							<Input
								id="book-file"
								type="file"
								accept=".txt,text/plain"
								onChange={(event) => readBookFile(event.target.files?.[0])}
							/>
						</div>
						{bookFileTooLargeForInlinePreview ? (
							<div className="mt-4 rounded-md border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
								<div>已选择文件：{bookFile?.name}</div>
								<div>
									文件大小：{bookFile ? formatFileSize(bookFile.size) : "-"}
								</div>
								<div>当前模式：直接上传并拆解，不在浏览器中展开全文。</div>
							</div>
						) : (
							<textarea
								id="book-text"
								aria-label="整书文本"
								className="mt-4 min-h-56 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6"
								value={bookText}
								onChange={(event) => setBookText(event.target.value)}
							/>
						)}
					</section>

					<BookUploadPreviewPanel upload={bookUpload} />
					<BookJobPanel job={bookJob} loading={loading} onResume={resumeBookAnalysis} />
					<section className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-lg font-semibold">整书结果管理</h2>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									历史任务和导出不再作为主导航，它们围绕整书拆解结果使用：先打开或完成一个任务，再下载报告、世界书和原创化素材包。
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" onClick={() => openView("history")}>
									历史记录
								</Button>
								<Button
									variant="outline"
									onClick={() => openView("exports")}
									disabled={!bookJob || bookJob.status !== "succeeded"}
								>
									导出结果
								</Button>
							</div>
						</div>
					</section>
					<BookAnalysisPanel result={bookAnalysisResult} job={bookJob} />
				</>
			) : null}

			{activeView === "history" ? (
				<>
					<BookHistoryPanel
						jobs={bookHistory}
						uploads={uploadHistory}
						loading={loading}
						onLoadHistory={loadHistory}
						onOpenJob={openHistoryJob}
						onDeleteJob={deleteHistoryJob}
					/>
					<BookJobPanel job={bookJob} loading={loading} onResume={resumeBookAnalysis} />
					<BookAnalysisPanel result={bookAnalysisResult} job={bookJob} />
				</>
			) : null}

			{activeView === "exports" ? (
				<ExportView
					job={bookJob}
					result={bookAnalysisResult}
					loading={loading}
					onExport={exportBookResult}
					onOpenHistory={() => openView("history")}
				/>
			) : null}
		</WorkspaceShell>
	);
}

function BookHistoryPanel({
	jobs,
	uploads,
	loading,
	onLoadHistory,
	onOpenJob,
	onDeleteJob,
}: {
	jobs: BookAnalysisJob[];
	uploads: BookUploadPreview[];
	loading: string | null;
	onLoadHistory: () => void;
	onOpenJob: (jobId: string) => void;
	onDeleteJob: (jobId: string) => void;
}) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<BookOpenCheck className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">
						历史任务
						<FieldHelp text="历史记录来自本地数据库。已完成任务可以重新打开结果，不需要重新跑模型。" />
					</h2>
				</div>
				<Button variant="outline" onClick={onLoadHistory} disabled={loading !== null}>
					{loading === "history" ? (
						<Loader2 className="mr-2 size-4 animate-spin" />
					) : null}
					刷新历史
				</Button>
			</div>
			<div className="mt-5 grid gap-4 xl:grid-cols-2">
				<div className="rounded-md border border-border bg-background p-4">
					<p className="font-medium">最近任务</p>
					<div className="mt-3 max-h-72 overflow-auto space-y-2 text-sm">
						{jobs.length ? (
							jobs.map((job) => {
								const canDelete =
									job.status === "succeeded" || job.status === "failed";
								return (
									<div
										key={job.id}
										className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2"
									>
										<button
											type="button"
											onClick={() => onOpenJob(job.id)}
											className="min-w-0 flex-1 text-left hover:text-primary"
										>
											<div className="flex items-center justify-between gap-3">
												<span className="truncate font-medium">
													{job.inputSummary.title}
												</span>
												<span className="shrink-0">{job.status}</span>
											</div>
											<p className="mt-1 truncate text-xs text-muted-foreground">
												{job.id}
											</p>
										</button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
											onClick={() => onDeleteJob(job.id)}
											disabled={loading !== null || !canDelete}
											title={
												canDelete
													? "删除这条历史任务"
													: "运行中的任务暂不能删除"
											}
											aria-label={`删除历史任务 ${job.inputSummary.title}`}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								);
							})
						) : (
							<p className="text-muted-foreground">暂无历史任务。</p>
						)}
					</div>
				</div>
				<div className="rounded-md border border-border bg-background p-4">
					<p className="font-medium">最近上传</p>
					<div className="mt-3 max-h-72 overflow-auto space-y-2 text-sm">
						{uploads.length ? (
							uploads.map((upload) => (
								<div
									key={upload.id}
									className="rounded-md border border-border bg-card px-3 py-2"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="font-medium">{upload.title}</span>
										<span>{upload.chapterCount} 章</span>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{upload.originalFilename}
									</p>
								</div>
							))
						) : (
							<p className="text-muted-foreground">暂无上传记录。</p>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

function BookUploadPreviewPanel({ upload }: { upload: BookUploadPreview | null }) {
	if (!upload) {
		return null;
	}

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<FileText className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">
							TXT 上传与章节预览
							<FieldHelp text="章节预览用于检查标题识别和自动分块是否合理。长文本拆解质量很依赖这一步。" />
						</h2>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{upload.id}</p>
				</div>
				<span className="rounded-md border border-border px-3 py-1 text-sm">
					{upload.chapterCount} 个章节片段
				</span>
			</div>
			<div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">文件名</p>
					<p className="mt-1 truncate font-medium">{upload.originalFilename}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">原始字符</p>
					<p className="mt-1 text-lg font-semibold">{upload.rawLength}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">清洗后字符</p>
					<p className="mt-1 text-lg font-semibold">{upload.cleanedLength}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">段落</p>
					<p className="mt-1 text-lg font-semibold">
						{upload.preprocessing.cleaning.paragraphCount}
					</p>
				</div>
			</div>
			<div className="mt-4 max-h-72 overflow-auto rounded-md border border-border bg-background text-sm">
				{upload.preprocessing.chapters.map((chapter) => (
					<div
						key={chapter.id}
						className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
					>
						<span>
							{chapter.order}. {chapter.title}
						</span>
						<span className="text-xs text-muted-foreground">
							{chapter.charCount} 字符 · {chapter.splitBy}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}

function BookJobPanel({
	job,
	loading,
	onResume,
}: {
	job: BookAnalysisJob | null;
	loading: LoadingState;
	onResume: () => void;
}) {
	if (!job) {
		return null;
	}

	const percent =
		job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;
	const progressDetail = getBookJobProgressDetail(job);
	const canResume = job.status === "failed" && Boolean(job.partialResult);
	const resumeOutlineChunk = job.partialResult
		? Math.min(
				(job.partialResult.outlineCount ?? job.partialResult.mapCount) + 1,
				job.partialResult.totalChapters,
			)
		: 1;

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Network className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">整书拆解任务</h2>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{job.id}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{canResume ? (
						<Button variant="outline" onClick={onResume} disabled={loading !== null}>
							{loading === "book" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							继续拆解
						</Button>
					) : null}
					<span className="rounded-md border border-border px-3 py-1 text-sm">
						{job.status}
					</span>
				</div>
			</div>
			<div className="mt-5">
				<div className="h-2 overflow-hidden rounded-full bg-secondary">
					<div
						className="h-full bg-primary transition-all"
						style={{ width: `${Math.min(100, percent)}%` }}
					/>
				</div>
				<p className="mt-3 text-sm text-muted-foreground">{job.progress.message}</p>
			</div>
			{progressDetail ? (
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="rounded-md border border-border bg-background p-4">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">轻索引</span>
							<span className="font-medium">
								{progressDetail.outline.current}/{progressDetail.outline.total}
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-secondary">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${progressDetail.outline.percent}%` }}
							/>
						</div>
					</div>
					<div className="rounded-md border border-border bg-background p-4">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">深拆重点片段</span>
							<span className="font-medium">
								{progressDetail.deep.current}/{progressDetail.deep.total}
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-secondary">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${progressDetail.deep.percent}%` }}
							/>
						</div>
					</div>
					{progressDetail.strategy ? (
						<p className="md:col-span-2 text-xs leading-5 text-muted-foreground">
							{progressDetail.strategy}
						</p>
					) : null}
				</div>
			) : null}
			{job.preprocessing ? (
				<div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">清洗后字符</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.cleaning.cleanedLength}
						</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">段落数</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.cleaning.paragraphCount}
						</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">章节片段</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.chapters.length}
						</p>
					</div>
				</div>
			) : null}
			{job.partialResult ? (
				<div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="size-4 text-success-foreground" />
						<p className="font-semibold">已保存中间拆解结果</p>
					</div>
					<div className="mt-3 grid gap-3 md:grid-cols-3">
						<p>
							<span className="text-muted-foreground">轻索引：</span>
							{job.partialResult.outlineCount ?? job.partialResult.mapCount}/
							{job.partialResult.totalChapters}
						</p>
						<p>
							<span className="text-muted-foreground">保存时间：</span>
							{new Date(job.partialResult.savedAt).toLocaleString()}
						</p>
						<p className="break-all">
							<span className="text-muted-foreground">本地目录：</span>
							{job.partialResult.artifactDir}
						</p>
					</div>
					{job.partialResult.deepTargetOrders?.length ? (
						<p className="mt-2 text-xs leading-5 text-muted-foreground">
							深拆重点片段 {job.partialResult.deepCompletedCount ?? 0}/
							{job.partialResult.deepTargetOrders.length}
						</p>
					) : null}
					<p className="mt-3 text-xs leading-5 text-muted-foreground">
						{job.partialResult.notice}
					</p>
					{canResume ? (
						<p className="mt-2 text-xs leading-5 text-foreground">
							将从已保存状态继续。当前轻索引已完成{" "}
							{job.partialResult.outlineCount ?? job.partialResult.mapCount}/
							{job.partialResult.totalChapters}
							，下一段从第 {resumeOutlineChunk} 个片段附近恢复。
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
