# Research: 幻灯片生成质量修复

**Feature**: 002-fix-slide-quality
**Phase**: 0 — Research
**Date**: 2026-04-07

---

## R-001: AI 提示词约束强化策略

**Decision**: 在 `SYSTEM_INSTRUCTION` 的 `CRITICAL DESIGN RULES` 区域，将字号规则改为"MUST be EXACTLY"强制语气，并在提示词顶部的 Palette 区域直接插入字体名和字号的硬约束表述，作为副标题级别的强制规则。

**Rationale**:
- 现有提示词中字号、颜色规则已存在（如 `Titles: ${config.titleFontSize}pt`），但措辞是描述性的（"Titles:"而非"ALL titles MUST use EXACTLY"），Gemini 将其作为参考而非约束。
- 颜色部分已标注 `(STRICT USAGE - YOU MUST USE THESE EXACT HEX CODES)` 但实践中仍被忽略；问题在于字体和字号约束未达到同等强度。
- Gemini Flash 等小模型对"MUST"/"MANDATORY"/"NON-NEGOTIABLE"等词汇有更强的遵从性，需要同时在规则编号旁和规则描述内重复强调。

**Alternatives considered**:
- Few-shot 样例注入：提供已正确使用字号/颜色的 JSON 样例作为 few-shot。被拒绝：会显著增大 prompt token 数，与"Simplicity"原则冲突，且 Flash 模型对 schema 约束响应比 few-shot 更稳定。
- 在 `responseSchema` 的 enum/pattern 中直接约束颜色值：被拒绝，JSON Schema 的 `pattern` 只约束格式不约束值域，且不同幻灯片的颜色值不同，无法静态固化。

---

## R-002: responseSchema 中 required 字段扩充

**Decision**: 将 `_slideResponseSchema` 中 `elements` 数组的 `style` 对象内的 `color` 和 `fontFamily` 字段标记为 `required`，同时在 `remixSlide` 中内联的 schema 做同步更新。

**Rationale**:
- Gemini 在 schema 约束下会严格输出 required 字段；将 `color` 和 `fontFamily` 从 optional 变为 required 能强制 AI 为每个元素输出这两个字段，防止缺省到渲染层的默认值（`#000`）。
- 现有 schema 对 `style` 整体非 required（`style` 字段本身不在 elements 的 required 列表里），但 `style` 的内部字段更不可能输出——修复时需同时确保 `style` 对象本身也出现在元素中。
- 对于 `type="shape"` 或 `type="image"` 的元素，`color` 和 `fontFamily` 语义不适用；需在提示词中说明"对 text 类型元素 color 和 fontFamily 为必填"，schema 层面统一 required 即可（非文本元素 AI 通常不填也不影响渲染）。

**Alternatives considered**:
- 分 schema 策略（text/shape/image 各一套）：理论上更精确，但 Gemini SDK 的 responseSchema 不支持 `oneOf`/`discriminator`，无法实现，被拒绝。

---

## R-003: 重叠检测与自动修正算法

**Decision**: 在 `src/utils.ts` 新增纯函数 `detectAndFixOverlaps(elements: SlideElement[]): SlideElement[]`，采用"垂直方向贪心推移"策略：按 `y` 坐标排序非背景文本/形状元素，逐对比较边界框，若 `[y, y+h]` 区间相交且水平也相交，则将下方元素的 `y` 值后移至上方元素底部 + 2%（最小间距）。

**Rationale**:
- 重叠问题绝大多数是 AI 在垂直方向上分配坐标不足时产生的，水平分隔布局（split-left/right）的列内元素几乎都是纯垂直堆叠，贪心推移足以覆盖 90%+ 场景。
- 纯函数不依赖 React 状态，可在 Vitest 中直接测试，也可被 `generateSlide` 和 `remixSlide` 两处复用。
- 背景图元素（`type="image"` 且 x=0,y=0,w=100,h=100）必须从检测对象中排除，否则会被误判为与所有元素重叠。
- 边界情况：修正后 `y+h > 100` 时不进一步截断（保留溢出），由提示词约束来预防；连续多元素推移时可能超出 100%，此为 AI 生成质量问题而非修正逻辑问题，spec 中也明确了此边界不在修复范围内。

**Alternatives considered**:
- 基于 z-index 的网格分配（将画布划分为固定网格区域）：适用于新建布局，不适用于已有 AI 输出的事后修正，被拒绝。
- 整体重排（所有元素重新分配 y）：破坏 AI 精心设计的视觉层次，风险过大，被拒绝。

---

## R-004: SlidePreview 渲染问题定位

**Decision（FR-008 color）**: 文本元素已通过内联 `style.color` 传递（见现有代码 `color: el.style?.color || '#000'`），问题根源在于 fallback 值 `'#000'` 在 `style.color` 为空字符串时也会触发。修复为：仅当 `el.style?.color` 明确存在时使用，否则使用 `'inherit'`，并移除 Tailwind 类中可能覆盖 color 的文字色工具类（当前无，确认后无需操作）。

**Decision（FR-009 字体注入）**: `SlidePreview` 当前不注入任何字体 `<link>`，导致 Google Fonts 可能未加载而回退到系统默认字体。修复方案为在 `SlidePreview` 组件内通过 `useEffect` 提取当前 slide 中所有 `fontFamily` 值，解析出字体名称（取逗号前第一项，去引号），构造 Google Fonts URL 并动态插入 `<link>` 到 `document.head`，同时通过 dataset 属性去重，避免重复注入。

**Decision（FR-010 overflow）**: 当前代码已设置 `overflow: 'hidden'`，但无 `textOverflow` 和 `whiteSpace` 设置，导致多行文本溢出时以像素为单位硬性截断。修复为增加 `textOverflow: 'ellipsis'`。注意：`text-overflow: ellipsis` 仅在单行时生效（需配合 `whiteSpace: 'nowrap'`）；对于多行需 `-webkit-line-clamp`。考虑到幻灯片预览的场景（通常是短内容），对单行场景用 `ellipsis`，对多行（flex 列）场景不强制截断，以避免丢失关键内容。

**Rationale**:
- `SlidePreview` 是纯展示组件，当前已有内联样式框架，修复可以精确控制到每个属性，无需引入 CSS Modules 或新依赖。
- 字体注入必须在 `useEffect` 中执行（DOM 副作用），且需要在 SSR 场景下守护 `typeof document !== 'undefined'`（虽然本项目是纯 CSR，但保持良好习惯）。

**Alternatives considered**:
- 全局字体预加载（在 `index.html` 中引入所有可能的 Google Fonts）：会增加不必要的网络请求，被拒绝。
- CSS `font-display: swap` + CSS custom properties 方案：超出本次修复范围，被拒绝。

---

## R-005: 测试策略确认

**Decision**: 
- `SYSTEM_INSTRUCTION` 提示词测试：直接调用 `SYSTEM_INSTRUCTION(...)` 函数并对返回字符串进行 `toContain` 断言，验证关键约束短语存在（如 "EXACTLY"、"MANDATORY"）。
- `_slideResponseSchema` 测试：由于 schema 是 `useAI` hook 内部的局部变量，通过在 `useAI.test.ts` 中 mock `fetch` 拦截发往 `/api/ai/generate-content` 的请求体，解析其中的 `config.responseSchema`，断言 `style` 对象的 `required` 数组包含 `color` 和 `fontFamily`。
- 重叠检测函数测试：在 `utils.test.ts` 中直接 import `detectAndFixOverlaps` 并用构造的 `SlideElement[]` 测试（有重叠 → 验证修正后坐标；无重叠 → 验证不变）。
- `SlidePreview` 渲染测试：使用 `@testing-library/react` 的 `render`，构造 mock slide 并断言 DOM 中的 style 属性和 `<link>` 标签。

**Alternatives considered**:
- 真实大模型调用集成测试：不可行（cost、速度、确定性三重问题），被拒绝。
- Playwright E2E 快照测试：对 AI 生成的非确定性内容不适用，被拒绝。
