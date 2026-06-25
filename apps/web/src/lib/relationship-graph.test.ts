import { describe, expect, it } from "vitest";
import type { BookAnalysisResult } from "@/stores/workspace-store";
import {
	applyRelationshipGraphCorrections,
	buildRelationshipGraph,
	buildRelationshipGraphExport,
	buildRelationshipGraphVersions,
	resolveEdgeTone,
	sanitizeFilename,
} from "./relationship-graph";

const result = {
	mode: "book-map-reduce-analysis",
	book: {
		title: "测试/书名",
		genre: "xuanhuan",
		chapterCountEstimate: 12,
		oneSentencePremise: "主角在公开压迫后反击。",
		coreAppeal: ["压迫反击"],
	},
	characters: [
		{
			sourceName: "阿青",
			role: "主角",
			archetype: "隐忍反击者",
			personalityCore: ["克制"],
			desire: "查明旧案",
			fearOrWound: "被误判",
			capability: "洞察",
			relationshipFunction: "承载压迫和反击",
			names: ["青少爷"],
			mainCharacter: true,
			portraitPrompt: "restrained young fighter",
			originalCharacterCard: {
				namePlaceholder: "原创主角",
				summary: "主角摘要",
				personality: "克制",
				scenario: "公开考核",
				firstMessage: "我会查清楚。",
				doNotCopy: ["原名"],
			},
		},
		{
			sourceName: "评审长",
			role: "反派",
			archetype: "制度压迫者",
			personalityCore: ["冷酷"],
			desire: "维持秩序",
			fearOrWound: "失控",
			capability: "裁决",
			relationshipFunction: "制造制度压力",
			originalCharacterCard: {
				namePlaceholder: "原创评审",
				summary: "反派摘要",
				personality: "冷酷",
				scenario: "公开考核",
				firstMessage: "规则如此。",
				doNotCopy: ["原名"],
			},
		},
	],
	worldbuilding: {
		worldRules: [],
		powerSystem: [],
		locations: [],
		factions: [],
		itemsAndTerms: [],
	},
	relationships: {
		nodes: [
			{
				id: "c1",
				label: "阿青",
				type: "character",
				names: ["青少爷"],
				mainCharacter: true,
				description: "主线角色",
				portraitPrompt: "graph portrait",
			},
			{
				id: "c2",
				label: "评审长",
				type: "character",
				names: ["评审"],
				description: "压迫角色",
			},
			{
				id: "f1",
				label: "商会",
				type: "faction",
				names: ["商会"],
				description: "孤立势力",
			},
		],
		edges: [
			{
				source: "青少爷",
				target: "评审长",
				label: "压迫",
				tension: "公开压迫",
				relation: ["压迫", "反击"],
				weight: 8,
				positivity: -0.7,
				evidence: ["公开否定资格"],
				firstSeenChapter: 2,
				confidence: 0.9,
			},
		],
	},
	plotlines: [],
	chronicle: [],
	historyBook: {
		ancientHistory: [],
		recentHistory: [],
		publicMyths: [],
		hiddenTruths: [],
	},
	exportPackage: {
		tavernCharacterCards: [],
		worldBookEntries: [],
		writingConstraints: [],
		doNotCopyList: [],
	},
	originalizationReport: {
		riskLevel: "low",
		safeToLearn: [],
		mustTransform: [],
		fanFictionWarning: "",
		rewriteStrategy: [],
	},
} as BookAnalysisResult;

describe("relationship graph helpers", () => {
	it("builds a graph with alias resolution, communities, and portrait prompts", () => {
		const graph = buildRelationshipGraph(result, "cluster");

		expect(graph.edges).toHaveLength(1);
		expect(graph.edges[0].sourceNode.label).toBe("阿青");
		expect(graph.edges[0].targetNode.label).toBe("评审长");
		expect(graph.nodes.find((node) => node.label === "阿青")?.portraitPrompt).toBe(
			"graph portrait",
		);
		expect(graph.communities.length).toBe(2);
	});

	it("builds timeline versions and export payloads", () => {
		const graph = buildRelationshipGraph(result, "timeline");
		const versions = buildRelationshipGraphVersions(graph);
		const exported = buildRelationshipGraphExport(result, graph);

		expect(versions[0]).toEqual(
			expect.objectContaining({
				label: "第 2 章",
				newEdges: 1,
				totalEdges: 1,
				totalNodes: 2,
			}),
		);
		expect(exported.schemaVersion).toBe("ai-novel-diagnosis.relationship-graph.v1");
		expect(exported.timeline[0]).toEqual(
			expect.objectContaining({
				chapter: 2,
				source: "阿青",
				target: "评审长",
			}),
		);
	});

	it("resolves tones and safe export filenames", () => {
		expect(resolveEdgeTone({ label: "压迫", tension: "冲突", positivity: -0.6 }).label).toBe(
			"冲突",
		);
		expect(sanitizeFilename("测试/书名:*?")).toBe("测试-书名---");
	});

	it("applies review corrections and refreshes graph quality", () => {
		const weakResult = {
			...result,
			relationships: {
				...result.relationships,
				edges: [
					{
						source: "青少爷",
						target: "评审长",
						label: "疑似压迫",
						tension: "待确认",
						relation: ["疑似压迫"],
						weight: 4,
						positivity: -0.2,
						confidence: 0.4,
					},
				],
			},
			relationshipGraphQuality: undefined,
		} as BookAnalysisResult;

		const corrected = applyRelationshipGraphCorrections(weakResult, [
			{
				type: "confirm-edge",
				source: "青少爷",
				target: "评审长",
				evidence: ["人工确认公开否定资格"],
			},
			{
				type: "delete-node",
				nodeId: "f1",
				reason: "不是有效关系节点",
			},
		]);

		expect(corrected.relationships.edges[0]).toEqual(
			expect.objectContaining({
				confidence: 1,
				evidence: expect.arrayContaining(["人工确认公开否定资格"]),
			}),
		);
		expect(corrected.relationships.nodes.find((node) => node.id === "f1")).toBeUndefined();
		expect(corrected.relationshipGraphQuality).toEqual(
			expect.objectContaining({
				weakEvidenceEdges: [],
				isolatedNodes: [],
				riskLevel: "good",
			}),
		);
	});

	it("merges duplicate nodes and exports correction records", () => {
		const corrected = applyRelationshipGraphCorrections(result, [
			{
				type: "merge-node",
				fromId: "f1",
				toId: "c2",
				reason: "商会在样例中并入评审阵营",
			},
			{
				type: "edit-edge",
				source: "青少爷",
				target: "评审长",
				label: "公开压迫/反击",
				relation: ["公开压迫", "反击"],
			},
		]);
		const graph = buildRelationshipGraph(corrected, "cluster");
		const exported = buildRelationshipGraphExport(corrected, graph, [
			{ type: "merge-node", fromId: "f1", toId: "c2" },
		]);

		expect(corrected.relationships.nodes.find((node) => node.id === "f1")).toBeUndefined();
		expect(corrected.relationships.nodes.find((node) => node.id === "c2")?.names).toEqual(
			expect.arrayContaining(["商会"]),
		);
		expect(corrected.relationships.edges[0].relation).toEqual(
			expect.arrayContaining(["公开压迫", "反击"]),
		);
		expect(exported.corrections).toHaveLength(1);
	});
});
