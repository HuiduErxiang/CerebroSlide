# Quickstart: SlideGen 项目改造开发指南

**Branch**: `001-project-refactor-roadmap` | **Date**: 2026-03-31

---

## 环境准备

```bash
# 克隆项目并安装依赖
npm install

# 复制环境变量模板
cp .env.example .env.local
# 编辑 .env.local，填入你的 Gemini API Key：
# GEMINI_API_KEY=<your-key>

# 启动开发服务器（Express + Vite HMR，端口 3000）
npm run dev
```

访问 http://localhost:3000 查看应用。

---

## 阶段一：前端分层重构（当前工作阶段）

### 开发约定

1. **只搬移代码，不改行为**：重构期间不引入新功能，不修复已知 bug
2. **分步提交**：每个 hook 单独完成、类型检查通过后再进入下一个
3. **接口定义先行**：参考 `specs/001-project-refactor-roadmap/contracts/hooks-api.md`

### 新建 Hook 步骤（以 useProjects 为例）

```bash
# 创建 hooks 目录
mkdir -p src/hooks

# 创建 hook 文件
touch src/hooks/useProjects.ts
```

**文件骨架**：

```typescript
import { useState, useMemo } from 'react';
import { Project, PresetStyle } from '../types';
import { saveToDB, getFromDB } from '../services/dbService';

export function useProjects(userApiKey: string) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  // ... 从 App.tsx 搬移对应状态和函数

  return { projects, setProjects, activeProjectId, /* ... */ };
}
```

4. **更新 App.tsx**：将对应 `useState` 和函数替换为 hook 调用：

```typescript
const {
  projects, setProjects,
  activeProjectId, setActiveProjectId,
  activeProject,
  loadUserData, syncData, createProject, deleteProject, deleteSlide,
} = useProjects(userApiKey);
```

5. **类型检查**：

```bash
npm run lint
```

零错误通过后方可继续下一步。

---

## 阶段二：测试基础设施

### 安装测试依赖（阶段二开始时执行）

```bash
npm install -D vitest @vitest/coverage-v8 \
  @testing-library/react @testing-library/user-event \
  fake-indexeddb supertest @types/supertest \
  jsdom
```

### 添加 vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/utils.ts', 'src/services/**', 'src/hooks/**', 'server.ts'],
    },
  },
});
```

### 添加测试脚本到 package.json

```json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

### 运行测试

```bash
npm test              # 监听模式
npm run test:coverage # 生成覆盖率报告
```

---

## 阶段三：部署就绪改造

### 安全检查（改造完成后执行）

```bash
# 确认构建产物中不含 API Key
npm run build
grep -r "AIza" dist/ && echo "FAIL: Key found" || echo "PASS: No key in dist"
```

### 使用非默认端口启动

```bash
PORT=8080 npm start
```

### 生产启动

```bash
npm run build
npm start
```

---

## 常用命令速查

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（Express + Vite HMR） |
| `npm run build` | 生产构建（输出 dist/） |
| `npm run lint` | TypeScript 类型检查（必须零错误） |
| `npm test` | 运行测试（阶段二后可用） |
| `npm run test:coverage` | 运行测试并生成覆盖率报告 |
| `npm run clean` | 清理 dist/ |
| `npm start` | 生产启动（阶段三后可用） |

---

## 验证改造正确性

### 阶段一验收

```bash
# 1. 类型检查
npm run lint

# 2. 人工回归测试（检查以下功能点）
# - 输入文本生成单张幻灯片
# - 多页模式：输入文本 → 生成大纲 → 逐项生成幻灯片
# - 导出 PPTX（验证坐标系映射正确）
# - 云端同步（修改后刷新页面数据保留）
# - 自定义样式保存/删除
# - 模板图片上传分析
```

### 阶段二验收

```bash
# 全量测试通过
npm test
# 预期：所有用例 PASS，无 FAIL
```

### 阶段三验收

```bash
# 构建产物中无 API Key
npm run build && grep -r "AIza" dist/ || echo "PASS"

# 非默认端口启动
PORT=9000 npm start
# 预期：5 秒内服务在 9000 端口监听

# 限流验证
for i in {1..105}; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/user-data -H "x-api-key: test"; done
# 预期：第 101 条及以后返回 429
```
