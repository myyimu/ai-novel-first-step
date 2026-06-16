export interface ResearchGraphNode {
	id: string;
	label: string;
	type: "character" | "location" | "faction" | "event" | "foreshadowing" | "promise";
	source: string;
	detail: string;
	risk?: string;
}

export interface ResearchGraphEdge {
	id: string;
	source: string;
	target: string;
	label: string;
	detail: string;
}

export interface ScoreEvidenceItem {
	id: string;
	metricName: string;
	score: number;
	level: "strong" | "watch" | "weak";
	evidence: string;
	reason: string;
	fix: string;
	promptConstraint: string;
}

export interface ComparisonSample {
	id: string;
	title: string;
	genre: string;
	status: string;
	coreAppeal: string[];
	availableSignals: string[];
}

export type BookAnalysisLike = {
	book: {
		title: string;
		genre: string;
		coreAppeal: string[];
	};
	characters: Array<{
		sourceName: string;
		role: string;
		archetype: string;
		desire: string;
		relationshipFunction: string;
	}>;
	worldbuilding: {
		locations: Array<{ name: string; function: string; originalizationNote: string }>;
		factions: Array<{
			name: string;
			goal: string;
			conflictRole: string;
			originalizationNote: string;
		}>;
	};
	relationships: {
		edges: Array<{ source: string; target: string; label: string; tension: string }>;
	};
	chronicle: Array<{
		order: number;
		event: string;
		impact: string;
		storyFunction: string;
	}>;
	writingSupport?: {
		chapterFunctionTable?: Array<{
			chapterOrder: number;
			title: string;
			function: string;
			goal: string;
			conflict: string;
			hook: string;
		}>;
		foreshadowingLedger: Array<{
			setup: string;
			setupChapter: number;
			payoff: string;
			status: string;
			risk: string;
		}>;
		emotionalBeatMap?: Array<{
			chapterOrder: number;
			beats: string[];
			intensity: string;
			readerPromise: string;
		}>;
		readerPromiseChecklist: Array<{
			promise: string;
			evidence: string;
			status: string;
			nextCheck: string;
		}>;
	};
};

export interface BeginnerLearningRule {
	title: string;
	explanation: string;
	source: string;
	apply: string;
}

type ScoreResultLike = {
	scores: Array<{
		metricId: string;
		name: string;
		score: number;
		reason: string;
		evidence: string;
		fix: string;
	}>;
	revisionPrompt?: {
		prompt: string;
	};
};

type BookJobLike = {
	id: string;
	status: string;
	inputSummary: {
		title: string;
		genre: string;
	};
	result?: BookAnalysisLike;
};

function normalizeId(value: string) {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w\u4e00-\u9fa5-]/g, "");
}

function evidenceLevel(score: number): ScoreEvidenceItem["level"] {
	if (score >= 7.5) {
		return "strong";
	}
	if (score >= 5) {
		return "watch";
	}
	return "weak";
}

export function buildResearchGraph(result?: BookAnalysisLike | null) {
	if (!result) {
		return {
			nodes: [] as ResearchGraphNode[],
			edges: [] as ResearchGraphEdge[],
			summary: "尚未完成整书拆解，无法生成可追溯图谱资产。",
		};
	}

	const nodes: ResearchGraphNode[] = [
		...result.characters.map((character) => ({
			id: `character-${normalizeId(character.sourceName)}`,
			label: character.sourceName,
			type: "character" as const,
			source: "人物卡",
			detail: `${character.archetype}；欲望：${character.desire}；关系功能：${character.relationshipFunction}`,
		})),
		...result.worldbuilding.locations.map((location) => ({
			id: `location-${normalizeId(location.name)}`,
			label: location.name,
			type: "location" as const,
			source: "世界观设计",
			detail: location.function,
			risk: location.originalizationNote,
		})),
		...result.worldbuilding.factions.map((faction) => ({
			id: `faction-${normalizeId(faction.name)}`,
			label: faction.name,
			type: "faction" as const,
			source: "势力设定",
			detail: `${faction.goal}；冲突功能：${faction.conflictRole}`,
			risk: faction.originalizationNote,
		})),
		...result.chronicle.map((event) => ({
			id: `event-${event.order}`,
			label: `事件 ${event.order}`,
			type: "event" as const,
			source: "大事纪",
			detail: `${event.event}；功能：${event.storyFunction}；影响：${event.impact}`,
		})),
		...(result.writingSupport?.foreshadowingLedger ?? []).map((item, index) => ({
			id: `foreshadowing-${item.setupChapter}-${index}`,
			label: `第 ${item.setupChapter} 章伏笔`,
			type: "foreshadowing" as const,
			source: "伏笔与回收表",
			detail: `${item.setup} -> ${item.payoff}；状态：${item.status}`,
			risk: item.risk,
		})),
		...(result.writingSupport?.readerPromiseChecklist ?? []).map((item, index) => ({
			id: `promise-${index}`,
			label: item.promise,
			type: "promise" as const,
			source: "读者承诺表",
			detail: `${item.evidence}；状态：${item.status}；下一次检查：${item.nextCheck}`,
		})),
	];

	const edges: ResearchGraphEdge[] = result.relationships.edges.map((edge, index) => ({
		id: `relationship-${index}`,
		source: edge.source,
		target: edge.target,
		label: edge.label,
		detail: edge.tension,
	}));

	return {
		nodes,
		edges,
		summary: `${nodes.length} 个图谱节点，${edges.length} 条人物关系边，已绑定来源类型。`,
	};
}

export function buildScoreEvidenceChain(result?: ScoreResultLike | null) {
	if (!result) {
		return {
			items: [] as ScoreEvidenceItem[],
			summary: "尚未完成评分，无法形成证据链。",
			weakest: undefined as ScoreEvidenceItem | undefined,
		};
	}

	const items = result.scores.map((score) => ({
		id: score.metricId,
		metricName: score.name,
		score: score.score,
		level: evidenceLevel(score.score),
		evidence: score.evidence || "未返回原文证据",
		reason: score.reason,
		fix: score.fix,
		promptConstraint: `围绕「${score.name}」执行：${score.fix}`,
	}));
	const weakest = [...items].sort((left, right) => left.score - right.score)[0];

	return {
		items,
		weakest,
		summary: `${items.length} 个评分指标已转成证据链，最低项是「${weakest?.metricName ?? "无"}」。`,
	};
}

export function buildComparisonSamples(
	currentResult?: BookAnalysisLike | null,
	history: BookJobLike[] = [],
) {
	const currentSample: ComparisonSample[] = currentResult
		? [
				{
					id: "current",
					title: currentResult.book.title,
					genre: currentResult.book.genre,
					status: "当前结果",
					coreAppeal: currentResult.book.coreAppeal,
					availableSignals: ["人物关系", "事件链", "读者承诺", "伏笔回收", "情绪节奏"],
				},
			]
		: [];
	const historySamples = history
		.filter((job) => job.status === "succeeded" && job.result)
		.map((job) => ({
			id: job.id,
			title: job.result?.book.title || job.inputSummary.title,
			genre: job.result?.book.genre || job.inputSummary.genre,
			status: "历史样本",
			coreAppeal: job.result?.book.coreAppeal || [],
			availableSignals: ["人物关系", "事件链", "读者承诺", "伏笔回收", "情绪节奏"],
		}));
	const samples = [...currentSample, ...historySamples];
	const readiness =
		samples.length >= 5
			? "适合归纳赛道规律"
			: samples.length >= 2
				? "可以做初步横向对比"
				: "样本不足";
	const blockers =
		samples.length >= 2 ? [] : ["至少需要 2 本已拆解样本，才能比较共同规律和差异化机会。"];

	return {
		samples,
		readiness,
		blockers,
		summary: `${samples.length} 本可用样本；${readiness}。`,
	};
}

export function buildResearchPromptSeed(
	graph: ReturnType<typeof buildResearchGraph>,
	evidence: ReturnType<typeof buildScoreEvidenceChain>,
	comparison: ReturnType<typeof buildComparisonSamples>,
) {
	const graphFocus = graph.nodes
		.slice(0, 5)
		.map((node) => `${node.label}（${node.type}）：${node.detail}`)
		.join("\n");
	const weakFocus = evidence.items
		.filter((item) => item.level === "weak")
		.slice(0, 3)
		.map((item) => `${item.metricName} ${item.score}/10：${item.fix}`)
		.join("\n");
	const sampleFocus = comparison.samples
		.slice(0, 5)
		.map((sample) => `${sample.title}：${sample.coreAppeal.join("、") || "待归纳"}`)
		.join("\n");

	return `
你是小说选题与提示词产品经理。请基于下列可追溯资料，输出“值得让 AI 写什么”的创作判断，而不是直接代写正文。

图谱线索：
${graphFocus || "暂无图谱线索"}

评分短板：
${weakFocus || "暂无明确短板"}

对比样本：
${sampleFocus || "暂无对比样本"}

请输出：
1. 当前资料反映出的核心卖点。
2. 同质化风险。
3. 可偏离平均值的重组方向。
4. 第一条写作提示词应锁定的受众、情绪、题材组合和禁区。
`.trim();
}

export function buildBeginnerLearningDigest(result?: BookAnalysisLike | null) {
	const fallbackRules: BeginnerLearningRule[] = [
		{
			title: "爆款不是文笔平均分高，而是承诺清楚",
			explanation:
				"新手先看一本书承诺了什么情绪回报：爽、怕、甜、虐、悬疑、成长，而不是先学句子怎么写。",
			source: "新手模式默认规律",
			apply: "拆书时先写出一句话：这本书让读者持续期待什么。",
		},
		{
			title: "偏离平均值才有记忆点",
			explanation: "AI 默认会生成高频组合，新人要学的是爆款如何把常见元素重组出新鲜感。",
			source: "新手模式默认规律",
			apply: "每次拆书记录“常见元素”和“反常组合”各 1 条。",
		},
		{
			title: "每章都要增加一个继续读的理由",
			explanation: "好网文不是信息堆叠，而是持续给读者新问题、新压力、新奖励或新关系变化。",
			source: "新手模式默认规律",
			apply: "拆前三章时只问：这一章新增了什么必须继续看的理由。",
		},
	];

	if (!result) {
		return {
			mode: "beginner-default",
			title: "还没有拆解样本",
			summary: "先上传一本你有权分析的成熟样本，系统会把长报告压缩成 3 条关键规律。",
			rules: fallbackRules,
		};
	}

	const coreAppeal = result.book.coreAppeal?.filter(Boolean) || [];
	const emotionalBeats = result.writingSupport?.emotionalBeatMap?.flatMap((item) => item.beats);
	const foreshadowing = result.writingSupport?.foreshadowingLedger || [];
	const chapterFunctions = result.writingSupport?.chapterFunctionTable || [];
	const readerPromises = result.writingSupport?.readerPromiseChecklist || [];
	const rules: BeginnerLearningRule[] = [
		{
			title: coreAppeal.length
				? `核心卖点集中在：${coreAppeal.slice(0, 3).join(" + ")}`
				: "先识别核心卖点，而不是先看文笔",
			explanation:
				"新人最容易只看文字好不好，其实第一步要看这本书用什么卖点让读者点开并留下。",
			source: `${result.book.title} · coreAppeal`,
			apply: "把你的新书方向写成 1 个主卖点 + 2 个辅助卖点，不要超过 3 个。",
		},
		{
			title: emotionalBeats?.length
				? `情绪不是单点爆发，而是持续出现：${emotionalBeats.slice(0, 3).join("、")}`
				: "爆款会持续管理读者情绪",
			explanation:
				"不要只问这一章发生了什么，要问这一章让读者产生了什么情绪，并且这个情绪是否会延续到下一章。",
			source: `${result.book.title} · emotionalBeatMap`,
			apply: "写第一条提示词时明确主情绪：爽感、压迫、心疼、好奇或关系拉扯。",
		},
		{
			title: foreshadowing.length
				? `追读来自未完成期待：已有 ${foreshadowing.length} 条伏笔/回收线`
				: chapterFunctions.length
					? `每章承担明确功能：已识别 ${chapterFunctions.length} 个章节功能`
					: "好故事会留下未完成期待",
			explanation: "爆款不是把信息一次说完，而是控制真相、身份、关系和奖励的释放节奏。",
			source: `${result.book.title} · writingSupport`,
			apply: readerPromises.length
				? `先复用这个读者承诺：${readerPromises[0].promise}`
				: "给第一章结尾设计一个还没兑现的承诺，而不是自然收尾。",
		},
	];

	return {
		mode: "book-derived",
		title: result.book.title,
		summary: `从《${result.book.title}》压缩出 3 条新手应该先记住的规律。`,
		rules,
	};
}
