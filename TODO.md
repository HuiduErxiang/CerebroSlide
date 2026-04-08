# 项目待办 / 改造路线图

> **维护约定**
> - `[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成 / ~~`[ ]`~~ 已废弃
> - 完成一项立即标 `[x]`，不要批量更新
> - 新任务追加到对应阶段末尾，不插入已完成条目之间
> - 单条任务 = 单次对话可完成的粒度；执行前若发现过大，先拆细再开始
> - 阶段全部完成后在标题后加 `✓`，内容保留不删除

> **AI 执行模式约定（模式 B：逐 Phase 确认）**
> - AI 一口气完成一个 Phase 内的所有 task
> - 每个 Phase 结束后运行验收命令（`npm run lint` / `npm run test:e2e` 等），展示结果
> - 等用户确认后再进入下一个 Phase
> - 详细任务列表见 `specs/001-project-refactor-roadmap/tasks.md`

---

## 当前阶段：准备期 ✓

- [x] 生成项目级及模块级 AGENTS.md 规格文档
- [x] 梳理改造路线图并归档
- [x] 生成详细 tasks.md（含依赖关系、并行机会、验收命令）

---

## 阶段零：E2E 测试基线建立
> 前置条件：无
> 验证方式：`npm run test:e2e` 全部 PASS
> 原则：在任何重构开始前建立功能基线，作为后续所有阶段的回归保障
> 详细任务见 `specs/001-project-refactor-roadmap/tasks.md` Phase 1（T003–T013）

- [x] 安装 Playwright，配置 `playwright.config.ts`
- [x] 创建 `e2e/fixtures/mock-api.ts`（统一 mock `/api/user-data` 和 Gemini 响应）
- [x] `e2e/auth.spec.ts`：登录流程 E2E 测试
- [x] `e2e/single-slide.spec.ts`：单页幻灯片生成 E2E 测试
- [x] `e2e/outline-mode.spec.ts`：多页大纲模式 E2E 测试
- [x] `e2e/pptx-export.spec.ts`：PPTX 导出 E2E 测试
- [x] `e2e/design-panel.spec.ts`：设计面板 E2E 测试
- [x] `e2e/data-sync.spec.ts`：云端同步 E2E 测试
- [x] 建立重构前基线（`npm run test:e2e` 全 PASS）

---

## 阶段一：前端分层重构
> 前置条件：阶段零完成
> 验证方式：`tsc --noEmit` 零错误 + `npm run test:e2e` 全部 PASS
> 原则：只搬移代码，不改行为；每个 hook 集成后跑 E2E 子集验证
> 详细任务见 `specs/001-project-refactor-roadmap/tasks.md` Phase 2–3

- [x] 更新 `src/AGENTS.md`（定义 hooks 边界和接口契约）
- [x] 在 `src/types.ts` 新增 `DesignConfig`、`UseProjectsReturn`、`UseDesignReturn`、`UseAIReturn` 接口
- [x] 拆分 `useProjects.ts`：`loadUserData`、`syncData`、项目 CRUD → 跑 `auth` + `data-sync` E2E
- [x] 拆分 `useDesign.ts`：设计相关状态 → 跑 `design-panel` E2E
- [x] 拆分 `useAI.ts`：`generateOutline`、`generateSlide` → 跑全量 E2E
- [x] `App.tsx` 瘦身为纯 JSX 骨架
- [x] `tsc --noEmit` 零错误 + `npm run test:e2e` 全部 PASS

---

## 阶段二：测试基础设施
> 前置条件：阶段一完成
> 验证方式：`npm test` 全部 PASS
> 详细任务见 `specs/001-project-refactor-roadmap/tasks.md` Phase 4

- [x] 引入 Vitest，配置测试环境（含 happy-dom、fake-indexeddb）
- [x] `src/utils.ts` 单元测试
- [x] `services/dbService.ts` 单元测试
- [x] `services/pptxService.ts` 单元测试
- [x] `hooks/useProjects.ts` 单元测试（mock `dbService`）
- [x] `hooks/useAI.ts` 单元测试（mock `@google/genai`）
- [x] `server.ts` 集成测试（Supertest + SQLite 内存模式）

---

## 阶段三：功能改造（部署就绪）✓
> 前置条件：阶段二完成
> 验证方式：构建产物无 API Key + `npm test` PASS + `npm run test:e2e` PASS
> 详细任务见 `specs/001-project-refactor-roadmap/tasks.md` Phase 5

- [x] Gemini API Key 改为后端代理，前端不再持有 Key
- [x] `vite.config.ts` 移除 `GEMINI_API_KEY` 注入
- [x] `server.ts` 支持 `PORT` 环境变量
- [x] 添加 `start` 生产启动脚本到 `package.json`
- [x] 添加 CORS 配置
- [x] 添加限流保护
- [x] 补充部署文档（Nginx、PM2、HTTPS）
## 阶段四：收尾（Polish）✓

- [x] 审查 `src/AGENTS.md`，确保 hooks 层接口约定与最终实现一致（补充 customStylesRef 参数、loadUserData 返回类型、setCustomStyles 暴露、后端代理 AI 调用约定）
- [x] 审查 `specs/001-project-refactor-roadmap/contracts/hooks-api.md`，同步函数签名和依赖描述
- [x] 完整回归：`npm run lint` 零错误 + `npm test` 45/45 + `npm run test:e2e` 25/25 + `npm run build` 成功
