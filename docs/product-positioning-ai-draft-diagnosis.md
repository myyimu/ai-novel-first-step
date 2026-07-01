# AI 网文诊断台定位与 AI 生成稿质检方向文档

日期：2026-06-24

## 背景判断

当前项目已经完成了一个可用的“AI 网文诊断台”MVP：用户粘贴第一章，系统找出最大流失点，给出改稿建议和可复制的改稿 Prompt，并支持基础复诊。

但随着 AI 生成正文成为网文写作的常见工作流，用户面临的问题会发生变化：

```text
过去的问题：我写得不好，怎么改？
现在的问题：我让 AI 写了，但为什么还是不好看？下一条 Prompt 应该怎么改？
```

因此，产品不应只做传统意义上的写作教练，也不应只做 Prompt 生成器。更有价值的方向是成为 AI 写作时代的编辑质检与迭代系统。

## 团队共识

### 产品负责人

当前 MVP 没有偏离，但定位需要升级。

原定位：

```text
AI 网文诊断台：帮作者找出小说为什么没人追，并生成改稿 Prompt。
```

修正后的定位：

```text
AI 网文诊断台：面向网文作者和 AI 辅助写作者的稿件诊断、改稿复诊与 Prompt 迭代系统。
它诊断稿子为什么不吸引人，并把问题转化为下一轮改稿动作、Prompt 约束、复诊标准和作者/团队方法论。
```

### 资深网文编辑

AI 正文生成能力会持续变强，但“判断这稿有没有读者价值”仍然稀缺。

编辑能力应该拆成可执行判断：

- 这个脑洞是否有读者承诺。
- 开头是否快速兑现点击期待。
- 主角目标、压力、代价是否具体。
- 爽点是否完成压制、蓄力、反击、兑现。
- AI 是否把冲突写平、把设定写重、把情绪写虚。
- 下一版应该优先改脑洞、结构、正文，还是 Prompt。

### 写作教练

如果正文主要由 AI 生成，产品不应把重点放在“教作者手写句子”，而应帮助作者成为稿件负责人：

- 会提出脑洞和目标读者。
- 会约束 AI 生成方向。
- 会判断 AI 初稿是否有效。
- 会把诊断反馈转成下一轮 Prompt。
- 会沉淀自己的写作和改稿方法论。

### AI 产品架构师

Prompt 是交付物，但不是产品核心。产品核心是归因系统：

```text
不好看
-> 是脑洞问题？
-> 是卖点问题？
-> 是结构问题？
-> 是正文执行问题？
-> 是上一条 Prompt 约束问题？
-> 是模型能力或上下文问题？
```

每次诊断都应该输出下一轮可执行指令，而不是只输出泛泛建议。

### 商业负责人

更有付费价值的用户不只是单个作者，也包括 AI 网文工作流用户：

- 用 AI 批量出初稿的作者。
- 小型网文工作室。
- 内容测试团队。
- 需要筛选题材、开头和 Prompt 的写作团队。

他们真正需要的是：

```text
批量生成之后，快速判断哪篇值得继续投，哪篇要废掉，哪篇要重写 Prompt。
```

## 产品名称

主名称固定为：

```text
AI网文诊断台
```

副标题：

```text
AI 生成稿诊断、改稿复诊与 Prompt 迭代系统
```

命名原则：

- 主品牌只讲“诊断”，不讲“生成”。
- 首屏心智是“这篇为什么没人追，下一版先改哪里”。
- AI 生成稿和 Prompt 迭代是诊断台的能力，不是新的主品牌。
- 产品文案避免把用户引向“一键写小说”或“代写正文”的理解。

## 新产品定位

一句话定位：

```text
AI 网文诊断台帮助作者判断一篇网文稿为什么不吸引人，并在稿件来自 AI 时进一步诊断上一条 Prompt 该怎么改。
```

更完整的定位：

```text
这不是一键写小说工具，也不是单纯的 Prompt 生成器。
它是网文诊断与复诊台：
先判断稿子有没有读者价值，再追溯问题来自脑洞、结构、正文还是 Prompt，最后生成下一轮改稿 Prompt，并沉淀作者自己的写作和改稿方法论。
```

## 用户角色变化

传统网文作者：

```text
作者 = 写正文的人
```

AI 写作时代的作者：

```text
作者 = 脑洞提出者 + 稿件负责人 + AI 指令设计者 + 审稿人 + 最终取舍者
```

产品应该服务后者。

## 核心工作流

升级后的核心工作流：

```text
输入脑洞/大纲/上一条 Prompt/AI 初稿
-> 编辑质检
-> 问题归因
-> 下一轮生成或改稿 Prompt
-> 改后复诊
-> 沉淀作者方法论
```

当前 MVP 的第一章诊断仍然保留，但要放进更大的链路中：

```text
第一章诊断
-> AI 初稿诊断
-> Prompt 诊断
-> 复诊对比
-> 方法论沉淀
```

## 功能变化判断

### 保留并强化

#### 1. 第一章诊断

继续作为首屏入口。

原因：

- 用户第一次使用最容易理解。
- 第一章最能体现点击后留存问题。
- 它是后续 Prompt 迭代和复诊的天然入口。

需要强化：

- 原文证据锚点。
- 读者流失反应。
- 根因归类。
- 复诊检查点。
- 下一轮 Prompt。

#### 2. 改稿 Prompt

继续作为核心交付物。

但它不能只是前端拼接的文本，而应该由诊断结果驱动：

```text
问题类型 -> 改稿策略 -> Prompt 约束 -> 复诊标准
```

#### 3. 复诊对比

从辅助能力升级为核心闭环。

复诊不应只是重新跑一次分数，而要回答：

- 上一版最大问题是否解决。
- 新版是否引入新问题。
- 上一条 Prompt 是否有效。
- 下一轮只改哪一个重点。

#### 4. 样本拆解和研究库

保留为第二层能力。

它们服务于：

- 学习成熟作品结构。
- 提炼可迁移规则。
- 生成更好的改稿 Prompt。
- 支撑作者/团队方法论。

但不能抢首屏心智。

### 需要新增

#### 1. 输入类型选择

当前只像“粘贴章节”。应增加输入类型：

- 脑洞。
- 大纲。
- 上一条 Prompt。
- AI 生成初稿。
- 人工写作稿。

用户不一定知道问题在哪，因此系统需要允许多种输入并做归因。

#### 2. 问题归因系统

新增诊断分类：

- `idea_problem`: 脑洞没有读者承诺。
- `selling_point_problem`: 卖点不清或不前置。
- `structure_problem`: 章节结构不支撑追读。
- `execution_problem`: 正文执行弱。
- `prompt_problem`: 上一条 Prompt 约束不足。
- `model_problem`: 模型能力或上下文不足。

#### 3. Prompt 诊断

如果用户提供上一条 Prompt，系统应判断：

- Prompt 是否只要求“写得爽”但没有定义爽点结构。
- 是否缺少目标平台和读者。
- 是否缺少开头承诺和章末钩子要求。
- 是否缺少禁止事项。
- 是否没有要求 AI 保留/修改边界。

#### 4. 作者方法论库

每次诊断后沉淀成长期资产：

- 作者常见问题。
- 作者有效写法。
- 作者 Prompt 模板。
- 作者开头模板。
- 作者改稿检查清单。
- 作者适合的表达路线。
- 作者需要避免的 AI 生成问题。

#### 5. 批量质检能力

后续面向工作室或高频用户时，支持批量输入多个 AI 初稿，输出：

- 哪些值得继续改。
- 哪些建议废稿。
- 哪些需要重写脑洞。
- 哪些只需要改 Prompt。

### 需要下沉

#### 1. 整书图谱

保留，但作为进阶学习与资产导出，不做第一层核心。

#### 2. 多格式导出

保留，但默认只露出最常用：

- 诊断报告。
- 下一轮 Prompt。
- 方法论卡片。
- Markdown 资产包。

其他格式放高级导出。

#### 3. 通用研究库问答

必须限制在证据型问答，不要变成泛聊天。

## 新结果结构建议

### Quick Review v2

```ts
interface QuickReviewV2 {
  title: string;
  genre: string;
  inputKind: "idea" | "outline" | "prompt" | "ai-draft" | "human-draft";
  quickScore: number;
  confidence: number;

  verdict: {
    marketReadiness: "continue" | "revise" | "rebuild" | "discard";
    oneLineDiagnosis: string;
    nextBestAction: string;
  };

  rootCauses: Array<{
    type:
      | "idea_problem"
      | "selling_point_problem"
      | "structure_problem"
      | "execution_problem"
      | "prompt_problem"
      | "model_problem";
    severity: "high" | "medium" | "low";
    explanation: string;
    readerReaction: string;
    evidenceAnchors: Array<{
      quote: string;
      locationHint: string;
      confidence: number;
    }>;
  }>;

  promptDiagnosis?: {
    missingConstraints: string[];
    vagueInstructions: string[];
    conflictingInstructions: string[];
    improvedPromptPrinciples: string[];
  };

  revisionPlan: {
    priority: string;
    keep: string[];
    change: string[];
    avoid: string[];
    checkpoints: string[];
  };

  nextPrompt: {
    title: string;
    prompt: string;
    whyThisWorks: string[];
  };

  methodologyCards: Array<{
    title: string;
    triggerProblem: string;
    reusableRule: string;
    selfCheckQuestion: string;
    promptTemplate: string;
  }>;
}
```

### Author Methodology Profile

```ts
interface AuthorMethodologyProfile {
  strengths: string[];
  recurringWeaknesses: Array<{
    problem: string;
    frequency: number;
    examples: string[];
    fixRule: string;
  }>;
  promptRules: Array<{
    title: string;
    rule: string;
    template: string;
  }>;
  openingRules: string[];
  pacingRules: string[];
  stylePreferences: string[];
  antiPatterns: string[];
  nextTrainingFocus: string;
}
```

## 页面信息架构调整

### 首屏

首屏只保留一个主任务：

```text
贴一章稿子，先判断为什么没人追；如果是 AI 写的，再判断 Prompt 该怎么改。
```

推荐文案：

```text
别急着让 AI 重写。先诊断这稿为什么留不住读者。
```

输入区新增：

- 输入类型选择。
- 文本输入。
- 如果选择 AI 初稿，可选填上一条 Prompt。
- 生成编辑诊断。

### 结果页

结果页结构：

1. 总编判断：值得继续、需要重构、建议废稿。
2. 最大问题：问题类型 + 原文证据 + 读者反应。
3. 归因结果：脑洞/结构/正文/Prompt 哪一层出问题。
4. 下一轮 Prompt：可复制。
5. 复诊检查点：改后贴回来时看什么。
6. 方法论卡片：是否沉淀到个人方法论库。

### 新页面：我的方法论

新增入口：

```text
我的方法论
```

内容：

- 我的常见问题。
- 我的有效 Prompt 规则。
- 我的开头模板。
- 我的节奏检查表。
- 我的 AI 生成反面清单。
- 最近 5 次复诊学到的规则。

## 技术实现计划

### P0：文案和契约升级

目标：先让产品表达和数据结构对齐新定位。

任务：

- README 增加修正后的副标题。
- quick review schema 增加证据链、归因、Prompt 诊断和方法论卡片。
- prompt 增加输入类型、上一条 Prompt、AI 初稿判断。
- 前端结果区展示“问题归因”和“下一轮 Prompt”。

不做：

- 不重做整书图谱。
- 不做账号系统。
- 不做批量质检。

### P1：复诊闭环

目标：让用户看到 Prompt 迭代是否有效。

任务：

- 保存改前版本、上一条 Prompt、改后版本。
- 输出“上一轮 Prompt 是否解决问题”。
- 显示问题变化、分数变化、下一轮单点动作。
- 方法论卡片可加入本地方法论库。

### P2：作者方法论库

目标：让产品从一次性诊断变成长期系统。

任务：

- 新增本地持久化表或 localStorage 结构。
- 聚合多次诊断结果。
- 识别重复问题。
- 生成作者 Prompt 模板和自查清单。
- 新增“我的方法论”页面。

### P3：团队/批量质检

目标：面向高频 AI 网文生产者。

任务：

- 批量上传多个初稿。
- 输出稿件优先级。
- 标记继续、重构、废稿。
- 统计 Prompt 问题分布。
- 导出质检报告。

## 当前代码映射

已有基础：

- `POST /analysis/quick-review`：可升级为 Quick Review v2。
- `QuickReviewResult`：需要扩展字段。
- 首页 `QuickExperiencePanel`：可改成多输入类型诊断。
- 本地 `quickReviewCache`：可扩展为诊断版本历史。
- 深度质检的 `RubricResult.principles`：可复用为方法论卡片。
- 整书 `transferableStyleCard` 和 `styleBible`：可作为样本方法论，不等于作者个人方法论。

主要缺口：

- 没有 Prompt 诊断。
- 没有输入类型。
- 没有根因分类。
- 没有作者个人方法论库。
- 复诊仍偏简单分数对比。

## 参考项目设计原则

1. 质检结果必须结构化，不能只给自然语言建议。
2. 分数只用于排序和趋势，不作为唯一判断。
3. 每个关键问题必须有证据、读者影响和下一步动作。
4. 产品要有 gate 决策：继续、修改、重构、废稿。
5. Prompt 是诊断后的执行指令，不是凭空生成。
6. 复诊必须判断上一轮 Prompt 是否有效。
7. 方法论库优先沉淀“作者如何指挥 AI”，而不是只沉淀剧情事实。
8. 报告要作者友好，复杂 JSON 留给系统，不直接甩给用户。
9. 诊断看板应展示诊断质量趋势、编辑建议和下一步动作，而不是只展示任务列表。

具体落地计划见 [AI 网文诊断台工作流化改造计划](./diagnosis-workflow-implementation-plan.md)。

## 取舍原则

后续所有功能都要过这五个问题：

1. 它是否帮助判断稿子有没有读者价值？
2. 它是否能定位问题来自脑洞、结构、正文还是 Prompt？
3. 它是否能生成下一轮可执行 Prompt？
4. 它是否能帮助复诊判断改稿是否有效？
5. 它是否能沉淀为作者/团队的方法论？

如果答案多数是否，就下沉或不做。

## 最终结论

产品名称固定为“AI网文诊断台”，所有新增能力都围绕诊断、复诊和方法论沉淀展开。

```text
主名称：AI网文诊断台
副标题：AI 生成稿诊断、改稿复诊与 Prompt 迭代系统
```

当前产品不是偏了，而是需要在“诊断一篇文章”的基础上增加对 AI 生成稿和上一条 Prompt 的诊断能力。

最有价值的产品方向是：

```text
AI 写作时代的网文诊断与复诊系统：
判断什么值得继续改，诊断为什么不好看，生成下一轮 Prompt，并把每次迭代沉淀成作者/团队自己的写作方法论。
```
