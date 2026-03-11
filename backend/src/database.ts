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

// 初始化数据库表
export function initDatabase() {
  logger.info('初始化数据库...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('crypto', 'stock', 'gold', 'cash')),
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

  logger.info('数据库初始化完成');
}

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});
