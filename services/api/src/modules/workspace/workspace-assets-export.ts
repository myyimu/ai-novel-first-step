import type {
  ProjectMethodologyCardSnapshot,
  RevisionSessionSnapshot,
  WorkspaceProjectSnapshot,
} from "./workspace-assets.repository";
import { buildPromptAttribution } from "@ai-novel-diagnosis/ai-core";

export function buildWorkspaceProjectMarkdown(input: {
  project: WorkspaceProjectSnapshot;
  revisionSessions: RevisionSessionSnapshot[];
  methodologyCards: ProjectMethodologyCardSnapshot[];
  generatedAt?: string;
}) {
  const sessions = [...input.revisionSessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const cards = [...input.methodologyCards].sort((a, b) => {
    if (b.occurrenceCount !== a.occurrenceCount) {
      return b.occurrenceCount - a.occurrenceCount;
    }
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
  const promptCards = cards.filter((card) => card.promptTemplate?.trim());
  const latest = sessions[0];
  const previous = sessions[1];
  const scoreDelta =
    latest && previous
      ? Number((latest.quickScore - previous.quickScore).toFixed(1))
      : null;
  const promptAttribution = buildPromptAttribution(sessions);
  const commonIssues = countRows(
    sessions.flatMap((session) =>
      session.issueTitles.length ? session.issueTitles : [session.mainProblem],
    ),
  )
    .slice(0, 6)
    .map((row) => row.label);

  const lines = [
    `# AI网文诊断台项目导出：${escapeMarkdown(input.project.name)}`,
    "",
    `- 导出时间：${formatDateTime(input.generatedAt || new Date().toISOString())}`,
    `- 项目创建：${formatDateTime(input.project.createdAt)}`,
    `- 最近更新：${formatDateTime(input.project.updatedAt)}`,
    `- 复诊次数：${sessions.length}`,
    `- 方法论卡：${cards.length}`,
    `- Prompt 模板：${promptCards.length}`,
    "",
    "## 项目概览",
    "",
    `- 最新分数：${latest ? `${latest.quickScore}/10` : "暂无"}`,
    `- 相对上一版：${formatScoreDelta(scoreDelta)}`,
    `- 最新 Gate：${latest ? formatGate(latest.gateDecision) : "暂无"}`,
    `- Prompt 归因有效率：${formatPromptAttributionRate(promptAttribution)}`,
    `- 常见问题：${commonIssues.join("、") || "暂无"}`,
    "",
    "## 复诊轨迹",
    "",
  ];

  if (!sessions.length) {
    lines.push("暂无复诊记录。", "");
  } else {
    sessions.forEach((session, index) => {
      lines.push(
        `### ${sessions.length - index}. ${escapeMarkdown(session.chapterTitle)}`,
        "",
        `- 时间：${formatDateTime(session.createdAt)}`,
        `- 来源：${formatInputKind(session.inputKind)}`,
        `- 题材：${session.genre}`,
        `- 分数：${session.quickScore}/10`,
        `- Gate：${formatGate(session.gateDecision)}`,
        `- 正文长度：${session.textLength} 字`,
        `- 主要问题：${session.mainProblem}`,
        `- 问题标签：${session.issueTitles.join("、") || "暂无"}`,
        "",
      );

      if (session.revisionNote?.trim()) {
        lines.push("人工备注：", "", session.revisionNote.trim(), "");
      }

      if (session.nextPrompt?.trim()) {
        lines.push(
          "下一轮 Prompt：",
          "",
          "```text",
          escapeCodeFence(session.nextPrompt.trim()),
          "```",
          "",
        );
      }
    });
  }

  lines.push("## Prompt 归因", "");
  if (!promptAttribution.items.length) {
    lines.push("暂无可归因复诊。", "");
  } else {
    lines.push(
      "### 项目级归因校准",
      "",
      `- 状态：${promptAttribution.calibration.readinessLabel}`,
      `- 样本数：${promptAttribution.calibration.sampleSize}`,
      `- 平均置信度：${formatNullableAttributionConfidence(promptAttribution.calibration.averageConfidence)}`,
      `- 主导归因：${promptAttribution.calibration.dominantCategory?.label || "暂无"}`,
      `- 校准结论：${promptAttribution.calibration.headline}`,
      `- 下一步：${promptAttribution.calibration.nextBestAction}`,
      `- 待补证据：${promptAttribution.calibration.evidenceGaps.join("；") || "暂无"}`,
      "",
      "模型/编辑复核提示：",
      "",
      "```text",
      escapeCodeFence(promptAttribution.calibration.modelAssistedReviewPrompt),
      "```",
      "",
    );

    promptAttribution.items.forEach((item, index) => {
      lines.push(
        `### 单次归因 ${index + 1}. ${item.label}`,
        "",
        `- 版本：${item.previousTitle} -> ${item.currentTitle}`,
        `- 分数变化：${item.scoreDelta >= 0 ? "+" : ""}${item.scoreDelta}`,
        `- 置信度：${formatAttributionConfidence(item.confidence)}`,
        `- 诊断理由：${item.diagnosisReason}`,
        `- 证据：${item.evidence.join("；")}`,
        `- 信号：${item.signalStrengths.map((signal) => `${signal.label}=${signal.value}`).join("；")}`,
        `- 下一步：${item.nextAction}`,
        `- 待补数据：${item.missingData.join("；") || "暂无"}`,
        "",
      );
    });
  }

  lines.push("## 方法论卡", "");
  if (!cards.length) {
    lines.push("暂无方法论卡。", "");
  } else {
    cards.forEach((card, index) => {
      lines.push(
        `### ${index + 1}. ${escapeMarkdown(card.title)}`,
        "",
        `- 类型：${formatMethodologyType(card.type)}`,
        `- 出现次数：${card.occurrenceCount}`,
        `- 来源章节：${card.sourceChapterTitle}`,
        `- 来源问题：${card.sourceIssueTitle || card.triggerProblem || "暂无"}`,
        `- 触发问题：${card.triggerProblem}`,
        `- 复用规则：${card.reusableRule}`,
        `- 自查问题：${card.selfCheckQuestion}`,
        "",
      );
    });
  }

  lines.push("## Prompt 模板合集", "");
  if (!promptCards.length) {
    lines.push("暂无可复用 Prompt 模板。", "");
  } else {
    promptCards.forEach((card, index) => {
      lines.push(
        `### ${index + 1}. ${escapeMarkdown(card.title)}`,
        "",
        "```text",
        escapeCodeFence(card.promptTemplate?.trim() || ""),
        "```",
        "",
      );
    });
  }

  return `${lines.join("\n").trim()}\n`;
}

function countRows(values: string[]) {
  const counts = values
    .filter(Boolean)
    .reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}

function formatGate(value: string | undefined) {
  const map: Record<string, string> = {
    continue: "继续",
    revise: "修改",
    rebuild: "重构",
    discard: "废稿",
  };
  return map[value || ""] || "修改";
}

function formatInputKind(value: string) {
  const map: Record<string, string> = {
    "human-draft": "作者正文",
    "ai-draft": "AI 生成稿",
    idea: "脑洞",
    outline: "大纲",
    prompt: "Prompt 草稿",
  };
  return map[value] || "作者正文";
}

function formatMethodologyType(type: string) {
  const map: Record<string, string> = {
    opening_rule: "开头规则",
    prompt_rule: "Prompt 规则",
    pacing_rule: "节奏规则",
    hook_rule: "钩子规则",
    payoff_rule: "爽点兑现",
    anti_pattern: "反模式",
  };
  return map[type] || "方法论";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScoreDelta(value: number | null) {
  if (value === null) return "暂无上一版";
  if (value === 0) return "持平";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatPromptAttributionRate(value: {
  total: number;
  effective: number;
  rate: number | null;
}) {
  if (!value.total || value.rate === null) {
    return "暂无可归因复诊";
  }
  return `${value.rate}%（${value.effective}/${value.total} 次归因为 Prompt 有效）`;
}

function formatAttributionConfidence(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatNullableAttributionConfidence(value: number | null) {
  return value === null ? "暂无" : formatAttributionConfidence(value);
}

function escapeMarkdown(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}

function escapeCodeFence(value: string) {
  return value.replace(/```/g, "'''");
}
