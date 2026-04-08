# Contracts: 幻灯片生成质量修复

**Feature**: 002-fix-slide-quality
**Phase**: 1 — Design
**Date**: 2026-04-07

---

## 新增公开函数合约

### `detectAndFixOverlaps` (`src/utils.ts`)

```typescript
/**
 * 检测并修正幻灯片元素数组中的重叠问题。
 * 纯函数，不修改输入数组，返回新数组。
 *
 * 排除背景图元素（type='image' 且 x=0,y=0,w=100,h=100）。
 * 对剩余元素按 y 坐标升序排序后，逐对检测 BBox 相交，
 * 将下方元素 y 后移至 上方元素.y + 上方元素.h + 2。
 */
function detectAndFixOverlaps(elements: SlideElement[]): SlideElement[]
```

**输入**：
- `elements`：`SlideElement[]`，可包含任意 type 元素，坐标单位为 0–100 百分比

**输出**：
- 新的 `SlideElement[]`，背景图元素保持原位不变，可能更新部分非背景元素的 `y` 值

**不变量**：
- 所有元素的 `x`, `w`, `h`, `type`, `content`, `style` 不被修改
- 背景图元素（`isBgElement` 为 true）的任何属性不被修改
- 输入数组本身不被 mutate（返回新数组）

**调用位置**：`src/hooks/useAI.ts` 中 `generateSlide` 和 `remixSlide` 的 JSON 解析后处理阶段

---

## 修改的现有接口（签名不变，行为扩展）

### `SYSTEM_INSTRUCTION` (`src/constants.ts`)

**签名不变**，返回字符串内容增加约束强度：
- 字号规则措辞从描述性改为命令性（"MUST be EXACTLY N pt"）
- 颜色约束针对 text 元素增加 `fontFamily` 字段的强制要求
- 新增针对 4 种主要布局的坐标分区参考（split-left/right 的左/右区 x 范围、top-bottom 的上/下区 y 范围、grid-3 的三列 x 范围）
- 新增"相邻文本元素最小垂直间距 2%"规则

**调用方无需感知此变更**（函数签名、参数类型、返回类型均不变）。

### `SlidePreview` Component (`src/components/SlidePreview.tsx`)

**Props 签名不变**（`SlidePreviewProps` 不变）。渲染行为变更：
- text 元素 color：`el.style?.color || '#000'` → `el.style?.color ?? undefined`（fallback 改为 `undefined`，让 CSS 自然继承而非强制黑色）
- 新增 `useEffect` 副作用：根据 slide 中的 fontFamily 动态注入 Google Fonts link
- text 元素新增 `textOverflow: 'ellipsis'` 样式

---

## 不变的接口

以下接口**不作任何变更**：

- `src/types.ts` — 所有类型定义保持不变（`SlideElement.style` 字段均保持 optional）
- `server.ts` — 所有 API 路由不变
- `useProjects` / `useDesign` — 签名和行为不变
- `services/pptxService.ts` — 不变
- `services/dbService.ts` — 不变
