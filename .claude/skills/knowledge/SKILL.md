---
name: knowledge
description: >-
  决策日志和知识积累。记录架构决策、技术选型、尝试过的方案及结果。
  Use to record decisions, or when starting a new feature to review past decisions.
---

# Knowledge Agent — 决策日志

## 记录决策

当做出重要决策时，追加到 `specs/decisions.md`:

```markdown
## DEC-{NNN}: {决策标题}
**日期**: YYYY-MM-DD
**状态**: accepted | superseded | deprecated
**上下文**: 面临什么问题？
**方案**:
  - A: [描述] — 优点/缺点
  - B: [描述] — 优点/缺点
**决策**: 选择方案 [X]
**理由**: 为什么选这个
**后果**: 这个决策带来什么影响
**关联**: 相关 feature/task/bug
```

## 查询决策

新功能开发前，搜索 `specs/decisions.md`:
- 有没有类似问题已做过决策？
- 有没有被否决的方案不应再尝试？
- 有没有约束条件需要遵守？

## 学习记录

从错误和修复中提取经验，追加到 `specs/learnings.md`:

```markdown
## LRN-{NNN}: {经验标题}
**日期**: YYYY-MM-DD
**来源**: bug 修复 / code review / 生产事故
**教训**: 什么出了问题，根因是什么
**规则**: 以后应该怎么做
**适用范围**: 全局 / 特定模块
```

## 晋升规则
- 同一教训出现 3 次 → 写进 `.claude/rules/` 成为正式规则
- 关键架构决策 → 写进 DESIGN.md 或 project.md
