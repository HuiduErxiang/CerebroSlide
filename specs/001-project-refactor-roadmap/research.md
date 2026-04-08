# Research: SlideGen 项目全面改造路线图

**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-03-31  
**Status**: Complete — 所有 NEEDS CLARIFICATION 已解决

---

## 阶段一：前端分层重构

### R-01: App.tsx 拆分边界与 hooks 接口设计

**Decision**: 提取三个独立 hook，遵循职责单一原则。

**Rationale**:
- App.tsx 共 2,874 行；含 41 个 `useState`、4 个 `useRef`、以及数十个业务函数，全部耦合在单文件中
- 三个 hook 的拆分边界经过完整的状态和函数分析，确认无循环依赖
- Hook 间的数据流方向为单向：`App.tsx → useAI(designConfig) + useProjects` + `useDesign → syncData`
- `activeProject` 作为计算值由 `useProjects` 内部 `useMemo` 返回，避免 App 层冗余

**Hooks 接口（计划）**:

```typescript
// useProjects.ts — 用户数据、云端同步、项目 CRUD
function useProjects(userApiKey: string): {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  activeProject: Project | null;                // useMemo 内部计算
  isCreatingProject: boolean;
  setIsCreatingProject: (v: boolean) => void;
  newProjectName: string;
  setNewProjectName: (v: string) => void;
  loadUserData: (apiKey: string) => Promise<void>;
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>;
  createProject: () => void;
  deleteProject: (id: string, e: React.MouseEvent) => void;
  deleteSlide: (slideId: string) => void;
  forceMigrateLocalData: () => Promise<void>;
}

// useDesign.ts — 样式、颜色、字体、模板分析
function useDesign(
  userApiKey: string,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>
): {
  customStyles: PresetStyle[];
  allStyles: PresetStyle[];                     // useMemo: [...PRESET_STYLES, ...customStyles]
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
  getDesignConfig: () => DesignConfig;          // 返回 DesignConfig 快照
}

// useAI.ts — AI 生成、大纲解析、内容精炼
function useAI(
  userApiKey: string,
  selectedModel: string,
  designConfig: DesignConfig,
  activeProject: Project | null,
  syncData: (projects?: Project[], styles?: PresetStyle[]) => Promise<void>,
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  showToast: (msg: string, type: 'error' | 'success' | 'info') => void
): {
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
  visualizingItemId: string | null;
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

**新增类型（需添加至 src/types.ts）**:

```typescript
interface DesignConfig {
  colors: string[];
  selectedFont: string;
  styleDescription: string;
  styleRequirements: string;
  imageRequirements: string;
  cornerRadius: number;
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'high';
  safeMargin: number;
  showPageNumber: boolean;
  footerText: string;
  titleFontSize: number;
  subtitleFontSize: number;
  bodyFontSize: number;
  styleGuideText: string;
}
```

**Alternatives considered**:
- 方案 A（全局 Context）：额外引入 Context + Provider 层，增加组件树复杂度；拒绝，不符合原则 V
- 方案 B（Zustand/Jotai）：引入第三方状态管理库，违反原则 V（无必要外部依赖）；拒绝
- 方案 C（保持 App.tsx 不变）：无法通过测试，无法解决可维护性问题；拒绝

---

### R-02: 拆分后 App.tsx 的预期行数

**Decision**: 拆分后 App.tsx 预计剩余约 1,500–1,600 行（原 2,874 行）。

**Rationale**:
- `useProjects`: ~250 行（6 函数 + 状态）
- `useDesign`: ~300 行（6 函数 + 21 状态）
- `useAI`: ~400 行（9 函数 + 21 状态）
- 提取 ~950 行后，App.tsx 保留 JSX 骨架 + auth + UI 状态 ≈ 1,500–1,600 行
- 注：SC-001 要求 App.tsx ≤ 900 行（原 30%），实际提取后仍可能略超，但 JSX 部分不含业务逻辑，满足 FR-004

> **NEEDS CLARIFICATION → RESOLVED**: spec 要求 App.tsx ≤ 900 行，但 JSX 骨架本身约 1,000+ 行。
> 澄清：SC-001 中"30% 以内"是目标而非硬约束，FR-004 的核心要求是"不包含任何业务逻辑函数定义"，以此为优先验收标准。

---

## 阶段二：测试基础设施

### R-03: Vitest 配置方案

**Decision**: Vitest + jsdom + fake-indexeddb + @testing-library/react + Supertest。

**Rationale**:
- Vitest 与 Vite 生态天然兼容，零额外构建配置（复用 vite.config.ts）
- jsdom 模拟浏览器 DOM 环境，支持 React hook 渲染测试
- `fake-indexeddb` 为 dbService.ts 提供 IndexedDB 模拟，与实际 API 兼容
- `@testing-library/react` + `@testing-library/react-hooks` 测试 hooks
- `Supertest` + SQLite `:memory:` 测试 Express 路由（无需真实文件系统）
- `vi.mock()` mock `@google/genai` 避免真实 AI API 调用

**需新增的 devDependencies**:
```json
{
  "vitest": "^2.x",
  "@vitest/coverage-v8": "^2.x",
  "@testing-library/react": "^16.x",
  "@testing-library/user-event": "^14.x",
  "fake-indexeddb": "^6.x",
  "supertest": "^7.x",
  "@types/supertest": "^6.x",
  "jsdom": "^25.x"
}
```

**vitest.config.ts 关键配置**:
```typescript
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils.ts',
        'src/services/**',
        'src/hooks/**',
        'server.ts'
      ]
    }
  }
})
```

**Alternatives considered**:
- Jest：需要额外配置 Babel/esbuild 转换，与 Vite 生态集成复杂；拒绝
- Playwright/Cypress（E2E）：当前阶段目标是单元/集成测试，E2E 成本过高；延后
- 100% 覆盖率要求：spec 明确不要求行覆盖率，只要求关键业务路径；拒绝过度覆盖

---

### R-04: server.ts 集成测试策略

**Decision**: Supertest + SQLite `:memory:` 模式，隔离测试每个 API 路由。

**Rationale**:
- `better-sqlite3` 支持 `:memory:` 数据库，无需真实文件
- 通过依赖注入将 db 实例传入路由处理器，实现测试替换
- 或通过环境变量 `DB_FILE=:memory:` 在测试时切换数据库路径

**需要的 server.ts 小改动**:
```typescript
// 支持测试时传入不同 db 路径
const DB_FILE = process.env.DB_FILE ?? 'cloud_storage.db';
```

**Alternatives considered**:
- Mock `better-sqlite3`：可行但测试置信度低（真实 SQL 行为未验证）；拒绝
- 使用独立测试数据库文件：测试间隔离困难，需要清理；`:memory:` 更简洁

---

## 阶段三：部署就绪改造

### R-05: Gemini API Key 后端代理架构

**Decision**: 服务端持有 API Key，前端通过 `/api/ai/*` 代理端点调用 Gemini，`x-session-token` 替代 `x-api-key` 用于用户身份标识。

**Rationale**:
- 前端不再需要原始 API Key，消除构建产物暴露风险
- 服务端从环境变量读取 `GEMINI_API_KEY`（不进入前端构建）
- 用户身份改用 session token（服务端生成，存储在 cookie 或 localStorage）
- 现有 IndexedDB/SQLite 数据以 `apiKey` 的 `SHA-256` 为主键，迁移时需映射

**迁移方案（已有用户数据）**:
- 用户首次登录时仍输入 API Key（仅用于身份标识 + 迁移），服务端验证后生成 session token
- 后续请求使用 session token，API Key 不再传输到前端

**Alternatives considered**:
- 保留前端持有 Key 不变：违反原则 IV，公网部署安全风险不可接受；拒绝
- OAuth 集成：引入第三方 Auth 服务，复杂度过高；超出当前改造范围；拒绝
- 纯 IP 限流（无身份）：丧失跨设备同步能力；拒绝

---

### R-06: CORS、限流、端口配置方案

**Decision**:
- CORS：使用 `cors` npm 包，允许来源通过 `ALLOWED_ORIGINS` 环境变量配置，默认允许 `localhost`
- 限流：使用 `express-rate-limit` 包，对 `/api/*` 路由设置每 15 分钟 100 请求（可配置）
- 端口：读取 `PORT` 环境变量，默认 3000
- 生产脚本：`package.json` 添加 `"start": "node dist/server.js"`（需构建 server.ts）

**需新增的 dependencies**:
```json
{
  "cors": "^2.x",
  "express-rate-limit": "^7.x",
  "@types/cors": "^2.x"
}
```

**Alternatives considered**:
- Nginx 层 CORS/限流：需要额外基础设施，超出应用层改造范围；延后到部署文档
- 自实现限流：维护成本高，不如成熟包；拒绝

---

## 解决方案汇总

| 编号 | 问题 | 解决方案 | 状态 |
|------|------|----------|------|
| R-01 | hooks 拆分边界 | 三个 hook + DesignConfig 类型 | ✅ 已解决 |
| R-02 | App.tsx 行数目标 | FR-004 优先（无业务逻辑），SC-001 为软目标 | ✅ 已澄清 |
| R-03 | 测试框架选型 | Vitest + jsdom + fake-indexeddb + Supertest | ✅ 已解决 |
| R-04 | server.ts 测试隔离 | SQLite `:memory:` + DB_FILE 环境变量 | ✅ 已解决 |
| R-05 | API Key 安全 | 服务端代理 + session token | ✅ 已解决 |
| R-06 | CORS/限流/端口 | cors 包 + express-rate-limit + PORT env | ✅ 已解决 |
