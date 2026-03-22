---
name: status
description: 系统状态快速概览。检查进程、API健康、资产概览、错误日志。
---

# 系统状态检查

依次执行以下检查，输出简洁的中文状态摘要：

1. **进程状态**:
```bash
pm2 status
```

2. **API 健康**:
```bash
curl -s http://localhost:6002/api/health
```

3. **资产概览**:
```bash
curl -s http://localhost:6002/api/portfolio/summary | head -c 500
```

4. **错误检查**:
```bash
pm2 logs portfolio-backend --lines 20 --nostream 2>&1 | grep -i "error"
```

5. **数据库/磁盘**:
```bash
ls -lh backend/data/portfolio.db
```

异常项标 ❌，正常标 ✅。
