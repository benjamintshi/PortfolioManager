# API 设计 (通用)

> Language note: 具体框架规则由语言特化规则补充。

## REST 规范
- 资源用名词复数: `/users`, `/orders`
- HTTP 方法: GET=读, POST=创, PUT=全改, PATCH=部分改, DELETE=删
- 状态码: 200/201/204/400/401/403/404/409/422/500
- 列表接口必须分页

## 请求/响应
- 所有输入在边界层校验
- 统一错误格式: `{"error": {"code": "xxx", "message": "xxx"}}`
- 不暴露内部错误、堆栈或数据库结构给客户端
- JSON key 用 camelCase

## 安全
- 非公开端点必须认证
- 限流（rate limiting）
- CORS 显式配置 — 生产环境禁止 `*`
- 请求大小限制
