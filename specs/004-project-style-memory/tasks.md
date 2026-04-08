# Tasks: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Input**: Design documents from `/specs/004-project-style-memory/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ui-contracts.md ✅

**Organization**: 按用户故事分组，每个故事可独立实现和验收。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无未完成依赖）
- **[Story]**: 对应 spec.md 中的用户故事编号
- 每条任务包含精确文件路径

---

## Phase 1: Setup（类型与基础定义）

**Purpose**: 扩展数据类型定义，为后续所有用户故事提供基础结构

- [x] T001 在 `src/types.ts` 的 `Project` 接口中新增可选字段 `stylePresetId?: string`
- [x] T002 在 `src/types.ts` 的 `PresetStyle` 接口中新增可选字段 `isBuiltIn?: boolean`
- [x] T003 在 `src/types.ts` 的 `UseDesignReturn` 接口中新增三个字段：`editingStyleId: string | null`、`startEditStyle: (style: PresetStyle) => void`、`cancelEditStyle: () => void`

**Checkpoint**: 类型定义完成，`npm run lint` 通过 —— 可开始后续各用户故事实现

---

## Phase 2: Foundational（共享基础逻辑）

**Purpose**: 内置风格常量 `isBuiltIn` 标记，为编辑判断逻辑提供数据来源

**⚠️ CRITICAL**: US1（风格恢复）和 US2（风格编辑）均依赖此阶段完成

- [x] T004 在 `src/constants.ts` 的 `PRESET_STYLES` 数组中，为每个内置风格条目添加 `isBuiltIn: true` 字段

**Checkpoint**: 内置风格均带有 `isBuiltIn: true` 标记，类型检查通过

---

## Phase 3: User Story 1 — 项目记忆内容场景与预设风格 (Priority: P1) 🎯 MVP

**Goal**: 用户切换项目时，场景选择器和风格选择器自动恢复为该项目最后记忆的值；变更后 debounce 500ms 写回项目并同步。

**Independent Test**: 为项目选择非默认场景和风格 → 刷新页面 → 切换到该项目 → 验证场景和风格自动恢复至上次选择值；切换到从未配置过的项目时，回退到系统默认值。

### Implementation for User Story 1

- [x] T005 [US1] 在 `src/App.tsx` 中添加监听 `activeProjectId` 的 `useEffect`：读取 `activeProject.scenarioId` 调用 `setSelectedScenarioId`（缺失时使用 `'general'`）；读取 `activeProject.stylePresetId` 在 `allStyles` 中查找并调用 `applyPreset`（找不到时静默跳过）
- [x] T006 [US1] 在 `src/App.tsx` 中，用户点击场景按钮时，除调用 `setSelectedScenarioId` 外，同步更新 `activeProject.scenarioId`（通过 `setProjects` map 更新），并通过 `useRef` debounce timer 在 500ms 后调用 `syncData`
- [x] T007 [US1] 在 `src/App.tsx` 中，用户点击风格预设（`applyPreset`）时，同步更新 `activeProject.stylePresetId = style.id`（通过 `setProjects` map 更新），并复用 T006 的 debounce timer 在 500ms 后调用 `syncData`；组件 unmount 时 clearTimeout 清理
- [x] T008 [US1] 验证场景/风格恢复逻辑不触发 `syncData`（恢复是只读操作），确保 useEffect 中没有写入调用

**Checkpoint**: US1 可独立验收 —— 刷新页面后项目场景和风格 100% 恢复，快速连续切换不产生多余 POST

---

## Phase 4: User Story 2 — 编辑已有预设风格 (Priority: P2)

**Goal**: 预设风格列表每个条目有编辑入口，内置风格编辑时另存副本，自定义风格直接更新，支持修改名称/颜色/描述/要求字段。

**Independent Test**: 选中风格 → 点击编辑按钮 → 弹窗预填属性 → 修改任意字段 → 保存 → 验证风格列表更新且其他风格不受影响；编辑内置风格时原内置风格不变；刷新后修改持久化。

### Implementation for User Story 2

- [x] T009 [US2] 在 `src/hooks/useDesign.ts` 中新增 `editingStyleId` state（`useState<string | null>(null)`）和 `startEditStyle(style: PresetStyle)` 函数：将风格属性填入所有 design state（颜色、字体、描述、要求等）；若为内置风格（`style.isBuiltIn === true`）则 `setEditingStyleId('__builtin__')`，否则设为 `style.id`
- [x] T010 [US2] 在 `src/hooks/useDesign.ts` 中新增 `cancelEditStyle()` 函数：调用 `setEditingStyleId(null)`；改造 `saveCustomStyle` 为委托给新增的 `upsertCustomStyle(newStyleName)` 函数（保持对外签名不变）
- [x] T011 [US2] 在 `src/hooks/useDesign.ts` 中实现 `upsertCustomStyle(name: string)` 函数：若 `editingStyleId === null` → 新建模式（id = `'custom_' + Date.now()`，`isCustom: true`，追加到 customStyles）；若被编辑风格 `isBuiltIn === true`（即 `editingStyleId === '__builtin__'`）→ clone 为新副本追加；否则 → map 替换对应 ID；最后调用 `syncData(undefined, updated)` 并重置 `editingStyleId`
- [x] T012 [P] [US2] 在 `src/hooks/useDesign.ts` 的 `UseDesignReturn` 返回对象中导出 `editingStyleId`、`startEditStyle`、`cancelEditStyle` 三个新字段
- [x] T013 [US2] 在 `src/App.tsx` 的风格预设列表卡片中，为每个风格添加编辑图标按钮（与删除按钮同区域，`group-hover` 时显现）：内置风格显示编辑按钮但不显示删除按钮；自定义风格同时显示编辑和删除按钮
- [x] T014 [US2] 在 `src/App.tsx` 中，编辑按钮点击时调用 `e.stopPropagation()` 阻止触发 `applyPreset`，然后调用 `startEditStyle(style)` 并设置 `isSavingStyle = true` 打开弹窗
- [x] T015 [US2] 在 `src/App.tsx` 的新建/编辑风格弹窗中，根据 `editingStyleId !== null` 判断编辑模式：弹窗标题改为「编辑风格」；保存按钮调用 `upsertCustomStyle(newStyleName)`；取消按钮调用 `cancelEditStyle()` 并设 `isSavingStyle = false`

**Checkpoint**: US2 可独立验收 —— 编辑流程 3 次交互以内完成；内置风格编辑不污染原始数据；刷新后修改持久化

---

## Phase 5: User Story 3 — 精炼操作强制「本页专属风格」字段输出中文 (Priority: P2)

**Goal**: `refineOutlineItem` prompt 中，`pageStyle` 字段生成说明添加强制中文约束；其他字段（realBody 等）不受影响。

**Independent Test**: 输入英文内容执行精炼 → 验证返回结果中 `pageStyle`（即 styleRequirements/styleDescription）为中文；正文字段语言不受约束。

### Implementation for User Story 3

- [x] T016 [US3] 在 `src/hooks/useAI.ts` 的 `refineOutlineItem` 函数内，找到 prompt 中描述 `pageStyle` 字段生成逻辑的部分，追加约束：`IMPORTANT: The "pageStyle" field MUST be written entirely in Chinese (Mandarin). Keep proper nouns (人名、品牌名、药品名等) in their original form.`；并将原来对其他字段的语言说明改为 `Keep the language the same as the input for all other fields (realBody, decorativeIcon, keyData, quotes, highlights).`
- [x] T017 [P] [US3] 确认 `src/hooks/useAI.ts` 中 `refineOutlineItem` 的 `responseSchema`、`responseMimeType: 'application/json'` 及 `withRetry()` 包装均保持不变（只读确认，无需改动）

**Checkpoint**: US3 可独立验收 —— 对任意语言内容执行精炼后，`pageStyle` 字段 100% 为中文；其他文本字段不受约束

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事影响的边界条件处理与代码健壮性

- [x] T018 [P] 在 `src/App.tsx` 中处理 edge case：切换项目时若 `stylePresetId` 对应的风格已被删除（在 `allStyles` 中找不到），静默忽略不报错，保持当前 design state 不变
- [x] T019 [P] 在 `src/hooks/useDesign.ts` 中，处理 `customStyles` 中缺少 `isBuiltIn` 字段的旧数据：运行时读取时默认视为 `false`（`style.isBuiltIn ?? false`），无需迁移脚本
- [x] T020 运行 `npm run lint` 确保全部类型检查通过，修复所有类型错误

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 无依赖，立即开始
- **Phase 2（Foundational）**: 依赖 Phase 1 完成 —— 阻塞 US2 的 `isBuiltIn` 判断逻辑
- **Phase 3（US1）**: 依赖 Phase 1；US1 与 Phase 2 可并行（不依赖 `isBuiltIn` 标记）
- **Phase 4（US2）**: 依赖 Phase 1 + Phase 2 完成
- **Phase 5（US3）**: 依赖 Phase 1；与 Phase 2、3、4 完全独立，可并行
- **Phase 6（Polish）**: 依赖所有用户故事完成

### User Story Dependencies

- **US1 (P1)**: 只依赖 Phase 1（类型扩展），可在 Phase 2 进行的同时开始
- **US2 (P2)**: 依赖 Phase 1 + Phase 2（需要 `isBuiltIn` 标记）
- **US3 (P2)**: 只依赖 Phase 1（读取现有 prompt 结构），完全独立

### Parallel Opportunities

- Phase 1 的 T001、T002、T003 可并行（同一文件，需顺序编辑，建议 T001→T002→T003）
- Phase 2 的 T004 完成后，US1（T005-T008）和 US3（T016-T017）可并行启动
- US2 中 T009、T010、T011 需顺序完成（同一函数依赖）；T012 完成后 T013、T014、T015 可并行

---

## Parallel Example: US1 + US3

```bash
# Phase 1 完成后，可并行启动：
Task: "T005-T008: App.tsx 项目切换恢复逻辑 + debounce 写回 (US1)"
Task: "T016-T017: useAI.ts refineOutlineItem prompt 中文约束 (US3)"
```

---

## Implementation Strategy

### MVP First（User Story 1 Only）

1. 完成 Phase 1：类型扩展（T001-T003）
2. 完成 Phase 3：US1 实现（T005-T008）
3. **STOP and VALIDATE**：切换项目验证场景/风格自动恢复，刷新页面验证持久化
4. 可单独演示项目记忆能力

### Incremental Delivery

1. Phase 1 → Phase 2 → Foundation 就绪
2. 实现 US1（T005-T008）→ 验证 → 项目记忆上线
3. 实现 US2（T009-T015）→ 验证 → 风格编辑上线
4. 实现 US3（T016-T017）→ 验证 → 精炼中文约束上线
5. Phase 6 Polish → lint 通过 → 合并

### Single Developer Sequential Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020

---

## Notes

- **[P]** 标记的任务操作不同文件或无阻塞依赖，可并行执行
- **[Story]** 标记追踪每个任务所属用户故事
- 每个用户故事阶段完成后，立即运行 `npm run lint` 验证类型
- 场景/风格恢复 useEffect **不得**触发 syncData（只读操作）
- debounce timer ref 必须在组件 unmount 时 clearTimeout
- `upsertCustomStyle` 必须通过 `syncData(undefined, updated)` 双写，不得单独写本地或云端
- `saveCustomStyle` 保留原签名，委托 `upsertCustomStyle` 实现，维持接口兼容性
