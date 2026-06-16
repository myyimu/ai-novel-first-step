import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QuickExperiencePanel } from "./quick-experience-panel";

describe("QuickExperiencePanel", () => {
	it("renders the beginner fast path and latest score summary", () => {
		const html = renderToStaticMarkup(
			<QuickExperiencePanel
				chapterText="主角被公开否定，却发现旧案信物。"
				providerLabel="本地演示"
				loading={false}
				scoreSummary="6.8/10"
				revisionMove="先补强章末钩子。"
				onChapterTextChange={vi.fn()}
				onRun={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
			/>,
		);

		expect(html).toContain("快速体验");
		expect(html).toContain("当前 AI：本地演示");
		expect(html).toContain("一键出结果");
		expect(html).toContain("最近结果：6.8/10");
		expect(html).toContain("查看完整单章点评");
	});
});
