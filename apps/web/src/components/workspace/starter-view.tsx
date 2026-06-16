"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeginnerLearningDigest {
	summary: string;
	rules: Array<{
		title: string;
		explanation: string;
		source: string;
		apply: string;
	}>;
}

interface StarterViewProps {
	digest: BeginnerLearningDigest;
	onOpenView: (view: string) => void;
}

export function StarterView({ digest, onOpenView }: StarterViewProps) {
	return (
		<div className="space-y-6">
			<section className="rounded-md border border-primary/30 bg-primary/10 p-5">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<Sparkles className="size-5 text-primary" />
							<h2 className="text-lg font-semibold">先别写，先看懂爆款</h2>
						</div>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
							AI 时代，新手最容易卡在“我让 AI 写什么”。这里把一本成熟样本压缩成 3
							条能记住、能复用、能验证的规律，避免一上来就被几十页报告淹没。
						</p>
					</div>
					<div className="flex shrink-0 flex-wrap gap-2">
						<Button onClick={() => onOpenView("book")}>上传样本</Button>
						<Button variant="outline" onClick={() => onOpenView("library")}>
							看研究库
						</Button>
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-3">
				<div className="rounded-md border border-border bg-card p-5">
					<p className="text-sm text-muted-foreground">传统写作瓶颈</p>
					<p className="mt-3 text-xl font-semibold">不会写</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						灵感、大纲、写作能力、成稿，过去多数人死在写作能力。
					</p>
				</div>
				<div className="rounded-md border border-border bg-card p-5">
					<p className="text-sm text-muted-foreground">AI 写作瓶颈</p>
					<p className="mt-3 text-xl font-semibold">不知道写什么</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						所有人都能生产文字后，差距来自选题、卖点、情绪和受众判断。
					</p>
				</div>
				<div className="rounded-md border border-border bg-card p-5">
					<p className="text-sm text-muted-foreground">First Step</p>
					<p className="mt-3 text-xl font-semibold">看懂爆款</p>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						先学会拆出爆款为什么成立，再让 AI 执行明确方向。
					</p>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="text-lg font-semibold">这本书先记住 3 条规律</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							{digest.summary}
						</p>
					</div>
					<Button variant="outline" onClick={() => onOpenView("book")}>
						换一本样本
					</Button>
				</div>
				<div className="mt-5 grid gap-4 lg:grid-cols-3">
					{digest.rules.map((rule, index) => (
						<div
							key={`${rule.title}-${index}`}
							className="rounded-md border border-border bg-background p-4"
						>
							<div className="flex items-center gap-2">
								<span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
									{index + 1}
								</span>
								<p className="font-semibold">{rule.title}</p>
							</div>
							<p className="mt-3 text-sm leading-6 text-muted-foreground">
								{rule.explanation}
							</p>
							<p className="mt-3 text-xs text-muted-foreground">
								来源：{rule.source}
							</p>
							<p className="mt-3 text-sm leading-6">怎么用：{rule.apply}</p>
						</div>
					))}
				</div>
			</section>

			<section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">建议学习路线</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						下面是样本类型，不要求照抄具体作品。请上传你有权分析的文本，目标是学规律，不是复制内容。
					</p>
					<div className="mt-5 space-y-3 text-sm">
						{[
							["第一本", "悬念/世界观型", "学习如何持续制造未知和身份跃迁"],
							["第二本", "人设反差型", "学习人物记忆点、关系钩子和稳定声线"],
							["第三本", "情绪压迫型", "学习不安全感、认知冲击和情绪连续性"],
						].map(([step, type, goal]) => (
							<div
								key={step}
								className="rounded-md border border-border bg-background p-4"
							>
								<p className="font-medium">
									{step}：{type}
								</p>
								<p className="mt-2 text-muted-foreground">{goal}</p>
							</div>
						))}
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<h2 className="text-lg font-semibold">新手模式输出原则</h2>
					<div className="mt-5 space-y-3 text-sm">
						{[
							"先问“为什么火”，再问“怎么写”。",
							"每本书只保留 3 条关键规律，避免信息过载。",
							"每条规律必须能变成第一条提示词（Prompt）里的约束。",
							"评分只作为验证，不作为第一入口。",
						].map((item) => (
							<div
								key={item}
								className="rounded-md border border-border bg-background px-3 py-2"
							>
								{item}
							</div>
						))}
					</div>
					<div className="mt-5 flex flex-wrap gap-2">
						<Button onClick={() => onOpenView("book")}>拆一本样本</Button>
						<Button variant="outline" onClick={() => onOpenView("chapter")}>
							用章节验证
						</Button>
					</div>
				</div>
			</section>
		</div>
	);
}
