---
paths:
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/tests/**"
---

# 测试规则

## 结构
- Arrange → Act → Assert
- 测试名描述行为: `should_return_error_when_asset_not_found`
- 每个 service 至少有对应测试文件

## 必须测试
- 业务逻辑 (service 层)
- 边界值 (0, null, 空数组, 超大数)
- 错误路径 (API 失败, 数据库异常)
- 价格计算逻辑 (汇率转换, 百分比)

## Mock
- Mock 外部 API (Binance, Yahoo Finance, 天天基金)
- Mock Telegram 通知
- 不 mock 数据库 — 用内存 SQLite 测试

## 验证循环
改完代码后必须：
1. `cd backend && npm run build` — 编译通过
2. `pm2 restart portfolio-backend` — 服务正常
3. `curl http://localhost:6002/api/health` — 健康检查
