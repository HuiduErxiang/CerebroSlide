<!--
SYNC IMPACT REPORT
==================
Version change: (new) → 1.0.0
Modified principles: N/A (initial ratification)
Added sections:
  - Core Principles (5 principles)
  - Technology & Architecture Constraints
  - Development Workflow
  - Governance
Templates reviewed:
  - .specify/templates/plan-template.md   ✅ aligned (Constitution Check gate present)
  - .specify/templates/spec-template.md   ✅ aligned (user stories + acceptance criteria)
  - .specify/templates/tasks-template.md  ✅ aligned (phase-based, story-driven tasks)
  - No commands/*.md files found          ✅ N/A
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): Confirm exact initial adoption date; set to first commit
    date 2026-03-31 (approximated from repo context).
-->

# SlideGen AI Constitution

## Core Principles

### I. Coordinate-System Consistency (NON-NEGOTIABLE)

All `SlideElement` positional attributes (`x`, `y`, `w`, `h`) MUST be expressed as
0–100 floating-point percentages at every layer of the system: AI output, runtime
state, `SlidePreview` CSS rendering (`position: absolute; left/top/width/height: n%`),
and `pptxService` export (`"n%"` string format). Pixel values MUST NOT appear in slide
element data structures. Font sizes are stored in `pt`; the preview layer converts with
`pt × 1.333 ≈ px` (96 dpi approximation) and MUST NOT store the converted px value.

**Rationale**: A single coordinate contract eliminates systematic visual drift between
the browser preview and the exported PPTX file.

### II. Resilient AI Invocation

Every call to `ai.models.generateContent()` MUST be wrapped with `withRetry()` from
`src/utils.ts`. Direct, unwrapped Gemini calls are forbidden in production code paths.
The two-phase generation pipeline (outline → per-slide JSON) MUST remain distinct;
mixing free-text and schema-constrained calls in a single pass is not permitted.

**Rationale**: The Gemini API is a remote dependency subject to transient failures.
`withRetry` provides consistent back-off behaviour across the entire codebase and
prevents ad-hoc retry logic from proliferating.

### III. Dual-Write Data Synchronisation

Any mutation to `projects` or `customStyles` MUST trigger `syncData()`, which writes
to both the Express `/api/user-data` endpoint (SQLite cloud store) and IndexedDB
(local cache) in a single operation. Partial writes—cloud only or local only—are
forbidden except during the one-time migration path (IndexedDB → cloud) executed at
startup when the cloud store is empty.

**Rationale**: Dual-write guarantees data availability across devices and survives
temporary network outages, matching the product promise of cross-device sync.

### IV. API Key Security Boundary

The Gemini API Key MUST be treated as a secret. It MUST NOT be logged, embedded in
build artefacts, or transmitted in response bodies. On the server, the key is received
only via the `x-api-key` request header and immediately hashed (`SHA-256`) to derive
`user_hash`; the raw key is never persisted. Vite's `define` injection of
`GEMINI_API_KEY` into the frontend build is a KNOWN TEMPORARY EXCEPTION documented in
`CHANGELOG.md` [0.1.0] and has been eliminated as of that release.

**Rationale**: Exposed API keys result in quota theft and unexpected billing. The
hash-as-identity pattern protects the user without requiring a separate auth system.

### V. Simplicity & Justified Complexity

New abstractions, dependencies, or architectural layers MUST be justified against a
simpler alternative. Complexity is only acceptable when the simpler path demonstrably
fails to meet a stated requirement. The `Complexity Tracking` table in every
`plan.md` MUST be filled whenever a Constitution Check violation is introduced.

**Rationale**: The codebase already carries significant coupling debt (`App.tsx`
~2900 lines). Every addition that is not actively justified makes the refactoring path
longer and testing harder.

## Technology & Architecture Constraints

- **Runtime**: Node.js with `tsx` (ESM); TypeScript 5.8 strict mode across all files.
- **Frontend**: React 19 SPA compiled by Vite 6; Tailwind CSS 4 for styling.
- **AI client**: `@google/genai` only. No other AI SDK MUST be introduced without
  amending this constitution.
- **Export**: `pptxgenjs` v4 for PPTX; `mammoth` for `.docx` parsing; `pdfjs-dist`
  for PDF parsing. These libraries MUST NOT be replaced with alternatives without a
  constitution amendment.
- **Storage**: SQLite via `better-sqlite3` (server); IndexedDB via `dbService.ts`
  (browser). No additional database engine MUST be added without amendment.
- **Port**: The server reads from the `PORT` environment variable (default `3000`).
- **Body limit**: Express JSON body parser limit is `50 MB` to accommodate
  base64-encoded slide images in sync payloads.

## Development Workflow

- **Lint gate**: `npm run lint` (`tsc --noEmit`) MUST pass with zero errors after
  every code change. No PR or task MUST be marked complete while type errors exist.
- **Task progress sync**: Upon completing any task in a feature, the corresponding
  checkbox in `specs/<feature>/tasks.md` MUST be updated to `[x]` immediately (not
  batched). Completed features MUST be summarised in `CHANGELOG.md`.
- **AGENTS.md / module contracts**: Before modifying a module, read its `AGENTS.md`
  (if present). The module's public interface (function signatures, React Props, API
  routes) MUST NOT change without updating `AGENTS.md` in the same commit.
- **AI execution mode (Mode B — Phase confirmation)**: The AI completes all tasks
  within a Phase in one pass, runs the Phase acceptance commands, and MUST wait for
  explicit user confirmation before proceeding to the next Phase.
- **E2E gate (Stage 1+)**: After the Playwright baseline is established in Phase 1,
  `npm run test:e2e` MUST pass at every hook-level checkpoint and at the end of every
  subsequent Stage. A failing E2E suite MUST block progression to the next Phase.
- **No test framework (current)**: Until Stage 2 of the roadmap is complete, there
  are no Vitest unit tests. Playwright E2E is the primary automated regression guard
  during Stage 1 refactoring.
- **Commit discipline**: Changes MUST NOT be committed unless the user explicitly
  requests it.

## Governance

This constitution supersedes all other project conventions. Amendments follow semantic
versioning:

- **MAJOR** (`X.0.0`): Removal or redefinition of an existing principle; backward-
  incompatible governance change.
- **MINOR** (`X.Y.0`): New principle or section added; material expansion of guidance.
- **PATCH** (`X.Y.Z`): Clarifications, wording improvements, typo fixes.

All `plan.md` documents generated by `/speckit.plan` MUST include a **Constitution
Check** gate (already present in `plan-template.md`) and confirm compliance with
Principles I–V before Phase 0 research begins.

Amendments require: (1) a written rationale, (2) a version bump per the rules above,
(3) propagation review across all `.specify/templates/` files, and (4) an updated
Sync Impact Report prepended to this file.

**Version**: 1.0.0 | **Ratified**: 2026-03-31 | **Last Amended**: 2026-03-31
