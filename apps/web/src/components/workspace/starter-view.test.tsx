import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StarterView } from "./starter-view";

describe("StarterView", () => {
	it("keeps beginner onboarding focused on learning blockbuster rules", () => {
		const html = renderToStaticMarkup(
			<StarterView
				digest={{
					summary: "先记住卖点、情绪和钩子三件事。",
					rules: [
						{
							title: "卖点要偏离平均值",
							explanation: "不要只写系统和打脸。",
							source: "样本核心卖点",
							apply: "给 Prompt 加入差异组合。",
						},
						{
							title: "情绪要连续",
							explanation: "每章保持明确情绪压力。",
							source: "情绪曲线",
							apply: "约束主角每章的压力来源。",
						},
						{
							title: "章末要有新信息",
							explanation: "用新线索推动追读。",
							source: "章末钩子",
							apply: "要求每章结尾留下新问题。",
						},
					],
				}}
				onOpenView={vi.fn()}
			/>,
		);

		expect(html).toContain("先别写，先看懂爆款");
		expect(html).toContain("这本书先记住 3 条规律");
		expect(html).toContain("卖点要偏离平均值");
		expect(html).toContain("建议学习路线");
		expect(html).toContain("评分只作为验证，不作为第一入口");
	});
});
