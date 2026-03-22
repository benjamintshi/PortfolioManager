---
paths:
  - "backend/src/**/*.ts"
  - "frontend/src/**/*.ts"
  - "frontend/src/**/*.tsx"
---

# TypeScript Rules

## 类型安全
- 禁止 `any` — 用 `unknown` + 类型守卫
- 禁止 `as` 断言 — 除非不可避免（注释原因）
- 所有函数参数和返回值都有类型注解
- 接口定义业务对象，type 定义联合/交叉类型

## 异步
- async/await 优先，不用 .then() 链
- Promise.allSettled() 用于并行不应 fail-fast 的场景
- 所有 HTTP 请求和数据库操作设超时

## Node.js
- 使用 `node:` 前缀引入内置模块
- 处理进程信号: SIGINT, SIGTERM 优雅退出
- EventEmitter 必须清理 listener，防内存泄漏

## Express 路由
- 每个路由文件只处理一个资源
- 路由只做参数解析和响应，逻辑放 service
- 统一错误响应: `{ error: string, details?: any }`
- 所有路由包裹 try/catch

## 前端 React
- 函数组件 + Hooks
- 自定义 Hook 放 `hooks/` 目录
- 复杂状态用 useReducer
- 避免 useEffect 链 — 用派生状态代替
