# src — 前端源码规格

## 模块职责分工

| 文件 | 职责 |
|------|------|
| `main.tsx` | React 应用入口，挂载 `<App />` 到 `#root` |
| `App.tsx` | 全局状态管理、核心业务逻辑、完整 UI 渲染 |
| `types.ts` | 全局 TypeScript 类型定义（无运行时代码）|
| `constants.ts` | 预设配置、Gemini Prompt 模板（无副作用）|
| `utils.ts` | 纯工具函数（样式合并、重试、图片处理）|
| `services/` | 独立业务服务（存储、导出）|
| `components/` | 可复用 UI 组件 |

## App.tsx 状态分组

App.tsx 是单体主文件（~2900 行），内部状态按功能分组：

| 分组 | 主要状态 |
|------|---------|
| 认证 | `isLoggedIn`、`userApiKey`、`isLoggingIn` |
| 项目 | `projects`、`activeProjectId`、`isCreatingProject` |
| 设计 | `colors`、`selectedFont`、`cornerRadius`、`shadowIntensity`、`safeMargin`、字号系列 |
| 生成 | `isGenerating`、`inputText`、`audioBlob`、`selectedImage`、`error` |
| 大纲 | `isScriptMode`、`scriptInput`、`selectedScenarioId`、`additionalPrompt` |
| UI | `sidebarOpen`、`designPanelOpen`、`toast`、`activeTab` |

## App.tsx 核心函数

| 函数 | 说明 |
|------|------|
| `loadUserData(apiKey)` | 启动时加载数据：优先云端，云端为空则迁移本地 |
| `syncData(projects?, styles?)` | 写数据：同时写云端（`/api/user-data`）和 IndexedDB |
| `handleLogin()` | 用小请求验证 API Key 有效性后登录 |
| `generateOutline()` | 第一阶段 AI：文本 → OutlineItem[]（纯文本解析）|
| `generateSlide(item?)` | 第二阶段 AI：OutlineItem → Slide（JSON Schema）|
| `exportToPptx()` | 调用 pptxService 导出当前项目 |
| `syncData()` | 持久化当前状态到云端和本地 |

## AI 调用约定

所有 Gemini 调用均通过 `withRetry()` 包装，最多重试 3 次（指数退避），仅对网络类错误重试。

```typescript
const ai = new GoogleGenAI({ apiKey: userApiKey });
const response = await withRetry(() => ai.models.generateContent({ ... }));
```

- `generateOutline`：自由文本输出，手动用正则解析 `[SLIDE]...[END_SLIDE]` 块
- `generateSlide`：强制 `responseMimeType: "application/json"` + `responseSchema`，直接 JSON.parse

## utils.ts 接口

```typescript
cn(...inputs: ClassValue[]): string
// 合并 Tailwind 类名（clsx + tailwind-merge）

withRetry<T>(fn: () => Promise<T>, retries?: number, delay?: number): Promise<T>
// 网络错误自动重试，默认 retries=2，delay=1000ms，指数退避

blobToBase64(blob: Blob): Promise<string>
// Blob 转 base64 data URL

resizeImage(base64Str: string, maxWidth?: number, maxHeight?: number): Promise<string>
// 等比缩放图片到 512x512 以内，输出 JPEG 0.8 质量
```

## types.ts 核心类型

```typescript
SlideElement        // 幻灯片元素（text / shape / image），坐标为 0-100 百分比
Slide               // 单张幻灯片，含 elements[]、images[]（base64）、keyData、quotes、highlights
OutlineItem         // 大纲项，含 suggestedLayout、isGenerated、slideId（关联已生成的 Slide）
Project             // 项目，含 slides[]、outline[]、script、sourceText
PresetStyle         // 设计风格，含 colors[4]、fontFamily、cornerRadius、shadowIntensity 等
ScenarioId          // 'general' | 'academic' | 'business' | 'creative' | 'ted'
Scenario            // 场景配置，含 tone、logic
LayoutPreset        // 布局预设，含 id、name、iconType
FontOption          // 字体选项，含 name、family、category
ModelOption         // 模型选项，含 id、name、description
```

## constants.ts 导出

| 导出 | 类型 | 说明 |
|------|------|------|
| `SCENARIOS` | `Scenario[]` | 5 种场景预设（通用/学术/商务/创意/TED）|
| `LAYOUT_PRESETS` | `LayoutPreset[]` | 13 种布局预设 |
| `MODELS` | `ModelOption[]` | 2 个 Gemini 模型选项 |
| `PRESET_STYLES` | `PresetStyle[]` | 4 种内置设计风格 |
| `FONTS` | `FontOption[]` | 10 种 Google Fonts |
| `DEFAULT_COLORS` | `string[]` | 默认 4 色调色板 |
| `SCRIPT_SYSTEM_INSTRUCTION` | `(scenario) => string` | 大纲生成 Prompt 工厂函数 |
| `SYSTEM_INSTRUCTION` | `(style, ...) => string` | 幻灯片生成 Prompt 工厂函数 |
| `CHANGELOG` | `object[]` | 版本更新历史（仅用于 UI 展示）|
