# CHANGELOG

> 记录每个已完成 feature/spec 的核心变更。格式：`## [版本] — 标题 (日期)`，倒序排列（最新在上）。
> 详细任务列表见对应 `specs/<branch>/tasks.md`。

---

## [0.3.0] — 幻灯片渲染与生成质量深度打磨 (2026-04-07)

**Branch**: `002-fix-slide-quality`（延续迭代）

### 问题背景
v0.2.0 修复字体/颜色后，仍存在以下问题：
1. 文字 Y 轴严重偏移（全部堆至底部）
2. `detectAndFixOverlaps` 将 shape 背景容器误当内容元素，把所有同列文字推出画面
3. 精炼正文输出大段描述，不适合 PPT 展示
4. 预览文字被截断（无自适应缩放）
5. 文生图偶发 `terminated` 错误但前端无法感知具体原因
6. 所有幻灯片缺乏视觉装饰点缀（序号徽章、色块、装饰线）

---

### 变更内容

#### `src/components/SlidePreview.tsx` — 渲染深度重构
- 新增 `AutoFitText` 子组件：用 `useLayoutEffect` 循环检测 `scrollHeight > clientHeight`，逐步缩小 fontSize（步长 0.5px，最小 6px），彻底解决文字截断
- 所有元素统一加 `boxSizing: 'border-box'`，padding 不再撑大容器高度，修复 Y 轴偏移
- padding 从 `2%` 收紧为 `1.5%`，减少布局占用

#### `src/utils.ts` — `detectAndFixOverlaps` 完全重写
- **按元素类型分层**：只有 `text` 元素参与推移检测；`image` 和 `shape` 原样保留，不参与任何推移计算（修复 shape 背景容器错误推移文字的根本原因）
- **X+Y 双轴判断**：必须 X 轴区间和 Y 轴区间同时重叠才触发推移，左右两栏文字不再互相干扰
- 越界保护：推移后 `y + h > 100` 时压缩 h（最小 5），防止元素溢出画面

#### `src/constants.ts` — SYSTEM_INSTRUCTION 新增 Rule 15 + Rule 16
- **Rule 15（标题坐标锁定）**：普通布局标题 y 锁定 3–10，副标题紧跟其下；`center-hero` 标题垂直居中 28–42；正文内容统一从 y≥28 开始，保证跨页标题位置一致
- **Rule 16（视觉装饰点缀，新增 `scenarioId` 参数）**：按「场景基调 × 布局类型」二维映射装饰规则
  - `academic`：仅细线（w≤1%，opacity≤0.4），禁用 emoji
  - `business`：高对比方形色块，无 emoji
  - `creative`：多彩色块、大号 emoji、不规则线条，全量装饰
  - `ted`：至多 1 个装饰（粗横线或大号 icon）
  - 各布局对应：序号徽章（feature-list）、格顶横线（grid）、标题下划线+段落竖线（split）、引号装饰（quote）等

#### `src/hooks/useAI.ts` — 精炼与生成优化
- `refineOutlineItem` prompt 重构：废弃硬编码"4条bullet"，改为按布局类型和场景自主选择格式（金句/bullet/分段小标题/编号列表）；总字数上限 80 字
- 多段布局新增分段规则：按格数分段，段内可选 `**加粗小标题**`，段间空行分隔
- `generateSlide` prompt 新增 `CRITICAL` 约束：body 文案必须原文照搬（USE VERBATIM），禁止改写扩写
- `_buildSystemInstruction` 和 `remixSlide` 均传入 `selectedScenarioId`，让 Rule 16 感知当前内容场景

#### `server.ts` — 图片生成错误透传
- `/api/ai/generate-content` 响应新增 `finishReason` 字段（透传 `candidates[0].finishReason`），前端可感知 `SAFETY` / `terminated` 等具体失败原因

---

### 验收结果
- `npm run lint`：0 errors

---

## [0.2.0] — 幻灯片生成质量修复 (2026-04-07)

**Branch**: `002-fix-slide-quality` | **Spec**: `specs/002-fix-slide-quality/`

### 问题背景
AI 生成的幻灯片存在三类质量问题：文本字号/字体/颜色不遵守预设约束、元素布局重叠、网页预览渲染与数据不一致。

### 变更内容

**`src/constants.ts` — SYSTEM_INSTRUCTION 提示词强化**
- Rule 6 字号约束升级为强制语气：`ALL title/subtitle/body elements MUST use EXACTLY Npt. DO NOT deviate.`
- Rule 4 颜色约束追加：`Black (#000000) is FORBIDDEN as text color. NON-NEGOTIABLE.`
- 新增 Rule 13（字体强制）：`style.fontFamily` 和 `style.color` 为每个 text 元素的 REQUIRED 字段
- 新增 Rule 14（无重叠）：4 种布局坐标分区参考（split-left/right、grid-3、top-bottom）+ 相邻元素最小 2% 垂直间距

**`src/hooks/useAI.ts` — Schema 强化 + 重叠后处理**
- `_slideResponseSchema` 的 `style` 对象新增 `required: ['color', 'fontFamily']`，强制 AI 为每个元素输出这两个字段
- `remixSlide` 内联 schema 同步更新
- `generateSlide` 和 `remixSlide` 的 JSON.parse 后均接入 `detectAndFixOverlaps` 后处理

**`src/utils.ts` — 新增 `detectAndFixOverlaps`**
- 纯函数，排除背景图元素（`type=image, x/y/w/h=0/0/100/100`）
- 非背景元素按 y 升序排列，逐对检测 BBox（水平+垂直）相交，将下方元素 y 后移至 `upper.y + upper.h + 2`
- 不 mutate 输入数组，返回新数组

**`src/components/SlidePreview.tsx` — 渲染修复**
- 移除 `color` 的 `|| '#000'` fallback，改为直接透传 `el.style?.color`
- 新增 `useEffect`：提取 slide 中所有 fontFamily → 动态注入 Google Fonts `<link>`（按 id 去重）
- 文本元素新增 `textOverflow: 'ellipsis'`

### 新增测试
- `tests/unit/constants.test.ts`（新建，6 个）：验证 SYSTEM_INSTRUCTION 约束措辞
- `tests/unit/slidePreview.test.tsx`（新建，4 个）：验证颜色渲染和字体注入
- `tests/unit/utils.test.ts`（+6 个）：`detectAndFixOverlaps` 覆盖有重叠/无重叠/背景图/不变性/链式场景
- `tests/unit/useAI.test.ts`（+1 个）：断言 schema required 字段

### 验收结果
- `npm run lint`：0 errors
- `npm test`：65/65 passed（8 test files）

---

## [0.1.0] — 项目全面重构（前端分层 + 测试基础设施 + 部署就绪）(2026-03-31)

**Branch**: `001-project-refactor-roadmap` | **Spec**: `specs/001-project-refactor-roadmap/`

### 问题背景
App.tsx 约 2900 行，所有业务逻辑耦合在单文件中，无测试覆盖，API Key 直接暴露在前端构建产物，无法生产部署。

### 变更内容

**阶段零：E2E 测试基线**
- 引入 Playwright，配置 `playwright.config.ts`
- 新建 `e2e/fixtures/mock-api.ts` 统一 mock `/api/user-data` 和 Gemini 响应
- 覆盖 6 个核心场景：auth、single-slide、outline-mode、pptx-export、design-panel、data-sync（共 25 个 E2E 测试）

**阶段一：前端分层重构**
- 从 App.tsx 拆分出三个 hook：`useProjects`（数据同步/CRUD）、`useDesign`（设计状态）、`useAI`（AI 生成/精炼）
- `src/types.ts` 新增 `DesignConfig`、`UseProjectsReturn`、`UseDesignReturn`、`UseAIReturn` 四个接口
- App.tsx 瘦身为纯 JSX 骨架 + auth/UI 状态，行数大幅缩减
- 新建 `src/AGENTS.md`，定义 hooks 边界、接口契约、AI 调用约定

**阶段二：测试基础设施**
- 引入 Vitest + happy-dom + fake-indexeddb
- 为 `utils.ts`、`dbService.ts`、`pptxService.ts`、`useProjects`、`useAI`、`server.ts` 建立单元/集成测试（共 48 个）

**阶段三：部署就绪**
- Gemini API Key 改为后端代理：前端所有 AI 调用通过 `POST /api/ai/generate-content`，服务端 AES-256-CBC 加密存储用户 Key
- Session token 机制：`GET /api/session` 签发 24h token，后续请求携带 `x-session-token` 头
- `vite.config.ts` 移除 `GEMINI_API_KEY` 注入
- `server.ts` 支持 `PORT` 环境变量、CORS（`ALLOWED_ORIGINS`）、限流（`express-rate-limit`）
- 新增 `start` 生产启动脚本，补充 `DEPLOYMENT.md`（Nginx、PM2、HTTPS 指南）

### 验收结果
- `npm run lint`：0 errors
- `npm test`：48/48 passed
- `npm run test:e2e`：25/25 passed
- `npm run build`：成功，产物中无 API Key
