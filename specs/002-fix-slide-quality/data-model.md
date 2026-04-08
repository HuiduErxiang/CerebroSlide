# Data Model: 幻灯片生成质量修复

**Feature**: 002-fix-slide-quality
**Phase**: 1 — Design
**Date**: 2026-04-07

---

## 核心实体（存量，本次修复涉及字段）

### SlideElement（`src/types.ts`）

无需修改类型定义。关键字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | `'text' \| 'shape' \| 'image'` | 元素类型；重叠检测仅处理非背景图元素 |
| `x`, `y`, `w`, `h` | `number` (0–100) | 百分比坐标；重叠检测在此坐标系操作 |
| `style.color` | `string?` | 文字色；修复后在 schema 中变为 required；预览层必须原样映射 |
| `style.fontFamily` | `string?` | 字体 family 字符串；修复后在 schema 中变为 required；预览层动态注入对应 link |
| `style.fontSize` | `number?` | pt 单位；预览层 pt×1.333=px（不改变） |
| `imageIndex` | `number?` | 背景图索引；`imageIndex === undefined` 或值为背景图时排除重叠检测 |

**重叠检测的"背景图"判定规则**（算法内部定义，不修改 type）：
```
isBgElement(el) = (el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100)
```

### 新增工具函数（`src/utils.ts`）

```typescript
detectAndFixOverlaps(elements: SlideElement[]): SlideElement[]
```

| 参数 | 说明 |
|------|------|
| `elements` | AI 返回并解析后的元素数组（原始顺序） |
| 返回值 | 修正后的元素数组（背景元素原位不变，其他元素可能 y 值被后移） |

**状态与副作用**：无（纯函数）

**算法约束**：
- 仅处理 `type === 'text'` 或 `type === 'shape'`（非背景图）元素
- 两元素相交判定：`水平相交 AND 垂直相交`
  - 水平相交：`el1.x < el2.x + el2.w AND el2.x < el1.x + el1.w`
  - 垂直相交：`el1.y < el2.y + el2.h AND el2.y < el1.y + el1.h`
- 修正策略：将 y 值较大的（下方）元素的 y 改为 `上方元素.y + 上方元素.h + 2`
- 按 `y` 升序排序后执行，保证贪心正确性
- 背景图元素跳过，其在返回数组中位置不变

### _slideResponseSchema 字段变更

位于 `src/hooks/useAI.ts`，`_slideResponseSchema` 变量。变更仅影响 `elements[].style` 的 `required` 数组：

**变更前**：`style` 对象的 `required` 字段不存在（所有 style 字段均为 optional）

**变更后**：
```typescript
style: {
  type: Type.OBJECT,
  properties: { /* 现有字段不变 */ },
  required: ['color', 'fontFamily'],  // 新增
},
```

同步修改 `remixSlide` 中的内联 schema（相同结构）。

---

## 验证规则（从 spec.md 提取）

| 规则 ID | 实体/字段 | 约束 | 验证时机 |
|---------|----------|------|----------|
| VR-001 | `SYSTEM_INSTRUCTION` 返回字符串 | 包含 "EXACTLY" 或 "MUST be EXACTLY" 对标题字号描述 | 单元测试 |
| VR-002 | `_slideResponseSchema.elements[].style.required` | 包含 `'color'` 和 `'fontFamily'` | 单元测试（拦截 fetch 请求体） |
| VR-003 | `detectAndFixOverlaps` 返回值 | 两两非背景元素无 BBox 相交 | 单元测试 |
| VR-004 | `SlidePreview` text 元素 DOM | `style.color` 等于输入的 `style.color`，不被覆盖 | 渲染单元测试 |
| VR-005 | `SlidePreview` `document.head` | 包含使用了 slide 中字体的 Google Fonts `<link>` | 渲染单元测试 |

---

## 状态流向（本次修复路径）

```
generateSlide()
  → callAI（含增强后的 SYSTEM_INSTRUCTION + schema required 扩充）
  → JSON.parse(response.text)
  → detectAndFixOverlaps(result.elements)   ← 新增后处理步骤
  → newSlide.elements = fixedElements
  → setProjects → syncData                  ← 不变
  ↓
SlidePreview(slide)
  → useEffect：提取 fontFamily → 注入 Google Fonts link  ← 新增
  → 渲染每个 element
    → text 元素：color 直接从 el.style.color 取（无 '#000' fallback）← 修复
    → text 元素：overflow: hidden + textOverflow: ellipsis  ← 修复
```
