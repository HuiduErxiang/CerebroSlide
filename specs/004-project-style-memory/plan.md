# Implementation Plan: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Branch**: `004-project-style-memory` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-project-style-memory/spec.md`

## Summary

为每个项目持久化「内容场景 ID」和「预设风格 ID」，切换项目时自动恢复；为预设风格列表添加编辑入口，复用新建风格弹窗以预填编辑模式打开（内置风格另存副本，自定义风格直接更新）；在精炼操作的 AI Prompt 中强制 `styleRequirements` / `styleDescription` 输出中文。  
技术上：扩展 `Project` 类型、调整 `useAI` 状态初始化、改造 `useDesign.saveCustomStyle` 为支持编辑模式、修改 `refineOutlineItem` Prompt。

## Technical Context

**Language/Version**: TypeScript 5.8 / React 19  
**Primary Dependencies**: `@google/genai`（AI 调用）、`better-sqlite3`（云端存储）、IndexedDB via `dbService.ts`（本地缓存）  
**Storage**: SQLite `cloud_storage.db`（云端 projects / customStyles JSON 字段）+ IndexedDB（本地）  
**Testing**: Vitest（单元，48 个）+ Playwright（E2E，25 个）  
**Target Platform**: Web SPA（Vite 6）+ Node.js Express 后端  
**Project Type**: web-service（前后端一体）  
**Performance Goals**: 场景/风格变更后 debounce 500ms 触发一次 syncData，不产生多余 POST  
**Constraints**: 无需数据迁移脚本；`isBuiltIn` 字段缺失时运行时默认 `false`；精炼中文约束仅限 `styleRequirements` / `styleDescription`  
**Scale/Scope**: 单用户多项目，项目数量通常 <50

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Coordinate-System Consistency | PASS | 本 feature 不涉及 SlideElement 坐标字段 |
| II. Resilient AI Invocation | PASS | 精炼 prompt 改动继续沿用已有 `withRetry()` 包装 |
| III. Dual-Write Data Synchronisation | PASS | scenarioId/stylePresetId 随 project 对象一起走现有 syncData() 双写通道；customStyles 编辑后同样调用 syncData() |
| IV. API Key Security Boundary | PASS | 无新 AI 调用路径，不增加 Key 暴露面 |
| V. Simplicity & Justified Complexity | PASS | 不引入新抽象层；编辑风格复用现有新建弹窗 |

**Result**: 无违规，无需填写 Complexity Tracking 表。

## Project Structure

### Documentation (this feature)

```text
specs/004-project-style-memory/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── ui-contracts.md  # Phase 1 output（UI 交互约定）
└── tasks.md             # Phase 2 output（/speckit.tasks 生成）
```

### Source Code (repository root)

```text
src/
├── types.ts             # 扩展 Project（+scenarioId 已有，+stylePresetId 新增）；PresetStyle（+isBuiltIn 新增）
├── hooks/
│   ├── useAI.ts         # 1) selectedScenarioId 初始化从 activeProject 读取；2) refineOutlineItem prompt 加中文约束
│   ├── useDesign.ts     # 1) saveCustomStyle → upsertCustomStyle(editingId?)；2) deleteCustomStyle 不变
│   └── useProjects.ts   # setActiveProjectId 时同步恢复 scenarioId/stylePresetId（或在 App.tsx 监听）
└── App.tsx              # 1) 风格预设列表加编辑按钮；2) 项目切换时恢复场景/风格选择器；3) debounce syncData

tests/                   # Vitest 单元测试（涉及 upsertCustomStyle 逻辑）
e2e/                     # Playwright E2E 测试（涉及项目记忆还原、风格编辑流程）
```

**Structure Decision**: Option 1（单项目 web-service）。所有改动集中在 `src/` 下已有文件，不新增模块。
