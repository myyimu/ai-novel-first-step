"use client";

import {
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
					<h2 className="text-lg font-semibold">深度质检结果</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{scoreResult
							? scoreResult.nextRevisionMove
							: "改稿急诊跑通后，再用成熟样本生成评分标准，拿到更细的证据链和改稿边界。"}
					</p>
				</div>
				<Button variant={scoreResult ? "outline" : "default"} onClick={onOpenCritique}>
					{scoreResult ? "查看评分报告" : "进入深度质检"}
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
	referenceTitle: _referenceTitle,
	scoreResult,
	bookStatus,
	bookStatusText,
	researchReadiness: _researchReadiness,
	researchSourceCount: _researchSourceCount,
	graphNodeCount: _graphNodeCount,
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
						<p className="text-sm text-primary">AI网文诊断台</p>
						<h2 className="mt-2 text-2xl font-semibold tracking-tight">
							别急着重写，先找出小说为什么没人追。
						</h2>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
							这不是一键写小说。先粘贴第一章，系统按“问题 → 正文证据 → 读者反应 →
							修改优先级 → 改稿 Prompt”的链路诊断，改完再贴回来复诊。
						</p>
					</div>
					<div className="grid gap-3">
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
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-3">
				<PathCard
					icon={Target}
					label="第一步"
					title="找病因"
					description="只看一章，先定位读者为什么不想继续。"
					active={!hasQuickResult}
					done={hasQuickResult}
				/>
				<PathCard
					icon={FileText}
					label="第二步"
					title="拿证据链"
					description="把结论绑定正文证据、读者反应和修改优先级。"
					active={hasQuickResult}
					done={hasQuickResult}
				/>
				<PathCard
					icon={CheckCircle2}
					label="第三步"
					title="改稿复诊"
					description="贴回改后版本，看最大问题有没有真的变化。"
					active={Boolean(previousQuickReviewResult && quickReviewResult)}
					done={Boolean(previousQuickReviewResult && quickReviewResult)}
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
						<h2 className="text-lg font-semibold">进阶能力</h2>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							深度质检、整书拆解、样本研究和数据快照都在这里。第一次使用可以先不打开。
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
								<h2 className="text-lg font-semibold">不是第一次使用入口</h2>
							</div>
							<div className="mt-4 space-y-4">
								<div>
									<div className="mb-2 flex items-center justify-between text-sm">
										<span className="text-muted-foreground">整书拆解</span>
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
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								<Button variant="outline" onClick={onOpenBook}>
									整书拆解
								</Button>
							</div>
						</section>
					</section>

					<section className="rounded-md border border-border bg-background p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-lg font-semibold">深度质检进度</h2>
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
