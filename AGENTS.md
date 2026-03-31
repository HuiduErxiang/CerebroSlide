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
| AI | `@google/genai`（Gemini Flash / Pro） |
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
│   ├── App.tsx              # 主应用（全局状态 + 核心业务逻辑 + 完整 UI，~2900 行）
│   ├── main.tsx             # React 入口，挂载 <App /> 到 #root
│   ├── index.css            # 全局样式（Tailwind 基础导入）
│   ├── types.ts             # 全局 TypeScript 类型定义
│   ├── constants.ts         # 常量、Prompt 模板、预设配置
│   ├── utils.ts             # 纯工具函数（cn、withRetry、图片处理）
│   ├── services/
│   │   ├── dbService.ts     # IndexedDB 本地存储封装
│   │   └── pptxService.ts   # PowerPoint 导出服务
│   └── components/
│       ├── SlidePreview.tsx  # 幻灯片 HTML 预览组件
│       └── WireframeIcon.tsx # 布局线框缩略图组件
├── server.ts                # Express 服务器（API + Vite 中间件）
├── index.html               # Vite HTML 入口
├── vite.config.ts           # Vite 配置（含 GEMINI_API_KEY 注入）
├── tsconfig.json            # TypeScript 配置
├── package.json             # 依赖与 npm 脚本
├── metadata.json            # AI Studio 应用元数据
├── .env.example             # 环境变量示例
├── CLAUDE.md                # 本文件：项目级规格
└── TODO.md                  # 改造路线图
```

## 架构概览

```
Browser (React SPA)
  ├─ App.tsx（单体状态机 ~2900 行）
  │     ├─ 直连 Gemini API（用户自持 API Key，前端调用）
  │     ├─ IndexedDB（本地缓存，通过 dbService.ts）
  │     └─ fetch /api/user-data（云端同步，需 x-api-key 请求头）
  │
  └─ Express Server（server.ts，端口 3000 硬编码）
        ├─ GET  /api/user-data  →  SQLite（cloud_storage.db）
        ├─ POST /api/user-data  →  SQLite（cloud_storage.db）
        └─ 开发：Vite middlewareMode（HMR）
           生产：express.static("dist/") + SPA fallback
```

## 数据流

```
用户输入（文本 / 语音 Blob / 上传文档 / 图片）
    ↓
[单页模式] generateSlide(item) ─────→ Gemini（JSON Schema 模式）→ Slide
[多页模式] generateOutline()  ─────→ Gemini（自由文本）→ OutlineItem[]
                                              ↓（逐项）
                                     generateSlide(item)→ Slide
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

### 用户身份与数据隔离
- 用户使用自己的 Gemini API Key 作为身份凭证（无独立账号系统）
- 服务端以 `SHA-256(apiKey)` 作为用户唯一标识，API Key 本身不落库
- 云端数据（SQLite）+ 本地缓存（IndexedDB）双层持久化
- 启动时优先加载云端；云端为空则自动迁移本地 IndexedDB 数据至云端

### 两阶段 AI 生成
- **第一阶段**（`generateOutline`）：调用 `SCRIPT_SYSTEM_INSTRUCTION(scenario)` → Gemini 自由文本输出 → 手工正则解析 `[SLIDE]...[END_SLIDE]` 块 → `OutlineItem[]`
- **第二阶段**（`generateSlide`）：调用 `SYSTEM_INSTRUCTION(style, ...)` → Gemini 强制 `responseMimeType: "application/json"` + `responseSchema` 模式 → `JSON.parse` → `Slide`
- 图片生成为可选第三步：调用 Gemini Imagen，生成后以 base64 存入 `slide.images[]`

### API Key 前端直调（已知安全问题）
- 当前 Gemini API Key 由前端持有并直接调用
- `vite.config.ts` 将 `GEMINI_API_KEY` 从 `.env` 注入构建产物（`process.env.GEMINI_API_KEY`）
- **公网部署前必须改为后端代理模式**（详见阶段三）

### 场景驱动的 Prompt 系统
- 5 种场景预设（`SCENARIOS`）：通用、学术、商务、创意、TED
- 每种场景对应不同的 `tone` 和 `logic` 注入 Prompt，影响大纲生成风格
- 13 种布局预设（`LAYOUT_PRESETS`），AI 自动选择最合适的布局

### 坐标系约定（贯穿全系统）
- 所有元素坐标 `x / y / w / h` 均为 **0–100 百分比**
- 前端：映射为 CSS `position: absolute` + `left/top/width/height: n%`
- PPTX 导出：映射为 pptxgenjs 的 `"n%"` 字符串格式
- 字体大小：前端预览时 `pt × 1.333 = px`（近似 96dpi 换算）

## npm 脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| `dev` | `tsx server.ts` | 启动开发服务器（Express + Vite HMR，端口 3000） |
| `build` | `vite build` | 生产构建，输出到 `dist/` |
| `preview` | `vite preview` | 预览构建产物 |
| `clean` | `rm -rf dist` | 清理构建产物 |
| `lint` | `tsc --noEmit` | TypeScript 类型检查（无测试框架时此为唯一 CI 检查） |

**没有 `start` 脚本**（生产启动缺失，见已知问题 #2）。

## 环境变量

| 变量 | 来源 | 说明 |
|------|------|------|
| `GEMINI_API_KEY` | `.env.local` | 开发时由 Vite 注入前端构建（待废弃，改为后端持有） |
| `APP_URL` | `.env.local` / AI Studio 注入 | 应用部署 URL，用于自引用链接 |
| `NODE_ENV` | 运行时 | `production` 时 server.ts 切换为静态文件服务模式 |
| `DISABLE_HMR` | 运行时 | AI Studio 专用，设为 `"true"` 时禁用 Vite HMR |
| `PORT` | 未读取 | 当前硬编码为 3000（待支持，见已知问题 #3） |

## server.ts 规格

### API 接口

**GET /api/user-data**
- 请求头：`x-api-key: <Gemini API Key>`
- 响应：`{ projects: Project[], customStyles: PresetStyle[] }`
- 401：缺少 `x-api-key`

**POST /api/user-data**
- 请求头：`x-api-key`、`Content-Type: application/json`
- 请求体：`{ projects: Project[], customStyles: PresetStyle[] }`（body limit: 50MB）
- 响应：`{ success: true }`
- 401：缺少 `x-api-key`

### 数据库（cloud_storage.db）

```sql
CREATE TABLE IF NOT EXISTS user_data (
  user_hash    TEXT PRIMARY KEY,  -- SHA-256(apiKey) hex
  projects     TEXT,              -- JSON 序列化的 Project[]
  custom_styles TEXT,             -- JSON 序列化的 PresetStyle[]
  updated_at   INTEGER            -- Unix 毫秒时间戳
)
```

### 静态文件服务

| 环境 | 行为 |
|------|------|
| `NODE_ENV=production` | 提供 `dist/` 静态文件；非 API 路由返回 `dist/index.html` |
| 开发（默认） | 挂载 Vite middlewareMode，支持 HMR |

## 已知问题（待改造）

| # | 问题 | 优先级 | 参考路线图阶段 |
|---|------|--------|--------------|
| 1 | Gemini API Key 暴露在前端构建产物中 | 高 | 阶段三 |
| 2 | 缺少 `start` 生产启动脚本 | 高 | 阶段三 |
| 3 | `PORT` 硬编码为 3000，不支持环境变量 | 中 | 阶段三 |
| 4 | 无 CORS 配置、无限流保护 | 中 | 阶段三 |
| 5 | `App.tsx` 单文件 ~2900 行，全部状态 + 逻辑 + UI 耦合 | 中 | 阶段一（重构先行） |
| 6 | 无任何测试框架和测试文件 | 中 | 阶段二 |
| 7 | 语音录制后 STT 功能未实现（hardcoded mock） | 低 | 待定 |

## 架构健康度评估

### 测试能力现状
- **无测试框架**：package.json 中无 vitest/jest 等依赖
- **无测试文件**：整个项目中无 `.test.ts` / `.spec.ts` 文件
- **架构性测试障碍**：`App.tsx` 将状态管理、业务逻辑、UI 渲染全部耦合在一个 ~2900 行的单体文件中，无法对核心业务逻辑（AI 调用、数据同步）编写单元测试
- **结论**：需要先完成前端分层重构（阶段一），才能建立有效的测试体系（阶段二）

### 可测试的模块（无需重构即可添加测试）
- `src/services/dbService.ts`：纯 IndexedDB 封装，可用 fake-indexeddb mock
- `src/services/pptxService.ts`：纯数据转换，可 mock pptxgenjs
- `src/utils.ts`：纯函数，无任何副作用，测试最简单
- `server.ts`：Express 路由，可用 Supertest + SQLite 内存模式测试

## 改造路线图

详见 [TODO.md](./TODO.md)，包含三个改造阶段：
1. **阶段一**：前端分层重构（App.tsx 拆分为 hooks + 纯 JSX）
2. **阶段二**：测试基础设施（Vitest + 各层单元/集成测试）
3. **阶段三**：功能改造（部署就绪：API Key 安全、端口配置、CORS、限流）

---

## Agent 工作约定

- **修改代码后必须运行**：`npm run lint`（即 `tsc --noEmit`）确保无类型错误
- **每完成一个 TODO 条目，必须同步更新 TODO.md 中对应条目为 `[x]`**
- **修改某个模块前，先读取该目录的 CLAUDE.md** 了解接口约定和依赖关系
- **不得在未更新 CLAUDE.md 的情况下改变模块的对外接口**（函数签名、Props、API 路由）
- **坐标系一致性**：所有 SlideElement 的 x/y/w/h 均为 0–100 百分比，不得使用像素值
- **AI 调用必须用 `withRetry()` 包装**，不得裸调 `ai.models.generateContent()`
- **数据同步必须双写**：修改 projects 或 customStyles 后，调用 `syncData()` 同时写云端和 IndexedDB
