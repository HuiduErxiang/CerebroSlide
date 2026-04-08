# Implementation Plan: SlideGen 项目全面改造路线图

**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-project-refactor-roadmap/spec.md`

## Summary

本计划覆盖 SlideGen AI 应用的三阶段改造路线图：**阶段一** 将 App.tsx（~2900 行）拆分为职责独立的 hooks（useProjects、useAI、useDesign）和纯 JSX 骨架；**阶段二** 引入 Vitest 测试框架，为六个核心模块建立自动化测试覆盖；**阶段三** 完成部署就绪改造（API Key 后端代理、端口配置、CORS、限流、生产启动脚本）。三阶段严格顺序执行，每阶段均以 `tsc --noEmit` 零错误为基本验收门槛。

## Technical Context

**Language/Version**: TypeScript 5.8（strict mode）+ Node.js（ESM，tsx 运行时）  
**Primary Dependencies**: React 19、Vite 6、Express 4、`@google/genai`、pptxgenjs v4、better-sqlite3 v12、Motion（Framer Motion v12）、Tailwind CSS 4  
**Storage**: SQLite（server，better-sqlite3）/ IndexedDB（browser，dbService.ts 封装）  
**Testing**: 当前无测试框架（阶段二引入 Vitest + jsdom + fake-indexeddb + Supertest）  
**Target Platform**: Node.js 服务器（开发/生产）+ 现代浏览器 SPA  
**Project Type**: Web 应用（React SPA + Express 后端，单仓库）  
**Performance Goals**: 重构后类型检查零错误；测试套件全部通过；生产服务 5 秒内启动监听  
**Constraints**: 坐标系约定（0–100%）不可破坏；双写同步语义不可弱化；阶段一原则为"只搬移代码，不改行为"  
**Scale/Scope**: 单仓库，~3000 行 TS/TSX，6 个核心测试目标模块，3 个改造阶段

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 检查结果 | 说明 |
|------|----------|------|
| I. 坐标系一致性 | ✅ PASS | 重构仅搬移代码，不触碰 SlideElement 坐标逻辑；pptxService 坐标映射保持不变 |
| II. 弹性 AI 调用 | ✅ PASS | useAI hook 拆分后必须保留对 `withRetry()` 的包装，不允许裸调 |
| III. 双写数据同步 | ✅ PASS | useProjects hook 必须包含完整 `syncData()` 双写逻辑，不得拆分为单写 |
| IV. API Key 安全边界 | ⚠️ KNOWN EXCEPTION → REMEDIATED IN STAGE 3 | 当前前端直持 Key 已记录为已知问题，阶段三明确消除该例外 |
| V. 简单性与有理由的复杂度 | ✅ PASS | 新增的 hooks 层和测试层均有直接需求支撑（可测试性、可维护性），未引入无谓抽象 |

**Constitution Check 结论**：阶段一、二无违规；阶段三的目标是消除原则 IV 的临时例外，整体合规。

## Project Structure

### Documentation (this feature)

```text
specs/001-project-refactor-roadmap/
├── plan.md              # 本文件（/speckit.plan 输出）
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── contracts/           # Phase 1 输出
│   ├── hooks-api.md     # hooks 对外接口契约
│   └── server-api.md    # Express API 接口契约
└── tasks.md             # Phase 2 输出（/speckit.tasks 命令生成）
```

### Source Code (repository root)

```text
src/
├── App.tsx                    # 阶段一目标：瘦身为纯 JSX 骨架（目标 <900 行）
├── hooks/                     # 阶段一新建目录
│   ├── useProjects.ts         # 用户数据加载、云端同步、项目 CRUD
│   ├── useAI.ts               # 大纲生成、幻灯片生成（含 withRetry 包装）
│   └── useDesign.ts           # 设计相关状态（布局、样式、主题）
├── services/
│   ├── dbService.ts           # IndexedDB 封装（现有，阶段二加测试）
│   └── pptxService.ts         # PPTX 导出（现有，阶段二加测试）
├── components/                # 现有组件（不变）
├── types.ts                   # 全局类型（不变）
├── constants.ts               # 常量与 Prompt 模板（不变）
└── utils.ts                   # 纯工具函数（不变）

tests/                         # 阶段二新建目录
├── unit/
│   ├── utils.test.ts
│   ├── dbService.test.ts
│   ├── pptxService.test.ts
│   ├── useProjects.test.ts
│   └── useAI.test.ts
└── integration/
    └── server.test.ts

server.ts                      # 阶段三改造：端口配置、CORS、限流、AI 代理
```

**Structure Decision**：采用单仓库 Web 应用结构（前端 src/ + 后端 server.ts）。阶段一在 `src/hooks/` 下新建三个 hook 文件；阶段二在根目录下新建 `tests/` 目录；阶段三修改 `server.ts` 和 `vite.config.ts`，不调整目录结构。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Principle IV 临时例外（阶段三消除前继续存在） | 前端直持 Key 是初始实现遗留，阶段三明确修复 | 立即修复会打乱有序的阶段化改造节奏，引入破坏性风险 |
