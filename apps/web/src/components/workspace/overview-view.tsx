"use client";

import {
	BookOpenCheck,
	CheckCircle2,
	FileText,
	KeyRound,
	Network,
	Sparkles,
	Target,
	TriangleAlert,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickExperiencePanel } from "@/components/workspace/quick-experience-panel";
import type { QuickReviewResult } from "@/stores/workspace-store";

interface OverviewStep {
	label: string;
	done: boolean;
	detail: string;
}

interface OverviewNextAction {
	title: string;
	description: string;
	actionLabel: string;
	view: string;
	secondaryLabel?: string;
	secondaryView?: string;
}

interface OverviewScoreResult {
	totalScore: number;
	strongestPoint: string;
	weakestPoint: string;
	nextRevisionMove: string;
}

interface OverviewViewProps {
	nextAction: OverviewNextAction;
	providerKind: "mock" | "openai-compatible";
	providerLabel: string;
	providerModel: string;
	quickLoading: boolean;
	quickElapsedSeconds: number;
	quickReviewResult: QuickReviewResult | null;
	previousQuickReviewResult?: QuickReviewResult | null;
	quickReviewGenre: string;
	chapterText: string;
	chapterCompletion: number;
	nextChapterAction: string;
	referenceTitle: string;
	scoreResult: OverviewScoreResult | null;
	bookStatus: string;
	bookStatusText: string;
	researchReadiness: number;
	researchSourceCount: number;
	graphNodeCount: number;
	chapterProjectSteps: OverviewStep[];
	platformLabel: string;
	readingModeLabel: string;
	competitionLevelLabel: string;
	pushStageLabel: string;
	competitionNotes: string;
	bookTitle: string;
	bookCompletion: number;
	bookProgressDetail?: {
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
	};
	onChapterTextChange: (value: string) => void;
	onQuickReviewGenreChange: (value: string) => void;
	onRunQuickExperience: () => void;
	onRerunQuickExperience: () => void;
	hasQuickReviewCache: boolean;
	onUseExampleChapter: () => void;
	onOpenModel: () => void;
	onOpenCritique: () => void;
	onOpenBook: () => void;
	onOpenView: (view: string) => void;
}

function ProgressBar({ value }: { value: number }) {
	return (
		<div className="h-2 overflow-hidden rounded-full bg-secondary">
			<div
				className="h-full rounded-full bg-primary transition-all"
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	);
}

function PathCard({
	icon: Icon,
	label,
	title,
	description,
	active,
	done,
}: {
	icon: LucideIcon;
	label: string;
	title: string;
	description: string;
	active?: boolean;
	done?: boolean;
}) {
	return (
		<div
			className={`rounded-md border p-4 ${
				active
					? "border-primary/50 bg-primary/10"
					: done
						? "border-emerald-500/30 bg-emerald-500/5"
						: "border-border bg-card"
			}`}
		>
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<Icon className="size-4 text-primary" />
					{label}
				</div>
				{done ? <CheckCircle2 className="size-4 text-success-foreground" /> : null}
			</div>
			<p className="mt-3 text-lg font-semibold">{title}</p>
			<p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
		</div>
	);
}

function StepStatusList({ steps }: { steps: OverviewStep[] }) {
	return (
		<div className="grid gap-2 md:grid-cols-2">
			{steps.slice(0, 6).map((step) => (
				<div
					key={step.label}
					className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
				>
					{step.done ? (
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-foreground" />
					) : (
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
					)}
					<div className="min-w-0">
						<p className="text-sm font-medium">{step.label}</p>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							{step.detail}
						</p>
					</div>
				</div>
			))}
		</div>
	);
}

function NextActionPanel({
	action,
	providerKind,
	onOpenView,
}: {
	action: OverviewNextAction;
	providerKind: "mock" | "openai-compatible";
	onOpenView: (view: string) => void;
}) {
	return (
		<section className="rounded-md border border-primary/30 bg-primary/10 p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<Sparkles className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">下一步只做这件事</h2>
					</div>
					<p className="mt-3 text-xl font-semibold">{action.title}</p>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						{action.description}
					</p>
					{providerKind === "mock" ? (
						<p className="mt-3 rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
							当前是本地演示，只能验证流程和报告结构；真实判断需要切换到可用模型服务。
						</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					<Button onClick={() => onOpenView(action.view)}>{action.actionLabel}</Button>
					{action.secondaryLabel && action.secondaryView ? (
						<Button variant="outline" onClick={() => onOpenView(action.secondaryView!)}>
							{action.secondaryLabel}
						</Button>
					) : null}
				</div>
			</div>
		</section>
	);
}

function ScoreSummary({
	scoreResult,
	onOpenCritique,
}: {
	scoreResult: OverviewScoreResult | null;
	onOpenCritique: () => void;
}) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">高级质检结果</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{scoreResult
							? scoreResult.nextRevisionMove
							: "快速点评跑通后，再用成熟样本生成评分标准，拿到更细的证据链和改稿边界。"}
					</p>
				</div>
				<Button variant={scoreResult ? "outline" : "default"} onClick={onOpenCritique}>
					{scoreResult ? "查看评分报告" : "进入高级质检"}
				</Button>
			</div>
			{scoreResult ? (
				<div className="mt-4 grid gap-3 md:grid-cols-3">
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-xs text-muted-foreground">总分</p>
						<p className="mt-2 text-2xl font-semibold">{scoreResult.totalScore}/10</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-xs text-muted-foreground">最强项</p>
						<p className="mt-2 text-sm leading-5">{scoreResult.strongestPoint}</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-xs text-muted-foreground">最大短板</p>
						<p className="mt-2 text-sm leading-5">{scoreResult.weakestPoint}</p>
					</div>
				</div>
			) : null}
		</section>
	);
}

export function OverviewView({
	nextAction,
	providerKind,
	providerLabel,
	providerModel,
	quickLoading,
	quickElapsedSeconds,
	quickReviewResult,
	previousQuickReviewResult,
	quickReviewGenre,
	chapterText,
	chapterCompletion,
	nextChapterAction,
	referenceTitle,
	scoreResult,
	bookStatus,
	bookStatusText,
	researchReadiness,
	researchSourceCount,
	graphNodeCount,
	chapterProjectSteps,
	platformLabel,
	readingModeLabel,
	competitionLevelLabel,
	pushStageLabel,
	competitionNotes,
	bookTitle,
	bookCompletion,
	bookProgressDetail,
	onChapterTextChange,
	onQuickReviewGenreChange,
	onRunQuickExperience,
	onRerunQuickExperience,
	hasQuickReviewCache,
	onUseExampleChapter,
	onOpenModel,
	onOpenCritique,
	onOpenBook,
	onOpenView,
}: OverviewViewProps) {
	const hasQuickResult = Boolean(quickReviewResult);

	return (
		<div className="space-y-6">
			<section className="rounded-md border border-border bg-card p-5">
				<div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
					<div>
						<p className="text-sm text-primary">AI 网文作者的第一章质检台</p>
						<h2 className="mt-2 text-2xl font-semibold tracking-tight">
							先找出为什么没人追读，再决定怎么让 AI 改。
						</h2>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
							当前首页只保留最短路径：粘贴章节、跑急诊、复制改稿
							Prompt。研究库、整书拆解和导出继续保留，但不抢第一次使用的注意力。
						</p>
					</div>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
						<div className="rounded-md border border-border bg-background p-3">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<KeyRound className="size-4 text-primary" />
								当前模型
							</div>
							<p className="mt-2 font-semibold">{providerLabel}</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{providerKind === "mock"
									? "适合演示流程"
									: providerModel || "使用预设模型"}
							</p>
						</div>
						<div className="rounded-md border border-border bg-background p-3">
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<FileText className="size-4 text-primary" />
								高级质检
							</div>
							<p className="mt-2 font-semibold">{chapterCompletion}%</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								{nextChapterAction} · {referenceTitle}
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-3">
				<PathCard
					icon={Target}
					label="第一步"
					title="章节急诊"
					description="只看一章，先定位最大追读问题和可执行改法。"
					active={!hasQuickResult}
					done={hasQuickResult}
				/>
				<PathCard
					icon={FileText}
					label="第二步"
					title="高级质检"
					description="用成熟样本生成 Rubric，给出证据、评分和改稿边界。"
					active={hasQuickResult && !scoreResult}
					done={Boolean(scoreResult)}
				/>
				<PathCard
					icon={BookOpenCheck}
					label="第三步"
					title="沉淀打法"
					description="把多本样本变成赛道规律、研究库和可复用提示词。"
					active={Boolean(scoreResult)}
				/>
			</section>

			<QuickExperiencePanel
				chapterText={chapterText}
				providerLabel={providerLabel}
				loading={quickLoading}
				elapsedSeconds={quickElapsedSeconds}
				quickReviewResult={quickReviewResult}
				previousQuickReviewResult={previousQuickReviewResult}
				quickReviewGenre={quickReviewGenre}
				onChapterTextChange={onChapterTextChange}
				onQuickReviewGenreChange={onQuickReviewGenreChange}
				onRun={onRunQuickExperience}
				onRerun={onRerunQuickExperience}
				hasCachedResult={hasQuickReviewCache}
				onUseExample={onUseExampleChapter}
				onOpenModel={onOpenModel}
				onOpenCritique={onOpenCritique}
				onOpenBook={onOpenBook}
			/>

			<NextActionPanel
				action={nextAction}
				providerKind={providerKind}
				onOpenView={onOpenView}
			/>

			<details
				className="rounded-md border border-border bg-card p-5"
				open={Boolean(scoreResult)}
			>
				<summary className="flex cursor-pointer list-none items-start gap-3">
					<Network className="mt-0.5 size-5 text-primary" />
					<div className="min-w-0">
						<h2 className="text-lg font-semibold">进阶工作台</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							高级质检、整书资产、研究库和数据快照都在这里。第一次使用可以先不打开。
						</p>
					</div>
					<span className="ml-auto shrink-0 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
						高级
					</span>
				</summary>
				<div className="mt-5 space-y-6">
					<section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
						<ScoreSummary scoreResult={scoreResult} onOpenCritique={onOpenCritique} />

						<section className="rounded-md border border-border bg-background p-5">
							<div className="flex items-center gap-2">
								<Network className="size-5 text-primary" />
								<h2 className="text-lg font-semibold">高级能力放在后面</h2>
							</div>
							<div className="mt-4 space-y-4">
								<div>
									<div className="mb-2 flex items-center justify-between text-sm">
										<span className="text-muted-foreground">整书资产</span>
										<span className="font-medium">{bookCompletion}%</span>
									</div>
									<ProgressBar value={bookCompletion} />
									<p className="mt-2 text-xs leading-5 text-muted-foreground">
										{bookStatus} · {bookStatusText} · {bookTitle}
									</p>
								</div>
								{bookProgressDetail ? (
									<div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
										轻索引 {bookProgressDetail.outline.current}/
										{bookProgressDetail.outline.total} · 深拆{" "}
										{bookProgressDetail.deep.current}/
										{bookProgressDetail.deep.total}
									</div>
								) : null}
								<div>
									<div className="mb-2 flex items-center justify-between text-sm">
										<span className="text-muted-foreground">研究库就绪度</span>
										<span className="font-medium">{researchReadiness}%</span>
									</div>
									<ProgressBar value={researchReadiness} />
									<p className="mt-2 text-xs leading-5 text-muted-foreground">
										{researchSourceCount} 个资料资产 · {graphNodeCount}{" "}
										个图谱节点
									</p>
								</div>
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								<Button variant="outline" onClick={onOpenBook}>
									拆解整本书
								</Button>
								<Button variant="outline" onClick={() => onOpenView("library")}>
									打开研究库
								</Button>
							</div>
						</section>
					</section>

					<section className="rounded-md border border-border bg-background p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-lg font-semibold">高级质检进度</h2>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									{platformLabel} · {readingModeLabel} · {competitionLevelLabel} ·{" "}
									{pushStageLabel}
								</p>
								{competitionNotes ? (
									<p className="mt-1 text-sm leading-6 text-muted-foreground">
										{competitionNotes}
									</p>
								) : null}
							</div>
							<Button variant="outline" onClick={onOpenCritique}>
								{nextChapterAction}
							</Button>
						</div>
						<div className="mt-5">
							<div className="mb-2 flex items-center justify-between text-sm">
								<span className="text-muted-foreground">完成度</span>
								<span className="font-medium">{chapterCompletion}%</span>
							</div>
							<ProgressBar value={chapterCompletion} />
						</div>
						<div className="mt-5">
							<StepStatusList steps={chapterProjectSteps} />
						</div>
					</section>
				</div>
			</details>
		</div>
	);
}
