# Tasks: 幻灯片生成质量修复

**Input**: Design documents from `/specs/002-fix-slide-quality/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 验证现有代码库状态，确认修改基础

- [x] T001 Read `src/constants.ts` to understand current `SYSTEM_INSTRUCTION` structure and identify exact lines to modify
- [x] T002 [P] Read `src/hooks/useAI.ts` to locate `_slideResponseSchema` variable and `generateSlide`/`remixSlide` function boundaries
- [x] T003 [P] Read `src/components/SlidePreview.tsx` to locate text element rendering logic and identify current color/overflow/font handling
- [x] T004 [P] Read `src/utils.ts` to understand existing exports and identify insertion point for `detectAndFixOverlaps`

**Checkpoint**: All target files read — implementation can begin

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 新增纯函数工具 `detectAndFixOverlaps`，该函数被 US1、US2 共同依赖（通过 `useAI.ts` 调用），必须先完成

**⚠️ CRITICAL**: US2 的后处理步骤依赖此函数，必须先于 Phase 3 的 `useAI.ts` 修改完成

- [x] T005 Add `detectAndFixOverlaps(elements: SlideElement[]): SlideElement[]` pure function to `src/utils.ts`

**Checkpoint**: `detectAndFixOverlaps` exported from `src/utils.ts` — US2 post-processing can now be wired in

---

## Phase 3: User Story 1 - 预设风格参数严格生效 (Priority: P1) 🎯 MVP

**Goal**: AI 生成的每个文本元素严格使用预设的 `titleFontSize`/`subtitleFontSize`/`bodyFontSize`、`colors[3]` 主文字色、预设 `fontFamily`，不允许偏差

**Independent Test**: 单元测试 mock AI 返回固定 JSON，验证 `SYSTEM_INSTRUCTION` 约束措辞（含 "EXACTLY"）以及 `_slideResponseSchema` 中 `style.required` 包含 `color` 和 `fontFamily`，无需调用大模型

### Implementation for User Story 1

- [x] T006 [US1] Strengthen font-size constraint in `src/constants.ts` `SYSTEM_INSTRUCTION`: change title/subtitle/body size lines to `ALL title elements MUST use EXACTLY ${config.titleFontSize}pt. DO NOT deviate.` / `ALL subtitle elements MUST use EXACTLY ${config.subtitleFontSize}pt.` / `ALL body/content elements MUST use EXACTLY ${config.bodyFontSize}pt.`
- [x] T007 [US1] Strengthen color constraint in `src/constants.ts` `SYSTEM_INSTRUCTION`: ensure existing `colors[3]` text-color rule uses "MANDATORY" / "NON-NEGOTIABLE" wording, and explicitly state `Black (#000000) is FORBIDDEN as text color`
- [x] T008 [US1] Add font-family constraint rule in `src/constants.ts` `SYSTEM_INSTRUCTION` (new numbered rule after existing color section): `ALL text elements MUST have style.fontFamily = "${config.fontFamily}". No other font is permitted. style.color and style.fontFamily are REQUIRED fields for every text element.`
- [x] T009 [US1] Update `_slideResponseSchema` in `src/hooks/useAI.ts`: add `required: ['color', 'fontFamily']` to the `style` object inside the `elements` array item schema; also ensure `style` itself is listed in the element's `required` array if not already
- [x] T010 [US1] Apply identical schema `required` update to `remixSlide` inline schema in `src/hooks/useAI.ts` (same `style` object structure)

### Tests for User Story 1

- [x] T011 [P] [US1] Write/update unit test in `tests/unit/useAI.test.ts`: mock `fetch` to intercept POST `/api/ai/generate-content`, assert `config.responseSchema` contains `style.required` array with `'color'` and `'fontFamily'` (SC-002)
- [x] T012 [P] [US1] Write/update unit test in `tests/unit/constants.test.ts` (create if not exists): call `SYSTEM_INSTRUCTION(mockConfig)` and assert returned string `toContain('EXACTLY')` for title/subtitle/body font size rules, and `toContain('FORBIDDEN')` or `toContain('NON-NEGOTIABLE')` for color rule (SC-001)

**Checkpoint**: User Story 1 complete — `npm test` passes SC-001 and SC-002; AI will now be forced to output correct font/color/size

---

## Phase 4: User Story 2 - 元素无重叠布局 (Priority: P2)

**Goal**: AI 生成的幻灯片元素之间无视觉重叠；`SYSTEM_INSTRUCTION` 含坐标分区参考和最小间距约束；AI 响应后自动修正残余重叠

**Independent Test**: 单元测试构造含重叠元素的 `SlideElement[]`，调用 `detectAndFixOverlaps`，断言修正后所有非背景元素边界不相交；另验证 `SYSTEM_INSTRUCTION` 包含坐标分区参考文本，无需调用大模型

### Implementation for User Story 2

- [x] T013 [US2] Add no-overlap layout constraint rule in `src/constants.ts` `SYSTEM_INSTRUCTION` (new numbered rule)
- [x] T014 [US2] Wire `detectAndFixOverlaps` into `generateSlide` post-processing in `src/hooks/useAI.ts`
- [x] T015 [US2] Wire `detectAndFixOverlaps` into `remixSlide` post-processing in `src/hooks/useAI.ts`

### Tests for User Story 2

- [x] T016 [P] [US2] Write/update unit test in `tests/unit/utils.test.ts`: test `detectAndFixOverlaps` with overlapping elements — construct two text elements with overlapping BBox, assert after fix `elements[1].y >= elements[0].y + elements[0].h + 2`; test with non-overlapping elements — assert array returned unchanged (SC-003)
- [x] T017 [P] [US2] Write additional edge-case test in `tests/unit/utils.test.ts`: background image element (`type='image', x:0,y:0,w:100,h:100`) must not be moved or trigger overlap fix; three stacked elements test (chain overlap scenario)

**Checkpoint**: User Story 2 complete — `npm test` passes SC-003; overlap post-processing active in generateSlide and remixSlide

---

## Phase 5: User Story 3 - 预览渲染与数据一致 (Priority: P3)

**Goal**: `SlidePreview` 正确渲染文本颜色（无 #000 fallback 覆盖）、动态注入 Google Fonts link（去重）、overflow 用 ellipsis 而非硬截断

**Independent Test**: `@testing-library/react` render 测试，mock `SlideElement[]` 数据，断言 DOM 中 color 内联样式值、`<head>` 中 Google Fonts link href、text 容器 overflow 样式，无需调用大模型

### Implementation for User Story 3

- [x] T018 [US3] Fix color fallback in `src/components/SlidePreview.tsx`: change `el.style?.color || '#000'` to `el.style?.color ?? undefined`
- [x] T019 [US3] Add Google Fonts dynamic injection `useEffect` in `src/components/SlidePreview.tsx`
- [x] T020 [US3] Add `textOverflow: 'ellipsis'` to text element inline style in `src/components/SlidePreview.tsx`

### Tests for User Story 3

- [x] T021 [P] [US3] Write unit test in `tests/unit/slidePreview.test.tsx`: render `SlidePreview` with a mock slide containing a text element with `style.color='#F8FAFC'`; assert rendered element's inline style `color` equals `#F8FAFC` and is not overridden to `#000000` (SC-004)
- [x] T022 [P] [US3] Write unit test in `tests/unit/slidePreview.test.tsx`: render `SlidePreview` with a mock slide using `fontFamily='Space Grotesk'`; assert `document.head` contains a `<link>` with `href` containing `Space+Grotesk` (SC-005)

**Checkpoint**: User Story 3 complete — `npm test` passes SC-004 and SC-005; preview rendering now matches data

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 类型检查、全量测试、lint 验证，确保 SC-006 通过

- [x] T023 Run `npm run lint` (`tsc --noEmit`) and fix any TypeScript type errors introduced by all changes across `src/utils.ts`, `src/hooks/useAI.ts`, `src/constants.ts`, `src/components/SlidePreview.tsx`
- [x] T024 Run `npm test` (full Vitest suite) and fix any regressions in existing tests unrelated to this feature
- [x] T025 [P] Verify `detectAndFixOverlaps` is exported from `src/utils.ts` and importable from both `useAI.ts` (static import) and test files without circular dependency
- [x] T026 [P] Cross-check `quickstart.md` implementation path against completed code — confirm all 4 steps match actual implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — read files in parallel immediately
- **Foundational (Phase 2)**: Depends on T004 (utils.ts read) — BLOCKS US2 wiring (T014, T015)
- **US1 (Phase 3)**: Depends on T001 (constants read) + T002 (useAI read) — independent of T005
- **US2 (Phase 4)**: Depends on T005 (detectAndFixOverlaps implemented) + T002 (useAI read)
- **US3 (Phase 5)**: Depends on T003 (SlidePreview read) — fully independent of US1 and US2
- **Polish (Phase 6)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 1 reads complete — no dependency on US2 or US3
- **US2 (P2)**: Requires T005 (Foundational) before T014/T015 — otherwise independent
- **US3 (P3)**: Fully independent — can proceed in parallel with US1 and US2 after T003

### Parallel Opportunities

- T001, T002, T003, T004 (Phase 1) — all parallel reads
- T006, T007, T008 (US1 constants changes) — sequential within same file
- T009, T010 (US1 schema changes) — sequential within same file
- T011, T012 (US1 tests) — parallel (different files)
- T013 (US2 constants) — can parallel with T009/T010 (different concerns in same file — caution: same file, coordinate)
- T016, T017 (US2 tests) — parallel (same file, independent test cases)
- T021, T022 (US3 tests) — parallel (same file, independent test cases)
- T018, T019, T020 (US3 SlidePreview) — sequential (same file)
- T023, T024 (Phase 6 validation) — sequential; T025, T026 parallel with each other

---

## Parallel Example: Phase 1 Reads

```bash
# Launch all 4 file reads in parallel:
Task: "Read src/constants.ts"
Task: "Read src/hooks/useAI.ts"
Task: "Read src/components/SlidePreview.tsx"
Task: "Read src/utils.ts"
```

## Parallel Example: US1 + US3 (after Phase 1)

```bash
# US1 and US3 have no shared files at the start:
Task: "T006–T010: Update SYSTEM_INSTRUCTION and _slideResponseSchema in constants.ts + useAI.ts"
Task: "T018–T020: Fix SlidePreview color/font/overflow in SlidePreview.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup reads
2. Complete Phase 3: US1 (constants + schema fix — highest user-visible impact)
3. **STOP and VALIDATE**: Run `npm test` for SC-001 and SC-002
4. Deploy/demo: AI will now respect font/color/size constraints

### Incremental Delivery

1. Phase 1 reads → Phase 3 US1 → Test SC-001/SC-002 → **MVP deployed**
2. Phase 2 Foundational (T005) → Phase 4 US2 → Test SC-003 → No more overlaps
3. Phase 5 US3 → Test SC-004/SC-005 → Preview renders correctly
4. Phase 6 Polish → SC-006 lint + full test suite green

### Notes

- `src/constants.ts` and `src/hooks/useAI.ts` are both modified by US1 AND US2 — coordinate changes carefully to avoid conflicting edits
- `detectAndFixOverlaps` must be a **pure function** with no React imports
- Google Fonts injection must guard against SSR (`typeof document !== 'undefined'`)
- The `#000` fallback removal (T018) is a one-line change with high visual impact — do not skip
- Each user story independently testable without calling real Gemini API
