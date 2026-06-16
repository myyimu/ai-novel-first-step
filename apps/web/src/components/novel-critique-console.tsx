"use client";

import {
	BookOpenCheck,
	CheckCircle2,
	Download,
	FileText,
	History,
	KeyRound,
	LayoutDashboard,
	Loader2,
	Network,
	Settings,
	ShieldAlert,
	Sparkles,
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
import { WorkspaceShell, type WorkspaceNavItem } from "@/components/workspace/workspace-shell";
import {
	buildBeginnerLearningDigest,
	buildComparisonSamples,
	buildResearchGraph,
	buildResearchPromptSeed,
	buildScoreEvidenceChain,
} from "@/lib/research-library";
import {
	aiSelfTests,
	type BookAnalysisJob,
	type BookUploadPreview,
	type PersistedResearchLibrary,
	type ProviderKind,
	type ProviderPresetId,
	type ReferenceProfileProgressStepId,
	type ReferenceProfileProgressItem,
	type ResearchComparisonResult,
	type ResearchQaResult,
	type RubricMetric,
	type RubricResult,
	type ScoreResult,
	useWorkspaceStore,
} from "@/stores/workspace-store";

const providerPresets: Record<
	ProviderPresetId,
	{
		label: string;
		kind: ProviderKind;
		baseUrl: string;
		model: string;
		modelOptions?: string[];
		jsonMode: boolean;
		needsApiKey: boolean;
		notice?: string;
	}
> = {
	custom: {
		label: "自定义模型服务",
		kind: "openai-compatible",
		baseUrl: "",
		model: "",
		modelOptions: [],
		jsonMode: false,
		needsApiKey: true,
	},
	"ai-horde": {
		label: "公共免费模型",
		kind: "ai-horde",
		baseUrl: "https://aihorde.net/api/v2",
		model: "aphrodite/TheDrummer/Cydonia-24B-v4.3",
		modelOptions: [
			"aphrodite/TheDrummer/Cydonia-24B-v4.3",
			"aphrodite/TheDrummer/Skyfall-31B-v4.2",
			"aphrodite/SicariusSicariiStuff/Impish_Bloodmoon_12B",
			"koboldcpp/Cydonia-24B-v4.3",
		],
		jsonMode: false,
		needsApiKey: false,
		notice: "公共免费模型不用填写 API Key，但可能排队、变慢、失败或输出质量波动；不建议上传未授权原文、隐私内容或商业机密。",
	},
	"shared-gpu": {
		label: "免费共享算力",
		kind: "openai-compatible",
		baseUrl: "",
		model: "",
		modelOptions: [],
		jsonMode: false,
		needsApiKey: false,
		notice: "免费线路由服务器统一提供，可能排队、变慢、失败、可分析字数变少或输出质量波动；不建议上传未授权原文、隐私内容或商业机密。",
	},
	"openrouter-free": {
		label: "OpenRouter 免费模型",
		kind: "openai-compatible",
		baseUrl: "https://openrouter.ai/api/v1",
		model: "openrouter/free",
		modelOptions: [
			"openrouter/free",
			"deepseek/deepseek-r1:free",
			"qwen/qwen3-coder:free",
			"meta-llama/llama-3.2-3b-instruct:free",
		],
		jsonMode: false,
		needsApiKey: false,
		notice: "免费模型由 OpenRouter 提供，可能限流、排队、临时不可用或输出质量波动；不建议上传未授权原文、隐私内容或商业机密。",
	},
	deepseek: {
		label: "DeepSeek",
		kind: "openai-compatible",
		baseUrl: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
		modelOptions: ["deepseek-chat", "deepseek-reasoner"],
		jsonMode: false,
		needsApiKey: true,
	},
	doubao: {
		label: "豆包/火山方舟",
		kind: "openai-compatible",
		baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
		model: "doubao-seed-1-6",
		modelOptions: ["doubao-seed-1-6"],
		jsonMode: false,
		needsApiKey: true,
	},
	qwen: {
		label: "阿里云百炼/通义千问",
		kind: "openai-compatible",
		baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
		model: "qwen-plus",
		modelOptions: [
			"qwen-plus",
			"qwen-plus-latest",
			"qwen3-max",
			"qwen3-max-preview",
			"qwen-max",
			"qwen-max-latest",
			"qwen-flash",
			"qwen-turbo",
			"qwen-turbo-latest",
			"qwen3.5-plus",
			"qwen3.5-flash",
			"qwen3-coder-plus",
			"qwen3-coder-flash",
			"qwq-plus",
		],
		jsonMode: false,
		needsApiKey: true,
	},
	ollama: {
		label: "Ollama 本地模型",
		kind: "openai-compatible",
		baseUrl: "http://localhost:11434/v1",
		model: "qwen2.5:7b",
		modelOptions: ["qwen2.5:7b", "qwen3:8b", "llama3.1:8b"],
		jsonMode: false,
		needsApiKey: false,
	},
};

interface ApiEnvelope<T> {
	code: number;
	message: string;
	data: T;
}

interface HordeTextModel {
	name: string;
	workers: number;
	eta: number;
	queued: number;
	performance: number;
	jobs: number;
}

type WorkspaceView =
	| "overview"
	| "starter"
	| "library"
	| "provider"
	| "chapter"
	| "book"
	| "history"
	| "exports";

const workspaceViewRoutes: Record<WorkspaceView, string> = {
	overview: "/workspace",
	starter: "/starter",
	library: "/library",
	provider: "/model",
	chapter: "/critique",
	book: "/book",
	history: "/history",
	exports: "/export",
};

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

interface ReferenceProfileResult {
	mode: string;
	referenceTitle: string;
	genre: string;
	category: string;
	theme: string;
	tags: string[];
	explicitKeywords: string[];
	implicitExpectations: string[];
	positioningPromise: string;
	confidence?: number;
	evidence?: string[];
	notes?: string;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";

function parseList(value: string): string[] {
	return value
		.split(/[,，\n]/)
		.map((item) => item.trim())
		.filter(Boolean);
}

function parseOptionalNumber(value: string): number | undefined {
	if (!value.trim()) {
		return undefined;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
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

function hashString(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(index);
		hash |= 0;
	}

	return String(hash);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});

	const payload = (await response.json()) as ApiEnvelope<T>;
	if (!response.ok || payload.code !== 0) {
		throw new Error(payload.message || `Request failed: ${response.status}`);
	}

	return payload.data;
}

async function postForm<T>(path: string, body: FormData): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`, {
		method: "POST",
		body,
	});

	const payload = (await response.json()) as ApiEnvelope<T>;
	if (!response.ok || payload.code !== 0) {
		throw new Error(payload.message || `Request failed: ${response.status}`);
	}

	return payload.data;
}

async function getJson<T>(path: string): Promise<T> {
	const response = await fetch(`${apiBaseUrl}${path}`);
	const payload = (await response.json()) as ApiEnvelope<T>;
	if (!response.ok || payload.code !== 0) {
		throw new Error(payload.message || `Request failed: ${response.status}`);
	}

	return payload.data;
}

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
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

export function NovelCritiqueConsole({
	initialView = "overview",
}: {
	initialView?: WorkspaceView;
}) {
	const router = useRouter();
	const [activeView, setActiveView] = useState<WorkspaceView>(initialView);
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
		rubricResult,
		setRubricResult,
		scoreResult,
		setScoreResult,
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
	} = useWorkspaceStore();
	const [status, setStatus] = useState<string>(
		"默认使用公共免费模型；如果排队太久或失败，可以切换到其他模型服务。",
	);
	const [loading, setLoading] = useState<LoadingState>(null);
	const [hordeTextModels, setHordeTextModels] = useState<HordeTextModel[]>([]);
	const referenceProfileCacheRef = useRef<Map<string, ReferenceProfileResult>>(new Map());
	const chapterDraftTouchedRef = useRef(false);
	const platformStrategyTouchedRef = useRef(false);
	const scoreProgressTimersRef = useRef<number[]>([]);

	useEffect(() => {
		setActiveView(initialView);
	}, [initialView]);

	function openView(view: WorkspaceView) {
		setActiveView(view);
		router.push(workspaceViewRoutes[view]);
	}

	const navItems: Array<WorkspaceNavItem<WorkspaceView>> = [
		{
			id: "overview" as const,
			label: "工作台",
			icon: LayoutDashboard,
			title: "小说拆解工作台",
			description: "从成熟样本、章节质检到整书拆解，集中查看当前进度、下一步动作和最近结果。",
		},
		{
			id: "starter" as const,
			label: "新手模式",
			icon: Sparkles,
			title: "新手模式",
			description:
				"如果你想用 AI 写网文，但还没看懂网文怎么运作：先让每本书只留下 3 条关键规律。",
		},
		{
			id: "library" as const,
			label: "小说研究库",
			icon: BookOpenCheck,
			title: "小说研究库",
			description:
				"把上传资料变成可追溯的创作判断：知识图谱、可解释评分、多书横向对比都从这里汇总。",
		},
		{
			id: "provider" as const,
			label: "AI 设置",
			icon: Settings,
			title: "AI 设置",
			description:
				"选择用于分析小说的模型服务。默认免费可用；需要更稳定时，可以切换到自己的模型账号或本地模型。",
		},
		{
			id: "chapter" as const,
			label: "单章点评",
			icon: FileText,
			title: "单章点评流程",
			description:
				"拆成熟章节生成评分标准（Rubric），再用同一套标准质检自己的章节并生成改文 Prompt。",
		},
		{
			id: "book" as const,
			label: "整书拆解",
			icon: Network,
			title: "整书拆解流程",
			description: "上传 TXT，先检查章节切分，再逐章拆解世界观、人物和故事线。",
		},
		{
			id: "history" as const,
			label: "历史任务",
			icon: History,
			title: "历史任务",
			description: "重新打开以前的上传记录和整书拆解结果，服务重启后也能查看已完成报告。",
		},
		{
			id: "exports" as const,
			label: "导出中心",
			icon: Download,
			title: "导出中心",
			description: "选择学习笔记或原创化素材包，再下载报告、角色卡、世界书和避险清单。",
		},
	];
	const activeMeta = navItems.find((item) => item.id === activeView) ?? navItems[0];

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
	const providerModelOptions =
		provider.preset === "ai-horde" && hordeTextModels.length
			? hordeTextModels.map((model) => model.name)
			: (selectedProviderPreset.modelOptions ?? []);
	const selectedModelOption = providerModelOptions.includes(provider.model)
		? provider.model
		: "__custom__";
	const isBackendFreeProvider =
		provider.preset === "shared-gpu" ||
		provider.preset === "openrouter-free" ||
		provider.preset === "ai-horde";
	const isShortPaidReading = readingMode === "short-paid";
	const isShortFormReading = isShortPaidReading || platform === "wechat-short";
	const isLongSerialization = readingMode === "long-serialization";
	const isAlgorithmPlatform =
		platform === "fanqie" || platform === "qimao" || platform === "wechat-short";
	const performanceSnapshotNote = isShortFormReading
		? "短篇付费重点看点击后的全文读完、平均阅读进度和付费解锁，不使用追更、下一章点击、前3章留存。"
		: isLongSerialization
			? "长篇追更重点看首章完读、加书架/收藏、章末下一章点击、前3章留存和追更；阅读60s只作低权重参考。"
			: "移动端连载重点看点击后前30/60秒留住、触底、加书架、下一章点击和前3章留存。";
	const providerLabel =
		provider.kind === "mock" ? "本地演示" : providerPresets[provider.preset].label;
	const referenceProfileApplied = referenceProfileProgress.some(
		(item) => item.id === "apply" && item.status === "completed",
	);
	const hasPerformanceSnapshot = [
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
	].some((item) => parseOptionalNumber(item) !== undefined);
	const chapterProjectSteps = [
		{
			label: "平台和策略画像",
			done: Boolean(platform && audience && readingMode),
			detail: `${optionLabel(platformOptions, platform)} · ${optionLabel(
				audienceOptions,
				audience,
			)} · ${optionLabel(readingModeOptions, readingMode)}`,
		},
		{
			label: "成熟章节导入",
			done: Boolean(referenceText.trim()),
			detail: referenceFileName || `${referenceText.trim().length} 字参考文本`,
		},
		{
			label: "市场定位识别",
			done: Boolean(category.trim() && theme.trim()),
			detail: referenceProfileApplied
				? "AI 识别结果已写入，可继续校正。"
				: "可手动填写；建议点击 AI 识别获得更可靠的定位。",
		},
		{
			label: "评分标准（Rubric）",
			done: Boolean(rubricResult),
			detail: rubricResult
				? `${rubricResult.rubric.metrics.length} 个评分指标`
				: "尚未生成评分标准（Rubric）。",
		},
		{
			label: "章节评分",
			done: Boolean(scoreResult),
			detail: scoreResult
				? `${scoreResult.totalScore}/10 · ${scoreResult.weakestPoint}`
				: "尚未开始评分。",
		},
		{
			label: "数据快照",
			done: hasPerformanceSnapshot,
			detail: hasPerformanceSnapshot ? performanceSnapshotNote : "未提供数据表现指标。",
		},
	];
	const chapterCompletion = Math.round(
		(chapterProjectSteps.filter((step) => step.done).length / chapterProjectSteps.length) * 100,
	);
	const nextChapterAction = !rubricResult
		? "生成 Rubric"
		: !scoreResult
			? "开始章节评分"
			: "查看评分报告";
	const nextAction = !referenceProfileApplied
		? {
				title: "先校准市场定位",
				description:
					"当前已有初步判断，但还没有完成市场定位校准。先确认分类、主题、标签和读者期待，后面的评分标准（Rubric）才不会偏。",
				actionLabel: "去 AI 识别定位",
				view: "chapter" as const,
				secondaryLabel: "AI 设置",
				secondaryView: "provider" as const,
			}
		: !rubricResult
			? {
					title: "生成本章评分标准",
					description:
						"市场定位已经可用，下一步把成熟章节拆成可复用的评分标准（Rubric），再用同一套标准质检你的章节。",
					actionLabel: "去生成 Rubric",
					view: "chapter" as const,
					secondaryLabel: "调整策略画像",
					secondaryView: "chapter" as const,
				}
			: !scoreResult
				? {
						title: "开始质检你的章节",
						description:
							"评分标准（Rubric）已生成。现在可以按目标平台、市场定位、平台策略和数据快照给你的章节打分。",
						actionLabel: "去开始评分",
						view: "chapter" as const,
						secondaryLabel: "查看 Rubric",
						secondaryView: "chapter" as const,
					}
				: {
						title: "先改最大短板",
						description: scoreResult.nextRevisionMove,
						actionLabel: "查看评分报告",
						view: "chapter" as const,
						secondaryLabel: "拆解整书",
						secondaryView: "book" as const,
					};
	const bookStatusText = bookJob
		? `${bookJob.status} · ${bookJob.progress.message}`
		: bookUpload
			? `已预览 ${bookUpload.chapterCount} 个章节片段`
			: "未启动整书拆解";
	const bookCompletion = bookJob?.status === "succeeded" ? 100 : bookUpload ? 35 : 0;
	const researchGraph = buildResearchGraph(bookAnalysisResult);
	const scoreEvidenceChain = buildScoreEvidenceChain(scoreResult);
	const comparisonSamples = buildComparisonSamples(bookAnalysisResult, bookHistory);
	const researchPromptSeed = buildResearchPromptSeed(
		researchGraph,
		scoreEvidenceChain,
		comparisonSamples,
	);
	const beginnerLearningDigest = buildBeginnerLearningDigest(bookAnalysisResult);
	const researchSourceCount = [
		referenceText.trim(),
		chapterText.trim(),
		bookUpload,
		bookAnalysisResult,
		scoreResult,
	].filter(Boolean).length;
	const graphNodeCount = researchGraph.nodes.length;
	const graphEdgeCount = researchGraph.edges.length;
	const foreshadowingCount = researchGraph.nodes.filter(
		(item) => item.type === "foreshadowing",
	).length;
	const evidenceScoreCount = scoreEvidenceChain.items.filter((item) => item.evidence).length;
	const comparableBookCount = comparisonSamples.samples.length;
	const researchReadiness = Math.round(
		((researchSourceCount > 0 ? 1 : 0) +
			(graphNodeCount > 0 ? 1 : 0) +
			(scoreResult ? 1 : 0) +
			(comparableBookCount >= 2 ? 1 : 0)) *
			25,
	);
	const researchSources = [
		{
			name: "成熟章节样本",
			status: referenceText.trim() ? "已接入" : "缺失",
			detail: referenceFileName || `${referenceText.trim().length} 字参考章节`,
		},
		{
			name: "我的目标章节",
			status: chapterText.trim() ? "已接入" : "缺失",
			detail: `${chapterTitle} · ${chapterText.trim().length} 字`,
		},
		{
			name: "整书资料",
			status: bookUpload || bookAnalysisResult ? "已接入" : "待上传",
			detail: bookUpload
				? `${bookUpload.title} · ${bookUpload.chapterCount} 个章节片段`
				: bookAnalysisResult
					? `${bookAnalysisResult.book.title} · 已拆解`
					: "用于抽取人物、事件、伏笔和世界规则。",
		},
		{
			name: "可解释评分报告",
			status: scoreResult ? "已生成" : "待评分",
			detail: scoreResult
				? `${scoreResult.totalScore}/10 · ${evidenceScoreCount} 条证据`
				: "需要先生成评分标准（Rubric）并完成章节评分。",
		},
		{
			name: "多书样本池",
			status: comparableBookCount >= 2 ? "可对比" : "样本不足",
			detail: `${comparableBookCount} 本已拆解样本；横向对比建议至少 2 本，最好 5-10 本。`,
		},
	];

	useEffect(() => {
		return () => {
			scoreProgressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
			scoreProgressTimersRef.current = [];
		};
	}, []);

	useEffect(() => {
		if (activeView === "library" && !persistedResearchLibrary) {
			void loadResearchLibrary();
		}
	}, [activeView, persistedResearchLibrary]);

	useEffect(() => {
		if (
			activeView === "provider" &&
			provider.preset === "ai-horde" &&
			hordeTextModels.length === 0
		) {
			void loadHordeTextModels();
		}
	}, [activeView, provider.preset, hordeTextModels.length]);

	function clearScoreProgressTimers() {
		scoreProgressTimersRef.current.forEach((timer) => window.clearTimeout(timer));
		scoreProgressTimersRef.current = [];
	}

	function resetScoreProgress() {
		clearScoreProgressTimers();
		setScoreProgress([]);
	}

	function initializeScoreProgress(metrics: RubricMetric[]) {
		clearScoreProgressTimers();
		setScoreProgress(
			metrics.map((metric, index) => ({
				metricId: metric.id,
				name: metric.name,
				status: index === 0 ? "checking" : "pending",
			})),
		);
	}

	function revealScoreProgress(result: ScoreResult) {
		clearScoreProgressTimers();
		setScoreProgress(
			result.scores.map((score, index) => ({
				metricId: score.metricId,
				name: score.name,
				status: index === 0 ? "checking" : "pending",
			})),
		);

		result.scores.forEach((score, index) => {
			const timer = window.setTimeout(
				() => {
					setScoreProgress((current) =>
						current.map((item, itemIndex) => {
							if (item.metricId === score.metricId) {
								return {
									...item,
									status: "completed",
									score: score.score,
									reason: score.reason,
									evidence: score.evidence,
									fix: score.fix,
								};
							}

							if (itemIndex === index + 1 && item.status === "pending") {
								return { ...item, status: "checking" };
							}

							return item;
						}),
					);
				},
				200 + index * 320,
			);
			scoreProgressTimersRef.current.push(timer);
		});
	}

	function failCurrentScoreProgress() {
		clearScoreProgressTimers();
		setScoreProgress((current) =>
			current.map((item) =>
				item.status === "checking" ? { ...item, status: "failed" } : item,
			),
		);
	}

	function resetReferenceProfileProgress() {
		setReferenceProfileProgress([]);
	}

	function initializeReferenceProfileProgress() {
		setReferenceProfileProgress([
			{
				id: "sample",
				name: "准备识别样本",
				status: "checking",
				detail: "长文本会抽取开头和结尾，减少等待时间。",
			},
			{
				id: "model",
				name: "AI 校准市场定位",
				status: "pending",
				detail: "等待模型识别分类、主题、标签和读者期待。",
			},
			{
				id: "apply",
				name: "写入画像字段",
				status: "pending",
				detail: "把识别结果同步到下面可修改的字段。",
			},
		]);
	}

	function updateReferenceProfileProgress(
		id: ReferenceProfileProgressStepId,
		patch: Partial<Omit<ReferenceProfileProgressItem, "id" | "name">>,
	) {
		setReferenceProfileProgress((current) =>
			current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
		);
	}

	function buildReferenceProfileFacts(
		profile: InferredReferenceProfile | ReferenceProfileResult,
	): ReferenceProfileProgressItem["facts"] {
		const isModelProfile = "referenceTitle" in profile;
		const title = isModelProfile ? profile.referenceTitle : profile.title;
		const facts = [
			{ label: "标题", value: title },
			{ label: "题材", value: profile.genre },
			{ label: "细分分类", value: profile.category },
			{ label: "主题承诺", value: profile.theme },
			{
				label: "标签",
				value: Array.isArray(profile.tags) ? profile.tags.join("、") : profile.tags,
			},
			{
				label: "显性关键词",
				value: Array.isArray(profile.explicitKeywords)
					? profile.explicitKeywords.join("、")
					: profile.explicitKeywords,
			},
			{
				label: "隐性期待",
				value: Array.isArray(profile.implicitExpectations)
					? profile.implicitExpectations.join("、")
					: profile.implicitExpectations,
			},
			{ label: "标题/简介承诺", value: profile.positioningPromise },
		].filter((item) => item.value);

		if (isModelProfile && typeof profile.confidence === "number") {
			facts.push({
				label: "置信度",
				value: `${Math.round(profile.confidence * 100)}%`,
			});
		}

		if (isModelProfile && profile.evidence?.length) {
			facts.push({
				label: "识别证据",
				value: profile.evidence.join("；"),
			});
		}

		return facts;
	}

	async function testProvider() {
		setLoading("provider");
		setStatus("正在测试模型服务...");
		try {
			const result = await postJson<Record<string, unknown>>("/analysis/provider/test", {
				provider: providerPayload,
			});
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

	async function loadHordeTextModels() {
		try {
			const models = await getJson<HordeTextModel[]>("/analysis/provider/horde-models");
			setHordeTextModels(models);
			if (provider.preset === "ai-horde" && models.length) {
				setProvider((current) => {
					if (
						current.preset !== "ai-horde" ||
						models.some((model) => model.name === current.model)
					) {
						return current;
					}

					return {
						...current,
						model: models[0].name,
					};
				});
			}
		} catch {
			setHordeTextModels([]);
		}
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
		setStatus(`AI 已识别市场定位${confidence}；你可以校正后生成评分标准（Rubric）${suffix}`);
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
		const cacheKey = [
			provider.preset,
			provider.baseUrl,
			provider.model,
			platform,
			audience,
			readingMode,
			filename ? basenameWithoutExtension(filename) : referenceTitle,
			hashString(sampledText),
		].join("|");
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
			setStatus("已使用缓存的 AI 识别结果；你可以校正后生成评分标准（Rubric）。");
			return;
		}

		setLoading("profile");
		setStatus("正在用 AI 识别市场定位...");
		updateReferenceProfileProgress("model", {
			status: "checking",
			detail: "正在请求模型识别参考章节的市场定位。",
		});
		try {
			const result = await postJson<ReferenceProfileResult>("/analysis/reference/profile", {
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
				`${(error as Error).message}；AI 识别失败，未自动改写市场定位字段。请切换可用模型重试，或手动填写后生成评分标准（Rubric）。`,
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

	async function buildRubric() {
		setLoading("rubric");
		setScoreResult(null);
		resetScoreProgress();
		setStatus("正在拆解参考章节并生成评分标准（Rubric）...");
		try {
			const result = await postJson<RubricResult>("/analysis/rubric", {
				provider: providerPayload,
				referenceTitle,
				genre,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags: parseList(tags),
				explicitKeywords: parseList(explicitKeywords),
				implicitExpectations: parseList(implicitExpectations),
				positioningPromise,
				recommendationSignals: parseList(recommendationSignals),
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry: parseList(trafficEntry),
				referenceText,
			});
			setRubricResult(result);
			setStatus(`评分标准（Rubric）已生成：${result.rubric.metrics.length} 个指标`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function scoreChapter() {
		if (!rubricResult) {
			setStatus("请先生成评分标准（Rubric）。");
			return;
		}

		setLoading("score");
		setScoreResult(null);
		initializeScoreProgress(rubricResult.rubric.metrics);
		setStatus("正在按评分标准（Rubric）质检你的章节...");
		try {
			const result = await postJson<ScoreResult>("/analysis/score", {
				provider: providerPayload,
				rubric: rubricResult.rubric,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags: parseList(tags),
				explicitKeywords: parseList(explicitKeywords),
				implicitExpectations: parseList(implicitExpectations),
				positioningPromise,
				recommendationSignals: parseList(recommendationSignals),
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry: parseList(trafficEntry),
				chapterTitle,
				chapterText,
				aiSelfTest: {
					enabled: aiSelfTestEnabled && enabledAiSelfTests.length > 0,
					tests: enabledAiSelfTests,
				},
				performanceSnapshot: {
					impressions: parseOptionalNumber(impressions),
					clickThroughRate: parseOptionalNumber(clickThroughRate),
					validReadRate: isAlgorithmPlatform
						? parseOptionalNumber(validReadRate)
						: undefined,
					read30sRate: parseOptionalNumber(read30sRate),
					read60sRate: parseOptionalNumber(read60sRate),
					bottomRate: parseOptionalNumber(bottomRate),
					followRate: isShortFormReading ? undefined : parseOptionalNumber(followRate),
					bookshelfRate: parseOptionalNumber(bookshelfRate),
					firstChapterCompletionRate: parseOptionalNumber(firstChapterCompletionRate),
					nextChapterClickRate: isShortFormReading
						? undefined
						: parseOptionalNumber(nextChapterClickRate),
					threeChapterRetentionRate: isShortFormReading
						? undefined
						: parseOptionalNumber(threeChapterRetentionRate),
					avgReadProgressRate: isShortFormReading
						? parseOptionalNumber(avgReadProgressRate)
						: undefined,
					paidUnlockRate: isShortFormReading
						? parseOptionalNumber(paidUnlockRate)
						: undefined,
				},
			});
			setScoreResult(result);
			revealScoreProgress(result);
			setStatus(`评分完成：${result.totalScore}/10`);
		} catch (error) {
			failCurrentScoreProgress();
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function runQuickExperience() {
		if (chapterText.trim().length < 50) {
			setStatus("请先粘贴至少 50 字章节正文，再运行快速体验。");
			return;
		}

		setLoading("quick");
		setRubricResult(null);
		setScoreResult(null);
		resetScoreProgress();
		setStatus("快速体验：正在用默认成熟章节生成评分标准（Rubric）...");
		try {
			const generatedRubric = await postJson<RubricResult>("/analysis/rubric", {
				provider: providerPayload,
				referenceTitle,
				genre,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags: parseList(tags),
				explicitKeywords: parseList(explicitKeywords),
				implicitExpectations: parseList(implicitExpectations),
				positioningPromise,
				recommendationSignals: parseList(recommendationSignals),
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry: parseList(trafficEntry),
				referenceText,
			});
			setRubricResult(generatedRubric);
			initializeScoreProgress(generatedRubric.rubric.metrics);
			setStatus("快速体验：评分标准（Rubric）已生成，正在质检章节...");

			const scoredChapter = await postJson<ScoreResult>("/analysis/score", {
				provider: providerPayload,
				rubric: generatedRubric.rubric,
				platform,
				audience,
				readingMode,
				category,
				theme,
				tags: parseList(tags),
				explicitKeywords: parseList(explicitKeywords),
				implicitExpectations: parseList(implicitExpectations),
				positioningPromise,
				recommendationSignals: parseList(recommendationSignals),
				competitionLevel,
				competitionNotes,
				pushStage,
				trafficEntry: parseList(trafficEntry),
				chapterTitle,
				chapterText,
				aiSelfTest: {
					enabled: true,
					tests: enabledAiSelfTests.length
						? enabledAiSelfTests
						: aiSelfTests.map((test) => test.id),
				},
			});
			setScoreResult(scoredChapter);
			revealScoreProgress(scoredChapter);
			setStatus(`快速体验完成：${scoredChapter.totalScore}/10`);
		} catch (error) {
			failCurrentScoreProgress();
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function analyzeBook() {
		setLoading("book");
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在准备上传文本并创建整书异步拆解任务...");
		try {
			const upload = bookUpload ?? (await uploadBookForPreview(false));
			const createdUploadJob = await postJson<BookAnalysisJob>(
				`/analysis/book/uploads/${upload.id}/jobs`,
				{
					provider: providerPayload,
				},
			);
			setBookJob(createdUploadJob);
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
			const resumedJob = await postJson<BookAnalysisJob>(
				`/analysis/book/jobs/${bookJob.id}/resume`,
				{
					provider: providerPayload,
				},
			);
			setBookJob(resumedJob);
			await followBookJob(resumedJob.id);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function followBookJob(jobId: string) {
		for (let attempt = 0; attempt < 120; attempt += 1) {
			await wait(1000);
			const latestJob = await getJson<BookAnalysisJob>(`/analysis/book/jobs/${jobId}`);
			setBookJob(latestJob);
			setStatus(latestJob.progress.message);

			if (latestJob.status === "succeeded") {
				if (latestJob.result) {
					setBookAnalysisResult(latestJob.result);
					setStatus(
						`整书拆解完成：${latestJob.result.characters.length} 张角色卡，已分析 ${latestJob.result.mapReduce?.mapCount ?? 0} 个章节片段`,
					);
				}
				return latestJob;
			}

			if (latestJob.status === "failed") {
				throw new Error(latestJob.error || "整书拆解任务失败");
			}
		}

		throw new Error("整书拆解任务仍在运行，请稍后查询 job 状态。");
	}

	async function uploadBookForPreview(manageLoading = true) {
		if (manageLoading) {
			setLoading("upload");
		}
		setBookAnalysisResult(null);
		setBookJob(null);
		setStatus("正在上传 TXT 并生成章节预览...");
		try {
			const formData = new FormData();
			const file =
				bookFile ??
				new File([bookText], `${bookTitle || "novel"}.txt`, {
					type: "text/plain",
				});
			formData.append("file", file);
			formData.append("title", bookTitle);
			formData.append("genre", bookGenre);

			const upload = await postForm<BookUploadPreview>("/analysis/book/uploads", formData);
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

	async function loadHistory() {
		setLoading("history");
		setStatus("正在加载历史任务...");
		try {
			const [jobs, uploads] = await Promise.all([
				getJson<BookAnalysisJob[]>("/analysis/book/jobs?limit=10"),
				getJson<BookUploadPreview[]>("/analysis/book/uploads?limit=10"),
			]);
			setBookHistory(jobs);
			setUploadHistory(uploads);
			setStatus(`历史已加载：${jobs.length} 个任务，${uploads.length} 个上传`);
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
			const result = await getJson<PersistedResearchLibrary>(
				"/analysis/research/library?limit=50",
			);
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
			const result = await postJson<ResearchComparisonResult>("/analysis/research/compare", {
				jobIds: selectedResearchJobIds,
				focus: comparisonFocus,
				includePromptSeed: true,
			});
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
			const result = await postJson<ResearchQaResult>("/analysis/research/ask", {
				provider: providerPayload,
				question: researchQuestion,
				jobIds: selectedResearchJobIds.length ? selectedResearchJobIds : undefined,
				answerMode: "beginner",
			});
			setResearchQaResult(result);
			setStatus(`资料问答完成：引用 ${result.citations.length} 条资料证据。`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
		}
	}

	async function openHistoryJob(jobId: string) {
		setLoading("history");
		setStatus("正在打开历史结果...");
		try {
			const job = await getJson<BookAnalysisJob>(`/analysis/book/jobs/${jobId}`);
			setBookJob(job);
			if (job.result) {
				setBookAnalysisResult(job.result);
			}
			setStatus(`已打开任务：${job.status}`);
		} catch (error) {
			setStatus((error as Error).message);
		} finally {
			setLoading(null);
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
				`${apiBaseUrl}/analysis/book/jobs/${bookJob.id}/export?format=${format}&mode=${mode}`,
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

		const text = await file.text();
		setBookFile(file);
		setBookTitle(file.name.replace(/\.[^.]+$/, ""));
		setBookText(text);
		setBookUpload(null);
		setBookAnalysisResult(null);
		setBookJob(null);
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
					chapterCompletion={chapterCompletion}
					nextChapterAction={nextChapterAction}
					referenceTitle={referenceTitle}
					scoreResult={scoreResult}
					bookStatus={bookJob?.status ?? (bookUpload ? "已预览" : "未启动")}
					bookStatusText={bookStatusText}
					researchReadiness={researchReadiness}
					researchSourceCount={researchSourceCount}
					graphNodeCount={graphNodeCount}
					chapterProjectSteps={chapterProjectSteps}
					platformLabel={optionLabel(platformOptions, platform)}
					readingModeLabel={optionLabel(readingModeOptions, readingMode)}
					competitionLevelLabel={optionLabel(competitionLevelOptions, competitionLevel)}
					pushStageLabel={optionLabel(pushStageOptions, pushStage)}
					competitionNotes={competitionNotes}
					bookTitle={bookUpload?.title ?? bookTitle}
					bookCompletion={bookCompletion}
					chapterText={chapterText}
					quickLoading={loading === "quick"}
					onChapterTextChange={setChapterText}
					onRunQuickExperience={runQuickExperience}
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
								<FieldHelp text="这里决定由哪个模型服务来分析小说。免费服务可能排队或失败；需要更稳定时，可以切换到自己的模型账号或本地模型。" />
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
						先测试当前模型服务是否可用。免费服务适合快速体验，但可能排队或失败；自己的模型账号通常更稳定，填写的
						API Key 只会用于本次请求，不会保存。
					</p>
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
							<Label>使用方式</Label>
							<select
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={provider.kind}
								onChange={(event) => {
									const nextKind = event.target.value as ProviderKind;
									if (nextKind === "ai-horde") {
										applyProviderPreset("ai-horde");
										return;
									}

									setProvider((current) => ({
										...current,
										kind: nextKind,
										preset:
											current.preset === "ai-horde"
												? "custom"
												: current.preset,
									}));
								}}
							>
								<option value="mock">本地演示</option>
								<option value="openai-compatible">在线模型服务</option>
								<option value="ai-horde">公共免费模型</option>
							</select>
						</div>
						<div className="space-y-2">
							<Label>模型服务</Label>
							<select
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
								<Label>模型（Model）</Label>
								<FieldHelp text="不同模型擅长的内容、速度和稳定性不同。免费模型如果排队太久，可以换一个 Model 再试。" />
							</div>
							{providerModelOptions.length ? (
								<select
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
								value={provider.model}
								onChange={(event) =>
									setProvider((current) => ({
										...current,
										model: event.target.value,
									}))
								}
								placeholder={
									isBackendFreeProvider
										? provider.preset === "ai-horde"
											? "选择当前可用的免费模型"
											: "由当前免费服务决定"
										: "例如 qwen-plus-latest"
								}
								disabled={provider.preset === "shared-gpu"}
							/>
							{provider.preset === "ai-horde" ? (
								<p className="text-xs leading-5 text-muted-foreground">
									{hordeTextModels.length
										? `已加载 ${hordeTextModels.length} 个当前可用模型；列表会随服务状态变化。`
										: "正在使用内置候选模型；进入页面时会尝试获取当前可用模型。"}
								</p>
							) : null}
						</div>
						<div className="space-y-2">
							<Label>Base URL（高级）</Label>
							<Input
								value={provider.baseUrl}
								onChange={(event) =>
									setProvider((current) => ({
										...current,
										preset: "custom",
										baseUrl: event.target.value,
									}))
								}
								placeholder={
									isBackendFreeProvider
										? provider.preset === "ai-horde"
											? "公共免费模型服务"
											: "由当前免费服务提供"
										: undefined
								}
								disabled={isBackendFreeProvider}
							/>
						</div>
						<div className="space-y-2">
							<Label>API Key（高级）</Label>
							{isBackendFreeProvider ? (
								<div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
									<p className="font-medium text-foreground">无需填写</p>
									<p>
										{provider.preset === "ai-horde"
											? "当前公共免费服务可以直接使用，但排队时间和稳定性会受服务状态影响。"
											: "当前免费服务由服务器统一连接。你只需要测试是否可用；如果不可用，可以切换到其他模型服务。"}
									</p>
								</div>
							) : (
								<Input
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
											? "填写你的模型服务 API Key，不会保存"
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
					importReferenceFile={importReferenceFile}
					onInferReferenceProfile={inferReferenceProfileFromModel}
					onReferenceTextChange={(value) => {
						setReferenceText(value);
						setRubricResult(null);
						setScoreResult(null);
						resetReferenceProfileProgress();
						resetScoreProgress();
					}}
					onBuildRubric={buildRubric}
					onScoreChapter={scoreChapter}
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
								<Button onClick={analyzeBook} disabled={loading !== null}>
									{loading === "book" ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									启动整书拆解
								</Button>
							</div>
						</div>
						<div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
							<div className="space-y-2">
								<Label>书名</Label>
								<Input
									value={bookTitle}
									onChange={(event) => setBookTitle(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label>题材</Label>
								<select
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
							<Label>上传 TXT</Label>
							<Input
								type="file"
								accept=".txt,text/plain"
								onChange={(event) => readBookFile(event.target.files?.[0])}
							/>
						</div>
						<textarea
							className="mt-4 min-h-56 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6"
							value={bookText}
							onChange={(event) => setBookText(event.target.value)}
						/>
					</section>

					<BookUploadPreviewPanel upload={bookUpload} />
					<BookJobPanel job={bookJob} loading={loading} onResume={resumeBookAnalysis} />
					<BookAnalysisPanel result={bookAnalysisResult} />
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
					/>
					<BookJobPanel job={bookJob} loading={loading} onResume={resumeBookAnalysis} />
					<BookAnalysisPanel result={bookAnalysisResult} />
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
}: {
	jobs: BookAnalysisJob[];
	uploads: BookUploadPreview[];
	loading: string | null;
	onLoadHistory: () => void;
	onOpenJob: (jobId: string) => void;
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
							jobs.map((job) => (
								<button
									key={job.id}
									type="button"
									onClick={() => onOpenJob(job.id)}
									className="w-full rounded-md border border-border bg-card px-3 py-2 text-left hover:bg-secondary"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="font-medium">
											{job.inputSummary.title}
										</span>
										<span>{job.status}</span>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">{job.id}</p>
								</button>
							))
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
	const canResume = job.status === "failed" && Boolean(job.partialResult);
	const resumeChapter = job.partialResult
		? Math.min(job.partialResult.mapCount + 1, job.partialResult.totalChapters)
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
						<CheckCircle2 className="size-4 text-emerald-400" />
						<p className="font-semibold">已保存中间拆解结果</p>
					</div>
					<div className="mt-3 grid gap-3 md:grid-cols-3">
						<p>
							<span className="text-muted-foreground">已完成章节：</span>
							{job.partialResult.mapCount}/{job.partialResult.totalChapters}
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
					<p className="mt-3 text-xs leading-5 text-muted-foreground">
						{job.partialResult.notice}
					</p>
					{canResume ? (
						<p className="mt-2 text-xs leading-5 text-foreground">
							已完成 {job.partialResult.mapCount}/{job.partialResult.totalChapters}
							，从第 {resumeChapter} 章继续。
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
