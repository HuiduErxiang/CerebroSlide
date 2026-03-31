# src/components — UI 组件规格

## 模块概览

| 文件 | 职责 |
|------|------|
| `SlidePreview.tsx` | 将 `Slide` 数据渲染为 16:9 HTML 预览 |
| `WireframeIcon.tsx` | 渲染布局线框缩略图（用于布局选择 UI）|

---

## SlidePreview.tsx

### 职责
纯展示组件，将 `Slide.elements` 按绝对定位方式渲染为 16:9 可视化预览。不持有任何状态，不触发任何副作用。

### Props

```typescript
interface SlidePreviewProps {
  slide: Slide;
  shadowIntensity?: string;   // 'none' | 'subtle' | 'medium' | 'high'
  cornerRadius: number;        // 0–40，圆角像素值
  backgroundColor?: string;    // CSS 颜色值，默认 '#ffffff'
}
```

### 渲染规则

坐标系：`el.x / el.y / el.w / el.h` 均为 0–100 百分比，映射为 CSS `position: absolute` + `left/top/width/height`。`zIndex` 等于元素在数组中的索引（后面的元素在上层）。

| element.type | 渲染方式 |
|---|---|
| `text` | `<div>` 绝对定位，应用 fontSize（×1.333pt→px）、color、fontFamily、fill（背景色）、cornerRadius、opacity、shadow、align、valign |
| `shape` | `<div>` 绝对定位，应用 fill、cornerRadius（CIRCLE 为 50%）、opacity、shadow |
| `image` | `<img>` 绝对定位，`objectFit: cover`，src 为 `slide.images[el.imageIndex]` |

字体大小换算：`pt × 1.333 = px`（近似 96dpi 下的 pt→px 换算）。

### 异常处理
`slide` 为空或 `elements` 非数组时，渲染错误占位卡片（中文提示"幻灯片无法预览"）。

---

## WireframeIcon.tsx

### 职责
根据布局 ID 渲染对应的 SVG 风格线框缩略图，用于布局选择面板中直观展示各布局的视觉结构。

### Props

```typescript
interface WireframeIconProps {
  type: string;      // 布局 ID，如 'split-left'、'grid-3'
  className?: string;
}
```

### 支持的布局类型

| type 值 | 别名 | 视觉描述 |
|---------|------|---------|
| `center-hero` | `centerhero` | 居中大标题 + 副标题 |
| `split-left` | `splitleft` | 左文右图 |
| `split-right` | `splitright` | 左图右文 |
| `grid-3` | `grid3` | 三栏等宽 |
| `top-bottom` | `topbottom` | 上标题下内容 |
| `full-image` | `fullimage` | 全屏图片 + 底部文字条 |
| `grid-2` | `grid2` | 两栏等宽 |
| `quote` | — | 横向居中引用文字 |
| `feature-list` | `featurelist` | 标题 + 多行列表 |
| `bento-grid` | `bentogrid` | 3×2 不等宽网格 |
| `data-focus` | `datafocus` | 2 个大数据卡片 + 说明区 |
| `expert-quote` | `expertquote` | 左竖线 + 引用文字 |
| `timeline-flow` | `timelineflow` | 横向时间线 + 节点 |
| 其他 / 未知 | — | 显示 type 字符串作为 fallback |

### 类型标准化
组件内部将 `type` 转为小写并替换空格为 `-`，因此传入 `split-left` 或 `splitLeft` 均可正确匹配。
