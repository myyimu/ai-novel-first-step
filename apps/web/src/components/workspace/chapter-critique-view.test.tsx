import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChapterCritiqueView, ScorePanel } from "./chapter-critique-view";

const baseProps = {
	loading: null,
	providerLabel: "本地演示",
	quickLoading: false,
	quickElapsedSeconds: 0,
	quickReviewResult: null,
	quickReviewGenre: "",
	importReferenceFile: vi.fn(),
	onInferReferenceProfile: vi.fn(),
	onReferenceTextChange: vi.fn(),
	onQuickReviewGenreChange: vi.fn(),
	onRunQuickExperience: vi.fn(),
	onRerunQuickExperience: vi.fn(),
	hasQuickReviewCache: false,
	onUseExampleChapter: vi.fn(),
	onUseExampleReference: vi.fn(),
	onOpenModel: vi.fn(),
	onOpenBook: vi.fn(),
	onBuildRubric: vi.fn(),
	onRebuildRubric: vi.fn(),
	onScoreChapter: vi.fn(),
	onRescoreChapter: vi.fn(),
	hasRubricCache: false,
	hasScoreCache: false,
	onPlatformStrategyChange: vi.fn(),
	onChapterDraftChange: vi.fn(),
};

describe("ChapterCritiqueView", () => {
	it("renders the chapter critique workflow from workspace store state", () => {
		const html = renderToStaticMarkup(<ChapterCritiqueView {...baseProps} />);

		expect(html).toContain("30 秒小说诊断");
		expect(html).toContain("深度质检：样本、评分标准和证据链");
		expect(html).toContain("平台风格画像");
		expect(html).toContain("导入成熟章节");
		expect(html).toContain("AI 识别的市场定位");
		expect(html).toContain("质检我的章节");
		expect(html).toContain("评分标准");
		expect(html).toContain("数据表现快照");
	});

	it("shows score details when a chapter report exists", () => {
		const html = renderToStaticMarkup(
			<ScorePanel
				isShortFormReading={false}
				scoreResult={{
					mode: "mock",
					chapterTitle: "第一章 考场重逢",
					totalScore: 7.4,
					scores: [
						{
							metricId: "hook",
							name: "章末钩子",
							score: 7,
							reason: "悬念成立。",
							evidence: "匿名信带来新威胁。",
							fix: "章末压缩解释，强化未知。",
						},
					],
					strongestPoint: "冲突开得快。",
					weakestPoint: "章末威胁还不够尖锐。",
					nextRevisionMove: "把匿名信威胁放到最后一段。",
				}}
			/>,
		);

		expect(html).toContain("7.4/10");
		expect(html).toContain("冲突开得快。");
		expect(html).toContain("章末威胁还不够尖锐。");
		expect(html).toContain("把匿名信威胁放到最后一段。");
	});
});
