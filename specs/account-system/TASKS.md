# Portfolio Manager 2.0 — 任务拆解

## Phase 1: 后端基础设施

### Task 1: 数据库 schema + 加密工具
- 文件: `database.ts`, `lib/crypto.ts`
- 新建 platforms, sub_accounts, holdings, transfers, sync_logs 表 + 索引
- AES-256-GCM 加密/解密工具
- 插入默认平台（Binance/Bybit/支付宝）+ 子账户
- 清空 assets 表数据
- 预估: S

### Task 2: 平台 & 子账户 CRUD API
- 文件: `routes/platforms.ts`
- 平台 CRUD + API Key 配置(加密)/删除(脱敏)
- 子账户 CRUD
- 预估: M

### Task 3: 持仓 CRUD API
- 文件: `routes/holdings.ts`
- 列表（支持 platform/sub_account/category 过滤）
- 手动添加/更新/删除
- 关联 platform + sub_account 信息
- 预估: S

### Task 4: 转账记录 API
- 文件: `routes/transfers.ts`
- 转账 CRUD
- 转账时扣减来源 + 增加目标持仓
- 手续费处理
- 预估: M

## Phase 2: 交易所同步

### Task 5: Binance Sync Adapter
- 文件: `services/sync/BinanceSyncAdapter.ts`
- HMAC-SHA256 签名
- 现货 `/api/v3/account` + 理财 `/sapi/v1/simple-earn/flexible/position`
- 全量覆盖同步（事务内删旧插新）
- 预估: L

### Task 6: Bybit Sync Adapter
- 文件: `services/sync/BybitSyncAdapter.ts`
- V5 API 签名
- 统一账户 `/v5/account/wallet-balance`
- 预估: M

### Task 7: ExchangeSyncService + 同步 API + Cron
- 文件: `services/ExchangeSyncService.ts`
- 统一入口调用 Adapter，同步锁，日志
- `POST /api/platforms/:id/sync` + `GET /api/platforms/:id/sync-logs`
- 每小时 cron 自动同步
- 预估: M

## Phase 3: 后端改造

### Task 8: PortfolioService 改造
- `getPortfolioSummary()` → 读 holdings 表
- 新增 `getByPlatform()` 按平台汇总
- `mergedAssets` 改为 holdings JOIN sub_accounts JOIN platforms
- BinanceWebSocket `loadCryptoSymbols()` → 读 holdings
- 快照生成改为读 holdings
- 预估: M

## Phase 4: 前端全面重设计

### Task 9: 路由 + 导航重构
- 文件: `App.tsx`, `Header.tsx`, `hooks/useApi.ts`
- 6 个路由: `/` `/accounts` `/holdings` `/allocation` `/analytics` `/market`
- Header 导航更新
- useApi 新增 platformsApi, holdingsApi, transfersApi
- 移除旧路由 `/assets` `/rebalance` `/analysis` `/roadmap` `/plans` `/events`
- 预估: S

### Task 10: Dashboard 重设计
- 文件: `pages/Dashboard.tsx`
- Hero: 总资产大数字 + 涨跌幅
- Stat Cards: 总资产/盈亏/今日变动/最大偏离度
- 双饼图: 按类别 + 按平台
- 净值曲线
- 宏观指标横条（精简版）
- 平台概览小卡片
- 预估: L

### Task 11: Accounts 页面
- 文件: `pages/Accounts.tsx`
- 平台卡片列表（展开/折叠子账户+持仓）
- API Key 配置弹窗
- 同步按钮 + 状态反馈
- 手动持仓添加/编辑/删除
- 转账记录弹窗
- 同步日志 tab
- 预估: L

### Task 12: Holdings 页面
- 文件: `pages/Holdings.tsx`
- 搜索 + 类别/平台筛选
- 合并持仓表格（同 symbol 跨平台合并）
- 展开行显示各平台明细
- 只读视图
- 预估: M

### Task 13: Allocation 页面（合并 Rebalance + Plans + Roadmap）
- 文件: `pages/Allocation.tsx`
- Tab 1 当前配置: 目标 stat cards + 状态横条 + 调仓建议
- Tab 2 建仓计划: 原 InvestmentPlans 内容迁入
- Tab 3 执行路线图: 原 Roadmap 内容迁入
- 预估: L

### Task 14: Analytics 页面（重命名 Analysis）
- 文件: `pages/Analytics.tsx`
- Stat Cards: 年化收益/波动率/夏普/回撤
- 相关性矩阵
- 最优配比
- 基本是旧 Analysis 换个名 + 微调布局
- 预估: S

### Task 15: Market 页面（合并 MacroEvents + Indicators）
- 文件: `pages/Market.tsx`
- Tab 1 宏观指标: 指标卡片网格 + 添加自定义
- Tab 2 事件日历: 原 MacroEvents 内容迁入
- 预估: M

### Task 16: 清理旧文件
- 删除: `pages/Assets.tsx`, `pages/Rebalance.tsx`, `pages/Analysis.tsx`,
  `pages/Roadmap.tsx`, `pages/InvestmentPlans.tsx`, `pages/MacroEvents.tsx`,
  `pages/PriceAlerts.tsx`, `pages/Advisor.tsx`
- 删除: `components/MacroIndicators.tsx`（内容合并到 Market）
- 预估: S

## Phase 5: 原型 + 验收

### Task 17: 全页面原型更新
- 更新 prototype.html 覆盖所有 6 个页面
- 预估: M

## 依赖关系
```
Phase 1: Task 1 → Task 2 + Task 3 + Task 4 (并行)
Phase 2: Task 2 → Task 5 + Task 6 (并行) → Task 7
Phase 3: Task 3 + Task 7 → Task 8
Phase 4: Task 8 + Task 9 → Task 10~16 (大部分可并行)
Phase 5: Task 17 (独立)
```

## 预估总量
XL — 17 个任务，5 个阶段
- Phase 1 (基础): 4 tasks
- Phase 2 (同步): 3 tasks
- Phase 3 (改造): 1 task
- Phase 4 (前端): 8 tasks
- Phase 5 (验收): 1 task
