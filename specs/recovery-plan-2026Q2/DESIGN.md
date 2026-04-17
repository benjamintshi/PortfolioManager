# 技术设计 · 组合恢复计划 2026 Q2

## 架构方案

### 方案 A（选中）：复用现有数据模型
把恢复计划拆成两类数据：
- **Investment Plans**（`investment_plans` 表）— 承载「具体标的 + 分批建仓」型任务
- **Roadmap Items**（`rebalance_roadmap` 表）— 承载「结构性调整」型任务（MNT 决策、合约转出、类别再平衡）

两类都已有前端 UI（Allocation 页面 Plans Tab + Roadmap Tab）。

- **优点**：零前端改动，零后端改动；触发条件、进度追踪、距离指示器全部复用
- **缺点**：四阶段的分组信息只能通过 `phase` 字段表达，多阶段归属不如独立表清晰

### 方案 B：新建 `recovery_phases` 表
独立建模阶段 → 任务层级，让前端专门渲染"四阶段恢复视图"。

- **优点**：语义更清晰
- **缺点**：需新增 schema、新增路由、新增页面。回报低（只为这一个计划做），违反 YAGNI

### 决策：选方案 A
- 理由：当前 plans/roadmap 表达能力足够；触发条件、批次执行都已完备；`phase` 字段 + `deadline` 足以表达四阶段时序

## 数据模型变更

### 无新增表，只新增记录

**investment_plans 新增 2 条**（Phase 1 的 SHY 短债 + BTC 定投，其余 3 条已存在）：

```
SHY 短债 ETF
- symbol: SHY, category: bond, direction: long
- total_target_usd: 4500
- tranches: [{batch:1, entry_low:82, entry_high:86, allocation_pct:100, amount_usd:4500}]

BTC 现货定投
- symbol: BTC, category: crypto, direction: long
- total_target_usd: 2500
- tranches: 5 批 × $500，entry_low/high 按 [72k,80k] / [70k,78k] / ...
```

**rebalance_roadmap 新增条目**（跨阶段结构性动作）：

```
Phase 0 · MNT 锁仓查询与决策 (priority=high, deadline=+7d)
Phase 0 · 合约账户 USDT $1,580 转现货 (priority=high, deadline=+3d)
Phase 0 · 清理合约残留 CLO/RAVE/RIVER/WLD (priority=low, deadline=+30d)
Phase 3 · 季度再平衡第一次 (priority=medium, deadline=2026-07-01)
Phase 4 · 半年组合复盘 (priority=medium, deadline=2026-10-18)
```

现有 5 条（id 32–36）已覆盖"增配股票/黄金/债券/减持 crypto/调整现金"的主体路径，保留不动。

## API 设计
全部使用现有端点：
- `POST /api/plans` — 新增 SHY、BTC 计划
- `POST /api/roadmap` — 新增 MNT 决策、合约清理、季度复盘
- `GET /api/plans` / `GET /api/roadmap` — 前端已接入
- `POST /api/plans/:id/tranches/:index/execute` — 批次执行时前端已有按钮

## 前端变更
**无代码变更**。Allocation 页面的三个 tab（Rebalance / Plans / Roadmap）已能渲染全部内容。

新增内容将在以下位置可见：
- `/allocation` Plans Tab → 看到 SHY 和 BTC 两条新计划
- `/allocation` Roadmap Tab → 看到 MNT 决策等新路线图项
- 每条 tranche 自带"当前价格 / 距离入场区间"指示器

## 影响分析

### 现有功能影响
- 不影响；全是增量数据
- `investment_plans` 新增 2 条 → 总量 5→7（现有 017436 纳指 / 002611 黄金 / ADA 减持 / SHY / 017436 旧批次）

### 依赖
- 价格服务需支持 SHY 和 BTC 的实时价格（Yahoo Finance + Binance WebSocket 已覆盖）
- 前端 InvestmentPlans 组件的"距离指示器"已在上一轮完成

## 风险
- **MNT 锁仓条款不透明** — Phase 0 查到条款前，Phase 1-3 的比例按剩余 $73k 计算，留出 MNT 位置
- **触发条件不命中** — 如果 F&G 快速反弹至 > 40，Phase 1 的加仓节奏需放缓；通过 deadline 和前端手动调整
- **加密减仓被套** — ETH/SOL/ADA 的止盈价位设置在 +22%~+52%，即使不达成也不影响建仓主线
