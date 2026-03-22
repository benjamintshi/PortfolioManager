---
name: learn
description: >-
  从 observations.jsonl 分析使用模式，提取 instincts（原子习惯）。
  Use to review what patterns have been observed and extract reusable knowledge.
---

# 学习 — 从观察中提取模式

## 数据源
读取 `.claude/learning/observations.jsonl`，每行是一条工具调用记录：
```json
{"ts":"...","project":"abc123","tool":"Edit","file":"src/App.tsx","action":"edit"}
```

## 分析流程

### 1. 读取观察数据
```bash
cat .claude/learning/observations.jsonl | wc -l  # 总记录数
```

如果记录 < 20 条，告诉用户"数据太少，继续使用积累更多观察"。

### 2. 找 Pattern (5 类)

**用户纠正**: 同一文件短时间内多次编辑 → 可能是纠正
```
观察: Edit App.tsx (写了 class) → 30秒后 Edit App.tsx (改成 function)
推断: 用户偏好函数式风格
```

**重复工作流**: 固定的工具调用序列反复出现
```
观察: Edit *.ts → Bash(tsc) → Bash(pm2 restart) 出现 8 次
推断: 编辑后总是跑 typecheck + 重启
```

**常见错误**: hasError=true 的记录 + 后续修复
```
观察: Bash(npm run build) exitCode=1 → Edit (修某个文件) → Bash(npm run build) exitCode=0
推断: 这类构建错误的修复方式
```

**文件偏好**: 哪些文件/目录被频繁操作
```
观察: 80% 的 Edit 在 src/services/ 目录
推断: 业务逻辑集中在 services
```

**工具偏好**: 哪些工具组合频繁使用
```
观察: Grep → Read → Edit 序列出现 15 次
推断: 总是先搜索再阅读再修改
```

### 3. 产出 Instincts

在 `.claude/learning/instincts/` 创建 YAML 文件：

```yaml
# .claude/learning/instincts/prefer-functional.yaml
---
id: prefer-functional
trigger: "写新组件/函数时"
action: "用函数式风格，不用 class"
confidence: 0.7
domain: code-style
scope: project
evidence:
  - "观察到 5 次函数式偏好 (Edit 记录)"
  - "2 次将 class 改为 function"
created: 2026-03-22
updated: 2026-03-22
---
```

### 4. 输出报告

```markdown
## 学习报告

### 数据量
- 总观察: {N} 条
- 时间跨度: {first_ts} ~ {last_ts}

### 发现的 Instincts

| ID | 触发条件 | 行为 | 置信度 | 证据数 |
|----|---------|------|--------|-------|
| prefer-functional | 写新函数 | 函数式 > class | 0.7 | 5 |
| grep-before-edit | 修改代码前 | 先 Grep 搜索 | 0.8 | 12 |

### 建议
- 置信度 ≥ 0.8 的 instinct 建议写进 .claude/rules/
- 重复工作流建议创建 /command 自动化
```

## 置信度计算

```
初始: 0.3 (首次观察)
每次正向证据: +0.1 (最高 0.9)
每次反向证据: -0.15 (用户纠正)
长期未出现: -0.05/周 (衰减)
```

## 晋升规则

| 置信度 | 动作 |
|--------|------|
| ≥ 0.8 | 建议写入 `.claude/rules/project.md` |
| ≥ 0.9 | 建议写入 `.claude/rules/common/` (全局) |
| 3+ instincts 同 domain | 建议聚类为一个 skill |

## 关键原则
- **观察不判断** — observe.js 只记录，不分析
- **分析不执行** — /learn 只产出建议，不自动改规则
- **人在环中** — 所有晋升需用户确认
