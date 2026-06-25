# Web App

`apps/web` 是 AI网文诊断台（原 AI 小说第一步）的 Next.js 前端控制台。

它的产品入口以“先诊断，再改稿”为主：用户粘贴自己的第一章，系统用 AI 小说诊断找出最大流失点，解释网文为什么没人追，再复制可执行的改稿 Prompt；改完后再复诊，确认问题是否真的被解决。进阶能力再承接 AI 拆书、成熟样本质检、整书可视化拆解、关系图谱复核和导出资产。

## 主要视图

- AI网文诊断台：粘贴章节、找最大流失点、生成改稿 Prompt、复诊对比。
- 深度章节质检：成熟样本导入、市场定位识别、Rubric 生成、章节评分和数据快照。
- 整书拆解：TXT 上传、章节预览、异步 Map-Reduce 拆解、历史任务和导出入口。
- 关系图谱工作台：角色、势力、地点和关系边的总览、复核、时间线和 JSON/SVG 导出。
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
NEXT_PUBLIC_SITE_URL=https://your-public-site.example.com
```

未配置 `NEXT_PUBLIC_API_BASE_URL` 时，前端默认通过 `/api/v1` 走 Next route handler 代理到 API。
`NEXT_PUBLIC_SITE_URL` 用于生成 canonical、`robots.txt`、`sitemap.xml` 和 JSON-LD；生产部署时应设置成真实公开访问地址。

## 常用命令

```bash
pnpm --filter web check
pnpm --filter web test
pnpm --filter web build
```

## 维护原则

- 首屏优先服务新手最短闭环：粘贴章节、诊断、改稿 Prompt、复诊。
- 高级参数默认后置，避免把新手第一步变成配置表单。
- 组件内尽量只保留状态绑定和事件编排；请求、缓存、进度状态机和展示派生逻辑放在 `src/lib`。
