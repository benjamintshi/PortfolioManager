# Portfolio Manager

个人多资产投资组合管理系统，支持 7 大资产类别的实时监控、再平衡建议和宏观分析。

## 核心功能

- **投资组合总览** — 总资产/盈亏/配比饼图/净值曲线，USD/CNY 切换
- **资产管理** — 多笔持仓合并展示，支持 crypto/stock/gold/bond/commodity/reit/cash
- **再平衡建议** — 目标配比设置、偏离度可视化、具体调仓建议（含进度条）
- **投资分析** — 相关性矩阵、风险指标（夏普/波动率/最大回撤）、最优配比
- **投资计划** — 分批建仓管理，止损止盈设置，执行跟踪
- **宏观事件** — 关键经济事件日历，重要性/类型标签
- **宏观指标** — Fear & Greed、VIX、DXY、US 10Y、BTC Dominance 自动采集
- **路线图** — 再平衡计划分阶段管理，进度跟踪
- **Telegram 通知** — 再平衡提醒、每日报告

## 技术栈

| 层 | 技术 |
|---|------|
| 后端 | Express + TypeScript + better-sqlite3 |
| 前端 | React + Vite + Tailwind (Arena Design System) |
| 实时数据 | Binance WebSocket (miniTicker) |
| 价格 | Yahoo Finance, 天天基金 API |
| 宏观指标 | alternative.me, CoinGecko, Yahoo Finance |
| 部署 | PM2 |

## 快速开始

```bash
# 安装依赖
cd backend && npm install
cd ../frontend && npm install

# 启动（PM2）
pm2 start ecosystem.config.js

# 或开发模式
cd backend && npm run dev    # :6002
cd frontend && npm run dev   # :3007
```

访问 http://localhost:3007

## 项目结构

```
backend/src/
  index.ts                          — 入口 + cron 定时任务
  database.ts                       — SQLite schema
  routes/                           — REST API
    assets.ts, prices.ts, portfolio.ts, rebalance.ts,
    roadmap.ts, plans.ts, events.ts, indicators.ts
  services/
    BinanceWebSocket.ts             — Binance WS 实时价格订阅
    PriceService.ts                 — 价格聚合（WS → REST fallback）
    MacroIndicatorService.ts        — 宏观指标自动采集
    PortfolioService.ts             — 组合分析 + 快照
    RebalanceService.ts             — 再平衡计算
    InvestmentPlanService.ts        — 投资计划管理
    ExchangeRateService.ts          — USD/CNY 汇率
    NotificationService.ts          — Telegram 通知

frontend/src/
  components/
    Layout.tsx, Header.tsx          — Arena 顶栏布局
    PieChart.tsx, LineChart.tsx      — Recharts 图表
    MacroIndicators.tsx             — 宏观指标面板
  pages/
    Dashboard.tsx                   — 总览（stat cards + 图表）
    Assets.tsx                      — 资产管理（合并表格 + 明细展开）
    Rebalance.tsx                   — 再平衡（进度条可视化）
    Analysis.tsx                    — 风险分析
    Roadmap.tsx                     — 路线图
    InvestmentPlans.tsx             — 投资计划
    MacroEvents.tsx                 — 宏观事件日历
  hooks/useApi.ts                   — Axios API 封装
  utils/format.ts                   — 数字/日期格式化
  index.css                         — Arena Design System tokens + 组件类
  tailwind.config.js                — Arena token 映射
```

## 设计系统

前端采用 **Arena Design System**（深色 glassmorphism 风格）：

- 深空暗色背景 + 浮动光球 + 网格叠加
- Glass 半透明卡片 + scan-line 扫描线动画
- 渐变文字标题 + 等宽数据字体
- 顶部固定玻璃导航栏

详见 `.claude/rules/frontend-arena.md`。

## 数据源

| 数据 | 来源 | 更新频率 |
|------|------|----------|
| Crypto 价格 | Binance WebSocket | 实时推送 (~1s) |
| Stock/Bond/REIT | Yahoo Finance | 15 分钟 |
| 中国基金 | 天天基金 API | 15 分钟 |
| 黄金 (CNY/克) | Yahoo Finance GC=F + 汇率 | 15 分钟 |
| Fear & Greed | alternative.me | 2 小时 |
| VIX / DXY / US 10Y | Yahoo Finance | 2 小时 |
| BTC Dominance | CoinGecko | 2 小时 |
| USD/CNY 汇率 | Yahoo Finance | 1 小时 |

## 定时任务

| 频率 | 任务 |
|------|------|
| 5 分钟 | 更新 crypto 价格 |
| 15 分钟 | 更新 stock/gold 价格 |
| 2 小时 | 采集宏观指标 |
| 每天 00:00 | 生成组合快照 |
| 每天 08:00 | 再平衡偏离提醒 (Telegram) |
| 每天 21:00 | 每日报告 (Telegram) |

## API 接口

### 资产管理
- `GET/POST /api/assets` — 列表 / 添加
- `PUT/DELETE /api/assets/:id` — 更新 / 删除

### 价格
- `GET /api/prices` — 所有价格
- `GET /api/prices/:symbol` — 单个价格
- `POST /api/prices/update` — 手动刷新

### 组合分析
- `GET /api/portfolio/summary` — 组合概览（含合并持仓）
- `GET /api/portfolio/history` — 净值历史
- `GET /api/portfolio/correlation` — 相关性矩阵
- `GET /api/portfolio/risk` — 风险指标
- `POST /api/portfolio/snapshot` — 手动生成快照

### 再平衡
- `GET/PUT /api/rebalance/config` — 目标配置
- `GET /api/rebalance/suggest` — 调仓建议
- `GET /api/rebalance/optimal` — 最优配比
- `POST /api/rebalance/execute` — 记录执行

### 宏观指标
- `GET /api/indicators` — 最新指标值
- `GET /api/indicators/:name/history` — 指标历史
- `POST /api/indicators` — 手动录入
- `POST /api/indicators/batch` — 批量录入

### 宏观事件
- `GET/POST /api/events` — 列表 / 添加
- `DELETE /api/events/:id` — 删除

### 投资计划
- `GET/POST /api/plans` — 列表 / 创建
- `PUT /api/plans/:id` — 更新
- `PUT /api/plans/:id/tranches/:batch` — 执行分批

### 路线图
- `GET/POST /api/roadmap` — 计划列表 / 添加
- `PUT/DELETE /api/roadmap/:id` — 更新 / 删除

### 其他
- `GET /api/health` — 健康检查
- `GET /api/exchange-rate` — 汇率
- `POST /api/notify/test` — 测试 Telegram

## 环境变量

```bash
# backend/.env
TELEGRAM_BOT_TOKEN=xxx          # Telegram 通知（可选）
TELEGRAM_CHAT_ID=-5170247327    # 消息群组
```

## 开发指南

```bash
# 改完后端
cd backend && npm run build && pm2 restart portfolio-backend

# 前端 dev server 自动热更新
# 新建 Arena 页面用 /arena-page skill
# 新建 Arena 组件用 /arena-component skill
# 迁移旧页面用 /arena-migrate skill
```

## License

MIT
