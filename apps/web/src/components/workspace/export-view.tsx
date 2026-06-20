"use client";

import { useState } from "react";
import { FileText, Loader2, Network, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl, type ApiEnvelope } from "@/lib/api-client";
import type { BookAnalysisJob, BookAnalysisResult } from "@/stores/workspace-store";

export type BookExportFormat =
	| "markdown"
	| "json"
	| "tavern-card"
	| "world-book"
	| "sillytavern-world-info"
	| "continuation-pack"
	| "style-bible"
	| "outline"
	| "prompt-pack"
	| "do-not-copy";

export type BookExportMode = "notes" | "originalized";

interface ExportViewProps {
	job: BookAnalysisJob | null;
	result: BookAnalysisResult | null;
	loading: string | null;
	onExport: (format: BookExportFormat, mode: BookExportMode) => void;
	onOpenHistory: () => void;
}

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

function ExportEmptyHint({ show, onOpenHistory }: { show: boolean; onOpenHistory: () => void }) {
	if (!show) {
		return null;
	}

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<h2 className="text-lg font-semibold">先打开一个已完成任务</h2>
			<p className="mt-2 text-sm leading-6 text-muted-foreground">
				导出中心依赖整书拆解结果。你可以先到历史任务打开一个已完成任务，或在整书拆解页完成新任务。完成后可导出报告、结构化数据、角色卡、世界书和避险清单。
			</p>
			<Button className="mt-4" variant="outline" onClick={onOpenHistory}>
				去历史任务
			</Button>
		</section>
	);
}

export function ExportView({ job, result, loading, onExport, onOpenHistory }: ExportViewProps) {
	return (
		<>
			<ExportCenter job={job} loading={loading} onExport={onExport} />
			<ExportEmptyHint
				show={!job || job.status !== "succeeded"}
				onOpenHistory={onOpenHistory}
			/>
			<BookAnalysisPanel result={result} job={job} />
		</>
	);
}

function ExportCenter({
	job,
	loading,
	onExport,
}: {
	job: BookAnalysisJob | null;
	loading: string | null;
	onExport: (format: BookExportFormat, mode: BookExportMode) => void;
}) {
	const [mode, setMode] = useState<BookExportMode>("notes");

	if (!job || job.status !== "succeeded") {
		return null;
	}

	const formats: Array<{
		id: BookExportFormat;
		label: string;
		description: string;
		recommended?: boolean;
	}> = [
		{
			id: "markdown",
			label: "学习报告",
			description: "最适合新手阅读、复盘和保存笔记。",
			recommended: true,
		},
		{
			id: "do-not-copy",
			label: "避险清单",
			description: "列出不建议照搬的角色、设定和桥段。",
			recommended: true,
		},
		{
			id: "outline",
			label: "卷纲/大纲",
			description: "把拆解结果整理成可继续创作的结构提纲。",
			recommended: true,
		},
		{
			id: "prompt-pack",
			label: "改写提示词包",
			description: "给 AI 续写或改稿时使用，适合已有创作方向。",
		},
		{
			id: "continuation-pack",
			label: "续写数据包",
			description: "结构化上下文，适合程序或高级工作流。",
		},
		{
			id: "style-bible",
			label: "风格说明书",
			description: "总结叙事节奏、表达习惯和场景组织方式。",
		},
		{
			id: "json",
			label: "完整 JSON",
			description: "给开发者、自动化脚本或二次处理使用。",
		},
		{
			id: "tavern-card",
			label: "角色卡",
			description: "导入 Tavern/SillyTavern 一类工具。",
		},
		{
			id: "world-book",
			label: "世界书",
			description: "导入世界观、组织、地点和关键词触发条目。",
		},
		{
			id: "sillytavern-world-info",
			label: "SillyTavern 世界信息",
			description: "给 SillyTavern 的 World Info 格式使用。",
		},
	];
	const modes: Array<{
		id: BookExportMode;
		label: string;
		description: string;
	}> = [
		{
			id: "notes",
			label: "原作拆解笔记",
			description: "保留更多来源信息，适合学习、复盘、内部读书笔记。",
		},
		{
			id: "originalized",
			label: "原创化导出",
			description: "抽象结构功能，去标识化人物、世界书、Prompt 和角色卡。",
		},
	];
	const selectedMode = modes.find((item) => item.id === mode) || modes[0];

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex items-center gap-2">
				<FileText className="size-5 text-primary" />
				<h2 className="text-lg font-semibold">
					导出中心
					<FieldHelp text="先选择导出模式，再选择格式。原作拆解笔记适合学习复盘；原创化导出会尽量抽象、去标识化，适合继续生成新书素材。" />
				</h2>
			</div>
			<div className="mt-4 grid gap-3 md:grid-cols-2">
				{modes.map((item) => (
					<button
						key={item.id}
						type="button"
						onClick={() => setMode(item.id)}
						className={`rounded-md border p-4 text-left transition ${
							mode === item.id
								? "border-primary bg-primary/10 text-foreground"
								: "border-border bg-background text-muted-foreground hover:border-primary/60"
						}`}
					>
						<span className="block text-sm font-semibold text-foreground">
							{item.label}
						</span>
						<span className="mt-2 block text-xs leading-5">{item.description}</span>
					</button>
				))}
			</div>
			<p className="mt-3 text-xs text-muted-foreground">
				当前模式：{selectedMode.label}。{selectedMode.description}
			</p>
			<ExportRiskNotice mode={mode} />
			<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{formats.map((format) => (
					<Button
						key={format.id}
						variant="outline"
						className="h-auto justify-start whitespace-normal px-4 py-3 text-left"
						onClick={() => onExport(format.id, mode)}
						disabled={loading !== null}
					>
						<span className="flex w-full items-start gap-2">
							{loading === "export" ? (
								<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
							) : null}
							<span>
								<span className="block font-medium">
									{format.label}
									{format.recommended ? "（推荐）" : ""}
								</span>
								<span className="mt-1 block text-xs leading-5 text-muted-foreground">
									{format.description}
								</span>
							</span>
						</span>
					</Button>
				))}
			</div>
		</section>
	);
}

function ExportRiskNotice({ mode }: { mode: BookExportMode }) {
	const isOriginalized = mode === "originalized";

	return (
		<div className="mt-4 rounded-md border border-border bg-background p-4">
			<div className="flex items-center gap-2">
				<ShieldAlert className="size-4 text-primary" />
				<p className="text-sm font-semibold">
					{isOriginalized ? "原创化导出前确认" : "原作拆解笔记提示"}
				</p>
			</div>
			<p className="mt-2 text-xs leading-5 text-muted-foreground">
				{isOriginalized
					? "系统会尽量抽象结构、去标识化人物和世界书，但仍需要你在使用前重写专有名词、关系链、关键事件和可识别桥段。"
					: "这个模式会保留更多来源信息，适合学习、复盘、授权整理或个人私用；不建议直接作为商业化新书素材。"}
			</p>
			<div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
				<p className="rounded-md border border-border bg-card p-3">
					推荐：读书笔记、结构学习、自己作品资产管理。
				</p>
				<p className="rounded-md border border-border bg-card p-3">
					需转换：姓名、地名、组织名、能力名、关系网和事件链。
				</p>
				<p className="rounded-md border border-border bg-card p-3">
					高风险：换皮复刻、未授权商业化、复制可识别设定组合。
				</p>
			</div>
		</div>
	);
}

interface BookEvidenceSearchHit {
	chapterId: string;
	order: number;
	title: string;
	summary: string;
	plotFunction: string;
	hook: string;
	score: number;
	matchedKeywords: string[];
	evidenceSnippets: string[];
	sourceAnchors: Array<{
		anchorId: string;
		label: string;
		quote: string;
		startOffset: number;
		endOffset: number;
	}>;
	chunkStartOffset: number;
	chunkEndOffset: number;
}

interface BookEvidenceSearchResult {
	mode: string;
	jobId: string;
	title: string;
	query: string;
	tokenCount: number;
	totalChunks: number;
	hitCount: number;
	hits: BookEvidenceSearchHit[];
}

export function BookAnalysisPanel({
	result,
	job,
}: {
	result: BookAnalysisResult | null;
	job?: BookAnalysisJob | null;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const [searchLoading, setSearchLoading] = useState(false);
	const [searchError, setSearchError] = useState("");
	const [searchResult, setSearchResult] = useState<BookEvidenceSearchResult | null>(null);

	if (!result) {
		return (
			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<Network className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">整书拆解结果</h2>
				</div>
				<p className="mt-5 text-sm text-muted-foreground">
					拆解完成后，这里会展示世界观、人物卡、关系图谱、大事纪、写作支持包、可迁移风格卡、世界书导出和参考边界检查。
				</p>
			</section>
		);
	}

	const writingSupport = result.writingSupport;
	const generationAssets = result.generationAssets;
	const styleCard = result.transferableStyleCard;
	const boundaryCheck = result.referenceBoundaryCheck;
	const searchable = Boolean(
		job?.id && job.status === "succeeded" && result.mapReduce?.chunkEvidenceIndex?.length,
	);

	async function runEvidenceSearch() {
		if (!job?.id || !searchQuery.trim()) {
			return;
		}

		setSearchLoading(true);
		setSearchError("");
		try {
			const response = await fetch(
				apiUrl(
					`/analysis/book/jobs/${job.id}/search?q=${encodeURIComponent(searchQuery.trim())}&limit=8`,
				),
			);
			const payload = (await response.json()) as ApiEnvelope<BookEvidenceSearchResult>;
			if (!response.ok || payload.code !== 0) {
				throw new Error(payload.message || `Request failed: ${response.status}`);
			}
			setSearchResult(payload.data);
		} catch (error) {
			setSearchError(error instanceof Error ? error.message : String(error));
			setSearchResult(null);
		} finally {
			setSearchLoading(false);
		}
	}

	return (
		<section className="space-y-6">
			<div className="rounded-md border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<Network className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">整书拆解结果</h2>
				</div>
				<div className="mt-5 grid gap-4 md:grid-cols-3">
					<div className="rounded-md border border-border bg-background p-4">
						<p className="text-sm text-muted-foreground">一句话设定</p>
						<p className="mt-2 text-sm">{result.book.oneSentencePremise}</p>
					</div>
					<div className="rounded-md border border-border bg-background p-4">
						<p className="text-sm text-muted-foreground">估算章节</p>
						<p className="mt-2 text-2xl font-semibold">
							{result.book.chapterCountEstimate}
						</p>
					</div>
					<div className="rounded-md border border-border bg-background p-4">
						<p className="text-sm text-muted-foreground">改写边界</p>
						<p className="mt-2 text-2xl font-semibold">
							{result.originalizationReport.riskLevel}
						</p>
					</div>
				</div>
				{result.preprocessing ? (
					<div className="mt-5 rounded-md border border-border bg-background p-4 text-sm">
						<p className="font-semibold">文本清洗 + 章节切分</p>
						<div className="mt-3 grid gap-3 md:grid-cols-4">
							<p>
								<span className="text-muted-foreground">原始字符：</span>
								{result.preprocessing.cleaning.rawLength}
							</p>
							<p>
								<span className="text-muted-foreground">清洗后：</span>
								{result.preprocessing.cleaning.cleanedLength}
							</p>
							<p>
								<span className="text-muted-foreground">段落：</span>
								{result.preprocessing.cleaning.paragraphCount}
							</p>
							<p>
								<span className="text-muted-foreground">章节片段：</span>
								{result.preprocessing.chapters.length}
							</p>
						</div>
						<div className="mt-4 max-h-48 overflow-auto rounded-md border border-border bg-card">
							{result.preprocessing.chapters.map((chapter) => (
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
					</div>
				) : null}
				{result.mapReduce ? (
					<div className="mt-5 rounded-md border border-border bg-background p-4 text-sm">
						<div className="flex items-center justify-between gap-3">
							<p className="font-semibold">逐章汇总拆解</p>
							<span>
								{result.mapReduce.chunkCount ?? result.mapReduce.mapCount}{" "}
								个证据片段
							</span>
						</div>
						<p className="mt-2 text-muted-foreground">{result.mapReduce.reducerNote}</p>
						<div className="mt-4 grid gap-3 md:grid-cols-2">
							{result.mapReduce.chapterMaps.slice(0, 6).map((chapter) => (
								<div
									key={chapter.chapterId}
									className="rounded-md border border-border bg-card p-3"
								>
									<p className="font-medium">
										{chapter.order}. {chapter.title}
									</p>
									<p className="mt-2 text-muted-foreground">{chapter.summary}</p>
									<p className="mt-2">钩子：{chapter.hook}</p>
									{chapter.sourceAnchors?.length ? (
										<div className="mt-2 space-y-1 text-xs text-muted-foreground">
											{chapter.sourceAnchors.slice(0, 2).map((anchor) => (
												<p key={anchor.anchorId}>
													{anchor.label}：{anchor.quote}（
													{anchor.startOffset} - {anchor.endOffset}）
												</p>
											))}
										</div>
									) : null}
								</div>
							))}
						</div>
						{result.mapReduce.chunkEvidenceIndex?.length ? (
							<div className="mt-4 rounded-md border border-border bg-card p-3">
								<p className="font-medium">证据索引</p>
								<p className="mt-1 text-xs text-muted-foreground">
									已建立可回查的文本片段索引，后续复核可以直接定位到原文偏移位置。
								</p>
								<div className="mt-3 space-y-2">
									{result.mapReduce.chunkEvidenceIndex
										.slice(0, 3)
										.map((chunk) => (
											<div
												key={`${chunk.chapterId}-${chunk.chunkStartOffset}`}
											>
												<p className="text-sm">
													{chunk.order}. {chunk.title} ·{" "}
													{chunk.chunkStartOffset} -{" "}
													{chunk.chunkEndOffset}
												</p>
												<p className="text-xs text-muted-foreground">
													关键词：
													{chunk.keywords.slice(0, 4).join("、") || "无"}
												</p>
											</div>
										))}
								</div>
							</div>
						) : null}
						{searchable ? (
							<div className="mt-4 rounded-md border border-border bg-card p-3">
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
									<div>
										<p className="font-medium">整书内检索</p>
										<p className="mt-1 text-xs text-muted-foreground">
											按关键词搜索整书片段、证据摘录和原文锚点。
										</p>
									</div>
									<div className="flex w-full gap-2 sm:max-w-xl">
										<Input
											value={searchQuery}
											onChange={(event) => setSearchQuery(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													void runEvidenceSearch();
												}
											}}
											placeholder="例如：旧案信物、主角反击、关系破裂"
										/>
										<Button
											type="button"
											variant="outline"
											onClick={() => void runEvidenceSearch()}
											disabled={searchLoading || !searchQuery.trim()}
										>
											{searchLoading ? (
												<Loader2 className="mr-2 size-4 animate-spin" />
											) : null}
											检索
										</Button>
									</div>
								</div>
								{searchError ? (
									<p className="mt-3 text-xs text-destructive">{searchError}</p>
								) : null}
								{searchResult ? (
									<div className="mt-4 space-y-3">
										<p className="text-xs text-muted-foreground">
											命中 {searchResult.hitCount} /{" "}
											{searchResult.totalChunks} 个片段
										</p>
										{searchResult.hits.length ? (
											searchResult.hits.map((hit) => (
												<div
													key={`${hit.chapterId}-${hit.chunkStartOffset}`}
													className="rounded-md border border-border bg-background p-3"
												>
													<div className="flex flex-wrap items-center gap-2 text-sm">
														<span className="font-medium">
															{hit.order}. {hit.title}
														</span>
														<span className="text-xs text-muted-foreground">
															score {hit.score}
														</span>
														<span className="text-xs text-muted-foreground">
															{hit.chunkStartOffset} -{" "}
															{hit.chunkEndOffset}
														</span>
													</div>
													<p className="mt-2 text-sm text-muted-foreground">
														{hit.summary}
													</p>
													<p className="mt-2 text-xs text-muted-foreground">
														命中关键词：
														{hit.matchedKeywords.join("、") || "无"}
													</p>
													{hit.evidenceSnippets.length ? (
														<p className="mt-2 text-xs">
															证据摘录：
															{hit.evidenceSnippets.join("；")}
														</p>
													) : null}
													{hit.sourceAnchors.length ? (
														<div className="mt-2 space-y-1 text-xs text-muted-foreground">
															{hit.sourceAnchors
																.slice(0, 3)
																.map((anchor) => (
																	<p key={anchor.anchorId}>
																		{anchor.label}：
																		{anchor.quote}（
																		{anchor.startOffset} -{" "}
																		{anchor.endOffset}）
																	</p>
																))}
														</div>
													) : null}
												</div>
											))
										) : (
											<p className="text-xs text-muted-foreground">
												没有命中结果，可以换一组更具体的关键词。
											</p>
										)}
									</div>
								) : null}
							</div>
						) : null}
					</div>
				) : null}
			</div>

			{styleCard ? (
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">可迁移风格卡</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						提炼可学习的写法规则，不用于仿写作者，也不复用原作可识别内容。
					</p>
					<div className="mt-4 grid gap-4 xl:grid-cols-3">
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">风格标签</p>
							<div className="mt-3 flex flex-wrap gap-2">
								{styleCard.coreStyleTags.map((tag) => (
									<span
										key={tag}
										className="rounded-md border border-border px-2 py-1 text-xs"
									>
										{tag}
									</span>
								))}
							</div>
						</div>
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">叙事声音</p>
							<p className="mt-2 text-muted-foreground">{styleCard.narrativeVoice}</p>
						</div>
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">句式与段落</p>
							<p className="mt-2 text-muted-foreground">{styleCard.sentenceRhythm}</p>
							<p className="mt-2 text-muted-foreground">
								{styleCard.paragraphPattern}
							</p>
						</div>
					</div>
					<div className="mt-4 grid gap-4 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">对白方式</p>
							<p className="mt-2 text-muted-foreground">
								{styleCard.dialoguePattern}
							</p>
							<div className="mt-3 grid gap-3">
								<ListBlock title="主导感官" items={styleCard.sensoryFocus} />
								<ListBlock title="爽点机制" items={styleCard.pleasureMechanisms} />
								<ListBlock title="钩子方式" items={styleCard.hookPatterns} />
							</div>
						</div>
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="grid gap-3">
								<ListBlock title="可迁移规则" items={styleCard.styleRules} />
								<ListBlock title="反面清单" items={styleCard.antiPatterns} />
							</div>
						</div>
					</div>
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">世界观设计</h3>
					<div className="mt-4 space-y-4 text-sm">
						<ListBlock title="世界规则" items={result.worldbuilding.worldRules} />
						<ListBlock title="能力体系" items={result.worldbuilding.powerSystem} />
						<ListBlock
							title="专有名词避险"
							items={result.worldbuilding.itemsAndTerms.map(
								(item) => `${item.name}：${item.function}（${item.risk}）`,
							)}
						/>
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">人物卡</h3>
					<div className="mt-4 space-y-3">
						{result.characters.map((character) => (
							<div
								key={`${character.sourceName}-${character.role}`}
								className="rounded-md border border-border bg-background p-4 text-sm"
							>
								<p className="font-medium">
									{character.sourceName} · {character.archetype}
								</p>
								<p className="mt-2 text-muted-foreground">
									{character.originalCharacterCard.summary}
								</p>
								<p className="mt-2">欲望：{character.desire}</p>
								<p className="mt-1">
									避开：{character.originalCharacterCard.doNotCopy.join("、")}
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">故事线与大事纪</h3>
					<div className="mt-4 space-y-3 text-sm">
						{result.plotlines.map((line) => (
							<div
								key={line.name}
								className="rounded-md border border-border bg-background p-4"
							>
								<p className="font-medium">{line.name}</p>
								<p className="mt-2 text-muted-foreground">{line.reusablePattern}</p>
								<p className="mt-2">兑现：{line.payoff}</p>
							</div>
						))}
						<ListBlock
							title="大事纪"
							items={result.chronicle.map(
								(item) => `${item.order}. ${item.event} - ${item.storyFunction}`,
							)}
						/>
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">人物关系图谱</h3>
					<div className="mt-4 space-y-2 text-sm">
						{result.relationships.edges.map((edge) => (
							<div
								key={`${edge.source}-${edge.target}-${edge.label}`}
								className="rounded-md border border-border bg-background px-3 py-2"
							>
								{`${edge.source} -> ${edge.target}：${edge.label}（${edge.tension}）`}
							</div>
						))}
					</div>
				</div>
			</div>

			{writingSupport ? (
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">写作支持包</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						给后续继续写、AI 续写和长篇校对使用，重点防止忘坑、跑偏、OOC 和节奏空转。
					</p>
					<div className="mt-5 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">章节功能表</h4>
							<div className="mt-3 space-y-3 text-sm">
								{writingSupport.chapterFunctionTable.map((item) => (
									<div
										key={`${item.chapterOrder}-${item.title}`}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">
											{item.chapterOrder}. {item.title}
										</p>
										<p className="mt-1 text-muted-foreground">
											{item.function}
										</p>
										<p className="mt-2">目标：{item.goal}</p>
										<p className="mt-1">冲突：{item.conflict}</p>
										<p className="mt-1">钩子：{item.hook}</p>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">伏笔与回收表</h4>
							<div className="mt-3 space-y-3 text-sm">
								{writingSupport.foreshadowingLedger.map((item) => (
									<div
										key={`${item.setupChapter}-${item.setup}`}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">
											第 {item.setupChapter} 章 · {item.status}
										</p>
										<p className="mt-2">伏笔：{item.setup}</p>
										<p className="mt-1">回收：{item.payoff}</p>
										<p className="mt-1 text-muted-foreground">
											风险：{item.risk}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="mt-6 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">爽点/情绪点地图</h4>
							<div className="mt-3 space-y-3 text-sm">
								{writingSupport.emotionalBeatMap.map((item) => (
									<div
										key={`beat-${item.chapterOrder}`}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">
											第 {item.chapterOrder} 章 · {item.intensity}
										</p>
										<p className="mt-2">{item.beats.join("、")}</p>
										<p className="mt-1 text-muted-foreground">
											承诺：{item.readerPromise}
										</p>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">节奏曲线</h4>
							<div className="mt-3 space-y-3 text-sm">
								{writingSupport.pacingCurve.map((item) => (
									<div
										key={`pace-${item.chapterOrder}`}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">第 {item.chapterOrder} 章</p>
										<p className="mt-2">
											信息 {item.informationDensity} · 冲突{" "}
											{item.conflictIntensity} · 钩子 {item.hookStrength}
										</p>
										<p className="mt-1 text-muted-foreground">
											风险：{item.risk}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="mt-6 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">读者承诺与冲突矩阵</h4>
							<div className="mt-3 grid gap-3 text-sm">
								<ListBlock
									title="读者承诺"
									items={writingSupport.readerPromiseChecklist.map(
										(item) =>
											`${item.promise}：${item.status}；${item.nextCheck}`,
									)}
								/>
								<ListBlock
									title="冲突矩阵"
									items={writingSupport.conflictMatrix.map(
										(item) =>
											`${item.parties.join(" vs ")}：${item.conflict}；升级：${item.nextEscalation}`,
									)}
								/>
							</div>
						</div>

						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">续写约束包</h4>
							<div className="mt-3 space-y-3 text-sm">
								<p>
									<span className="text-muted-foreground">当前状态：</span>
									{writingSupport.continuationPack.currentState}
								</p>
								<p>
									<span className="text-muted-foreground">下一章目标：</span>
									{writingSupport.continuationPack.nextChapterGoal}
								</p>
								<ListBlock
									title="未解决线索"
									items={writingSupport.continuationPack.openThreads}
								/>
								<ListBlock
									title="人物不跑偏"
									items={writingSupport.continuationPack.oocGuards}
								/>
								<ListBlock
									title="设定不冲突"
									items={writingSupport.continuationPack.settingGuards}
								/>
								<ListBlock
									title="风格约束"
									items={writingSupport.continuationPack.styleConstraints}
								/>
							</div>
						</div>
					</div>

					<div className="mt-6 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">质量诊断</h4>
							<div className="mt-3 grid gap-3 text-sm">
								<ListBlock
									title="强项"
									items={writingSupport.qualityDiagnosis.strengths}
								/>
								<ListBlock
									title="短板"
									items={writingSupport.qualityDiagnosis.weaknesses}
								/>
								<ListBlock
									title="优先修正"
									items={writingSupport.qualityDiagnosis.priorityFixes}
								/>
							</div>
						</div>
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">给写作 AI 的续写 Prompt</h4>
							<pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-xs leading-5">
								{writingSupport.continuationPack.aiPrompt}
							</pre>
						</div>
					</div>
				</div>
			) : null}

			<div className="grid gap-6 xl:grid-cols-2">
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">世界历史书</h3>
					<div className="mt-4 grid gap-3 text-sm">
						<ListBlock title="远古史" items={result.historyBook.ancientHistory} />
						<ListBlock title="近代事件" items={result.historyBook.recentHistory} />
						<ListBlock title="公开传说" items={result.historyBook.publicMyths} />
						<ListBlock title="隐藏真相" items={result.historyBook.hiddenTruths} />
					</div>
				</div>

				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">酒馆/AI 写作软件导出包</h3>
					<pre className="mt-4 max-h-96 overflow-auto rounded-md border border-border bg-background p-3 text-xs leading-5 whitespace-pre-wrap">
						{JSON.stringify(result.exportPackage, null, 2)}
					</pre>
				</div>
			</div>

			{generationAssets ? (
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">世界书与生成资产</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						用于导入酒馆、AI
						写作软件或作为续写上下文。世界书条目默认做原创化处理，并标注触发关键词和复用风险。
					</p>
					<div className="mt-5 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">世界书条目</h4>
							<div className="mt-3 space-y-3 text-sm">
								{generationAssets.worldBook.entries.map((entry) => (
									<div
										key={`${entry.category}-${entry.keys.join("-")}`}
										className="rounded-md border border-border bg-card p-3"
									>
										<div className="flex flex-wrap items-center gap-2">
											<span className="rounded-md border border-border px-2 py-1 text-xs">
												{entry.category}
											</span>
											<span className="text-xs text-muted-foreground">
												priority {entry.priority} · risk {entry.sourceRisk}
											</span>
										</div>
										<p className="mt-2 font-medium">{entry.keys.join("、")}</p>
										<p className="mt-2 text-muted-foreground">
											{entry.content}
										</p>
										<p className="mt-2">
											辅助触发：{entry.secondaryKeys.join("、") || "无"}
										</p>
										<p className="mt-1 text-muted-foreground">
											原创化：{entry.originalizationNote}
										</p>
									</div>
								))}
							</div>
						</div>

						<div className="grid gap-4 text-sm">
							<ListBlock
								title="世界书触发规则"
								items={generationAssets.worldBook.activationRules}
							/>
							<div className="rounded-md border border-border bg-background p-4">
								<p className="font-medium">导入说明</p>
								<p className="mt-2 text-muted-foreground">
									{generationAssets.worldBook.importNotes}
								</p>
							</div>
							<ListBlock
								title="一致性检查"
								items={generationAssets.consistencyChecklist}
							/>
						</div>
					</div>

					<div className="mt-6 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<h4 className="font-semibold">风格圣经</h4>
							<p className="mt-2">
								<span className="text-muted-foreground">视角：</span>
								{generationAssets.styleBible.narrativePOV}
							</p>
							<div className="mt-3 grid gap-3">
								<ListBlock
									title="语气关键词"
									items={generationAssets.styleBible.toneKeywords}
								/>
								<ListBlock
									title="文风规则"
									items={generationAssets.styleBible.proseRules}
								/>
								<ListBlock
									title="对话规则"
									items={generationAssets.styleBible.dialogueRules}
								/>
								<ListBlock
									title="禁忌"
									items={generationAssets.styleBible.tabooList}
								/>
							</div>
						</div>

						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">卷/阶段规划</h4>
							<div className="mt-3 space-y-3 text-sm">
								{generationAssets.volumePlan.map((volume) => (
									<div
										key={volume.volume}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">{volume.volume}</p>
										<p className="mt-2">目标：{volume.goal}</p>
										<p className="mt-1">冲突：{volume.mainConflict}</p>
										<p className="mt-1">高潮：{volume.climax}</p>
										<p className="mt-1 text-muted-foreground">
											卷末钩子：{volume.endingHook}
										</p>
									</div>
								))}
							</div>
						</div>
					</div>

					<div className="mt-6 grid gap-6 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">场景模板</h4>
							<div className="mt-3 space-y-3 text-sm">
								{generationAssets.sceneTemplates.map((scene) => (
									<div
										key={scene.name}
										className="rounded-md border border-border bg-card p-3"
									>
										<p className="font-medium">{scene.name}</p>
										<p className="mt-2 text-muted-foreground">
											{scene.useWhen}
										</p>
										<p className="mt-2">节拍：{scene.beats.join(" -> ")}</p>
										<p className="mt-1">避开：{scene.avoid.join("、")}</p>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-md border border-border bg-background p-4">
							<h4 className="text-sm font-semibold">角色语气与反派压力</h4>
							<div className="mt-3 grid gap-3 text-sm">
								<ListBlock
									title="角色语气"
									items={generationAssets.characterVoiceGuide.map(
										(item) =>
											`${item.character}：${item.speechStyle}；禁忌：${item.forbiddenTone.join("、")}`,
									)}
								/>
								<ListBlock
									title="反派压力"
									items={generationAssets.antagonistPressurePlan.map(
										(item) =>
											`${item.antagonist}：${item.pressureMethod}；代价：${item.defeatCost}`,
									)}
								/>
							</div>
						</div>
					</div>

					<div className="mt-6 rounded-md border border-border bg-background p-4 text-sm">
						<h4 className="font-semibold">标题/简介/关键词包</h4>
						<div className="mt-3 grid gap-3 md:grid-cols-2">
							<ListBlock
								title="标题关键词"
								items={generationAssets.titleSynopsisKeywordPack.titleKeywords}
							/>
							<ListBlock
								title="简介卖点"
								items={
									generationAssets.titleSynopsisKeywordPack.synopsisSellingPoints
								}
							/>
							<ListBlock
								title="搜索标签"
								items={generationAssets.titleSynopsisKeywordPack.searchTags}
							/>
							<ListBlock
								title="开局关键词"
								items={generationAssets.titleSynopsisKeywordPack.openingKeywords}
							/>
						</div>
					</div>
				</div>
			) : null}

			{result.sourceAssetArchive ? (
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">原作拆解笔记</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						{result.sourceAssetArchive.usageNotice}
					</p>
					<div className="mt-4 grid gap-4 xl:grid-cols-2">
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">原作人物笔记</p>
							<div className="mt-3 space-y-3">
								{result.sourceAssetArchive.sourceCharacterNotes.map((item) => (
									<div key={`${item.name}-${item.role}`}>
										<p className="font-medium">
											{item.name} · {item.role}
										</p>
										<p className="mt-1 text-muted-foreground">
											{item.plotFunction}
										</p>
										<p className="mt-1">
											可识别特征：{item.recognizableTraits.join("、")}
										</p>
									</div>
								))}
							</div>
						</div>
						<div className="grid gap-3 text-sm">
							<ListBlock
								title="原作世界观笔记"
								items={result.sourceAssetArchive.sourceWorldNotes}
							/>
							<ListBlock
								title="原作时间线笔记"
								items={result.sourceAssetArchive.sourceTimelineNotes}
							/>
							<ListBlock
								title="原作关系网笔记"
								items={result.sourceAssetArchive.sourceRelationshipNotes}
							/>
							<ListBlock
								title="原作专有名词笔记"
								items={result.sourceAssetArchive.sourceTermNotes}
							/>
						</div>
					</div>
				</div>
			) : null}

			<div className="rounded-md border border-border bg-card p-5">
				<h3 className="font-semibold">参考边界检查</h3>
				{boundaryCheck ? (
					<>
						<p className="mt-2 text-sm text-muted-foreground">
							{boundaryCheck.summary}
						</p>
						<div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
							<ListBlock title="可以学习" items={boundaryCheck.learnablePatterns} />
							<ListBlock title="不要复用" items={boundaryCheck.doNotReuse} />
							<ListBlock title="必须改造" items={boundaryCheck.needsTransformation} />
							<ListBlock title="专名风险" items={boundaryCheck.nameAndTermRisks} />
							<ListBlock
								title="情节雷同风险"
								items={boundaryCheck.plotSimilarityRisks}
							/>
							<ListBlock
								title="安全迁移动作"
								items={boundaryCheck.safeRewriteMoves}
							/>
						</div>
					</>
				) : null}
				<div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
					<ListBlock title="可学习" items={result.originalizationReport.safeToLearn} />
					<ListBlock
						title="必须转换"
						items={result.originalizationReport.mustTransform}
					/>
					<ListBlock
						title="迁移策略"
						items={result.originalizationReport.rewriteStrategy}
					/>
				</div>
				<p className="mt-4 text-sm text-muted-foreground">
					{result.originalizationReport.fanFictionWarning}
				</p>
			</div>

			{result.usageRiskNotice ? (
				<div className="rounded-md border border-border bg-card p-5">
					<h3 className="font-semibold">使用风险提示</h3>
					<p className="mt-2 text-sm text-muted-foreground">
						{result.usageRiskNotice.summary}
					</p>
					<div className="mt-4 grid gap-4 md:grid-cols-3">
						<ListBlock title="推荐用途" items={result.usageRiskNotice.recommendedUse} />
						<ListBlock
							title="较高风险用途"
							items={result.usageRiskNotice.higherRiskUse}
						/>
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-medium">使用责任</p>
							<p className="mt-2 text-muted-foreground">
								{result.usageRiskNotice.userResponsibility}
							</p>
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
	return (
		<div className="rounded-md border border-border bg-background p-4">
			<p className="font-medium">{title}</p>
			<ul className="mt-2 space-y-1 text-muted-foreground">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	);
}
