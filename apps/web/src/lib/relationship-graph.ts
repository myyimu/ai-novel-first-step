import type { BookAnalysisResult } from "@/stores/workspace-store";

export type RelationshipGraphNode = {
	id: string;
	label: string;
	type: string;
	names: string[];
	mainCharacter: boolean;
	description: string;
	portraitPrompt: string;
	community: number;
	degree: number;
	x: number;
	y: number;
};

export type RelationshipGraphEdge = {
	id: string;
	source: string;
	target: string;
	label: string;
	tension: string;
	relation: string[];
	weight: number;
	positivity: number;
	evidence: string[];
	firstSeenChapter?: number;
	confidence?: number;
	sourceNode: RelationshipGraphNode;
	targetNode: RelationshipGraphNode;
};

export type RelationshipGraphLayout = "force" | "cluster" | "timeline";
export type GraphPositionOverrides = Record<string, { x: number; y: number }>;

export type RelationshipGraphCorrection =
	| {
			type: "merge-node";
			fromId: string;
			toId: string;
			reason?: string;
			createdAt?: string;
	  }
	| {
			type: "confirm-edge";
			source: string;
			target: string;
			evidence?: string[];
			reason?: string;
			createdAt?: string;
	  }
	| {
			type: "edit-edge";
			source: string;
			target: string;
			relation: string[];
			label?: string;
			weight?: number;
			positivity?: number;
			evidence?: string[];
			reason?: string;
			createdAt?: string;
	  }
	| {
			type: "delete-edge";
			source: string;
			target: string;
			reason?: string;
			createdAt?: string;
	  }
	| {
			type: "delete-node";
			nodeId: string;
			reason?: string;
			createdAt?: string;
	  };

export const graphTypeLabels: Record<string, string> = {
	character: "人物",
	faction: "势力",
	location: "地点",
	unknown: "未知",
};

export const graphTypeColors: Record<string, string> = {
	character: "#2563eb",
	faction: "#dc2626",
	location: "#059669",
	unknown: "#64748b",
};

export const graphCommunityColors = [
	"#2563eb",
	"#dc2626",
	"#059669",
	"#d97706",
	"#7c3aed",
	"#0891b2",
	"#be123c",
	"#4b5563",
];

export const graphLayoutOptions: Array<{ id: RelationshipGraphLayout; label: string }> = [
	{ id: "force", label: "力导向" },
	{ id: "cluster", label: "社区" },
	{ id: "timeline", label: "时间线" },
];

export function resolveEdgeTone(
	edge: Pick<RelationshipGraphEdge, "label" | "tension" | "positivity">,
) {
	if (edge.positivity < -0.1) {
		return {
			color: "#dc2626",
			label: "冲突",
		};
	}
	if (edge.positivity > 0.1) {
		return {
			color: "#16a34a",
			label: "正向",
		};
	}
	const value = `${edge.label} ${edge.tension}`;
	if (/敌|压|冲突|仇|威胁|反击|对抗|破裂|背叛/.test(value)) {
		return {
			color: "#dc2626",
			label: "冲突",
		};
	}
	if (/师|友|盟|保护|依赖|暧昧|合作|支持|亲密|家人/.test(value)) {
		return {
			color: "#16a34a",
			label: "正向",
		};
	}
	if (/交易|试探|评价|观察|利用|信息|压力/.test(value)) {
		return {
			color: "#d97706",
			label: "博弈",
		};
	}
	return {
		color: "#64748b",
		label: "中性",
	};
}

export function sanitizeFilename(value: string) {
	return (
		value
			.trim()
			.replace(/[\\/:*?"<>|]/g, "-")
			.slice(0, 80) || "relationship-graph"
	);
}

function normalizeGraphNodeType(type: string) {
	return type === "character" || type === "faction" || type === "location" ? type : "unknown";
}

function uniqueTextList(values: Array<string | undefined>, limit = 12) {
	const seen = new Set<string>();
	const result: string[] = [];
	values.forEach((value) => {
		const text = value?.trim();
		if (!text || seen.has(text)) {
			return;
		}
		seen.add(text);
		result.push(text);
	});
	return result.slice(0, limit);
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
	if (!Number.isFinite(value)) {
		return fallback;
	}
	return Math.max(min, Math.min(max, value));
}

function buildGraphAliases(result: BookAnalysisResult) {
	const aliases = new Map<string, string>();
	const register = (value: string | undefined, id: string) => {
		const text = value?.trim();
		if (!text) {
			return;
		}
		if (!aliases.has(text)) {
			aliases.set(text, id);
		}
	};

	result.relationships.nodes.forEach((node) => {
		register(node.id, node.id);
		register(node.label, node.id);
		node.names?.forEach((name) => register(name, node.id));
	});
	result.characters.forEach((character) => {
		register(character.sourceName, character.sourceName);
		character.names?.forEach((name) => register(name, character.sourceName));
	});
	return aliases;
}

function resolveGraphCorrectionId(aliases: Map<string, string>, value: string) {
	return aliases.get(value) || value;
}

function sameGraphPair(
	left: Pick<BookAnalysisResult["relationships"]["edges"][number], "source" | "target">,
	right: Pick<BookAnalysisResult["relationships"]["edges"][number], "source" | "target">,
) {
	return (
		(left.source === right.source && left.target === right.target) ||
		(left.source === right.target && left.target === right.source)
	);
}

function mergeRelationshipEdges(
	edges: BookAnalysisResult["relationships"]["edges"],
	baseDuplicateMergeCount = 0,
) {
	const edgeMap = new Map<string, BookAnalysisResult["relationships"]["edges"][number]>();
	let duplicateMergeCount = baseDuplicateMergeCount;
	edges.forEach((edge) => {
		if (!edge.source || !edge.target || edge.source === edge.target) {
			return;
		}
		const [left, right] = [edge.source, edge.target].sort();
		const key = `${left}--${right}`;
		const existing = edgeMap.get(key);
		if (!existing) {
			edgeMap.set(key, {
				...edge,
				relation: uniqueTextList(edge.relation?.length ? edge.relation : [edge.label], 8),
				evidence: uniqueTextList(edge.evidence || [], 8),
			});
			return;
		}
		duplicateMergeCount += 1;
		const nextRelation = uniqueTextList(
			[...(existing.relation || []), ...(edge.relation || []), existing.label, edge.label],
			8,
		);
		const nextEvidence = uniqueTextList(
			[...(existing.evidence || []), ...(edge.evidence || [])],
			8,
		);
		const firstSeenChapter = Math.min(
			existing.firstSeenChapter || edge.firstSeenChapter || Number.POSITIVE_INFINITY,
			edge.firstSeenChapter || existing.firstSeenChapter || Number.POSITIVE_INFINITY,
		);
		edgeMap.set(key, {
			...existing,
			label: nextRelation[0] || existing.label || edge.label,
			tension: existing.tension || edge.tension,
			relation: nextRelation,
			weight: Math.max(existing.weight ?? 1, edge.weight ?? 1),
			positivity: clampNumber(
				((existing.positivity ?? 0) + (edge.positivity ?? 0)) / 2,
				-1,
				1,
				0,
			),
			evidence: nextEvidence,
			firstSeenChapter:
				firstSeenChapter === Number.POSITIVE_INFINITY ? undefined : firstSeenChapter,
			confidence: Math.max(existing.confidence ?? 0.7, edge.confidence ?? 0.7),
		});
	});
	return {
		edges: [...edgeMap.values()],
		duplicateMergeCount,
	};
}

function buildCorrectedGraphQuality(
	relationships: BookAnalysisResult["relationships"],
): NonNullable<BookAnalysisResult["relationshipGraphQuality"]> {
	const nodeDegree = new Map<string, number>();
	const nodeLabels = new Map(relationships.nodes.map((node) => [node.id, node.label]));
	relationships.nodes.forEach((node) => nodeDegree.set(node.id, 0));
	relationships.edges.forEach((edge) => {
		nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
		nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
	});

	const isolatedNodes = relationships.nodes
		.filter((node) => (nodeDegree.get(node.id) || 0) === 0)
		.map((node) => ({
			id: node.id,
			label: node.label,
			type: node.type || "unknown",
			suggestedQuery: node.label,
			reviewAction: "检索该节点名称，确认它是否应并入已有角色、势力或地点。",
		}));
	const weakEvidenceEdges = relationships.edges
		.map((edge) => {
			const evidenceCount = edge.evidence?.length || 0;
			const confidence = clampNumber(Number(edge.confidence ?? 0.7), 0, 1, 0.7);
			const reasons = [
				evidenceCount === 0 ? "缺少文本证据" : "",
				confidence < 0.55 ? "置信度偏低" : "",
			].filter(Boolean);
			if (!reasons.length) {
				return undefined;
			}
			const sourceLabel = nodeLabels.get(edge.source) || edge.source;
			const targetLabel = nodeLabels.get(edge.target) || edge.target;
			const label = edge.relation?.length
				? edge.relation.join("、")
				: edge.label || `${sourceLabel}->${targetLabel}`;
			return {
				source: edge.source,
				target: edge.target,
				sourceLabel,
				targetLabel,
				label,
				confidence,
				evidenceCount,
				reason: reasons.join("；"),
				suggestedQuery: [sourceLabel, targetLabel, label].filter(Boolean).join(" "),
				reviewAction: "检索双方名称和关系词，补充证据后再用于图谱学习。",
			};
		})
		.filter(Boolean) as NonNullable<
		BookAnalysisResult["relationshipGraphQuality"]
	>["weakEvidenceEdges"];

	const nodeCount = relationships.nodes.length;
	const edgeCount = relationships.edges.length;
	const averageConfidence =
		edgeCount > 0
			? Number(
					(
						relationships.edges.reduce(
							(sum, edge) =>
								sum + clampNumber(Number(edge.confidence ?? 0.7), 0, 1, 0.7),
							0,
						) / edgeCount
					).toFixed(2),
				)
			: 0;
	const evidenceCoverage =
		edgeCount > 0
			? Number(
					(
						relationships.edges.filter((edge) => edge.evidence?.length).length /
						edgeCount
					).toFixed(2),
				)
			: 0;
	const isolatedRatio = nodeCount > 0 ? isolatedNodes.length / nodeCount : 1;
	const weakEdgeRatio = edgeCount > 0 ? weakEvidenceEdges.length / edgeCount : 1;
	const riskLevel =
		edgeCount === 0 || nodeCount < 2 || weakEdgeRatio >= 0.7
			? "weak"
			: isolatedRatio > 0.45 || weakEdgeRatio > 0.35 || averageConfidence < 0.6
				? "needs-review"
				: "good";
	const recommendedFixes = [
		edgeCount === 0 ? "没有抽到关系边，建议补充更多章节或启用深拆后重跑。" : "",
		isolatedNodes.length
			? "存在孤立节点，建议检查角色别名、势力名和地点名是否被正确合并。"
			: "",
		weakEvidenceEdges.length
			? "部分关系缺少证据或置信度偏低，建议回到章节证据索引补证据后再用于仿写。"
			: "",
		(relationships.duplicateMergeCount || 0) > 0
			? "系统已合并重复关系，建议优先查看合并后的关系标签是否语义一致。"
			: "",
	].filter(Boolean);

	return {
		nodeCount,
		edgeCount,
		duplicateMergeCount: relationships.duplicateMergeCount || 0,
		isolatedNodes,
		weakEvidenceEdges,
		averageConfidence,
		evidenceCoverage,
		riskLevel,
		recommendedFixes,
	};
}

export function applyRelationshipGraphCorrections(
	result: BookAnalysisResult,
	corrections: RelationshipGraphCorrection[],
): BookAnalysisResult {
	if (!corrections.length) {
		return result;
	}

	const nodes = result.relationships.nodes.map((node) => ({
		...node,
		names: node.names ? [...node.names] : undefined,
	}));
	let edges = result.relationships.edges.map((edge) => ({
		...edge,
		relation: edge.relation ? [...edge.relation] : undefined,
		evidence: edge.evidence ? [...edge.evidence] : undefined,
	}));
	let duplicateMergeCount = result.relationships.duplicateMergeCount || 0;
	const initialAliases = buildGraphAliases(result);
	edges = edges.map((edge) => ({
		...edge,
		source: resolveGraphCorrectionId(initialAliases, edge.source),
		target: resolveGraphCorrectionId(initialAliases, edge.target),
	}));

	corrections.forEach((correction) => {
		const aliases = buildGraphAliases({
			...result,
			relationships: {
				...result.relationships,
				nodes,
				edges,
			},
		});
		if (correction.type === "merge-node") {
			const fromId = resolveGraphCorrectionId(aliases, correction.fromId);
			const toId = resolveGraphCorrectionId(aliases, correction.toId);
			if (!fromId || !toId || fromId === toId) {
				return;
			}
			const fromNode = nodes.find((node) => node.id === fromId);
			const toNode = nodes.find((node) => node.id === toId);
			if (!fromNode || !toNode) {
				return;
			}
			toNode.names = uniqueTextList([
				toNode.label,
				...(toNode.names || []),
				fromNode.label,
				...(fromNode.names || []),
			]);
			toNode.description = toNode.description || fromNode.description;
			toNode.portraitPrompt = toNode.portraitPrompt || fromNode.portraitPrompt;
			toNode.mainCharacter = Boolean(toNode.mainCharacter || fromNode.mainCharacter);
			edges = edges
				.map((edge) => ({
					...edge,
					source: edge.source === fromId ? toId : edge.source,
					target: edge.target === fromId ? toId : edge.target,
				}))
				.filter((edge) => edge.source !== edge.target);
			const fromIndex = nodes.findIndex((node) => node.id === fromId);
			if (fromIndex >= 0) {
				nodes.splice(fromIndex, 1);
			}
			duplicateMergeCount += 1;
			return;
		}

		if (correction.type === "delete-node") {
			const nodeId = resolveGraphCorrectionId(aliases, correction.nodeId);
			const index = nodes.findIndex((node) => node.id === nodeId);
			if (index >= 0) {
				nodes.splice(index, 1);
				edges = edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
			}
			return;
		}

		const pair = {
			source: resolveGraphCorrectionId(aliases, correction.source),
			target: resolveGraphCorrectionId(aliases, correction.target),
		};
		if (!pair.source || !pair.target || pair.source === pair.target) {
			return;
		}

		if (correction.type === "delete-edge") {
			edges = edges.filter((edge) => !sameGraphPair(edge, pair));
			return;
		}

		const existing = edges.find((edge) => sameGraphPair(edge, pair));
		if (correction.type === "confirm-edge") {
			const evidence = uniqueTextList([
				...(existing?.evidence || []),
				...(correction.evidence || []),
				correction.reason,
				"人工复核确认",
			]);
			if (existing) {
				existing.evidence = evidence;
				existing.confidence = 1;
				return;
			}
			edges.push({
				source: pair.source,
				target: pair.target,
				label: "确认关系",
				tension: "人工复核确认",
				relation: ["确认关系"],
				weight: 5,
				positivity: 0,
				evidence,
				confidence: 1,
			});
			return;
		}

		const relation = uniqueTextList(correction.relation, 8);
		if (existing) {
			existing.relation = relation;
			existing.label = correction.label?.trim() || relation[0] || existing.label;
			existing.weight = correction.weight ?? existing.weight;
			existing.positivity = correction.positivity ?? existing.positivity;
			existing.evidence = uniqueTextList([
				...(existing.evidence || []),
				...(correction.evidence || []),
			]);
			existing.confidence = Math.max(existing.confidence ?? 0.7, 0.8);
			return;
		}
		edges.push({
			source: pair.source,
			target: pair.target,
			label: correction.label?.trim() || relation[0] || "关系",
			tension: "人工修正",
			relation,
			weight: correction.weight ?? 5,
			positivity: correction.positivity ?? 0,
			evidence: uniqueTextList(correction.evidence || []),
			confidence: 0.8,
		});
	});

	const merged = mergeRelationshipEdges(edges, duplicateMergeCount);
	const relationships = {
		nodes,
		edges: merged.edges,
		duplicateMergeCount: merged.duplicateMergeCount,
	};
	return {
		...result,
		relationships,
		relationshipGraphQuality: buildCorrectedGraphQuality(relationships),
	};
}

function assignGraphCommunities(nodes: RelationshipGraphNode[], edges: RelationshipGraphEdge[]) {
	const adjacency = new Map<string, string[]>();
	nodes.forEach((node) => adjacency.set(node.id, []));
	edges.forEach((edge) => {
		adjacency.get(edge.source)?.push(edge.target);
		adjacency.get(edge.target)?.push(edge.source);
	});

	let community = 0;
	const visited = new Set<string>();
	nodes.forEach((node) => {
		if (visited.has(node.id)) {
			return;
		}
		const queue = [node.id];
		visited.add(node.id);
		const component: RelationshipGraphNode[] = [];
		while (queue.length) {
			const id = queue.shift()!;
			const current = nodes.find((item) => item.id === id);
			if (current) {
				component.push(current);
			}
			(adjacency.get(id) || []).forEach((next) => {
				if (!visited.has(next)) {
					visited.add(next);
					queue.push(next);
				}
			});
		}
		component.forEach((item) => {
			item.community = community;
		});
		community += 1;
	});
}

function positionGraphNodes(
	nodes: RelationshipGraphNode[],
	edges: RelationshipGraphEdge[],
	layout: RelationshipGraphLayout,
) {
	const centerX = 480;
	const centerY = 280;
	const maxNodes = Math.max(nodes.length, 1);

	if (layout === "timeline") {
		const chapters = edges
			.map((edge) => edge.firstSeenChapter)
			.filter((chapter): chapter is number => typeof chapter === "number" && chapter > 0);
		const minChapter = chapters.length ? Math.min(...chapters) : 1;
		const maxChapter = chapters.length ? Math.max(...chapters) : 1;
		const chapterSpan = Math.max(maxChapter - minChapter, 1);
		nodes.forEach((node, index) => {
			const firstChapter =
				edges
					.filter((edge) => edge.source === node.id || edge.target === node.id)
					.map((edge) => edge.firstSeenChapter)
					.filter(
						(chapter): chapter is number => typeof chapter === "number" && chapter > 0,
					)
					.sort((left, right) => left - right)[0] || minChapter;
			const typeBand = node.type === "character" ? 0 : node.type === "faction" ? 1 : 2;
			node.x = 120 + ((firstChapter - minChapter) / chapterSpan) * 720;
			node.y = 135 + typeBand * 135 + (index % 3) * 22;
		});
		return;
	}

	if (layout === "cluster") {
		const communityIds = [...new Set(nodes.map((node) => node.community))].sort(
			(left, right) => left - right,
		);
		const centers = new Map<number, { x: number; y: number }>();
		communityIds.forEach((community, index) => {
			const angle = (index / Math.max(communityIds.length, 1)) * Math.PI * 2 - Math.PI / 2;
			centers.set(community, {
				x: centerX + Math.cos(angle) * (communityIds.length > 1 ? 210 : 0),
				y: centerY + Math.sin(angle) * (communityIds.length > 1 ? 150 : 0),
			});
		});
		const grouped = new Map<number, RelationshipGraphNode[]>();
		nodes.forEach((node) => {
			grouped.set(node.community, [...(grouped.get(node.community) || []), node]);
		});
		grouped.forEach((items, community) => {
			const center = centers.get(community) || { x: centerX, y: centerY };
			items.forEach((node, index) => {
				if (items.length === 1) {
					node.x = center.x;
					node.y = center.y;
					return;
				}
				const radius = Math.min(118, 52 + items.length * 8);
				const angle = (index / items.length) * Math.PI * 2 - Math.PI / 2;
				node.x = center.x + Math.cos(angle) * radius;
				node.y = center.y + Math.sin(angle) * radius;
			});
		});
		return;
	}

	nodes.forEach((node, index) => {
		const angle = (index / maxNodes) * Math.PI * 2 - Math.PI / 2;
		const radius = node.degree > 1 ? 160 : 230;
		node.x = centerX + Math.cos(angle) * radius;
		node.y = centerY + Math.sin(angle) * radius;
	});

	for (let step = 0; step < 90; step += 1) {
		const deltas = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]));
		for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
				const left = nodes[leftIndex];
				const right = nodes[rightIndex];
				const dx = left.x - right.x || 0.01;
				const dy = left.y - right.y || 0.01;
				const distanceSq = Math.max(dx * dx + dy * dy, 100);
				const force = 1800 / distanceSq;
				const distance = Math.sqrt(distanceSq);
				deltas.get(left.id)!.x += (dx / distance) * force;
				deltas.get(left.id)!.y += (dy / distance) * force;
				deltas.get(right.id)!.x -= (dx / distance) * force;
				deltas.get(right.id)!.y -= (dy / distance) * force;
			}
		}
		edges.forEach((edge) => {
			const source = edge.sourceNode;
			const target = edge.targetNode;
			const dx = target.x - source.x;
			const dy = target.y - source.y;
			const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
			const preferred = 220 - Math.min(edge.weight, 10) * 12;
			const force = (distance - preferred) * 0.012;
			deltas.get(source.id)!.x += (dx / distance) * force;
			deltas.get(source.id)!.y += (dy / distance) * force;
			deltas.get(target.id)!.x -= (dx / distance) * force;
			deltas.get(target.id)!.y -= (dy / distance) * force;
		});
		nodes.forEach((node) => {
			const delta = deltas.get(node.id)!;
			node.x = Math.max(65, Math.min(895, node.x + delta.x + (centerX - node.x) * 0.01));
			node.y = Math.max(65, Math.min(495, node.y + delta.y + (centerY - node.y) * 0.01));
		});
	}
}

export function buildRelationshipGraph(
	result: BookAnalysisResult,
	layout: RelationshipGraphLayout,
) {
	const nodeByKey = new Map<string, RelationshipGraphNode>();
	const keyAliases = new Map<string, string>();

	function addNode(raw: {
		id?: string;
		label?: string;
		type?: string;
		names?: string[];
		mainCharacter?: boolean;
		description?: string;
		portraitPrompt?: string;
	}) {
		const preferredId = raw.id?.trim() || raw.label?.trim();
		const label = raw.label?.trim() || preferredId || `节点 ${nodeByKey.size + 1}`;
		const id =
			keyAliases.get(label) ||
			(preferredId ? keyAliases.get(preferredId) : undefined) ||
			preferredId ||
			`node-${nodeByKey.size + 1}`;
		const type = normalizeGraphNodeType(raw.type || "unknown");
		const existing = nodeByKey.get(id);
		nodeByKey.set(id, {
			id,
			label: existing?.label || label,
			type: existing?.type || type,
			names: [...(existing?.names || []), ...(raw.names || []), label].filter(
				(name, index, list) => name && list.indexOf(name) === index,
			),
			mainCharacter: existing?.mainCharacter || Boolean(raw.mainCharacter),
			description: existing?.description || raw.description || "",
			portraitPrompt: existing?.portraitPrompt || raw.portraitPrompt || "",
			community: existing?.community ?? 0,
			degree: existing?.degree || 0,
			x: existing?.x || 0,
			y: existing?.y || 0,
		});
		keyAliases.set(id, id);
		keyAliases.set(label, id);
		raw.names?.forEach((name) => keyAliases.set(name, id));
		return nodeByKey.get(id)!;
	}

	result.relationships.nodes.forEach(addNode);
	result.characters.forEach((character) => {
		addNode({
			id: character.sourceName,
			label: character.sourceName,
			type: "character",
			names: character.names,
			mainCharacter: character.mainCharacter,
			description: character.relationshipFunction,
			portraitPrompt: character.portraitPrompt,
		});
	});

	const edges: RelationshipGraphEdge[] = result.relationships.edges.map((edge, index) => {
		const sourceId = keyAliases.get(edge.source) || edge.source;
		const targetId = keyAliases.get(edge.target) || edge.target;
		const sourceNode =
			nodeByKey.get(sourceId) ||
			addNode({ id: sourceId, label: edge.source, type: "unknown" });
		const targetNode =
			nodeByKey.get(targetId) ||
			addNode({ id: targetId, label: edge.target, type: "unknown" });
		sourceNode.degree += 1;
		targetNode.degree += 1;
		return {
			id: `edge-${index}`,
			source: sourceNode.id,
			target: targetNode.id,
			label: edge.label,
			tension: edge.tension,
			relation: edge.relation?.length ? edge.relation : [edge.label].filter(Boolean),
			weight: edge.weight ?? 1,
			positivity: edge.positivity ?? 0,
			evidence: edge.evidence ?? [],
			firstSeenChapter: edge.firstSeenChapter,
			confidence: edge.confidence,
			sourceNode,
			targetNode,
		};
	});

	const nodes = [...nodeByKey.values()].sort((left, right) => {
		const degreeDelta = right.degree - left.degree;
		return degreeDelta || left.label.localeCompare(right.label);
	});
	assignGraphCommunities(nodes, edges);
	positionGraphNodes(nodes, edges, layout);
	const communities = [...new Set(nodes.map((node) => node.community))]
		.sort((left, right) => left - right)
		.map((community) => {
			const members = nodes.filter((node) => node.community === community);
			const lead = [...members].sort((left, right) => right.degree - left.degree)[0];
			return {
				id: community,
				label: lead?.label || `社区 ${community + 1}`,
				size: members.length,
				color: graphCommunityColors[community % graphCommunityColors.length],
			};
		});

	return { nodes, edges, communities };
}

export function buildRelationshipGraphExport(
	result: BookAnalysisResult,
	graph: ReturnType<typeof buildRelationshipGraph>,
	corrections: RelationshipGraphCorrection[] = [],
) {
	return {
		schemaVersion: "ai-novel-diagnosis.relationship-graph.v1",
		book: {
			title: result.book.title,
			genre: result.book.genre,
		},
		nodes: graph.nodes.map((node) => ({
			id: node.id,
			label: node.label,
			type: node.type,
			names: node.names,
			mainCharacter: node.mainCharacter,
			description: node.description,
			portraitPrompt: node.portraitPrompt,
			degree: node.degree,
			community: node.community,
			x: Math.round(node.x),
			y: Math.round(node.y),
		})),
		edges: graph.edges.map((edge) => ({
			source: edge.source,
			target: edge.target,
			label: edge.label,
			relation: edge.relation,
			weight: edge.weight,
			positivity: edge.positivity,
			tension: edge.tension,
			evidence: edge.evidence,
			firstSeenChapter: edge.firstSeenChapter,
			confidence: edge.confidence,
		})),
		communities: graph.communities,
		timeline: graph.edges
			.filter((edge) => edge.firstSeenChapter)
			.sort((left, right) => (left.firstSeenChapter || 0) - (right.firstSeenChapter || 0))
			.map((edge) => ({
				chapter: edge.firstSeenChapter,
				source: edge.sourceNode.label,
				target: edge.targetNode.label,
				relation: edge.relation,
				weight: edge.weight,
				positivity: edge.positivity,
			})),
		quality: result.relationshipGraphQuality,
		corrections,
	};
}

export function buildRelationshipGraphVersions(graph: ReturnType<typeof buildRelationshipGraph>) {
	const chapterGroups = new Map<number, RelationshipGraphEdge[]>();
	graph.edges.forEach((edge) => {
		const chapter = edge.firstSeenChapter || 0;
		chapterGroups.set(chapter, [...(chapterGroups.get(chapter) || []), edge]);
	});
	const sortedChapters = [...chapterGroups.keys()].sort((left, right) => left - right);
	let cumulativeEdges = 0;
	const activeNodes = new Set<string>();
	return sortedChapters.map((chapter, index) => {
		const edges = chapterGroups.get(chapter) || [];
		cumulativeEdges += edges.length;
		edges.forEach((edge) => {
			activeNodes.add(edge.source);
			activeNodes.add(edge.target);
		});
		return {
			id: `graph-version-${index}`,
			label: chapter > 0 ? `第 ${chapter} 章` : "章节未知",
			newEdges: edges.length,
			totalEdges: cumulativeEdges,
			totalNodes: activeNodes.size,
			strongestEdge: [...edges].sort((left, right) => right.weight - left.weight)[0],
		};
	});
}
