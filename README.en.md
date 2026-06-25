# AI Novel Diagnosis Desk

[简体中文](./README.md) | [English](./README.en.md)

[![CI - workspace](https://github.com/myyimu/ai-novel-diagnosis/actions/workflows/ci.yml/badge.svg)](https://github.com/myyimu/ai-novel-diagnosis/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Do not rush into AI rewriting. First find out why readers do not continue.

AI Novel Diagnosis Desk is a local AI novel diagnosis and book-analysis tool. It is not a one-click novel generator. It helps writers answer: what is wrong with my story, why does it get no traffic, and why do readers drop off in chapter one?

Paste your first chapter, and it identifies the biggest retention problem, explains the issue with evidence from the text, gives a revision priority, and generates a prompt you can copy into your writing AI. After revision, paste the new version back in and run a retest.

For advanced use, it also supports AI book analysis: characters, relationships, worldbuilding, timelines, story structure, and exportable writing assets for learning mature works without copying them.

> Alpha status: suitable for local experiments, feature validation, and feedback collection. Do not expose it as a production public service yet.

## Try It In 3 Minutes

On Windows, double-click:

```text
scripts/start-local.cmd
```

The script checks Node.js / pnpm, installs missing dependencies, starts the API and Web app, and opens the page automatically. After the page opens, skip advanced configuration at first. Paste your first chapter and run chapter triage.

If you are already in a terminal at the repository root, run:

```powershell
pnpm run start:local
```

Default URLs:

```text
Web: http://127.0.0.1:3000
API: http://127.0.0.1:3001/api/v1
```

## What You Get

- A clear diagnosis of the biggest first-chapter drop-off risk: opening, hook, emotion, pacing, setup, or market promise.
- A concrete explanation of why the chapter may not get traffic, clicks, retention, or follow-up reading.
- A copyable revision prompt: concrete instructions you can pass to a writing AI, not vague critique.
- A retest loop: run the revised chapter again and compare whether the core issue changed.
- Advanced assets: reference-sample rubrics, full-book character/world analysis, relationship graphs, timelines, and export packs.

## Why Not Use Built-In Review From A One-Click Writing Tool

One-click writing tools are good at producing more text. AI Novel Diagnosis Desk focuses on why the text does not keep readers.

| One-click writing tool | AI Novel Diagnosis Desk |
| --- | --- |
| Generates more prose | Finds why readers do not continue |
| Often gives generic critique | Ties diagnosis to text evidence |
| Tends to rewrite for you | Explains the cause before giving a revision prompt |
| Hard to compare before and after | Supports a retest loop |
| Usually a one-off output | Builds rubrics, relationship graphs, world books, and export assets |

Short version:

```text
One-click writing tools help you write more. AI Novel Diagnosis Desk helps you understand why the writing does not retain readers.
```

## How It Diagnoses What Is Wrong

It should not only give a score, and you should not have to blindly trust AI. The report follows one evidence chain:

```text
Problem -> Text evidence -> Reader reaction -> Revision priority -> Revision prompt -> Retest checklist
```

It focuses on:

- Where chapter one loses readers.
- Whether the title/blurb promise matches the chapter experience.
- Whether the protagonist has a concrete goal, pressure, loss, and choice.
- Whether payoff, conflict, and emotion arrive too late.
- Whether exposition blocks the story.
- Whether the text wastes clicks even when it gets traffic.

It does not predict platform algorithms. It diagnoses whether the text wastes the click it already got.

## Is AI Book Analysis Just Copying

No. AI book analysis is not for copying source works. It extracts structural lessons:

- Character functions.
- Conflict rhythm.
- Worldbuilding organization.
- Relationship evolution.
- Timelines.
- Reusable structure.
- Do-not-copy list.

The principle is: learn structure, do not copy content.

## Screenshot

![AI Novel Diagnosis Desk workspace](./docs/assets/ai-novel-diagnosis-home.png)

_The interface is evolving quickly; use the current app as the source of truth._

## Contents

- [Try It In 3 Minutes](#try-it-in-3-minutes)
- [What You Get](#what-you-get)
- [Why Not Use Built-In Review From A One-Click Writing Tool](#why-not-use-built-in-review-from-a-one-click-writing-tool)
- [How It Diagnoses What Is Wrong](#how-it-diagnoses-what-is-wrong)
- [Is AI Book Analysis Just Copying](#is-ai-book-analysis-just-copying)
- [Who It Is For](#who-it-is-for)
- [Recommended Workflow](#recommended-workflow)
- [Core Capabilities](#core-capabilities)
- [Tech Stack](#tech-stack)
- [Model Providers](#model-providers)
- [Local Development](#local-development)
- [Workspace](#workspace)
- [Local Data](#local-data)
- [Quality Gates](#quality-gates)
- [Current Limitations](#current-limitations)
- [Friendly Links](#friendly-links)
- [Open Source](#open-source)

## Who It Is For

Good fit:

- New web novel writers who finished a first chapter but do not know why readers may drop off.
- Writers who want to know what is wrong with their novel, why it gets no traffic, or why readers do not continue.
- Writers who want AI critique to become executable revision tasks, not comments like "the pacing is slow".
- Writers who want to learn how mature samples deliver genre promise, character relationships, and emotional payoffs.
- Creators who want to turn a full TXT novel into character cards, world books, relationship graphs, timelines, and writing assets.

Not a good fit:

- Users who want AI to ghostwrite a whole book.
- Users who want to copy source works through analysis outputs.
- Teams that need accounts, permissions, collaboration, and production hosting.

## Recommended Workflow

For first-time users, start with the shortest loop:

```text
Paste your chapter -> run chapter triage -> read the biggest retention problem -> copy the revision prompt -> revise and run it again
```

When you need a deeper critique, move into the advanced workflow:

```text
Import a mature reference chapter -> infer market positioning -> generate a scoring rubric -> score your own chapter with the same standard
```

When you already have a complete TXT file or multiple samples, move into full-book analysis:

```text
Upload a full TXT -> preview chapter split -> run Map-Reduce analysis -> review the relationship graph -> export character/world/continuation assets
```

The current page structure is intentionally compressed: `/` is the chapter triage room, `/critique` is advanced chapter critique, `/model` is AI settings, and `/book` is full-book analysis plus result management. `/workspace`, `/starter`, `/history`, `/export`, and `/library` remain compatibility routes and redirect back to the home or full-book workflow.

## Core Capabilities

First-chapter triage:

- Paste only your own first chapter and get positioning, selling points, the biggest problem, concrete fixes, and a revision prompt.
- Run the revised chapter again and compare quickScore plus issue changes.
- Start without reference samples, platform profiles, or complex configuration.

Advanced chapter critique:

- Analyze a mature reference chapter and infer category, theme, tags, implicit expectations, and title/blurb promises.
- Generate a transferable rubric, then score your own chapter with the same standard.
- Use impressions, CTR, 30s/60s read retention, completion rate, and follow rate as diagnostic context.

Full-book visual analysis:

- Upload a TXT file, clean text, preview chapter splitting, and run async Map-Reduce analysis.
- Save each completed chapter map locally, so token exhaustion or job failure does not waste completed work.
- Extract characters, factions, locations, worldbuilding, plotlines, timelines, and reusable writing assets.

Relationship graph workbench:

- Turn full-book results into an interactive graph with overview, review, timeline, node dragging, and graph export.
- Confirm weak-evidence edges, edit relation labels, merge duplicate nodes, or ignore noisy nodes.
- Export Markdown, JSON, Tavern character cards, World Book, SillyTavern World Info, continuation packs, style bibles, outlines, prompt packs, and Do Not Copy lists.

## Tech Stack

- Monorepo: One CLI
- Web: Next.js
- API: NestJS
- DB: PostgreSQL / PGlite fallback
- Package manager: pnpm
- Model provider: BYOK, OpenAI-compatible

## Model Providers

The app provides public/shared model entry points by default and also supports BYOK. User-provided API keys are sent per request and are not persisted.

- mock: local demo and automated validation.
- AI Horde public pool: anonymous low-priority shared queue.
- OpenRouter free models: backend-configured OpenRouter key, with no frontend key required.
- Shared compute: backend-configured OpenAI-compatible shared line.
- DeepSeek.
- Doubao / Volcengine Ark.
- Alibaba Cloud Bailian / Tongyi Qianwen.
- Ollama local models.
- Custom OpenAI-compatible endpoints.

## Local Development

For a quick product trial, start with [Try It In 3 Minutes](#try-it-in-3-minutes). This section is for developers and users who need startup options.

`scripts/start-local.cmd` runs environment checks before startup: Node.js / pnpm validation, guided dependency installation, missing `pnpm install`, healthy service reuse, nearby port search, and API/Web logs under `.local/run-logs`.

If the shared model path is unavailable or slow, switch to your own model provider in "AI Settings".

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

Windows one-click local startup for first-time users:

```text
scripts/start-local.cmd
```

This entry point runs environment checks first, then starts the app:

- checks Node.js and pnpm against the project version policy.
- guides dependency installation; `scripts/start-local.cmd -a` uses auto-install mode.
- runs `pnpm install` when workspace dependencies are missing.
- reuses healthy project services, or searches nearby ports when defaults are occupied.
- opens separate API and Web PowerShell windows and writes logs to `.local/run-logs`.
- opens the Web page after startup unless disabled.

If you are already in a terminal at the workspace root, use the equivalent npm script:

```powershell
pnpm run start:local
```

Common startup commands:

```powershell
scripts/start-local.cmd
scripts/start-local.cmd -a
pnpm run start:local -- -NoBrowser
pnpm run start:local -- -Kill
pnpm run start:local -- -WebPort 3100 -ApiPort 3101
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

- `apps/web`: Next.js console for chapter triage, advanced critique, AI settings, and full-book analysis.
- `services/api`: NestJS API for text cleaning, chapter splitting, async jobs, full-book analysis, and exports.
- `packages/ai-core`: Shared types, scoring metrics, and analysis contracts.

## Local Data

If `DATABASE_URL` is not configured, the API uses `.local/pglite` as the local development database.

## Docker Compose

Docker Compose is suitable for local deployment or demos when Docker Desktop is already installed. Non-engineering users should usually start with `scripts/start-local.cmd`.

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
- Partial results are persisted, and failed/interrupted full-book jobs have a basic resume path. More granular partial export and persisted graph-review corrections are still being iterated.
- Relationship graphs support local manual corrections and correction-aware JSON export, but correction records are not yet stored as a separate database entity.
- For real PostgreSQL deployments, run `pnpm --filter api db:push` or generate migrations when schema changes.
- There is no account system yet. The project is currently best suited for local single-user deployment.
- The tool only provides analysis, learning, critique, and export features. Users are responsible for confirming they have the necessary rights or legal basis for uploaded texts and exported assets.

## Friendly Links

- [linux.do](https://linux.do/)
- [One CLI](https://github.com/1cli-team/one-cli)
- [mediago-drama](https://github.com/mediago-dev/mediago-drama)

## Open Source

- License: MIT. See [LICENSE](./LICENSE).
- Repository: [github.com/myyimu/ai-novel-diagnosis](https://github.com/myyimu/ai-novel-diagnosis)
- Contact: [xiaoke5211@gmail.com](mailto:xiaoke5211@gmail.com)
- Contributing: see [CONTRIBUTING.md](./CONTRIBUTING.md)
- Security policy: see [SECURITY.md](./SECURITY.md)
- GitHub Social Preview candidate: [docs/assets/github-social-preview.png](./docs/assets/github-social-preview.png).

## Recommended GitHub Topics

```text
ai-novel
ai
llm
artificial-intelligence
prompt-engineering
natural-language-processing
knowledge-graph
text-analysis
storytelling
webnovel
novel
novel-analysis
book-analysis
novel-diagnosis
webnovel-diagnosis
ai-writing
writing-assistant
relationship-graph
writing
writing-tools
```

## One CLI

The real workspace state is defined by `one.manifest.json`. Useful commands:

```bash
one dev --dry-run -o json
one container info -o json
one container build --dry-run -o json
```
