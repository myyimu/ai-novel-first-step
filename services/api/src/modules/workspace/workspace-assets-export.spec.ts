import { buildWorkspaceProjectMarkdown } from "./workspace-assets-export";

describe("buildWorkspaceProjectMarkdown", () => {
  it("exports revision notes and prompt templates for a persisted project", () => {
    const markdown = buildWorkspaceProjectMarkdown({
      project: {
        id: "project-a",
        name: "退婚流测试项目",
        createdAt: "2026-06-24T00:00:00.000Z",
        updatedAt: "2026-06-24T02:00:00.000Z",
      },
      revisionSessions: [
        {
          id: "revision-2",
          projectId: "project-a",
          createdAt: "2026-06-24T01:00:00.000Z",
          chapterTitle: "第二版",
          genre: "xuanhuan",
          inputKind: "ai-draft",
          textHash: "hash",
          textLength: 120,
          quickScore: 6.8,
          gateDecision: "revise",
          mainProblem: "章末钩子没有代价",
          issueTitles: ["章末钩子没有代价"],
          issueCategories: ["hook"],
          nextPrompt: "请补强章末代价。",
          revisionNote: "这一版已经补了章末代价。",
          methodologyCardIds: ["method-1"],
        },
        {
          id: "revision-1",
          projectId: "project-a",
          createdAt: "2026-06-24T00:00:00.000Z",
          chapterTitle: "第一版",
          genre: "xuanhuan",
          inputKind: "ai-draft",
          textHash: "hash-1",
          textLength: 100,
          quickScore: 5.6,
          gateDecision: "rebuild",
          mainProblem: "章末钩子没有代价",
          issueTitles: ["章末钩子没有代价"],
          issueCategories: ["hook"],
          nextPrompt: "请补强章末代价。",
          methodologyCardIds: ["method-1"],
        },
      ],
      methodologyCards: [
        {
          id: "method-1",
          projectCardId: "method-1",
          projectId: "project-a",
          sourceIssueId: "issue-1",
          type: "hook_rule",
          title: "钩子必须绑定代价",
          triggerProblem: "章末钩子没有代价",
          reusableRule: "章末悬念要绑定读者不继续阅读的损失。",
          selfCheckQuestion: "读者知道不点下一章会错过什么吗？",
          promptTemplate: "请补强章末代价。",
          firstSeenAt: "2026-06-24T00:00:00.000Z",
          lastSeenAt: "2026-06-24T01:00:00.000Z",
          sourceChapterTitle: "第一章 退婚",
          sourceIssueTitle: "章末钩子没有代价",
          occurrenceCount: 2,
        },
      ],
      generatedAt: "2026-06-24T03:00:00.000Z",
    });

    expect(markdown).toContain("AI网文诊断台项目导出");
    expect(markdown).toContain("项目概览");
    expect(markdown).toContain("复诊轨迹");
    expect(markdown).toContain("人工备注");
    expect(markdown).toContain("这一版已经补了章末代价。");
    expect(markdown).toContain("方法论卡");
    expect(markdown).toContain("Prompt 模板合集");
    expect(markdown).toContain("Prompt 归因");
    expect(markdown).toContain("Prompt 有效");
    expect(markdown).toContain("项目级归因校准");
    expect(markdown).toContain("模型/编辑复核提示");
    expect(markdown).toContain("诊断理由");
    expect(markdown).toContain("置信度");
    expect(markdown).toContain("信号");
    expect(markdown).toContain("请补强章末代价。");
  });
});
