---
description: "开发功能或修 bug"
---

$ARGUMENTS

1. 读代码，理解涉及的文件
2. 改代码，`tsc --noEmit` 确认无报错
3. `pm2 restart portfolio-backend` → `curl http://localhost:6002/api/health`
4. 确认无问题后 `git add` + `git commit`
