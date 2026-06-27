import type { ProjectMethodologyCard } from "@/stores/workspace-store";
import type { BookAnalysisJob } from "@/stores/workspace-store";
import { parseList } from "@/lib/workspace-analysis-client";
import type { ReferenceProfileResult } from "@/lib/workspace-analysis-client";

/* ──────────── file / string helpers ──────────── */

export const LARGE_BOOK_INLINE_BYTES = 512 * 1024;

export function formatFileSize(bytes: number) {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}
	if (bytes >= 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	}

	return `${bytes} B`;
}

export function basenameWithoutExtension(filename: string): string {
	return filename.replace(/\.[^.]+$/, "").trim();
}

export function toSafeFilename(value: string) {
	return (
		value
			.trim()
			.replace(/[\\/:*?"<>|]+/g, "-")
			.replace(/\s+/g, "-") || "project"
	);
}

export function downloadText(filename: string, content: string, contentType: string) {
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

export function mergeById<T extends { id: string }>(serverItems: T[], localItems: T[]) {
	const seen = new Set<string>();
	const result: T[] = [];

	for (const item of [...serverItems, ...localItems]) {
		if (seen.has(item.id)) {
			continue;
		}
		seen.add(item.id);
		result.push(item);
	}

	return result;
}

export function mergeMethodologyCards(
	serverItems: ProjectMethodologyCard[],
	localItems: ProjectMethodologyCard[],
) {
	const seen = new Set<string>();
	const result: ProjectMethodologyCard[] = [];

	for (const item of [...serverItems, ...localItems]) {
		if (seen.has(item.projectCardId)) {
			continue;
		}
		seen.add(item.projectCardId);
		result.push(item);
	}

	return result;
}

/* ──────────── async / network helpers ──────────── */

export function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isTransientFetchError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	const normalized = message.toLowerCase();

	return (
		error instanceof TypeError ||
		normalized.includes("failed to fetch") ||
		normalized.includes("networkerror") ||
		normalized.includes("load failed")
	);
}

export function toBookPollingNetworkMessage(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);

	if (isTransientFetchError(error)) {
		return "本地 API 连接暂时中断，正在自动重连";
	}

	return message || "读取整书拆解任务失败";
}

/* ──────────── genre / reference profile inference ──────────── */

export interface InferredReferenceProfile {
	title: string;
	genre: string;
	category: string;
	theme: string;
	tags: string;
	explicitKeywords: string;
	implicitExpectations: string;
	positioningPromise: string;
}

export interface InferredPlatformStrategy {
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

export function inferReferenceProfile(text: string, filename?: string): InferredReferenceProfile {
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

export function inferPlatformStrategyFromProfile(
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

export function buildReferenceProfileSample(text: string): string {
	const normalized = text.trim();
	if (normalized.length <= 7000) {
		return normalized;
	}

	return `${normalized.slice(0, 5200)}\n\n……中间内容已省略，用于加快市场定位识别……\n\n${normalized.slice(-1600)}`;
}

/* ──────────── book job progress ──────────── */

export interface BookJobProgressDetail {
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

export function getBookJobProgressDetail(job: BookAnalysisJob | null): BookJobProgressDetail | null {
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

/* ──────────── option lists ──────────── */

export const competitionLevelOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "low", label: "低竞争" },
	{ value: "medium", label: "中等竞争" },
	{ value: "high", label: "高竞争" },
];

export const pushStageOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "cold-start", label: "冷启动" },
	{ value: "second-push", label: "二轮推流" },
	{ value: "stable", label: "稳定推荐" },
	{ value: "recycle", label: "复推/召回" },
];

export const platformOptions = [
	{ value: "qidian", label: "起点" },
	{ value: "fanqie", label: "番茄" },
	{ value: "jinjiang", label: "晋江" },
	{ value: "qimao", label: "七猫" },
	{ value: "wechat-short", label: "微信短篇/小程序文" },
	{ value: "other", label: "其他" },
];

export const audienceOptions = [
	{ value: "male-fast-paced", label: "男频快节奏爽文" },
	{ value: "female-emotional", label: "女频情绪流" },
	{ value: "setting-heavy", label: "设定党/世界观" },
	{ value: "light-reader", label: "快节奏小白文" },
	{ value: "suspense-brainstorm", label: "悬疑脑洞" },
	{ value: "other", label: "其他" },
];

export const readingModeOptions = [
	{ value: "long-serialization", label: "长篇追更" },
	{ value: "mobile-fragmented", label: "移动端碎片阅读" },
	{ value: "short-paid", label: "短篇付费" },
	{ value: "other", label: "其他" },
];

export function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
	return options.find((option) => option.value === value)?.label ?? value;
}
