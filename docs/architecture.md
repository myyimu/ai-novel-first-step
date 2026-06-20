# AI小说第一步 技术架构

## 产品定位

AI小说第一步是本地部署的 AI 小说章节急诊与样本拆解工具。

当前产品主路径不是“先填完整配置再分析”，而是：

```text
粘贴自己的章节
-> 运行章节急诊
-> 找出最大追读问题
-> 复制改稿 Prompt
-> 改完后复测
```

成熟样本拆解、Rubric、高级评分、整书资产和研究库是进阶能力，用来支撑更严肃的学习、质检和创作决策。

## Workspace

- `apps/web`: Next.js 控制台，负责章节急诊、高级质检、整书资产、研究库、AI 设置和导出入口。
- `services/api`: NestJS API，负责模型调用、章节急诊、参考画像、Rubric、评分、整书异步任务、研究库和导出。
- `packages/ai-core`: Web 和 API 共享的分析类型、评分结果结构和模型契约。
- `docker-compose.yml`: 本地部署入口，启动 PostgreSQL、API、Web；Redis 和 MinIO 是后续扩展方向，不在默认 compose 中启动。
- `one.manifest.json`: One CLI workspace 的项目、容器和运行入口定义。

## Frontend Information Architecture

控制台按用户成熟度分层：

- 第一章质检台：默认入口，承接“粘贴章节 -> 章节急诊 -> 改稿 Prompt -> 复测”。
- 高级章节质检：导入成熟样本，AI 识别市场定位，生成 Rubric，再评分自己的章节。
- 整书资产：上传 TXT，预览章节切分，启动 Map-Reduce 整书拆解，沉淀角色卡、世界书和写作资产。
- 研究决策：把已拆解样本、评分证据和多书对比压缩成可追溯的选题/改稿判断。
- AI 设置：共享模型、本地 mock、自备 OpenAI-compatible 供应商配置和连通性测试。
- 历史任务/导出中心：围绕已完成的整书任务做恢复、查看和素材导出。

复杂参数遵循渐进暴露原则：首屏只要求章节正文；平台画像、样本 Rubric、数据快照和研究库能力后置。

## Core Product Flow

### 1. Chapter Triage

```text
用户粘贴章节
-> POST /analysis/quick-review
-> 返回定位、卖点、最大问题、改法、推荐平台、quickScore
-> 前端生成可复制的改稿 Prompt
-> 用户改稿后再次运行，比较前后 quickScore 和问题变化
```

章节急诊用于降低首次使用门槛，不要求成熟样本、Rubric 或完整平台参数。

### 2. Advanced Chapter Critique

```text
导入成熟章节
-> POST /analysis/reference/profile
-> AI 识别分类、主题、标签、显性关键词、隐性期待、标题/简介承诺
-> POST /analysis/rubric
-> 生成成熟样本可迁移原则和评分 Rubric
-> POST /analysis/score
-> 用同一标准评分用户章节，输出证据、短板、改法和 revisionPrompt
```

高级质检用于更精确地判断“这章是否兑现目标平台和目标读者期待”。

### 3. Full Book Asset Analysis

```text
TXT 上传
-> 保存 raw.txt 和 normalized.txt
-> 清洗/切章预览
-> 用户确认后创建 book_analysis_jobs
-> 每章 Map 分析
-> 每章 map 结果写入 jobs/{jobId}/maps 并更新 partialResult
-> 全书 Reduce 归纳
-> 任务结果持久化
-> 历史任务列表重新打开
-> 图谱/时间线/世界书展示和导出
```

整书任务会持久化中间结果：每完成一个章节 map，系统会把该章拆解 JSON 写入 `.local/analysis/jobs/{jobId}/maps/`，并在 job 记录里更新 `partialResult`。如果模型 token 额度不足、网络失败或 reduce 失败，上传记录、章节切分预览、已完成章节 map 和失败状态仍会保留。

### 4. Research Library

```text
已完成整书任务
-> 提取图谱资产、引用证据和样本摘要
-> 多书横向对比
-> 针对研究问题做证据型问答
-> 生成选题/改稿 Prompt seed
```

研究库不追求通用聊天，而是把已拆解资料变成可追溯的创作判断。

## Analysis Dimensions

### Style Profile

- 目标平台：起点、番茄、晋江、七猫、微信短篇/小程序文、其他。
- 目标读者：男频快节奏爽文、女频情绪流、设定党、快节奏小白文、悬疑脑洞、其他。
- 阅读场景：长篇追更、移动端碎片阅读、短篇付费、其他。

评分报告会输出 `styleFit`，用于识别“故事结构可用但不适合目标平台”的问题。

### Market Profile

- 细分分类：例如都市神医、赘婿逆袭、追妻火葬场、真假千金。
- 主题承诺：例如逆袭打脸、救赎、破镜重圆、悬疑解谜。
- 标签：读者识别作品的 trope 或卖点标签。
- 显性关键词：标题、简介、正文中可以自然出现的词。
- 隐性期待：关键词背后的结构期待，例如“追妻火葬场 = 亏欠 + 离开 + 后悔 + 追逐”。
- 标题/简介承诺：用于检查正文是否兑现点击承诺。

评分报告会输出 `marketFit`，用于识别“章节可读但没有命中目标读者点击期待”的问题。

### Performance Snapshot

- 展现量：辅助判断分发入口、分类标签、平台推荐是否匹配。
- 点击率：辅助判断标题、简介、封面、关键词承诺和正文卖点是否一致。
- 阅读30s/60s：辅助判断开头理解成本、初始钩子、冲突升级和情绪维持。
- 触底率：辅助判断章节中后段节奏、空转和重复信息。
- 追更、加书架、下一章点击、前3章留存：辅助判断长篇追更承诺。
- 平均阅读进度、付费解锁：辅助判断短篇付费场景。

评分报告会输出 `performanceFit`。这些数据只做归因辅助，不能把低数据直接等同于文本差；模型必须结合章节证据判断可能原因。

## Revision Prompt

章节急诊和高级评分都会围绕改稿 Prompt 服务。Prompt 应包含：

- 修改目标：优先解决哪些追读、点击、留存问题。
- 平台风格：目标平台、读者、阅读场景。
- 市场定位：分类、主题、标签、关键词、隐性期待。
- 改写边界：保留人物、场景和剧情事实，不另起炉灶。
- 禁止事项：不堆设定、不机械堆关键词、不只润色文笔。
- 输出格式：要求写作 AI 返回改写策略、改动段落、改写正文和改动理由。

## API Skeleton

- `GET /api/v1/analysis/pipeline`: 返回计划中的分析流水线。
- `POST /api/v1/analysis/preview`: 不调用真实模型，返回结构化评分预览。
- `POST /api/v1/analysis/quick-review`: 章节急诊。
- `POST /api/v1/analysis/provider/test`: 测试 mock 或 OpenAI-compatible Provider。
- `GET /api/v1/analysis/provider/presets`: 返回模型供应商预设。
- `POST /api/v1/analysis/reference/profile`: 从成熟章节识别市场定位。
- `POST /api/v1/analysis/rubric`: 从成熟章节生成原则和 Rubric。
- `POST /api/v1/analysis/score`: 用 Rubric 质检用户章节。
- `POST /api/v1/analysis/book/preprocess`: 直接对文本做清洗和章节切分预览。
- `POST /api/v1/analysis/book/uploads`: 上传 TXT 并生成持久化章节预览。
- `GET /api/v1/analysis/book/uploads/:uploadId`: 读取上传预览。
- `GET /api/v1/analysis/book/uploads`: 读取上传历史。
- `POST /api/v1/analysis/book/uploads/:uploadId/jobs`: 从上传文本创建整书异步任务。
- `POST /api/v1/analysis/book/jobs/:jobId/resume`: 从已完成章节继续整书任务。
- `GET /api/v1/analysis/book/jobs/:jobId`: 查询整书异步任务状态。
- `GET /api/v1/analysis/book/jobs/:jobId/search`: 搜索整书拆解证据锚点。
- `GET /api/v1/analysis/book/jobs`: 读取任务历史。
- `GET /api/v1/analysis/book/jobs/:jobId/export`: 导出 Markdown、JSON、Tavern 角色卡、World Book、SillyTavern World Info、续写包、风格圣经、卷纲、提示词包、Do Not Copy 清单，支持 `mode=notes|originalized`。
- `GET /api/v1/analysis/research/library`: 读取持久化研究库资产。
- `POST /api/v1/analysis/research/compare`: 多书横向对比。
- `POST /api/v1/analysis/research/ask`: 基于研究库证据回答问题。

## Storage Plan

- PGlite/PostgreSQL: 上传记录、章节预览、任务状态、评分表、报告和研究库资产。
- Local FS: 原始上传文件、清洗后文本、章节 map 中间结果和导出报告。MVP 默认使用 `.local/analysis` 与 `.local/artifacts`。
- Redis: 后续承接分布式异步任务队列和短期任务状态，当前未接入运行时代码。
- MinIO/object storage: 后续替换本地文件系统，当前未接入运行时代码。

## Model Provider

- `mock`: 本地开发和自动化测试。
- `shared-gpu`: 服务端配置的共享 OpenAI-compatible 线路，用于降低首次使用门槛。
- `openai-compatible`: 兼容 OpenAI 风格接口的远程或本地模型。
- 供应商预设：`deepseek`、`doubao`、`qwen`、`ollama`、`custom`。

结构化输出按能力分层：

- 官方 OpenAI / Azure OpenAI URL：优先使用 `response_format=json_schema`。
- 明确支持 JSON Schema 的兼容供应商：可通过 `ENABLE_OPENAI_COMPAT_JSON_SCHEMA=true` 开启。
- 只支持 JSON mode 或普通聊天补全的供应商：使用 `json_object`/Prompt 约束，并保留后端 JSON 修复和 Rubric 兜底。

用户 Key 随请求进入本地 API，不持久化；日志不得打印 Key、正文全文和模型原始响应。

## Product Safety Principle

工具只提供拆解、学习、质检和导出能力，不预设用户意图。界面必须明确风险提示，默认不鼓励未授权商业化复制原作姓名、专有名词、人物关系网、关键事件链或世界历史具体事件。

## Naming

产品中文名：`AI小说第一步`

产品英文名：`AI Novel First Step`

命名理由：覆盖“新手怎么用 AI 写小说”“AI 写网文第一步”“新手用 AI 写小说遇到的困难”等搜索意图，同时保留产品解释空间。英文名用于界面品牌并列展示，方便后续 README、GitHub、Docker 镜像和国际化描述统一。
