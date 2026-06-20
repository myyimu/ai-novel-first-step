# Start Local Guide / 本地一键启动说明

Last updated: 2026-06-19

## Overview / 概述

This guide explains how the Windows local startup flow works for this project.
It covers environment detection, Node.js and pnpm preparation, dependency install, and service startup.

本文档说明本项目在 Windows 下的一键启动流程。
内容包括环境检测、Node.js 与 pnpm 准备、依赖安装，以及服务启动。

## Entry Points / 启动入口

Recommended commands:

```powershell
scripts/start-local.cmd
scripts/start-local.cmd -a
pnpm run start:local
```

推荐使用以上任一入口。

- `scripts/start-local.cmd`: beginner-friendly entry, suitable for double-click or direct execution.
- `scripts/start-local.cmd -a`: auto-install mode, skips confirmation prompts when dependencies are missing.
- `pnpm run start:local`: starts the same PowerShell flow from the workspace root.

- `scripts/start-local.cmd`：适合双击或直接执行，最适合普通用户。
- `scripts/start-local.cmd -a`：自动安装模式，缺依赖时尽量少交互。
- `pnpm run start:local`：从工作区根目录进入同一套启动流程。

## What The Script Does / 脚本会做什么

Before opening the API and Web windows, the startup flow now does the following:

1. Check the project Node.js requirement from `.nvmrc` and `package.json#engines`.
2. Check whether the current shell can use a compatible `node`.
3. Reuse an existing compatible `nvm` version when available.
4. If needed, try to install Node.js through `winget`, `Chocolatey`, or `nvm-windows`.
5. Ensure `pnpm` is available, preferring `corepack` and falling back to `npm install -g`.
6. Check whether workspace dependencies are installed.
7. If dependencies are missing, run `pnpm install` from the workspace root.
8. Start the API and Web dev servers in separate PowerShell windows.

在打开 API 和 Web 窗口之前，脚本现在会按下面顺序执行：

1. 从 `.nvmrc` 和 `package.json#engines` 读取项目要求的 Node.js 版本。
2. 检查当前终端是否能使用兼容版本的 `node`。
3. 如果本机 `nvm` 已有兼容版本，优先复用。
4. 如果没有，再尝试通过 `winget`、`Chocolatey` 或 `nvm-windows` 安装 Node.js。
5. 确保 `pnpm` 可用，优先使用 `corepack`，失败再回退到 `npm install -g`。
6. 检查工作区依赖是否已安装。
7. 如果依赖缺失，在工作区根目录自动执行 `pnpm install`。
8. 最后分别打开 API 和 Web 的 PowerShell 开发窗口。

## Project Version Policy / 项目版本策略

The project uses a project-scoped version policy instead of forcing a global machine default.

- `.nvmrc` is currently pinned to `20.11.0`.
- `package.json#engines.node` is `>=20.11.0 <21`.
- `package.json#engines.pnpm` is `>=10.14.0 <11`.
- `packageManager` is `pnpm@10.14.0`.

本项目采用“项目级版本约定”，而不是强改机器全局默认版本。

- `.nvmrc` 当前固定为 `20.11.0`
- `package.json#engines.node` 为 `>=20.11.0 <21`
- `package.json#engines.pnpm` 为 `>=10.14.0 <11`
- `packageManager` 为 `pnpm@10.14.0`

## Why This Is Safer / 为什么这样更稳

This approach minimizes impact on other projects:

- It prefers changing only the current startup session.
- It prefers reusing an existing compatible `nvm` version instead of replacing a global Node.js install.
- It follows the version declared by this repository rather than guessing.

这种做法对其他项目影响更小：

- 优先只影响当前启动会话。
- 优先复用本机已有的兼容 `nvm` 版本，而不是覆盖全局 Node.js。
- 优先遵循仓库内声明的版本，而不是脚本自行猜测。

## Dependency Installation / 依赖安装

If `node_modules` or required local binaries are missing, the startup script runs:

```powershell
pnpm install
```

This is why errors like `'nest' is not recognized` or `'next' is not recognized` should no longer appear before dependency installation is attempted.

如果 `node_modules` 或本地命令缺失，启动脚本会自动执行：

```powershell
pnpm install
```

因此像 `'nest' is not recognized`、`'next' is not recognized` 这类错误，不应该再在“尝试安装依赖之前”直接弹给用户。

## When You May Still Need To Reopen The Terminal / 什么时候仍然可能需要重开终端

Usually you do not need to reopen the terminal.

Only reopen PowerShell or CMD if the script explicitly says the current shell still cannot find `node` or `pnpm`.

通常不需要重开终端。

只有当脚本明确提示当前 shell 仍然找不到 `node` 或 `pnpm` 时，才需要重开 PowerShell 或 CMD。

## Expected Windows Behavior / Windows 下的预期表现

After the checks pass, the script opens two additional PowerShell windows:

- one for the API dev server
- one for the Web dev server

This is expected behavior.

在检查通过后，脚本会额外打开两个 PowerShell 窗口：

- 一个运行 API 开发服务
- 一个运行 Web 开发服务

这是预期行为。

If the startup flow is healthy, those windows should keep running the dev servers rather than exiting immediately with missing-command errors.

如果启动链路正常，这两个窗口应该持续运行开发服务，而不是立刻因为缺命令报错退出。

## Troubleshooting / 排查建议

If startup still fails:

1. Run `scripts/start-local.cmd -a`
2. Confirm `node --version`
3. Confirm `pnpm --version`
4. Run `pnpm install` manually once from the workspace root
5. Retry `scripts/start-local.cmd`

如果启动仍然失败，可以按下面顺序排查：

1. 运行 `scripts/start-local.cmd -a`
2. 确认 `node --version`
3. 确认 `pnpm --version`
4. 在工作区根目录手动执行一次 `pnpm install`
5. 再次运行 `scripts/start-local.cmd`

## Related Files / 相关文件

- `scripts/start-local.cmd`
- `scripts/start-local.ps1`
- `scripts/check-env.ps1`
- `.nvmrc`
- `package.json`
