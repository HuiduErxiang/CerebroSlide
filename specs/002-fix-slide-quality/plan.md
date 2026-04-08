# Implementation Plan: 幻灯片生成质量修复

**Branch**: `002-fix-slide-quality` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-fix-slide-quality/spec.md`

## Summary

修复三类已知的幻灯片质量问题：(1) AI 生成的文本不遵守预设字号/字体/颜色约束；(2) 元素布局发生重叠；(3) 网页预览渲染与数据不一致。技术方案为：强化 `SYSTEM_INSTRUCTION` 提示词约束、更新 `_slideResponseSchema` 中的 required 字段、在 AI 响应后处理阶段注入后端重叠检测与坐标修正函数、修复 `SlidePreview` 组件的颜色覆盖/字体注入/overflow 策略。所有修改均在现有文件内进行，无新依赖，无新模块。

## Technical Context

**Language/Version**: TypeScript 5.8（strict mode），React 19，Node.js + tsx（ESM）
**Primary Dependencies**: @google/genai SDK、Vite 6、Tailwind CSS 4、pptxgenjs v4、Vitest（测试）
**Storage**: SQLite（better-sqlite3，服务端）、IndexedDB（浏览器端）
**Testing**: Vitest（单元/集成）+ @testing-library/react，现有测试文件位于 `tests/unit/`
**Target Platform**: Web SPA（Chrome/Edge 桌面端主要场景）
**Project Type**: Web application（React SPA + Express 后端）
**Performance Goals**: AI 生成质量提升（不增加延迟），预览渲染不产生明显抖动
**Constraints**: 不引入新依赖；不改变任何模块的对外接口签名；不修改坐标换算逻辑（pt×1.333=px 保持不变）；不涉及图片生成阶段（第二步）
**Scale/Scope**: 影响 `src/constants.ts`、`src/hooks/useAI.ts`、`src/components/SlidePreview.tsx` 三个文件；新增 1 个工具函数到 `src/utils.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Coordinate-System Consistency | PASS | 本次修复不改变坐标系；重叠修正函数操作的是 0–100 百分比坐标，后处理不转换单位 |
| II. Resilient AI Invocation | PASS | 不新增任何直接 AI 调用；现有 `generateSlide`/`remixSlide` 已用 `withRetry()` 包装，不修改调用结构 |
| III. Dual-Write Data Synchronisation | PASS | 本次修改不涉及 projects/customStyles 的写路径；生成的 Slide 仍通过 `setProjects` → `syncData` 双写，逻辑不变 |
| IV. API Key Security Boundary | PASS | 不新增任何 Key 处理逻辑 |
| V. Simplicity & Justified Complexity | PASS | 重叠检测为纯函数后处理，不引入新抽象；`utils.ts` 新增工具函数符合"最简路径"；constitution 内无违反项 |

**Pre-design conclusion**: 所有 5 项 Principle 均通过，无需填写 Complexity Tracking 表。

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-slide-quality/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

本次修复仅修改现有文件，无新增文件（工具函数添加到现有 `utils.ts`）：

```text
src/
├── constants.ts         # SYSTEM_INSTRUCTION 提示词强化（FR-001~FR-006）
├── hooks/
│   └── useAI.ts         # _slideResponseSchema required 字段（FR-004）
│                          + generateSlide 后处理注入重叠修正（FR-007）
│                          + remixSlide 同步更新 schema required
├── utils.ts             # 新增 detectAndFixOverlaps(elements) 纯函数（FR-007）
└── components/
    └── SlidePreview.tsx # color 内联样式强制（FR-008）
                           + Google Fonts 动态注入（FR-009）
                           + overflow: hidden + ellipsis（FR-010）

tests/
└── unit/
    ├── useAI.test.ts    # 补充：schema required 字段断言（SC-002）
    ├── utils.test.ts    # 补充：detectAndFixOverlaps 单元测试（SC-003）
    └── slidePreview.test.tsx  # 新增：SlidePreview 渲染测试（SC-004、SC-005）
```

**Structure Decision**: 单项目结构（Option 1 变体），与现有代码库完全一致。所有变更集中在 `src/` 和 `tests/unit/`，不涉及 `server.ts`、`services/`、`e2e/`。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

无违反项，此表留空。
