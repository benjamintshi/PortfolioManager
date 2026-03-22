---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
---

# TypeScript 编码风格

> This extends [common/coding-style.md](../common/coding-style.md) with TypeScript specifics.

## 类型安全
- `strict: true` — 无例外
- 禁止 `any` — 用 `unknown` + 类型守卫 / 泛型
- 禁止 `as` 断言 — 除非不可避免（注释原因）
- `satisfies` 校验对象字面量
- `interface` 定义对象形状, `type` 定义联合/交叉
- `readonly` 标记不可变数据

## 模式
- async/await 优先 — 禁止 .then() 链
- `Promise.allSettled()` 用于并行非 fail-fast 场景
- `structuredClone()` 替代 `JSON.parse(JSON.stringify())`
- 用 `node:` 前缀引入 Node.js 内置模块

## 依赖
- lock 文件必须提交
- ESM (`"type": "module"`) 用于新项目
- devDependencies 不进生产 bundle
