---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "**/tests/**/*.ts"
  - "**/__tests__/**"
---

# TypeScript 测试

> This extends [common/testing.md](../common/testing.md) with TypeScript specifics.

## 框架
- vitest 或 jest
- `describe/it` 结构 + 描述性名称

## Mock
- Mock 外部服务 — 不调用真实 API
- 使用 `jest.mock()` / `vi.mock()`
- 测试间重置: `beforeEach(() => { vi.clearAllMocks() })`

## 覆盖率
- 业务逻辑 ≥ 80%
- 工具函数 100%

## 类型
- 测试数据使用类型安全的 factory 函数
- 不用 `as any` 绕过类型检查
