# 项目待办 / 改造路线图

> **维护约定**
> - `[ ]` 待做 / `[~]` 进行中 / `[x]` 已完成 / ~~`[ ]`~~ 已废弃
> - 完成一项立即标 `[x]`，不要批量更新
> - 新任务追加到对应阶段末尾，不插入已完成条目之间
> - 单条任务 = 单次对话可完成的粒度；执行前若发现过大，先拆细再开始
> - 阶段全部完成后在标题后加 `✓`，内容保留不删除

---

## 当前阶段：准备期 ✓

- [x] 生成项目级及模块级 CLAUDE.md 规格文档
- [x] 梳理改造路线图并归档

---

## 阶段一：前端分层重构
> 前置条件：无  
> 验证方式：`tsc --noEmit` + 人工功能回归  
> 原则：只搬移代码，不改行为  
> 详细任务见 `src/TODO.md`

- [ ] 写分层重构 spec，更新 `src/CLAUDE.md`（定义 hooks 边界和接口契约）
- [ ] 拆分 `useProjects.ts`：`loadUserData`、`syncData`、项目 CRUD
- [ ] 拆分 `useAI.ts`：`generateOutline`、`generateSlide`
- [ ] 拆分 `useDesign.ts`：设计相关状态
- [ ] `App.tsx` 瘦身为纯 JSX 骨架
- [ ] `tsc --noEmit` 通过，人工回归所有功能点

---

## 阶段二：测试基础设施
> 前置条件：阶段一完成  
> 详细任务见 `src/TODO.md`

- [ ] 引入 Vitest，配置测试环境（含 jsdom、fake-indexeddb）
- [ ] `services/dbService.ts` 单元测试
- [ ] `services/pptxService.ts` 单元测试
- [ ] `hooks/useProjects.ts` 单元测试（mock `dbService`）
- [ ] `hooks/useAI.ts` 单元测试（mock `@google/genai`）
- [ ] `server.ts` 集成测试（Supertest + SQLite 内存模式）

---

## 阶段三：功能改造（部署就绪）
> 前置条件：阶段二完成  
> 详细任务见 `server/TODO.md`

- [ ] Gemini API Key 改为后端代理，前端不再持有 Key
- [ ] `vite.config.ts` 移除 `GEMINI_API_KEY` 注入
- [ ] `server.ts` 支持 `PORT` 环境变量
- [ ] 添加 `start` 生产启动脚本到 `package.json`
- [ ] 添加 CORS 配置
- [ ] 添加限流保护
- [ ] 补充部署文档（Nginx、PM2、HTTPS）
