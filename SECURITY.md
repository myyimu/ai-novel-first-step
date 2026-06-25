# Security Policy

## Supported Status

AI网文诊断台 / AI Novel Diagnosis Desk is currently Alpha software. It is intended for local experiments, feature validation, and feedback collection. Do not expose it as a production public service yet.

## Reporting a Vulnerability

Please report security issues privately by email:

```text
xiaoke5211@gmail.com
```

Include:

- A short description of the issue.
- Steps to reproduce.
- Impact and affected area, if known.
- Whether the issue may expose API keys, uploaded text, local files, or model outputs.

Please do not open public issues for vulnerabilities involving API keys, uploaded novels, local databases, authentication, path traversal, arbitrary file access, or server-side request behavior.

## Data Handling Notes

- The default model setup is BYOK. API keys are sent per request and should not be persisted by the app.
- Local uploaded texts, model outputs, and intermediate analysis artifacts are stored under `.local` during development.
- `.local` is ignored by Git and should never be committed.
- Users are responsible for confirming that they have the rights or legal basis to upload texts and export derived assets.

## Maintainer Response

This is a small open-source project. Best-effort response time is 7 days for confirmed security reports.
