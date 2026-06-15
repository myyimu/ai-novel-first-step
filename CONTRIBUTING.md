# Contributing

感谢你关注 AI小说第一步 / AI Novel First Step。

This project is in Alpha. Contributions are welcome, but please keep changes small, testable, and aligned with the local-first, BYOK product direction.

## Before You Start

- Do not commit API keys, uploaded novels, model outputs, local databases, or files under `.local`.
- Do not attach copyrighted full-text novels to public issues or pull requests.
- Keep generated One CLI guidance files such as `AGENTS.md` and `CLAUDE.md` unchanged unless the change is intentionally about workspace rules.
- Prefer focused pull requests: one bug fix, one feature slice, or one documentation improvement at a time.

## Local Setup

```bash
pnpm install
pnpm run dev:raw
```

If One CLI is installed, you can also run:

```bash
pnpm run dev:dry-run
pnpm run dev
```

Default local URLs:

```text
Web: http://localhost:3001
API: http://localhost:3000/api/v1
```

## Quality Gates

Run the checks that match your change. Before opening a larger pull request, run:

```bash
pnpm run check
pnpm run test
pnpm run build
```

For a full local verification:

```bash
pnpm run ci
```

## Product Principles

- The tool should critique, analyze, and help writers learn. It should not position itself as a one-click plagiarism or content laundering tool.
- Originalized exports must keep risk warnings visible and separate source notes from abstracted creative assets.
- BYOK model settings should remain user-owned. API keys should be sent per request and not persisted by default.
- UI changes should reduce cognitive load: group features by workflow, explain unfamiliar controls, and make job state obvious.

## Pull Request Checklist

- [ ] The change is scoped and described clearly.
- [ ] Relevant checks pass locally.
- [ ] README or docs are updated when behavior changes.
- [ ] No secrets, uploaded novels, generated model outputs, or local database files are committed.
- [ ] Risk and copyright-sensitive features keep user-facing warnings intact.
