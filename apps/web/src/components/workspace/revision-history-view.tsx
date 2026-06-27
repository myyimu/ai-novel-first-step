"use client";

import { Clipboard, Download, History, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { buildRevisionHistory } from "@/lib/workspace-iteration";
import type { RevisionSession } from "@/stores/workspace-store";

export function RevisionHistoryView({
	revisionSessions,
	onOpenDiagnosis,
	onSaveRevisionNote,
	onExportProject,
}: {
	revisionSessions: RevisionSession[];
	onOpenDiagnosis: () => void;
	onSaveRevisionNote: (sessionId: string, note: string) => void;
	onExportProject?: () => void;
}) {
	const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>();
	const [noteDraft, setNoteDraft] = useState("");
	const history = useMemo(
		() => buildRevisionHistory({ sessions: revisionSessions, selectedSessionId }),
		[revisionSessions, selectedSessionId],
	);
	const selected = history.selected;

	useEffect(() => {
		setNoteDraft(selected?.revisionNote || "");
	}, [selected?.id, selected?.revisionNote]);

	if (!history.sessions.length) {
		return (
			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex items-start gap-3">
					<History className="mt-0.5 size-5 text-primary" />
					<div className="min-w-0">
						<h2 className="text-lg font-semibold">复诊历史</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							当前项目还没有复诊记录。完成一次快速诊断后，这里会记录每一版的分数、Gate、问题和
							Prompt。
						</p>
						<Button className="mt-4" onClick={onOpenDiagnosis}>
							开始诊断
						</Button>
					</div>
				</div>
			</section>
		);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
			<section className="rounded-md border border-border bg-card p-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-semibold">复诊历史</h2>
						<p className="mt-1 text-xs leading-5 text-muted-foreground">
							当前项目 {history.sessions.length} 次
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button size="sm" variant="outline" onClick={onOpenDiagnosis}>
							继续复诊
						</Button>
						{onExportProject ? (
							<Button size="sm" variant="outline" onClick={onExportProject}>
								<Download className="mr-2 size-4" />
								导出项目
							</Button>
						) : null}
					</div>
				</div>
				<div className="mt-4 space-y-2">
					{history.sessions.map((session, index) => {
						const active = selected?.id === session.id;
						return (
							<button
								key={session.id}
								type="button"
								onClick={() => setSelectedSessionId(session.id)}
								className={`w-full rounded-md border p-3 text-left transition-colors ${
									active
										? "border-primary/40 bg-primary/10"
										: "border-border bg-background hover:border-primary/30"
								}`}
							>
								<div className="flex items-center justify-between gap-3">
									<p className="text-sm font-semibold">
										第 {history.sessions.length - index} 次复诊
									</p>
									<span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
										{session.quickScore}/10
									</span>
								</div>
								<p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
									{session.chapterTitle}
								</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{formatDateTime(session.createdAt)} ·{" "}
									{formatGateLabel(session.gateDecision)}
								</p>
							</button>
						);
					})}
				</div>
			</section>

			{selected ? (
				<section className="space-y-4">
					<div className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-lg font-semibold">{selected.chapterTitle}</h2>
								<p className="mt-1 text-sm leading-6 text-muted-foreground">
									{formatDateTime(selected.createdAt)} · {selected.genre} ·{" "}
									{formatInputKind(selected.inputKind)}
								</p>
							</div>
							<span className="rounded-md border border-primary/30 bg-primary/10 px-3 py-1 text-sm text-primary">
								{formatGateLabel(selected.gateDecision)}
							</span>
						</div>
						<div className="mt-5 grid gap-3 md:grid-cols-3">
							<DetailStat label="急诊分" value={`${selected.quickScore}/10`} />
							<DetailStat
								label="相对上一版"
								value={formatScoreDelta(history.scoreDelta)}
							/>
							<DetailStat label="正文长度" value={`${selected.textLength} 字`} />
						</div>
					</div>

					{history.previous ? (
						<div className="rounded-md border border-border bg-card p-5">
							<div className="flex items-center gap-2">
								<RotateCcw className="size-4 text-primary" />
								<h2 className="text-base font-semibold">与上一版对比</h2>
							</div>
							{history.comparison ? (
								<div className="mt-4 space-y-3">
									<div className="grid gap-3 md:grid-cols-3">
										<DetailStat
											label="分数变化"
											value={formatScoreDelta(history.comparison.scoreDelta)}
										/>
										<DetailStat
											label="Gate 变化"
											value={history.comparison.gateChangeLabel}
										/>
										<div
											className={`rounded-md border p-3 ${formatPromptOutcomeClass(history.comparison.promptOutcome.status)}`}
										>
											<p className="text-xs text-muted-foreground">
												Prompt 判断
											</p>
											<p className="mt-2 text-sm font-semibold">
												{history.comparison.promptOutcome.label}
											</p>
											<p className="mt-1 text-xs leading-5 text-muted-foreground">
												{history.comparison.promptOutcome.reason}
											</p>
										</div>
									</div>
									<div className="rounded-md border border-border bg-background p-3">
										<p className="text-xs text-muted-foreground">问题变化</p>
										<div className="mt-3 grid gap-3 md:grid-cols-3">
											<IssueChangeList
												label="已解决"
												items={history.comparison.resolvedIssues}
											/>
											<IssueChangeList
												label="仍重复"
												items={history.comparison.repeatedIssues}
											/>
											<IssueChangeList
												label="新出现"
												items={history.comparison.newIssues}
											/>
										</div>
									</div>
									<div className="rounded-md border border-primary/30 bg-primary/10 p-3">
										<p className="text-xs text-muted-foreground">
											下一版只做这件事
										</p>
										<p className="mt-2 text-sm leading-6">
											{history.comparison.nextAction}
										</p>
									</div>
								</div>
							) : null}
							<div className="mt-4 grid gap-3 md:grid-cols-2">
								<CompareBlock
									label="上一版问题"
									value={history.previous.mainProblem}
								/>
								<CompareBlock label="当前问题" value={selected.mainProblem} />
							</div>
						</div>
					) : null}

					<div className="rounded-md border border-border bg-card p-5">
						<h2 className="text-base font-semibold">主要问题</h2>
						<p className="mt-2 text-sm leading-6">{selected.mainProblem}</p>
						{selected.issueTitles.length ? (
							<div className="mt-4 flex flex-wrap gap-2">
								{selected.issueTitles.map((issue) => (
									<span
										key={issue}
										className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
									>
										{issue}
									</span>
								))}
							</div>
						) : null}
					</div>

					<div className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h2 className="text-base font-semibold">本版人工备注</h2>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									记录这一版实际按哪些建议改了，后续判断 Prompt
									是否有效时会更清楚。
								</p>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => onSaveRevisionNote(selected.id, noteDraft)}
							>
								保存备注
							</Button>
						</div>
						<textarea
							value={noteDraft}
							onChange={(event) => setNoteDraft(event.target.value)}
							className="mt-3 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
							placeholder="例如：这一版按 Prompt 补了章末代价，但还没有改开头目标。"
						/>
						{selected.revisionNote ? (
							<div className="mt-3 rounded-md border border-border bg-background p-3">
								<p className="text-xs font-medium text-muted-foreground">
									已保存备注
								</p>
								<p className="mt-1 text-sm leading-6">{selected.revisionNote}</p>
							</div>
						) : null}
						{selected.revisionNoteUpdatedAt ? (
							<p className="mt-2 text-xs text-muted-foreground">
								上次保存：{formatDateTime(selected.revisionNoteUpdatedAt)}
							</p>
						) : null}
					</div>

					{selected.nextPrompt ? (
						<div className="rounded-md border border-border bg-card p-5">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<h2 className="text-base font-semibold">当时生成的下一轮 Prompt</h2>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => {
										void navigator.clipboard?.writeText(
											selected.nextPrompt || "",
										);
									}}
								>
									<Clipboard className="mr-2 size-4" />
									复制
								</Button>
							</div>
							<textarea
								readOnly
								className="mt-3 min-h-40 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-xs leading-5 text-muted-foreground outline-none"
								value={selected.nextPrompt}
							/>
						</div>
					) : null}
				</section>
			) : null}
		</div>
	);
}

function IssueChangeList({ label, items }: { label: string; items: string[] }) {
	return (
		<div>
			<p className="text-xs font-medium">{label}</p>
			{items.length ? (
				<ul className="mt-2 space-y-1 text-sm leading-5 text-muted-foreground">
					{items.slice(0, 3).map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-sm text-muted-foreground">暂无</p>
			)}
		</div>
	);
}

function DetailStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-border bg-background p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-2 text-lg font-semibold">{value}</p>
		</div>
	);
}

function CompareBlock({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-border bg-background p-3">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-2 text-sm leading-6">{value}</p>
		</div>
	);
}

function formatScoreDelta(value: number | null) {
	if (value === null) return "暂无上一版";
	if (value === 0) return "持平";
	return value > 0 ? `+${value}` : `${value}`;
}

function formatPromptOutcomeClass(status: string) {
	const map: Record<string, string> = {
		effective: "border-success-border bg-success-surface",
		partial: "border-primary/30 bg-primary/10",
		ineffective: "border-warning-border bg-warning-surface",
		unknown: "border-border bg-background",
	};

	return map[status] || map.unknown;
}

function formatGateLabel(gate: string | undefined) {
	const map: Record<string, string> = {
		continue: "继续",
		revise: "修改",
		rebuild: "重构",
		discard: "废稿",
	};
	return map[gate || ""] || "修改";
}

function formatInputKind(value: string) {
	const map: Record<string, string> = {
		"human-draft": "作者正文",
		"ai-draft": "AI 生成稿",
		idea: "脑洞",
		outline: "大纲",
		prompt: "Prompt 草稿",
	};
	return map[value] || "作者正文";
}

function formatDateTime(value: string) {
	const time = new Date(value);
	if (Number.isNaN(time.getTime())) {
		return "时间未知";
	}

	return time.toLocaleString("zh-CN", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}
