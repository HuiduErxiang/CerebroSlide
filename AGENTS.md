# SlideGen AI — 项目规格

## 概述

基于 Google Gemini 的 AI 幻灯片生成 Web 应用。用户输入文本、语音或文档，AI 生成专业 16:9 幻灯片，支持导出为 PowerPoint (.pptx) 或预览，并通过 Express 后端 + SQLite 实现跨设备云端数据同步。

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript 5.8 |
| 构建工具 | Vite 6 + tsx（开发服务器） |
| 样式 | Tailwind CSS 4（@tailwindcss/vite 插件） |
| 动画 | Motion（Framer Motion v12） |
| AI | `@google/genai` SDK（后端 server.ts 使用，前端不直接调用）|
| 导出 | pptxgenjs v4（PPTX 生成） |
| 文档解析 | mammoth v1（Word .docx）、pdfjs-dist v5（PDF） |
| Markdown | react-markdown v10 |
| 工具 | clsx + tailwind-merge、lucide-react |
| 后端 | Express 4 + better-sqlite3 v12 |
| 本地存储 | IndexedDB（浏览器端，通过 dbService.ts 封装） |
| 运行时 | Node.js + tsx（ESM） |

## 目录结构

```
harness-slide-creator/
├── src/
│   ├── App.tsx              # 主应用（auth/UI 状态 + JSX 骨架，~1619 行）
│   ├── main.tsx             # React 入口，挂载 <App /> 到 #root
│   ├── index.css            # 全局样式（Tailwind 基础导入）
│   ├── types.ts             # 全局 TypeScript 类型定义
│   ├── constants.ts         # 常量、Prompt 模板、预设配置
│   ├── utils.ts             # 纯工具函数（cn、withRetry、图片处理）
│   ├── hooks/
│   │   ├── useProjects.ts   # 用户数据加载、云端同步、项目 CRUD
│   │   ├── useDesign.ts     # 设计状态管理、模板分析、自定义样式
│   │   └── useAI.ts         # AI 生成（大纲/幻灯片）、精炼、录音
│   ├── services/
│   │   ├── dbService.ts     # IndexedDB 本地存储封装
│   │   └── pptxService.ts   # PowerPoint 导出服务
│   └── components/
│       ├── SlidePreview.tsx  # 幻灯片 HTML 预览组件
│       └── WireframeIcon.tsx # 布局线框缩略图组件
├── server.ts                # Express 服务器（API + Vite 中间件）
├── tests/                   # Vitest 单元/集成测试
├── e2e/                     # Playwright E2E 测试
├── specs/                   # 需求规格文档
├── index.html               # Vite HTML 入口
├── vite.config.ts           # Vite 配置
├── playwright.config.ts     # Playwright 配置
├── vitest.config.ts         # Vitest 配置
├── package.json             # 依赖与 npm 脚本
├── .env.example             # 环境变量示例
├── AGENTS.md                # 本文件：项目级规格
├── PITFALLS.md              # 踩坑记录（必读）
└── CHANGELOG.md             # 版本变更历史
```

## 架构概览

```
Browser (React SPA)
  ├─ App.tsx（auth/UI 状态 + JSX 骨架）
  │     ├─ useProjects(userApiKey, customStylesRef)
  │     │     └─ GET/POST /api/user-data（x-session-token 头）
  │     ├─ useDesign(userApiKey, syncData)
  │     │     └─ POST /api/ai/generate-content（模板分析）
  │     └─ useAI(userApiKey, ...)
  │           └─ POST /api/ai/generate-content（幻灯片/大纲生成）
  │
  └─ Express Server（server.ts，端口由 PORT 环境变量控制，默认 3000）
        ├─ GET  /api/session      →  加密存储用户 API Key，签发 session token
        ├─ GET  /api/user-data   →  SQLite（cloud_storage.db）
        ├─ POST /api/user-data   →  SQLite（cloud_storage.db）
        ├─ POST /api/ai/generate-content  →  解密用户 Key → 用 @google/genai SDK 调用 Gemini
        └─ 开发：Vite middlewareMode（HMR）
           生产：express.static("dist/") + SPA fallback
```

## 数据流

```
用户输入（文本 / 语音 Blob / 上传文档 / 图片）
    ↓
[单页模式] generateSlide(item) ─────→ POST /api/ai/generate-content → Gemini → Slide
[多页模式] generateOutline()  ─────→ POST /api/ai/generate-content → Gemini → OutlineItem[]
                                              ↓（逐项）
                                     generateSlide(item) → Slide
    ↓
SlidePreview（HTML 16:9 预览）
    ↓
导出分支：
  ├─ exportToPptx()        → pptxgenjs → .pptx 文件下载
  └─ Draw.io XML 导出（App.tsx 内联逻辑）
    ↓
syncData(projects, customStyles)
  ├─ POST /api/user-data   → SQLite（云端）
  └─ saveToDB("slidegen_v2_${apiKey}_projects", ...)  → IndexedDB（本地）
```

## 关键设计决策

### 用户身份与 API Key 管理（自带 Key 模式）
- 用户使用自己的 Gemini API Key 登录，Key 在服务端以 **AES-256-CBC 加密**后存入 SQLite `api_key_enc` 字段
- 身份标识使用 `SHA-256(apiKey)` 哈希，Key 原文不以明文形式长期存储
- 登录后签发 session token（有效期 24 小时），后续请求携带 `x-session-token` 头
- AI 代理调用时，服务端通过 session token 查出并解密用户的 Key，用用户自己的额度调用 Gemini
- **服务端无需配置 `GEMINI_API_KEY` 环境变量**，本地开发只需配置 `ENCRYPTION_SECRET`

### Session 管理
- `getSessionToken(apiKey)` 是唯一的 session 获取入口，内置内存缓存（模块级变量）
- 任何需要认证的操作必须通过此函数，**不得直接调用 `/api/session` 端点**
- 登出时必须调用 `_resetSessionCache()` 清除缓存

### 后端代理 AI 调用
- 前端所有 Gemini 调用均通过 `POST /api/ai/generate-content` 后端代理
- 前端构建产物中不包含任何 API Key
- server.ts 使用 **`@google/genai` SDK** 调用 Gemini，SDK 自动处理所有请求格式细节（`contents` 规范化、`systemInstruction` 包装、`inlineData` 字段名等）
- 前端通过统一的 `config` 字段传递所有 AI 参数，server.ts 将其映射到 SDK 的 `GenerateContentRequest` 对应字段：
  - `config.systemInstruction` → SDK `systemInstruction`（顶层）
  - `config.responseMimeType`、`config.responseSchema`、`config.temperature`、`config.maxOutputTokens`、`config.thinkingConfig`、`config.responseModalities`、`config.imageConfig` → SDK `generationConfig`
- server.ts 响应格式：`{ candidates: Candidate[] }`，前端从 `candidates[0].content.parts` 提取 text 或 inlineData
- **不得在 server.ts 中使用 `result.text` SDK getter**，该 getter 对多模态响应（文本+图片）不可靠，必须从 `candidates` 显式提取
- **`generationConfig` 必须使用 SDK 强类型（`GenerateContentConfig`），不得用 `Record<string, unknown>`**，否则 SDK 运行时静默忽略 `responseMimeType`、`responseSchema` 等字段，导致 AI 不受约束自由输出

### 两阶段 AI 生成
- **第一阶段**（`generateOutline`）：Gemini 自由文本输出 → 正则解析 `[SLIDE]...[END_SLIDE]` 块 → `OutlineItem[]`
- **第二阶段**（`generateSlide`）：强制 `responseMimeType: "application/json"` + `responseSchema` → `JSON.parse` → `Slide`
- 凡依赖固定字段名解析 AI JSON 响应的调用，**必须同时携带 `responseSchema`**
- `generateSlide` 返回的 JSON 包含 `imagePrompts` 字段（可选），当 AI 认为需要背景图时填充；代码在检测到 `imagePrompts.length > 0` 后调用 `_generateImages()` 生成图片
- **`SYSTEM_INSTRUCTION` 中必须同时满足两个条件才能触发图片生成**：① elements 数组里含 `type="image"` 全屏元素；② `imagePrompts` 数组非空。两者必须配套出现，否则图片生成流程不会被触发

### 坐标系约定（贯穿全系统）
- 所有元素坐标 `x / y / w / h` 均为 **0–100 百分比**
- 前端：映射为 CSS `position: absolute` + `left/top/width/height: n%`
- PPTX 导出：映射为 pptxgenjs 的 `"n%"` 字符串格式
- 字体大小：前端预览时 `pt × 1.333 = px`（近似 96dpi 换算）

## npm 脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| `dev` | `tsx server.ts` | 启动开发服务器（Express + Vite HMR，端口 3000） |
| `start` | `NODE_ENV=production tsx server.ts` | 生产模式启动 |
| `build` | `vite build` | 生产构建，输出到 `dist/` |
| `preview` | `vite preview` | 预览构建产物 |
| `lint` | `tsc --noEmit` | TypeScript 类型检查 |
| `test` | `vitest` | 运行单元/集成测试（48 个） |
| `test:e2e` | `playwright test` | 运行 E2E 测试（25 个） |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ENCRYPTION_SECRET` | `slidegen-dev-secret-change-in-prod` | 用户 API Key 的 AES 加密密钥，**生产必须修改** |
| `PORT` | `3000` | 服务监听端口 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 允许来源，逗号分隔 |
| `RATE_LIMIT_WINDOW_MS` | `900000` | 限流窗口（ms），默认 15 分钟 |
| `RATE_LIMIT_MAX` | `100` | 窗口内最大请求数 |
| `DB_FILE` | `cloud_storage.db` | SQLite 数据库路径（`:memory:` 用于测试） |
| `NODE_ENV` | — | `production` 时切换静态文件服务模式 |
| `DISABLE_HMR` | — | `"true"` 时禁用 Vite HMR（AI Studio 专用） |

## server.ts 规格

### API 接口

**GET /api/session**
- 请求头：`x-api-key: <用户 Gemini API Key>`
- 行为：加密存储 Key，签发 session token（有效期 24h）
- 响应：`{ sessionToken, expiresAt }`
- 401：缺少 `x-api-key`

**GET /api/user-data**
- 请求头：`x-session-token` 或 `x-api-key`（降级）
- 响应：`{ projects: Project[], customStyles: PresetStyle[] }`

**POST /api/user-data**
- 请求头：`x-session-token` 或 `x-api-key`，`Content-Type: application/json`
- 请求体：`{ projects: Project[], customStyles: PresetStyle[] }`（body limit: 50MB）
- 响应：`{ success: true }`

**POST /api/ai/generate-content**
- 请求头：`x-session-token` 或 `x-api-key`
- 请求体：`{ model?, contents, config? }`
- 行为：解密用户 Key → 初始化 `@google/genai` SDK → 调用 `generateContent`
- `config` 字段映射：`systemInstruction`（顶层）、其余字段合并入 `generationConfig`
- 响应：`{ candidates: Candidate[], finishReason: string | null }`（`finishReason` 透传自 `candidates[0].finishReason`，可用于感知 `SAFETY`/`terminated` 等失败原因）

### 数据库（cloud_storage.db）

```sql
CREATE TABLE IF NOT EXISTS user_data (
  user_hash     TEXT PRIMARY KEY,  -- SHA-256(apiKey) hex
  projects      TEXT,              -- JSON 序列化的 Project[]
  custom_styles TEXT,              -- JSON 序列化的 PresetStyle[]
  updated_at    INTEGER,           -- Unix 毫秒时间戳
  session_token TEXT,              -- 当前有效的 session token
  api_key_enc   TEXT               -- AES-256-CBC 加密的用户 API Key
)
```

## Agent 工作约定

- **修改代码后必须运行**：`npm run lint` 确保无类型错误
- **修改某个模块前，先读取该目录的 AGENTS.md** 了解接口约定和依赖关系
- **若需要了解项目过往迭代内容，参考CHANGELOG.md中的内容
- **不得在未更新 AGENTS.md 的情况下改变模块的对外接口**
- **坐标系一致性**：所有 SlideElement 的 x/y/w/h 均为 0–100 百分比，不得使用像素值
- **AI 调用必须用 `withRetry()` 包装**
- **数据同步必须双写**：修改 projects 或 customStyles 后，调用 `syncData()` 同时写云端和 IndexedDB
- **凡依赖固定字段名解析 AI JSON 的调用，`responseMimeType` 和 `responseSchema` 必须成对出现**
- **session token 的获取必须通过 `getSessionToken()` 函数**，不得直接调用 `/api/session` 端点
- **参考 PITFALLS.md** 了解已知踩坑，避免重复犯同类错误

### Task 进度追踪

- **每完成一个 task，必须立即将 `specs/<feature>/tasks.md` 中对应条目的 `- [ ]` 改为 `- [x]`**，不得在 phase 结束后批量更新
- 执行顺序：完成代码改动 → 标记 todoWrite 为 completed → 更新 `specs/<feature>/tasks.md` checkbox → 再开始下一个 task
- Phase 结束时，确认该 phase 内所有 task 均已标记 `[x]` 后，再向用户汇报总结
- **版本变更必须记录到 `CHANGELOG.md`**：每个 feature/spec 完成后，将核心改动归纳为一个版本条目追加到 `CHANGELOG.md`
