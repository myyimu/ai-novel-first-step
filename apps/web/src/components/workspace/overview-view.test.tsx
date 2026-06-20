import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OverviewView } from "./overview-view";

const baseProps = {
	nextAction: {
		title: "先校准市场定位",
		description: "先校准分类、主题、标签和读者期待。",
		actionLabel: "去 AI 识别定位",
		view: "chapter",
		secondaryLabel: "AI 设置",
		secondaryView: "provider",
	},
	providerKind: "mock" as const,
	providerLabel: "本地演示",
	providerModel: "",
	quickLoading: false,
	quickElapsedSeconds: 0,
	quickReviewResult: null,
	quickReviewGenre: "",
	chapterText: "",
	chapterCompletion: 50,
	nextChapterAction: "生成评分标准",
	referenceTitle: "成熟样本",
	scoreResult: null,
	bookStatus: "未启动",
	bookStatusText: "未启动整书拆解",
	researchReadiness: 25,
	researchSourceCount: 1,
	graphNodeCount: 0,
	chapterProjectSteps: [
		{ label: "平台和策略画像", done: true, detail: "番茄 · 男频 · 长篇追更" },
		{ label: "评分标准", done: false, detail: "尚未生成评分标准。" },
	],
	platformLabel: "番茄小说",
	readingModeLabel: "长篇追更",
	competitionLevelLabel: "红海赛道",
	pushStageLabel: "冷启动",
	competitionNotes: "先做差异化卖点。",
	bookTitle: "示例长篇小说",
	bookCompletion: 0,
	onChapterTextChange: vi.fn(),
	onQuickReviewGenreChange: vi.fn(),
	onRunQuickExperience: vi.fn(),
	onRerunQuickExperience: vi.fn(),
	hasQuickReviewCache: false,
	onUseExampleChapter: vi.fn(),
	onOpenModel: vi.fn(),
	onOpenCritique: vi.fn(),
	onOpenBook: vi.fn(),
	onOpenView: vi.fn(),
};

describe("OverviewView", () => {
	it("renders the workspace status dashboard from supplied state", () => {
		const html = renderToStaticMarkup(<OverviewView {...baseProps} />);

		expect(html).toContain("AI 网文作者的第一章质检台");
		expect(html).toContain("章节急诊");
		expect(html).toContain("当前模型");
		expect(html).toContain("本地演示");
		expect(html).toContain("高级质检进度");
		expect(html).toContain("高级能力放在后面");
		expect(html).toContain("番茄小说");
		expect(html).toContain("整书资产");
	});

	it("shows latest score evidence when a report exists", () => {
		const html = renderToStaticMarkup(
			<OverviewView
				{...baseProps}
				scoreResult={{
					totalScore: 7.2,
					strongestPoint: "冲突开得快。",
					weakestPoint: "章末缺少新钩子。",
					nextRevisionMove: "补一处身份暴露风险。",
				}}
			/>,
		);

		expect(html).toContain("7.2/10");
		expect(html).toContain("冲突开得快。");
		expect(html).toContain("章末缺少新钩子。");
		expect(html).toContain("补一处身份暴露风险。");
	});
});
