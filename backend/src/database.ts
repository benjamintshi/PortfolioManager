import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './lib/logger.js';

const dbPath = path.join(__dirname, '../data/portfolio.db');

// 确保数据目录存在
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
export const db = new Database(dbPath);
logger.info(`数据库连接成功: ${dbPath}`);

// 启用 WAL 模式
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 1000');
db.pragma('foreign_keys = ON');

// 所有支持的资产分类
export const ASSET_CATEGORIES = ['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash'] as const;
export type AssetCategory = typeof ASSET_CATEGORIES[number];

// 初始化数据库表
export function initDatabase() {
  logger.info('初始化数据库...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash')),
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 0,
      cost_price REAL NOT NULL DEFAULT 0,
      cost_currency TEXT DEFAULT 'USD',
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('buy', 'sell', 'transfer_in', 'transfer_out')),
      quantity REAL NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      fee REAL DEFAULT 0,
      notes TEXT,
      executed_at INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS price_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      source TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      UNIQUE(symbol, timestamp)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_value_usd REAL NOT NULL,
      crypto_value_usd REAL NOT NULL,
      stock_value_usd REAL NOT NULL,
      gold_value_usd REAL NOT NULL,
      crypto_pct REAL NOT NULL,
      stock_pct REAL NOT NULL,
      gold_pct REAL NOT NULL,
      exchange_rate_usdcny REAL,
      snapshot_date TEXT NOT NULL UNIQUE,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rebalance_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crypto_target REAL NOT NULL DEFAULT 0.4,
      stock_target REAL NOT NULL DEFAULT 0.4,
      gold_target REAL NOT NULL DEFAULT 0.2,
      threshold REAL NOT NULL DEFAULT 0.05,
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  const configCount = db.prepare('SELECT COUNT(*) as count FROM rebalance_config').get() as any;
  if (!configCount || configCount.count === 0) {
    db.prepare(`
      INSERT INTO rebalance_config (crypto_target, stock_target, gold_target, threshold)
      VALUES (0.4, 0.4, 0.2, 0.05)
    `).run();
    logger.info('插入默认再平衡配置');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rebalance_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      before_crypto_pct REAL,
      before_stock_pct REAL,
      before_gold_pct REAL,
      after_crypto_pct REAL,
      after_stock_pct REAL,
      after_gold_pct REAL,
      suggestions TEXT,
      executed_at INTEGER NOT NULL,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pair TEXT NOT NULL,
      rate REAL NOT NULL,
      timestamp INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS price_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit')),
      direction TEXT NOT NULL CHECK(direction IN ('buy', 'sell')),
      trigger_price REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      enabled INTEGER DEFAULT 1,
      cooldown_minutes INTEGER DEFAULT 60,
      last_triggered_at INTEGER,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rebalance_roadmap (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase TEXT NOT NULL,
      priority TEXT NOT NULL CHECK(priority IN ('high', 'medium', 'low')),
      action TEXT NOT NULL,
      category TEXT,
      target_amount REAL,
      target_currency TEXT DEFAULT 'USD',
      reason TEXT,
      deadline TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done', 'skipped')),
      executed_at INTEGER,
      execution_notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS advisor_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_type TEXT NOT NULL DEFAULT 'daily',
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      health_score REAL,
      suggestions_json TEXT,
      insights_json TEXT,
      market_fg REAL,
      market_vix REAL,
      total_value_usd REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);
  try { db.exec('ALTER TABLE advisor_reports ADD COLUMN suggestions_json TEXT'); } catch (_) { /* may exist */ }
  try { db.exec('ALTER TABLE advisor_reports ADD COLUMN insights_json TEXT'); } catch (_) { /* may exist */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS advisor_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      acted_on INTEGER DEFAULT 0,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (report_id) REFERENCES advisor_reports(id)
    )
  `);

  // === 新表：动态再平衡配置 ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS rebalance_config_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      threshold REAL NOT NULL DEFAULT 0.05,
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rebalance_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      target REAL NOT NULL,
      FOREIGN KEY (config_id) REFERENCES rebalance_config_v2(id),
      UNIQUE(config_id, category)
    )
  `);

  // 迁移旧配置到新表
  const v2ConfigCount = db.prepare('SELECT COUNT(*) as count FROM rebalance_config_v2').get() as any;
  if (!v2ConfigCount || v2ConfigCount.count === 0) {
    const oldConfig = db.prepare('SELECT * FROM rebalance_config ORDER BY updated_at DESC LIMIT 1').get() as any;
    if (oldConfig) {
      const insertConfig = db.prepare('INSERT INTO rebalance_config_v2 (threshold) VALUES (?)');
      const result = insertConfig.run(oldConfig.threshold);
      const configId = result.lastInsertRowid as number;
      const insertTarget = db.prepare('INSERT INTO rebalance_targets (config_id, category, target) VALUES (?, ?, ?)');
      insertTarget.run(configId, 'crypto', oldConfig.crypto_target);
      insertTarget.run(configId, 'stock', oldConfig.stock_target);
      insertTarget.run(configId, 'gold', oldConfig.gold_target);
      logger.info('迁移旧再平衡配置到 v2 表');
    } else {
      const insertConfig = db.prepare('INSERT INTO rebalance_config_v2 (threshold) VALUES (?)');
      const result = insertConfig.run(0.05);
      const configId = result.lastInsertRowid as number;
      const insertTarget = db.prepare('INSERT INTO rebalance_targets (config_id, category, target) VALUES (?, ?, ?)');
      insertTarget.run(configId, 'crypto', 0.4);
      insertTarget.run(configId, 'stock', 0.4);
      insertTarget.run(configId, 'gold', 0.2);
      logger.info('插入默认再平衡配置 v2');
    }
  }

  // === 新表：组合快照详情（支持动态分类）===
  db.exec(`
    CREATE TABLE IF NOT EXISTS portfolio_snapshot_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      value_usd REAL NOT NULL DEFAULT 0,
      percentage REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (snapshot_id) REFERENCES portfolio_snapshots(id),
      UNIQUE(snapshot_id, category)
    )
  `);

  // === 新表：投资计划（分批建仓）===
  db.exec(`
    CREATE TABLE IF NOT EXISTS investment_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash')),
      tier TEXT DEFAULT 'core' CHECK(tier IN ('core', 'satellite', 'hedge')),
      direction TEXT NOT NULL CHECK(direction IN ('long', 'short')),
      total_target_usd REAL,
      status TEXT DEFAULT 'planning' CHECK(status IN ('planning', 'active', 'partial', 'completed', 'cancelled')),
      tranches_json TEXT NOT NULL DEFAULT '[]',
      stop_loss REAL,
      stop_loss_note TEXT,
      take_profit REAL,
      take_profit_note TEXT,
      scenario TEXT,
      rationale TEXT,
      source_report TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // === 新表：宏观事件日历 ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS macro_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_type TEXT DEFAULT 'data' CHECK(event_type IN ('data', 'policy', 'earnings', 'geopolitical', 'other')),
      importance TEXT DEFAULT 'medium' CHECK(importance IN ('high', 'medium', 'low')),
      affected_assets TEXT,
      expected_impact TEXT,
      actual_result TEXT,
      notes TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  // === 新表：宏观指标 ===
  db.exec(`
    CREATE TABLE IF NOT EXISTS macro_indicators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      indicator_name TEXT NOT NULL,
      value REAL NOT NULL,
      source TEXT,
      timestamp INTEGER NOT NULL,
      UNIQUE(indicator_name, timestamp)
    )
  `);

  // 迁移 assets 表 CHECK 约束（如果旧表存在且不含新分类）
  runAssetsMigration();

  const alertCount = db.prepare('SELECT COUNT(*) as count FROM price_alerts').get() as { count: number };
  if (alertCount.count === 0) {
    db.prepare(`
      INSERT INTO price_alerts (symbol, name, category, direction, trigger_price, currency, notes)
      VALUES 
        ('ETHUSDT', 'ETH', 'crypto', 'buy', 2150, 'USD', '做T买入，入场$2000–2150'),
        ('ETHUSDT', 'ETH', 'crypto', 'sell', 2100, 'USD', '做T卖出，出场$2100–2200'),
        ('SOLUSDT', 'SOL', 'crypto', 'buy', 86, 'USD', '做T买入，入场$83–86'),
        ('SOLUSDT', 'SOL', 'crypto', 'sell', 89, 'USD', '做T卖出，出场$89–93'),
        ('ADAUSDT', 'ADA', 'crypto', 'buy', 0.26, 'USD', '做T买入，入场$0.25–0.26'),
        ('ADAUSDT', 'ADA', 'crypto', 'sell', 0.27, 'USD', '做T卖出，出场$0.27–0.28'),
        ('BNBUSDT', 'BNB', 'crypto', 'buy', 650, 'USD', '做T买入，入场$640–650'),
        ('BNBUSDT', 'BNB', 'crypto', 'sell', 660, 'USD', '做T卖出，出场$660–680')
    `).run();
    logger.info('插入默认价格提醒');
  }

  logger.info('数据库初始化完成');
}

/**
 * 迁移 assets 表以支持新的资产分类
 * SQLite 不支持 ALTER CHECK，需要重建表
 */
function runAssetsMigration() {
  try {
    // 检查当前 assets 表是否已支持 bond 分类
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='assets'").get() as any;
    if (!tableInfo || !tableInfo.sql) return;

    // 如果已包含 bond，则无需迁移
    if (tableInfo.sql.includes("'bond'")) return;

    logger.info('开始迁移 assets 表以支持新资产分类...');

    db.transaction(() => {
      // 1. 创建新表
      db.exec(`
        CREATE TABLE assets_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash')),
          symbol TEXT NOT NULL,
          name TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 0,
          cost_price REAL NOT NULL DEFAULT 0,
          cost_currency TEXT DEFAULT 'USD',
          notes TEXT,
          created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
        )
      `);

      // 2. 复制数据
      db.exec('INSERT INTO assets_new SELECT * FROM assets');

      // 3. 删除旧表
      db.exec('DROP TABLE assets');

      // 4. 重命名新表
      db.exec('ALTER TABLE assets_new RENAME TO assets');
    })();

    logger.info('assets 表迁移完成');

    // 同样迁移 price_alerts 表
    const alertsInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='price_alerts'").get() as any;
    if (alertsInfo && alertsInfo.sql && !alertsInfo.sql.includes("'bond'")) {
      logger.info('开始迁移 price_alerts 表...');
      db.transaction(() => {
        db.exec(`
          CREATE TABLE price_alerts_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'bond', 'commodity', 'reit')),
            direction TEXT NOT NULL CHECK(direction IN ('buy', 'sell')),
            trigger_price REAL NOT NULL,
            currency TEXT DEFAULT 'USD',
            enabled INTEGER DEFAULT 1,
            cooldown_minutes INTEGER DEFAULT 60,
            last_triggered_at INTEGER,
            notes TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
            updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
          )
        `);
        db.exec('INSERT INTO price_alerts_new SELECT * FROM price_alerts');
        db.exec('DROP TABLE price_alerts');
        db.exec('ALTER TABLE price_alerts_new RENAME TO price_alerts');
      })();
      logger.info('price_alerts 表迁移完成');
    }
  } catch (error) {
    logger.error('资产表迁移失败:', error);
  }
}

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
