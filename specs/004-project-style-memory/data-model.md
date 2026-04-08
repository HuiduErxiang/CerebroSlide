# Data Model: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Phase 1 Output** | Branch: `004-project-style-memory` | Date: 2026-04-08

## 实体变更

### Project（`src/types.ts`）

```typescript
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  scenarioId?: ScenarioId;       // 已有字段，无变更
  stylePresetId?: string;        // 新增：记忆当前激活的预设风格 ID（来自 PresetStyle.id）
  slides: Slide[];
  script?: string;
  sourceText?: string;
  outline?: OutlineItem[];
}
```

**字段说明**:
- `stylePresetId`: 可选。存储用户最后应用的 `PresetStyle.id`。切换到该项目时，系统在 `allStyles` 中查找对应预设并调用 `applyPreset()`；若 ID 不存在（风格已被删除）则静默跳过，不报错。

**验证规则**:
- 值缺失（`undefined`）→ 不恢复风格，保持当前 design state 不变
- 值存在但 ID 在 `allStyles` 中找不到 → 静默忽略（edge case：对应风格已被删除）

**状态转换**:
```
项目激活（setActiveProjectId）
  → useEffect 触发
  → 读 activeProject.scenarioId → setSelectedScenarioId
  → 读 activeProject.stylePresetId → 在 allStyles 中查找 → applyPreset()
```

---

### PresetStyle（`src/types.ts`）

```typescript
export interface PresetStyle {
  id: string;
  name: string;
  style: string;
  requirements: string;
  colors: string[];
  fontFamily?: string;
  isCustom?: boolean;
  isBuiltIn?: boolean;           // 新增：标记内置风格（来自 PRESET_STYLES 常量）
  referenceImage?: string;
  cornerRadius?: number;
  shadowIntensity?: 'none' | 'subtle' | 'medium' | 'high';
  safeMargin?: number;
  showPageNumber?: boolean;
  footerText?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  bodyFontSize?: number;
  imageRequirements?: string;
}
```

**字段说明**:
- `isBuiltIn`: 来自 `PRESET_STYLES` 常量的风格为 `true`；用户自定义风格为 `false` 或缺失（运行时默认 `false`）。
- 旧 `customStyles` 数据中无此字段，运行时推断为 `false`（即自定义），**无需迁移脚本**（FR-010）。

**内置风格编辑规则**:
- 编辑 `isBuiltIn: true` 的风格时，系统 clone 一份新对象：`id = 'custom_' + Date.now()`，`isCustom: true`，`isBuiltIn: false`，其余字段复制自被编辑风格
- 新副本追加到 `customStyles` 数组
- 原 `PRESET_STYLES` 常量不变

**自定义风格编辑规则**:
- 编辑 `isCustom: true` 的风格时，直接在 `customStyles` 数组中 `map` 替换对应 ID 的对象
- 触发 `syncData(undefined, updated)` 双写

---

## Hook 状态变更

### useDesign（`src/hooks/useDesign.ts`）

新增 state：
```typescript
const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
```

新增/改造函数：

| 函数 | 签名 | 说明 |
|------|------|------|
| `startEditStyle` | `(style: PresetStyle) => void` | 将风格属性填入所有 design state；若为内置风格设 `editingStyleId = '__builtin__'`，否则设为 `style.id` |
| `cancelEditStyle` | `() => void` | 清除 `editingStyleId`；关闭弹窗 |
| `upsertCustomStyle` | `(name: string) => void` | 根据 `editingStyleId` 决定新建或更新；内部替代原 `saveCustomStyle` |
| `saveCustomStyle` | （保留）委托给 `upsertCustomStyle(newStyleName)` | 维持 `UseDesignReturn` 接口兼容性 |

`UseDesignReturn` 接口新增导出：
```typescript
editingStyleId: string | null;
startEditStyle: (style: PresetStyle) => void;
cancelEditStyle: () => void;
```

### useAI（`src/hooks/useAI.ts`）

`selectedScenarioId` 初始值：从 `activeProject?.scenarioId ?? 'general'` 读取（需在 `App.tsx` 层通过 `useEffect` 调用 `setSelectedScenarioId`，useAI 内部 state 初始值保持 `'general'` 不变）。

---

## 数据流变更

### 场景/风格变更 → 写回 Project

```
用户点击场景按钮
  → setSelectedScenarioId(id)   [useAI state]
  → setProjects(prev => map(..., p.id === activeProjectId ? {...p, scenarioId: id} : p))
  → debounce 500ms → syncData(updated)

用户点击风格预设
  → applyPreset(style)           [useDesign state]
  → setProjects(prev => map(..., p.id === activeProjectId ? {...p, stylePresetId: style.id} : p))
  → debounce 500ms → syncData(updated)
```

### 精炼 prompt 变更（`useAI.ts:refineOutlineItem`）

**变更前**（prompt 末尾）:
```
Keep the language the same as the input.
```

**变更后**（pageStyle 字段说明中追加）:
```
2. Extract visual, image, and layout cues from the Creative Blueprint and merge them with the Global Style to create a "pageStyle" description.
   IMPORTANT: The "pageStyle" field MUST be written entirely in Chinese (Mandarin). Keep proper nouns (人名、品牌名、药品名等专有名词) in their original form.
...
Keep the language the same as the input for all other fields (realBody, decorativeIcon, keyData, quotes, highlights).
```
