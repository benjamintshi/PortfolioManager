# Portfolio Manager

个人多资产投资组合管理系统。Express + SQLite + React (Arena Design System) + Tailwind。

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
  services/
    PriceService.ts          — 价格获取（WebSocket优先 + REST fallback）
    BinanceWebSocket.ts      — Binance WebSocket 实时价格
    MacroIndicatorService.ts — 宏观指标自动采集
    PortfolioService.ts      — 组合分析
    RebalanceService.ts      — 再平衡计算
    InvestmentPlanService.ts — 投资计划
    ExchangeRateService.ts   — 汇率
    NotificationService.ts   — Telegram 通知

frontend/src/
  pages/            — Dashboard, Assets, Rebalance, Analysis, Roadmap, InvestmentPlans, MacroEvents
  components/       — Layout, Header, PieChart, LineChart, MacroIndicators
  hooks/useApi.ts   — API 封装
  utils/format.ts   — 格式化
```

## 前端设计系统
Arena Design System（深色 glassmorphism 风格）。规范见 `.claude/rules/frontend-arena.md`。
- 顶部 glass 导航（非侧边栏）
- 页面结构：Fragment 根 → Hero section (pt-16) → section (max-w-[1400px])
- 组件：glass card, stat-card, scan-line, text-gradient, font-data
- Skills: `/arena-page`, `/arena-component`, `/arena-migrate`

## 资产分类
crypto, stock, gold, bond, commodity, reit, cash

## 价格来源
- crypto → Binance WebSocket (wss://stream.binance.com) 实时推送，REST API fallback
- stock/bond/commodity/reit → Yahoo Finance（中国基金走天天基金 API）
- gold → Yahoo Finance GC=F → 转 CNY/克

## 宏观指标来源
- Fear & Greed → alternative.me API
- VIX, DXY, US 10Y Yield, USDCNY → Yahoo Finance
- BTC Dominance → CoinGecko API

## 定时任务
- 5min: 更新 crypto 价格（WebSocket 实时，REST 补充）
- 15min: 更新 stock/gold 价格
- 2h: 采集宏观指标（Fear & Greed, VIX, DXY, US 10Y, BTC Dom, USDCNY）
- 每天 00:00: 组合快照
- 每天 08:00: 再平衡偏离提醒
- 每天 21:00: 每日报告

## 环境变量 (backend/.env)
```
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=-5170247327
```

## 开发
- SQL 用 `?` 占位符，不拼接
- 改完后端 → `cd backend && npm run build && pm2 restart portfolio-backend`
- 改完前端 → dev server 自动热更新
- `.env` 里有 secrets，不提交
