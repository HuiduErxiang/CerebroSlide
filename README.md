# CerebroSlide

基于 Google Gemini 的 AI 幻灯片生成 Web 应用。输入文本、语音或文档，AI 自动生成专业 16:9 幻灯片，支持导出为 PowerPoint (.pptx)，并通过云端数据库实现跨设备同步。

## 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS 4
- **AI**：Google Gemini（通过后端代理，使用用户自己的 API Key）
- **后端**：Express 4 + SQLite（better-sqlite3）
- **导出**：pptxgenjs
- **构建**：Vite 6

## 本地运行

**前置条件**：Node.js 18+

1. 安装依赖：
   ```bash
   npm install
   ```

2. 复制环境变量文件并配置：
   ```bash
   cp .env.example .env
   ```
   按需修改 `.env` 中的 `ENCRYPTION_SECRET`（生产环境必须修改）

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 打开浏览器访问 `http://localhost:3000`，使用你自己的 Gemini API Key 登录

## 主要功能

- 文本 / 语音 / 文档（PDF、Word）输入，AI 自动生成幻灯片
- 单页生成 & 多页大纲生成两种模式
- 自定义设计模板（颜色、字体、布局）
- 导出为 PowerPoint (.pptx)
- 云端数据同步（跨设备）

## npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器（端口 3000） |
| `npm run build` | 生产构建 |
| `npm run lint` | TypeScript 类型检查 |
| `npm test` | 运行单元测试 |
| `npm run test:e2e` | 运行 E2E 测试 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ENCRYPTION_SECRET` | `slidegen-dev-secret-change-in-prod` | 用户 API Key 加密密钥，**生产必须修改** |
| `PORT` | `3000` | 服务监听端口 |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS 允许来源 |
| `DB_FILE` | `cloud_storage.db` | SQLite 数据库路径 |
