---
description: "Quick system overview: processes, API health, logs"
---

快速系统状态概览，依次检查：

1. **进程状态**：
   ```bash
   pm2 status
   ```

2. **API 健康**：
   ```bash
   curl -s http://localhost:6002/api/health
   ```

3. **资产概览**：
   ```bash
   curl -s http://localhost:6002/api/portfolio/summary | head -c 500
   ```

4. **错误检查**：
   ```bash
   pm2 logs portfolio-backend --lines 20 --nostream 2>&1 | grep -i "error"
   ```

5. **数据库/磁盘**：
   ```bash
   ls -lh backend/data/portfolio.db
   ```

输出简洁的中文状态摘要，异常项标红。
