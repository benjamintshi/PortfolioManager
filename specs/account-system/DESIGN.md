# 账户管理体系 — 技术设计

## 数据模型

### 新表

```sql
-- 平台（交易所/钱包/手动平台）
CREATE TABLE platforms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,          -- 'binance', 'bybit', 'alipay', 'other'
  display_name TEXT NOT NULL,         -- '币安', 'Bybit', '支付宝'
  type TEXT NOT NULL CHECK(type IN ('exchange', 'manual')),
  icon TEXT,                          -- emoji or icon name
  api_key_encrypted TEXT,             -- AES-256 加密的 API Key
  api_secret_encrypted TEXT,          -- AES-256 加密的 API Secret
  api_passphrase_encrypted TEXT,      -- 部分交易所需要（如 OKX）
  sync_enabled INTEGER DEFAULT 0,    -- 是否启用自动同步
  last_sync_at INTEGER,              -- 最后同步时间
  last_sync_status TEXT,             -- 'success' | 'failed' | 'syncing'
  last_sync_error TEXT,              -- 最后同步错误信息
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- 子账户
CREATE TABLE sub_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL,
  name TEXT NOT NULL,                 -- 'spot', 'earn', 'futures', 'unified', 'fund', 'gold'
  display_name TEXT NOT NULL,         -- '现货', '理财', '合约', '统一账户', '基金', '黄金'
  account_type TEXT NOT NULL CHECK(account_type IN ('spot', 'earn', 'futures', 'margin', 'funding', 'unified', 'fund', 'gold', 'other')),
  sync_enabled INTEGER DEFAULT 1,    -- 子账户级别的同步开关
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE,
  UNIQUE(platform_id, name)
);

-- 持仓（替代旧 assets 表）
CREATE TABLE holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sub_account_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  cost_price REAL NOT NULL DEFAULT 0,
  cost_currency TEXT DEFAULT 'USD',
  source TEXT DEFAULT 'manual' CHECK(source IN ('api_sync', 'manual')),
  notes TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (sub_account_id) REFERENCES sub_accounts(id) ON DELETE CASCADE
);

-- 跨平台转账
CREATE TABLE transfers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_sub_account_id INTEGER NOT NULL,
  to_sub_account_id INTEGER NOT NULL,
  symbol TEXT NOT NULL,
  quantity REAL NOT NULL,
  fee REAL DEFAULT 0,
  fee_symbol TEXT,                    -- 手续费币种（可能和转账币种不同）
  notes TEXT,
  executed_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (from_sub_account_id) REFERENCES sub_accounts(id),
  FOREIGN KEY (to_sub_account_id) REFERENCES sub_accounts(id)
);

-- 同步日志
CREATE TABLE sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform_id INTEGER NOT NULL,
  sub_account_id INTEGER,
  status TEXT NOT NULL CHECK(status IN ('started', 'success', 'failed')),
  holdings_count INTEGER,             -- 本次同步的持仓数
  error_message TEXT,
  duration_ms INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
  FOREIGN KEY (platform_id) REFERENCES platforms(id)
);
```

### 旧表处理
- `assets` 表：清空数据，保留表结构（部分旧代码可能引用）
- 新数据全部写入 `holdings` 表

### 索引
```sql
CREATE INDEX idx_holdings_sub_account ON holdings(sub_account_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);
CREATE INDEX idx_holdings_category ON holdings(category);
CREATE INDEX idx_transfers_time ON transfers(executed_at);
CREATE INDEX idx_sync_logs_platform ON sync_logs(platform_id, created_at);
```

## API 设计

### 平台管理
```
GET    /api/platforms                    — 列出所有平台（含子账户概要）
POST   /api/platforms                    — 创建平台
PUT    /api/platforms/:id                — 更新平台信息
DELETE /api/platforms/:id                — 删除平台（级联删除子账户+持仓）
PUT    /api/platforms/:id/api-key        — 配置 API Key（加密存储）
DELETE /api/platforms/:id/api-key        — 删除 API Key
POST   /api/platforms/:id/sync           — 触发同步
GET    /api/platforms/:id/sync-logs      — 同步历史
```

### 子账户
```
POST   /api/platforms/:id/sub-accounts          — 添加子账户
PUT    /api/sub-accounts/:id                     — 更新子账户
DELETE /api/sub-accounts/:id                     — 删除子账户
```

### 持仓
```
GET    /api/holdings                     — 全局持仓列表（支持 ?platform_id= &sub_account_id= 过滤）
POST   /api/holdings                     — 手动添加持仓
PUT    /api/holdings/:id                 — 更新持仓
DELETE /api/holdings/:id                 — 删除持仓
```

### 转账
```
GET    /api/transfers                    — 转账记录列表
POST   /api/transfers                    — 创建转账记录
DELETE /api/transfers/:id                — 删除转账记录
```

### 组合概览（改造现有）
```
GET    /api/portfolio/summary            — 组合概览（改为读取 holdings 表）
GET    /api/portfolio/by-platform        — 按平台分组的资产分布（新）
```

## 架构方案

### 方案 A: 独立 Sync Service（选择）
- 新建 `ExchangeSyncService`，内含 `BinanceSyncAdapter` + `BybitSyncAdapter`
- 每个 Adapter 实现 `sync(platformId, apiKey, apiSecret): HoldingData[]`
- 同步逻辑：开始事务 → 删除该子账户下 source='api_sync' 的持仓 → 插入新持仓 → 提交
- 优点：适配器模式，新交易所只需加 Adapter
- 缺点：需要维护多个 Adapter

### 方案 B: 通用 CCXT 库
- 用 ccxt 统一对接所有交易所
- 优点：一套代码支持 100+ 交易所
- 缺点：ccxt 包很大（~50MB），且部分 API（理财、合约净值）ccxt 不支持

### 决策：方案 A
理由：只需支持 2 个交易所，自写 Adapter 更轻量可控，且需要访问 Binance 理财等 ccxt 不覆盖的 API。

## API Key 加密

```typescript
// 使用 Node.js crypto 模块
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes

function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(':');
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}
```

环境变量：`ENCRYPTION_KEY` — 64 字符 hex string（32 bytes）

## 交易所 Adapter 设计

```typescript
interface ExchangeAdapter {
  name: string;
  syncSpot(apiKey: string, apiSecret: string): Promise<SyncHolding[]>;
  syncEarn?(apiKey: string, apiSecret: string): Promise<SyncHolding[]>;
  syncFutures?(apiKey: string, apiSecret: string): Promise<SyncHolding[]>;
}

interface SyncHolding {
  symbol: string;
  name: string;
  category: 'crypto' | 'cash';
  quantity: number;
  costPrice: number;      // 如 API 不提供成本，设为 0
  costCurrency: string;
}
```

### Binance Adapter
- 签名：HMAC-SHA256，参数排序 + timestamp + signature
- 现货：`GET /api/v3/account` → balances[] → filter free+locked > 0
- 理财：`GET /sapi/v1/simple-earn/flexible/position` + locked position
- 合约：`GET /fapi/v2/account` → positions[] → filter notional != 0
- 注意：理财接口需要额外权限（Universal Transfer 或 Earn 权限）

### Bybit Adapter
- 签名：HMAC-SHA256，X-BAPI-SIGN header
- 统一账户：`GET /v5/account/wallet-balance?accountType=UNIFIED` → coin[]
- 资金账户：`GET /v5/asset/transfer/query-asset-info?accountType=FUND`

## 前端变更

### 新页面：账户管理 `/accounts`
- 平台列表卡片（每个平台一张 glass card）
- 每张卡片展示：平台名、子账户数、总资产、最后同步时间、同步按钮
- 展开显示子账户 → 子账户下的持仓明细
- API Key 配置弹窗（密码输入框，提交后不可再查看）
- 同步状态实时反馈（loading → success/error）

### 改造页面
- Dashboard: 新增「平台分布」饼图/卡片
- Assets: 改为从 holdings 读取，增加平台/子账户筛选

### 新增路由
- Header.tsx 添加「账户」导航项
- App.tsx 添加 `/accounts` 路由

## 数据迁移策略
用户要求清理数据重新来：
1. 清空 `assets` 表
2. 插入默认平台：Binance、Bybit、支付宝
3. 插入默认子账户
4. 用户通过 UI 配置 API Key → 同步
5. 支付宝数据手动录入

## 影响分析
- `PortfolioService.getPortfolioSummary()` — 改为读 holdings 表
- `PriceService` — 不变（按 symbol+category 获取价格）
- `RebalanceService` — 读 holdings 表聚合
- `BinanceWebSocket` — 不变（按 holdings 表的 crypto symbol 订阅）
- 前端 `useApi.ts` — 新增 platformsApi, holdingsApi, transfersApi
