# Portfolio Manager 项目特化规则

> 通用规则见 common/ 和 typescript/，本文件只放项目独有的约定。

## 架构
- 后端: Express + better-sqlite3 + TypeScript (port 6002)
- 前端: React + Vite + Tailwind (port 3007)
- 部署: PM2 (ecosystem.config.js)

## Express 路由
- 每个路由文件只处理一个资源 (assets.ts, prices.ts, rebalance.ts...)
- 路由只做参数解析和响应，业务逻辑放 services/
- 统一错误响应: `{ error: string }`

## React 前端
- 函数组件 + Hooks
- 自定义 Hook 放 `hooks/useApi.ts`
- 页面组件放 `pages/`，UI组件放 `components/`

## 数据库
- better-sqlite3 同步 API — 不需要 await
- 表结构修改在 database.ts 的 init 函数中
- 所有 SQL 用 `?` 占位符

## 外部 API
- Binance: 通过 localhost:4001 代理 (binance-data-infra)
- Yahoo Finance: 直连，有限流
- 天天基金: 中国基金净值
- 所有外部调用设超时 + 重试

## 部署验证
改完后端必须:
1. `cd backend && npm run build`
2. `pm2 restart portfolio-backend`
3. `curl -s http://localhost:6002/api/health`

## 环境变量
- `TELEGRAM_BOT_TOKEN` — Telegram 通知
- `TELEGRAM_CHAT_ID` — 群组 ID
- `BINANCE_API_URL` — 价格数据源
