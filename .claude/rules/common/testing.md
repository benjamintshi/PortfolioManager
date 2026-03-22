# 测试 (通用)

> Language note: 测试框架和具体工具由语言特化规则定义。

## 结构
- Arrange → Act → Assert (AAA)
- 测试名描述行为: `should_return_404_when_user_not_found`
- 每个测试只验证一个行为

## 必须测试
- Happy path + 边界值 + 错误路径
- 边界值: 0, 1, max, 空, null/undefined/None
- 并发场景（如适用）
- 集成测试覆盖关键路径

## 不需要测试
- 私有实现细节 — 通过公共接口测
- 框架/库内部
- 纯 getter/setter

## Mock
- Mock 外部依赖（HTTP、数据库、文件系统、时间）
- 不 mock 被测单元本身
- 测试之间重置 mock，防止泄漏
- 优先用 fake 替代 mock（当行为比调用次数更重要时）

## CI/CD
- 测试必须确定性 — 不允许 flaky test
- 测试必须独立 — 顺序不影响结果
- 失败测试 = 阻断合并，无例外
