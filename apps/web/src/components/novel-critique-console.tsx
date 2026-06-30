"use client";

import { useState } from "react";
import {
	BookOpenCheck,
	CheckCircle2,
	FileText,
	KeyRound,
	Loader2,
	Network,
	ShieldAlert,
	Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChapterCritiqueView } from "@/components/workspace/chapter-critique-view";
import { DiagnosisDashboardView } from "@/components/workspace/diagnosis-dashboard-view";
import { BookAnalysisPanel, ExportView } from "@/components/workspace/export-view";
import { LibraryView } from "@/components/workspace/library-view";
import { MethodologyLibraryView } from "@/components/workspace/methodology-library-view";
import { OverviewView } from "@/components/workspace/overview-view";
import { RevisionHistoryView } from "@/components/workspace/revision-history-view";
import { StarterView } from "@/components/workspace/starter-view";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { providerPresetOptions, providerPresets } from "@/lib/provider-presets";
import { useWorkspaceHandlers, type LoadingState } from "@/hooks/use-workspace-handlers";
import {
	getBookJobProgressDetail,
	competitionLevelOptions,
	pushStageOptions,
} from "@/lib/workspace-utils";
import { type WorkspaceView } from "@/lib/workspace-routes";
import {
	type BookAnalysisJob,
	type BookUploadPreview,
	type ProviderPresetId,
} from "@/stores/workspace-store";

/* ──────────── inline sub-components (pure render, no state) ──────────── */

function FieldHelp({ text }: { text: string }) {
	const [open, setOpen] = useState(false);

	return (
		<span className="relative ml-1 inline-flex align-middle">
			<button
				type="button"
				className="inline-flex size-4 items-center justify-center rounded-full border border-border bg-background text-[10px] leading-none text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="查看说明"
				aria-expanded={open}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setOpen((current) => !current);
				}}
				onBlur={() => window.setTimeout(() => setOpen(false), 120)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						setOpen(false);
					}
				}}
			>
				?
			</button>
			{open ? (
				<span
					role="tooltip"
					data-field-help-panel="true"
					className="absolute right-0 top-6 z-50 w-64 rounded-md border border-border bg-popover p-3 text-left text-xs font-normal leading-5 text-popover-foreground shadow-lg sm:top-1/2 sm:left-6 sm:right-auto sm:-translate-y-1/2"
				>
					{text}
				</span>
			) : null}
		</span>
	);
}

function WorkflowGuide({ steps, note }: { steps: string[]; note: string }) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-wrap gap-2">
				{steps.map((step, index) => (
					<div
						key={step}
						className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm"
					>
						<span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
							{index + 1}
						</span>
						{step}
					</div>
				))}
			</div>
			<p className="mt-4 text-sm leading-6 text-muted-foreground">{note}</p>
		</section>
	);
}

function ProjectScopePanel({
	projects,
	activeProjectId,
	activeProjectName,
	newProjectName,
	revisionCount,
	methodologyCount,
	onProjectChange,
	onNewProjectNameChange,
	onCreateProject,
}: {
	projects: Array<{ id: string; name: string }>;
	activeProjectId: string;
	activeProjectName: string;
	newProjectName: string;
	revisionCount: number;
	methodologyCount: number;
	onProjectChange: (projectId: string) => void;
	onNewProjectNameChange: (value: string) => void;
	onCreateProject: () => void;
}) {
	return (
		<section className="rounded-md border border-border bg-card p-4">
			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:items-end">
				<div>
					<p className="text-sm font-medium">当前项目：{activeProjectName}</p>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						复诊记录和方法论卡会按项目隔离，避免多本书互相污染。
					</p>
					<div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
						<span className="rounded-md border border-border px-2 py-1">
							{revisionCount} 次复诊
						</span>
						<span className="rounded-md border border-border px-2 py-1">
							{methodologyCount} 张方法论卡
						</span>
					</div>
				</div>
				<div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
					<select
						value={activeProjectId}
						onChange={(event) => onProjectChange(event.target.value)}
						className="h-10 rounded-md border border-input bg-background px-3 text-sm"
						aria-label="选择项目"
					>
						{projects.map((project) => (
							<option key={project.id} value={project.id}>
								{project.name}
							</option>
						))}
					</select>
					<Input
						value={newProjectName}
						onChange={(event) => onNewProjectNameChange(event.target.value)}
						placeholder="新项目名称"
					/>
					<Button type="button" onClick={onCreateProject}>
						新建
					</Button>
				</div>
			</div>
		</section>
	);
}

function BookHistoryPanel({
	jobs,
	uploads,
	loading,
	onLoadHistory,
	onOpenJob,
	onDeleteJob,
}: {
	jobs: BookAnalysisJob[];
	uploads: BookUploadPreview[];
	loading: string | null;
	onLoadHistory: () => void;
	onOpenJob: (jobId: string) => void;
	onDeleteJob: (jobId: string) => void;
}) {
	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<BookOpenCheck className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">
						历史任务
						<FieldHelp text="历史记录来自本地数据库。已完成任务可以重新打开结果，不需要重新跑模型。" />
					</h2>
				</div>
				<Button variant="outline" onClick={onLoadHistory} disabled={loading !== null}>
					{loading === "history" ? (
						<Loader2 className="mr-2 size-4 animate-spin" />
					) : null}
					刷新历史
				</Button>
			</div>
			<div className="mt-5 grid gap-4 xl:grid-cols-2">
				<div className="rounded-md border border-border bg-background p-4">
					<p className="font-medium">最近任务</p>
					<div className="mt-3 max-h-72 overflow-auto space-y-2 text-sm">
						{jobs.length ? (
							jobs.map((job) => {
								const canDelete =
									job.status === "succeeded" || job.status === "failed";
								return (
									<div
										key={job.id}
										className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2"
									>
										<button
											type="button"
											onClick={() => onOpenJob(job.id)}
											className="min-w-0 flex-1 text-left hover:text-primary"
										>
											<div className="flex items-center justify-between gap-3">
												<span className="truncate font-medium">
													{job.inputSummary.title}
												</span>
												<span className="shrink-0">{job.status}</span>
											</div>
											<p className="mt-1 truncate text-xs text-muted-foreground">
												{job.id}
											</p>
										</button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
											onClick={() => onDeleteJob(job.id)}
											disabled={loading !== null || !canDelete}
											title={
												canDelete
													? "删除这条历史任务"
													: "运行中的任务暂不能删除"
											}
											aria-label={`删除历史任务 ${job.inputSummary.title}`}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
								);
							})
						) : (
							<p className="text-muted-foreground">暂无历史任务。</p>
						)}
					</div>
				</div>
				<div className="rounded-md border border-border bg-background p-4">
					<p className="font-medium">最近上传</p>
					<div className="mt-3 max-h-72 overflow-auto space-y-2 text-sm">
						{uploads.length ? (
							uploads.map((upload) => (
								<div
									key={upload.id}
									className="rounded-md border border-border bg-card px-3 py-2"
								>
									<div className="flex items-center justify-between gap-3">
										<span className="font-medium">{upload.title}</span>
										<span>{upload.chapterCount} 章</span>
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{upload.originalFilename}
									</p>
								</div>
							))
						) : (
							<p className="text-muted-foreground">暂无上传记录。</p>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}

function BookUploadPreviewPanel({ upload }: { upload: BookUploadPreview | null }) {
	if (!upload) {
		return null;
	}

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<FileText className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">
							TXT 上传与章节预览
							<FieldHelp text="章节预览用于检查标题识别和自动分块是否合理。长文本拆解质量很依赖这一步。" />
						</h2>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{upload.id}</p>
				</div>
				<span className="rounded-md border border-border px-3 py-1 text-sm">
					{upload.chapterCount} 个章节片段
				</span>
			</div>
			<div className="mt-5 grid gap-3 text-sm sm:grid-cols-4">
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">文件名</p>
					<p className="mt-1 truncate font-medium">{upload.originalFilename}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">原始字符</p>
					<p className="mt-1 text-lg font-semibold">{upload.rawLength}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">清洗后字符</p>
					<p className="mt-1 text-lg font-semibold">{upload.cleanedLength}</p>
				</div>
				<div className="rounded-md border border-border bg-background p-3">
					<p className="text-muted-foreground">段落</p>
					<p className="mt-1 text-lg font-semibold">
						{upload.preprocessing.cleaning.paragraphCount}
					</p>
				</div>
			</div>
			<div className="mt-4 max-h-72 overflow-auto rounded-md border border-border bg-background text-sm">
				{upload.preprocessing.chapters.map((chapter) => (
					<div
						key={chapter.id}
						className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
					>
						<span>
							{chapter.order}. {chapter.title}
						</span>
						<span className="text-xs text-muted-foreground">
							{chapter.charCount} 字符 · {chapter.splitBy}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}

function BookJobPanel({
	job,
	loading,
	onResume,
}: {
	job: BookAnalysisJob | null;
	loading: LoadingState;
	onResume: () => void;
}) {
	if (!job) {
		return null;
	}

	const percent =
		job.progress.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;
	const progressDetail = getBookJobProgressDetail(job);
	const canResume = job.status === "failed" && Boolean(job.partialResult);
	const resumeOutlineChunk = job.partialResult
		? Math.min(
				(job.partialResult.outlineCount ?? job.partialResult.mapCount) + 1,
				job.partialResult.totalChapters,
			)
		: 1;

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Network className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">整书拆解任务</h2>
					</div>
					<p className="mt-2 text-xs text-muted-foreground">{job.id}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{canResume ? (
						<Button variant="outline" onClick={onResume} disabled={loading !== null}>
							{loading === "book" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							继续拆解
						</Button>
					) : null}
					<span className="rounded-md border border-border px-3 py-1 text-sm">
						{job.status}
					</span>
				</div>
			</div>
			<div className="mt-5">
				<div className="h-2 overflow-hidden rounded-full bg-secondary">
					<div
						className="h-full bg-primary transition-all"
						style={{ width: `${Math.min(100, percent)}%` }}
					/>
				</div>
				<p className="mt-3 text-sm text-muted-foreground">{job.progress.message}</p>
			</div>
			{progressDetail ? (
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="rounded-md border border-border bg-background p-4">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">轻索引</span>
							<span className="font-medium">
								{progressDetail.outline.current}/{progressDetail.outline.total}
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-secondary">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${progressDetail.outline.percent}%` }}
							/>
						</div>
					</div>
					<div className="rounded-md border border-border bg-background p-4">
						<div className="mb-2 flex items-center justify-between text-xs">
							<span className="text-muted-foreground">深拆重点片段</span>
							<span className="font-medium">
								{progressDetail.deep.current}/{progressDetail.deep.total}
							</span>
						</div>
						<div className="h-2 overflow-hidden rounded-full bg-secondary">
							<div
								className="h-full rounded-full bg-primary transition-all"
								style={{ width: `${progressDetail.deep.percent}%` }}
							/>
						</div>
					</div>
					{progressDetail.strategy ? (
						<p className="md:col-span-2 text-xs leading-5 text-muted-foreground">
							{progressDetail.strategy}
						</p>
					) : null}
				</div>
			) : null}
			{job.preprocessing ? (
				<div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">清洗后字符</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.cleaning.cleanedLength}
						</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">段落数</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.cleaning.paragraphCount}
						</p>
					</div>
					<div className="rounded-md border border-border bg-background p-3">
						<p className="text-muted-foreground">章节片段</p>
						<p className="mt-1 text-lg font-semibold">
							{job.preprocessing.chapters.length}
						</p>
					</div>
				</div>
			) : null}
			{job.partialResult ? (
				<div className="mt-4 rounded-md border border-success-border bg-success-surface p-4 text-sm text-success-foreground">
					<div className="flex items-center gap-2">
						<CheckCircle2 className="size-4 text-success-foreground" />
						<p className="font-semibold">已保存中间拆解结果</p>
					</div>
					<div className="mt-3 grid gap-3 md:grid-cols-3">
						<p>
							<span className="text-muted-foreground">轻索引：</span>
							{job.partialResult.outlineCount ?? job.partialResult.mapCount}/
							{job.partialResult.totalChapters}
						</p>
						<p>
							<span className="text-muted-foreground">保存时间：</span>
							{new Date(job.partialResult.savedAt).toLocaleString()}
						</p>
						<p className="break-all">
							<span className="text-muted-foreground">本地目录：</span>
							{job.partialResult.artifactDir}
						</p>
					</div>
					{job.partialResult.deepTargetOrders?.length ? (
						<p className="mt-2 text-xs leading-5 text-muted-foreground">
							深拆重点片段 {job.partialResult.deepCompletedCount ?? 0}/
							{job.partialResult.deepTargetOrders.length}
						</p>
					) : null}
					<p className="mt-3 text-xs leading-5 text-muted-foreground">
						{job.partialResult.notice}
					</p>
					{canResume ? (
						<p className="mt-2 text-xs leading-5 text-foreground">
							将从已保存状态继续。当前轻索引已完成{" "}
							{job.partialResult.outlineCount ?? job.partialResult.mapCount}/
							{job.partialResult.totalChapters}
							，下一段从第 {resumeOutlineChunk} 个片段附近恢复。
						</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}

/* ──────────── main component ──────────── */

export function NovelCritiqueConsole({ view = "overview" }: { view?: WorkspaceView }) {
	const h = useWorkspaceHandlers(view);

	return (
		<WorkspaceShell
			activeView={h.activeView}
			activeMeta={h.activeMeta}
			navItems={h.navItems}
			advancedNavItems={h.advancedNavItems}
			status={h.status}
			loading={h.loading !== null}
			onOpenView={h.openView}
		>
			<ProjectScopePanel
				projects={h.projects}
				activeProjectId={h.activeProjectId}
				activeProjectName={h.activeProject?.name || "默认项目"}
				newProjectName={h.newProjectName}
				revisionCount={h.projectRevisionSessions.length}
				methodologyCount={h.projectMethodologyCards.length}
				onProjectChange={h.switchProject}
				onNewProjectNameChange={h.setNewProjectName}
				onCreateProject={h.createProject}
			/>

			{h.activeView === "overview" ? (
				<OverviewView
					providerKind={h.provider.kind}
					providerLabel={h.providerLabel}
					providerModel={h.provider.model}
					quickLoading={h.loading === "quick"}
					quickElapsedSeconds={h.quickReviewElapsedSeconds}
					quickReviewResult={h.quickReviewResult}
					quickReviewError={h.quickReviewError}
					previousQuickReviewResult={h.previousQuickReviewResult}
					quickReviewGenre={h.quickReviewGenre}
					quickReviewInputKind={h.quickReviewInputKind}
					quickReviewPreviousPrompt={h.quickReviewPreviousPrompt}
					revisionSessions={h.projectRevisionSessions}
					methodologyCards={h.projectMethodologyCards}
					chapterText={h.chapterText}
					chapterCompletion={h.chapterCompletion}
					nextChapterAction={h.nextChapterAction}
					referenceTitle={h.referenceTitle || "未导入参考章节"}
					scoreResult={h.scoreResult}
					bookStatus={h.bookJob?.status ?? (h.bookUpload ? "已预览" : "未启动")}
					bookStatusText={h.bookStatusText}
					researchReadiness={h.researchReadiness}
					researchSourceCount={h.researchSourceCount}
					graphNodeCount={h.graphNodeCount}
					chapterProjectSteps={h.chapterProjectSteps}
					platformLabel={h.platformLabel}
					readingModeLabel={h.readingModeLabel}
					competitionLevelLabel={h.optionLabel(
						competitionLevelOptions,
						h.competitionLevel,
					)}
					pushStageLabel={h.optionLabel(pushStageOptions, h.pushStage)}
					competitionNotes={h.competitionNotes}
					bookTitle={h.bookUpload?.title || h.bookTitle || "未填写书名"}
					bookCompletion={h.bookCompletion}
					bookProgressDetail={h.bookProgressDetail ?? undefined}
					onChapterTextChange={h.handleChapterTextChange}
					onQuickReviewGenreChange={h.setQuickReviewGenre}
					onQuickReviewInputKindChange={h.setQuickReviewInputKind}
					onQuickReviewPreviousPromptChange={h.setQuickReviewPreviousPrompt}
					onRunQuickExperience={h.runQuickExperience}
					onRerunQuickExperience={() => h.runQuickExperience(true)}
					hasQuickReviewCache={Boolean(h.quickReviewCacheHit)}
					diagnosisExamples={h.diagnosisExampleOptions}
					onUseExampleChapter={h.useExampleChapter}
					onOpenModel={() => h.openView("provider")}
					onOpenCritique={() => h.openView("chapter")}
					onOpenBook={() => h.openView("book")}
					onOpenView={(view) => h.openView(view as WorkspaceView)}
				/>
			) : null}

			{h.activeView === "starter" ? (
				<StarterView
					digest={h.beginnerLearningDigest}
					onOpenView={(view) => h.openView(view as WorkspaceView)}
				/>
			) : null}

			{h.activeView === "dashboard" ? (
				<DiagnosisDashboardView
					revisionSessions={h.projectRevisionSessions}
					methodologyCards={h.projectMethodologyCards}
					onOpenDiagnosis={() => h.openView("overview")}
				/>
			) : null}

			{h.activeView === "methodology" ? (
				<MethodologyLibraryView
					methodologyCards={h.projectMethodologyCards}
					onOpenDiagnosis={() => h.openView("overview")}
					onExportProject={h.exportProjectMarkdown}
				/>
			) : null}

			{h.activeView === "revisions" ? (
				<RevisionHistoryView
					revisionSessions={h.projectRevisionSessions}
					onOpenDiagnosis={() => h.openView("overview")}
					onSaveRevisionNote={h.saveRevisionNote}
					onExportProject={h.exportProjectMarkdown}
				/>
			) : null}

			{h.activeView === "library" ? (
				<LibraryView
					loading={h.loading}
					researchSourceCount={h.researchSourceCount}
					graphNodeCount={h.graphNodeCount}
					graphEdgeCount={h.graphEdgeCount}
					foreshadowingCount={h.foreshadowingCount}
					evidenceScoreCount={h.evidenceScoreCount}
					comparableBookCount={h.comparableBookCount}
					researchReadiness={h.researchReadiness}
					researchSources={h.researchSources}
					researchGraph={h.researchGraph}
					scoreEvidenceChain={h.scoreEvidenceChain}
					comparisonSamples={h.comparisonSamples}
					researchPromptSeed={h.researchPromptSeed}
					onLoadResearchLibrary={h.loadResearchLibrary}
					onToggleResearchSample={h.toggleResearchSample}
					onRunResearchComparison={h.runResearchComparison}
					onAskResearchLibrary={h.askResearchLibrary}
					onCopyText={h.handleCopyText}
					onOpenView={h.openView}
				/>
			) : null}

			{h.activeView === "provider" ? (
				<section className="rounded-md border border-border bg-card p-5">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<KeyRound className="size-5 text-primary" />
							<h2 className="text-lg font-semibold">
								1. AI 设置
								<FieldHelp text="这里决定由哪个模型服务来分析小说。共享站由服务端统一配置；选择付费或本地模型时会使用你填写的 Base URL、Model 和 API Key。" />
							</h2>
						</div>
						<Button onClick={h.testProvider} disabled={h.loading !== null}>
							{h.loading === "provider" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							测试连接
						</Button>
					</div>
					<p className="mt-3 text-sm leading-6 text-muted-foreground">
						先测试当前模型服务是否可用。这里的设置会保存到本机浏览器，下次打开继续使用；API
						Key 不会上传到后端保存。
					</p>
					<div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
						<span>当前模型服务：{providerPresets[h.provider.preset].label}</span>
						<span>{h.provider.model || "未指定模型"}</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={h.resetProviderSettings}
						>
							恢复默认
						</Button>
					</div>
					{h.selectedProviderPreset.notice ? (
						<div className="mt-4 rounded-md border border-warning-border bg-warning-surface p-4 text-sm leading-6 text-warning-foreground">
							<div className="flex items-start gap-2">
								<ShieldAlert className="mt-0.5 size-4 shrink-0" />
								<p>{h.selectedProviderPreset.notice}</p>
							</div>
						</div>
					) : null}

					<div className="mt-5 grid gap-4 md:grid-cols-3">
						<div className="space-y-2">
							<Label htmlFor="provider-preset">模型服务</Label>
							<select
								id="provider-preset"
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={h.provider.preset}
								onChange={(event) =>
									h.applyProviderPreset(event.target.value as ProviderPresetId)
								}
							>
								{providerPresetOptions.map(({ id, preset }) => (
									<option key={id} value={id}>
										{preset.label}
									</option>
								))}
							</select>
						</div>
						{h.provider.kind === "mock" ? (
							<div className="md:col-span-2 min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
								<p className="font-medium text-foreground">
									本地演示不需要模型参数
								</p>
								<p>
									测试连接会直接通过；诊断结果使用内置演示逻辑，不代表真实模型判断。
								</p>
							</div>
						) : (
							<>
								<div className="space-y-2">
									<div className="flex items-center gap-1">
										<Label htmlFor="provider-model">模型（Model）</Label>
										<FieldHelp text="不同模型擅长的内容、速度和稳定性不同。共享站的模型由服务端配置；付费模型会使用这里选择或填写的 Model。" />
									</div>
									<div className="flex gap-2">
										<Input
											id="provider-model"
											list="provider-model-options"
											value={h.provider.model}
											onChange={(event) => {
												h.setProvider((current) => ({
													...current,
													model: event.target.value,
												}));
												h.setProviderModelSearch(event.target.value);
											}}
											placeholder={
												h.isBackendFreeProvider
													? "由共享站服务端配置决定"
													: "输入或搜索模型，例如 qwen-plus-latest"
											}
											disabled={h.provider.preset === "shared-gpu"}
										/>
										{!h.isBackendFreeProvider ? (
											<Button
												type="button"
												variant="outline"
												onClick={h.loadProviderModelOptions}
												disabled={h.providerModelsLoading}
											>
												{h.providerModelsLoading ? (
													<Loader2 className="mr-2 size-4 animate-spin" />
												) : null}
												拉取模型
											</Button>
										) : null}
									</div>
									<datalist id="provider-model-options">
										{h.filteredProviderModelOptions.map((model) => (
											<option key={model} value={model} />
										))}
									</datalist>
									{h.providerModelOptions.length ? (
										<p className="text-xs text-muted-foreground">
											可选模型 {h.providerModelOptions.length}{" "}
											个；可直接输入搜索或手动填写其他 Model。
										</p>
									) : (
										<p className="text-xs text-muted-foreground">
											可先拉取模型列表；若厂商不支持 /models，也可以手动填写
											Model。
										</p>
									)}
								</div>
								<div className="space-y-2">
									<Label htmlFor="provider-base-url">Base URL（高级）</Label>
									{h.providerBaseUrlOptions.length ? (
										<select
											id="provider-base-url-option"
											aria-label="选择推荐 Base URL"
											className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
											value={h.selectedBaseUrlOption}
											onChange={(event) => {
												if (event.target.value === "__custom__") {
													return;
												}
												h.setProvider((current) => ({
													...current,
													baseUrl: event.target.value,
												}));
												h.setProviderModelSearch("");
											}}
											disabled={h.provider.preset === "shared-gpu"}
										>
											{h.providerBaseUrlOptions.map((option) => (
												<option key={option.url} value={option.url}>
													{option.label}
												</option>
											))}
											<option value="__custom__">
												手动填写其他 Base URL
											</option>
										</select>
									) : null}
									<Input
										id="provider-base-url"
										value={h.provider.baseUrl}
										onChange={(event) =>
											h.setProvider((current) => ({
												...current,
												baseUrl: event.target.value,
											}))
										}
										placeholder={
											h.isBackendFreeProvider
												? "由共享站服务端配置提供"
												: "例如 https://dashscope.aliyuncs.com/compatible-mode/v1"
										}
										disabled={h.provider.preset === "shared-gpu"}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="provider-api-key">API Key（高级）</Label>
									{h.isBackendFreeProvider ? (
										<div className="min-h-10 rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
											<p className="font-medium text-foreground">无需填写</p>
											<p>
												共享站由服务器统一连接。你只需要测试是否可用；如果不可用，可以切换到付费模型并填写自己的
												API Key。
											</p>
										</div>
									) : (
										<Input
											id="provider-api-key"
											type="password"
											value={h.provider.apiKey}
											onChange={(event) =>
												h.setProvider((current) => ({
													...current,
													apiKey: event.target.value,
												}))
											}
											placeholder={
												providerPresets[h.provider.preset].needsApiKey
													? "填写你的模型服务 API Key，只保存在本机浏览器"
													: "本地模型可留空"
											}
										/>
									)}
								</div>
							</>
						)}
					</div>
					<div className="mt-6 border-t border-border pt-5">
						<div className="flex items-center justify-between gap-3">
							<div>
								<h3 className="text-sm font-semibold">AI 设置历史</h3>
								<p className="mt-1 text-xs text-muted-foreground">
									只保存测试成功的最近 10 条配置。
								</p>
							</div>
							{h.providerConfigHistory.length ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={h.clearProviderConfigHistory}
								>
									清空
								</Button>
							) : null}
						</div>
						{h.providerConfigHistory.length ? (
							<div className="mt-3 divide-y divide-border rounded-md border border-border">
								{h.providerConfigHistory.map((item) => (
									<div
										key={item.id}
										className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-medium">
												{item.title}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												{new Date(item.createdAt).toLocaleString()}
											</p>
										</div>
										<div className="flex shrink-0 gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() =>
													h.applyProviderConfigHistory(item.id)
												}
											>
												复用
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() =>
													h.deleteProviderConfigHistory(item.id)
												}
											>
												<Trash2 className="mr-2 size-4" />
												删除
											</Button>
										</div>
									</div>
								))}
							</div>
						) : (
							<p className="mt-3 rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
								暂无成功测试过的 AI 设置。
							</p>
						)}
					</div>
				</section>
			) : null}

			{h.activeView === "chapter" ? (
				<ChapterCritiqueView
					loading={h.loading}
					providerLabel={h.providerLabel}
					quickLoading={h.loading === "quick"}
					quickElapsedSeconds={h.quickReviewElapsedSeconds}
					quickReviewResult={h.quickReviewResult}
					previousQuickReviewResult={h.previousQuickReviewResult}
					quickReviewGenre={h.quickReviewGenre}
					quickReviewInputKind={h.quickReviewInputKind}
					quickReviewPreviousPrompt={h.quickReviewPreviousPrompt}
					revisionSessions={h.projectRevisionSessions}
					methodologyCards={h.projectMethodologyCards}
					importReferenceFile={h.importReferenceFile}
					onInferReferenceProfile={h.inferReferenceProfileFromModel}
					onReferenceTextChange={h.handleReferenceTextChange}
					onQuickReviewGenreChange={h.setQuickReviewGenre}
					onQuickReviewInputKindChange={h.setQuickReviewInputKind}
					onQuickReviewPreviousPromptChange={h.setQuickReviewPreviousPrompt}
					onRunQuickExperience={h.runQuickExperience}
					onRerunQuickExperience={() => h.runQuickExperience(true)}
					hasQuickReviewCache={Boolean(h.quickReviewCacheHit)}
					diagnosisExamples={h.diagnosisExampleOptions}
					onUseExampleChapter={h.useExampleChapter}
					onUseExampleReference={h.useExampleReference}
					onOpenModel={() => h.openView("provider")}
					onOpenBook={() => h.openView("book")}
					onBuildRubric={h.buildRubric}
					onRebuildRubric={() => h.buildRubric(true)}
					onScoreChapter={h.scoreChapter}
					onRescoreChapter={() => h.scoreChapter(true)}
					hasRubricCache={Boolean(h.rubricCacheHit)}
					hasScoreCache={Boolean(h.scoreCacheHit)}
					onPlatformStrategyChange={h.handlePlatformStrategyChange}
					onChapterDraftChange={h.handleChapterDraftChange}
				/>
			) : null}

			{h.activeView === "book" ? (
				<>
					<WorkflowGuide
						steps={[
							"上传或粘贴 TXT",
							"预览章节切分",
							"启动整书拆解任务",
							"查看人物、世界观和时间线",
							"去导出资产下载素材",
						]}
						note="整书文本通常太长，不能一次分析完。这里会先切成章节，再逐章分析，最后汇总成整书资料。"
					/>
					<section className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="flex items-center gap-2">
								<Network className="size-5 text-primary" />
								<h2 className="text-lg font-semibold">
									整书 TXT 拆解
									<FieldHelp text="先上传并预览章节，确认切分合理后再启动整书拆解，避免错章影响人物和时间线。" />
								</h2>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={h.useExampleBook}
									disabled={h.loading !== null}
								>
									填入示例整书
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										void h.uploadBookForPreview().catch(() => undefined)
									}
									disabled={h.loading !== null}
								>
									{h.loading === "upload" ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									上传并预览章节
								</Button>
								<Button
									onClick={() => void h.analyzeBook()}
									disabled={h.loading !== null}
								>
									{h.loading === "book" ? (
										<Loader2 className="mr-2 size-4 animate-spin" />
									) : null}
									启动整书拆解
								</Button>
								{h.bookAnalysisCacheHit ? (
									<Button
										variant="outline"
										onClick={() => h.analyzeBook(true)}
										disabled={h.loading !== null}
									>
										重新拆解
									</Button>
								) : null}
							</div>
						</div>
						<div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px]">
							<div className="space-y-2">
								<Label htmlFor="book-title">书名</Label>
								<Input
									id="book-title"
									value={h.bookTitle}
									onChange={(event) => h.setBookTitle(event.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="book-genre">题材</Label>
								<select
									id="book-genre"
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									value={h.bookGenre}
									onChange={(event) => h.setBookGenre(event.target.value)}
								>
									<option value="xuanhuan">玄幻</option>
									<option value="urban">都市</option>
									<option value="romance">言情</option>
									<option value="suspense">悬疑</option>
									<option value="infinite-flow">无限流</option>
									<option value="other">其他</option>
								</select>
							</div>
						</div>
						<div className="mt-4 space-y-2">
							<Label htmlFor="book-file">上传 TXT</Label>
							<Input
								id="book-file"
								type="file"
								accept=".txt,text/plain"
								onChange={(event) => h.readBookFile(event.target.files?.[0])}
							/>
						</div>
						{h.bookFileTooLargeForInlinePreview ? (
							<div className="mt-4 rounded-md border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
								<div>已选择文件：{h.bookFile?.name}</div>
								<div>
									文件大小：{h.bookFile ? h.formatFileSize(h.bookFile.size) : "-"}
								</div>
								<div>当前模式：直接上传并拆解，不在浏览器中展开全文。</div>
							</div>
						) : (
							<textarea
								id="book-text"
								aria-label="整书文本"
								className="mt-4 min-h-56 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6"
								value={h.bookText}
								onChange={(event) => h.setBookText(event.target.value)}
							/>
						)}
					</section>

					<BookUploadPreviewPanel upload={h.bookUpload} />
					<BookJobPanel
						job={h.bookJob}
						loading={h.loading}
						onResume={h.resumeBookAnalysis}
					/>
					<section className="rounded-md border border-border bg-card p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h2 className="text-lg font-semibold">整书结果管理</h2>
								<p className="mt-2 text-sm leading-6 text-muted-foreground">
									历史任务和导出不再作为主导航，它们围绕整书拆解结果使用：先打开或完成一个任务，再下载报告、世界书和原创化素材包。
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									variant={
										h.bookUtilityPanel === "history" ? "default" : "outline"
									}
									onClick={() => h.openBookUtility("history")}
								>
									历史记录
								</Button>
								<Button
									variant={
										h.bookUtilityPanel === "exports" ? "default" : "outline"
									}
									onClick={() => h.openBookUtility("exports")}
									disabled={
										!h.bookJob ||
										(!h.bookAnalysisResult && h.bookJob.status !== "succeeded")
									}
								>
									导出结果
								</Button>
							</div>
						</div>
					</section>
					{h.bookUtilityPanel === "history" ? (
						<BookHistoryPanel
							jobs={h.bookHistory}
							uploads={h.uploadHistory}
							loading={h.loading}
							onLoadHistory={h.loadHistory}
							onOpenJob={h.openHistoryJob}
							onDeleteJob={h.deleteHistoryJob}
						/>
					) : null}
					{h.bookUtilityPanel === "exports" ? (
						<ExportView
							job={h.bookJob}
							result={h.bookAnalysisResult}
							loading={h.loading}
							onExport={h.exportBookResult}
							onOpenHistory={() => h.openBookUtility("history")}
						/>
					) : null}
					<BookAnalysisPanel result={h.bookAnalysisResult} job={h.bookJob} />
				</>
			) : null}

			{h.activeView === "history" ? (
				<>
					<BookHistoryPanel
						jobs={h.bookHistory}
						uploads={h.uploadHistory}
						loading={h.loading}
						onLoadHistory={h.loadHistory}
						onOpenJob={h.openHistoryJob}
						onDeleteJob={h.deleteHistoryJob}
					/>
					<BookJobPanel
						job={h.bookJob}
						loading={h.loading}
						onResume={h.resumeBookAnalysis}
					/>
					<BookAnalysisPanel result={h.bookAnalysisResult} job={h.bookJob} />
				</>
			) : null}

			{h.activeView === "exports" ? (
				<ExportView
					job={h.bookJob}
					result={h.bookAnalysisResult}
					loading={h.loading}
					onExport={h.exportBookResult}
					onOpenHistory={() => h.openView("history")}
				/>
			) : null}
		</WorkspaceShell>
	);
}
