---
name: spec-execute
description: >-
  按照 TASKS.md 逐个执行任务。每个 task 完成后自动验证验收标准。
  Use after spec-create to implement the approved spec.
---

# Spec 执行 — 按任务实现

## 前置条件
- `specs/{feature}/PRD.md` 已确认
- `specs/{feature}/DESIGN.md` 已确认
- `specs/{feature}/TASKS.md` 已拆解

## 流程

### 1. 加载上下文
读取:
- PRD.md — 理解需求和验收标准
- DESIGN.md — 理解技术方案
- TASKS.md — 理解任务列表和依赖

### 2. 逐任务执行
按 TASKS.md 的依赖顺序，逐个执行：

```
对每个 Task:

  1. 📋 读取 task 描述和验收条件
  2. 🔍 读取相关代码，理解现有模式
  3. 🛠  实现 (遵循项目规范)
  4. ✅ 验证:
     - 编译通过
     - 相关测试通过
     - 验收条件满足
  5. 📝 更新 TASKS.md 标记完成:
     - [x] Task N: 描述
     - 实际修改文件: [列表]
     - 测试覆盖: [描述]
```

### 3. 任务间检查
每完成一个 task:
- 确认不破坏其他功能 (跑全量测试)
- 确认符合 DESIGN.md 的技术方案
- 如果发现设计偏差，暂停并通知用户

### 4. 全部完成后
```
## 实现完成报告

### 已完成 Tasks
- [x] Task 1: 描述 — 文件: [list]
- [x] Task 2: 描述 — 文件: [list]
...

### 验收标准对照
- AC-1: ✅ 通过 — 测试: test_xxx
- AC-2: ✅ 通过 — 测试: test_yyy
- AC-3: ⚠️ 部分通过 — 原因: [说明]

### 变更摘要
- 新增文件: N 个
- 修改文件: N 个
- 新增测试: N 个
- 测试通过: 全部 / [失败数]

### 未解决问题
- [如有]
```

## 关键原则
- **一次一个 task** — 不要一口气全做
- **每个 task 验证后才进入下一个** — 不累积债务
- **偏差暂停** — 发现和设计不符时停下来问
- **AC 对照** — 最终必须每个验收标准都有对应的验证
