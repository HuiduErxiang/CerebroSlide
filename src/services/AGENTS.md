# src/services — 业务服务层规格

## 模块概览

| 文件 | 职责 |
|------|------|
| `dbService.ts` | 浏览器端 IndexedDB 本地存储（键值对读写）|
| `pptxService.ts` | 将 `Project` 数据导出为 `.pptx` 文件 |

---

## dbService.ts

### 职责
封装浏览器 IndexedDB API，提供简单的键值对读写接口，作为云端数据的本地缓存层。

### 数据库配置

| 项目 | 值 |
|------|-----|
| 数据库名 | `SlideGenDB` |
| Object Store | `projects` |
| 版本 | `1` |

### 接口

```typescript
initDB(): Promise<IDBDatabase>
// 打开或初始化数据库，自动创建 object store

saveToDB(key: string, data: any): Promise<void>
// 写入键值对（put，覆盖已有值）

getFromDB(key: string): Promise<any>
// 读取键值对，key 不存在时返回 undefined
```

### 使用约定（来自 App.tsx）

键名格式：`slidegen_v2_${apiKey}_projects`

所有调用均在 `syncData()` 内以 `.catch()` 静默处理失败，不中断主流程。

---

## pptxService.ts

### 职责
将 `Project`（含 `Slide[]`）转换为 PowerPoint 文件并触发浏览器下载。

### 依赖
- `pptxgenjs`：PPTX 生成库
- `../types`：`Project` 类型

### 接口

```typescript
exportToPptx(
  project: Project,
  backgroundColor?: string,
  cornerRadius?: number   // 默认 12
): Promise<void>
```

触发浏览器下载，文件名为 `${project.name}.pptx`（特殊字符替换为 `-`）。

### 幻灯片排序逻辑

1. 若 `project.outline` 存在且非空：按 outline 顺序，通过 `item.slideId` 找到对应 slide 导出（确保顺序一致、只导出最新版本）
2. 若无 outline 或未找到任何 slide：将 `project.slides` 反转后导出（因 App.tsx 中新 slide 是 prepend 的）

### 元素映射规则

| SlideElement.type | PPTX 操作 | 备注 |
|---|---|---|
| `text` | `slide.addText()` | 支持 fill、cornerRadius、shadow、fontFamily、bold、italic、align、valign |
| `shape` | `slide.addShape()` | 支持 RECTANGLE / CIRCLE / TRIANGLE / LINE，RECTANGLE 时按 cornerRadius 决定是否用 roundRect |
| `image` | `slide.addImage()` | 从 `slide.images[el.imageIndex]` 取 base64，自动修复格式 |

### 内部工具函数

```typescript
formatColor(color: string | undefined): string
// 将 CSS 颜色（hex / rgb / rgba）转为 6 位大写 hex（无 #），无效值返回 "000000"

safeNumber(num: any, fallback?: number): number
// 安全转 float，NaN/Infinity 返回 fallback（默认 0）
```

### 坐标系约定
所有 `x / y / w / h` 均为 `0–100` 百分比，传入 pptxgenjs 时转为 `"${n}%"` 字符串。
