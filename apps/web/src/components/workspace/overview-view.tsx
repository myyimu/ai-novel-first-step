"use client";

import { useState, type ReactNode } from "react";
import {
	CheckCircle2,
	ChevronDown,
	FileText,
	KeyRound,
	Network,
	Target,
	TriangleAlert,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickExperiencePanel } from "@/components/workspace/quick-experience-panel";
import type { DiagnosisExampleOption } from "@/lib/diagnosis-examples";
import type {
	ProjectMethodologyCard,
	QuickReviewInputKind,
	QuickReviewResult,
	RevisionSession,
} from "@/stores/workspace-store";

interface OverviewStep {
	label: string;
	done: boolean;
	detail: string;
}

interface OverviewScoreResult {
	totalScore: number;
	strongestPoint: string;
	weakestPoint: string;
	nextRevisionMove: string;
}

interface OverviewViewProps {
	providerKind: "mock" | "openai-compatible";
	providerLabel: string;
	providerModel: string;
	quickLoading: boolean;
	quickElapsedSeconds: number;
	quickReviewResult: QuickReviewResult | null;
	quickReviewError?: string | null;
	previousQuickReviewResult?: QuickReviewResult | null;
	quickReviewGenre: string;
	quickReviewInputKind: QuickReviewInputKind;
	quickReviewPreviousPrompt: string;
	revisionSessions: RevisionSession[];
	methodologyCards: ProjectMethodologyCard[];
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
	onQuickReviewInputKindChange: (value: QuickReviewInputKind) => void;
	onQuickReviewPreviousPromptChange: (value: string) => void;
	onRunQuickExperience: () => void;
	onRerunQuickExperience: () => void;
	hasQuickReviewCache: boolean;
	diagnosisExamples: DiagnosisExampleOption[];
	onUseExampleChapter: (exampleId: string) => void;
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

function Collapsible({
	title,
	hint,
	rightSlot,
	defaultOpen = false,
	children,
}: {
	title: ReactNode;
	hint?: ReactNode;
	rightSlot?: ReactNode;
	defaultOpen?: boolean;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<section className="rounded-md border border-border bg-card">
			<button
				type="button"
				onClick={() => setOpen((value) => !value)}
				aria-expanded={open}
				className="flex w-full items-start gap-3 p-5 text-left"
			>
				<ChevronDown
					className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
						open ? "rotate-0" : "-rotate-90"
					}`}
				/>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-medium">{title}</div>
					{hint ? (
						<div className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</div>
					) : null}
				</div>
				{rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
			</button>
			{open ? (
				<div className="border-t border-border px-5 pb-5 pt-4">{children}</div>
			) : null}
		</section>
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
						? "border-success-border bg-success-surface"
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
						<TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
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
	providerKind,
	providerLabel,
	providerModel,
	quickLoading,
	quickElapsedSeconds,
	quickReviewResult,
	quickReviewError,
	previousQuickReviewResult,
	quickReviewGenre,
	quickReviewInputKind,
	quickReviewPreviousPrompt,
	revisionSessions,
	methodologyCards,
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
	onQuickReviewInputKindChange,
	onQuickReviewPreviousPromptChange,
	onRunQuickExperience,
	onRerunQuickExperience,
	hasQuickReviewCache,
	diagnosisExamples,
	onUseExampleChapter,
	onOpenModel,
	onOpenCritique,
	onOpenBook,
	onOpenView: _onOpenView,
}: OverviewViewProps) {
	const hasQuickResult = Boolean(quickReviewResult);

	return (
		<div className="space-y-6">
			<section className="rounded-md border border-border bg-card px-4 py-3">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="min-w-0">
						<p className="text-sm text-primary">AI网文诊断台</p>
						<h2 className="mt-1 text-xl font-semibold tracking-tight">
							先找出小说为什么没人追。
						</h2>
						<p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
							粘贴第一章，拿到问题、正文证据、读者反应和下一版改稿 Prompt。
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
						<KeyRound className="size-4 text-primary" />
						<div>
							<p className="font-medium">{providerLabel}</p>
							<p className="text-xs text-muted-foreground">
								{providerKind === "mock"
									? "本地演示"
									: providerModel || "使用预设模型"}
							</p>
						</div>
					</div>
				</div>
				{providerKind === "mock" ? (
					<p className="mt-3 rounded-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
						当前是本地演示模式，只能验证流程和报告结构；真实判断请到 AI
						设置切换可用模型。
						<button
							type="button"
							onClick={onOpenModel}
							className="ml-2 underline underline-offset-2 hover:opacity-80"
						>
							去切换
						</button>
					</p>
				) : null}
			</section>

			<QuickExperiencePanel
				chapterText={chapterText}
				providerLabel={providerLabel}
				loading={quickLoading}
				elapsedSeconds={quickElapsedSeconds}
				quickReviewResult={quickReviewResult}
				quickReviewError={quickReviewError ?? null}
				previousQuickReviewResult={previousQuickReviewResult}
				quickReviewGenre={quickReviewGenre}
				quickReviewInputKind={quickReviewInputKind}
				quickReviewPreviousPrompt={quickReviewPreviousPrompt}
				revisionSessions={revisionSessions}
				methodologyCards={methodologyCards}
				onChapterTextChange={onChapterTextChange}
				onQuickReviewGenreChange={onQuickReviewGenreChange}
				onQuickReviewInputKindChange={onQuickReviewInputKindChange}
				onQuickReviewPreviousPromptChange={onQuickReviewPreviousPromptChange}
				onRun={onRunQuickExperience}
				onRerun={onRerunQuickExperience}
				hasCachedResult={hasQuickReviewCache}
				diagnosisExamples={diagnosisExamples}
				onUseExample={onUseExampleChapter}
				onOpenModel={onOpenModel}
				onOpenCritique={onOpenCritique}
				onOpenBook={onOpenBook}
			/>

			<Collapsible title="诊断闭环（三步）" hint="需要理解流程时再展开看。">
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
			</Collapsible>

			<Collapsible
				title={
					<span className="flex items-center gap-2">
						<Network className="size-4 text-primary" />
						进阶能力
					</span>
				}
				hint="深度质检、整书拆解、样本研究和数据快照。第一次使用可以先不打开。"
				rightSlot={
					<span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
						高级
					</span>
				}
				defaultOpen={Boolean(scoreResult)}
			>
				<div className="space-y-6">
					<section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
						<ScoreSummary scoreResult={scoreResult} onOpenCritique={onOpenCritique} />

						<section className="rounded-md border border-border bg-background p-5">
							<div className="flex items-center gap-2">
								<Network className="size-5 text-primary" />
								<h2 className="text-lg font-semibold">整书拆解入口</h2>
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
			</Collapsible>
		</div>
	);
}
