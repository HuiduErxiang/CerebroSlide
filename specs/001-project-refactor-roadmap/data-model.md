# Data Model: SlideGen 项目全面改造路线图

**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-03-31

---

## 现有实体（不变，仅梳理）

### SlideElement

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `type` | `'text' \| 'shape' \| 'image'` | required | 元素类型 |
| `x` | `number` | 0–100，required | 横向位置（百分比） |
| `y` | `number` | 0–100，required | 纵向位置（百分比） |
| `w` | `number` | 0–100，required | 宽度（百分比） |
| `h` | `number` | 0–100，required | 高度（百分比） |
| `content` | `string` | optional | 文本内容 |
| `imageIndex` | `number` | optional | `slide.images[]` 的索引 |
| `shapeType` | `'RECTANGLE' \| 'CIRCLE' \| 'TRIANGLE' \| 'LINE'` | optional | 形状类型 |
| `style.fontSize` | `number` | optional，单位 pt | 字号（前端渲染时 × 1.333 ≈ px） |
| `style.color` | `string` | optional，hex | 文本/边框颜色 |
| `style.fill` | `string` | optional，hex | 背景填充颜色 |
| `style.bold` | `boolean` | optional | 是否加粗 |
| `style.italic` | `boolean` | optional | 是否斜体 |
| `style.align` | `'left' \| 'center' \| 'right'` | optional | 水平对齐 |
| `style.valign` | `'top' \| 'middle' \| 'bottom'` | optional | 垂直对齐 |
| `style.fontFamily` | `string` | optional | 字体族 |
| `style.opacity` | `number` | 0–1，optional | 透明度 |
| `style.shadow` | `boolean` | optional | 是否显示阴影 |
| `style.cornerRadius` | `number` | 0–40，optional | 圆角半径（px） |

**坐标系约束（NON-NEGOTIABLE）**: x/y/w/h 全部为 0–100 浮点百分比，不得存储像素值。

---

### Slide

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `string` | required，唯一 | 幻灯片 ID |
| `elements` | `SlideElement[]` | required | 所有视觉元素 |
| `title` | `string` | required | 标题 |
| `description` | `string` | required | 描述 |
| `timestamp` | `number` | required，Unix ms | 创建时间 |
| `images` | `string[]` | optional | base64 编码图片数组 |
| `pageStyle` | `string` | optional | 样式标识符 |
| `keyData` | `{label: string; value: string; unit?: string}[]` | optional | 关键数据点 |
| `quotes` | `{text: string; author?: string}[]` | optional | 引用语句 |
| `highlights` | `string[]` | optional | 要点列表 |

---

### OutlineItem

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `string` | required，唯一 | 大纲项 ID |
| `title` | `string` | required | 幻灯片标题 |
| `subtitle` | `string` | required | 副标题 |
| `body` | `string` | required，≤200 词 | 正文内容 |
| `suggestedLayout` | `string` | required | 推荐布局 ID |
| `layoutDescription` | `string` | required | 布局选择原因 |
| `isGenerated` | `boolean` | required | 是否已生成为 Slide |
| `slideId` | `string` | optional | 对应 Slide.id |
| `isRefining` | `boolean` | optional | 精化进行中 |
| `isRefined` | `boolean` | optional | 已精化完成 |
| `metaDescription` | `string` | optional | 初始创意描述 |
| `pageStyle` | `string` | optional | 样式标识 |
| `decorativeIcon` | `string` | optional | 装饰图标（emoji） |
| `keyData` | `{label: string; value: string; unit?: string}[]` | optional | 同 Slide |
| `quotes` | `{text: string; author?: string}[]` | optional | 同 Slide |
| `highlights` | `string[]` | optional | 同 Slide |

---

### Project

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `string` | required，唯一 | 项目 ID |
| `name` | `string` | required | 项目名称 |
| `createdAt` | `number` | required，Unix ms | 创建时间 |
| `scenarioId` | `ScenarioId` | optional | 场景预设 ID |
| `slides` | `Slide[]` | required | 生成的幻灯片列表 |
| `script` | `string` | optional | 原始输入文本 |
| `sourceText` | `string` | optional | 文档来源文本 |
| `outline` | `OutlineItem[]` | optional | 大纲（多页模式） |

---

### PresetStyle

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `string` | required，唯一 | 样式 ID |
| `name` | `string` | required | 样式名称 |
| `style` | `string` | required | 视觉风格描述 |
| `requirements` | `string` | required | 元素视觉要求 |
| `colors` | `string[]` | required，≥4 项 | 调色板（hex） |
| `fontFamily` | `string` | optional | 字体族 |
| `isCustom` | `boolean` | optional | 是否用户自定义 |
| `referenceImage` | `string` | optional | 参考图 base64 |
| `cornerRadius` | `number` | 0–40，optional | 圆角半径 |
| `shadowIntensity` | `'none' \| 'subtle' \| 'medium' \| 'high'` | optional | 阴影强度 |
| `safeMargin` | `number` | 0–100，optional | 安全边距（百分比） |
| `showPageNumber` | `boolean` | optional | 显示页码 |
| `footerText` | `string` | optional | 页脚文本 |
| `titleFontSize` | `number` | optional，pt | 标题字号 |
| `subtitleFontSize` | `number` | optional，pt | 副标题字号 |
| `bodyFontSize` | `number` | optional，pt | 正文字号 |
| `imageRequirements` | `string` | optional | 背景/图片要求 |

---

## 阶段一新增实体

### DesignConfig（新增 — 需加入 src/types.ts）

用于将 useDesign 的设计状态快照传递给 useAI，消除跨 hook 的直接状态依赖。

| 字段 | 类型 | 说明 |
|------|------|------|
| `colors` | `string[]` | 4 色调色板 |
| `selectedFont` | `string` | 字体族 |
| `styleDescription` | `string` | 整体风格描述 |
| `styleRequirements` | `string` | 视觉要求 |
| `imageRequirements` | `string` | 图片/背景要求 |
| `cornerRadius` | `number` | 0–40 |
| `shadowIntensity` | `'none' \| 'subtle' \| 'medium' \| 'high'` | 阴影强度 |
| `safeMargin` | `number` | 0–100 |
| `showPageNumber` | `boolean` | 显示页码 |
| `footerText` | `string` | 页脚文本 |
| `titleFontSize` | `number` | pt |
| `subtitleFontSize` | `number` | pt |
| `bodyFontSize` | `number` | pt |
| `styleGuideText` | `string` | 样式指南文本 |

**验证规则**:
- `colors` 数组长度必须 ≥ 4
- 字体大小均为正数
- `safeMargin` 范围 0–100

---

## 阶段二：测试实体

### TestFixture（仅用于测试，非生产代码）

```typescript
// tests/fixtures/index.ts
const createSlideElement = (overrides?: Partial<SlideElement>): SlideElement
const createSlide = (overrides?: Partial<Slide>): Slide
const createProject = (overrides?: Partial<Project>): Project
const createPresetStyle = (overrides?: Partial<PresetStyle>): PresetStyle
const createDesignConfig = (overrides?: Partial<DesignConfig>): DesignConfig
```

---

## 阶段三：服务端数据模型

### SQLite: user_data 表（现有，阶段三扩展）

| 列 | 类型 | 说明 |
|------|------|------|
| `user_hash` | TEXT PRIMARY KEY | SHA-256(apiKey) hex |
| `projects` | TEXT | JSON 序列化 Project[] |
| `custom_styles` | TEXT | JSON 序列化 PresetStyle[] |
| `updated_at` | INTEGER | Unix 毫秒时间戳 |
| `session_token` | TEXT | 阶段三新增：session token（可选） |

**状态转换（数据同步流程）**:

```
用户首次登录
  ↓ 输入 API Key
  ↓ GET /api/user-data (x-api-key)
  ├─ 有云端数据 → 加载至前端状态
  └─ 无云端数据 → 扫描 IndexedDB → POST /api/user-data（迁移）

用户修改 projects/customStyles
  ↓ syncData(projects, styles)
  ├─ POST /api/user-data → SQLite UPDATE
  └─ saveToDB(key, data) → IndexedDB PUT

应用启动离线状态
  ↓ GET /api/user-data 失败
  └─ getFromDB(key) → IndexedDB GET（降级读取）
```

---

## 实体关系图

```
Project (1) ─── (N) Slide (1) ─── (N) SlideElement
Project (1) ─── (N) OutlineItem
OutlineItem (1) ─── (0..1) Slide      [通过 slideId 关联]

user_data (SQLite)
  user_hash → Project[] (JSON)
  user_hash → PresetStyle[] (JSON)

IndexedDB "slidegen_v2_{apiKey}_projects"
  key → Project[] (JSON)
```
