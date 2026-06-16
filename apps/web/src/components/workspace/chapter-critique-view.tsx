"use client";

import { type ChangeEvent, useState } from "react";
import {
	BookOpenCheck,
	CheckCircle2,
	FileText,
	Loader2,
	Network,
	ScanText,
	Sparkles,
	TriangleAlert,
	Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	aiSelfTests,
	type AiSelfTestId,
	type ReferenceProfileProgressItem,
	type RubricResult,
	type ScoreProgressItem,
	type ScoreProgressStatus,
	type ScoreResult,
	type WorkspaceStore,
	useWorkspaceStore,
} from "@/stores/workspace-store";

type ChapterLoadingState =
	| "provider"
	| "profile"
	| "rubric"
	| "score"
	| "quick"
	| "upload"
	| "book"
	| "history"
	| "research"
	| "compare"
	| "ask"
	| "export"
	| null;

type PlatformStrategyPatch = Partial<
	Pick<
		WorkspaceStore,
		| "recommendationSignals"
		| "trafficEntry"
		| "competitionLevel"
		| "pushStage"
		| "competitionNotes"
	>
>;

type ChapterDraftPatch = Partial<Pick<WorkspaceStore, "chapterTitle" | "chapterText">>;

export interface ChapterCritiqueViewProps {
	loading: ChapterLoadingState;
	importReferenceFile: (event: ChangeEvent<HTMLInputElement>) => void;
	onInferReferenceProfile: (text: string, fileName?: string) => void;
	onReferenceTextChange: (value: string) => void;
	onBuildRubric: () => void;
	onScoreChapter: () => void;
	onPlatformStrategyChange: (patch: PlatformStrategyPatch) => void;
	onChapterDraftChange: (patch: ChapterDraftPatch) => void;
}

const competitionLevelOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "low", label: "低竞争" },
	{ value: "medium", label: "中等竞争" },
	{ value: "high", label: "高竞争" },
];

const pushStageOptions = [
	{ value: "unknown", label: "未知" },
	{ value: "cold-start", label: "冷启动" },
	{ value: "second-push", label: "二轮推流" },
	{ value: "stable", label: "稳定推荐" },
	{ value: "recycle", label: "复推/召回" },
];

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

function PlatformStrategyFields({
	recommendationSignals,
	setRecommendationSignals,
	trafficEntry,
	setTrafficEntry,
	competitionLevel,
	setCompetitionLevel,
	pushStage,
	setPushStage,
	competitionNotes,
	setCompetitionNotes,
}: {
	recommendationSignals: string;
	setRecommendationSignals: (value: string) => void;
	trafficEntry: string;
	setTrafficEntry: (value: string) => void;
	competitionLevel: string;
	setCompetitionLevel: (value: string) => void;
	pushStage: string;
	setPushStage: (value: string) => void;
	competitionNotes: string;
	setCompetitionNotes: (value: string) => void;
}) {
	return (
		<details className="mt-5 rounded-md border border-border bg-background p-4">
			<summary className="flex cursor-pointer list-none items-center gap-2">
				<Network className="size-4 text-primary" />
				<p className="font-semibold">
					平台推荐策略假设
					<FieldHelp text="这里不是平台内部算法，而是用于点评归因的可编辑假设：推荐看什么信号、赛道是否拥挤、当前处在冷启动还是二轮推流。" />
				</p>
				<span className="ml-auto text-xs text-muted-foreground">高级项</span>
			</summary>
			<div className="mt-4 grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label>推荐信号假设</Label>
					<Input
						value={recommendationSignals}
						onChange={(event) => setRecommendationSignals(event.target.value)}
						placeholder="点击率，有效阅读，完读，加书架，追更"
					/>
				</div>
				<div className="space-y-2">
					<Label>可能入口/标签</Label>
					<Input
						value={trafficEntry}
						onChange={(event) => setTrafficEntry(event.target.value)}
						placeholder="推荐流，分类页，关键词标签"
					/>
				</div>
				<div className="space-y-2">
					<Label>赛道竞争程度</Label>
					<select
						className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={competitionLevel}
						onChange={(event) => setCompetitionLevel(event.target.value)}
					>
						{competitionLevelOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<div className="space-y-2">
					<Label>推流阶段</Label>
					<select
						className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={pushStage}
						onChange={(event) => setPushStage(event.target.value)}
					>
						{pushStageOptions.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
				</div>
				<div className="space-y-2 md:col-span-2">
					<Label>竞争备注</Label>
					<Input
						value={competitionNotes}
						onChange={(event) => setCompetitionNotes(event.target.value)}
						placeholder="同质化程度、差异化角度、对标作品等"
					/>
				</div>
			</div>
		</details>
	);
}

export function ChapterCritiqueView({
	loading,
	importReferenceFile,
	onInferReferenceProfile,
	onReferenceTextChange,
	onBuildRubric,
	onScoreChapter,
	onPlatformStrategyChange,
	onChapterDraftChange,
}: ChapterCritiqueViewProps) {
	const {
		platform,
		setPlatform,
		audience,
		setAudience,
		readingMode,
		setReadingMode,
		recommendationSignals,
		trafficEntry,
		competitionLevel,
		pushStage,
		competitionNotes,
		referenceText,
		referenceFileName,
		referenceTitle,
		setReferenceTitle,
		genre,
		setGenre,
		referenceProfileProgress,
		category,
		setCategory,
		theme,
		setTheme,
		tags,
		setTags,
		explicitKeywords,
		setExplicitKeywords,
		implicitExpectations,
		setImplicitExpectations,
		positioningPromise,
		setPositioningPromise,
		rubricResult,
		chapterTitle,
		chapterText,
		aiSelfTestEnabled,
		setAiSelfTestEnabled,
		enabledAiSelfTests,
		setEnabledAiSelfTests,
		impressions,
		setImpressions,
		clickThroughRate,
		setClickThroughRate,
		validReadRate,
		setValidReadRate,
		read30sRate,
		setRead30sRate,
		read60sRate,
		setRead60sRate,
		bottomRate,
		setBottomRate,
		followRate,
		setFollowRate,
		bookshelfRate,
		setBookshelfRate,
		firstChapterCompletionRate,
		setFirstChapterCompletionRate,
		nextChapterClickRate,
		setNextChapterClickRate,
		threeChapterRetentionRate,
		setThreeChapterRetentionRate,
		avgReadProgressRate,
		setAvgReadProgressRate,
		paidUnlockRate,
		setPaidUnlockRate,
		scoreProgress,
		scoreResult,
	} = useWorkspaceStore();
	const isShortFormReading = readingMode === "short-paid" || platform === "wechat-short";
	const isLongSerialization = readingMode === "long-serialization";
	const isAlgorithmPlatform =
		platform === "fanqie" || platform === "qimao" || platform === "wechat-short";
	const bookshelfMetricLabel =
		platform === "fanqie"
			? "加书架率 %"
			: platform === "jinjiang"
				? "收藏率 %"
				: platform === "qidian"
					? "收藏/书架率 %"
					: isShortFormReading
						? "收藏意向 %"
						: "加书架率 %";
	const completionMetricLabel = isShortFormReading ? "全文完读率 %" : "首章完读率 %";
	const bottomMetricLabel = isShortFormReading ? "全文触底率 %" : "触底率 %";
	const performanceSnapshotNote = isShortFormReading
		? "短篇付费重点看点击后的全文读完、平均阅读进度和付费解锁，不使用追更、下一章点击、前3章留存。"
		: isLongSerialization
			? "长篇追更重点看首章完读、加书架/收藏、章末下一章点击、前3章留存和追更；阅读60s只作低权重参考。"
			: "移动端连载重点看点击后前30/60秒留住、触底、加书架、下一章点击和前3章留存。";
	const corePerformanceMetrics = [
		{
			id: "impressions",
			label: "展现量",
			value: impressions,
			onChange: setImpressions,
			inputMode: "numeric" as const,
		},
		{
			id: "clickThroughRate",
			label: "点击率 %",
			value: clickThroughRate,
			onChange: setClickThroughRate,
			inputMode: "decimal" as const,
		},
		...(isAlgorithmPlatform
			? [
					{
						id: "validReadRate",
						label: "有效阅读率 %",
						value: validReadRate,
						onChange: setValidReadRate,
						inputMode: "decimal" as const,
					},
				]
			: []),
		{
			id: "read30sRate",
			label: "阅读30s %",
			value: read30sRate,
			onChange: setRead30sRate,
			inputMode: "decimal" as const,
		},
		...(!isLongSerialization
			? [
					{
						id: "read60sRate",
						label: "阅读60s %",
						value: read60sRate,
						onChange: setRead60sRate,
						inputMode: "decimal" as const,
					},
				]
			: []),
		{
			id: "bottomRate",
			label: bottomMetricLabel,
			value: bottomRate,
			onChange: setBottomRate,
			inputMode: "decimal" as const,
		},
		{
			id: "firstChapterCompletionRate",
			label: completionMetricLabel,
			value: firstChapterCompletionRate,
			onChange: setFirstChapterCompletionRate,
			inputMode: "decimal" as const,
		},
		...(isShortFormReading
			? [
					{
						id: "avgReadProgressRate",
						label: "平均阅读进度 %",
						value: avgReadProgressRate,
						onChange: setAvgReadProgressRate,
						inputMode: "decimal" as const,
					},
					{
						id: "paidUnlockRate",
						label: "付费解锁率 %",
						value: paidUnlockRate,
						onChange: setPaidUnlockRate,
						inputMode: "decimal" as const,
					},
				]
			: [
					{
						id: "bookshelfRate",
						label: bookshelfMetricLabel,
						value: bookshelfRate,
						onChange: setBookshelfRate,
						inputMode: "decimal" as const,
					},
					{
						id: "nextChapterClickRate",
						label: "章末下一章点击率 %",
						value: nextChapterClickRate,
						onChange: setNextChapterClickRate,
						inputMode: "decimal" as const,
					},
					{
						id: "threeChapterRetentionRate",
						label: "前3章留存率 %",
						value: threeChapterRetentionRate,
						onChange: setThreeChapterRetentionRate,
						inputMode: "decimal" as const,
					},
					{
						id: "followRate",
						label: platform === "jinjiang" ? "追更/收藏转化 %" : "追更率 %",
						value: followRate,
						onChange: setFollowRate,
						inputMode: "decimal" as const,
					},
				]),
	];
	const auxiliaryPerformanceMetrics = [
		...(isLongSerialization
			? [
					{
						id: "read60sRate",
						label: "阅读60s %（长篇低权重）",
						value: read60sRate,
						onChange: setRead60sRate,
						inputMode: "decimal" as const,
					},
				]
			: []),
		...(isShortFormReading
			? [
					{
						id: "bookshelfRate",
						label: bookshelfMetricLabel,
						value: bookshelfRate,
						onChange: setBookshelfRate,
						inputMode: "decimal" as const,
					},
				]
			: []),
	];

	function toggleAiSelfTest(testId: AiSelfTestId) {
		setEnabledAiSelfTests((current) =>
			current.includes(testId)
				? current.filter((item) => item !== testId)
				: [...current, testId],
		);
	}

	return (
		<>
			<WorkflowGuide
				steps={[
					"校准平台和读者",
					"导入成熟章节",
					"AI 识别定位",
					"生成 Rubric",
					"质检自己的章节",
				]}
				note="单章点评不是文学奖评分，而是检查目标读者是否愿意继续读。市场定位优先由 AI 从参考章节识别，你只需要校正明显不准的地方。"
			/>
			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<Sparkles className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">
						2. 平台风格画像
						<FieldHelp text="不同平台读者接受的节奏、表达和钩子密度不同。这里用于让评分标准贴近目标平台。" />
					</h2>
				</div>
				<div className="mt-5 grid gap-4 md:grid-cols-3">
					<div className="space-y-2">
						<Label>目标平台</Label>
						<select
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							value={platform}
							onChange={(event) => setPlatform(event.target.value)}
						>
							<option value="qidian">起点</option>
							<option value="fanqie">番茄</option>
							<option value="jinjiang">晋江</option>
							<option value="qimao">七猫</option>
							<option value="wechat-short">微信短篇/小程序文</option>
							<option value="other">其他</option>
						</select>
					</div>
					<div className="space-y-2">
						<Label>目标读者</Label>
						<select
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							value={audience}
							onChange={(event) => setAudience(event.target.value)}
						>
							<option value="male-fast-paced">男频快节奏爽文</option>
							<option value="female-emotional">女频情绪流</option>
							<option value="setting-heavy">设定党/世界观</option>
							<option value="light-reader">快节奏小白文</option>
							<option value="suspense-brainstorm">悬疑脑洞</option>
							<option value="other">其他</option>
						</select>
					</div>
					<div className="space-y-2">
						<Label>阅读场景</Label>
						<select
							className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							value={readingMode}
							onChange={(event) => setReadingMode(event.target.value)}
						>
							<option value="long-serialization">长篇追更</option>
							<option value="mobile-fragmented">移动端碎片阅读</option>
							<option value="short-paid">短篇付费</option>
							<option value="other">其他</option>
						</select>
					</div>
				</div>
				<PlatformStrategyFields
					recommendationSignals={recommendationSignals}
					setRecommendationSignals={(value) =>
						onPlatformStrategyChange({ recommendationSignals: value })
					}
					trafficEntry={trafficEntry}
					setTrafficEntry={(value) => onPlatformStrategyChange({ trafficEntry: value })}
					competitionLevel={competitionLevel}
					setCompetitionLevel={(value) =>
						onPlatformStrategyChange({ competitionLevel: value })
					}
					pushStage={pushStage}
					setPushStage={(value) => onPlatformStrategyChange({ pushStage: value })}
					competitionNotes={competitionNotes}
					setCompetitionNotes={(value) =>
						onPlatformStrategyChange({ competitionNotes: value })
					}
				/>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex items-center gap-2">
					<BookOpenCheck className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">3. 导入成熟章节</h2>
				</div>

				<div className="mt-5 grid gap-4">
					<div className="space-y-2 rounded-md border border-border bg-background p-4">
						<Label htmlFor="reference-file">上传成熟章节文件</Label>
						<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
							<Input
								id="reference-file"
								type="file"
								accept=".txt,.md,text/plain,text/markdown"
								onChange={importReferenceFile}
							/>
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									onInferReferenceProfile(
										referenceText,
										referenceFileName || undefined,
									)
								}
								disabled={!referenceText.trim() || loading !== null}
							>
								{loading === "profile" ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<Upload className="mr-2 size-4" />
								)}
								AI 识别当前文本
							</Button>
						</div>
						{referenceFileName ? (
							<p className="text-xs text-muted-foreground">
								已导入：{referenceFileName}
							</p>
						) : (
							<p className="text-xs text-muted-foreground">
								支持 TXT 和常见文本文件。导入后会用 AI 识别标题、题材和市场定位。
							</p>
						)}
					</div>
					<div className="grid gap-4 md:grid-cols-[1fr_160px]">
						<div className="space-y-2">
							<Label>参考章节标题</Label>
							<Input
								value={referenceTitle}
								onChange={(event) => setReferenceTitle(event.target.value)}
							/>
						</div>
						<div className="space-y-2">
							<Label>题材</Label>
							<select
								className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								value={genre}
								onChange={(event) => setGenre(event.target.value)}
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
					<textarea
						className="min-h-48 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6"
						value={referenceText}
						onChange={(event) => onReferenceTextChange(event.target.value)}
					/>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-2">
						<Sparkles className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">
							4. AI 识别的市场定位
							<FieldHelp text="分类、主题、标签和关键词优先由 AI 从参考章节识别；如果当前模型不可用，系统不会用粗糙本地规则覆盖字段，请切换模型重试或手动填写。" />
						</h2>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="outline"
							onClick={() =>
								onInferReferenceProfile(
									referenceText,
									referenceFileName || undefined,
								)
							}
							disabled={!referenceText.trim() || loading !== null}
						>
							{loading === "profile" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : (
								<Sparkles className="mr-2 size-4" />
							)}
							AI 重新识别
						</Button>
						<Button onClick={onBuildRubric} disabled={loading !== null}>
							{loading === "rubric" ? (
								<Loader2 className="mr-2 size-4 animate-spin" />
							) : null}
							生成 Rubric
						</Button>
					</div>
				</div>
				<ReferenceProfileProgressPanel
					loading={loading === "profile"}
					progress={referenceProfileProgress}
				/>
				<div className="mt-5 grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<Label>细分分类（识别）</Label>
						<Input
							value={category}
							onChange={(event) => setCategory(event.target.value)}
							placeholder="都市神医 / 追妻火葬场 / 赘婿逆袭"
						/>
					</div>
					<div className="space-y-2">
						<Label>主题承诺（识别）</Label>
						<Input
							value={theme}
							onChange={(event) => setTheme(event.target.value)}
							placeholder="逆袭打脸 / 救赎 / 破镜重圆"
						/>
					</div>
					<div className="space-y-2">
						<Label>标签（识别）</Label>
						<Input
							value={tags}
							onChange={(event) => setTags(event.target.value)}
							placeholder="用逗号分隔"
						/>
					</div>
					<div className="space-y-2">
						<Label>显性关键词（识别）</Label>
						<Input
							value={explicitKeywords}
							onChange={(event) => setExplicitKeywords(event.target.value)}
							placeholder="标题/简介/正文可出现的词"
						/>
					</div>
					<div className="space-y-2">
						<Label>隐性期待（识别）</Label>
						<Input
							value={implicitExpectations}
							onChange={(event) => setImplicitExpectations(event.target.value)}
							placeholder="被低估 / 反转 / 后悔 / 关系破裂"
						/>
					</div>
					<div className="space-y-2">
						<Label>标题/简介承诺（识别）</Label>
						<Input
							value={positioningPromise}
							onChange={(event) => setPositioningPromise(event.target.value)}
							placeholder="用于检查正文是否兑现点击承诺"
						/>
					</div>
				</div>
			</section>

			<section className="rounded-md border border-border bg-card p-5">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<FileText className="size-5 text-primary" />
						<h2 className="text-lg font-semibold">5. 质检我的章节</h2>
					</div>
					<Button onClick={onScoreChapter} disabled={loading !== null || !rubricResult}>
						{loading === "score" ? (
							<Loader2 className="mr-2 size-4 animate-spin" />
						) : null}
						开始评分
					</Button>
				</div>

				<div className="mt-5 grid gap-4">
					<div className="space-y-2">
						<Label>我的章节标题</Label>
						<Input
							value={chapterTitle}
							onChange={(event) =>
								onChapterDraftChange({ chapterTitle: event.target.value })
							}
						/>
					</div>
					<textarea
						className="min-h-48 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6"
						value={chapterText}
						onChange={(event) =>
							onChapterDraftChange({ chapterText: event.target.value })
						}
					/>
				</div>
			</section>

			<details className="rounded-md border border-border bg-card p-5" open>
				<summary className="flex cursor-pointer list-none items-center gap-2">
					<ScanText className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">
						AI 自测增强
						<FieldHelp text="这里不是让你填测试结果，而是让 AI 自动检查人名辨识、跳读感、删句影响等问题，并把结论写进评分和改文 Prompt。" />
					</h2>
					<span className="ml-auto text-xs text-muted-foreground">可选</span>
				</summary>
				<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium">让 AI 额外跑普通人自测</p>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							开启后，你只上传章节；AI 会把自测结论用于定位问题，并生成更精准的改文
							Prompt。
						</p>
					</div>
					<label className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
						<input
							type="checkbox"
							className="size-4 accent-primary"
							checked={aiSelfTestEnabled}
							onChange={(event) => setAiSelfTestEnabled(event.target.checked)}
						/>
						启用
					</label>
				</div>
				<div className="mt-5 grid gap-3 md:grid-cols-2">
					{aiSelfTests.map((test) => {
						const checked = enabledAiSelfTests.includes(test.id);
						return (
							<label
								key={test.id}
								className={`rounded-md border p-4 text-sm transition ${
									aiSelfTestEnabled && checked
										? "border-primary/40 bg-primary/5"
										: "border-border bg-background"
								}`}
							>
								<span className="flex items-center gap-2 font-medium">
									<input
										type="checkbox"
										className="size-4 accent-primary"
										checked={checked}
										disabled={!aiSelfTestEnabled}
										onChange={() => toggleAiSelfTest(test.id)}
									/>
									{test.name}
								</span>
								<span className="mt-2 block leading-6 text-muted-foreground">
									{test.description}
								</span>
							</label>
						);
					})}
				</div>
			</details>

			<details className="rounded-md border border-border bg-card p-5">
				<summary className="flex cursor-pointer list-none items-center gap-2">
					<Sparkles className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">
						6. 数据表现快照
						<FieldHelp text="数据只做辅助归因，不能直接等同于文本好坏。这里会按平台和阅读场景切换指标权重：长篇看追更链路，短篇看完读和付费链路。" />
					</h2>
					<span className="ml-auto text-xs text-muted-foreground">可选高级项</span>
				</summary>
				<p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-muted-foreground">
					{performanceSnapshotNote}
				</p>
				<p className="mt-5 text-sm font-medium">核心指标</p>
				<div className="mt-5 grid gap-4 md:grid-cols-3">
					{corePerformanceMetrics.map((metric) => (
						<div key={metric.id} className="space-y-2">
							<Label>{metric.label}</Label>
							<Input
								inputMode={metric.inputMode}
								value={metric.value}
								onChange={(event) => metric.onChange(event.target.value)}
							/>
						</div>
					))}
				</div>
				{auxiliaryPerformanceMetrics.length ? (
					<div className="mt-5 rounded-md border border-border bg-background p-4">
						<p className="text-sm font-medium">可选辅助指标</p>
						<div className="mt-4 grid gap-4 md:grid-cols-3">
							{auxiliaryPerformanceMetrics.map((metric) => (
								<div key={metric.id} className="space-y-2">
									<Label>{metric.label}</Label>
									<Input
										inputMode={metric.inputMode}
										value={metric.value}
										onChange={(event) => metric.onChange(event.target.value)}
									/>
								</div>
							))}
						</div>
					</div>
				) : null}
			</details>

			<ScoreProgressPanel loading={loading === "score"} progress={scoreProgress} />

			<section className="grid gap-6 xl:grid-cols-2">
				<RubricPanel rubricResult={rubricResult} />
				<ScorePanel scoreResult={scoreResult} isShortFormReading={isShortFormReading} />
			</section>
		</>
	);
}

function RubricPanel({ rubricResult }: { rubricResult: RubricResult | null }) {
	return (
		<div className="rounded-md border border-border bg-card p-5">
			<div className="flex items-center gap-2">
				<Sparkles className="size-5 text-primary" />
				<h2 className="text-lg font-semibold">评分标准（Rubric）</h2>
			</div>
			{rubricResult ? (
				<div className="mt-5 space-y-5">
					<p className="text-sm text-muted-foreground">
						{rubricResult.reference.oneSentenceSummary}
					</p>
					{rubricResult.styleProfile ? (
						<div className="grid gap-2 rounded-md border border-border bg-background p-4 text-sm sm:grid-cols-2">
							<p>
								<span className="text-muted-foreground">平台：</span>
								{rubricResult.styleProfile.platform}
							</p>
							<p>
								<span className="text-muted-foreground">读者：</span>
								{rubricResult.styleProfile.audience}
							</p>
							<p>
								<span className="text-muted-foreground">节奏：</span>
								{rubricResult.styleProfile.pace}
							</p>
							<p>
								<span className="text-muted-foreground">钩子密度：</span>
								{rubricResult.styleProfile.hookDensity}
							</p>
						</div>
					) : null}
					{rubricResult.marketProfile ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="grid gap-2 sm:grid-cols-2">
								<p>
									<span className="text-muted-foreground">分类：</span>
									{rubricResult.marketProfile.category}
								</p>
								<p>
									<span className="text-muted-foreground">主题：</span>
									{rubricResult.marketProfile.theme}
								</p>
								<p>
									<span className="text-muted-foreground">标签：</span>
									{rubricResult.marketProfile.tags.join("、") || "无"}
								</p>
								<p>
									<span className="text-muted-foreground">关键词：</span>
									{rubricResult.marketProfile.explicitKeywords.join("、") || "无"}
								</p>
							</div>
							<div className="mt-3 border-t border-border pt-3">
								<p className="font-medium">读者期待模型</p>
								<ul className="mt-2 space-y-1 text-muted-foreground">
									{rubricResult.marketProfile.readerExpectationModel.map(
										(item) => (
											<li key={item}>{item}</li>
										),
									)}
								</ul>
							</div>
						</div>
					) : null}
					<div className="space-y-3">
						{rubricResult.principles.map((principle) => (
							<div
								key={principle.id}
								className="rounded-md border border-border bg-background p-4"
							>
								<h3 className="font-semibold">{principle.title}</h3>
								<p className="mt-2 text-sm text-muted-foreground">
									{principle.reusableRule}
								</p>
								<p className="mt-2 text-sm">{principle.migrationQuestion}</p>
							</div>
						))}
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						{rubricResult.rubric.metrics.map((metric) => (
							<div
								key={metric.id}
								className="rounded-md border border-border bg-background px-3 py-2"
							>
								<p className="text-sm font-medium">{metric.name}</p>
								<p className="mt-1 text-xs text-muted-foreground">
									{metric.description}
								</p>
							</div>
						))}
					</div>
				</div>
			) : (
				<p className="mt-5 text-sm text-muted-foreground">
					生成评分标准（Rubric）后，这里会展示可迁移原则和评分指标。
				</p>
			)}
		</div>
	);
}

function getScoreProgressMeta(status: ScoreProgressStatus) {
	if (status === "completed") {
		return {
			label: "已完成",
			icon: CheckCircle2,
			className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
			iconClassName: "",
		};
	}

	if (status === "checking") {
		return {
			label: "分析中",
			icon: Loader2,
			className: "border-primary/30 bg-primary/10 text-primary",
			iconClassName: "animate-spin",
		};
	}

	if (status === "failed") {
		return {
			label: "失败",
			icon: TriangleAlert,
			className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
			iconClassName: "",
		};
	}

	return {
		label: "等待",
		icon: Loader2,
		className: "border-border bg-background text-muted-foreground",
		iconClassName: "",
	};
}

function ReferenceProfileProgressPanel({
	progress,
	loading,
}: {
	progress: ReferenceProfileProgressItem[];
	loading: boolean;
}) {
	if (!progress.length) {
		return null;
	}

	const completedCount = progress.filter((item) => item.status === "completed").length;
	const allCompleted = completedCount === progress.length;

	return (
		<div className="mt-5 rounded-md border border-border bg-background p-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<Sparkles className="size-4 text-primary" />
					<p className="font-semibold">识别进度</p>
				</div>
				<span className="text-sm text-muted-foreground">
					{completedCount}/{progress.length} 个步骤
				</span>
			</div>
			<p className="mt-2 text-sm leading-6 text-muted-foreground">
				{loading
					? "正在校准市场定位；每完成一步会更新状态。"
					: allCompleted
						? "识别结果已写入字段，你可以继续手动校正。"
						: "识别尚未完成，已保留当前可用结果。"}
			</p>
			<div className="mt-4 space-y-3">
				{progress.map((item) => {
					const meta = getScoreProgressMeta(item.status);
					const Icon = meta.icon;
					return (
						<div key={item.id} className="rounded-md border border-border bg-card p-3">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-sm font-medium">{item.name}</p>
								<span
									className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs ${meta.className}`}
								>
									<Icon className={`size-3.5 ${meta.iconClassName}`} />
									{meta.label}
								</span>
							</div>
							{item.detail ? (
								<p className="mt-2 text-sm leading-5 text-muted-foreground">
									{item.detail}
								</p>
							) : null}
							{item.facts?.length ? (
								<div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
									{item.facts.map((fact) => (
										<div
											key={`${item.id}-${fact.label}`}
											className="rounded-md border border-border px-2 py-1.5"
										>
											<span className="text-muted-foreground">
												{fact.label}：
											</span>
											<span>{fact.value}</span>
										</div>
									))}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		</div>
	);
}

function ScoreProgressPanel({
	progress,
	loading,
}: {
	progress: ScoreProgressItem[];
	loading: boolean;
}) {
	if (!progress.length) {
		return null;
	}

	const completedCount = progress.filter((item) => item.status === "completed").length;
	const allCompleted = completedCount === progress.length;

	return (
		<section className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-2">
					<CheckCircle2 className="size-5 text-primary" />
					<h2 className="text-lg font-semibold">评分进度</h2>
				</div>
				<span className="text-sm text-muted-foreground">
					{completedCount}/{progress.length} 个指标
				</span>
			</div>
			<p className="mt-3 text-sm leading-6 text-muted-foreground">
				{loading
					? "模型正在一次性分析。结果返回后，会按指标逐项写入答案。"
					: allCompleted
						? "指标答案已按返回结果写入；评分报告下方仍保留完整汇总。"
						: "结果已返回，正在按指标写入答案。"}
			</p>
			<div className="mt-5 space-y-3">
				{progress.map((item) => {
					const meta = getScoreProgressMeta(item.status);
					const Icon = meta.icon;
					return (
						<div
							key={item.metricId}
							className="rounded-md border border-border bg-background p-4"
						>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<h3 className="font-semibold">{item.name}</h3>
								<span
									className={`inline-flex w-fit items-center gap-1 rounded-md border px-2 py-1 text-xs ${meta.className}`}
								>
									<Icon className={`size-3.5 ${meta.iconClassName}`} />
									{meta.label}
								</span>
							</div>
							{item.status === "completed" ? (
								<div className="mt-3 space-y-2 text-sm">
									<p className="font-medium">{item.score}/10</p>
									<p className="text-muted-foreground">{item.reason}</p>
									<p className="text-xs text-muted-foreground">
										证据：{item.evidence}
									</p>
									<p>改法：{item.fix}</p>
								</div>
							) : null}
							{item.status === "checking" ? (
								<p className="mt-3 text-sm text-muted-foreground">
									正在等待该指标的判断结果。
								</p>
							) : null}
							{item.status === "pending" ? (
								<p className="mt-3 text-sm text-muted-foreground">排队等待写入。</p>
							) : null}
						</div>
					);
				})}
			</div>
		</section>
	);
}

export function ScorePanel({
	scoreResult,
	isShortFormReading,
}: {
	scoreResult: ScoreResult | null;
	isShortFormReading: boolean;
}) {
	return (
		<div className="rounded-md border border-border bg-card p-5">
			<div className="flex items-center gap-2">
				<CheckCircle2 className="size-5 text-primary" />
				<h2 className="text-lg font-semibold">评分报告</h2>
			</div>
			{scoreResult ? (
				<div className="mt-5 space-y-5">
					<div className="rounded-md border border-primary/30 bg-primary/10 p-4">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									编辑结论
								</p>
								<p className="mt-2 text-3xl font-semibold">
									{scoreResult.totalScore}/10
								</p>
							</div>
							<div className="max-w-2xl text-sm leading-6">
								<p className="font-semibold">优先改：{scoreResult.weakestPoint}</p>
								<p className="mt-2 text-muted-foreground">
									下一步：{scoreResult.nextRevisionMove}
								</p>
								<p className="mt-2 text-muted-foreground">
									保留优势：{scoreResult.strongestPoint}
								</p>
							</div>
						</div>
					</div>
					{scoreResult.styleFit ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">平台风格匹配</p>
								<span>{scoreResult.styleFit.score}/10</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								平台风险：{scoreResult.styleFit.platformRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								读者风险：{scoreResult.styleFit.audienceRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								场景风险：{scoreResult.styleFit.readingModeRisk}
							</p>
						</div>
					) : null}
					{scoreResult.marketFit ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">市场定位匹配</p>
								<span>{scoreResult.marketFit.score}/10</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								分类风险：{scoreResult.marketFit.categoryRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								主题风险：{scoreResult.marketFit.themeRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								关键词风险：{scoreResult.marketFit.keywordRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								前置风险：{scoreResult.marketFit.frontloadRisk}
							</p>
						</div>
					) : null}
					{scoreResult.platformStrategyFit ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">平台策略匹配</p>
								<span>{scoreResult.platformStrategyFit.score}/10</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								推荐信号：{scoreResult.platformStrategyFit.recommendationRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								竞争风险：{scoreResult.platformStrategyFit.competitionRisk}
							</p>
							<p className="mt-1 text-muted-foreground">
								推流卡点：{scoreResult.platformStrategyFit.pushBottleneck}
							</p>
							<p className="mt-1 text-muted-foreground">
								入口动作：{scoreResult.platformStrategyFit.trafficEntryAction}
							</p>
						</div>
					) : null}
					{scoreResult.selfTestFit ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">AI 自测归因</p>
								<span>{scoreResult.selfTestFit.enabled ? "已启用" : "未启用"}</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								{scoreResult.selfTestFit.summary}
							</p>
							<div className="mt-3 space-y-1 text-muted-foreground">
								<p>遮挡人名：{scoreResult.selfTestFit.dialogueMaskDiagnosis}</p>
								<p>跳读：{scoreResult.selfTestFit.jumpReadDiagnosis}</p>
								<p>共情：{scoreResult.selfTestFit.emotionDiagnosis}</p>
								<p>设定复盘：{scoreResult.selfTestFit.settingRecapDiagnosis}</p>
								<p>删句：{scoreResult.selfTestFit.deleteSentenceDiagnosis}</p>
								<p>AI 味：{scoreResult.selfTestFit.aiTraceDiagnosis}</p>
							</div>
							{scoreResult.selfTestFit.promptAddons.length ? (
								<div className="mt-3">
									<p className="font-medium">写入改文 Prompt 的约束</p>
									<ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
										{scoreResult.selfTestFit.promptAddons.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								</div>
							) : null}
						</div>
					) : null}
					{scoreResult.performanceFit ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<div className="flex items-center justify-between gap-3">
								<p className="font-semibold">数据漏斗归因</p>
								<span>
									{scoreResult.performanceFit.hasData ? "已提供" : "无数据"}
								</span>
							</div>
							<p className="mt-2 text-muted-foreground">
								{scoreResult.performanceFit.funnelSummary}
							</p>
							<div className="mt-3 space-y-1 text-muted-foreground">
								<p>展现：{scoreResult.performanceFit.impressionDiagnosis}</p>
								<p>点击：{scoreResult.performanceFit.clickDiagnosis}</p>
								{scoreResult.performanceFit.validReadDiagnosis ? (
									<p>有效阅读：{scoreResult.performanceFit.validReadDiagnosis}</p>
								) : null}
								<p>30s：{scoreResult.performanceFit.read30sDiagnosis}</p>
								<p>60s：{scoreResult.performanceFit.read60sDiagnosis}</p>
								<p>触底：{scoreResult.performanceFit.bottomDiagnosis}</p>
								{!isShortFormReading ? (
									<p>追更：{scoreResult.performanceFit.followDiagnosis}</p>
								) : null}
								{scoreResult.performanceFit.bookshelfDiagnosis ? (
									<p>加书架：{scoreResult.performanceFit.bookshelfDiagnosis}</p>
								) : null}
								{scoreResult.performanceFit.firstChapterCompletionDiagnosis ? (
									<p>
										{isShortFormReading ? "全文完读：" : "首章完读："}
										{scoreResult.performanceFit.firstChapterCompletionDiagnosis}
									</p>
								) : null}
								{scoreResult.performanceFit.avgReadProgressDiagnosis ? (
									<p>
										平均阅读进度：
										{scoreResult.performanceFit.avgReadProgressDiagnosis}
									</p>
								) : null}
								{scoreResult.performanceFit.paidUnlockDiagnosis ? (
									<p>
										付费解锁：{scoreResult.performanceFit.paidUnlockDiagnosis}
									</p>
								) : null}
								{!isShortFormReading &&
								scoreResult.performanceFit.nextChapterClickDiagnosis ? (
									<p>
										章末下一章：
										{scoreResult.performanceFit.nextChapterClickDiagnosis}
									</p>
								) : null}
								{!isShortFormReading &&
								scoreResult.performanceFit.threeChapterRetentionDiagnosis ? (
									<p>
										前3章留存：
										{scoreResult.performanceFit.threeChapterRetentionDiagnosis}
									</p>
								) : null}
							</div>
							<p className="mt-3 font-medium">
								优先级：{scoreResult.performanceFit.priority}
							</p>
						</div>
					) : null}
					{scoreResult.revisionPrompt ? (
						<div className="rounded-md border border-border bg-background p-4 text-sm">
							<p className="font-semibold">{scoreResult.revisionPrompt.title}</p>
							<pre className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-card p-3 text-xs leading-5 whitespace-pre-wrap">
								{scoreResult.revisionPrompt.prompt}
							</pre>
						</div>
					) : null}
					<div className="space-y-3">
						{scoreResult.scores.map((score) => (
							<div
								key={score.metricId}
								className="rounded-md border border-border bg-background p-4"
							>
								<div className="flex items-center justify-between gap-3">
									<h3 className="font-semibold">{score.name}</h3>
									<span className="text-sm font-medium">{score.score}/10</span>
								</div>
								<p className="mt-2 text-sm text-muted-foreground">{score.reason}</p>
								<p className="mt-2 text-xs text-muted-foreground">
									证据：{score.evidence}
								</p>
								<p className="mt-2 text-sm">改法：{score.fix}</p>
							</div>
						))}
					</div>
				</div>
			) : (
				<p className="mt-5 text-sm text-muted-foreground">
					评分完成后，这里会显示各指标分数、证据和修改建议。
				</p>
			)}
		</div>
	);
}
