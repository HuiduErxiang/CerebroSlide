# Feature Specification: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Feature Branch**: `004-project-style-memory`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "项目记忆内容场景与预设风格，支持编辑已有预设风格；正文内容精炼后强制输出中文"

## Clarifications

### Session 2026-04-08

- Q: 场景和风格变更后触发同步的时机策略是什么？ → A: 变更后 debounce 500ms 再调用 `syncData()`
- Q: 现有 `customStyles` 中的风格条目是否已有 `isBuiltIn` 字段？ → A: 无此字段，缺失时默认视为自定义风格，运行时动态补全，无需迁移脚本
- Q: 编辑预设风格的 UI 交互形式是什么？ → A: 复用现有新建风格弹窗，以预填编辑模式打开
- Q: 精炼强制中文的范围是哪些文本字段？ → A: 仅限「本页专属风格」（styleRequirements / styleDescription）字段，标题/副标题/正文不强制

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 项目记忆内容场景与预设风格 (Priority: P1)

用户为某个项目选择了内容场景（如"医疗学术"）和预设风格（如"极简深色"）后，刷新页面或重新打开该项目，系统自动恢复上次选择的场景和风格，无需重新配置。

**Why this priority**: 核心痛点——每次刷新都回到默认值，严重打断工作流，导致用户重复劳动。

**Independent Test**: 为项目选择非默认场景和风格 → 刷新页面 → 切换到该项目 → 验证场景和风格自动恢复。

**Acceptance Scenarios**:

1. **Given** 用户已为项目 A 选择了非默认内容场景 S 和预设风格 P，**When** 用户刷新页面并切换到项目 A，**Then** 场景选择器显示 S，风格选择器显示 P。
2. **Given** 用户切换到项目 B（从未为其选择过场景和风格），**When** 项目 B 被激活，**Then** 场景和风格回退到系统默认值。
3. **Given** 用户在项目 A 中修改了场景或风格，**When** 用户不刷新直接切换项目 B 再切回项目 A，**Then** 项目 A 展示最新修改的值。

---

### User Story 2 - 编辑已有预设风格 (Priority: P2)

用户在预设风格列表中选中一个已有风格（内置或自定义），可以在其基础上修改颜色、字体、描述等属性并保存，无需从零创建新风格。

**Why this priority**: 用户通常只想微调现有风格（如换主色），而非重新创建一套，减少重复工作。

**Independent Test**: 选中风格 → 点击编辑 → 修改属性 → 保存 → 验证属性已更新，其他风格不受影响。

**Acceptance Scenarios**:

1. **Given** 预设风格列表中有风格 X，**When** 用户点击 X 的编辑入口并修改名称或颜色后保存，**Then** 风格列表中 X 的展示和实际应用均反映新值。
2. **Given** 用户正在编辑风格 X，**When** 用户取消编辑，**Then** 风格 X 的属性保持不变。
3. **Given** 用户编辑了风格 X 并保存，**When** 刷新页面，**Then** 修改依然保留（持久化）。
4. **Given** 风格 X 是系统内置风格，**When** 用户编辑并保存，**Then** 保存为独立副本，原内置风格不被修改。

---

### User Story 3 - 精炼操作强制「本页专属风格」字段输出中文 (Priority: P2)

用户对幻灯片执行"精炼"操作后，无论原始内容语言如何，精炼结果中「本页专属风格」相关字段（`styleRequirements` / `styleDescription`）均以中文输出；标题、副标题、正文等其他文本字段不做语言强制。

**Why this priority**: 项目面向中文受众，专属风格描述字段出现英文/混语内容影响可用性，需系统层面强制保证。

**Independent Test**: 输入英文内容 → 执行精炼 → 验证精炼结果的 `styleRequirements` / `styleDescription` 为中文。

**Acceptance Scenarios**:

1. **Given** 幻灯片的 `styleRequirements` 为英文，**When** 用户执行精炼操作，**Then** 精炼后的 `styleRequirements` 为中文。
2. **Given** 幻灯片的 `styleDescription` 为中英混合，**When** 用户执行精炼操作，**Then** 精炼后的 `styleDescription` 统一为中文。
3. **Given** 幻灯片正文（非风格字段）为英文，**When** 用户执行精炼操作，**Then** 正文语言不受强制约束。
4. **Given** 精炼操作对专有名词（人名、品牌名、药品名等），**Then** 保留原文，不强行翻译。

---

### Edge Cases

- 用户删除了某个项目曾记忆的预设风格后，该项目加载时降级到系统默认风格，不报错。
- 编辑风格时正在使用该风格的已生成幻灯片不受影响，仅影响后续生成。
- `customStyles` 存储中缺少 `isBuiltIn` 字段的旧数据，运行时默认视为自定义风格（`isBuiltIn: false`），无需迁移脚本。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 将每个项目的「当前内容场景 ID」和「当前预设风格 ID」作为项目属性持久化（云端 + 本地双写）。
- **FR-002**: 用户切换到某个项目时，系统 MUST 自动将场景选择器和风格选择器恢复为该项目记忆的值；记忆值缺失时使用系统默认值。
- **FR-003**: 用户在项目内变更场景或风格时，系统 MUST 在 debounce 500ms 后调用 `syncData()` 触发云端 + 本地双写同步。
- **FR-004**: 预设风格列表中每个风格条目 MUST 提供编辑入口（内置和自定义风格均支持）。
- **FR-005**: 编辑内置风格时，系统 MUST 另存为新的自定义风格副本，原内置风格保持不变。
- **FR-006**: 编辑自定义风格时，系统 MUST 直接更新该风格属性并持久化（云端 + 本地双写）。
- **FR-007**: 风格编辑器 MUST 支持修改：风格名称、颜色方案（4 色）、风格描述（styleDescription）、风格要求（styleRequirements）；编辑器通过复用现有新建风格弹窗以预填编辑模式打开。
- **FR-008**: 用户取消编辑时，系统 MUST 丢弃所有未保存的修改。
- **FR-009**: 精炼操作的 AI 指令 MUST 包含强制中文输出的约束，仅作用于 `styleRequirements` 和 `styleDescription` 字段，不强制约束标题、副标题、正文等其他文本字段。
- **FR-010**: `PresetStyle` 实体的 `isBuiltIn` 字段缺失时，系统 MUST 在运行时将其默认推断为 `false`（自定义风格），无需数据库迁移。

### Key Entities

- **Project**：新增 `scenarioId` 和 `stylePresetId` 两个可选字段，分别记忆内容场景 ID 和预设风格 ID。
- **PresetStyle**：现有实体；新增 `isBuiltIn` 标记区分系统内置（只读来源）和用户自定义（可直接修改）；旧数据缺失该字段时运行时默认 `false`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 切换项目后，场景和风格自动恢复，无需任何手动重新选择。
- **SC-002**: 刷新页面后项目的场景和风格记忆 100% 保留，无丢失。
- **SC-003**: 编辑并保存一个预设风格的完整流程（点击编辑到保存完成）在 3 次交互以内完成。
- **SC-004**: 编辑内置风格不污染原始内置风格数据，原始值任何时候均可恢复。
- **SC-005**: 对任意语言内容执行精炼后，`styleRequirements` 和 `styleDescription` 字段输出 100% 为中文（专有名词除外）；其他文本字段不受语言约束。
- **SC-006**: 场景/风格变更后最多 500ms 触发一次同步，快速连续切换不产生多余 POST 请求。

## Assumptions

- 内容场景（Scenario）和预设风格（PresetStyle）均通过唯一 ID 标识，项目只存 ID 引用而非完整副本。
- 预设风格编辑器复用现有风格配置 UI 组件（新建风格弹窗以预填编辑模式打开），不引入全新设计界面。
- 系统内置风格以代码常量形式存在，不存储在数据库；"编辑内置风格"实质是 clone 后编辑。
- 场景和风格记忆跟随项目数据的现有云端同步通道，不需要独立同步机制。
- 精炼功能指 `useAI.ts` 中现有的 refine 系列操作（`refineOutlineItem` / `refineAllOutlineItems`）。
- 移动端适配不在本次迭代范围内。
