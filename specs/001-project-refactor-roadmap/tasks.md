# Tasks: SlideGen 项目全面改造路线图

**Input**: Design documents from `/specs/001-project-refactor-roadmap/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: 按用户故事分组，三个阶段严格顺序执行（US1 → US2 → US3）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无未完成依赖）
- **[Story]**: 对应用户故事（US1/US2/US3）
- 每个任务包含精确文件路径

---

## Phase 1: Setup（共享基础设施）

**目的**: 建立阶段一所需的目录结构、AGENTS.md 接口约定文档，以及 E2E 测试基线

- [x] T001 创建 `src/hooks/` 目录（`mkdir -p src/hooks`）
- [x] T002 在 `src/AGENTS.md` 中补充 hooks 层边界说明、三个 hook 的接口契约摘要及依赖关系，参考 `specs/001-project-refactor-roadmap/contracts/hooks-api.md`

### E2E 测试基础设施（重构前建立基线）

**目的**: 在任何代码变更之前建立功能基线，后续每个 hook 提取完成后跑一遍，确认行为没有被破坏

- [x] T003 安装 Playwright：`npm install -D @playwright/test` 并运行 `npx playwright install chromium`
- [x] T004 创建 `playwright.config.ts`：配置 baseURL=`http://localhost:3000`、使用 chromium、超时 30s、测试目录 `e2e/`
- [x] T005 创建 `e2e/fixtures/mock-api.ts`：封装 Playwright route 拦截逻辑，mock `/api/user-data` GET 返回预置项目数据、POST 返回 `{ success: true }`，供所有测试用例复用
- [x] T006 [P] 创建 `e2e/auth.spec.ts`：测试登录流程——输入 API Key → 点击确认 → 验证主界面出现（验证 `useProjects.loadUserData` 调用链路）
- [x] T007 [P] 创建 `e2e/single-slide.spec.ts`：测试单页生成流程——登录后切换到单页模式 → 在输入框填写文本 → 点击生成按钮 → mock Gemini 响应 → 验证幻灯片预览区出现新卡片
- [x] T008 [P] 创建 `e2e/outline-mode.spec.ts`：测试多页模式——切换多页模式 → 填写脚本输入 → 点击生成大纲 → mock Gemini 响应 → 验证大纲列表渲染；点击单项生成 → 验证对应幻灯片出现
- [x] T009 [P] 创建 `e2e/pptx-export.spec.ts`：测试 PPTX 导出——预置含幻灯片的项目 → 点击导出完整 PPTX 按钮 → 验证触发文件下载（监听 `download` 事件）
- [x] T010 [P] 创建 `e2e/design-panel.spec.ts`：测试设计面板——打开设计面板 → 修改颜色/字体 → 保存自定义样式 → 验证样式列表新增条目；删除样式 → 验证条目消失
- [x] T011 [P] 创建 `e2e/data-sync.spec.ts`：测试云端同步——登录后创建新项目 → 验证 POST `/api/user-data` 被调用；刷新页面 → GET `/api/user-data` 返回原数据 → 验证项目列表恢复
- [x] T012 在 `package.json` 中添加 `"test:e2e": "playwright test"` 和 `"test:e2e:ui": "playwright test --ui"` 脚本
- [x] T013 启动开发服务器（`npm run dev`），运行 `npm run test:e2e` 建立重构前基线，**所有用例必须 PASS 才能继续**；将基线截图保存到 `e2e/screenshots/baseline/`

---

## Phase 2: Foundational（阻塞性前置工作）

**目的**: 在 `src/types.ts` 中新增 `DesignConfig` 类型及三个 hook 的返回类型接口，所有用户故事均依赖此基础

**⚠️ 关键**: 此阶段完成前不得开始任何 hook 实现

- [x] T014 在 `src/types.ts` 中新增 `DesignConfig` 接口（14 个字段，参考 data-model.md 阶段一新增实体章节）
- [x] T015 [P] 在 `src/types.ts` 中新增 `UseProjectsReturn` 接口（参考 contracts/hooks-api.md）
- [x] T016 [P] 在 `src/types.ts` 中新增 `UseDesignReturn` 接口（参考 contracts/hooks-api.md）
- [x] T017 [P] 在 `src/types.ts` 中新增 `UseAIReturn` 接口（参考 contracts/hooks-api.md）
- [x] T018 运行 `npm run lint` 验证类型定义零错误

**Checkpoint**: 类型基础就绪，可开始 hook 实现

---

## Phase 3: User Story 1 - 前端代码可维护性提升（Priority: P1）🎯 MVP

**Goal**: 将 App.tsx 中的业务逻辑提取为三个独立 hook（useProjects、useDesign、useAI），App.tsx 瘦身为纯 JSX 骨架

**Independent Test**: 运行 `npm run lint` 零类型错误通过，且在浏览器中人工回归以下功能：生成幻灯片、导出 PPTX、云端同步、自定义样式、模板上传

### 实现 useProjects（US1）

- [x] T019 [US1] 创建 `src/hooks/useProjects.ts`，实现完整函数签名和所有状态声明（`projects`、`activeProjectId`、`isCreatingProject`、`newProjectName`），参考 contracts/hooks-api.md useProjects 章节
- [x] T020 [US1] 在 `src/hooks/useProjects.ts` 中实现 `loadUserData(apiKey)`：云端优先 GET `/api/user-data`，失败降级读 IndexedDB；包含自动迁移逻辑
- [x] T021 [US1] 在 `src/hooks/useProjects.ts` 中实现 `syncData(projects?, styles?)`：双写 POST `/api/user-data` + `saveToDB`（IndexedDB），两者均失败时抛出错误
- [x] T022 [US1] 在 `src/hooks/useProjects.ts` 中实现 `createProject()`、`deleteProject()`、`deleteSlide()`、`forceMigrateLocalData()`，每个写操作后调用 `syncData()`
- [x] T023 [US1] 在 `src/hooks/useProjects.ts` 中添加 `activeProject` useMemo（由 projects + activeProjectId 计算）
- [x] T024 [US1] 更新 `src/App.tsx`：用 `useProjects(userApiKey)` 调用替换对应的 41 个 useState 中属于 projects 管理的状态和相关函数，确保 JSX 中引用的变量名不变
- [x] T025 [US1] 运行 `npm run lint` 验证 useProjects 集成后零类型错误
- [x] T026 [US1] 运行 `npm run test:e2e -- --grep "auth|sync"` 验证登录流程和云端同步行为与基线一致

**useProjects Checkpoint**: `tsc` 零错误 + `auth.spec.ts` / `data-sync.spec.ts` 全部 PASS

### 实现 useDesign（US1）

- [x] T027 [US1] 创建 `src/hooks/useDesign.ts`，实现完整函数签名 `useDesign(userApiKey, syncData)`，声明所有 21 个设计相关状态，参考 contracts/hooks-api.md useDesign 章节
- [x] T028 [US1] 在 `src/hooks/useDesign.ts` 中实现 `saveCustomStyle()`、`deleteCustomStyle()`、`applyPreset()`，每个写操作调用注入的 `syncData()`
- [x] T029 [US1] 在 `src/hooks/useDesign.ts` 中实现 `analyzeTemplateImage(base64)`：调用 Gemini 视觉模型，解析结果更新 colors/style/* 状态（使用 `withRetry()` 包装）
- [x] T030 [US1] 在 `src/hooks/useDesign.ts` 中实现 `handleTemplateUpload()`、`handleStyleGuideUpload()`（文件读取转 base64，包含 mammoth/pdfjs 解析）
- [x] T031 [US1] 在 `src/hooks/useDesign.ts` 中实现 `getDesignConfig()`：返回当前所有设计状态的 `DesignConfig` 快照
- [x] T032 [US1] 在 `src/hooks/useDesign.ts` 中实现 `allStyles` useMemo（`[...PRESET_STYLES, ...customStyles]`）
- [x] T033 [US1] 更新 `src/App.tsx`：用 `useDesign(userApiKey, syncData)` 调用替换对应设计状态和函数
- [x] T034 [US1] 运行 `npm run lint` 验证 useDesign 集成后零类型错误
- [x] T035 [US1] 运行 `npm run test:e2e -- --grep "design"` 验证设计面板功能与基线一致

**useDesign Checkpoint**: `tsc` 零错误 + `design-panel.spec.ts` 全部 PASS

### 实现 useAI（US1）

- [x] T036 [US1] 创建 `src/hooks/useAI.ts`，实现完整函数签名 `useAI(userApiKey, selectedModel, designConfig, activeProject, syncData, setProjects, showToast)`，声明所有 21 个 AI 相关状态，参考 contracts/hooks-api.md useAI 章节
- [x] T037 [US1] 在 `src/hooks/useAI.ts` 中实现 `generateSlide(item?)`：调用 Gemini JSON Schema 模式，追加到 activeProject.slides，调用 syncData()；**必须用 `withRetry()` 包装**
- [x] T038 [US1] 在 `src/hooks/useAI.ts` 中实现 `generateOutline()`：调用 Gemini 自由文本，正则解析 `[SLIDE]...[END_SLIDE]` 块得到 OutlineItem[]；**必须用 `withRetry()` 包装**
- [x] T039 [US1] 在 `src/hooks/useAI.ts` 中实现 `refineOutlineItem(id)`、`refineAllOutlineItems()`、`suggestLayouts(item)`；**必须用 `withRetry()` 包装**
- [x] T040 [US1] 在 `src/hooks/useAI.ts` 中实现 `remixSlide(slide)`：重新生成替换对应幻灯片；**必须用 `withRetry()` 包装**
- [x] T041 [US1] 在 `src/hooks/useAI.ts` 中实现 `startRecording()`、`stopRecording()`：麦克风权限、MediaRecorder 初始化、audioBlob 合并；失败时调用 `showToast(err, 'error')`
- [x] T042 [US1] 在 `src/hooks/useAI.ts` 中实现 `handleImageUpload()`、`handleScriptFileUpload()`、`removeScriptFile()`、`clearInputs()`
- [x] T043 [US1] 更新 `src/App.tsx`：用 `useAI(...)` 调用替换对应 AI 生成状态和函数；确保 `designConfig` 从 `getDesignConfig()` 获取
- [x] T044 [US1] 运行 `npm run lint` 验证 useAI 集成后零类型错误
- [x] T045 [US1] 运行 `npm run test:e2e` 执行完整 E2E 套件，验证所有用例与基线一致（**全量回归**）
- [x] T046 [US1] 审查 `src/App.tsx` 确认文件仅包含 JSX 骨架、auth 状态和 UI 状态，不含任何业务逻辑函数定义（验收 FR-004）
- [x] T047 [US1] 更新 `TODO.md`，将阶段一所有已完成条目标记为 `[x]`

**Checkpoint**: US1 完成 — `npm run lint` 零错误 + `npm run test:e2e` 全部 PASS（6 个 spec 文件）

---

## Phase 4: User Story 2 - 核心业务逻辑自动化测试覆盖（Priority: P2）

**Goal**: 引入 Vitest 测试框架，为六个核心模块建立自动化测试覆盖（utils、dbService、pptxService、useProjects、useAI、server API）

**Independent Test**: 运行 `npm test` 所有用例 PASS，无 FAIL

**前置条件**: US1（Phase 3）必须完成

### 测试基础设施搭建（US2）

- [x] T048 [US2] 安装测试依赖：`npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event fake-indexeddb supertest @types/supertest jsdom`（参考 research.md R-03）
- [x] T049 [US2] 创建 `vitest.config.ts`：配置 environment=happy-dom、globals=true、setupFiles、coverage include（`src/utils.ts`、`src/services/**`、`src/hooks/**`、`server.ts`），参考 quickstart.md 阶段二章节
- [x] T050 [US2] 创建 `tests/setup.ts`：全局测试环境初始化（fake-indexeddb 注入、vi.mock 基础配置）
- [x] T051 [US2] 在 `package.json` 中添加 `"test": "vitest"` 和 `"test:coverage": "vitest --coverage"` 脚本
- [x] T052 [US2] 修改 `server.ts`：将数据库路径改为读取 `process.env.DB_FILE ?? 'cloud_storage.db'`（参考 research.md R-04），支持测试时使用 `:memory:`
- [x] T053 [US2] 创建 `tests/fixtures/index.ts`：导出 `createSlideElement`、`createSlide`、`createProject`、`createPresetStyle`、`createDesignConfig` 五个工厂函数（参考 data-model.md 阶段二测试实体章节）

### 单元测试实现（US2）

- [x] T054 [P] [US2] 创建 `tests/unit/utils.test.ts`：覆盖 `src/utils.ts` 中 `cn`、`withRetry`、图片处理等所有纯函数
- [x] T055 [P] [US2] 创建 `tests/unit/dbService.test.ts`：使用 fake-indexeddb mock，覆盖 `src/services/dbService.ts` 中所有 IndexedDB 操作（增删改查，参考 spec.md 验收场景 US2-1）
- [x] T056 [P] [US2] 创建 `tests/unit/pptxService.test.ts`：mock pptxgenjs，覆盖 `src/services/pptxService.ts` 数据映射逻辑（坐标系 0–100% → "n%" 转换，参考 spec.md 验收场景 US2-2）
- [x] T057 [P] [US2] 创建 `tests/unit/useProjects.test.ts`：使用 @testing-library/react renderHook，mock dbService 和 fetch，覆盖项目 CRUD 和 syncData 双写逻辑（参考 spec.md 验收场景 US2-3）
- [x] T058 [P] [US2] 创建 `tests/unit/useAI.test.ts`：vi.mock `@google/genai`，覆盖 generateSlide、generateOutline 主流程（参考 spec.md 验收场景 US2-4）

### 集成测试实现（US2）

- [x] T059 [US2] 创建 `tests/integration/server.test.ts`：使用 Supertest + `DB_FILE=:memory:`，测试 GET `/api/user-data` 和 POST `/api/user-data` 接口行为（含 401 缺少 x-api-key 场景，参考 spec.md 验收场景 US2-5）
- [x] T060 [US2] 运行 `npm test` 确认所有用例 PASS（参考 spec.md 验收场景 US2-6）
- [x] T061 [US2] 运行 `npm run lint` 确认测试文件类型检查零错误
- [x] T062 [US2] 更新 `TODO.md`，将阶段二所有已完成条目标记为 `[x]`

**Checkpoint**: US2 完成 — `npm test` 全部通过，核心业务逻辑有自动化保障

---

## Phase 5: User Story 3 - 生产环境部署就绪（Priority: P3）

**Goal**: 消除 API Key 前端暴露风险，实现端口配置、CORS、限流、生产启动脚本，提供部署文档

**Independent Test**: 构建产物中不含 API Key 字符串；非默认端口启动成功；超限请求返回 429；`npm start` 以生产模式启动

**前置条件**: US2（Phase 4）必须完成

### 依赖安装（US3）

- [x] T063 [US3] 安装生产依赖：`npm install cors express-rate-limit` 和开发依赖 `npm install -D @types/cors`（参考 research.md R-06）

### 服务端安全与配置改造（US3）

- [x] T064 [US3] 修改 `server.ts`：添加 `PORT` 环境变量支持（`const PORT = parseInt(process.env.PORT ?? '3000')`，参考 spec.md FR-015）
- [x] T065 [US3] 修改 `server.ts`：配置 CORS 中间件（`cors` 包），从 `ALLOWED_ORIGINS` 环境变量读取允许来源，默认 `http://localhost:3000`（参考 spec.md FR-017、server-api.md 中间件栈章节）
- [x] T066 [US3] 修改 `server.ts`：配置 `express-rate-limit` 对 `/api/*` 路由限流，从 `RATE_LIMIT_WINDOW_MS`（默认 900000）和 `RATE_LIMIT_MAX`（默认 100）环境变量读取配置（参考 spec.md FR-018）
- [x] T067 [US3] 修改 `server.ts`：服务端从 `process.env.GEMINI_API_KEY` 读取 AI Key，新增 `POST /api/ai/generate-content` 代理端点，接收前端请求并转发给 Gemini API（参考 contracts/server-api.md 阶段三新增端点章节、spec.md FR-013）
- [x] T068 [US3] 修改 `server.ts`：新增 `GET /api/session` 端点：验证 `x-api-key` 后生成 session token，存入 SQLite `session_token` 字段，响应 `{ sessionToken, expiresAt }`（参考 contracts/server-api.md、data-model.md 阶段三服务端数据模型）
- [x] T069 [US3] 修改 `server.ts`：为 `user_data` 表添加 `session_token TEXT` 列（ALTER TABLE 或重建迁移逻辑），参考 data-model.md SQLite user_data 表章节

### 前端 API Key 安全迁移（US3）

- [x] T070 [US3] 修改 `vite.config.ts`：移除 `GEMINI_API_KEY` 从 `.env` 注入前端构建的逻辑（参考 spec.md FR-014）
- [x] T071 [US3] 修改 `src/hooks/useAI.ts`：将所有 Gemini API 调用从直接使用 `userApiKey` 改为调用 `/api/ai/generate-content` 代理端点（保持 `withRetry()` 包装）
- [x] T072 [US3] 修改 `src/hooks/useDesign.ts`：将 `analyzeTemplateImage` 中的 Gemini 调用改为走 `/api/ai/generate-content` 代理端点
- [x] T073 [US3] 修改 `src/hooks/useProjects.ts`：在 `loadUserData` 中改用 `GET /api/session` 换取 session token，后续同步请求改用 `x-session-token` 头（参考 research.md R-05 迁移方案）

### 生产部署完善（US3）

- [x] T074 [US3] 在 `package.json` 中添加 `"build:server": "tsc server.ts --outDir dist"` 和 `"start": "node dist/server.js"` 脚本（参考 spec.md FR-016）
- [x] T075 [US3] 更新 `.env.example`：新增 `PORT`、`ALLOWED_ORIGINS`、`RATE_LIMIT_WINDOW_MS`、`RATE_LIMIT_MAX`、`DB_FILE` 条目及说明注释
- [x] T076 [US3] 创建 `DEPLOYMENT.md`：涵盖 Linux + Nginx + PM2 标准生产环境搭建步骤（反向代理配置、进程管理、HTTPS 配置、环境变量清单），参考 spec.md FR-019、SC-008
- [x] T077 [US3] 运行 `npm run build` 并执行 `grep -r "AIza" dist/` 验证构建产物中无 API Key 字符串（参考 spec.md 验收场景 US3-1、quickstart.md 阶段三安全检查）
- [x] T078 [US3] 运行 `npm run lint` 确认所有改动类型检查零错误
- [x] T079 [US3] 运行 `npm test` 确认全量单元/集成测试仍然通过（回归验证）
- [x] T080 [US3] 运行 `npm run test:e2e` 确认全量 E2E 套件通过（验证安全改造后功能行为不变）
- [x] T081 [US3] 更新 `TODO.md`，将阶段三所有已完成条目标记为 `[x]`

**Checkpoint**: US3 完成 — 构建产物无 API Key + `npm test` PASS + `npm run test:e2e` PASS

---

## Phase 6: Polish（收尾与横切关注点）

**目的**: 验证整体改造质量，更新项目文档

- [x] T082 [P] 审查 `src/AGENTS.md`，确保 hooks 层接口约定、依赖关系与最终实现一致；若有偏差则同步更新
- [x] T083 [P] 审查 `specs/001-project-refactor-roadmap/contracts/hooks-api.md`，确认与最终实现的函数签名一致
- [x] T084 执行完整回归测试：`npm run lint && npm test && npm run test:e2e && npm run build`，确认全部通过

---

## Dependencies & Execution Order

### Phase 依赖关系

- **Phase 1 (Setup)**: 无依赖，立即开始 — **包含 E2E 基线建立（T003–T013），必须全部 PASS 后才能开始重构**
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成 — **阻塞所有 Hook 实现**
- **Phase 3 (US1)**: 依赖 Phase 2 完成 — 每个 hook 集成后跑对应 E2E 子集验证
- **Phase 4 (US2)**: 依赖 Phase 3 完成 — 测试基础设施搭建后各模块测试可并行（T054–T059 标记 [P]）
- **Phase 5 (US3)**: 依赖 Phase 4 完成 — 服务端改造和前端迁移可部分并行；完成后全量 E2E 回归
- **Phase 6 (Polish)**: 依赖 Phase 5 完成

### User Story 依赖

- **US1 (P1)**: 依赖 Foundational 完成，无其他故事依赖
- **US2 (P2)**: **严格依赖 US1 完成**（hooks 拆分后才能对 hooks 编写测试）
- **US3 (P3)**: **严格依赖 US2 完成**（测试覆盖是高风险安全改造的前提）

### Hook 内部依赖（Phase 3）

- `useProjects` 先完成（提供 `syncData`）
- `useDesign(userApiKey, syncData)` 在 `useProjects` 提供 syncData 类型后可实现
- `useAI(... syncData, setProjects ...)` 在 `useProjects` 提供相关类型后可实现
- 三个 hook 可以各自在单独分支并行开发，最后合并到 App.tsx 集成

### E2E 测试在各阶段的作用

| 阶段 | E2E 作用 | 触发时机 |
|------|---------|---------|
| Phase 1 结束 | 建立重构前功能基线 | T013，**必须全 PASS 才能继续** |
| useProjects 集成后 | 验证登录 + 数据同步不回归 | T026 |
| useDesign 集成后 | 验证设计面板不回归 | T035 |
| useAI 集成后（US1 完成） | 全量回归，验证所有功能 | T045 |
| US3 完成后 | 验证安全改造不破坏功能 | T080 |
| Phase 6 收尾 | 最终全链路验证 | T084 |

---

## Parallel Example: User Story 1

```bash
# 三个 hook 文件可并行开发（不同文件）：
Task: "T019–T026 实现 useProjects.ts 并集成到 App.tsx，跑 E2E auth+sync"
Task: "T027–T035 实现 useDesign.ts 并集成到 App.tsx，跑 E2E design"
Task: "T036–T045 实现 useAI.ts 并集成到 App.tsx，跑全量 E2E"
# 注：并行后需统一在 App.tsx 集成，建议单人顺序开发
```

## Parallel Example: User Story 2

```bash
# 五个单元测试文件可并行开发：
Task: "T054 tests/unit/utils.test.ts"
Task: "T055 tests/unit/dbService.test.ts"
Task: "T056 tests/unit/pptxService.test.ts"
Task: "T057 tests/unit/useProjects.test.ts"
Task: "T058 tests/unit/useAI.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 User Story 1）

1. 完成 Phase 1: Setup（含 E2E 基线建立，T003–T013 全 PASS）
2. 完成 Phase 2: Foundational（**关键 — 阻塞所有故事**）
3. 完成 Phase 3: User Story 1（每个 hook 后跑 E2E 子集）
4. **停止并验收**：`npm run lint` 零错误 + `npm run test:e2e` 全部 PASS
5. 可选部署/演示

### Incremental Delivery

1. Setup + Foundational → 类型基础就绪，E2E 基线建立
2. 完成 US1 → 代码可维护性提升，E2E 自动验证行为不变 → 交付（里程碑一）
3. 完成 US2 → 自动化单元/集成测试覆盖建立 → 交付（里程碑二）
4. 完成 US3 → 生产部署就绪，E2E 回归验证安全改造不破坏功能 → 交付（里程碑三）
5. Polish → 全链路 `lint + test + test:e2e + build` 确认

---

## Notes

- [P] 任务 = 不同文件，无依赖冲突，可并行执行
- [Story] 标签追踪每个任务到对应用户故事
- **E2E 是 US1 重构的唯一运行时验证手段**：在 US2 单元测试建立之前，Playwright 是防止重构破坏行为的核心保障
- **E2E 使用 Playwright route mock**：拦截 `/api/user-data` 和 Gemini API 调用，避免依赖真实网络
- **坐标系约定不可破坏**：所有 SlideElement x/y/w/h 保持 0–100 百分比
- **AI 调用必须用 `withRetry()` 包装**：参见 T037–T040
- **数据同步必须双写**：`syncData()` 同时写云端和 IndexedDB，参见 T021
- 每完成一个 TODO 条目，立即在 `TODO.md` 中标记为 `[x]`
- 阶段一原则：**只搬移代码，不改行为**（重构期间不引入新功能，不修复 bug）
