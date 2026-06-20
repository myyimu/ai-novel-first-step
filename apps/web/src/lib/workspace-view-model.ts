import {
	BookOpenCheck,
	Download,
	FileText,
	History,
	LayoutDashboard,
	Network,
	Settings,
	Sparkles,
} from "lucide-react";
import type { WorkspaceNavItem } from "@/components/workspace/workspace-shell";
import { parseOptionalNumber } from "@/lib/workspace-analysis-client";
import type { WorkspaceView } from "@/lib/workspace-routes";
import type {
	BookAnalysisJob,
	BookAnalysisResult,
	BookUploadPreview,
	QuickReviewResult,
	ScoreResult,
} from "@/stores/workspace-store";

export const workspaceViewItems: Array<WorkspaceNavItem<WorkspaceView>> = [
	{
		id: "overview",
		label: "第一步",
		icon: LayoutDashboard,
		title: "第一章质检台",
		description: "先粘贴一章，找出最大追读问题，拿到可复制给写作 AI 的改稿 Prompt。",
	},
	{
		id: "starter",
		label: "新手模式",
		icon: Sparkles,
		title: "新手模式",
		description:
			"如果你想用 AI 写网文，但还没看懂网文怎么运作：先让每本书只留下 3 条关键规律。",
	},
	{
		id: "library",
		label: "研究决策",
		icon: BookOpenCheck,
		title: "研究决策",
		description:
			"把已拆解样本变成可追溯的创作判断：研究库、多书横向对比和选题 Prompt 都从这里汇总。",
	},
	{
		id: "provider",
		label: "AI 设置",
		icon: Settings,
		title: "AI 设置",
		description:
			"选择用于分析小说的模型服务。可用共享站，也可以切换到自己的模型账号或本地模型。",
	},
	{
		id: "chapter",
		label: "高级质检",
		icon: FileText,
		title: "高级章节质检",
		description: "急诊跑通后，再用成熟样本、评分标准、证据链和数据快照做深度判断。",
	},
	{
		id: "book",
		label: "整书资产",
		icon: Network,
		title: "整书资产",
		description:
			"上传 TXT，检查章节切分，逐章拆解世界观、人物和故事线；历史任务和导出围绕这里展开。",
	},
	{
		id: "history",
		label: "历史任务",
		icon: History,
		title: "历史任务",
		description: "重新打开以前的上传记录和整书拆解结果，服务重启后也能查看已完成报告。",
	},
	{
		id: "exports",
		label: "导出中心",
		icon: Download,
		title: "导出中心",
		description: "选择学习笔记或原创化素材包，再下载报告、角色卡、世界书和避险清单。",
	},
];

const primaryWorkspaceViews = new Set<WorkspaceView>([
	"overview",
	"chapter",
	"book",
	"library",
	"provider",
]);

export function getWorkspaceNavItems() {
	return workspaceViewItems.filter((item) => primaryWorkspaceViews.has(item.id));
}

export function getWorkspaceViewMeta(view: WorkspaceView) {
	return workspaceViewItems.find((item) => item.id === view) ?? workspaceViewItems[0];
}

export interface ChapterProjectStep {
	label: string;
	done: boolean;
	detail: string;
}

export interface OverviewNextAction {
	title: string;
	description: string;
	actionLabel: string;
	view: WorkspaceView;
	secondaryLabel?: string;
	secondaryView?: WorkspaceView;
}

export function getPerformanceSnapshotNote({
	isShortFormReading,
	isLongSerialization,
}: {
	isShortFormReading: boolean;
	isLongSerialization: boolean;
}) {
	if (isShortFormReading) {
		return "短篇付费重点看点击后的全文读完、平均阅读进度和付费解锁，不使用追更、下一章点击、前3章留存。";
	}

	if (isLongSerialization) {
		return "长篇追更重点看首章完读、加书架/收藏、章末下一章点击、前3章留存和追更；阅读60s只作低权重参考。";
	}

	return "移动端连载重点看点击后前30/60秒留住、触底、加书架、下一章点击和前3章留存。";
}

export function buildChapterWorkspaceSummary({
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
	performanceValues,
	performanceSnapshotNote,
}: {
	platformLabel: string;
	audienceLabel: string;
	readingModeLabel: string;
	referenceText: string;
	referenceFileName: string;
	chapterText: string;
	quickReviewResult: QuickReviewResult | null;
	referenceProfileApplied: boolean;
	category: string;
	theme: string;
	rubricResult: { rubric: { metrics: unknown[] } } | null;
	scoreResult: ScoreResult | null;
	performanceValues: string[];
	performanceSnapshotNote: string;
}) {
	const hasChapterDraft = Boolean(chapterText.trim());
	const hasReferenceText = Boolean(referenceText.trim());
	const hasPerformanceSnapshot = performanceValues.some(
		(item) => parseOptionalNumber(item) !== undefined,
	);
	const chapterProjectSteps: ChapterProjectStep[] = [
		{
			label: "平台和策略画像",
			done: Boolean(platformLabel && audienceLabel && readingModeLabel),
			detail: `${platformLabel} · ${audienceLabel} · ${readingModeLabel}`,
		},
		{
			label: "成熟章节导入",
			done: hasReferenceText,
			detail: hasReferenceText
				? referenceFileName || `${referenceText.trim().length} 字参考文本`
				: "可稍后导入，用来生成更细的评分标准。",
		},
		{
			label: "快速点评",
			done: Boolean(quickReviewResult),
			detail: quickReviewResult
				? `${quickReviewResult.quickScore}/10 · ${quickReviewResult.mainProblem}`
				: hasChapterDraft
					? "已有章节正文，可以先跑一次快速点评。"
					: "先粘贴自己的章节正文，最快看到反馈。",
		},
		{
			label: "市场定位识别",
			done: Boolean(category.trim() && theme.trim()),
			detail: referenceProfileApplied
				? "AI 识别结果已写入，可继续校正。"
				: "可手动填写；建议点击 AI 识别获得更可靠的定位。",
		},
		{
			label: "评分标准",
			done: Boolean(rubricResult),
			detail: rubricResult
				? `${rubricResult.rubric.metrics.length} 个评分指标`
				: "尚未生成评分标准。",
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
		? "生成评分标准"
		: !scoreResult
			? "开始章节评分"
			: "查看评分报告";

	return {
		hasChapterDraft,
		hasReferenceText,
		hasPerformanceSnapshot,
		chapterProjectSteps,
		chapterCompletion,
		nextChapterAction,
	};
}

export function buildOverviewNextAction({
	hasChapterDraft,
	quickReviewResult,
	hasReferenceText,
	referenceProfileApplied,
	rubricResult,
	scoreResult,
}: {
	hasChapterDraft: boolean;
	quickReviewResult: QuickReviewResult | null;
	hasReferenceText: boolean;
	referenceProfileApplied: boolean;
	rubricResult: unknown | null;
	scoreResult: ScoreResult | null;
}): OverviewNextAction {
	if (!hasChapterDraft) {
		return {
			title: "先粘贴自己的章节",
			description:
				"不用先填完所有信息。粘贴一段正文后，可以先跑快速点评，马上看到卖点、问题和改稿方向。",
			actionLabel: "去快速点评",
			view: "chapter",
			secondaryLabel: "选择模型",
			secondaryView: "provider",
		};
	}

	if (!quickReviewResult) {
		return {
			title: "先生成快速点评",
			description:
				"快速点评只需要一段正文，会先给出定位、卖点、最大问题和三条改法；精评可以稍后再做。",
			actionLabel: "生成快速点评",
			view: "chapter",
			secondaryLabel: "导入参考章节",
			secondaryView: "chapter",
		};
	}

	if (!hasReferenceText) {
		return {
			title: "想精评时再导入参考章节",
			description:
				"快速点评已经能给方向。需要更细的评分报告时，再导入一章成熟样本，让系统生成贴合目标题材的评分标准。",
			actionLabel: "导入成熟章节",
			view: "chapter",
			secondaryLabel: "查看快速点评",
			secondaryView: "chapter",
		};
	}

	if (!referenceProfileApplied) {
		return {
			title: "先校准市场定位",
			description:
				"当前还没有完成市场定位校准。先确认分类、主题、标签和读者期待，后面的评分标准才不会偏。",
			actionLabel: "去 AI 识别定位",
			view: "chapter",
			secondaryLabel: "AI 设置",
			secondaryView: "provider",
		};
	}

	if (!rubricResult) {
		return {
			title: "生成本章评分标准",
			description:
				"市场定位已经可用，下一步把成熟章节拆成可复用的评分标准，再用同一套标准质检你的章节。",
			actionLabel: "去生成评分标准",
			view: "chapter",
			secondaryLabel: "调整策略画像",
			secondaryView: "chapter",
		};
	}

	if (!scoreResult) {
		return {
			title: "开始质检你的章节",
			description:
				"评分标准已生成。现在可以按目标平台、市场定位、平台策略和数据快照给你的章节打分。",
			actionLabel: "去开始评分",
			view: "chapter",
			secondaryLabel: "查看评分标准",
			secondaryView: "chapter",
		};
	}

	return {
		title: "先改最大短板",
		description: scoreResult.nextRevisionMove,
		actionLabel: "查看评分报告",
		view: "chapter",
		secondaryLabel: "拆解整书",
		secondaryView: "book",
	};
}

export function buildBookWorkspaceSummary({
	bookJob,
	bookUpload,
}: {
	bookJob: BookAnalysisJob | null;
	bookUpload: BookUploadPreview | null;
}) {
	return {
		bookStatusText: bookJob
			? `${bookJob.status} · ${bookJob.progress.message}`
			: bookUpload
				? `已预览 ${bookUpload.chapterCount} 个章节片段`
				: "未启动整书拆解",
		bookCompletion: bookJob?.status === "succeeded" ? 100 : bookUpload ? 35 : 0,
	};
}

export function buildResearchWorkspaceSummary({
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
}: {
	referenceText: string;
	chapterText: string;
	chapterTitle: string;
	referenceFileName: string;
	bookUpload: BookUploadPreview | null;
	bookAnalysisResult: BookAnalysisResult | null;
	scoreResult: ScoreResult | null;
	graphNodeCount: number;
	graphEdgeCount: number;
	evidenceScoreCount: number;
	comparableBookCount: number;
}) {
	const researchSourceCount = [
		referenceText.trim(),
		chapterText.trim(),
		bookUpload,
		bookAnalysisResult,
		scoreResult,
	].filter(Boolean).length;
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
				: "需要先生成评分标准并完成章节评分。",
		},
		{
			name: "多书样本池",
			status: comparableBookCount >= 2 ? "可对比" : "样本不足",
			detail: `${comparableBookCount} 本已拆解样本；横向对比建议至少 2 本，最好 5-10 本。`,
		},
	];

	return {
		researchSourceCount,
		researchReadiness,
		researchSources,
		graphEdgeCount,
	};
}
