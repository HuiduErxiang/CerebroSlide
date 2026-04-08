# Feature Specification: 幻灯片生成质量修复

**Feature Branch**: `002-fix-slide-quality`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User description: "1.生成的文本不论是字体还是字号还是文字颜色都没有严格按照我选择的预设风格中的来，具体来说字号经常偏大，字体都还是默认字体，颜色均为黑色，不符合我的设置；2.元素的布局经常会发生重叠的情况，尤其是不同的文本框之间；3.视觉化之后在网页上的预览图效果不对，元素有大量的截断和重叠，同时也有字体颜色不对的问题"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 预设风格参数严格生效（Priority: P1）

作为一名用户，我选择了预设风格后，期望生成的幻灯片中所有文本元素的字体、字号、颜色严格匹配该预设的配置：标题使用预设 `titleFontSize`、副标题使用 `subtitleFontSize`、正文使用 `bodyFontSize`，不多不少；文字颜色使用预设 `colors[3]`（主文字色）；所有文本使用预设指定的字体家族。

**Why this priority**: 预设风格是用户表达设计意图的核心入口。字号、颜色、字体是最基础的视觉属性，若 AI 生成时无视这些约束，用户的所有设计配置形同虚设，直接破坏产品可信度。

**Independent Test**: 通过单元测试 mock AI 返回固定 JSON，验证 `SYSTEM_INSTRUCTION` 中字号、颜色、字体的约束描述是否足够明确；同时验证 `_slideResponseSchema` 是否将 `style.color` 和 `style.fontFamily` 标记为 required，无需真实调用大模型。

**Acceptance Scenarios**:

1. **Given** 用户预设配置标题字号为 32pt，**When** AI 返回的幻灯片 JSON 被解析，**Then** 所有标题类文本元素的 `style.fontSize` 等于 32，不允许有任何偏差
2. **Given** 用户预设主文字色为 `#F8FAFC`，**When** AI 返回的幻灯片 JSON 被解析，**Then** 所有 `type=text` 元素的 `style.color` 等于 `#F8FAFC`，不存在为空、为黑色或其他颜色的文本元素
3. **Given** 用户预设字体为 Space Grotesk，**When** AI 返回的幻灯片 JSON 被解析，**Then** 所有文本元素的 `style.fontFamily` 字段非空且包含 `Space Grotesk`
4. **Given** `_slideResponseSchema` 已更新，**When** 单元测试验证 schema 结构，**Then** 文本元素 `style` 中 `color` 和 `fontFamily` 字段被标记为 required

---

### User Story 2 - 元素无重叠布局（Priority: P2）

作为一名用户，我期望生成的幻灯片中各文本框之间不发生视觉重叠，每个元素有明确的占位区域和合理间距。

**Why this priority**: 元素重叠直接导致内容不可读。即使风格正确，布局混乱也使整张幻灯片无法使用。

**Independent Test**: 通过单元测试，构造包含多个文本元素的 mock `SlideElement[]`，调用重叠检测函数，验证其能正确识别重叠并输出修正后的坐标，无需调用大模型。

**Acceptance Scenarios**:

1. **Given** `SYSTEM_INSTRUCTION` 已更新包含无重叠约束规则，**When** 单元测试验证提示词文本，**Then** 提示词中包含针对各布局类型的坐标分区参考和最小间距要求
2. **Given** AI 返回了存在重叠坐标的元素列表，**When** 系统执行解析后处理，**Then** 重叠检测函数识别出重叠并自动修正 y 坐标，使所有同层级非背景元素边界不相交
3. **Given** 生成一张"三栏网格"布局幻灯片，**When** 检查元素坐标，**Then** 三列区域水平方向的 x 范围无交叉，各列内元素的垂直区间无溢出

---

### User Story 3 - 预览渲染与数据一致（Priority: P3）

作为一名用户，我在网页预览幻灯片时，期望看到的颜色、字体、元素位置与 AI 返回的数据完全一致，文字不被截断，颜色不显示为黑色，字体已正确加载。

**Why this priority**: 预览是用户验收生成质量的直接途径。若预览效果与数据不符，用户无法判断质量，也无法决策是否导出。

**Independent Test**: 通过单元测试 mock `SlideElement[]` 数据，验证 `SlidePreview` 组件的渲染逻辑——检查 color 是否被正确应用、字体 link 是否被注入、overflow 策略是否合理，无需调用大模型。

**Acceptance Scenarios**:

1. **Given** 文本元素的 `style.color` 为 `#F8FAFC`，**When** `SlidePreview` 渲染该元素，**Then** 该元素的 CSS `color` 属性值为 `#F8FAFC`，不被默认样式或继承覆盖
2. **Given** 幻灯片使用了 Space Grotesk 字体，**When** `SlidePreview` 渲染，**Then** 组件已动态注入对应的 Google Fonts `<link>` 标签
3. **Given** 文本元素高度设为 15%，内容较多，**When** `SlidePreview` 渲染，**Then** 文字不会在容器中部硬性截断，超出部分以省略号呈现或容器自适应高度

---

### Edge Cases

- AI 返回的 `style.color` 格式为 `rgb(...)` 或缺少 `#` 前缀时，`SlidePreview` 直接透传给 CSS，不做格式转换；格式合法性由 `responseSchema` 约束 AI 输出保障。
- 背景图元素（x:0, y:0, w:100, h:100）与文本元素的层级关系：`SlidePreview` 按 `elements` 数组顺序渲染（DOM 自然层叠），`SYSTEM_INSTRUCTION` 约定背景元素始终排在数组首位，无需额外 z-index 逻辑。
- 用户指定的字体为中文环境下 Google Fonts 不覆盖的字符集时，回退字体的显示是否可接受？
- 重叠自动修正时，若多个元素连续堆叠，修正后总高度超出幻灯片边界（100%），按比例压缩所有参与修正元素的高度，使总高度 ≤ 100%。

## Requirements *(mandatory)*

### Functional Requirements

**问题一：预设风格参数未严格传递给 AI**

- **FR-001**: `SYSTEM_INSTRUCTION` 中字号约束必须明确表述为"严格等于"而非"参考"，标题、副标题、正文的字号分别固定为用户预设的 `titleFontSize`、`subtitleFontSize`、`bodyFontSize`，AI 不得自行调整
- **FR-002**: `SYSTEM_INSTRUCTION` 中颜色约束必须要求所有文本元素的 `color` 字段严格等于 `colors[3]`（主文字色），不允许 AI 使用其他颜色值作为文字颜色
- **FR-003**: `SYSTEM_INSTRUCTION` 中字体约束必须要求所有文本元素的 `fontFamily` 字段填写用户指定的完整字体 family 字符串，不得省略或使用通用回退
- **FR-004**: `_slideResponseSchema` 中文本元素的 `style` 对象内，`color` 和 `fontFamily` 字段必须标记为 required，强制 AI 在每个文本元素中输出这两个字段

**问题二：元素布局重叠**

- **FR-005**: `SYSTEM_INSTRUCTION` 必须包含针对各主要布局类型的坐标分区参考（如 split-left 左区 x:0–48，右区 x:52–100），限制元素坐标范围
- **FR-006**: `SYSTEM_INSTRUCTION` 必须明确要求同层级相邻文本元素之间保留至少 2% 的垂直间距
- **FR-007**: 系统在解析 AI 响应后，必须对 `elements` 数组执行重叠检测；若发现同层级非背景文本/形状元素的边界框相交，必须自动修正坐标（将下方元素 y 值后移）；若修正后参与修正的所有元素总高度超出 100%，则按比例压缩这些元素的 h 值使总高度 ≤ 100%；该逻辑以 inline 纯函数形式实现于 `useAI.ts` 的 `generateSlide` 返回后处理步骤中

**问题三：预览渲染问题**

- **FR-008**: `SlidePreview` 组件渲染文本元素时，`style.color` 字段若存在则必须通过内联样式直接设置，不得被任何 CSS 类或继承样式覆盖
- **FR-009**: `SlidePreview` 组件必须根据当前幻灯片中使用的字体，动态向 `<head>` 注入对应的 Google Fonts `<link>` 标签；注入前检查 `<head>` 中是否已存在相同 href 的 `<link>` 标签，若已存在则跳过，避免重复注入
- **FR-010**: `SlidePreview` 文本元素容器的 overflow 策略必须使用 `text-overflow: ellipsis` 配合 `overflow: hidden`，避免内容在中途硬性截断

### Key Entities

- **SlideElement**: 幻灯片元素，其 `style.color`、`style.fontFamily`、`style.fontSize` 是本次修复的核心字段
- **PresetStyle**: 用户设计配置，`colors[3]`、`fontFamily`、`titleFontSize`/`subtitleFontSize`/`bodyFontSize` 是 AI 生成的强制约束来源，不允许 AI 偏离
- **SYSTEM_INSTRUCTION**: AI 生成幻灯片的主提示词，是控制输出质量的核心入口
- **SlidePreview**: 前端预览组件，负责将 `SlideElement[]` 可视化，其渲染逻辑直接决定用户所见效果

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 修复后，通过单元测试验证 `SYSTEM_INSTRUCTION` 包含对标题、副标题、正文字号"严格等于"预设值的表述，测试通过率 100%
- **SC-002**: 修复后，`_slideResponseSchema` 单元测试验证文本元素 `style.color` 和 `style.fontFamily` 为 required 字段，测试通过率 100%
- **SC-003**: 修复后，重叠检测函数单元测试覆盖"有重叠"和"无重叠"两种输入场景，自动修正后元素边界不相交，测试通过率 100%
- **SC-004**: 修复后，`SlidePreview` 渲染单元测试验证：给定 `style.color="#F8FAFC"` 的文本元素，渲染结果的内联 color 属性等于 `#F8FAFC`，测试通过率 100%
- **SC-005**: 修复后，`SlidePreview` 渲染单元测试验证：给定使用 Space Grotesk 字体的幻灯片，`<head>` 中存在对应 Google Fonts link 标签，测试通过率 100%
- **SC-006**: 修复后，`npm run lint`（`tsc --noEmit`）零错误，`npm test` 全部通过

## Assumptions

- 字号的换算逻辑（`fontSize * 1.333` pt→px）不在本次修复范围内，保持现有逻辑不变
- 字体加载方案使用现有 Google Fonts CDN，不引入新的打包依赖
- 重叠自动修正为后处理防御措施，根本修复手段是优化 AI 提示词约束
- 本次修复不涉及图片生成阶段（第二步）的质量问题
- 所有验证均通过 mock 数据和单元测试完成，不调用真实大模型服务
- 字号约束为"严格等于"预设值，AI 不得自行根据内容长度或审美判断调整任何区域的字号

## Clarifications

### Session 2026-04-07

- Q: 重叠自动修正时，若多个元素连续堆叠，修正后总高度超出幻灯片边界（100%），如何处理？ → A: 按比例压缩所有参与修正元素的高度，使总高度 ≤ 100%
- Q: SlidePreview 注入 Google Fonts link 标签时的去重策略是什么？ → A: 检查 href 是否已存在，若存在则跳过注入
- Q: 重叠检测与自动修正逻辑（FR-007）应放在哪里？ → A: useAI.ts 内 generateSlide 的后处理步骤（inline 纯函数）
- Q: AI 返回 style.color 格式非标准时 SlidePreview 如何处理？ → A: 直接透传给 CSS，不做格式转换
- Q: SlidePreview 中背景图与文本元素的层叠顺序如何决定？ → A: 按 elements 数组顺序渲染，背景元素排在数组首位
