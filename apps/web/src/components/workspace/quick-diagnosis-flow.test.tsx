import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OverviewView } from "./overview-view";
import { diagnosisExampleOptions } from "@/lib/diagnosis-examples";

describe("quick diagnosis fixture flow", () => {
	it("renders a golden example report through the overview diagnosis entry", () => {
		const example = diagnosisExampleOptions[0]!;
		const result = example.result!;
		const html = renderToStaticMarkup(
			<OverviewView
				providerKind="mock"
				providerLabel="本地演示"
				providerModel=""
				quickLoading={false}
				quickElapsedSeconds={0}
				quickReviewResult={result}
				quickReviewGenre={example.genre}
				quickReviewInputKind={example.inputKind}
				quickReviewPreviousPrompt={example.previousPrompt}
				revisionSessions={[]}
				methodologyCards={[]}
				chapterText={example.chapterText}
				chapterCompletion={0}
				nextChapterAction="生成评分标准"
				referenceTitle="成熟样本"
				scoreResult={null}
				bookStatus="未启动"
				bookStatusText="未启动整书拆解"
				researchReadiness={0}
				researchSourceCount={0}
				graphNodeCount={0}
				chapterProjectSteps={[]}
				platformLabel="番茄小说"
				readingModeLabel="长篇追更"
				competitionLevelLabel="待确认"
				pushStageLabel="冷启动"
				competitionNotes=""
				bookTitle="示例长篇小说"
				bookCompletion={0}
				onChapterTextChange={vi.fn()}
				onQuickReviewGenreChange={vi.fn()}
				onQuickReviewInputKindChange={vi.fn()}
				onQuickReviewPreviousPromptChange={vi.fn()}
				onRunQuickExperience={vi.fn()}
				onRerunQuickExperience={vi.fn()}
				hasQuickReviewCache={false}
				diagnosisExamples={diagnosisExampleOptions}
				onUseExampleChapter={vi.fn()}
				onOpenModel={vi.fn()}
				onOpenCritique={vi.fn()}
				onOpenBook={vi.fn()}
				onOpenView={vi.fn()}
			/>,
		);

		expect(html).toContain("30 秒小说诊断");
		expect(html).toContain(example.label);
		expect(html).toContain(result.mainProblem);
		expect(html).toContain(result.oneLineDiagnosis!);
		expect(html).toContain("证据锚点");
		expect(html).toContain("平均置信度");
		expect(html).toContain(result.issues![0]!.title);
		expect(html).toContain(result.issues![0]!.evidence[0]!.locationHint);
		expect(html).toContain("可复制给写作 AI 的改稿 Prompt");
		expect(html).toContain(result.nextPrompt!.prompt);
		expect(html).toContain("可沉淀的方法论卡片");
		expect(html).toContain(result.methodologyCards![0]!.title);
		expect(html).toContain("诊断闭环");
	});
});
