# Research: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Phase 0 Output** | Branch: `004-project-style-memory` | Date: 2026-04-08

## 1. 项目记忆：scenarioId 已有，stylePresetId 需新增

### 现状分析

- `Project` 类型已有 `scenarioId?: ScenarioId` 字段（`src/types.ts:78`）
- `useAI.ts` 中 `selectedScenarioId` 是 hook 内 state，**与 activeProject 无绑定**——切换项目后不会还原
- `Project` 类型无 `stylePresetId` 字段，当前风格应用只修改 `useDesign` 的各拆散 state，无法知道当前激活的是哪个预设

### 决策

- Decision: 在 `Project` 中新增 `stylePresetId?: string` 字段，`scenarioId` 字段已存在直接复用
- Rationale: 仅存 ID 引用，不冗余存完整风格数据，与 spec 假设一致；ID 不存在时降级到默认值
- Alternatives considered: 在 `localStorage` 中单独存 per-project 状态 → 增加存储通道，与双写原则不符，排除

### 恢复时机

- Decision: 在 `App.tsx` 中 `useEffect([activeProjectId])` 时读取 `activeProject.scenarioId` 和 `stylePresetId`，分别调用 `setSelectedScenarioId` 和 `applyPreset`
- Rationale: `useAI` 和 `useDesign` 都在 `App.tsx` 组合，App 层统一监听 activeProject 切换最简洁，无需改 hook 签名
- Alternatives considered: 在 `useProjects.setActiveProjectId` 内回调 → 需要向 hook 注入跨 hook 依赖，违反 V 原则

### debounce 写回

- Decision: 在 App.tsx 通过 `useRef` 持有 debounce timer，场景/风格变更时先更新 project 字段再 debounce 500ms 调 `syncData()`
- Rationale: 与 spec FR-003 要求精确匹配；复用 `setProjects` + `syncData` 现有模式
- Alternatives considered: 在 useAI/useDesign 内处理 → 需要访问 setProjects，耦合度增加

---

## 2. 预设风格编辑：复用新建弹窗以预填编辑模式

### 现状分析

- `useDesign.saveCustomStyle()` 固定创建新风格（id = `'custom_' + Date.now()`）
- `App.tsx` 中风格列表仅对 `isCustom` 的风格显示删除按钮，无编辑入口
- 内置风格以 `PRESET_STYLES` 常量存在，不在 `customStyles` 数组中，`allStyles = [...PRESET_STYLES, ...customStyles]`

### 决策

- Decision: 在 `useDesign` 中新增 `editingStyleId: string | null` state 和 `startEditStyle(id: string) / cancelEditStyle() / upsertCustomStyle()` 函数；`saveCustomStyle` 保留但内部委托给 `upsertCustomStyle(null)`
- Rationale: 最小侵入性，不改 `UseDesignReturn` 接口语义上的已有函数；将"新建"和"编辑"统一为 upsert 模式
- Alternatives considered: 在 App.tsx 内联编辑逻辑 → App.tsx 已 ~1600 行，不应继续膨胀

- Decision: 内置风格（`!style.isCustom && !style.isBuiltIn` 或从 `PRESET_STYLES` 来的）编辑时 clone 为新 customStyle（id = `'custom_' + Date.now()`，`isCustom: true`，`isBuiltIn: false`）
- Rationale: 与 FR-005 精确匹配，原内置风格常量不变
- Alternatives considered: 直接修改内置风格内存副本 → 刷新后恢复原值，体验割裂

- Decision: `PresetStyle` 增加 `isBuiltIn?: boolean`；`PRESET_STYLES` 中每个条目加 `isBuiltIn: true`；缺失时默认 `false`（运行时推断）
- Rationale: 区分来源，编辑逻辑根据此字段决定 clone 还是 update

### UI 交互

- 风格列表卡片新增编辑图标按钮（与删除按钮同区域，仅内置风格和自定义风格均显示）
- 点击编辑 → `startEditStyle(id)` → 将该风格属性填入所有 design state → 打开 `isSavingStyle` 弹窗 → 用户修改后点保存 → `upsertCustomStyle(editingStyleId)`

---

## 3. 精炼强制中文输出

### 现状分析

- `refineOutlineItem` prompt 末尾要求：`Keep the language the same as the input.`
- 返回字段包括 `realBody`（正文）、`pageStyle`（映射到 `OutlineItem.pageStyle`）、`decorativeIcon`、`keyData`、`quotes`、`highlights`
- spec 明确：**仅** `styleRequirements` / `styleDescription`（在精炼上下文中对应 `pageStyle` 字段的内容）需要强制中文；正文不强制

### 字段映射澄清

精炼 prompt 返回的 `pageStyle` 对应 `OutlineItem.pageStyle`，进而传递给幻灯片生成时的 `SYSTEM_INSTRUCTION` 中的 `pageStyle` 参数（作为"本页专属风格"描述）。spec 中提到的 `styleRequirements` / `styleDescription` 在精炼场景下即为 `pageStyle` 字段。

### 决策

- Decision: 在精炼 prompt 中，将 `pageStyle` 字段的说明改为 `"Must be written in Chinese (Mandarin). 专有名词（人名、品牌名、药品名等）保留原文。"`；`realBody` 说明保留 `Keep the language the same as the input.`
- Rationale: 最小改动，精准作用于目标字段；不影响正文语言；符合 FR-009
- Alternatives considered: 在 responseSchema description 字段加约束 → `@google/genai` SDK 的 `Type.STRING` schema 不支持 description 字段，运行时会被忽略，排除；在 systemInstruction 中加全局中文约束 → 会污染正文语言，排除
