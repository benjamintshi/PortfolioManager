---
name: bug-fix
description: >-
  结构化 bug 修复流程：报告 → 分析 → 修复 → 验证。
  Use when fixing bugs with structured tracking.
---

# Bug 修复流程

## 流程 (4 步)

### Step 1: 报告
创建 bug 记录：

```markdown
# specs/bugs/BUG-{NNN}-{slug}.md

## 状态: open | analyzing | fixing | verifying | closed

## 描述
[什么坏了]

## 复现步骤
1. ...
2. ...
3. 预期: ... 实际: ...

## 环境
- 版本/分支: ...
- 浏览器/OS: ...

## 严重程度: critical | major | minor
```

### Step 2: 分析
- 读取相关代码和日志
- 定位根因（不是症状）
- 记录分析结果到 bug 文件：
  ```markdown
  ## 根因分析
  - 根因: [具体代码位置和逻辑错误]
  - 影响范围: [哪些功能受影响]
  - 关联: [是否和其他 bug 相关]
  ```

### Step 3: 修复
- 实现最小修复
- **先写回归测试**（能复现 bug 的测试）
- 再修复代码让测试通过
- 确认不影响其他功能

### Step 4: 验证
- 回归测试通过
- 全量测试通过
- 更新 bug 文件状态为 `closed`
- 记录修复内容：
  ```markdown
  ## 修复
  - 修改文件: [list]
  - 修复方式: [描述]
  - 回归测试: test_xxx
  - 关闭日期: YYYY-MM-DD
  ```

## 关键原则
- **先复现再修** — 不能复现的 bug 不要盲修
- **先测试再改代码** — 回归测试证明 bug 存在
- **修根因不修症状** — 不要打补丁
- **记录留痕** — bug 文件是未来的参考
