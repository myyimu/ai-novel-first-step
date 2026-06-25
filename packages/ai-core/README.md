# AI Core

`packages/ai-core` 是前端和 API 共享的分析契约包。

它不负责调用模型，也不负责 UI；它提供第一章急诊、深度质检、整书资产和关系图谱复核所需的共享类型，避免 Web 与 API 各自维护一套不一致的字段。

## 当前职责

- `ProviderKind`、`ProviderPresetId` 等模型接入类型。
- `QuickReviewResult`：章节急诊结果。
- `RubricResult`：成熟样本拆出的评分标准。
- `ScoreResult`：章节质检评分报告。
- 推荐平台、评分指标、改稿提示词等共享结构。

## 使用方

- `apps/web`：用于类型约束、渲染第一章急诊、深度质检、整书资产和图谱复核数据。
- `services/api`：用于约束模型输出、mock fallback 和接口返回结构。

## 本地开发

```bash
pnpm --filter @ai-novel-diagnosis/ai-core check
pnpm --filter @ai-novel-diagnosis/ai-core test
pnpm --filter @ai-novel-diagnosis/ai-core build
```

## 维护原则

- 这里放稳定的跨端契约，不放只属于某个页面的视图模型。
- 新增字段时同时检查 Web 展示、API mock fallback 和相关测试。
- 模型输出结构要优先服务“第一章急诊 -> 深度质检 -> 整书资产 -> 图谱复核”的产品路径。
