# Portfolio Manager

个人多资产投资组合管理系统。Express + SQLite + React + Tailwind。

## 启动
```bash
pm2 start ecosystem.config.js    # 启动（后端6002，前端3007）
pm2 restart portfolio-backend     # 重启后端
pm2 logs portfolio-backend        # 看日志
curl http://localhost:6002/api/health  # 健康检查
```

## 结构
```
backend/src/
  index.ts          — 入口 + cron
  database.ts       — SQLite schema
  routes/           — API（assets, prices, portfolio, rebalance, roadmap, plans, events, indicators）
  services/         — 业务逻辑（PriceService, PortfolioService, RebalanceService, InvestmentPlanService）

frontend/src/
  pages/            — Dashboard, Assets, Rebalance, Analysis, Roadmap, InvestmentPlans, MacroEvents
  components/       — Layout, Sidebar, PieChart, LineChart, MacroIndicators
  hooks/useApi.ts   — API 封装
  utils/format.ts   — 格式化
```

## 资产分类
crypto, stock, gold, bond, commodity, reit, cash

## 价格来源
- crypto → Binance API (localhost:4001)
- stock/bond/commodity/reit → Yahoo Finance（中国基金走天天基金 API）
- gold → Yahoo Finance GC=F → 转 CNY/克

## 定时任务
- 5min: 更新 crypto 价格
- 15min: 更新 stock/gold 价格
- 每天 00:00: 组合快照
- 每天 08:00: 再平衡偏离提醒
- 每天 21:00: 每日报告

## 环境变量 (backend/.env)
```
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=-5170247327
BINANCE_API_URL=http://localhost:4001
```

## 开发
- SQL 用 `?` 占位符，不拼接
- 改完后端 → `pm2 restart portfolio-backend`
- `.env` 里有 secrets，不提交
