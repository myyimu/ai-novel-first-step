import { describe, expect, it } from "vitest";
import {
	buildBeginnerLearningDigest,
	buildComparisonSamples,
	buildResearchGraph,
	buildScoreEvidenceChain,
} from "./research-library";

const book = {
	book: {
		title: "样本书",
		genre: "xuanhuan",
		coreAppeal: ["废柴逆袭", "旧案悬念", "公开打脸"],
	},
	characters: [
		{
			sourceName: "主角",
			role: "protagonist",
			archetype: "隐忍反击者",
			desire: "查明旧案",
			relationshipFunction: "承载压迫和反击",
		},
	],
	worldbuilding: {
		locations: [{ name: "考核场", function: "公开压迫场景", originalizationNote: "需改名" }],
		factions: [
			{
				name: "评审会",
				goal: "控制资格",
				conflictRole: "制度化反派",
				originalizationNote: "需重写组织规则",
			},
		],
	},
	relationships: {
		edges: [{ source: "主角", target: "评审会", label: "压迫", tension: "资格被剥夺" }],
	},
	chronicle: [
		{ order: 1, event: "主角被否定", impact: "制造反击期待", storyFunction: "开局钩子" },
	],
	writingSupport: {
		foreshadowingLedger: [
			{
				setup: "旧案信物",
				setupChapter: 1,
				payoff: "引出主线秘密",
				status: "open",
				risk: "可识别",
			},
		],
		readerPromiseChecklist: [
			{
				promise: "公开羞辱后反击",
				evidence: "开局被否定",
				status: "active",
				nextCheck: "前三章兑现",
			},
		],
		emotionalBeatMap: [
			{
				chapterOrder: 1,
				beats: ["压抑", "期待反击"],
				intensity: "high",
				readerPromise: "证明自己",
			},
		],
		chapterFunctionTable: [
			{
				chapterOrder: 1,
				title: "第一章",
				function: "开局承诺",
				goal: "保住资格",
				conflict: "被剥夺",
				hook: "旧案信物",
			},
		],
	},
};

describe("research-library helpers", () => {
	it("builds graph nodes and edges from book assets", () => {
		const graph = buildResearchGraph(book);

		expect(graph.nodes.length).toBeGreaterThanOrEqual(5);
		expect(graph.edges).toHaveLength(1);
		expect(graph.summary).toContain("图谱节点");
	});

	it("turns scoring output into explainable evidence chain", () => {
		const chain = buildScoreEvidenceChain({
			scores: [
				{
					metricId: "hook",
					name: "追读钩子",
					score: 4,
					reason: "结尾自然收束",
					evidence: "没有新增危机",
					fix: "增加身份暴露风险",
				},
			],
		});

		expect(chain.weakest?.metricName).toBe("追读钩子");
		expect(chain.items[0].level).toBe("weak");
	});

	it("keeps beginner mode compressed to three learnable rules", () => {
		const digest = buildBeginnerLearningDigest(book);

		expect(digest.mode).toBe("book-derived");
		expect(digest.rules).toHaveLength(3);
		expect(digest.rules[0].title).toContain("核心卖点");
	});

	it("requires at least two samples for comparison readiness", () => {
		const comparison = buildComparisonSamples(null, [
			{
				id: "job-a",
				status: "succeeded",
				inputSummary: { title: "样本书", genre: "xuanhuan" },
				result: book,
			},
		]);

		expect(comparison.readiness).toBe("样本不足");
		expect(comparison.blockers[0]).toContain("至少需要 2 本");
	});
});
