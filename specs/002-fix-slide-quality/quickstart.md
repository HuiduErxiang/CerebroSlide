# Quickstart: 幻灯片生成质量修复

**Feature**: 002-fix-slide-quality
**Phase**: 1 — Design
**Date**: 2026-04-07

---

## 开发准备

```bash
# 安装依赖（已完成时跳过）
npm install

# 启动开发服务器
npm run dev

# 运行单元测试（监视模式）
npx vitest --watch

# 类型检查
npm run lint
```

---

## 实现路径（按依赖顺序）

### Step 1: `src/utils.ts` — 新增 `detectAndFixOverlaps`

在文件末尾添加纯函数，无新 import：

```typescript
export function detectAndFixOverlaps(elements: SlideElement[]): SlideElement[] {
  const isBg = (el: SlideElement) =>
    el.type === 'image' && el.x === 0 && el.y === 0 && el.w === 100 && el.h === 100;

  const bgElements = elements.filter(isBg);
  const activeElements = elements.filter(el => !isBg(el));

  const sorted = [...activeElements].sort((a, b) => a.y - b.y);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      const hOverlap = a.x < b.x + b.w && b.x < a.x + a.w;
      const vOverlap = a.y < b.y + b.h && b.y < a.y + a.h;
      if (hOverlap && vOverlap) {
        sorted[j] = { ...sorted[j], y: a.y + a.h + 2 };
      }
    }
  }

  // 还原背景图元素到数组头部
  return [...bgElements, ...sorted];
}
```

### Step 2: `src/constants.ts` — 强化 `SYSTEM_INSTRUCTION`

在 Rule 6（VISUAL HIERARCHY & FONT SIZE）中：
- `Titles: ${config.titleFontSize}pt` → `ALL title elements MUST use EXACTLY ${config.titleFontSize}pt. DO NOT deviate.`
- 颜色规则：在 Rule 4（COLOR ADHERENCE）后追加字体约束规则

新增 Rule（编号续接）：
```
13. STRICT TEXT STYLE ENFORCEMENT:
    - ALL text elements MUST have style.fontFamily = "${fontFamily}". No other font is permitted.
    - ALL text elements MUST have style.color = "${colors[3]}". Black (#000000) is FORBIDDEN as text color.
    - style.color and style.fontFamily are REQUIRED fields for every text element.
14. NO OVERLAP RULE:
    - Adjacent text elements MUST have at least 2% vertical gap between them.
    - Layout coordinate guides:
      * split-left: left text area x:0–48, right area x:52–100
      * split-right: left area x:0–48, right text area x:52–100
      * grid-3: col1 x:0–30, col2 x:35–65, col3 x:70–100
      * top-bottom: header y:0–20, content y:25–90
    - Do NOT place text elements outside their designated area.
```

### Step 3: `src/hooks/useAI.ts` — 更新 `_slideResponseSchema`

在 `style` 对象的 `properties` 后添加 `required`：
```typescript
style: {
  type: Type.OBJECT,
  properties: { /* 不变 */ },
  required: ['color', 'fontFamily'],
},
```

在 `generateSlide` 的 JSON.parse 后插入：
```typescript
const { detectAndFixOverlaps } = await import('../utils');
let slideElements: SlideElement[] = detectAndFixOverlaps(result.elements || []);
```

（`remixSlide` 同理）

### Step 4: `src/components/SlidePreview.tsx` — 修复渲染

1. **color fallback**：`color: el.style?.color || '#000'` → `color: el.style?.color`
2. **useEffect 字体注入**：
```typescript
useEffect(() => {
  const families = slide.elements
    .map(el => el.style?.fontFamily)
    .filter((f): f is string => !!f)
    .map(f => f.split(',')[0].trim().replace(/['"]/g, ''));
  const unique = [...new Set(families)];
  unique.forEach(family => {
    const id = `gf-${family.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
      document.head.appendChild(link);
    }
  });
}, [slide]);
```
3. **overflow**：text 元素 style 新增 `textOverflow: 'ellipsis'`

---

## 测试运行

```bash
# 运行单元测试（覆盖本次所有修复）
npm test

# 仅运行受影响的测试文件
npx vitest run tests/unit/utils.test.ts tests/unit/useAI.test.ts tests/unit/slidePreview.test.tsx

# 类型检查（必须零错误）
npm run lint
```
