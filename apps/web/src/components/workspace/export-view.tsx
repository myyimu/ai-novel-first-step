"use client";

import { useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
	Check,
	Download,
	FileText,
	Filter,
	GitMerge,
	Loader2,
	Network,
	Pencil,
	RotateCcw,
	ShieldAlert,
	Trash2,
	Undo2,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiUrl, type ApiEnvelope } from "@/lib/api-client";
import {
	buildBookComprehensionMap,
	buildRelationshipReadingInsight,
	type BookComprehensionMap,
} from "@/lib/book-comprehension";
import {
	applyRelationshipGraphCorrections,
	buildRelationshipGraph,
	buildRelationshipGraphExport,
	buildRelationshipGraphVersions,
	graphCommunityColors,
	graphLayoutOptions,
	graphTypeColors,
	graphTypeLabels,
	resolveEdgeTone,
	sanitizeFilename,
	type GraphPositionOverrides,
	type RelationshipGraphCorrection,
	type RelationshipGraphLayout,
} from "@/lib/relationship-graph";
import type { BookAnalysisJob, BookAnalysisResult } from "@/stores/workspace-store";

export type BookExportFormat =
	| "markdown"
	| "reading-report"
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

const GRAPH_WIDTH = 1440;
const GRAPH_HEIGHT = 900;
const GRAPH_CENTER_X = GRAPH_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_HEIGHT / 2;

function truncateGraphLabel(label: string, maxLength = 8) {
	return label.length > maxLength ? `${label.slice(0, maxLength)}…` : label;
}

function resolveEdgeDisplayLabel(label: string, relation: string[]) {
	return truncateGraphLabel(label || relation[0] || "关系", 10);
}

function resolveNodeLabelOffset(x: number, y: number, radius: number) {
	const horizontal = x > GRAPH_CENTER_X ? -1 : 1;
	const vertical = y > GRAPH_CENTER_Y ? -1 : 1;
	return {
		x: horizontal * Math.max(18, radius * 0.55),
		y: vertical * (radius + 22),
	};
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
				导出资产依赖整书拆解结果。你可以先到历史任务打开一个已完成任务，或在整书拆解页完成新任务。完成后可导出报告、结构化数据、角色卡、世界书和避险清单。
			</p>
			<Button className="mt-4" variant="outline" onClick={onOpenHistory}>
				去历史任务
			</Button>
		</section>
	);
}

export function ExportView({ job, result, loading, onExport, onOpenHistory }: ExportViewProps) {
	const hasUsableResult = Boolean(job && result);
	return (
		<>
			<ExportCenter job={job} loading={loading} onExport={onExport} />
			<ExportEmptyHint show={!hasUsableResult} onOpenHistory={onOpenHistory} />
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

	if (!job) {
		return null;
	}

	const formatGroups: Array<{
		id: string;
		title: string;
		description: string;
		formats: Array<{
			id: BookExportFormat;
			label: string;
			description: string;
			recommended?: boolean;
		}>;
	}> = [
		{
			id: "understand",
			title: "先读懂",
			description: "给作者、编辑或团队复盘使用，优先解释这本书为什么有人追。",
			formats: [
				{
					id: "reading-report",
					label: "拆书阅读报告",
					description: "先讲清留人结构、思维导图、关系故事线和可学写法。",
					recommended: true,
				},
				{
					id: "markdown",
					label: "完整学习报告",
					description: "保留完整拆书资产，适合深入复盘和保存笔记。",
				},
				{
					id: "do-not-copy",
					label: "避险清单",
					description: "列出不建议照搬的角色、设定和桥段。",
				},
			],
		},
		{
			id: "create",
			title: "继续创作",
			description: "把拆书结果转换成新书规划、Prompt 或续写上下文。",
			formats: [
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
			],
		},
		{
			id: "archive",
			title: "资料归档 / 工具导入",
			description: "给开发者、自动化脚本或外部写作工具使用。",
			formats: [
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
			],
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
					导出资产
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
			<div className="mt-4 grid gap-4 xl:grid-cols-3">
				{formatGroups.map((group) => (
					<div
						key={group.id}
						className="rounded-md border border-border bg-background p-4"
					>
						<div className="min-h-20">
							<p className="text-sm font-semibold">{group.title}</p>
							<p className="mt-2 text-xs leading-5 text-muted-foreground">
								{group.description}
							</p>
						</div>
						<div className="mt-3 space-y-2">
							{group.formats.map((format) => (
								<Button
									key={format.id}
									variant="outline"
									className={`h-auto w-full justify-start whitespace-normal px-4 py-3 text-left ${
										format.recommended
											? "border-primary/50 bg-primary/10"
											: "bg-card"
									}`}
									onClick={() => onExport(format.id, mode)}
									disabled={loading !== null}
								>
									<span className="flex w-full items-start gap-2">
										{loading === "export" ? (
											<Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
										) : null}
										<span>
											<span className="flex flex-wrap items-center gap-2 font-medium">
												{format.label}
												{format.recommended ? (
													<span className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
														首选
													</span>
												) : null}
											</span>
											<span className="mt-1 block text-xs leading-5 text-muted-foreground">
												{format.description}
											</span>
										</span>
									</span>
								</Button>
							))}
						</div>
					</div>
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

function downloadTextFile(filename: string, content: string, mimeType: string) {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
	URL.revokeObjectURL(url);
}

function resolveGraphQualityTone(
	riskLevel?: NonNullable<BookAnalysisResult["relationshipGraphQuality"]>["riskLevel"],
) {
	if (riskLevel === "good") {
		return {
			label: "可信",
			className: "border-success-border bg-success-surface text-success-foreground",
		};
	}
	if (riskLevel === "needs-review") {
		return {
			label: "需复核",
			className: "border-warning-border bg-warning-surface text-warning-foreground",
		};
	}
	return {
		label: "偏弱",
		className: "border-destructive/30 bg-destructive/10 text-destructive",
	};
}

type GraphWorkbenchView = "overview" | "review" | "timeline" | "export";

const graphWorkbenchViews: Array<{ id: GraphWorkbenchView; label: string; description: string }> = [
	{ id: "overview", label: "总览", description: "看主角、社区和核心关系" },
	{ id: "review", label: "复核", description: "先处理弱证据和孤立节点" },
	{ id: "timeline", label: "时间线", description: "按章节理解关系演化" },
	{ id: "export", label: "导出", description: "沉淀 JSON/SVG 图谱资产" },
];

function RelationshipGraphPanel({
	result,
	onSearchEvidence,
}: {
	result: BookAnalysisResult;
	onSearchEvidence?: (query: string) => void;
}) {
	const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
	const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
	const [typeFilter, setTypeFilter] = useState("all");
	const [layout, setLayout] = useState<RelationshipGraphLayout>("force");
	const [workbenchView, setWorkbenchView] = useState<GraphWorkbenchView>("overview");
	const [corrections, setCorrections] = useState<RelationshipGraphCorrection[]>([]);
	const [edgeLabelDrafts, setEdgeLabelDrafts] = useState<Record<string, string>>({});
	const [zoom, setZoom] = useState(1);
	const [positionOverrides, setPositionOverrides] = useState<GraphPositionOverrides>({});
	const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
	const svgRef = useRef<SVGSVGElement | null>(null);
	const graphGroupRef = useRef<SVGGElement | null>(null);
	const effectiveResult = useMemo(
		() => applyRelationshipGraphCorrections(result, corrections),
		[result, corrections],
	);
	const graph = useMemo(() => {
		const next = buildRelationshipGraph(effectiveResult, layout);
		next.nodes.forEach((node) => {
			const override = positionOverrides[node.id];
			if (override) {
				node.x = override.x;
				node.y = override.y;
			}
		});
		return next;
	}, [effectiveResult, layout, positionOverrides]);
	const quality = effectiveResult.relationshipGraphQuality;
	const qualityTone = resolveGraphQualityTone(quality?.riskLevel);
	const visibleNodeIds = new Set(
		graph.nodes
			.filter((node) => typeFilter === "all" || node.type === typeFilter)
			.map((node) => node.id),
	);
	const visibleNodes = graph.nodes.filter((node) => visibleNodeIds.has(node.id));
	const visibleEdges = graph.edges.filter(
		(edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
	);
	const selectedNode = visibleNodes.find((node) => node.id === selectedNodeId);
	const selectedEdge = visibleEdges.find((edge) => edge.id === selectedEdgeId);
	const selectedEdgeInsight = selectedEdge
		? buildRelationshipReadingInsight(
				selectedEdge,
				selectedEdge.sourceNode.label,
				selectedEdge.targetNode.label,
			)
		: null;
	const relatedEdges = selectedNode
		? visibleEdges.filter(
				(edge) => edge.source === selectedNode.id || edge.target === selectedNode.id,
			)
		: [];
	const timelineEdges = [...graph.edges].sort((left, right) => {
		const chapterDelta = (left.firstSeenChapter || 999999) - (right.firstSeenChapter || 999999);
		return chapterDelta || right.weight - left.weight;
	});
	const graphVersions = buildRelationshipGraphVersions(graph);
	const recommendedView: GraphWorkbenchView =
		quality?.weakEvidenceEdges.length || quality?.isolatedNodes.length
			? "review"
			: graphVersions.length
				? "timeline"
				: "export";
	const currentWorkbench = graphWorkbenchViews.find((view) => view.id === workbenchView);
	const switchWorkbenchView = (view: GraphWorkbenchView) => {
		setWorkbenchView(view);
		if (view === "timeline") {
			setLayout("timeline");
			setPositionOverrides({});
		}
		if (view === "overview" && layout === "timeline") {
			setLayout("force");
			setPositionOverrides({});
		}
	};
	const addGraphCorrection = (correction: RelationshipGraphCorrection) => {
		setCorrections((current) => [
			...current,
			{
				...correction,
				createdAt: new Date().toISOString(),
			},
		]);
		setSelectedEdgeId(null);
		setPositionOverrides({});
	};
	const edgeReviewKey = (source: string, target: string, label: string) =>
		`${source}--${target}--${label}`;
	const correctionLabel = (correction: RelationshipGraphCorrection) => {
		if (correction.type === "merge-node") {
			return `合并节点 ${correction.fromId} -> ${correction.toId}`;
		}
		if (correction.type === "delete-node") {
			return `忽略节点 ${correction.nodeId}`;
		}
		if (correction.type === "delete-edge") {
			return `忽略关系 ${correction.source} -> ${correction.target}`;
		}
		if (correction.type === "confirm-edge") {
			return `确认关系 ${correction.source} -> ${correction.target}`;
		}
		return `改关系 ${correction.source} -> ${correction.target}`;
	};
	const typeOptions = [
		{ id: "all", label: "全部" },
		{ id: "character", label: "人物" },
		{ id: "faction", label: "势力" },
		{ id: "location", label: "地点" },
	];

	function exportGraphJson() {
		downloadTextFile(
			`${sanitizeFilename(effectiveResult.book.title)}-relationship-graph.json`,
			JSON.stringify(
				buildRelationshipGraphExport(effectiveResult, graph, corrections),
				null,
				2,
			),
			"application/json;charset=utf-8",
		);
	}

	function exportGraphSvg() {
		if (!svgRef.current) {
			return;
		}
		const serialized = new XMLSerializer().serializeToString(svgRef.current);
		downloadTextFile(
			`${sanitizeFilename(result.book.title)}-relationship-graph.svg`,
			serialized,
			"image/svg+xml;charset=utf-8",
		);
	}

	function updateDraggedNode(event: PointerEvent<SVGSVGElement>) {
		if (!draggingNodeId || !graphGroupRef.current) {
			return;
		}
		const point = svgRef.current?.createSVGPoint();
		const matrix = graphGroupRef.current.getScreenCTM();
		if (!point || !matrix) {
			return;
		}
		point.x = event.clientX;
		point.y = event.clientY;
		const nextPoint = point.matrixTransform(matrix.inverse());
		setPositionOverrides((current) => ({
			...current,
			[draggingNodeId]: {
				x: Math.max(110, Math.min(GRAPH_WIDTH - 110, nextPoint.x)),
				y: Math.max(110, Math.min(GRAPH_HEIGHT - 110, nextPoint.y)),
			},
		}));
	}

	return (
		<div className="rounded-md border border-border bg-card p-5">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Network className="size-5 text-primary" />
						<h3 className="font-semibold">一键整书关系图谱工作台</h3>
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						把整书拆解结果转成可点击的学习图谱：先看谁推动冲突，再看关系张力、势力位置和新手可迁移的结构功能。
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{graphLayoutOptions.map((option) => (
						<Button
							key={option.id}
							type="button"
							variant={layout === option.id ? "default" : "outline"}
							size="sm"
							onClick={() => {
								setLayout(option.id);
								setPositionOverrides({});
								setSelectedEdgeId(null);
							}}
						>
							{option.label}
						</Button>
					))}
					{typeOptions.map((option) => (
						<Button
							key={option.id}
							type="button"
							variant={typeFilter === option.id ? "default" : "outline"}
							size="sm"
							onClick={() => {
								setTypeFilter(option.id);
								setSelectedEdgeId(null);
								setSelectedNodeId(null);
							}}
						>
							{option.id === "all" ? <Filter className="mr-2 size-4" /> : null}
							{option.label}
						</Button>
					))}
					<Button
						type="button"
						variant="outline"
						size="icon"
						title="导出图谱 JSON"
						aria-label="导出图谱 JSON"
						onClick={exportGraphJson}
					>
						<FileText className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						title="导出图谱 SVG"
						aria-label="导出图谱 SVG"
						onClick={exportGraphSvg}
					>
						<Download className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						title="放大图谱"
						aria-label="放大图谱"
						onClick={() => setZoom((current) => Math.min(2.2, current + 0.15))}
					>
						<ZoomIn className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						title="缩小图谱"
						aria-label="缩小图谱"
						onClick={() => setZoom((current) => Math.max(0.65, current - 0.15))}
					>
						<ZoomOut className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="icon"
						title="重置视图"
						aria-label="重置视图"
						onClick={() => {
							setZoom(1);
							setPositionOverrides({});
							setTypeFilter("all");
							setSelectedNodeId(null);
							setSelectedEdgeId(null);
						}}
					>
						<RotateCcw className="size-4" />
					</Button>
				</div>
			</div>
			<div className="mt-5 space-y-4">
				<div className="overflow-hidden rounded-md border border-border bg-card p-4">
					<div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
						<p>拖拽节点可微调位置，滚轮或按钮可缩放，点击关系可查看证据。</p>
						<p>
							当前画布：{visibleNodes.length} 个节点 / {visibleEdges.length} 条关系
						</p>
					</div>
					<svg
						ref={svgRef}
						viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
						role="img"
						aria-label="整书人物与势力关系图谱"
						className="block h-[62vh] min-h-[560px] w-full md:h-[72vh] xl:h-[80vh]"
						onPointerMove={updateDraggedNode}
						onPointerUp={() => setDraggingNodeId(null)}
						onPointerLeave={() => setDraggingNodeId(null)}
					>
						<defs>
							<pattern
								id="graph-grid"
								width="36"
								height="36"
								patternUnits="userSpaceOnUse"
							>
								<path
									d="M 36 0 L 0 0 0 36"
									fill="none"
									stroke="hsl(var(--border) / 0.45)"
									strokeWidth="1"
								/>
							</pattern>
						</defs>
						<rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="hsl(var(--card))" />
						<rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="url(#graph-grid)" />
						<g
							ref={graphGroupRef}
							transform={`translate(${GRAPH_CENTER_X} ${GRAPH_CENTER_Y}) scale(${zoom}) translate(-${GRAPH_CENTER_X} -${GRAPH_CENTER_Y})`}
						>
							{layout === "timeline" ? (
								<g>
									<line
										x1="120"
										y1="120"
										x2={GRAPH_WIDTH - 120}
										y2="120"
										stroke="hsl(var(--border))"
										strokeDasharray="4 8"
									/>
									{["人物", "势力", "地点"].map((label, index) => (
										<text
											key={label}
											x="54"
											y={178 + index * 160}
											fill="hsl(var(--muted-foreground))"
											fontSize="13"
											fontWeight="600"
										>
											{label}
										</text>
									))}
								</g>
							) : layout === "cluster" ? (
								graph.communities.map((community) => {
									const members = visibleNodes.filter(
										(node) => node.community === community.id,
									);
									if (!members.length) {
										return null;
									}
									const centerX =
										members.reduce((sum, node) => sum + node.x, 0) /
										members.length;
									const centerY =
										members.reduce((sum, node) => sum + node.y, 0) /
										members.length;
									const radius = Math.min(150, 70 + members.length * 10);
									return (
										<g key={community.id}>
											<circle
												cx={centerX}
												cy={centerY}
												r={radius}
												fill={community.color}
												fillOpacity="0.06"
												stroke={community.color}
												strokeOpacity="0.25"
												strokeDasharray="7 8"
											/>
											<text
												x={centerX}
												y={centerY - radius + 18}
												textAnchor="middle"
												fill="hsl(var(--muted-foreground))"
												fontSize="12"
											>
												{community.label} · {community.size}
											</text>
										</g>
									);
								})
							) : (
								<>
									<circle
										cx={GRAPH_CENTER_X}
										cy={GRAPH_CENTER_Y}
										r="310"
										fill="none"
										stroke="hsl(var(--border))"
										strokeDasharray="5 8"
									/>
									<circle
										cx={GRAPH_CENTER_X}
										cy={GRAPH_CENTER_Y}
										r="235"
										fill="none"
										stroke="hsl(var(--border))"
										strokeDasharray="3 10"
									/>
								</>
							)}
							{visibleEdges.map((edge) => {
								const tone = resolveEdgeTone(edge);
								const selected = selectedEdge?.id === edge.id;
								const midX = (edge.sourceNode.x + edge.targetNode.x) / 2;
								const midY = (edge.sourceNode.y + edge.targetNode.y) / 2;
								const dx = edge.targetNode.x - edge.sourceNode.x;
								const dy = edge.targetNode.y - edge.sourceNode.y;
								const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
								const normalX = -dy / distance;
								const normalY = dx / distance;
								const edgeLabel = resolveEdgeDisplayLabel(
									edge.label,
									edge.relation,
								);
								const showEdgeLabel =
									selected ||
									(edge.weight >= 6 &&
										edge.sourceNode.degree >= 3 &&
										edge.targetNode.degree >= 3);
								const edgeLabelX = midX + normalX * 18;
								const edgeLabelY = midY + normalY * 18;
								return (
									<g key={edge.id}>
										<line
											x1={edge.sourceNode.x}
											y1={edge.sourceNode.y}
											x2={edge.targetNode.x}
											y2={edge.targetNode.y}
											stroke={tone.color}
											strokeWidth={
												selected
													? 6
													: Math.max(2.4, Math.min(6, edge.weight / 1.8))
											}
											strokeOpacity={selected ? 0.92 : 0.58}
											onClick={() => {
												setSelectedEdgeId(edge.id);
												setSelectedNodeId(edge.source);
											}}
											className="cursor-pointer"
										/>
										{showEdgeLabel ? (
											<g
												transform={`translate(${edgeLabelX} ${edgeLabelY})`}
												className="cursor-pointer"
												onClick={() => {
													setSelectedEdgeId(edge.id);
													setSelectedNodeId(edge.source);
												}}
											>
												<rect
													x={-(edgeLabel.length * 7.5 + 12) / 2}
													y={-12}
													width={edgeLabel.length * 7.5 + 12}
													height="24"
													rx="999"
													fill={
														selected
															? "hsl(var(--foreground) / 0.92)"
															: "rgba(15, 23, 42, 0.88)"
													}
													stroke={
														selected
															? tone.color
															: "hsl(var(--foreground) / 0.28)"
													}
													strokeOpacity={0.95}
												/>
												<text
													textAnchor="middle"
													dominantBaseline="central"
													fill="white"
													fontSize="12"
													fontWeight="700"
												>
													{edgeLabel}
												</text>
											</g>
										) : null}
									</g>
								);
							})}
							{visibleNodes.map((node, index) => {
								const selected = selectedNode?.id === node.id;
								const radius = Math.min(34, 14 + node.degree * 3.8);
								const color = graphTypeColors[node.type] || graphTypeColors.unknown;
								const nodeLabel = truncateGraphLabel(node.label, 8);
								const labelWidth = Math.max(48, nodeLabel.length * 13 + 18);
								const labelOffset = resolveNodeLabelOffset(node.x, node.y, radius);
								const showNodeLabel =
									selected ||
									node.mainCharacter ||
									node.degree >= 3 ||
									visibleNodes.length <= 10;
								return (
									<g
										key={node.id}
										transform={`translate(${node.x} ${node.y})`}
										className="cursor-grab active:cursor-grabbing"
										onPointerDown={(event) => {
											event.preventDefault();
											event.stopPropagation();
											setDraggingNodeId(node.id);
											setSelectedNodeId(node.id);
											setSelectedEdgeId(null);
										}}
										onClick={() => {
											setSelectedNodeId(node.id);
											setSelectedEdgeId(null);
										}}
									>
										<circle
											r={radius + (selected ? 6 : 0)}
											fill={
												selected
													? "hsl(var(--primary) / 0.16)"
													: "transparent"
											}
											stroke={
												selected ? "hsl(var(--primary))" : "transparent"
											}
											strokeWidth="2"
										/>
										<circle
											r={radius}
											fill={
												layout === "cluster"
													? graphCommunityColors[
															node.community %
																graphCommunityColors.length
														]
													: color
											}
											stroke="hsl(var(--card))"
											strokeWidth="3"
										/>
										<text
											textAnchor="middle"
											dominantBaseline="central"
											fill="white"
											fontSize="13"
											fontWeight="700"
										>
											{truncateGraphLabel(node.label, 2) || index + 1}
										</text>
										{showNodeLabel ? (
											<g
												transform={`translate(${labelOffset.x} ${labelOffset.y})`}
												pointerEvents="none"
											>
												<rect
													x={-labelWidth / 2}
													y="-11"
													width={labelWidth}
													height="22"
													rx="999"
													fill={
														selected
															? "hsl(var(--foreground) / 0.92)"
															: "rgba(15, 23, 42, 0.88)"
													}
													stroke={
														selected
															? "hsl(var(--primary))"
															: "hsl(var(--foreground) / 0.24)"
													}
													strokeOpacity={0.95}
												/>
												<text
													textAnchor="middle"
													dominantBaseline="central"
													fill="white"
													fontSize="12"
													fontWeight={selected ? "700" : "600"}
												>
													{nodeLabel}
												</text>
											</g>
										) : null}
									</g>
								);
							})}
						</g>
					</svg>
				</div>
				<div className="rounded-md border border-border bg-background p-4">
					<div className="grid grid-cols-2 gap-3 text-sm">
						<div>
							<p className="text-muted-foreground">节点</p>
							<p className="mt-1 text-2xl font-semibold">{visibleNodes.length}</p>
						</div>
						<div>
							<p className="text-muted-foreground">关系</p>
							<p className="mt-1 text-2xl font-semibold">{visibleEdges.length}</p>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-2 text-xs">
						{Object.entries(graphTypeLabels).map(([type, label]) => (
							<span key={type} className="inline-flex items-center gap-1">
								<span
									className="size-2 rounded-full"
									style={{ backgroundColor: graphTypeColors[type] }}
								/>
								{label}
							</span>
						))}
					</div>
					<div className="mt-4 grid grid-cols-4 gap-2">
						{graphWorkbenchViews.map((view) => (
							<Button
								key={view.id}
								type="button"
								variant={workbenchView === view.id ? "default" : "outline"}
								size="sm"
								className="px-2 text-xs"
								onClick={() => switchWorkbenchView(view.id)}
							>
								{view.label}
							</Button>
						))}
					</div>
					<div className="mt-3 rounded-md border border-border bg-card p-3 text-sm">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="font-semibold">{currentWorkbench?.label}工作区</p>
								<p className="mt-1 text-xs leading-5 text-muted-foreground">
									{currentWorkbench?.description}
								</p>
							</div>
							{recommendedView !== workbenchView ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="shrink-0 text-xs"
									onClick={() => switchWorkbenchView(recommendedView)}
								>
									推荐下一步
								</Button>
							) : null}
						</div>
					</div>
					<div className="mt-4 rounded-md border border-border bg-card p-3 text-sm">
						<div className="flex items-center justify-between gap-3">
							<p className="font-semibold">
								{workbenchView === "timeline" ? "关系时间线" : "社区与时间线摘要"}
							</p>
							<span className="text-xs text-muted-foreground">
								{graph.communities.length} 个社区
							</span>
						</div>
						<div className="mt-3 flex flex-wrap gap-2 text-xs">
							{graph.communities.slice(0, 6).map((community) => (
								<span
									key={community.id}
									className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1"
								>
									<span
										className="size-2 rounded-full"
										style={{ backgroundColor: community.color }}
									/>
									{community.label} · {community.size}
								</span>
							))}
						</div>
						<div
							className={`mt-3 space-y-2 overflow-auto text-xs ${
								workbenchView === "timeline" ? "max-h-80" : "max-h-40"
							}`}
						>
							{graphVersions
								.slice(0, workbenchView === "timeline" ? 10 : 5)
								.map((version) => (
									<div
										key={version.id}
										className="rounded-md border border-border bg-background px-2 py-1.5"
									>
										<p className="font-medium">
											{version.label} · 新增 {version.newEdges} 条关系
										</p>
										<p className="mt-1 text-muted-foreground">
											累计 {version.totalNodes} 节点 / {version.totalEdges}{" "}
											关系
											{version.strongestEdge
												? ` · 强关系：${version.strongestEdge.sourceNode.label} -> ${version.strongestEdge.targetNode.label}`
												: ""}
										</p>
									</div>
								))}
							{timelineEdges
								.slice(0, workbenchView === "timeline" ? 12 : 6)
								.map((edge) => {
									const insight = buildRelationshipReadingInsight(
										edge,
										edge.sourceNode.label,
										edge.targetNode.label,
									);
									return (
										<button
											key={`timeline-${edge.id}`}
											type="button"
											onClick={() => {
												setSelectedEdgeId(edge.id);
												setSelectedNodeId(edge.source);
											}}
											className="block w-full rounded-md border border-border bg-background px-2 py-1.5 text-left hover:border-primary"
										>
											<span className="font-medium">
												{edge.firstSeenChapter
													? `第 ${edge.firstSeenChapter} 章`
													: "章节未知"}
											</span>
											<span className="ml-2 text-muted-foreground">
												{edge.sourceNode.label} {"->"}{" "}
												{edge.targetNode.label} ·{" "}
												{edge.relation.join("、") || edge.label}
											</span>
											<span className="mt-1 block leading-5 text-muted-foreground">
												{insight.storyFunction}
											</span>
											{workbenchView === "timeline" ? (
												<span className="mt-1 block leading-5 text-muted-foreground">
													{insight.readerExpectation}
												</span>
											) : null}
										</button>
									);
								})}
							{timelineEdges.length === 0 ? (
								<GuidanceEmptyState
									title="关系时间线还排不出来"
									reason="当前关系边缺少首次出现章节，系统无法按章节展示关系何时进入故事。"
									actions={[
										"重新拆解时保留章节标题和人物首次互动段落。",
										"先在复核页确认高权重关系，再补充或修正首次出现章节。",
										"如果只想学习结构，可以先看上方关键关系故事线。",
									]}
								/>
							) : null}
						</div>
					</div>
					{quality ? (
						<div className="mt-4 rounded-md border border-border bg-card p-3 text-sm">
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="font-semibold">
										{workbenchView === "review"
											? "图谱质量复核"
											: "图谱质量校准"}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										证据覆盖 {Math.round(quality.evidenceCoverage * 100)}% ·
										平均置信 {Math.round(quality.averageConfidence * 100)}%
									</p>
								</div>
								<span
									className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${qualityTone.className}`}
								>
									<ShieldAlert className="size-3" />
									{qualityTone.label}
								</span>
							</div>
							<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
								<div className="rounded-md border border-border bg-background p-2">
									<p className="text-muted-foreground">孤立节点</p>
									<p className="mt-1 text-base font-semibold">
										{quality.isolatedNodes.length}
									</p>
								</div>
								<div className="rounded-md border border-border bg-background p-2">
									<p className="text-muted-foreground">弱证据边</p>
									<p className="mt-1 text-base font-semibold">
										{quality.weakEvidenceEdges.length}
									</p>
								</div>
								<div className="rounded-md border border-border bg-background p-2">
									<p className="text-muted-foreground">已合并</p>
									<p className="mt-1 text-base font-semibold">
										{quality.duplicateMergeCount}
									</p>
								</div>
							</div>
							{quality.recommendedFixes.length ? (
								<div className="mt-3 space-y-1 text-xs leading-5 text-muted-foreground">
									{quality.recommendedFixes
										.slice(0, workbenchView === "review" ? 4 : 2)
										.map((item) => (
											<p key={item}>{item}</p>
										))}
								</div>
							) : null}
							{corrections.length ? (
								<div className="mt-3 rounded-md border border-border bg-background p-2 text-xs">
									<div className="flex items-center justify-between gap-2">
										<p className="font-medium">
											已应用 {corrections.length} 条人工修正
										</p>
										<div className="flex gap-2">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-7 px-2 text-xs"
												onClick={() =>
													setCorrections((current) =>
														current.slice(0, -1),
													)
												}
											>
												<Undo2 className="mr-1 size-3" />
												撤销
											</Button>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="h-7 px-2 text-xs"
												onClick={() => setCorrections([])}
											>
												清空
											</Button>
										</div>
									</div>
									<p className="mt-1 truncate text-muted-foreground">
										{correctionLabel(corrections[corrections.length - 1])}
									</p>
								</div>
							) : null}
							{quality.weakEvidenceEdges.length || quality.isolatedNodes.length ? (
								<div className="mt-3 space-y-2">
									{quality.weakEvidenceEdges
										.slice(0, workbenchView === "review" ? 8 : 3)
										.map((edge) => {
											const reviewKey = edgeReviewKey(
												edge.source,
												edge.target,
												edge.label,
											);
											const draft = edgeLabelDrafts[reviewKey] || "";
											return (
												<div
													key={reviewKey}
													className="rounded-md border border-border bg-background p-2 text-xs"
												>
													<div className="flex items-start justify-between gap-2">
														<div>
															<p className="font-medium">
																{edge.sourceLabel || edge.source}{" "}
																{"->"}{" "}
																{edge.targetLabel || edge.target}
															</p>
															<p className="mt-1 text-muted-foreground">
																{edge.label} · {edge.reason}
															</p>
														</div>
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-7 shrink-0 px-2 text-xs"
															onClick={() =>
																addGraphCorrection({
																	type: "confirm-edge",
																	source: edge.source,
																	target: edge.target,
																	evidence: [
																		`人工确认：${edge.sourceLabel || edge.source} 与 ${edge.targetLabel || edge.target} 存在 ${edge.label}`,
																	],
																})
															}
														>
															<Check className="mr-1 size-3" />
															确认
														</Button>
													</div>
													<div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
														<Input
															value={draft}
															placeholder="改成更准确的关系标签"
															className="h-8 text-xs"
															onChange={(event) =>
																setEdgeLabelDrafts((current) => ({
																	...current,
																	[reviewKey]: event.target.value,
																}))
															}
														/>
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-8 px-2 text-xs"
															disabled={!draft.trim()}
															onClick={() => {
																addGraphCorrection({
																	type: "edit-edge",
																	source: edge.source,
																	target: edge.target,
																	label: draft.trim(),
																	relation: draft
																		.split(/[、,，/]/)
																		.map((item) => item.trim())
																		.filter(Boolean),
																});
																setEdgeLabelDrafts((current) => ({
																	...current,
																	[reviewKey]: "",
																}));
															}}
														>
															<Pencil className="mr-1 size-3" />
															改标签
														</Button>
													</div>
													<div className="mt-2 flex flex-wrap gap-2">
														{onSearchEvidence && edge.suggestedQuery ? (
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="h-7 px-2 text-xs"
																onClick={() =>
																	onSearchEvidence(
																		edge.suggestedQuery!,
																	)
																}
															>
																检索证据
															</Button>
														) : null}
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-7 px-2 text-xs text-destructive"
															onClick={() =>
																addGraphCorrection({
																	type: "delete-edge",
																	source: edge.source,
																	target: edge.target,
																	reason: "人工复核忽略弱证据关系",
																})
															}
														>
															<Trash2 className="mr-1 size-3" />
															忽略关系
														</Button>
													</div>
												</div>
											);
										})}
									{quality.isolatedNodes
										.slice(0, workbenchView === "review" ? 6 : 2)
										.map((node) => {
											const candidates = graph.nodes
												.filter((item) => item.id !== node.id)
												.sort((left, right) => right.degree - left.degree)
												.slice(0, 3);
											return (
												<div
													key={`isolated-${node.id}`}
													className="rounded-md border border-border bg-background p-2 text-xs"
												>
													<div className="flex items-start justify-between gap-2">
														<div>
															<p className="font-medium">
																{node.label}
															</p>
															<p className="mt-1 text-muted-foreground">
																{node.reviewAction ||
																	"需要复核是否应合并。"}
															</p>
														</div>
														{onSearchEvidence && node.suggestedQuery ? (
															<Button
																type="button"
																variant="outline"
																size="sm"
																className="h-7 shrink-0 px-2 text-xs"
																onClick={() =>
																	onSearchEvidence(
																		node.suggestedQuery!,
																	)
																}
															>
																检索节点
															</Button>
														) : null}
													</div>
													<div className="mt-2 flex flex-wrap gap-2">
														{candidates.map((candidate) => (
															<Button
																key={`${node.id}-merge-${candidate.id}`}
																type="button"
																variant="outline"
																size="sm"
																className="h-7 px-2 text-xs"
																onClick={() =>
																	addGraphCorrection({
																		type: "merge-node",
																		fromId: node.id,
																		toId: candidate.id,
																		reason: "人工复核合并孤立节点",
																	})
																}
															>
																<GitMerge className="mr-1 size-3" />
																并入 {candidate.label}
															</Button>
														))}
														<Button
															type="button"
															variant="outline"
															size="sm"
															className="h-7 px-2 text-xs text-destructive"
															onClick={() =>
																addGraphCorrection({
																	type: "delete-node",
																	nodeId: node.id,
																	reason: "人工复核忽略孤立节点",
																})
															}
														>
															<Trash2 className="mr-1 size-3" />
															忽略节点
														</Button>
													</div>
												</div>
											);
										})}
								</div>
							) : null}
						</div>
					) : null}
					{workbenchView === "export" ? (
						<div className="mt-4 rounded-md border border-border bg-card p-3 text-sm">
							<p className="font-semibold">导出图谱资产</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								JSON 保留节点、关系、社区、时间线和质量信息；SVG
								保留当前布局视图，适合笔记和汇报。
							</p>
							<div className="mt-3 grid grid-cols-2 gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={exportGraphJson}
								>
									<FileText className="mr-2 size-4" />
									JSON
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={exportGraphSvg}
								>
									<Download className="mr-2 size-4" />
									SVG
								</Button>
							</div>
						</div>
					) : null}
					{selectedEdge ? (
						<div className="mt-5 rounded-md border border-border bg-card p-3 text-sm">
							<p className="font-semibold">当前关系</p>
							<p className="mt-2">
								{selectedEdge.sourceNode.label} {"->"}{" "}
								{selectedEdge.targetNode.label}
							</p>
							<p className="mt-1 text-muted-foreground">
								{selectedEdge.relation.join("、") || selectedEdge.label}
							</p>
							<p className="mt-1 text-muted-foreground">
								张力：{selectedEdge.tension}
							</p>
							{selectedEdgeInsight ? (
								<div className="mt-3 rounded-md border border-border bg-background p-3">
									<p className="text-xs font-semibold text-muted-foreground">
										这条关系怎么帮助故事留人
									</p>
									<p className="mt-2 text-sm">
										{selectedEdgeInsight.storyFunction}
									</p>
									<p className="mt-2 text-sm text-muted-foreground">
										{selectedEdgeInsight.readerExpectation}
									</p>
									<p className="mt-2 text-xs leading-5 text-muted-foreground">
										可学：{selectedEdgeInsight.learnableMove}
									</p>
								</div>
							) : null}
							<p className="mt-1 text-muted-foreground">
								权重 {selectedEdge.weight}/10 · 情绪{" "}
								{selectedEdge.positivity > 0 ? "+" : ""}
								{selectedEdge.positivity}
								{selectedEdge.firstSeenChapter
									? ` · 首次出现第 ${selectedEdge.firstSeenChapter} 章`
									: ""}
							</p>
							{selectedEdge.evidence.length ? (
								<div className="mt-2 space-y-1 text-xs text-muted-foreground">
									{selectedEdge.evidence.slice(0, 3).map((item) => (
										<p key={item}>证据：{item}</p>
									))}
								</div>
							) : null}
						</div>
					) : null}
					{selectedNode ? (
						<div className="mt-5 rounded-md border border-border bg-card p-3 text-sm">
							<p className="font-semibold">{selectedNode.label}</p>
							<p className="mt-1 text-muted-foreground">
								{graphTypeLabels[selectedNode.type] || "未知"} ·{" "}
								{selectedNode.degree} 条关系
							</p>
							{selectedNode.mainCharacter ? (
								<p className="mt-2 text-xs text-primary">主线角色</p>
							) : null}
							{selectedNode.description ? (
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									{selectedNode.description}
								</p>
							) : null}
							{selectedNode.portraitPrompt ? (
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									肖像提示：{selectedNode.portraitPrompt}
								</p>
							) : null}
							{selectedNode.names.length > 1 ? (
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									别名：{selectedNode.names.join("、")}
								</p>
							) : null}
							<div className="mt-3 max-h-60 space-y-2 overflow-auto">
								{relatedEdges.map((edge) => {
									const other =
										edge.source === selectedNode.id
											? edge.targetNode
											: edge.sourceNode;
									const tone = resolveEdgeTone(edge);
									const insight = buildRelationshipReadingInsight(
										edge,
										edge.sourceNode.label,
										edge.targetNode.label,
									);
									return (
										<button
											key={edge.id}
											type="button"
											onClick={() => setSelectedEdgeId(edge.id)}
											className="block w-full rounded-md border border-border bg-background px-3 py-2 text-left hover:border-primary"
										>
											<span className="flex items-center justify-between gap-2">
												<span>{other.label}</span>
												<span
													className="rounded-md border border-border px-2 py-0.5 text-xs"
													style={{ color: tone.color }}
												>
													{tone.label}
												</span>
											</span>
											<span className="mt-1 block text-xs text-muted-foreground">
												{edge.label} · {edge.tension}
											</span>
											<span className="mt-1 block text-xs leading-5 text-muted-foreground">
												{insight.storyFunction}
											</span>
										</button>
									);
								})}
								{relatedEdges.length === 0 ? (
									<p className="text-muted-foreground">当前筛选下没有关系边。</p>
								) : null}
							</div>
						</div>
					) : null}
				</div>
			</div>
			<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{visibleNodes.slice(0, 12).map((node, index) => (
					<button
						key={node.id}
						type="button"
						onClick={() => {
							setSelectedNodeId(node.id);
							setSelectedEdgeId(null);
						}}
						className="flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-left text-sm hover:border-primary"
					>
						<span
							className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
							style={{ backgroundColor: graphTypeColors[node.type] }}
						>
							{index + 1}
						</span>
						<span className="min-w-0">
							<span className="block truncate font-medium">{node.label}</span>
							<span className="block text-xs text-muted-foreground">
								{graphTypeLabels[node.type] || "未知"} · {node.degree} 条关系
							</span>
						</span>
					</button>
				))}
			</div>
			{visibleEdges.length === 0 ? (
				<div className="mt-4">
					<GuidanceEmptyState
						title="完整图谱暂时没有可用关系"
						reason="当前结果没有可展示的关系边。对作者来说，这通常意味着输入文本缺少人物互动，或人物别名导致关系被分散。"
						actions={[
							"先补充主角与反派、导师、盟友、交易对象之间的直接互动章节。",
							"在原文开头追加角色别名表，例如：张三=主角=少主。",
							"重新拆解后优先查看关键关系故事线，再进入完整图谱复核。",
						]}
					/>
				</div>
			) : null}
		</div>
	);
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
	const evidenceSearchRef = useRef<HTMLDivElement | null>(null);

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
	const searchable = Boolean(job?.id && result.mapReduce?.chunkEvidenceIndex?.length);
	const comprehensionMap = buildBookComprehensionMap(result);

	async function runEvidenceSearch(queryOverride?: string) {
		const nextQuery = (queryOverride ?? searchQuery).trim();
		if (!job?.id || !nextQuery) {
			return;
		}

		setSearchQuery(nextQuery);
		setSearchLoading(true);
		setSearchError("");
		try {
			const response = await fetch(
				apiUrl(
					`/analysis/book/jobs/${job.id}/search?q=${encodeURIComponent(nextQuery)}&limit=8`,
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

	function runGraphReviewSearch(query: string) {
		evidenceSearchRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
		void runEvidenceSearch(query);
	}

	return (
		<section className="space-y-6">
			<div
				id="book-result-overview"
				className="scroll-mt-24 rounded-md border border-border bg-card p-5"
			>
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
					<div
						id="book-result-evidence"
						className="mt-5 scroll-mt-24 rounded-md border border-border bg-background p-4 text-sm"
					>
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
							<div
								ref={evidenceSearchRef}
								className="mt-4 rounded-md border border-border bg-card p-3"
							>
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

			<BookResultPathNav
				hasEvidence={Boolean(result.mapReduce)}
				hasStyleCard={Boolean(styleCard)}
				characterCount={result.characters.length}
				graphEdgeCount={result.relationships.edges.length}
			/>

			<BookComprehensionGuide map={comprehensionMap} />

			{styleCard ? (
				<div
					id="book-result-style"
					className="scroll-mt-24 rounded-md border border-border bg-card p-5"
				>
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

			<div
				id="book-result-assets"
				className="grid scroll-mt-24 items-start gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]"
			>
				<div className="flex flex-col rounded-md border border-border bg-card p-5 xl:h-[620px]">
					<h3 className="font-semibold">世界观设计</h3>
					<div className="mt-4 space-y-4 text-sm xl:flex-1 xl:overflow-y-auto xl:pr-2">
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

				<div className="flex flex-col rounded-md border border-border bg-card p-5 xl:h-[620px]">
					<h3 className="font-semibold">人物卡</h3>
					<div className="mt-4 space-y-3 xl:flex-1 xl:overflow-y-auto xl:pr-2">
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

			<div id="book-result-graph" className="scroll-mt-24">
				<RelationshipGraphPanel
					result={result}
					onSearchEvidence={searchable ? runGraphReviewSearch : undefined}
				/>
			</div>

			<details
				id="book-result-advanced"
				className="scroll-mt-24 rounded-md border border-border bg-background p-5"
			>
				<summary className="cursor-pointer list-none">
					<div className="flex items-center justify-between gap-3">
						<div>
							<h3 className="font-semibold">高级详情</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								展开查看故事线、写作支持包、世界书、原作笔记和风险提示。
							</p>
						</div>
						<span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
							可选
						</span>
					</div>
				</summary>
				<div className="mt-5 space-y-6">
					<div className="rounded-md border border-border bg-card p-5">
						<h3 className="font-semibold">故事线与大事纪</h3>
						<div className="mt-4 grid gap-4 text-sm xl:grid-cols-2">
							<div className="space-y-3">
								{result.plotlines.map((line) => (
									<div
										key={line.name}
										className="rounded-md border border-border bg-background p-4"
									>
										<p className="font-medium">{line.name}</p>
										<p className="mt-2 text-muted-foreground">
											{line.reusablePattern}
										</p>
										<p className="mt-2">兑现：{line.payoff}</p>
									</div>
								))}
							</div>
							<ListBlock
								title="大事纪"
								items={result.chronicle.map(
									(item) =>
										`${item.order}. ${item.event} - ${item.storyFunction}`,
								)}
							/>
						</div>
					</div>

					{writingSupport ? (
						<div className="rounded-md border border-border bg-card p-5">
							<h3 className="font-semibold">写作支持包</h3>
							<p className="mt-2 text-sm text-muted-foreground">
								给后续继续写、AI 续写和长篇校对使用，重点防止忘坑、跑偏、OOC
								和节奏空转。
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
												<p className="font-medium">
													第 {item.chapterOrder} 章
												</p>
												<p className="mt-2">
													信息 {item.informationDensity} · 冲突{" "}
													{item.conflictIntensity} · 钩子{" "}
													{item.hookStrength}
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
											<span className="text-muted-foreground">
												当前状态：
											</span>
											{writingSupport.continuationPack.currentState}
										</p>
										<p>
											<span className="text-muted-foreground">
												下一章目标：
											</span>
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
									<h4 className="text-sm font-semibold">
										给写作 AI 的续写 Prompt
									</h4>
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
								<ListBlock
									title="远古史"
									items={result.historyBook.ancientHistory}
								/>
								<ListBlock
									title="近代事件"
									items={result.historyBook.recentHistory}
								/>
								<ListBlock
									title="公开传说"
									items={result.historyBook.publicMyths}
								/>
								<ListBlock
									title="隐藏真相"
									items={result.historyBook.hiddenTruths}
								/>
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
														priority {entry.priority} · risk{" "}
														{entry.sourceRisk}
													</span>
												</div>
												<p className="mt-2 font-medium">
													{entry.keys.join("、")}
												</p>
												<p className="mt-2 text-muted-foreground">
													{entry.content}
												</p>
												<p className="mt-2">
													辅助触发：
													{entry.secondaryKeys.join("、") || "无"}
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
												<p className="mt-2">
													节拍：{scene.beats.join(" -> ")}
												</p>
												<p className="mt-1">
													避开：{scene.avoid.join("、")}
												</p>
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
										items={
											generationAssets.titleSynopsisKeywordPack.titleKeywords
										}
									/>
									<ListBlock
										title="简介卖点"
										items={
											generationAssets.titleSynopsisKeywordPack
												.synopsisSellingPoints
										}
									/>
									<ListBlock
										title="搜索标签"
										items={generationAssets.titleSynopsisKeywordPack.searchTags}
									/>
									<ListBlock
										title="开局关键词"
										items={
											generationAssets.titleSynopsisKeywordPack
												.openingKeywords
										}
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
										{result.sourceAssetArchive.sourceCharacterNotes.map(
											(item) => (
												<div key={`${item.name}-${item.role}`}>
													<p className="font-medium">
														{item.name} · {item.role}
													</p>
													<p className="mt-1 text-muted-foreground">
														{item.plotFunction}
													</p>
													<p className="mt-1">
														可识别特征：
														{item.recognizableTraits.join("、")}
													</p>
												</div>
											),
										)}
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
									<ListBlock
										title="可以学习"
										items={boundaryCheck.learnablePatterns}
									/>
									<ListBlock title="不要复用" items={boundaryCheck.doNotReuse} />
									<ListBlock
										title="必须改造"
										items={boundaryCheck.needsTransformation}
									/>
									<ListBlock
										title="专名风险"
										items={boundaryCheck.nameAndTermRisks}
									/>
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
							<ListBlock
								title="可学习"
								items={result.originalizationReport.safeToLearn}
							/>
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
								<ListBlock
									title="推荐用途"
									items={result.usageRiskNotice.recommendedUse}
								/>
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
				</div>
			</details>
		</section>
	);
}

function BookResultPathNav({
	hasEvidence,
	hasStyleCard,
	characterCount,
	graphEdgeCount,
}: {
	hasEvidence: boolean;
	hasStyleCard: boolean;
	characterCount: number;
	graphEdgeCount: number;
}) {
	const items = [
		{
			href: "#book-result-guide",
			label: "先读懂",
			description: "导览和思维图",
		},
		hasEvidence
			? {
					href: "#book-result-evidence",
					label: "查证据",
					description: "逐章摘要和原文锚点",
				}
			: null,
		hasStyleCard
			? {
					href: "#book-result-style",
					label: "学写法",
					description: "风格和可迁移规则",
				}
			: null,
		{
			href: "#book-result-assets",
			label: "看人物世界",
			description: `${characterCount} 张人物卡`,
		},
		{
			href: "#book-result-graph",
			label: "探索图谱",
			description: `${graphEdgeCount} 条关系边`,
		},
		{
			href: "#book-result-advanced",
			label: "高级详情",
			description: "写作包和风险清单",
		},
	].filter(Boolean) as Array<{
		href: string;
		label: string;
		description: string;
	}>;

	return (
		<nav className="rounded-md border border-border bg-card p-4" aria-label="拆书结果阅读路径">
			<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
				<div>
					<p className="text-sm font-semibold">推荐阅读路径</p>
					<p className="mt-1 text-xs leading-5 text-muted-foreground">
						先理解留人结构，再查证据和完整资产；完整图谱适合二次探索，不是第一眼入口。
					</p>
				</div>
				<a
					href="#book-result-guide"
					className="inline-flex h-9 items-center justify-center rounded-md border border-primary/40 bg-primary/10 px-3 text-sm font-medium text-primary transition hover:bg-primary/15"
				>
					从导览开始
				</a>
			</div>
			<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
				{items.map((item, index) => (
					<a
						key={item.href}
						href={item.href}
						className="rounded-md border border-border bg-background p-3 text-sm transition hover:border-primary/60 hover:bg-primary/5"
					>
						<span className="text-xs text-muted-foreground">
							{String(index + 1).padStart(2, "0")}
						</span>
						<span className="mt-1 block font-medium">{item.label}</span>
						<span className="mt-1 block text-xs leading-5 text-muted-foreground">
							{item.description}
						</span>
					</a>
				))}
			</div>
		</nav>
	);
}

function GuidanceEmptyState({
	title,
	reason,
	actions,
}: {
	title: string;
	reason: string;
	actions: string[];
}) {
	return (
		<div className="rounded-md border border-dashed border-border bg-background p-4 text-sm">
			<p className="font-medium">{title}</p>
			<p className="mt-2 leading-6 text-muted-foreground">{reason}</p>
			<div className="mt-3">
				<p className="text-xs font-semibold text-muted-foreground">下一步动作</p>
				<ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
					{actions.map((action) => (
						<li key={action} className="border-l-2 border-primary/40 pl-2">
							{action}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function BookComprehensionGuide({ map }: { map: BookComprehensionMap }) {
	const [copyStatus, setCopyStatus] = useState("");

	return (
		<div
			id="book-result-guide"
			className="scroll-mt-24 rounded-md border border-primary/30 bg-primary/10 p-5"
		>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Network className="size-5 text-primary" />
						<h3 className="font-semibold">拆书导览</h3>
					</div>
					<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
						先按“为什么能留住读者”看懂这本书，再去看完整图谱、角色卡和导出资产。
					</p>
				</div>
				<div className="rounded-md border border-primary/30 bg-background px-3 py-2 text-sm">
					<p className="text-xs text-muted-foreground">核心承诺</p>
					<p className="mt-1 font-medium">{map.corePromise || "待补"}</p>
				</div>
			</div>

			<div className="mt-5 rounded-md border border-border bg-card p-4">
				<p className="text-base font-semibold">{map.headline}</p>
				{map.whyItWorks.length ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{map.whyItWorks.slice(0, 5).map((item) => (
							<span
								key={item}
								className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground"
							>
								{item}
							</span>
						))}
					</div>
				) : null}
			</div>

			<div className="mt-5 rounded-md border border-border bg-card p-4">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h4 className="text-sm font-semibold">理解版思维导图</h4>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							先从中心承诺往外看：主角为什么必须动、关系为什么有拉力、冲突怎样升级、读者还在等什么，以及作者能学哪一招。
						</p>
					</div>
					<div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
						<p className="text-xs text-muted-foreground">中心问题</p>
						<p className="mt-1 font-medium">{map.corePromise || map.headline}</p>
					</div>
				</div>
				<div className="mt-4 grid gap-3 lg:grid-cols-5">
					{map.mindMapBranches.map((branch) => (
						<div
							key={branch.id}
							className="flex min-h-48 flex-col rounded-md border border-border bg-background p-3 text-sm"
						>
							<p className="font-semibold">{branch.title}</p>
							<p className="mt-2 text-xs leading-5 text-muted-foreground">
								{branch.summary}
							</p>
							<ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
								{branch.items.slice(0, 3).map((item) => (
									<li key={item} className="border-l-2 border-primary/40 pl-2">
										{item}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</div>

			<div className="mt-5 rounded-md border border-border bg-card p-4">
				<div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
					<div>
						<h4 className="text-sm font-semibold">关键关系故事线</h4>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
							先按章节看关系怎么进入故事、制造什么追读问题，再去完整图谱里探索更多人物和势力。
						</p>
					</div>
					<a
						href="#book-result-graph"
						className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium transition hover:border-primary/60"
					>
						查看完整图谱
					</a>
				</div>
				<div className="mt-4 grid gap-3 lg:grid-cols-3">
					{map.relationshipStoryline.length ? (
						map.relationshipStoryline.map((beat) => (
							<div
								key={beat.id}
								className="rounded-md border border-border bg-background p-3 text-sm"
							>
								<div className="flex flex-wrap items-center gap-2">
									<span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
										{beat.chapterLabel}
									</span>
									<p className="font-medium">{beat.title}</p>
								</div>
								<p className="mt-3 text-muted-foreground">{beat.storyEvent}</p>
								<p className="mt-2">{beat.readerQuestion}</p>
								<p className="mt-2 text-xs leading-5 text-muted-foreground">
									可学：{beat.writingMove}
								</p>
								<p className="mt-2 border-l-2 border-primary/40 pl-2 text-xs leading-5 text-muted-foreground">
									证据：{beat.evidence}
								</p>
							</div>
						))
					) : (
						<GuidanceEmptyState
							title="关系故事线还不够清楚"
							reason="当前拆书结果没有抽到可用关系边，所以系统还不能判断谁在制造压力、交易、误解或情绪拉扯。"
							actions={[
								"重新拆解时尽量保留人物称呼、对话和冲突段落，不要只上传摘要。",
								"如果原文角色别名很多，先在文本前补一小段角色名表。",
								"先用完整学习报告确认章节摘要是否准确，再复查关系图谱。",
							]}
						/>
					)}
				</div>
			</div>

			<div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
				<div className="rounded-md border border-border bg-card p-4">
					<div className="flex items-center justify-between gap-3">
						<h4 className="text-sm font-semibold">故事阶段时间轴</h4>
						<span className="text-xs text-muted-foreground">
							{map.readingPath.length} 个阶段
						</span>
					</div>
					<div className="mt-4 space-y-3">
						{map.readingPath.length ? (
							map.readingPath.map((phase, index) => (
								<div
									key={phase.id}
									className="grid gap-3 rounded-md border border-border bg-background p-3 sm:grid-cols-[34px_1fr]"
								>
									<div className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
										{index + 1}
									</div>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium">{phase.phase}</p>
											<span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
												{phase.chapterRange}
											</span>
										</div>
										<p className="mt-2 text-sm text-muted-foreground">
											触发：{phase.trigger}
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											升级：{phase.escalation}
										</p>
										<p className="mt-1 text-sm text-muted-foreground">
											钩子：{phase.openHook}
										</p>
										<p className="mt-2 text-sm">
											{phase.readerReasonToContinue}
										</p>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											可学：{phase.learnableMove}
										</p>
									</div>
								</div>
							))
						) : (
							<GuidanceEmptyState
								title="故事阶段还没有形成时间轴"
								reason="系统缺少章节功能或大事纪数据，所以暂时不能把故事拆成触发、升级、转折和阶段钩子。"
								actions={[
									"确认上传文本有清晰章节标题，或至少保留章节分隔符。",
									"优先上传开局到一个阶段小高潮的连续内容，不要只上传零散片段。",
									"重新拆解后先看逐章汇总，确认每章目标、冲突和钩子是否被识别。",
								]}
							/>
						)}
					</div>
				</div>

				<div className="space-y-5">
					<div className="rounded-md border border-border bg-card p-4">
						<h4 className="text-sm font-semibold">关键关系为什么重要</h4>
						<div className="mt-4 space-y-3">
							{map.keyRelationships.length ? (
								map.keyRelationships.slice(0, 4).map((relationship) => (
									<div
										key={relationship.id}
										className="rounded-md border border-border bg-background p-3"
									>
										<div className="flex flex-wrap items-center gap-2">
											<p className="font-medium">
												{relationship.from}
												{" -> "}
												{relationship.to}
											</p>
											<span className="rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
												{relationship.state}
											</span>
										</div>
										<p className="mt-2 text-sm text-muted-foreground">
											{relationship.storyFunction}
										</p>
										<p className="mt-1 text-sm">
											{relationship.readerExpectation}
										</p>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											可学：{relationship.learnableMove}
										</p>
									</div>
								))
							) : (
								<GuidanceEmptyState
									title="关键关系解释不足"
									reason="缺少可排序的高权重关系边，系统无法判断哪条关系最能解释读者为什么继续看。"
									actions={[
										"补充主角与压迫者、盟友、导师、交易对象之间的关键互动段落。",
										"重新拆解时开启逐章证据索引，方便回查关系证据。",
										"先人工确认人物卡名称是否重复或被拆成多个别名。",
									]}
								/>
							)}
						</div>
					</div>

					<div className="rounded-md border border-border bg-card p-4">
						<h4 className="text-sm font-semibold">伏笔和未完成期待</h4>
						<div className="mt-4 space-y-2">
							{map.promiseMap.length ? (
								map.promiseMap.slice(0, 5).map((item) => (
									<div
										key={item.id}
										className="rounded-md border border-border bg-background p-3 text-sm"
									>
										<p className="font-medium">{item.promise}</p>
										<p className="mt-1 text-muted-foreground">
											{item.progress} · {item.payoffOrRisk}
										</p>
									</div>
								))
							) : (
								<GuidanceEmptyState
									title="伏笔和读者期待还没沉淀出来"
									reason="当前结果没有明确的读者承诺或伏笔账本，所以还不能判断读者下一章最想看到什么被兑现。"
									actions={[
										"检查前三章是否有未解决问题、秘密、承诺、威胁或反击机会。",
										"如果文本偏设定说明，先补一段主角被迫行动的冲突场景。",
										"重新拆解后优先看读者承诺清单，而不是先看世界观资料。",
									]}
								/>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="mt-5 rounded-md border border-border bg-card p-4">
				<h4 className="text-sm font-semibold">作者可以先学这几招</h4>
				<div className="mt-4 grid gap-3 lg:grid-cols-2">
					{map.beginnerTakeaways.map((takeaway) => (
						<div
							key={takeaway.id}
							className="rounded-md border border-border bg-background p-3 text-sm"
						>
							<p className="font-medium">{takeaway.rule}</p>
							<p className="mt-2 text-muted-foreground">{takeaway.why}</p>
							<p className="mt-2">怎么用：{takeaway.howToUse}</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								避开：{takeaway.avoid}
							</p>
						</div>
					))}
				</div>
			</div>

			<div className="mt-5 rounded-md border border-border bg-card p-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h4 className="text-sm font-semibold">把这次拆书结果用于新书</h4>
						<p className="mt-1 text-sm leading-6 text-muted-foreground">
							这不是让 AI
							照着原作写，而是把读者承诺、阶段升级和关系功能转成原创开局任务。
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							void navigator.clipboard?.writeText(map.applicationPrompt);
							setCopyStatus("已复制新书应用 Prompt");
						}}
					>
						复制 Prompt
					</Button>
				</div>
				<textarea
					readOnly
					className="mt-4 max-h-72 min-h-44 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-xs leading-5 text-muted-foreground outline-none"
					value={map.applicationPrompt}
				/>
				{copyStatus ? (
					<p className="mt-2 text-xs text-muted-foreground">{copyStatus}</p>
				) : null}
			</div>
		</div>
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
