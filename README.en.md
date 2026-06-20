# AI Novel First Step

[简体中文](./README.md) | [English](./README.en.md)

[![CI - workspace](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml/badge.svg)](https://github.com/myyimu/ai-novel-first-step/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

AI Novel First Step is a local-first AI chapter triage and sample analysis tool for web novel writers. It is not a ghostwriting app. It helps new writers rescue the first chapter first: paste a chapter, find the biggest retention problem, get a revision prompt they can copy into their writing AI, and then move into reference-sample rubrics, advanced critique, full-book assets, and research workflows when needed.

> Alpha status: suitable for local experiments, feature validation, and feedback collection. Do not expose it as a production public service yet.

## Screenshot

![AI Novel First Step workspace](./docs/assets/ai-novel-first-step-home.png)

_The interface is evolving quickly. This screenshot is for reference only; use the current app as the source of truth._

## Contents

- [What Problem It Solves](#what-problem-it-solves)
- [Recommended Workflow](#recommended-workflow)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Model Providers](#model-providers)
- [Local Development](#local-development)
- [Workspace](#workspace)
- [Local Data](#local-data)
- [Quality Gates](#quality-gates)
- [Current Limitations](#current-limitations)
- [Friendly Links](#friendly-links)
- [Open Source](#open-source)

## What Problem It Solves

- You finished a first chapter, but do not know where readers may drop off.
- You do not know whether the biggest issue is the opening, hook, emotion, pacing, setup, or market promise.
- You want AI feedback to become a copyable revision prompt, not vague advice.
- You want to turn mature samples into a rubric, then critique your own draft with the same standard.
- You want to upload a full TXT novel and extract worldbuilding, characters, plotlines, timelines, and reusable writing assets.

## Recommended Workflow

For first-time users, start with the shortest loop:

```text
Paste your chapter -> run chapter triage -> read the biggest retention problem -> copy the revision prompt -> revise and run it again
```

When you need a deeper critique, move into the advanced workflow:

```text
Import a mature reference chapter -> infer market positioning -> generate a scoring rubric -> score your own chapter with the same standard
```

Full-book assets and the research library are advanced workflows. Use them when you already have a complete TXT file or multiple analyzed samples and want character cards, world books, style rules, topic decisions, and traceable evidence.

## Features

- Chapter triage: paste only your own chapter and get positioning, selling points, the biggest problem, concrete fixes, and a revision prompt.
- Retest loop: compare quick-review results before and after revision to check whether the change actually solved the problem.
- Advanced critique: analyze a mature reference chapter, generate a scoring rubric, and score your own chapter with the same standard.
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

If you just want to try the product quickly on Windows, use the one-click local startup:

```powershell
pnpm run start:local
```

Then open:

```text
Web: http://127.0.0.1:3000
```

After the page opens, you can skip advanced configuration at first. Paste a chapter and run chapter triage. If the shared model path is unavailable or slow, switch to your own model provider in “AI Settings”.

For engineering work, One CLI is the recommended path.

Install dependencies first:

```bash
pnpm install
```

Start the full workspace with One CLI:

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

Windows one-click local startup:

```powershell
pnpm run start:local
```

You can also double-click:

```text
scripts/start-local.cmd
```

The startup script now checks `Node.js` and `pnpm` automatically before launching `api` and `web`.
This project now declares its Node.js baseline in `.nvmrc` and `package.json#engines`.
If Node.js is missing or too old, the script will try to use that project version first.
If `pnpm` is missing, it will try to activate `pnpm@10.14.0` with `corepack` first, then fall back to `npm install -g`.
In most cases the script can continue in the same window after installation. Only reopen the terminal if it explicitly says the current shell still cannot find `node` or `pnpm`.
See [scripts/START-LOCAL-GUIDE.md](./scripts/START-LOCAL-GUIDE.md) for the consolidated bilingual startup guide.

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
Web: http://localhost:3000
API: http://localhost:3001/api/v1
```

## Workspace

- `apps/web`: Next.js console.
- `services/api`: NestJS API for text cleaning, chapter splitting, async jobs, full-book analysis, and exports.
- `packages/ai-core`: Shared types, scoring metrics, and analysis contracts.

## Local Data

If `DATABASE_URL` is not configured, the API uses `.local/pglite` as the local development database.

## Docker Compose

Docker Compose is suitable for local deployment or demos when Docker Desktop is already installed. Non-engineering users should usually start with `pnpm run start:local`.

Copy the root environment template and start the stack:

```bash
cp .env.example .env
docker compose up --build
```

Default URLs:

```text
Web: http://localhost:3000
API: http://localhost:3001/api/v1
Health: http://localhost:3001/health
```

The compose stack starts only the services currently used by the code: `postgres`, `api`, and `web`. Redis and MinIO are not started by default because no runtime client uses them yet.

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
pnpm run one:doctor
pnpm run check
pnpm run test
pnpm run build
pnpm run ci
pnpm run container:prepare
pnpm run container:dry-run
pnpm run doctor
```

`check` runs lint and formatting checks for each project. Formatting is scoped to code and config files to avoid rewriting One CLI generated `CLAUDE.md` / `AGENTS.md` files.

`container:prepare` builds web / api and writes the production artifacts needed by One CLI project-directory Docker contexts into `.one-container`. The directory is temporary and ignored by Git.

`one:doctor` checks the One CLI workspace manifest, `one dev --dry-run`, Docker container targets, Kustomize ports/env, `.one-container` production artifacts, and deploy profile status. A missing local Kubernetes/kustomize deploy profile is reported as a warning and does not block normal development checks.

`doctor` runs the full `ci` script, then `container:prepare` and `one:doctor`. The workspace CI job uses this same entry point.

## Current Limitations

- This is an Alpha / MVP project. AI analysis and scoring are not guaranteed to be correct.
- Partial results are persisted, but resume-from-checkpoint and partial export UI are not fully implemented yet.
- For real PostgreSQL deployments, run `pnpm --filter api db:push` or generate migrations when schema changes.
- There is no account system yet. The project is currently best suited for local single-user deployment.
- The tool only provides analysis, learning, critique, and export features. Users are responsible for confirming they have the necessary rights or legal basis for uploaded texts and exported assets.

## Friendly Links

- [linux.do](https://linux.do/)
- [One CLI](https://github.com/1cli-team/one-cli)
- [mediago-drama](https://github.com/mediago-dev/mediago-drama)

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
one container build --dry-run -o json
```
