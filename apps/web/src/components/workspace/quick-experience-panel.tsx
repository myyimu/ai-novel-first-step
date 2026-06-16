"use client";

import { Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

export function QuickExperiencePanel({
	chapterText,
	providerLabel,
	loading,
	scoreSummary,
	revisionMove,
	onChapterTextChange,
	onRun,
	onOpenModel,
	onOpenCritique,
}: {
	chapterText: string;
	providerLabel: string;
	loading: boolean;
	scoreSummary?: string;
	revisionMove?: string;
	onChapterTextChange: (value: string) => void;
	onRun: () => void;
	onOpenModel: () => void;
	onOpenCritique: () => void;
}) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-lg font-semibold">快速体验</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						新手先不用调整复杂设置。粘贴一段章节正文，确认当前模型可用后，直接生成一份可读的质检报告。
					</p>
				</div>
				<div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
					当前 AI：{providerLabel}
				</div>
			</div>
			<div className="mt-5 grid gap-4 xl:grid-cols-[1fr_220px]">
				<div>
					<Label htmlFor="quick-chapter-text">章节正文</Label>
					<textarea
						id="quick-chapter-text"
						value={chapterText}
						onChange={(event) => onChapterTextChange(event.target.value)}
						className="mt-2 min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
						placeholder="粘贴你想质检的章节正文"
					/>
				</div>
				<div className="flex flex-col justify-between gap-3 rounded-md border border-border bg-background p-4">
					<div className="space-y-2 text-sm text-muted-foreground">
						<p>默认使用内置成熟章节作为参考。</p>
						<p>默认启用 AI 自测，先给出分数、问题和改法。</p>
						<p>需要精调时再进入单章点评。</p>
					</div>
					<div className="space-y-2">
						<Button className="w-full" onClick={onRun} disabled={loading}>
							{loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
							一键出结果
						</Button>
						<Button className="w-full" variant="outline" onClick={onOpenModel}>
							选择模型
						</Button>
					</div>
				</div>
			</div>
			{scoreSummary ? (
				<div className="mt-4 rounded-md border border-border bg-background p-4 text-sm">
					<p className="font-medium">最近结果：{scoreSummary}</p>
					{revisionMove ? (
						<p className="mt-2 leading-6 text-muted-foreground">{revisionMove}</p>
					) : null}
					<Button className="mt-3" variant="outline" onClick={onOpenCritique}>
						查看完整单章点评
					</Button>
				</div>
			) : null}
		</section>
	);
}
