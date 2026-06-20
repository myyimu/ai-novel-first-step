# API Service

`services/api` 是 AI 小说第一步的 NestJS 后端。

它负责模型调用、章节急诊、成熟样本拆解、评分、整书异步任务、研究库和导出。前端通过 `/api/v1` 访问这些接口；本地开发默认监听 `http://127.0.0.1:3001/api/v1`。

## 主要模块

- `analysis`: 小说分析主模块，包含章节急诊、参考画像、Rubric、评分、整书拆解和导出。
- `research-library`: 从已完成整书任务生成研究库资产，支持多书对比和证据问答。
- `health`: 健康检查。
- `auth` / `user` / `common`: 模板保留模块，当前不是产品主路径。

## 核心接口

### 章节急诊

- `POST /api/v1/analysis/quick-review`

只需要用户章节正文，返回定位、卖点、最大问题、改法、推荐平台、`quickScore` 和置信度。用于首屏最短闭环。

### 高级章节质检

- `POST /api/v1/analysis/reference/profile`
- `POST /api/v1/analysis/rubric`
- `POST /api/v1/analysis/score`

先从成熟参考章节识别市场定位，再生成评分 Rubric，最后用同一套标准评分用户章节。

### 模型供应商

- `POST /api/v1/analysis/provider/test`
- `GET /api/v1/analysis/provider/presets`

支持 mock、共享 OpenAI-compatible 线路、自备 Key、DeepSeek、豆包/火山方舟、通义千问、Ollama 和自定义 OpenAI-compatible 接口。

### 整书资产

- `POST /api/v1/analysis/book/uploads`
- `GET /api/v1/analysis/book/uploads/:uploadId`
- `GET /api/v1/analysis/book/uploads`
- `POST /api/v1/analysis/book/uploads/:uploadId/jobs`
- `POST /api/v1/analysis/book/jobs/:jobId/resume`
- `GET /api/v1/analysis/book/jobs/:jobId`
- `GET /api/v1/analysis/book/jobs/:jobId/search`
- `GET /api/v1/analysis/book/jobs`
- `GET /api/v1/analysis/book/jobs/:jobId/export`

整书任务采用异步 Map-Reduce。每章 map 结果会持久化，任务失败时已完成章节不会丢失。

### 研究库

- `GET /api/v1/analysis/research/library`
- `POST /api/v1/analysis/research/compare`
- `POST /api/v1/analysis/research/ask`

研究库基于已完成整书任务，服务多书横向对比、证据链和创作决策问答。

## 本地数据

未配置 `DATABASE_URL` 时，开发环境使用 `.local/pglite`。

上传文本、章节切分、任务中间结果和导出产物保存在：

```text
.local/analysis
.local/artifacts
```

这些目录已被 Git 忽略。不要提交上传文本、模型输出、本地数据库或 API Key。

## 环境变量

常用变量见根目录 `.env.example`。

共享模型入口可由服务端配置：

```text
SHARED_GPU_BASE_URL=https://your-shared-gpu.example.com/v1
SHARED_GPU_MODEL=your-model-id
SHARED_GPU_API_KEY=optional-backend-only-key
SHARED_GPU_JSON_MODE=false
```

结构化输出策略：

- 官方 OpenAI / Azure OpenAI URL 会优先使用 `response_format=json_schema`。
- 其他 OpenAI-compatible 供应商默认使用 `json_object`/Prompt 约束和后端 JSON 修复兜底。
- 如果某个兼容供应商明确支持 JSON Schema，可以设置：

```text
ENABLE_OPENAI_COMPAT_JSON_SCHEMA=true
```

用户在前端填写的 API Key 随请求发送到本地 API，不会持久化保存；日志也不应打印 Key、正文全文或模型原始响应。

## 本地开发

通常从仓库根目录启动：

```bash
pnpm run dev
```

只启动 API：

```bash
pnpm --filter api dev
```

默认地址：

```text
API: http://127.0.0.1:3001/api/v1
Health: http://127.0.0.1:3001/health
Swagger: http://127.0.0.1:3001/api/docs
```

## 常用命令

```bash
pnpm --filter api check
pnpm --filter api test
pnpm --filter api build
pnpm --filter api db:push
```

## 维护原则

- 首屏接口优先保障 `quick-review` 的稳定性和错误解释。
- 高级质检接口必须保留证据、原因和可执行改法，避免只返回泛泛评分。
- 整书任务必须保留中间结果，避免长文本任务失败后完全白跑。
- 所有模型路径都必须支持 mock fallback，方便本地验证和自动化测试。
