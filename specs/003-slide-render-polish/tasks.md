# Tasks: 幻灯片渲染与生成质量深度打磨

**Branch**: `002-fix-slide-quality`（延续迭代）  
**版本**: v0.3.0  
**完成日期**: 2026-04-07

---

## 已完成任务

### 渲染修复

- [x] T001 `SlidePreview.tsx` 新增 `AutoFitText` 组件：`useLayoutEffect` 检测 `scrollHeight > clientHeight`，逐步缩小 fontSize（步长 0.5px，最小 6px），彻底解决文字截断
- [x] T002 `SlidePreview.tsx` 所有元素加 `boxSizing: 'border-box'`，padding 收紧为 1.5%，修复 Y 轴偏移

### detectAndFixOverlaps 重写

- [x] T003 `utils.ts` 按元素类型分层：只有 `type='text'` 参与推移，`image`/`shape` 原样保留
- [x] T004 `utils.ts` X+Y 双轴判断：X 轴无重叠（如左右两栏）直接跳过，不触发推移
- [x] T005 `utils.ts` 越界保护：推移后 `y+h > 100` 时压缩 h（最小 5）

### SYSTEM_INSTRUCTION 强化

- [x] T006 `constants.ts` 新增 Rule 15：标题坐标锁定（普通布局 y:3–10；center-hero y:28–42；正文从 y≥28 开始）
- [x] T007 `constants.ts` 新增 Rule 16 + `scenarioId` 参数：场景基调（academic/business/creative/ted）× 布局装饰规则二维映射

### 精炼与生成 Prompt 优化

- [x] T008 `useAI.ts` `refineOutlineItem` prompt 重构：按布局类型自主选格式（金句/bullet/分段小标题/编号列表），总字数≤80 字
- [x] T009 `useAI.ts` 多段布局分段规则：按格数分段，段内可选 `**加粗小标题**`，段间空行
- [x] T010 `useAI.ts` `generateSlide` prompt 新增 `USE VERBATIM` 约束：body 文案原文照搬
- [x] T011 `useAI.ts` `_buildSystemInstruction` 和 `remixSlide` 传入 `selectedScenarioId`

### 错误透传

- [x] T012 `server.ts` `/api/ai/generate-content` 响应新增 `finishReason` 字段，透传图片生成失败原因

---

## 根本原因记录

| 症状 | 根本原因 |
|------|---------|
| 全部文字堆至底部 | `detectAndFixOverlaps` 将大 shape 背景容器当内容元素，推移所有同列文字至 y=102+，溢出后裁到底部 |
| 左右两栏文字互相推移 | 旧逻辑只判断 Y 轴，不判断 X 轴，导致不同列元素互相干扰 |
| 文字溢出截断 | 无自适应缩放，overflow 仅做 ellipsis 不够 |
| Y 轴轻微偏移 | `padding: 2%` 无 `box-sizing: border-box`，实际高度超出预期 |
| 精炼总输出 4 条 bullet | prompt 硬编码格式，未考虑布局和场景差异 |
| 图片生成失败无感知 | server.ts 未透传 `finishReason` |
