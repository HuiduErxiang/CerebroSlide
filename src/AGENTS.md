# src — 前端源码规格

## 模块职责分工

| 文件 | 职责 |
|------|------|
| `main.tsx` | React 应用入口，挂载 `<App />` 到 `#root` |
| `App.tsx` | 全局 auth/UI 状态、JSX 骨架（不含业务逻辑）|
| `types.ts` | 全局 TypeScript 类型定义（无运行时代码）|
| `constants.ts` | 预设配置、Gemini Prompt 模板（无副作用）|
| `utils.ts` | 纯工具函数（样式合并、重试、图片处理）|
| `services/` | 独立业务服务（存储、导出）|
| `components/` | 可复用 UI 组件 |
| `hooks/` | 业务逻辑 hooks（useProjects、useDesign、useAI）|

## hooks/ 层边界说明

`src/hooks/` 目录包含三个核心业务逻辑 hook，从 `App.tsx` 拆分而来：

| Hook | 文件 | 职责 |
|------|------|------|
| `useProjects` | `hooks/useProjects.ts` | 用户数据加载、云端同步双写、项目/幻灯片 CRUD |
| `useDesign` | `hooks/useDesign.ts` | 设计状态管理、模板分析、自定义样式 CRUD |
| `useAI` | `hooks/useAI.ts` | AI 生成（大纲/幻灯片）、精炼、布局建议、音频录制 |

### 依赖关系

```
App.tsx
  ├── useProjects(userApiKey, customStylesRef)
  │     └── 提供 syncData、setProjects（注入给下游 hooks）
  ├── useDesign(userApiKey, syncData)
  │     └── 依赖 useProjects 提供的 syncData
  │     └── 提供 setCustomStyles（供 App.tsx 注入 loadUserData 返回的 customStyles）
  └── useAI(userApiKey, selectedModel, designConfig, activeProject, syncData, setProjects, showToast)
        └── 依赖 useProjects 提供的 syncData、setProjects
            依赖 useDesign 提供的 getDesignConfig()
```

### 接口约定摘要

**useProjects** 函数签名：`useProjects(userApiKey: string, customStylesRef: React.RefObject<PresetStyle[]>): UseProjectsReturn`

返回 `UseProjectsReturn`（见 `types.ts`）：
- `loadUserData(apiKey)` — 云端优先加载，失败降级 IndexedDB；**返回 `Promise<{customStyles: PresetStyle[]} | void>`**
- `syncData(projects?, styles?)` — 双写 POST /api/user-data + IndexedDB
- `createProject()` / `deleteProject(id, e)` / `deleteSlide(slideId)` — 写后调用 syncData

> **注意**：App.tsx 需在 `loadUserData` 返回后，将返回的 `customStyles` 通过 `setCustomStyles`（useDesign 暴露）注入；`customStylesRef` 是 App.tsx 持有的 ref，用于跨 hook 访问最新 customStyles。

**useDesign** 函数签名：`useDesign(userApiKey: string, syncData): UseDesignReturn`

返回 `UseDesignReturn`（见 `types.ts`），相比 contracts 额外暴露：
- `setCustomStyles` — 供 App.tsx 在 loadUserData 后注入初始 customStyles

**useAI** 返回 `UseAIReturn`（见 `types.ts`）：
- `generateSlide(item?)` / `generateOutline()` — **必须用 withRetry() 包装**
- `refineOutlineItem(id)` / `remixSlide(slide)` — **必须用 withRetry() 包装**
- 所有 AI 调用通过 `POST /api/ai/generate-content` 后端代理，不直接持有 API Key

## App.tsx 状态分组

App.tsx 是主文件（~1619 行），重构后仅保留 auth/UI 状态和 JSX 骨架，业务逻辑均在 hooks 中：

| 分组 | 主要状态 |
|------|---------|
| 认证 | `isLoggedIn`、`userApiKey`、`isLoggingIn` |
| UI | `sidebarOpen`、`designPanelOpen`、`toast`、`activeTab` |
| 模型 | `selectedModel` |

业务状态（projects、设计、AI 生成）均由对应 hook 管理，通过解构获取。

## AI 调用约定

所有 AI 调用均通过后端代理端点 `POST /api/ai/generate-content`，由服务端持有用户加密的 Key，解密后通过 **`@google/genai` SDK** 调用 Gemini。SDK 自动处理所有请求格式（`contents` 规范化、`systemInstruction` 包装、`inlineData` 字段名转换等），前端无需关心格式细节。

调用方式（在 hooks 中）：
```typescript
const response = await withRetry(() =>
  callAI({ model, contents, config }, userApiKey)
);
// callAI 内部自动获取 session token 并携带认证头
// response.text 包含提取好的文本内容
```

**`config` 字段说明（前端统一入口，由 server.ts 映射到 SDK）：**

| config 字段 | SDK 映射位置 |
|------------|------------|
| `systemInstruction` | SDK `systemInstruction`（顶层）|
| `responseMimeType` | SDK `generationConfig.responseMimeType` |
| `responseSchema` | SDK `generationConfig.responseSchema` |
| `temperature` | SDK `generationConfig.temperature` |
| `maxOutputTokens` | SDK `generationConfig.maxOutputTokens` |
| `thinkingConfig` | SDK `generationConfig.thinkingConfig` |
| `responseModalities` | SDK `generationConfig.responseModalities` |
| `imageConfig` | SDK `generationConfig.imageConfig` |

**必须遵守的规则：**

1. **`responseMimeType` 和 `responseSchema` 必须成对出现**：凡依赖固定字段名解析 AI JSON 响应的调用，必须同时携带 `responseSchema` 约束字段名，不能只有 `responseMimeType`。搬移此类代码时，两者作为整体迁移，不可拆分。（参见 PITFALLS.md P001）

2. **`callAI` 负责认证，调用方不处理认证**：认证头由 `callAI` 函数内部通过 `getSessionToken()` 获取并注入，调用方只需传入 `userApiKey`。

3. **`getSessionToken()` 是唯一的 session 获取入口**：不得在函数外部直接调用 `/api/session` 端点。（参见 PITFALLS.md P003）

4. **前端从 `candidates` 显式提取响应内容**：`response.text` 已由 `callAI` 提取自 `candidates[0].content.parts`；图片数据通过 `candidates[0].content.parts.find(p => p.inlineData)` 获取，并使用 `part.inlineData.mimeType` 而非硬编码 `image/png`。（参见 PITFALLS.md P006）

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

detectAndFixOverlaps(elements: SlideElement[]): SlideElement[]
// 修正 text 元素之间的重叠：
// - 只有 type='text' 的元素参与检测，image/shape 原样保留不参与推移
// - X 轴和 Y 轴必须同时重叠才触发推移（左右两栏不互相干扰）
// - 推移方向：将 y 较大的元素推至 upper.y + upper.h + 2
// - 越界保护：推移后 y+h > 100 时压缩 h（最小 5）
// - 纯函数，不 mutate 输入数组
```

## types.ts 核心类型

```typescript
SlideElement        // 幻灯片元素（text / shape / image），坐标为 0-100 百分比
Slide               // 单张幻灯片，含 elements[]、images[]（base64）、keyData、quotes、highlights
OutlineItem         // 大纲项，含 suggestedLayout、isGenerated、slideId（关联已生成的 Slide）
Project             // 项目，含 slides[]、outline[]、script、sourceText
PresetStyle         // 设计风格，含 colors[4]、fontFamily、cornerRadius、shadowIntensity 等
DesignConfig        // 设计配置快照（14 个字段，由 getDesignConfig() 返回）
UseProjectsReturn   // useProjects hook 返回类型
UseDesignReturn     // useDesign hook 返回类型
UseAIReturn         // useAI hook 返回类型
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
| `SYSTEM_INSTRUCTION` | `(style, requirements, colors, fontFamily, context, config, styleGuide?, imageRequirements?, pageStyle?, decorativeIcon?, keyData?, quotes?, highlights?, suggestedLayout?, scenarioId?) => string` | 幻灯片生成 Prompt 工厂函数，`scenarioId` 用于 Rule 16 装饰基调判断 |
| `CHANGELOG` | `object[]` | 版本更新历史（仅用于 UI 展示）|
