# AI Novel First Step

[简体中文](./README.md) | [English](./README.en.md)

[![CI - workspace](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml/badge.svg)](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

AI Novel First Step is a local-first AI tool for novel analysis and draft critique. It is not a ghostwriting app. It helps new writers analyze proven web novel samples, turn those patterns into writing rubrics, and then check their own chapters against those standards.

> Alpha status: suitable for local experiments, feature validation, and feedback collection. Do not expose it as a production public service yet.

## Screenshot

![AI Novel First Step workspace](./docs/assets/ai-novel-first-step-home.png)

## Contents

- [What Problem It Solves](#what-problem-it-solves)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Model Providers](#model-providers)
- [Local Development](#local-development)
- [Workspace](#workspace)
- [Local Data](#local-data)
- [Quality Gates](#quality-gates)
- [Current Limitations](#current-limitations)
- [Open Source](#open-source)

## What Problem It Solves

- You do not know why popular web novels work.
- You do not know which parts of your own chapter are effective or weak.
- You do not know how platform style, reader expectations, categories, tags, and keywords affect a chapter.
- You want to turn mature samples into a rubric, then critique your own draft with the same standard.
- You want to upload a full TXT novel and extract worldbuilding, characters, plotlines, timelines, and reusable writing assets.

## Features

- Reference chapter analysis: analyze a mature chapter and generate a scoring rubric.
- Draft critique: score your own chapter against the rubric with evidence, weaknesses, and revision prompts.
- Platform profile: model target platform, target readers, reading mode, category, theme, tags, and keywords.
- Performance signals: use impressions, CTR, 30s/60s read retention, completion rate, and follow rate as diagnostic context.
- Full-book analysis: upload a TXT file, clean text, split chapters, and run async Map-Reduce analysis.
- Partial result persistence: each chapter map is saved locally so token exhaustion or job failure does not waste completed work.
- Export center: export Markdown, JSON, Tavern character cards, World Book, SillyTavern World Info, continuation packs, style bibles, outlines, prompt packs, and Do Not Copy lists.
- Originalized export: choose between source analysis notes and abstracted, de-identified creative assets.

## Tech Stack

- Monorepo: One CLI
- Web: Next.js
- API: NestJS
- DB: PostgreSQL / PGlite fallback
- Package manager: pnpm
- Model provider: BYOK, OpenAI-compatible

## Model Providers

The app uses BYOK by default. API keys are sent per request and are not persisted.

- mock: local demo and automated validation.
- DeepSeek.
- Doubao / Volcengine Ark.
- Alibaba Cloud Bailian / Tongyi Qianwen.
- Ollama local models.
- Custom OpenAI-compatible endpoints.

## Local Development

Install dependencies first:

```bash
pnpm install
```

Recommended: start the full workspace with One CLI:

```bash
pnpm run dev:dry-run
pnpm run dev
```

`pnpm run dev` is managed by One CLI and starts `web`, `api`, and `ai-core` according to `one.manifest.json`.

If One CLI is not installed, use the raw pnpm startup path:

```bash
pnpm run dev:raw
```

This starts `web`, `api`, and `ai-core` in parallel without the `one` command.

Start individual projects with One CLI:

```bash
pnpm run dev:web
pnpm run dev:api
pnpm run dev:core
```

Start individual projects without One CLI:

```bash
pnpm run dev:web:raw
pnpm run dev:api:raw
pnpm run dev:core:raw
```

Default local URLs:

```text
Web: http://localhost:3001
API: http://localhost:3000/api/v1
```

## Workspace

- `apps/web`: Next.js console.
- `services/api`: NestJS API for text cleaning, chapter splitting, async jobs, full-book analysis, and exports.
- `packages/ai-core`: Shared types, scoring metrics, and analysis contracts.

## Local Data

If `DATABASE_URL` is not configured, the API uses `.local/pglite` as the local development database.

Uploaded text and intermediate full-book analysis artifacts are stored under:

```text
.local/analysis
```

Chapter map results are saved under:

```text
.local/analysis/jobs/{jobId}/maps/
```

`.local` is ignored by Git. Do not commit uploaded novels, model outputs, local databases, or API keys.

## Quality Gates

```bash
pnpm run check
pnpm run test
pnpm run build
pnpm run ci
```

`check` runs lint and formatting checks for each project. Formatting is scoped to code and config files to avoid rewriting One CLI generated `CLAUDE.md` / `AGENTS.md` files.

## Current Limitations

- This is an Alpha / MVP project. AI analysis and scoring are not guaranteed to be correct.
- Partial results are persisted, but resume-from-checkpoint and partial export UI are not fully implemented yet.
- For real PostgreSQL deployments, run `pnpm --filter api db:push` or generate migrations when schema changes.
- There is no account system yet. The project is currently best suited for local single-user deployment.
- The tool only provides analysis, learning, critique, and export features. Users are responsible for confirming they have the necessary rights or legal basis for uploaded texts and exported assets.

## Open Source

- License: MIT. See [LICENSE](./LICENSE).
- Repository: [github.com/myyimu/ai-novel-first-step](https://github.com/myyimu/ai-novel-first-step)
- Contact: [xiaoke5211@gmail.com](mailto:xiaoke5211@gmail.com)
- Contributing: see [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: see [SECURITY.md](./SECURITY.md)

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

The real workspace state is defined by `one.manifest.json`. Useful commands:

```bash
one dev --dry-run -o json
one container info -o json
```
