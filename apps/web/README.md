# Web App

`apps/web` 是 AI 小说第一步的 Next.js 前端控制台。

它的产品入口以“章节急诊”为主：用户先粘贴自己的章节，获得最大追读问题和可复制的改稿 Prompt；进阶时再进入高级质检、整书资产和研究库。

## 主要视图

- 第一章质检台：章节急诊、复测闭环和下一步行动建议。
- 高级章节质检：成熟样本导入、市场定位识别、Rubric 生成、章节评分和数据快照。
- 整书资产：TXT 上传、章节预览、异步整书拆解和导出入口。
- 研究决策：研究库、多书对比、证据链和选题 Prompt。
- AI 设置：共享模型、本地 mock、自备 OpenAI-compatible 模型配置。

## 代码结构

```text
src/
├── app/                         # App Router 页面和 API proxy route
├── components/
│   ├── novel-critique-console.tsx
│   ├── ui/                      # 基础 UI 组件
│   └── workspace/               # 工作台拆分视图
├── lib/
│   ├── api-client.ts            # 浏览器/服务端通用 API helper
│   ├── workspace-analysis-client.ts
│   ├── workspace-cache.ts
│   ├── workspace-progress.ts
│   ├── workspace-view-model.ts
│   └── research-library.ts
└── stores/
    └── workspace-store.ts       # Zustand 本地持久化状态
```

## 本地开发

通常从仓库根目录启动：

```bash
pnpm run dev
```

只启动 Web：

```bash
pnpm --filter web dev
```

默认地址：

```text
http://127.0.0.1:3000
```

如果 Web 和 API 分开部署，配置：

```text
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3001/api/v1
API_INTERNAL_BASE_URL=http://127.0.0.1:3001/api/v1
```

未配置 `NEXT_PUBLIC_API_BASE_URL` 时，前端默认通过 `/api/v1` 走 Next route handler 代理到 API。

## 常用命令

```bash
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
```

## 维护原则

- 首屏优先服务新手最短闭环：粘贴章节、诊断、改稿 Prompt、复测。
- 高级参数默认后置，避免把新手第一步变成配置表单。
- 组件内尽量只保留状态绑定和事件编排；请求、缓存、进度状态机和展示派生逻辑放在 `src/lib`。
