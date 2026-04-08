# Contracts: Hooks API

**Module**: `src/hooks/`  
**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-04-06 (updated to match final implementation)

---

## useProjects

**文件**: `src/hooks/useProjects.ts`  
**职责**: 用户数据加载、云端同步（双写）、项目和幻灯片 CRUD

### 函数签名

```typescript
function useProjects(
  userApiKey: string,
  customStylesRef: React.RefObject<PresetStyle[]>
): UseProjectsReturn
```

### 返回类型

```typescript
interface UseProjectsReturn {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProject: Project | null;
  isCreatingProject: boolean;
  setIsCreatingProject: (v: boolean) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;

  loadUserData: (apiKey: string) => Promise<{ customStyles: PresetStyle[] } | void>;
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>;
  createProject: () => void;
  deleteProject: (id: string, e: React.MouseEvent) => void;
  deleteSlide: (slideId: string) => void;
  forceMigrateLocalData: () => Promise<void>;
}
```

### 行为约定

| 方法 | 副作用 | 前置条件 |
|------|--------|----------|
| `loadUserData(apiKey)` | 更新 `projects` 状态；云端优先，失败降级读 IndexedDB；**返回 `{customStyles}` 供 App.tsx 注入 useDesign** | `apiKey` 非空 |
| `syncData(projects?, styles?)` | 双写：POST /api/user-data + IndexedDB PUT；两者均失败时抛出错误 | 用户已登录 |
| `createProject()` | 向 `projects` 追加新项目；调用 `syncData()` | `newProjectName` 非空 |
| `deleteProject(id, e)` | 从 `projects` 移除指定项目；调用 `syncData()` | 项目存在 |
| `deleteSlide(slideId)` | 从 `activeProject.slides` 移除幻灯片；调用 `syncData()` | `activeProjectId` 非空 |
| `forceMigrateLocalData()` | 扫描 IndexedDB 所有 key，合并数据后写入云端 | 仅在启动时云端为空时调用 |

### 依赖

- `src/services/dbService.ts`：`saveToDB`、`getFromDB`
- Express `/api/user-data`（GET/POST），请求头携带 `x-session-token`（由 `/api/session` 换取）；session 换取失败时降级为 `x-api-key`

---

## useDesign

**文件**: `src/hooks/useDesign.ts`  
**职责**: 样式系统状态管理、模板分析、自定义样式 CRUD

### 函数签名

```typescript
function useDesign(
  userApiKey: string,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>
): UseDesignReturn
```

### 返回类型

```typescript
interface UseDesignReturn {
  customStyles: PresetStyle[];
  setCustomStyles: React.Dispatch<React.SetStateAction<PresetStyle[]>>;
  allStyles: PresetStyle[];
  colors: string[];
  setColors: React.Dispatch<React.SetStateAction<string[]>>;
  selectedFont: string;
  setSelectedFont: (v: string) => void;
  styleDescription: string;
  setStyleDescription: (v: string) => void;
  styleRequirements: string;
  setStyleRequirements: (v: string) => void;
  imageRequirements: string;
  setImageRequirements: (v: string) => void;
  templateImage: string | null;
  setTemplateImage: (v: string | null) => void;
  styleGuideText: string;
  setStyleGuideText: (v: string) => void;
  docColors: string[] | null;
  cornerRadius: number;
  setCornerRadius: (v: number) => void;
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'high';
  setShadowIntensity: (v: 'none' | 'subtle' | 'medium' | 'high') => void;
  safeMargin: number;
  setSafeMargin: (v: number) => void;
  showPageNumber: boolean;
  setShowPageNumber: (v: boolean) => void;
  footerText: string;
  setFooterText: (v: string) => void;
  titleFontSize: number;
  setTitleFontSize: (v: number) => void;
  subtitleFontSize: number;
  setSubtitleFontSize: (v: number) => void;
  bodyFontSize: number;
  setBodyFontSize: (v: number) => void;
  isAnalyzingTemplate: boolean;
  isAnalyzingDoc: boolean;
  isSavingStyle: boolean;
  setIsSavingStyle: (v: boolean) => void;
  newStyleName: string;
  setNewStyleName: (v: string) => void;

  saveCustomStyle: () => void;
  deleteCustomStyle: (id: string, e: React.MouseEvent) => void;
  applyPreset: (preset: PresetStyle) => void;
  analyzeTemplateImage: (base64: string) => Promise<void>;
  handleTemplateUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStyleGuideUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  getDesignConfig: () => DesignConfig;
}
```

### 行为约定

| 方法 | 副作用 | 前置条件 |
|------|--------|----------|
| `saveCustomStyle()` | 追加到 `customStyles`；调用 `syncData(undefined, newStyles)` | `newStyleName` 非空 |
| `deleteCustomStyle(id, e)` | 从 `customStyles` 移除；调用 `syncData()` | 样式存在且 `isCustom=true` |
| `applyPreset(preset)` | 将 preset 的所有字段展开到对应状态 | preset 非空 |
| `analyzeTemplateImage(base64)` | 调用 Gemini 视觉模型；解析结果更新 colors/style/* 状态 | `userApiKey` 非空；base64 有效 |
| `getDesignConfig()` | 返回当前所有设计状态的只读快照 | 无 |

### 依赖

- `POST /api/ai/generate-content`：模板图片分析（通过后端代理调用 Gemini 视觉模型）
- `mammoth`、`pdfjs-dist`：样式指南文档解析
- `syncData`（由 useProjects 提供，通过参数注入）

---

## useAI

**文件**: `src/hooks/useAI.ts`  
**职责**: AI 生成（大纲/幻灯片/图片）、内容精炼、布局建议、音频录制

### 函数签名

```typescript
function useAI(
  userApiKey: string,
  selectedModel: string,
  designConfig: DesignConfig,
  activeProject: Project | null,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>,
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  showToast: (message: string, type: 'error' | 'success' | 'info') => void
): UseAIReturn
```

### 返回类型

```typescript
interface UseAIReturn {
  inputText: string;
  setInputText: (v: string) => void;
  isRecording: boolean;
  audioBlob: Blob | null;
  selectedLayoutId: string;
  setSelectedLayoutId: (v: string) => void;
  selectedImage: string | null;
  setSelectedImage: (v: string | null) => void;
  isGenerating: boolean;
  isGeneratingImages: boolean;
  remixingSlideId: string | null;
  imageGenProgress: { current: number; total: number };
  error: string | null;
  visualizingItemId: string | null;
  isScriptMode: boolean;
  setIsScriptMode: (v: boolean) => void;
  scriptInput: string;
  setScriptInput: (v: string) => void;
  selectedScenarioId: ScenarioId;
  setSelectedScenarioId: (v: ScenarioId) => void;
  additionalPrompt: string;
  setAdditionalPrompt: (v: string) => void;
  isGeneratingOutline: boolean;
  isSuggestingLayouts: boolean;
  layoutSelectionItem: OutlineItem | null;
  setLayoutSelectionItem: (v: OutlineItem | null) => void;
  layoutSuggestions: { id: string; reason: string }[];
  scriptFiles: { name: string; content: string }[];

  startRecording: () => Promise<void>;
  stopRecording: () => void;
  generateSlide: (item?: OutlineItem) => Promise<void>;
  generateOutline: () => Promise<void>;
  refineOutlineItem: (itemId: string) => Promise<void>;
  refineAllOutlineItems: () => Promise<void>;
  suggestLayouts: (item: OutlineItem) => Promise<void>;
  remixSlide: (slide: Slide) => Promise<void>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleScriptFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeScriptFile: (index: number) => void;
  clearInputs: () => void;
}
```

### 行为约定

| 方法 | 副作用 | 关键约束 |
|------|--------|----------|
| `generateSlide(item?)` | 调用 Gemini（JSON Schema 模式）生成 Slide；若 AI 返回 `imagePrompts` 则调用 `_generateImages()` 生成背景图；追加到 `activeProject.slides`；调用 `syncData()` | **必须用 `withRetry()` 包装**；`SYSTEM_INSTRUCTION` 中须同时声明 `imagePrompts` 字段和触发规则，否则图片生成不会被触发 |
| `generateOutline()` | 调用 Gemini（自由文本）生成 OutlineItem[]；解析 `[SLIDE]...[END_SLIDE]` 块 | **必须用 `withRetry()` 包装** |
| `refineOutlineItem(id)` | 调用 Gemini 丰富 keyData/quotes/highlights；更新 `activeProject.outline` | **必须用 `withRetry()` 包装** |
| `remixSlide(slide)` | 用不同布局重新生成幻灯片；替换 `activeProject.slides` 中对应项 | **必须用 `withRetry()` 包装** |
| `startRecording()` | 请求麦克风权限；初始化 MediaRecorder | 失败时调用 `showToast(err, 'error')` |
| `stopRecording()` | 停止录制；将音频数据合并为 `audioBlob` | 需在 `startRecording` 后调用 |

### 依赖

- `POST /api/ai/generate-content`：所有 AI 生成调用（通过后端代理，`withRetry()` 包装）
- `src/utils.ts`：`withRetry`、`blobToBase64`、`resizeImage`
- `src/constants.ts`：`SYSTEM_INSTRUCTION`、`SCRIPT_SYSTEM_INSTRUCTION`
- `syncData`、`setProjects`（由 useProjects 提供，通过参数注入）
- `showToast`（由 App.tsx 提供，通过参数注入）
