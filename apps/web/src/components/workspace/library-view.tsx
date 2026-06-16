"use client";

import type { LucideIcon } from "lucide-react";
import { BookOpenCheck, CheckCircle2, FileText, History, Loader2, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type {
	buildComparisonSamples,
	buildResearchGraph,
	buildScoreEvidenceChain,
} from "@/lib/research-library";
import { useWorkspaceStore } from "@/stores/workspace-store";

type LoadingState = string | null;
type ResearchGraph = ReturnType<typeof buildResearchGraph>;
type ScoreEvidenceChain = ReturnType<typeof buildScoreEvidenceChain>;
type ComparisonSamples = ReturnType<typeof buildComparisonSamples>;
type WorkspaceViewTarget = "book" | "chapter" | "history";

interface ResearchSource {
	name: string;
	status: string;
	detail: string;
}

interface LibraryViewProps {
	loading: LoadingState;
	researchSourceCount: number;
	graphNodeCount: number;
	graphEdgeCount: number;
	foreshadowingCount: number;
	evidenceScoreCount: number;
	comparableBookCount: number;
	researchReadiness: number;
	researchSources: ResearchSource[];
	researchGraph: ResearchGraph;
	scoreEvidenceChain: ScoreEvidenceChain;
	comparisonSamples: ComparisonSamples;
	researchPromptSeed: string;
	onLoadResearchLibrary: () => void;
	onToggleResearchSample: (jobId: string) => void;
	onRunResearchComparison: () => void;
	onAskResearchLibrary: () => void;
	onCopyText: (text: string, status: string) => void;
	onOpenView: (view: WorkspaceViewTarget) => void;
}

function ProgressBar({ value }: { value: number }) {
	return (
		<div className="h-2 overflow-hidden rounded-full bg-muted">
			<div
				className="h-full rounded-full bg-primary transition-all"
				style={{ width: Math.min(100, Math.max(0, value)) + "%" }}
			/>
		</div>
	);
}

function DashboardMetric({
	icon: Icon,
	label,
	value,
	description,
}: {
	icon: LucideIcon;
	label: string;
	value: string;
	description: string;
}) {
	return (
		<div className="rounded-md border border-border bg-card p-5">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Icon className="size-4" />
				<span className="text-sm">{label}</span>
			</div>
			<p className="mt-3 text-2xl font-semibold">{value}</p>
			<p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
		</div>
	);
}

export function LibraryView({
	loading,
	researchSourceCount,
	graphNodeCount,
	graphEdgeCount,
	foreshadowingCount,
	evidenceScoreCount,
	comparableBookCount,
	researchReadiness,
	researchSources,
	researchGraph,
	scoreEvidenceChain,
	comparisonSamples,
	researchPromptSeed,
	onLoadResearchLibrary,
	onToggleResearchSample,
	onRunResearchComparison,
	onAskResearchLibrary,
	onCopyText,
	onOpenView,
}: LibraryViewProps) {
	const {
		persistedResearchLibrary,
		selectedResearchJobIds,
		comparisonFocus,
		setComparisonFocus,
		researchComparison,
		researchQuestion,
		setResearchQuestion,
		researchQaResult,
	} = useWorkspaceStore();

	return (
		<div className="space-y-6">
			<section className="rounded-md border border-primary/30 bg-primary/10 p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<BookOpenCheck className="size-5 text-primary" />
							<h2 className="text-lg font-semibold">研究库目标</h2>
						</div>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
							这里不是通用聊天知识库，而是小说创作决策库：所有结论都要回到上传资料、章节证据和对比样本，最终服务选题、卖点重组和第一条高质量提示词（Prompt）。
						</p>
					</div>
					<div className="min-w-48">
						<div className="mb-2 flex items-center justify-between text-sm">
							<span className="text-muted-foreground">研究就绪度</span>
							<span className="font-medium">{researchReadiness}%</span>
						</div>
						<ProgressBar value={researchReadiness} />
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				<DashboardMetric
					icon={FileText}
					label="资料资产"
					value={`${researchSourceCount}`}
					description="参考章节、我的章节、整书拆解和评分报告都会成为可追溯来源。"
				/>
				<DashboardMetric
					icon={Network}
					label="图谱规模"
					value={`${graphNodeCount}/${graphEdgeCount}`}
					description="节点/关系边。整书拆解完成后会生成更完整的人物、事件和设定网络。"
				/>
				<DashboardMetric
					icon={CheckCircle2}
					label="解释证据"
					value={`${evidenceScoreCount}`}
					description="评分指标必须绑定原文章节证据，不能只给抽象评价。"
				/>
				<DashboardMetric
					icon={History}
					label="可对比书籍"
					value={`${comparableBookCount}`}
					description="横向对比至少需要 2 本已拆解样本，5-10 本更适合归纳赛道规律。"
				/>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">持久化研究库</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							这里读取本地数据库里已完成的整书拆解任务，用来沉淀长期可对比的样本池。
						</p>
					</div>
					<Button
						variant="outline"
						onClick={onLoadResearchLibrary}
						disabled={loading !== null}
					>
						{loading === "research" ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : null}
						刷新研究库
					</Button>
				</div>
				{persistedResearchLibrary ? (
					<div className="mt-5 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-semibold">样本状态</p>
							<div className="mt-3 grid gap-2 sm:grid-cols-2">
								<p>
									<span className="text-muted-foreground">完成样本：</span>
									{persistedResearchLibrary.sourceSummary.completedBooks}
								</p>
								<p>
									<span className="text-muted-foreground">全部任务：</span>
									{persistedResearchLibrary.sourceSummary.totalJobs}
								</p>
								<p>
									<span className="text-muted-foreground">运行中：</span>
									{persistedResearchLibrary.sourceSummary.runningJobs}
								</p>
								<p>
									<span className="text-muted-foreground">失败：</span>
									{persistedResearchLibrary.sourceSummary.failedJobs}
								</p>
							</div>
							<p className="mt-3 text-muted-foreground">
								对比状态：
								{persistedResearchLibrary.sourceSummary.comparisonReadiness}
							</p>
						</div>
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-semibold">已沉淀图谱资产</p>
							<div className="mt-3 grid gap-3 md:grid-cols-2">
								{persistedResearchLibrary.graphAssets.slice(0, 4).map((asset) => (
									<div
										key={asset.jobId}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">{asset.title}</p>
										<p className="mt-1 text-xs text-muted-foreground">
											{asset.genre} · {asset.nodeCount} 节点 ·{" "}
											{asset.edgeCount} 关系
										</p>
										<p className="mt-2 text-muted-foreground">
											{asset.sourceCoverage.join("、") || "暂无覆盖项"}
										</p>
									</div>
								))}
								{persistedResearchLibrary.graphAssets.length === 0 ? (
									<p className="text-muted-foreground">
										还没有已完成整书拆解样本。
									</p>
								) : null}
							</div>
						</div>
					</div>
				) : (
					<p className="mt-5 text-sm text-muted-foreground">
						进入本页会自动读取一次，也可以点击刷新研究库。
					</p>
				)}
			</section>

			<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
				<div className="rounded-md border border-border bg-card p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 className="text-lg font-semibold">选择对比样本</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								真正的横向对比只使用已完成整书拆解结果。至少选择 2
								本；同平台、同赛道样本越多，规律越可靠。
							</p>
						</div>
						<span className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground">
							已选 {selectedResearchJobIds.length} 本
						</span>
					</div>
					<div className="mt-5 space-y-3">
						{persistedResearchLibrary?.comparisonSamples.map((sample) => {
							const checked = selectedResearchJobIds.includes(sample.jobId);
							return (
								<label
									key={sample.jobId}
									className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-4 text-sm"
								>
									<input
										type="checkbox"
										checked={checked}
										onChange={() => onToggleResearchSample(sample.jobId)}
										className="mt-1 size-4"
									/>
									<span className="min-w-0 flex-1">
										<span className="block font-medium">{sample.title}</span>
										<span className="mt-1 block text-xs text-muted-foreground">
											{sample.genre} · {sample.compareUse}
										</span>
										<span className="mt-2 block leading-5 text-muted-foreground">
											{sample.coreAppeal.join("、") || "待提炼核心卖点"}
										</span>
										<span className="mt-2 block text-xs text-muted-foreground">
											可用信号：
											{sample.availableSignals.join("、") || "暂无"}
										</span>
									</span>
								</label>
							);
						})}
						{!persistedResearchLibrary?.comparisonSamples.length ? (
							<p className="text-sm text-muted-foreground">
								还没有可选样本。先完成至少 2 本整书拆解。
							</p>
						) : null}
					</div>
				</div>

				<div className="space-y-6">
					<div className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-semibold">多书横向对比</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							比较卖点组合、开局承诺、情绪策略、章末钩子和原创化边界，目标是提炼“值得写什么”。
						</p>
						<Label className="mt-5 block" htmlFor="comparison-focus">
							对比目标
						</Label>
						<textarea
							id="comparison-focus"
							value={comparisonFocus}
							onChange={(event) => setComparisonFocus(event.target.value)}
							className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
						<Button
							className="mt-4"
							onClick={onRunResearchComparison}
							disabled={loading !== null || selectedResearchJobIds.length < 2}
						>
							{loading === "compare" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							生成横向对比
						</Button>
					</div>

					<div className="rounded-md border border-border bg-card p-5">
						<h2 className="text-lg font-semibold">基于资料的问答</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							回答会限制在已拆解资料内，并返回引用证据。当前模型不可用时会给出结构化示例；模型可用时会读取资料摘录后回答。
						</p>
						<Label className="mt-5 block" htmlFor="research-question">
							研究问题
						</Label>
						<textarea
							id="research-question"
							value={researchQuestion}
							onChange={(event) => setResearchQuestion(event.target.value)}
							className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
						/>
						<div className="mt-4 flex flex-wrap gap-2">
							{persistedResearchLibrary?.questionTemplates
								.slice(0, 3)
								.map((question) => (
									<Button
										key={question}
										variant="outline"
										onClick={() => setResearchQuestion(question)}
									>
										套用问题
									</Button>
								))}
						</div>
						<Button
							className="mt-4"
							onClick={onAskResearchLibrary}
							disabled={loading !== null}
						>
							{loading === "ask" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							询问研究库
						</Button>
					</div>
				</div>
			</section>

			{researchComparison ? (
				<section className="rounded-md border border-border bg-card p-5">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
						<div>
							<h2 className="text-lg font-semibold">横向对比结果</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{researchComparison.focus} · {researchComparison.limits}
							</p>
						</div>
						<span className="rounded-md border border-border px-2 py-1 text-sm text-muted-foreground">
							{researchComparison.sampleCount} 本样本
						</span>
					</div>
					<div className="mt-5 grid gap-4 xl:grid-cols-3">
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">共同规律</p>
							<div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
								{researchComparison.commonPatterns.map((pattern) => (
									<p key={pattern}>{pattern}</p>
								))}
							</div>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">新手只记这 3 条</p>
							<div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
								{researchComparison.beginnerTakeaways.map((item) => (
									<p key={item}>{item}</p>
								))}
							</div>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">可重组差异点</p>
							<div className="mt-3 space-y-3 text-sm">
								{researchComparison.differentiationMap.map((item) => (
									<div key={item.jobId}>
										<p className="font-medium">{item.title}</p>
										<p className="mt-1 leading-5 text-muted-foreground">
											{item.uniqueSignals.join("、") || "暂无独有信号"}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>
					<div className="mt-5 grid gap-3 md:grid-cols-2">
						{researchComparison.evidenceMatrix.map((item) => (
							<div
								key={item.jobId}
								className="rounded-md border border-border bg-background p-4 text-sm"
							>
								<p className="font-medium">{item.title}</p>
								<p className="mt-2 text-muted-foreground">
									开局承诺：{item.openingPromise}
								</p>
								<p className="mt-2">卖点组合：{item.appealCombination}</p>
								<p className="mt-2 text-muted-foreground">
									情绪：{item.emotionStrategy}
								</p>
								<p className="mt-2 text-muted-foreground">
									钩子：{item.hookStrategy}
								</p>
							</div>
						))}
					</div>
					{researchComparison.promptSeed ? (
						<div className="mt-5">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">对比后生成的选题 Prompt 草稿</p>
								<Button
									variant="outline"
									onClick={() =>
										onCopyText(
											researchComparison.promptSeed || "",
											"已复制横向对比 Prompt。",
										)
									}
								>
									复制
								</Button>
							</div>
							<pre className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-background p-4 text-xs leading-5 whitespace-pre-wrap">
								{researchComparison.promptSeed}
							</pre>
						</div>
					) : null}
				</section>
			) : null}

			{researchQaResult ? (
				<section className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">资料问答结果</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						问题：{researchQaResult.question}
					</p>
					<p className="mt-4 rounded-md border border-border bg-background p-4 text-sm leading-6">
						{researchQaResult.answer}
					</p>
					<div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
						<div>
							<p className="font-semibold">关键结论</p>
							<div className="mt-3 space-y-3">
								{researchQaResult.keyFindings.map((finding) => (
									<div
										key={`${finding.claim}-${finding.promptUse}`}
										className="rounded-md border border-border bg-background p-4 text-sm"
									>
										<p>{finding.claim}</p>
										<p className="mt-2 text-muted-foreground">
											Prompt 用法：{finding.promptUse}
										</p>
										<p className="mt-2 text-xs text-muted-foreground">
											来源：{finding.sourceIds.join("、")}
										</p>
									</div>
								))}
							</div>
						</div>
						<div>
							<p className="font-semibold">引用证据</p>
							<div className="mt-3 max-h-96 space-y-3 overflow-auto">
								{researchQaResult.citations.slice(0, 8).map((citation) => (
									<div
										key={`${citation.sourceId}-${citation.field}-${citation.snippet}`}
										className="rounded-md border border-border bg-background p-4 text-sm"
									>
										<p className="font-medium">
											{citation.title} · {citation.field}
										</p>
										<p className="mt-2 leading-5 text-muted-foreground">
											{citation.snippet}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>
					{researchQaResult.sourceGaps.length ? (
						<p className="mt-4 text-sm text-muted-foreground">
							资料缺口：{researchQaResult.sourceGaps.join("；")}
						</p>
					) : null}
				</section>
			) : null}

			<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">资料源</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						后续所有图谱、评分和对比都应该能追溯到这些资料，而不是让模型凭经验泛泛判断。
					</p>
					<div className="mt-5 space-y-3">
						{researchSources.map((source) => (
							<div
								key={source.name}
								className="rounded-md border border-border bg-background p-4 text-sm"
							>
								<div className="flex items-center justify-between gap-3">
									<p className="font-medium">{source.name}</p>
									<span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
										{source.status}
									</span>
								</div>
								<p className="mt-2 leading-6 text-muted-foreground">
									{source.detail}
								</p>
							</div>
						))}
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">三件事的落点</h2>
					<div className="mt-5 space-y-4 text-sm">
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">1. 小说知识图谱</p>
							<p className="mt-2 leading-6 text-muted-foreground">
								把人物、关系、事件、冲突、设定规则、伏笔和情绪点变成带出处的节点。当前整书拆解已能提供{" "}
								{graphNodeCount} 个节点、{graphEdgeCount} 条关系、
								{foreshadowingCount} 条伏笔记录。
							</p>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">2. 可解释评分系统</p>
							<p className="mt-2 leading-6 text-muted-foreground">
								每个分数都要包含指标、证据、扣分原因、读者影响、修改动作和 Prompt
								约束。当前最近评分有 {evidenceScoreCount} 条指标证据。
							</p>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<p className="font-semibold">3. 多本书横向对比</p>
							<p className="mt-2 leading-6 text-muted-foreground">
								比较的不是全文相似度，而是卖点组合、开局承诺、情绪曲线、爽点密度、钩子方式和差异化机会。当前可对比样本数：
								{comparableBookCount}。
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="grid gap-6 xl:grid-cols-3">
				<div className="rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">图谱资产</h2>
						<span className="text-sm text-muted-foreground">{graphNodeCount} 节点</span>
					</div>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{researchGraph.summary}
					</p>
					<div className="mt-5 space-y-3">
						{researchGraph.nodes.slice(0, 6).map((node) => (
							<div key={node.id} className="border-l border-border pl-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<p className="font-medium">{node.label}</p>
									<span className="text-xs text-muted-foreground">
										{node.type}
									</span>
								</div>
								<p className="mt-1 leading-5 text-muted-foreground">
									{node.detail}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									来源：{node.source}
								</p>
							</div>
						))}
						{researchGraph.nodes.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								先完成整书拆解，研究库会自动生成可追溯图谱资产。
							</p>
						) : null}
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">评分证据链</h2>
						<span className="text-sm text-muted-foreground">
							{scoreEvidenceChain.items.length} 指标
						</span>
					</div>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{scoreEvidenceChain.summary}
					</p>
					<div className="mt-5 space-y-3">
						{scoreEvidenceChain.items.slice(0, 6).map((item) => (
							<div key={item.id} className="border-l border-border pl-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<p className="font-medium">{item.metricName}</p>
									<span className="text-xs text-muted-foreground">
										{item.score}/10 · {item.level}
									</span>
								</div>
								<p className="mt-1 text-xs text-muted-foreground">
									证据：{item.evidence}
								</p>
								<p className="mt-1 leading-5">
									Prompt 约束：{item.promptConstraint}
								</p>
							</div>
						))}
						{scoreEvidenceChain.items.length === 0 ? (
							<p className="text-sm text-muted-foreground">
								完成单章评分后，每个指标会沉淀为证据、扣分原因和 Prompt 约束。
							</p>
						) : null}
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<h2 className="text-lg font-semibold">横向对比池</h2>
						<span className="text-sm text-muted-foreground">
							{comparisonSamples.samples.length} 本
						</span>
					</div>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{comparisonSamples.summary}
					</p>
					<div className="mt-5 space-y-3">
						{comparisonSamples.samples.slice(0, 5).map((sample) => (
							<div key={sample.id} className="border-l border-border pl-3 text-sm">
								<div className="flex items-center justify-between gap-3">
									<p className="font-medium">{sample.title}</p>
									<span className="text-xs text-muted-foreground">
										{sample.status}
									</span>
								</div>
								<p className="mt-1 text-muted-foreground">{sample.genre}</p>
								<p className="mt-1 leading-5">
									{sample.coreAppeal.join("、") || "待归纳核心卖点"}
								</p>
							</div>
						))}
						{comparisonSamples.blockers.map((blocker) => (
							<p key={blocker} className="text-sm text-muted-foreground">
								{blocker}
							</p>
						))}
					</div>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">选题 Prompt 草稿</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							这不是让 AI 直接写正文，而是把图谱、证据链和样本池压缩成“问 AI
							该写什么”的第一条高质量提示词（Prompt）。
						</p>
					</div>
					<Button
						variant="outline"
						onClick={() => onCopyText(researchPromptSeed, "已复制研究库 Prompt。")}
					>
						复制 Prompt
					</Button>
				</div>
				<pre className="mt-4 max-h-80 overflow-auto rounded-md border border-border bg-background p-4 text-xs leading-5 whitespace-pre-wrap">
					{researchPromptSeed}
				</pre>
			</section>

			<section className="grid gap-6 xl:grid-cols-3">
				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">下一步补图谱</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						先从整书拆解产物生成“人物关系 + 事件链 + 伏笔表”的稳定视图，后面再做可视化。
					</p>
					<Button className="mt-4" onClick={() => onOpenView("book")}>
						导入或拆解整书
					</Button>
				</div>
				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">下一步补解释评分</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						用参考章节生成评分标准（Rubric），再让每个分数绑定原文证据和可执行改稿
						Prompt。
					</p>
					<Button className="mt-4" onClick={() => onOpenView("chapter")}>
						去单章点评
					</Button>
				</div>
				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">下一步补横向对比</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						先积累 2 本以上已拆解样本，再比较共同规律、偏离平均值的卖点和可重组方向。
					</p>
					<Button className="mt-4" onClick={() => onOpenView("history")}>
						查看样本历史
					</Button>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<h2 className="text-lg font-semibold">研究问题模板</h2>
				<p className="mt-2 text-sm leading-6 text-muted-foreground">
					后续的问答入口应该围绕这些问题，而不是开放式“帮我写小说”。
				</p>
				<div className="mt-5 grid gap-3 md:grid-cols-2">
					{[
						"这些样本的开局承诺有什么共同点，哪个点最容易被新手忽略？",
						"它们的爆点组合哪里偏离了常见平均值，哪些可以低风险重组？",
						"我的题材和样本相比，差异化卖点不足在哪里？",
						"如果我要写同赛道新书，第一条 Prompt 应该锁定哪些受众、情绪和禁区？",
					].map((question) => (
						<div
							key={question}
							className="rounded-md border border-border bg-background p-4 text-sm leading-6"
						>
							{question}
						</div>
					))}
				</div>
			</section>
		</div>
	);
}
