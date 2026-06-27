import { BookExportService } from "./book-export.service";

describe("BookExportService", () => {
  it("exports a readable book disassembly report", () => {
    const service = new BookExportService();

    const exported = service.export(
      {
        book: {
          title: "样本书",
          genre: "xuanhuan",
          oneSentencePremise: "废柴主角被公开剥夺资格后寻找旧案证据。",
          coreAppeal: ["公开羞辱后反击", "旧案悬念"],
        },
        relationships: {
          nodes: [
            { id: "c1", label: "主角" },
            { id: "c2", label: "评审会" },
          ],
          edges: [
            {
              source: "c1",
              target: "c2",
              label: "压迫",
              relation: ["压迫", "反击"],
              tension: "资格被剥夺",
              weight: 9,
              evidence: ["评审会当众否定主角资格"],
              firstSeenChapter: 1,
            },
          ],
        },
        plotlines: [
          {
            reusablePattern:
              "先给主角明确损失，再给一个必须冒险争取的翻盘机会。",
          },
        ],
        chronicle: [],
        writingSupport: {
          chapterFunctionTable: [
            {
              chapterOrder: 1,
              title: "第一章",
              function: "开局承诺",
              goal: "保住资格",
              conflict: "评审会公开剥夺资格",
              hook: "旧案信物出现",
            },
          ],
          readerPromiseChecklist: [
            {
              promise: "公开羞辱后反击",
              status: "pending",
              nextCheck: "前三章必须给第一次反击机会",
            },
          ],
          foreshadowingLedger: [
            {
              setup: "旧案信物",
              setupChapter: 1,
              payoff: "引出主线秘密",
              risk: "忘记会让旧案线断裂",
            },
          ],
          qualityDiagnosis: {
            strengths: ["压迫关系清楚"],
          },
        },
        exportPackage: {
          doNotCopyList: ["不要复用原作关系网"],
        },
        originalizationReport: {
          safeToLearn: ["开局压力前置"],
          mustTransform: ["角色姓名必须重写"],
        },
      },
      "reading-report",
    );

    expect(exported.filename).toBe("样本书.reading-report.md");
    expect(exported.contentType).toContain("text/markdown");
    expect(exported.content).toContain("# 样本书 拆书阅读报告");
    expect(exported.content).toContain("## 理解版思维导图");
    expect(exported.content).toContain("中心承诺：公开羞辱后反击");
    expect(exported.content).toContain("关系钩子：主角 / 评审会");
    expect(exported.content).toContain("## 故事阶段时间轴");
    expect(exported.content).toContain("第 1 章：开局承诺");
    expect(exported.content).toContain("## 关键关系故事线");
    expect(exported.content).toContain("第 1 章：主角 / 评审会");
    expect(exported.content).toContain("读者会期待 主角 如何摆脱或反击 评审会");
    expect(exported.content).toContain("压迫关系要绑定具体损失和反击机会");
    expect(exported.content).toContain("主角 -> 评审会：压迫、反击");
    expect(exported.content).toContain("不要复用原作关系网");
  });
});
