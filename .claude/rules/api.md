---
paths:
  - "backend/src/routes/**"
  - "backend/src/services/**"
---

# API Rules

## 路由规范
- RESTful: GET 查询, POST 创建, PUT 更新, DELETE 删除
- 统一前缀 `/api/`
- 错误响应: `{ error: "描述" }` + 正确 HTTP 状态码
- 列表接口支持分页

## 数据库
- SQL 用 `?` 占位符 — 绝不字符串拼接
- better-sqlite3 同步 API — 不需要 await
- 改表结构写 migration — 不手动改 schema
- 查询加 LIMIT，避免无界查询

## 价格服务
- Binance API 通过 localhost:4001 代理
- Yahoo Finance 直连，有限流保护
- 天天基金 API 用于中国基金
- 所有外部 API 调用设超时 + 重试

## 安全
- 不记录 Token/密码到日志
- .env 中的 secrets 不提交 git
- Telegram Bot Token 和 Chat ID 从环境变量读取
