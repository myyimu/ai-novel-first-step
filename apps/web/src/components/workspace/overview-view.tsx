"use client";

import {
	BookOpenCheck,
	CheckCircle2,
	FileText,
	KeyRound,
	Network,
	Sparkles,
	TriangleAlert,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickExperiencePanel } from "@/components/workspace/quick-experience-panel";

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
	providerKind: "mock" | "openai-compatible" | "ai-horde";
	providerLabel: string;
	providerModel: string;
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
	chapterText: string;
	quickLoading: boolean;
	onChapterTextChange: (value: string) => void;
	onRunQuickExperience: () => void;
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

function DashboardMetric({
	label,
	value,
	description,
	icon: Icon,
}: {
	label: string;
	value: string;
	description: string;
	icon: LucideIcon;
}) {
	return (
		<div className="rounded-md border border-border bg-card p-4">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<Icon className="size-4 text-primary" />
				{label}
			</div>
			<p className="mt-3 text-2xl font-semibold">{value}</p>
			<p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
		</div>
	);
}

function StepStatusList({ steps }: { steps: OverviewStep[] }) {
	return (
		<div className="space-y-2">
			{steps.map((step) => (
				<div
					key={step.label}
					className="flex items-start gap-3 rounded-md border border-border bg-background px-3 py-2"
				>
					{step.done ? (
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
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
	providerKind: "mock" | "openai-compatible" | "ai-horde";
	onOpenView: (view: string) => void;
}) {
	return (
		<section className="rounded-md border border-primary/30 bg-primary/10 p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<Sparkles className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">下一步建议</h2>
					</div>
					<p className="mt-3 text-xl font-semibold">{action.title}</p>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						{action.description}
					</p>
					{providerKind === "mock" ? (
						<p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
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

export function OverviewView({
	nextAction,
	providerKind,
	providerLabel,
	providerModel,
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
	chapterText,
	quickLoading,
	onChapterTextChange,
	onRunQuickExperience,
	onOpenView,
}: OverviewViewProps) {
	return (
		<div className="space-y-6">
			<NextActionPanel
				action={nextAction}
				providerKind={providerKind}
				onOpenView={onOpenView}
			/>
			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
				<DashboardMetric
					icon={Sparkles}
					label="第一步"
					value="看懂爆款"
					description="新手先学会判断什么叫好网文，再决定让 AI 写什么。"
				/>
				<DashboardMetric
					icon={KeyRound}
					label="模型状态"
					value={providerLabel}
					description={
						providerKind === "mock"
							? "当前适合验证流程；真实评分需要切换到可用模型服务。"
							: providerModel || "未指定模型"
					}
				/>
				<DashboardMetric
					icon={FileText}
					label="单章流程"
					value={`${chapterCompletion}%`}
					description={`${nextChapterAction} · ${referenceTitle}`}
				/>
				<DashboardMetric
					icon={CheckCircle2}
					label="最近评分"
					value={scoreResult ? `${scoreResult.totalScore}/10` : "未评分"}
					description={
						scoreResult
							? scoreResult.nextRevisionMove
							: "生成评分标准（Rubric）后可开始章节质检。"
					}
				/>
				<DashboardMetric
					icon={Network}
					label="整书拆解"
					value={bookStatus}
					description={bookStatusText}
				/>
				<DashboardMetric
					icon={BookOpenCheck}
					label="研究库"
					value={`${researchReadiness}%`}
					description={`${researchSourceCount} 个资料资产 · ${graphNodeCount} 个图谱节点`}
				/>
			</section>

			<QuickExperiencePanel
				chapterText={chapterText}
				providerLabel={providerLabel}
				loading={quickLoading}
				scoreSummary={scoreResult ? `${scoreResult.totalScore}/10` : undefined}
				revisionMove={scoreResult?.nextRevisionMove}
				onChapterTextChange={onChapterTextChange}
				onRun={onRunQuickExperience}
				onOpenModel={() => onOpenView("provider")}
				onOpenCritique={() => onOpenView("chapter")}
			/>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">新手入口</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							如果你是“听说 AI
							能写网文赚钱，但不知道网文怎么运作”，先别急着评分，先看懂一本爆款为什么成立。
						</p>
					</div>
					<Button onClick={() => onOpenView("starter")}>进入新手模式</Button>
				</div>
			</section>

			<section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
				<div className="rounded-md border border-border bg-card p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h2 className="text-lg font-semibold">单章项目进度</h2>
							<p className="mt-1 text-sm text-muted-foreground">
								从参考章节到评分报告的当前完成情况。
							</p>
						</div>
						<Button onClick={() => onOpenView("chapter")}>{nextChapterAction}</Button>
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
				</div>

				<div className="space-y-6">
					<section className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-semibold">平台策略画像</h2>
						<div className="mt-4 space-y-3 text-sm">
							<p>
								<span className="text-muted-foreground">平台：</span>
								{platformLabel}
							</p>
							<p>
								<span className="text-muted-foreground">阅读场景：</span>
								{readingModeLabel}
							</p>
							<p>
								<span className="text-muted-foreground">赛道：</span>
								{competitionLevelLabel}
							</p>
							<p>
								<span className="text-muted-foreground">推流：</span>
								{pushStageLabel}
							</p>
							<p className="leading-6 text-muted-foreground">
								{competitionNotes || "暂无竞争备注。"}
							</p>
						</div>
						<Button
							className="mt-4"
							variant="outline"
							onClick={() => onOpenView("chapter")}
						>
							调整策略画像
						</Button>
					</section>

					<section className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-semibold">整书任务状态</h2>
						<div className="mt-4">
							<div className="mb-2 flex items-center justify-between text-sm">
								<span className="text-muted-foreground">{bookTitle}</span>
								<span className="font-medium">{bookCompletion}%</span>
							</div>
							<ProgressBar value={bookCompletion} />
						</div>
						<p className="mt-3 text-sm leading-6 text-muted-foreground">
							{bookStatusText}
						</p>
						<div className="mt-4 flex flex-wrap gap-2">
							<Button variant="outline" onClick={() => onOpenView("book")}>
								打开整书拆解
							</Button>
							<Button variant="outline" onClick={() => onOpenView("history")}>
								查看历史任务
							</Button>
						</div>
					</section>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">最近评分摘要</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							{scoreResult
								? scoreResult.weakestPoint
								: "还没有评分报告。完成评分标准（Rubric）后，工作台会显示总分、最大短板和下一步改法。"}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button onClick={() => onOpenView("chapter")}>继续单章点评</Button>
						<Button variant="outline" onClick={() => onOpenView("provider")}>
							AI 设置
						</Button>
					</div>
				</div>
				{scoreResult ? (
					<div className="mt-4 grid gap-3 md:grid-cols-3">
						<div className="rounded-md border border-border bg-background p-3">
							<p className="text-xs text-muted-foreground">最强项</p>
							<p className="mt-2 text-sm leading-5">{scoreResult.strongestPoint}</p>
						</div>
						<div className="rounded-md border border-border bg-background p-3">
							<p className="text-xs text-muted-foreground">最大短板</p>
							<p className="mt-2 text-sm leading-5">{scoreResult.weakestPoint}</p>
						</div>
						<div className="rounded-md border border-border bg-background p-3">
							<p className="text-xs text-muted-foreground">下一步</p>
							<p className="mt-2 text-sm leading-5">{scoreResult.nextRevisionMove}</p>
						</div>
					</div>
				) : null}
			</section>
		</div>
	);
}
