---
name: spec-create
description: >-
  从模糊需求到完整规格说明。自动产出 PRD、验收标准、技术设计、任务拆解。
  Use when starting any new feature, product requirement, or user story.
---

# Spec-Driven Development — 需求到规格

## 触发条件
用户描述一个需求（可以很模糊），本 skill 驱动完整的规格产出流程。

## 流程 (5 步)

### Step 1: 需求澄清
**不要直接开始写代码。** 先向用户提问：

- 这个功能给**谁**用？(用户角色)
- 解决什么**问题**？(痛点)
- **成功**长什么样？(期望结果)
- 有什么**约束**？(时间、技术、兼容性)
- 什么**不做**？(明确边界)

如果用户描述已经很清晰，可以跳过部分问题。

### Step 2: 产出 PRD
在 `specs/` 目录创建规格文件：

```markdown
# specs/{feature-name}/PRD.md

## 概述
一句话描述这个功能。

## 背景
为什么需要这个功能？解决什么问题？

## 用户故事
- 作为 [角色]，我想要 [功能]，以便 [价值]

## 功能需求
1. 需求1: 描述
2. 需求2: 描述

## 验收标准
AC-1: Given [前置条件] When [操作] Then [预期结果]
AC-2: Given ... When ... Then ...

## 非功能需求
- 性能: [如有]
- 安全: [如有]

## 范围外 (Out of Scope)
- 明确不做的事

## 设计参考
- 原型图/线框图链接 [如有]
- 参考竞品 [如有]
```

### Step 3: 技术设计
同目录创建设计文档：

```markdown
# specs/{feature-name}/DESIGN.md

## 架构方案
### 方案 A: [描述]
- 优点: ...
- 缺点: ...

### 方案 B: [描述]
- 优点: ...
- 缺点: ...

### 决策: 选择方案 [X]
- 理由: ...

## 数据模型变更
- 新表/字段: ...
- 迁移策略: ...

## API 设计
- `POST /api/xxx` — 请求/响应 schema

## 前端变更
- 新页面/组件: ...
- 路由: ...

## 影响分析
- 现有功能影响: ...
- 依赖: ...
```

### Step 4: 任务拆解
```markdown
# specs/{feature-name}/TASKS.md

## 任务列表

### Task 1: [后端] 数据库迁移
- 文件: database.ts
- 验收: migration up/down 通过
- 预估: S

### Task 2: [后端] API 端点
- 文件: routes/xxx.ts, services/XxxService.ts
- 验收: API 返回正确数据, 错误处理完整
- 预估: M

### Task 3: [前端] 页面实现
- 文件: pages/Xxx.tsx, components/XxxCard.tsx
- 验收: UI 匹配设计, 交互正常
- 预估: M

### Task 4: [测试] 集成测试
- 验收: 所有 AC 有对应测试, 全部通过
- 预估: S

## 依赖关系
Task 1 → Task 2 → Task 3 → Task 4

## 预估总量
[S/M/L] — [X] 个任务
```

### Step 5: 确认
将 PRD + DESIGN + TASKS 呈现给用户确认：
- "以下是我对需求的理解，请确认或修改"
- 用户确认后，才进入实现阶段

## 输出
```
specs/{feature-name}/
├── PRD.md          # 产品需求文档
├── DESIGN.md       # 技术设计
└── TASKS.md        # 任务拆解
```

## 关键原则
- **先问再做** — 不要假设需求
- **Given/When/Then** — 验收标准必须可测试
- **至少两个方案** — 技术设计必须对比
- **任务独立** — 每个 task 可单独实现和验证
- **用户确认** — 规格确认前不写一行代码
