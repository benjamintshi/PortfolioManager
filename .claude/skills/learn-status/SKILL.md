---
name: learn-status
description: >-
  查看学习系统状态：观察记录数、已提取 instincts、晋升候选。
  Use to check what the learning system has captured.
---

# 学习状态

## 执行步骤

### 1. 观察数据统计
```bash
# 总记录数
wc -l .claude/learning/observations.jsonl 2>/dev/null || echo "0 observations"

# 最近 24h 记录数
if [ -f .claude/learning/observations.jsonl ]; then
  yesterday=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d "yesterday" +%Y-%m-%d)
  grep -c "$yesterday\|$(date -u +%Y-%m-%d)" .claude/learning/observations.jsonl 2>/dev/null || echo "0"
fi

# 文件大小
ls -lh .claude/learning/observations.jsonl 2>/dev/null
```

### 2. 工具使用分布
```bash
# 按工具类型统计
if [ -f .claude/learning/observations.jsonl ]; then
  cat .claude/learning/observations.jsonl | grep -o '"tool":"[^"]*"' | sort | uniq -c | sort -rn
fi
```

### 3. 已有 Instincts
```bash
ls .claude/learning/instincts/*.yaml 2>/dev/null | wc -l
```

列出每个 instinct 的 id + confidence + domain。

### 4. 输出状态卡

```markdown
## 📊 Learning Status

| 指标 | 值 |
|------|---|
| 总观察记录 | {N} |
| 最近 24h | {N} |
| 数据文件大小 | {size} |
| 已提取 instincts | {N} |
| 高置信度 (≥0.8) | {N} |
| 晋升候选 | {N} |

### Top 工具
1. Edit: {N} 次
2. Bash: {N} 次
3. Read: {N} 次

### Top Instincts (by confidence)
1. {id} — {confidence} — {trigger}
2. ...

### 建议
- {如果记录多但 instinct 少: "运行 /learn 提取模式"}
- {如果高置信 instinct 多: "考虑晋升到 rules"}
- {如果记录 < 20: "继续使用，积累更多数据"}
```
