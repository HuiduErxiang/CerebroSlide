# UI Contracts: 项目级设计记忆、预设风格编辑与精炼强制中文输出

**Phase 1 Output** | Branch: `004-project-style-memory` | Date: 2026-04-08

## 1. 项目切换时自动恢复场景/风格

### 触发条件
`activeProjectId` 变化（包括首次加载）

### 行为契约

```
WHEN activeProjectId 变化
  IF activeProject.scenarioId 存在
    THEN setSelectedScenarioId(activeProject.scenarioId)
    ELSE setSelectedScenarioId('general')  // 系统默认

  IF activeProject.stylePresetId 存在
    AND allStyles 中存在对应 ID
    THEN applyPreset(found_style)
    // ELSE 静默忽略，保持 design state 不变
```

### 不触发 syncData
恢复操作本身不产生写入，仅是读取 → 更新 UI state。

---

## 2. 场景/风格变更写回 Project（debounce 500ms）

### 场景变更

| 事件 | 调用链 |
|------|-------|
| 用户点击场景按钮 | `setSelectedScenarioId(id)` → 更新 `activeProject.scenarioId` → debounce 500ms → `syncData(updatedProjects)` |

### 风格应用

| 事件 | 调用链 |
|------|-------|
| 用户点击风格预设（`applyPreset`） | `applyPreset(style)` → 更新 `activeProject.stylePresetId = style.id` → debounce 500ms → `syncData(updatedProjects)` |

### 约束
- debounce timer 每次变更时重置，快速连续切换只触发最后一次 syncData
- debounce ref 需在组件 unmount 时 clearTimeout（cleanup）

---

## 3. 预设风格编辑 UI

### 风格卡片新增编辑按钮

**位置**: 在风格预设列表每个卡片的右上角操作区，与删除按钮并排  
**显示规则**:
- 内置风格（`isBuiltIn: true` 或来自 `PRESET_STYLES`）：显示编辑按钮，**不**显示删除按钮
- 自定义风格（`isCustom: true`）：显示编辑按钮 + 删除按钮
- 编辑按钮只在 `group-hover` 时显现（与现有删除按钮行为一致）

**点击编辑按钮**:
1. `e.stopPropagation()`（阻止触发 `applyPreset`）
2. 调用 `startEditStyle(style)`
3. 设置 `isSavingStyle = true`（打开新建/编辑弹窗）

### 弹窗（复用现有新建风格弹窗）

**编辑模式标识**: `editingStyleId !== null`

| 字段 | 编辑模式行为 |
|------|------------|
| 弹窗标题 | "编辑风格" 替换 "保存当前风格" |
| 风格名称输入框 | 预填被编辑风格的 `name` |
| 保存按钮 | 调用 `upsertCustomStyle(newStyleName)` |
| 取消按钮 | 调用 `cancelEditStyle()` 并设 `isSavingStyle = false` |

### 保存（upsertCustomStyle）流程

```
IF editingStyleId === null  // 新建模式
  创建新 PresetStyle（id = 'custom_' + Date.now(), isCustom: true）
  追加到 customStyles
ELSE IF 被编辑风格 isBuiltIn === true  // 内置风格 → clone
  创建新 PresetStyle（id = 'custom_' + Date.now(), isCustom: true, isBuiltIn: false）
  追加到 customStyles
ELSE  // 自定义风格 → 直接更新
  customStyles.map(s => s.id === editingStyleId ? {...s, ...newValues} : s)

syncData(undefined, updated)
setEditingStyleId(null)
setIsSavingStyle(false)
```

### 取消（cancelEditStyle）流程

```
setEditingStyleId(null)
setIsSavingStyle(false)
// 不恢复 design state（用户的临时修改丢弃即可，因为 design state 未持久化）
```

---

## 4. 精炼 AI Prompt 中文约束

### 变更范围
`src/hooks/useAI.ts` → `refineOutlineItem` 函数内的 `contents` 字符串

### 约束位置
在 prompt 中 `pageStyle` 字段的生成说明处追加约束文字：

```
IMPORTANT: The "pageStyle" field MUST be written entirely in Chinese (Mandarin).
Keep proper nouns (人名、品牌名、药品名等) in their original form.
All other fields (realBody, decorativeIcon, keyData, quotes, highlights) keep the language the same as the input.
```

### 不变部分
- `responseSchema` 结构不变
- `responseMimeType: 'application/json'` 不变
- 其他 config 参数不变
- `withRetry()` 包装保持

---

## 5. 接口兼容性保证

### UseDesignReturn 接口变更（`src/types.ts`）

新增字段：
```typescript
editingStyleId: string | null;
startEditStyle: (style: PresetStyle) => void;
cancelEditStyle: () => void;
```

`saveCustomStyle` 保留，内部委托 `upsertCustomStyle(newStyleName)`，对外签名不变。

### UseProjectsReturn 接口
无变更。

### UseAIReturn 接口
无变更（`setSelectedScenarioId` 已在接口中，外部 App.tsx 通过 `useEffect` 调用）。
