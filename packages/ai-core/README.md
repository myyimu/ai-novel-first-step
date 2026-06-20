# AI Core

`packages/ai-core` 是前端和 API 共享的分析契约包。

它不负责调用模型，也不负责 UI；它提供类型、评分结果结构和跨端共享的小说分析数据契约，避免 Web 与 API 各自维护一套不一致的字段。

## 当前职责

- `ProviderKind`、`ProviderPresetId` 等模型接入类型。
- `QuickReviewResult`：章节急诊结果。
- `RubricResult`：成熟样本拆出的评分标准。
- `ScoreResult`：章节质检评分报告。
- 推荐平台、评分指标、改稿提示词等共享结构。

## 使用方

- `apps/web`：用于类型约束、渲染章节急诊/高级质检/报告数据。
- `services/api`：用于约束模型输出、mock fallback 和接口返回结构。

## 本地开发

```bash
pnpm --filter @ai-novel-first-step/ai-core check
pnpm --filter @ai-novel-first-step/ai-core test
pnpm --filter @ai-novel-first-step/ai-core build
```

## 维护原则

- 这里放稳定的跨端契约，不放只属于某个页面的视图模型。
- 新增字段时同时检查 Web 展示、API mock fallback 和相关测试。
- 模型输出结构要优先服务“章节急诊 -> 高级质检 -> 整书资产”的产品路径。
