# Contracts: Server API

**Module**: `server.ts`  
**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-03-31

---

## GET /api/user-data

**用途**: 加载指定用户的云端项目数据和自定义样式。

### 请求

```
GET /api/user-data
Headers:
  x-api-key: <Gemini API Key>
```

### 响应

**200 OK**

```json
{
  "projects": Project[],
  "customStyles": PresetStyle[]
}
```

**401 Unauthorized**（缺少 x-api-key）

```json
{
  "error": "API Key required"
}
```

### 行为

1. 从 `x-api-key` 请求头提取 API Key
2. 计算 `SHA-256(apiKey)` 得到 `user_hash`
3. 查询 SQLite `user_data` 表
4. 若记录存在，返回解析后的 JSON；若不存在，返回空数组

### 约束

- API Key 原文不得落库、不得出现在响应体
- 查询基于 `user_hash`（SHA-256 hex）

---

## POST /api/user-data

**用途**: 保存/覆盖指定用户的云端数据（双写同步的云端写入侧）。

### 请求

```
POST /api/user-data
Headers:
  x-api-key: <Gemini API Key>
  Content-Type: application/json
Body-Limit: 50MB

Body:
{
  "projects": Project[],
  "customStyles": PresetStyle[]
}
```

### 响应

**200 OK**

```json
{
  "success": true
}
```

**401 Unauthorized**

```json
{
  "error": "API Key required"
}
```

### 行为

1. 验证 `x-api-key` 请求头
2. 计算 `SHA-256(apiKey)` 得到 `user_hash`
3. `INSERT OR REPLACE INTO user_data` 更新对应行
4. 写入 `projects`（JSON stringify）、`custom_styles`（JSON stringify）、`updated_at`（Unix ms）

### 约束

- 请求体限制 50MB（容纳 base64 图片的幻灯片数据）
- 覆盖写，不做 merge（客户端负责数据完整性）

---

## 阶段三新增端点（待实现）

### POST /api/ai/generate-content

**用途**: 后端代理 Gemini SDK 调用，前端不直接持有 API Key。

```
POST /api/ai/generate-content
Headers:
  x-session-token: <session token>  （优先）
  x-api-key: <Gemini API Key>       （降级）
  Content-Type: application/json

Body:
{
  "model": string,           // 可选，默认 "gemini-3.1-flash-lite-preview"
  "contents": unknown,       // 字符串 / { parts: [...] } / Content[]，SDK 自动规范化
  "config": {                // 可选，所有 AI 参数统一入口
    "systemInstruction"?: string | object,
    "responseMimeType"?: string,
    "responseSchema"?: object,       // 必须使用 SDK Type 枚举值（如 "OBJECT"、"STRING"）
    "temperature"?: number,
    "maxOutputTokens"?: number,
    "thinkingConfig"?: { thinkingLevel: string },
    "responseModalities"?: string[],
    "imageConfig"?: { aspectRatio: string }
  }
}
```

**行为**:
1. 通过 `x-session-token` 查出加密 Key → 解密 → 实例化 `new GoogleGenAI({ apiKey })`
2. 从 `config` 提取 `systemInstruction`（顶层），其余字段组装为 SDK 强类型 `GenerateContentConfig` 对象
3. 调用 `ai.models.generateContent({ model, contents, systemInstruction?, generationConfig? })`
4. **`generationConfig` 必须使用 SDK 的强类型，不得使用 `Record<string, unknown>`**，否则 SDK 运行时静默忽略

**响应 200 OK**:
```json
{
  "candidates": Candidate[]
}
```

前端从 `candidates[0].content.parts` 显式提取：
- 文本：`parts.find(p => p.text).text`
- 图片：`parts.find(p => p.inlineData).inlineData`，使用 `inlineData.mimeType` 不得硬编码

**响应 401**: 缺少有效认证头  
**响应 500**: SDK 调用异常，返回 `{ error: string }`

### GET /api/session

**用途**: 用 API Key 换取 session token（一次性操作）。

```
GET /api/session
Headers:
  x-api-key: <Gemini API Key>
```

**响应**:

```json
{
  "sessionToken": string,
  "expiresAt": number
}
```

---

## 中间件栈（阶段三扩展）

| 中间件 | 当前状态 | 阶段三目标 |
|--------|----------|-----------|
| `express.json({ limit: '50mb' })` | 已存在 | 保持不变 |
| CORS（`cors` 包） | 未配置 | `ALLOWED_ORIGINS` 环境变量控制 |
| 限流（`express-rate-limit`） | 未配置 | `/api/*` 每 15 分钟 100 请求（可配置） |
| 静态文件（`express.static`） | 生产模式已存在 | 保持不变 |
| Vite HMR（`vite.middlewares`） | 开发模式已存在 | 保持不变 |

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS user_data (
  user_hash     TEXT PRIMARY KEY,
  projects      TEXT,
  custom_styles TEXT,
  updated_at    INTEGER,
  session_token TEXT                -- 阶段三新增（可为 NULL）
);
```

---

## 环境变量

| 变量 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `PORT` | number | 3000 | 服务监听端口（阶段三实现） |
| `DB_FILE` | string | `cloud_storage.db` | 数据库文件路径（`:memory:` 用于测试） |
| `GEMINI_API_KEY` | string | — | 服务端持有的 AI Key（阶段三迁移） |
| `ALLOWED_ORIGINS` | string | `http://localhost:3000` | CORS 允许来源，逗号分隔（阶段三实现） |
| `RATE_LIMIT_WINDOW_MS` | number | 900000 | 限流窗口（ms），默认 15 分钟（阶段三实现） |
| `RATE_LIMIT_MAX` | number | 100 | 窗口内最大请求数（阶段三实现） |
| `NODE_ENV` | string | — | `production` 时切换静态文件服务模式 |
| `DISABLE_HMR` | string | — | `"true"` 时禁用 Vite HMR（AI Studio 专用） |
