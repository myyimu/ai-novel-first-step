"use client";

import { CheckCircle2, Clipboard, Loader2, Target } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import type { QuickReviewResult } from "@/stores/workspace-store";

export function QuickExperiencePanel({
	chapterText,
	providerLabel,
	loading,
	elapsedSeconds,
	quickReviewResult,
	previousQuickReviewResult,
	quickReviewGenre,
	onChapterTextChange,
	onQuickReviewGenreChange,
	onRun,
	onRerun,
	hasCachedResult,
	onUseExample,
	onOpenModel,
	onOpenCritique,
	onOpenBook,
}: {
	chapterText: string;
	providerLabel: string;
	loading: boolean;
	elapsedSeconds: number;
	quickReviewResult: QuickReviewResult | null;
	previousQuickReviewResult?: QuickReviewResult | null;
	quickReviewGenre: string;
	onChapterTextChange: (value: string) => void;
	onQuickReviewGenreChange: (value: string) => void;
	onRun: () => void;
	onRerun: () => void;
	hasCachedResult: boolean;
	onUseExample: () => void;
	onOpenModel: () => void;
	onOpenCritique: () => void;
	onOpenBook: () => void;
}) {
	const sellingPoints = Array.isArray(quickReviewResult?.sellingPoints)
		? quickReviewResult.sellingPoints.filter(Boolean)
		: [];
	const actionableFixes = Array.isArray(quickReviewResult?.actionableFixes)
		? quickReviewResult.actionableFixes.filter(Boolean)
		: [];
	const recommendedPlatforms = Array.isArray(quickReviewResult?.recommendedPlatforms)
		? quickReviewResult.recommendedPlatforms.filter(
				(platform) => platform && platform.label && platform.reason,
			)
		: [];
	const quickScore =
		typeof quickReviewResult?.quickScore === "number"
			? `${quickReviewResult.quickScore}/10`
			: "待确认";
	const confidence =
		typeof quickReviewResult?.confidence === "number"
			? Math.round(quickReviewResult.confidence * 100)
			: null;
	const activeProgress = getQuickReviewProgress(elapsedSeconds);
	const rewritePrompt = buildRewritePrompt(quickReviewResult);
	const sharpDiagnosis = buildSharpDiagnosis(quickReviewResult);
	const reviewComparison = buildReviewComparison(previousQuickReviewResult, quickReviewResult);

	return (
		<section className="rounded-md border border-primary/30 bg-card p-5">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
				<div className="max-w-3xl">
					<div className="flex items-center gap-2">
						<Target className="size-5 text-primary" />
						<h2 className="text-xl font-semibold">30 秒章节急诊</h2>
					</div>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						先别填复杂表单。粘贴一章正文，先找出最大追读问题、当前卖点和三条可执行改法。
					</p>
				</div>
				<div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
					当前 AI: {providerLabel}
				</div>
			</div>
			<div className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px]">
				<div>
					<Label htmlFor="quick-chapter-text">把你最想救的一章粘贴到这里</Label>
					<textarea
						id="quick-chapter-text"
						value={chapterText}
						onChange={(event) => onChapterTextChange(event.target.value)}
						className="mt-2 min-h-48 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
						placeholder="至少 50 字。推荐粘贴第一章或最近卡住的一章。"
					/>
					<details className="mt-4 rounded-md border border-border bg-background p-3">
						<summary className="cursor-pointer list-none text-sm font-medium">
							可选：指定题材
							<span className="ml-2 text-xs font-normal text-muted-foreground">
								不懂就保持自动判断
							</span>
						</summary>
						<div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-end">
							<div className="space-y-2">
								<Label htmlFor="quick-review-genre">题材</Label>
								<select
									id="quick-review-genre"
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									value={quickReviewGenre}
									onChange={(event) =>
										onQuickReviewGenreChange(event.target.value)
									}
								>
									<option value="">自动判断</option>
									<option value="xuanhuan">玄幻</option>
									<option value="urban">都市</option>
									<option value="romance">言情</option>
									<option value="suspense">悬疑</option>
									<option value="infinite-flow">无限流</option>
									<option value="other">其他</option>
								</select>
							</div>
							<p className="text-xs leading-5 text-muted-foreground">
								指定题材只会帮助模型少走弯路，不会改变你这一章的核心诊断。
							</p>
						</div>
					</details>
				</div>
				<div className="flex flex-col justify-between gap-3 rounded-md border border-border bg-background p-4">
					<div className="space-y-2 text-sm text-muted-foreground">
						<p className="font-medium text-foreground">这一步只回答一个问题：</p>
						<p>为什么这一章可能没人追读？</p>
						<p>跑完后直接拿到改稿 Prompt。</p>
						{hasCachedResult ? <p>当前文本命中过往结果，默认优先复用缓存。</p> : null}
					</div>
					<div className="space-y-2">
						<Button className="w-full" onClick={onRun} disabled={loading}>
							{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
							找最大追读问题
						</Button>
						{hasCachedResult ? (
							<Button
								className="w-full"
								variant="outline"
								onClick={onRerun}
								disabled={loading}
							>
								重新分析
							</Button>
						) : null}
						<Button
							className="w-full"
							variant="outline"
							onClick={onUseExample}
							disabled={loading}
						>
							填入示例章节
						</Button>
						<Button className="w-full" variant="outline" onClick={onOpenModel}>
							选择模型
						</Button>
					</div>
				</div>
			</div>
			{loading ? (
				<div className="mt-5 rounded-md border border-border bg-background p-4">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm font-medium">{activeProgress.label}</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								已等待 {elapsedSeconds} 秒。返回后会自动显示结果。
							</p>
						</div>
						<span className="text-xs text-muted-foreground">
							{activeProgress.percent}%
						</span>
					</div>
					<div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
						<div
							className="h-full rounded-full bg-primary transition-all"
							style={{ width: `${activeProgress.percent}%` }}
						/>
					</div>
					<ol className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
						{quickReviewProgressSteps.map((step) => (
							<li
								key={step.label}
								className={
									elapsedSeconds >= step.startsAt
										? "text-foreground"
										: "text-muted-foreground"
								}
							>
								{step.label}
							</li>
						))}
					</ol>
				</div>
			) : null}
			{quickReviewResult ? (
				<div className="mt-5 space-y-4 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-5">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="size-5 text-success-foreground" />
						<h3 className="text-base font-semibold">章节急诊结果：{quickScore}</h3>
						<span className="ml-auto rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
							{quickReviewResult.genre || "类型待确认"} ·{" "}
							{confidence === null ? "置信度待确认" : `置信度 ${confidence}%`}
						</span>
					</div>
					<p className="text-sm leading-6">
						<span className="font-medium">定位：</span>
						{quickReviewResult.positioning ||
							"模型没有返回明确定位，请重试或进入完整点评。"}
					</p>
					<div>
						<p className="text-sm font-medium">现在还能打的卖点</p>
						<ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
							{sellingPoints.length ? (
								sellingPoints.map((point, index) => <li key={index}>{point}</li>)
							) : (
								<li>模型没有返回明确卖点，请重试或进入完整点评。</li>
							)}
						</ul>
					</div>
					<div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
						<p className="text-sm font-medium text-warning-foreground">最大追读问题</p>
						<p className="mt-1 text-sm leading-6">
							{quickReviewResult.mainProblem ||
								"模型没有返回明确问题，请重试或进入完整点评。"}
						</p>
					</div>
					<div className="rounded-md border border-primary/30 bg-primary/10 p-4">
						<p className="text-sm font-medium">产品诊断</p>
						<p className="mt-2 text-base font-semibold leading-6">{sharpDiagnosis}</p>
					</div>
					<div>
						<p className="text-sm font-medium">立刻改这三处</p>
						<ol className="mt-1 list-inside list-decimal space-y-1 text-sm leading-6 text-muted-foreground">
							{actionableFixes.length ? (
								actionableFixes.map((fix, index) => <li key={index}>{fix}</li>)
							) : (
								<li>模型没有返回具体改法，请重试或进入完整点评。</li>
							)}
						</ol>
					</div>
					<div className="rounded-md border border-border bg-background p-4">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-sm font-medium">可复制给写作 AI 的改稿 Prompt</p>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => {
									void navigator.clipboard?.writeText(rewritePrompt);
								}}
							>
								<Clipboard className="mr-2 size-4" />
								复制
							</Button>
						</div>
						<textarea
							readOnly
							className="mt-3 min-h-32 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-xs leading-5 text-muted-foreground outline-none"
							value={rewritePrompt}
						/>
					</div>
					{reviewComparison ? (
						<div className="rounded-md border border-border bg-background p-4">
							<p className="text-sm font-medium">改稿后复诊对比</p>
							<div className="mt-3 grid gap-3 md:grid-cols-3">
								<div className="rounded-md border border-border bg-card p-3">
									<p className="text-xs text-muted-foreground">急诊分</p>
									<p className="mt-2 text-lg font-semibold">
										{reviewComparison.previousScore}
										{" -> "}
										{reviewComparison.currentScore}
									</p>
									<p
										className={`mt-1 text-xs ${
											reviewComparison.delta >= 0
												? "text-success-foreground"
												: "text-warning-foreground"
										}`}
									>
										{reviewComparison.deltaLabel}
									</p>
								</div>
								<div className="rounded-md border border-border bg-card p-3">
									<p className="text-xs text-muted-foreground">问题变化</p>
									<p className="mt-2 text-sm leading-5">
										{reviewComparison.problemShift}
									</p>
								</div>
								<div className="rounded-md border border-border bg-card p-3">
									<p className="text-xs text-muted-foreground">下一步</p>
									<p className="mt-2 text-sm leading-5">
										{reviewComparison.nextStep}
									</p>
								</div>
							</div>
						</div>
					) : null}
					<details className="rounded-md border border-border bg-background p-4">
						<summary className="cursor-pointer list-none text-sm font-medium">
							进阶判断：平台和深度质检
							<span className="ml-2 text-xs font-normal text-muted-foreground">
								急诊跑通后再看
							</span>
						</summary>
						<div className="mt-4">
							<p className="text-sm font-medium">推荐发布平台</p>
							<div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
								{recommendedPlatforms.length ? (
									recommendedPlatforms.map((platform) => (
										<div
											key={`${platform.id}-${platform.label}`}
											className="rounded-md border border-border bg-card p-3"
										>
											<div className="flex items-center justify-between gap-2">
												<p className="text-sm font-semibold">
													{platform.label}
												</p>
												<span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
													{platform.fit}
												</span>
											</div>
											<p className="mt-2 text-sm leading-6 text-muted-foreground">
												{platform.reason}
											</p>
										</div>
									))
								) : (
									<div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
										模型还没给出平台建议，建议先补充更完整的章节内容后重试。
									</div>
								)}
							</div>
							<div className="mt-4 flex flex-wrap gap-2">
								<Button onClick={onOpenCritique}>打开高级质检</Button>
								<Button variant="outline" onClick={onOpenBook}>
									拆解整本书
								</Button>
							</div>
						</div>
					</details>
					<p className="text-xs leading-5 text-muted-foreground">
						{quickReviewResult.readyReason ||
							"如果结果不完整，建议重试一次或进入完整评分。"}
					</p>
				</div>
			) : null}
		</section>
	);
}

function buildSharpDiagnosis(result: QuickReviewResult | null) {
	if (!result) {
		return "";
	}

	const problem = result.mainProblem?.trim();
	const firstFix = Array.isArray(result.actionableFixes)
		? result.actionableFixes.find(Boolean)
		: "";

	if (!problem) {
		return "这章最大流失点：读者还没有看到足够明确的追读理由。";
	}

	return `这章最大流失点：${problem}${firstFix ? `。先改：${firstFix}` : "。"}`;
}

function buildReviewComparison(
	previous: QuickReviewResult | null | undefined,
	current: QuickReviewResult | null,
) {
	if (!previous || !current) {
		return null;
	}

	const previousScore =
		typeof previous.quickScore === "number" ? previous.quickScore : Number.NaN;
	const currentScore = typeof current.quickScore === "number" ? current.quickScore : Number.NaN;

	if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) {
		return null;
	}

	const delta = Number((currentScore - previousScore).toFixed(1));
	const deltaLabel = delta === 0 ? "暂无明显变化" : delta > 0 ? `+${delta}` : `${delta}`;
	const problemShift =
		previous.mainProblem && current.mainProblem && previous.mainProblem !== current.mainProblem
			? `从“${previous.mainProblem}”变为“${current.mainProblem}”。`
			: current.mainProblem
				? `主要问题仍是“${current.mainProblem}”。`
				: "模型没有返回明确问题变化。";
	const nextStep =
		delta >= 1
			? "改法有效，可以进入高级质检找证据链。"
			: delta >= 0
				? "方向可能有效，但还要继续补强目标、代价或章末钩子。"
				: "这版改稿可能削弱了追读动机，建议回到最大流失点重新改。";

	return {
		previousScore,
		currentScore,
		delta,
		deltaLabel,
		problemShift,
		nextStep,
	};
}

function buildRewritePrompt(result: QuickReviewResult | null) {
	if (!result) {
		return "";
	}

	const fixes = Array.isArray(result.actionableFixes)
		? result.actionableFixes.filter(Boolean)
		: [];
	const sellingPoints = Array.isArray(result.sellingPoints)
		? result.sellingPoints.filter(Boolean)
		: [];

	return [
		"请帮我改写这一章，但不要另起炉灶。",
		`当前定位：${result.positioning || "请先根据正文判断定位"}`,
		`保留卖点：${sellingPoints.length ? sellingPoints.join("；") : "保留已有冲突、人物关系和主线信息"}`,
		`优先解决：${result.mainProblem || "追读动机不足"}`,
		`具体改法：${fixes.length ? fixes.join("；") : "补强目标、代价和章末钩子"}`,
		"改写边界：保留人物、场景、已发生事件和核心设定；不要只润色句子；不要新增无关设定。",
		"输出格式：1. 改写策略 2. 需要改的段落 3. 改写正文 4. 为什么这样改。",
	].join("\n");
}

const quickReviewProgressSteps = [
	{ startsAt: 0, label: "读取章节开头和结尾" },
	{ startsAt: 4, label: "判断题材与主线冲突" },
	{ startsAt: 8, label: "提取卖点和最大问题" },
	{ startsAt: 12, label: "整理改稿建议" },
	{ startsAt: 20, label: "等待模型返回" },
];

function getQuickReviewProgress(elapsedSeconds: number) {
	const activeStep =
		quickReviewProgressSteps.findLast((step) => elapsedSeconds >= step.startsAt) ??
		quickReviewProgressSteps[0];
	const percent = Math.min(92, Math.max(8, 8 + elapsedSeconds * 3));

	return {
		label: activeStep.label,
		percent,
	};
}
