import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuickExperiencePanel } from "./quick-experience-panel";

describe("QuickExperiencePanel", () => {
	it("renders the quick review entry without result", () => {
		const html = renderToStaticMarkup(
			<QuickExperiencePanel
				chapterText="主角被公开否定，却发现旧案信物。"
				providerLabel="免费共享算力"
				loading={false}
				elapsedSeconds={0}
				quickReviewResult={null}
				quickReviewGenre=""
				onChapterTextChange={vi.fn()}
				onQuickReviewGenreChange={vi.fn()}
				onRun={vi.fn()}
				onRerun={vi.fn()}
				hasCachedResult={false}
				onUseExample={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
				onOpenBook={vi.fn()}
			/>,
		);

		expect(html).toContain("30 秒章节急诊");
		expect(html).toContain("当前 AI: 免费共享算力");
		expect(html).toContain("找最大追读问题");
	});

	it("renders quick review result when provided", () => {
		const html = renderToStaticMarkup(
			<QuickExperiencePanel
				chapterText="主角被公开否定，却发现旧案信物。"
				providerLabel="免费共享算力"
				loading={false}
				elapsedSeconds={0}
				quickReviewResult={{
					title: "第一章 退婚",
					genre: "xuanhuan",
					positioning: "典型玄幻废柴流开局",
					sellingPoints: ["反转感强", "目标明确"],
					mainProblem: "冲突压力不足",
					actionableFixes: ["补一句失败代价", "前置目标", "加结尾钩子"],
					recommendedPlatforms: [
						{
							id: "fanqie",
							label: "番茄小说",
							fit: "优先发布",
							reason: "强冲突和快节奏更容易测出反馈",
						},
					],
					readyForFullReview: true,
					readyReason: "文本量足够，适合做完整评分",
					quickScore: 6.5,
					confidence: 0.82,
				}}
				previousQuickReviewResult={{
					title: "第一章 退婚",
					genre: "xuanhuan",
					positioning: "典型玄幻废柴流开局",
					sellingPoints: ["目标明确"],
					mainProblem: "失败代价不清楚",
					actionableFixes: ["补失败代价"],
					recommendedPlatforms: [],
					readyForFullReview: true,
					readyReason: "可以复诊",
					quickScore: 5.2,
					confidence: 0.75,
				}}
				quickReviewGenre=""
				onChapterTextChange={vi.fn()}
				onQuickReviewGenreChange={vi.fn()}
				onRun={vi.fn()}
				onRerun={vi.fn()}
				hasCachedResult={true}
				onUseExample={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
				onOpenBook={vi.fn()}
			/>,
		);

		expect(html).toContain("6.5/10");
		expect(html).toContain("典型玄幻废柴流开局");
		expect(html).toContain("冲突压力不足");
		expect(html).toContain("这章最大流失点：冲突压力不足");
		expect(html).toContain("补一句失败代价");
		expect(html).toContain("可复制给写作 AI 的改稿 Prompt");
		expect(html).toContain("请帮我改写这一章");
		expect(html).toContain("改稿后复诊对比");
		expect(html).toContain("5.2");
		expect(html).toContain("6.5");
		expect(html).toContain("从“失败代价不清楚”变为“冲突压力不足”。");
		expect(html).toContain("推荐发布平台");
		expect(html).toContain("番茄小说");
		expect(html).toContain("打开高级质检");
		expect(html).toContain("拆解整本书");
	});

	it("falls back when the model returns an incomplete result", () => {
		const html = renderToStaticMarkup(
			<QuickExperiencePanel
				chapterText="主角被公开否定，却发现旧案信物。"
				providerLabel="免费共享算力"
				loading={false}
				elapsedSeconds={0}
				quickReviewResult={
					{
						quickScore: 6,
						confidence: 0.6,
						recommendedPlatforms: [],
					} as never
				}
				quickReviewGenre=""
				onChapterTextChange={vi.fn()}
				onQuickReviewGenreChange={vi.fn()}
				onRun={vi.fn()}
				onRerun={vi.fn()}
				hasCachedResult={false}
				onUseExample={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
				onOpenBook={vi.fn()}
			/>,
		);

		expect(html).toContain("6/10");
		expect(html).toContain("类型待确认");
		expect(html).toContain("模型没有返回明确卖点");
		expect(html).toContain("模型没有返回具体改法");
		expect(html).toContain("模型还没给出平台建议");
	});

	it("renders visible progress while waiting for a quick review", () => {
		const html = renderToStaticMarkup(
			<QuickExperiencePanel
				chapterText="主角被公开否定，却发现旧案信物。"
				providerLabel="免费共享算力"
				loading={true}
				elapsedSeconds={21}
				quickReviewResult={null}
				quickReviewGenre=""
				onChapterTextChange={vi.fn()}
				onQuickReviewGenreChange={vi.fn()}
				onRun={vi.fn()}
				onRerun={vi.fn()}
				hasCachedResult={false}
				onUseExample={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
				onOpenBook={vi.fn()}
			/>,
		);

		expect(html).toContain("等待模型返回");
		expect(html).toContain("已等待 21 秒");
	});
});
