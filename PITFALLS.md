# 踩坑记录 (PITFALLS)
---

## P009 · `detectAndFixOverlaps` 将 shape 背景容器误当内容元素，导致全部文字被推至底部

**发现时间**：v0.3.0 迭代排查  
**影响功能**：所有幻灯片布局——文字元素全部堆积在画面最底部并重叠

### 现象
生成幻灯片后，所有文字（标题、副标题、正文）全部堆到幻灯片最底部，互相重叠，无法阅读。

### 根本原因
`detectAndFixOverlaps` 早期实现只排除满足 **`type=image && x=0 && y=0 && w=100 && h=100`** 五个条件的全屏背景图，其余所有元素（包括 `type=shape` 的大面积背景容器）全部参与推移计算。

AI 生成的布局中，大 shape（如左半屏色块 `x:0, y:0, w:48, h:100`）排序后位于最前，推移时把所有与它有水平交叉的元素（几乎全部左列文字）推至 `y = 0 + 100 + 2 = 102`，越界后 h 被裁到 5，所有内容堆在画面外底部。

此外，旧逻辑只判断 Y 轴是否重叠，不判断 X 轴，导致左右两栏（X 轴不相交）的文字也互相推移。

```typescript
// ❌ 错误：X 轴无重叠的两栏文字也会互相推移
const hOverlap = a.x < b.x + b.w && b.x < a.x + a.w;  // 此时应该是 skip 的两栏
const vOverlap = ...;
if (hOverlap && vOverlap) sorted[j].y = a.y + a.h + 2;  // 错误推移
```

### 修复
**按元素类型分层**：只有 `type='text'` 的元素参与推移检测；`image` 和 `shape` 原样保留，不参与推移计算。同时要求 **X 轴和 Y 轴同时重叠**才触发推移。

```typescript
// ✅ 正确：只检测 text 元素，X+Y 双轴判断
const textElements = elements.filter(el => el.type === 'text');
const nonTextElements = elements.filter(el => el.type !== 'text');
// ...
const xOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
if (!xOverlap) continue;  // 左右两栏直接跳过
```

### 预防规则
> **重叠检测只应在同类「内容元素」间进行。** shape 和 image 是装饰/背景层，文字天然可以叠在上面，不应参与推移。修改 `detectAndFixOverlaps` 时必须保持「只处理 text-vs-text」的原则，且必须同时检查 X 和 Y 两个轴向。

---

## P006 · 后端代理改用 REST API 后，SDK 自动处理的格式细节全部丢失

**发现时间**：Phase 6 完成后本地测试  
**影响功能**：大纲生成报错、图片生成无结果、设计风格解析无法填入输入框

### 现象
- 点击"生成大纲结构"报错 `Invalid value at 'system_instruction'`
- 图片生成无背景图，无报错
- 设计风格模块解析后无法填入输入框

### 根本原因
原来前端直接用 `@google/genai` SDK，SDK 内部自动处理：
- `systemInstruction` 字符串 → `{ parts: [{ text }] }`
- `imageConfig`、`responseModalities` 放正确位置
- `inlineData`、`mimeType` camelCase ↔ snake_case 转换
- `contents` 多种格式统一规范化
- `.text` getter 从 candidates 提取文本

后端代理改用手动拼 REST API payload 后，这些转换全部需要手动实现，但实现不完整，导致多处格式错误。

### 修复
**正确方案**：server.ts 改用 `@google/genai` SDK 调用 Gemini，SDK 继续承担所有格式转换职责。

### 附加发现（SDK 使用时的注意事项）

**1. 不得使用 `result.text` SDK getter 作为响应**
```typescript
// ❌ 错误：getter 对多模态响应（文本+图片）不可靠
res.json({ candidates: result.candidates, text: result.text });

// ✅ 正确：只返回 candidates，前端从中显式提取
res.json({ candidates: result.candidates });

// 前端提取文本
const text = data.candidates?.[0]?.content?.parts?.find(p => p.text != null)?.text ?? '';
// 前端提取图片
const imgPart = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
```

**2. 图片 inlineData 的 mimeType 不可硬编码**
```typescript
// ❌ 错误：硬编码 PNG，API 实际可能返回 JPEG/WebP
let base64Data = `data:image/png;base64,${part.inlineData.data}`;

// ✅ 正确：使用响应中的实际 mimeType
const mimeType = part.inlineData.mimeType || 'image/png';
let base64Data = `data:${mimeType};base64,${part.inlineData.data}`;
```

**3. `analyzeTemplateImage` 等使用 `responseMimeType` 的调用必须同时携带 `responseSchema`**（见 P001）

### 预防规则
> **后端代理时，Gemini 调用必须使用 `@google/genai` SDK，不得手动拼 REST API payload。** "保护 API Key 安全"通过"后端持有 Key + SDK 调用"实现，不需要绕过 SDK。
>
> SDK 响应的处理也不应依赖 SDK getter（如 `.text`），应从 `candidates` 显式提取，确保文本和多模态数据都能正确获取。

> 记录项目开发过程中遇到的真实 bug 和设计偏差，避免重复犯同类错误。
> 格式：问题描述 → 根本原因 → 修复方案 → 预防规则

---

## P001 · 代码搬移时遗漏 `responseSchema`

**发现时间**：Phase 3（hooks 重构）之后  
**影响功能**：设计风格模块 — 上传风格简述文档后无法填充预设风格输入框

### 现象
上传参考图（`analyzeTemplateImage`）可以正常分析并填充，但上传风格简述文档（`handleStyleGuideUpload`）上传后无任何填充。

### 根本原因
Phase 3 将 `handleStyleGuideUpload` 从 `App.tsx` 搬移到 `useDesign.ts` 时，原始代码中 `config.responseSchema` 字段被遗漏：

```typescript
// 原始 App.tsx（正确）
config: {
  responseMimeType: "application/json",
  responseSchema: {          // ← 强制约束返回字段名
    type: Type.OBJECT,
    properties: {
      styleDescription: { type: Type.STRING },
      styleRequirements: { type: Type.STRING },
      ...
    }
  }
}

// 搬移后 useDesign.ts（错误）
config: {
  responseMimeType: 'application/json',
  // responseSchema 被遗漏，AI 返回任意字段名，解析全部为 undefined
}
```

没有 `responseSchema` 时，AI 虽然返回 JSON，但字段名不受约束，而解析代码硬编码了期望字段名，导致全部命中 `undefined`。

### 预防规则
> **凡是依赖固定字段名解析 AI JSON 响应的调用，必须同时携带 `responseSchema`。** 搬移此类代码时，`responseMimeType` 和 `responseSchema` 必须作为一个整体迁移，不可拆分。

---

## P002 · 架构决策未明确，规格文档产生歧义

**发现时间**：Phase 5（安全改造）完成后本地测试  
**影响功能**：所有 AI 功能（幻灯片生成、风格分析）均不可用

### 现象
本地 `npm run dev` 运行后，所有 AI 调用返回 503："AI service not configured on server"。必须在服务器配置 `GEMINI_API_KEY` 环境变量才能使用，但用户已在登录时输入了自己的 Key。

### 根本原因
`spec.md` Assumptions 中存在模糊表述：

> 用户首次访问时需重新在前端输入 Key（**用于身份标识**），但实际 AI 调用由**后端代理**完成

"用于身份标识"暗示用户 Key 只做身份区分，AI 调用用的是服务端统一的 Key——这是 **SaaS 模式**（运营者付钱）。但实际需求是 **自带 Key 模式**（用户用自己的 Key），规格文档没有明确提出这个决策点让用户确认，AI 按规格忠实实现了"错误"的方案。

### 修复
`/api/session` 时将用户 API Key **AES-256-CBC 加密**后存入数据库 `api_key_enc` 字段；`/api/ai/generate-content` 代理时通过 session token 查出并解密，用用户自己的 Key 调 Gemini。服务端无需配置任何 `GEMINI_API_KEY`。

### 预防规则
> **架构决策清单**：凡涉及以下特征的决策，必须在规格生成后、实现开始前显式确认，不得在 Assumptions 中用模糊措辞"填充"：
> 1. 影响范围跨越前后端边界
> 2. 两种方案都"说得通"（如 SaaS 模式 vs 自带 Key 模式）
> 3. 实现后改动成本高
> 4. 直接影响用户使用方式
>
> 重点审查 spec.md 的 **Assumptions 章节**，每一条都问：「这个假设我真的确认了吗？」

---

## P003 · 登录时双重调用 `/api/session` 导致 token 被覆盖

**发现时间**：Phase 5 完成后本地测试  
**影响功能**：登录后立即报"数据加载失败，请检查网络"

### 现象
输入正确的 API Key 点击登录，显示"数据加载失败，请检查网络"。

### 根本原因
`handleLogin` 和 `loadUserData` 各自独立调用 `/api/session`：

1. `handleLogin` → `fetch('/api/session')` → 生成 token A，写入数据库
2. `handleLoadUserData` → `loadUserData` → `getSessionToken()` → 再次 `fetch('/api/session')` → 生成 token B，**覆盖**数据库中的 token A
3. `getSessionToken` 内存缓存里存的是 token B，但 `handleLogin` 那次调用没有走 `getSessionToken`，缓存未更新
4. 最终 `fetch('/api/user-data', { 'x-session-token': token B })` — 实际上 token B 是正确的，**但**若时序问题导致缓存不一致则 401

实际上问题更直接：`handleLogin` 调 `/api/session` 完全多余，验证 Key 有效性只需通过 `loadUserData` 是否成功来判断。

### 修复
`handleLogin` 直接调 `handleLoadUserData`，由后者内部的 `getSessionToken` 统一管理 session，成功即视为登录成功。

### 预防规则
> **Session token 的生命周期必须由唯一入口管理**（`getSessionToken` 函数）。任何需要 session 的操作都通过此函数获取，不得在函数外部直接调用 `/api/session` 端点。

---

## P004 · `callAI` 未携带认证头导致 401

**发现时间**：Phase 5 完成后本地测试  
**影响功能**：所有 AI 调用（幻灯片生成、风格分析）均 401 失败

### 现象
登录成功后，点击生成幻灯片或上传参考图，控制台报 401 Authentication required。

### 根本原因
Phase 5 将 Gemini 调用改为通过 `/api/ai/generate-content` 后端代理时，在 `useAI.ts` 和 `useDesign.ts` 中各自实现了 `callAI` 函数，只改了请求目标 URL，**忘记携带认证头**：

```typescript
// 错误实现
const response = await fetch('/api/ai/generate-content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }, // ← 缺少 x-session-token
  body: JSON.stringify(body),
});
```

E2E 测试没有发现此问题，因为 Playwright 的 `page.route()` 在浏览器层拦截请求，从未真正到达服务端的认证校验。

### 修复
`callAI` 内部先调 `getSessionToken(userApiKey)` 获取 token，加入请求头；失败时降级为 `x-api-key`。

### 预防规则
> **后端代理端点的认证头不会自动携带**，每个调用方必须显式处理。封装 `callAI` 工具函数时，认证逻辑是其职责的一部分，不是调用方的职责。
>
> E2E mock 覆盖了认证路径，**不能作为认证逻辑正确性的验证手段**，需补充集成测试或手工验证。

---

## P005 · Gemini REST API 的 `contents` 格式与 SDK 格式不兼容

**发现时间**：Phase 5 完成后排查  
**影响功能**：部分 AI 调用（使用字符串或对象格式 contents 的场景）返回 400

### 现象
某些 AI 调用到达服务端后，转发给 Google 返回 400 错误。

### 根本原因
Gemini JS SDK 接受多种 `contents` 格式（字符串、对象 `{parts:[...]}`），内部会自动规范化。但通过 REST API 直接调用时，`contents` **必须**是数组格式：

```typescript
// SDK 写法（hooks 里的原始代码）
contents: "分析这份文档..."               // 字符串
contents: { parts: [{ text: "..." }] }   // 对象

// REST API 要求的格式
contents: [{ role: "user", parts: [{ text: "..." }] }]  // 数组
```

server.ts 原来直接 `payload.contents = contents` 原样转发，导致格式不兼容。

### 修复
server.ts 中添加 `normalizeContents()` 函数，统一将字符串和对象格式转换为 REST API 要求的数组格式。

### 预防规则
> **Gemini SDK 和 REST API 的 `contents` 格式不可互换。** 凡经过后端代理转发的 AI 请求，必须在服务端做格式规范化，不能假设前端传来的格式与 REST API 兼容。

---

## P008 · `imagePrompts` 未在 `SYSTEM_INSTRUCTION` 中声明导致图片生成流程从不触发

**发现时间**：功能验收阶段  
**影响功能**：生成幻灯片时背景图始终缺失

### 现象
生成单页幻灯片后，预览和导出的 PPTX 中没有背景图，但代码中的 `_generateImages()` 函数存在且逻辑正确。

### 根本原因
`generateSlide` 触发图片生成的条件是：

```typescript
if (result.imagePrompts && result.imagePrompts.length > 0) {
  generatedImages = await _generateImages(result.imagePrompts, ...);
}
```

即 AI 必须在 JSON 响应中返回 `imagePrompts` 字段。但 `SYSTEM_INSTRUCTION` 的 TECHNICAL SCHEMA 示例里没有包含 `imagePrompts`，AI 不知道要输出这个字段，所以从不返回，`_generateImages` 永远不被调用。

### 修复
在 `SYSTEM_INSTRUCTION` 中：
1. 规则第 10 条补充：**凡是 elements 中含有背景图元素，必须同时填充 `imagePrompts` 数组**
2. TECHNICAL SCHEMA 示例中补充 `imagePrompts` 字段结构

### 预防规则
> **`SYSTEM_INSTRUCTION` 的 TECHNICAL SCHEMA 必须与 `_slideResponseSchema` 保持同步**。凡在 `responseSchema` 中定义的字段，如果需要 AI 主动输出，必须同时在 TECHNICAL SCHEMA 示例中体现，并在规则中明确何时填充。仅靠 schema 定义字段而不在 prompt 中说明，AI 会选择性忽略。

**发现时间**：SDK 替换后本地测试  
**影响功能**：风格文档分析和参考图分析结果无法填入输入框

### 现象
上传风格文档后 loading 结束，但输入框没有任何填充。Network 请求显示 `responseSchema` 已正确发送，AI 却返回自定义中文字段名（如 `"整体风格"`）而非 schema 约束的英文字段名（`styleDescription`）。

### 根本原因
server.ts 用 `Record<string, unknown>` 构建 `generationConfig` 并传给 SDK：

```typescript
// ❌ 错误：松散类型，SDK 运行时静默忽略
const generationConfig: Record<string, unknown> = {};
generationConfig.responseMimeType = responseMimeType;
generationConfig.responseSchema = responseSchema;

await ai.models.generateContent({
  model,
  contents,
  generationConfig,  // SDK 不识别，直接忽略
});
```

SDK 的 `generateContent` TypeScript 类型检查通过（因为展开操作符兼容），但运行时 SDK 内部对 `generationConfig` 做类型校验，松散对象不满足 `GenerateContentConfig` 接口要求，被静默丢弃。结果 `responseMimeType` 和 `responseSchema` 完全不生效，AI 按默认行为自由输出。

### 修复
使用 SDK 的 `GenerateContentConfig` 强类型：

```typescript
// ✅ 正确：强类型，SDK 正确识别
import { GenerateContentConfig } from '@google/genai';

const generationConfig: GenerateContentConfig = {};
if (responseMimeType) generationConfig.responseMimeType = responseMimeType as string;
if (responseSchema) generationConfig.responseSchema = responseSchema;
// ...
```

### 预防规则
> **server.ts 中传给 SDK 的所有参数必须使用 SDK 导出的强类型**（`GenerateContentConfig`、`Content` 等），不得使用 `Record<string, unknown>` 或 `object` 等松散类型。TypeScript 编译通过不等于运行时正确——SDK 内部对类型有额外的运行时校验。
