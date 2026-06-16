# AI小说第一步

[简体中文](./README.md) | [English](./README.en.md)

[![CI - workspace](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml/badge.svg)](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

本地部署的 AI 小说拆解与质检工具。它不是代写工具，而是帮助新手先拆解成熟样本，生成可参考的写作标准，再检查自己的章节哪里好、哪里差、怎么改。

> Alpha 阶段：当前适合本地试用、功能验证和收集反馈，不建议直接作为生产服务暴露到公网。

## 产品截图

![AI小说第一步工作台](./docs/assets/ai-novel-first-step-home.png)

## 目录

- [适合解决什么问题](#适合解决什么问题)
- [主要功能](#主要功能)
- [技术栈](#技术栈)
- [支持的模型接入](#支持的模型接入)
- [本地启动](#本地启动)
- [Workspace](#workspace)
- [本地数据](#本地数据)
- [质量检查](#质量检查)
- [当前限制](#当前限制)
- [开源信息](#开源信息)

## 适合解决什么问题

- 不知道热榜网文到底好在哪里。
- 不知道自己写的章节哪里有效、哪里空转。
- 不知道目标平台、读者、分类、关键词会怎样影响章节判断。
- 想把成熟样本拆成 Rubric，再用同一套标准质检自己的稿子。
- 想上传整本 TXT，拆出世界观、人物、故事线、大事纪和可导出的写作资产。

## 主要功能

- 单章拆评：拆解成熟参考章节，生成评分 Rubric。
- 章节质检：按 Rubric 给自己的章节评分，输出证据、短板和改文提示词。
- 平台画像：支持目标平台、目标读者、阅读场景、分类、主题、标签和关键词。
- 数据辅助：支持展现量、点击率、阅读 30s/60s、触底率、追更率等表现归因。
- 整书拆解：上传 TXT，清洗文本、章节切分、异步 Map-Reduce 拆书。
- 中间结果留存：每章 map 完成后写入本地文件，token 不足或任务失败时不至于白跑。
- 导出中心：支持 Markdown、JSON、Tavern 角色卡、World Book、SillyTavern World Info、续写包、风格圣经、卷纲、提示词包和 Do Not Copy 清单。
- 原创化导出：可选择原作拆解笔记或抽象、去标识化后的原创化素材包。

## 技术栈

- Monorepo: One CLI
- Web: Next.js
- API: NestJS
- DB: PostgreSQL / PGlite fallback
- Package manager: pnpm
- Model provider: BYOK, OpenAI-compatible

## 支持的模型接入

默认提供公共免费模型入口，也支持用户自带 Key；用户填写的 API Key 不持久化保存。

- mock：本地演示和自动化验证。
- AI Horde 公共模型池：默认入口，匿名低优先级队列，不需要用户填写 Key。
- OpenRouter 免费模型：服务端配置 OpenRouter Key，默认使用 `openrouter/free`，前端不要求用户填写 Key。
- 免费共享算力：由服务端配置 OpenAI-compatible 共享线路，前端不要求用户填写 Key。
- DeepSeek。
- 豆包 / 火山方舟。
- 阿里云百炼 / 通义千问。
- Ollama 本地模型。
- 自定义 OpenAI-compatible 接口。

## 本地启动

先安装依赖：

```bash
pnpm install
```

推荐使用 One CLI 启动整个 workspace：

```bash
pnpm run dev:dry-run
pnpm run dev
```

`pnpm run dev` 由 One CLI 接管，会按 `one.manifest.json` 中的项目定义启动 `web`、`api` 和 `ai-core`。

如果没有安装 One CLI，也可以使用 pnpm 原生命令启动：

```bash
pnpm run dev:raw
```

这会并行启动 `web`、`api` 和 `ai-core`，不依赖 `one` 命令。

Windows 本地一键启动：

```powershell
pnpm run start:local
```

也可以直接双击：

```text
scripts/start-local.cmd
```

这个脚本会打开两个 PowerShell 窗口，分别启动 `api` 和 `web`，并自动设置：

```text
Web: http://127.0.0.1:3000
API: http://127.0.0.1:3001/api/v1
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001/api/v1
```

关闭打开的 API / Web PowerShell 窗口即可停止服务。

单独启动某个项目，One CLI 版本：

```bash
pnpm run dev:web
pnpm run dev:api
pnpm run dev:core
```

单独启动某个项目，无 One CLI 版本：

```bash
pnpm run dev:web:raw
pnpm run dev:api:raw
pnpm run dev:core:raw
```

默认本地地址：

```text
Web: http://127.0.0.1:3000
API: http://127.0.0.1:3001/api/v1
```

## Workspace

- `apps/web`: Next.js 控制台。
- `services/api`: NestJS API，负责文本清洗、章节切分、异步任务、整书拆解和导出。
- `packages/ai-core`: 共享类型、评分指标和分析契约。

## 本地数据

默认不配置 `DATABASE_URL` 时，API 会使用 `.local/pglite` 作为本地开发数据库。

默认的 AI Horde 公共模型池不需要配置 Key；如果要提升 Horde 排队优先级，可以在 API 服务环境变量中配置：

```text
AI_HORDE_API_KEY=your-horde-key
AI_HORDE_MODEL=aphrodite/TheDrummer/Cydonia-24B-v4.3
```

如果要启用“OpenRouter 免费模型”入口，需要在 API 服务环境变量中配置：

```text
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_FREE_MODEL=openrouter/free
OPENROUTER_HTTP_REFERER=http://localhost:3001
OPENROUTER_APP_TITLE=AI小说第一步
```

如果要换成其他 OpenAI-compatible 免费/共享推理线路，可以配置通用共享算力入口：

```text
SHARED_GPU_BASE_URL=https://your-shared-gpu.example.com/v1
SHARED_GPU_MODEL=your-model-id
SHARED_GPU_API_KEY=optional-backend-only-key
```

免费线路适合降低首次使用门槛，但可能排队、限流、超时、质量波动或不适合敏感文本；建议上线时配合限流和日志审计。

上传文本和整书拆解中间结果默认保存在：

```text
.local/analysis
.local/artifacts
```

其中整书任务的章节 map 会写入：

```text
.local/artifacts/{jobId}/map-{chapterId}.json
```

`.local` 已被 `.gitignore` 忽略，不应提交上传文本、模型输出、本地数据库或 API Key。

## 质量检查

```bash
pnpm run check
pnpm run test
pnpm run build
pnpm run ci
```

`check` 会运行各项目的 lint 和格式检查；格式检查只覆盖代码和配置文件，避免修改 One CLI 生成的 `CLAUDE.md` / `AGENTS.md`。

## 当前限制

- 这是 Alpha / MVP，不保证 AI 拆解和评分完全准确。
- 中间结果已经留存，但断点续跑和半成品导出 UI 还未完整实现。
- 真实 PostgreSQL 部署时，如果 schema 有变化，需要运行 `pnpm --filter api db:push` 或生成迁移。
- 当前没有账号系统，更适合本地单人部署。
- 工具只提供拆解、学习、质检和导出能力；用户需要自行确认上传文本和导出素材的使用权与风险边界。

## 开源信息

- License: MIT，见 [LICENSE](./LICENSE)。
- Repository: [github.com/myyimu/ai-novel-first-step](https://github.com/myyimu/ai-novel-first-step)
- Contact: [xiaoke5211@gmail.com](mailto:xiaoke5211@gmail.com)
- Contributing: 见 [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: 见 [SECURITY.md](./SECURITY.md)

## Recommended GitHub Topics

```text
ai-novel
webnovel
novel-analysis
novel-critique
writing-tools
local-first
byok
nextjs
nestjs
one-cli
```

## One CLI

真实 workspace 状态由 `one.manifest.json` 定义。常用命令：

```bash
one dev --dry-run -o json
one container info -o json
```
