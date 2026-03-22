---
name: dev-workflow
description: 开发工作流：研究优先、实现、验证循环。Use when starting any feature, bug fix, or refactor.
---

# 开发工作流

## 1. 研究优先 (Search-First)
写代码前先搜索：
- 需求是否已有现成库/工具？→ 查 npm
- 项目内是否已有实现？→ grep 搜索
- 有无参考实现？→ 先查再写

决策：
- 完全匹配且维护良好 → 直接采用
- 部分匹配 → 采用+薄封装
- 无合适方案 → 调研后自定义

## 2. 实现顺序
1. **接口/类型**: 先定义接口与类型
2. **测试**: 先写失败用例 (RED)
3. **实现**: 最小实现让测试通过 (GREEN)
4. **重构**: 去除重复、保持清晰 (REFACTOR)

## 3. 验证循环
完成实现后必须依次执行：

```bash
# 1. 后端编译
cd backend && npm run build

# 2. 重启服务
pm2 restart portfolio-backend

# 3. 健康检查
curl -s http://localhost:6002/api/health

# 4. 检查日志无报错
pm2 logs portfolio-backend --lines 10 --nostream 2>&1 | grep -i "error"
```

**全部通过后才能 git commit。**

## 4. 安全检查
- [ ] 无硬编码密钥/Token/密码
- [ ] SQL 使用 `?` 占位符
- [ ] 错误处理完整（无空 catch）
- [ ] 新路由有输入校验

## 5. 完成 Checklist
- [ ] 编译通过
- [ ] 服务启动正常
- [ ] 健康检查 OK
- [ ] 日志无新增 error
- [ ] 无硬编码密钥
- [ ] 必要时更新文档
