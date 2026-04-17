import { db } from '../database';
import { logger } from '../lib/logger';
import { decrypt } from '../lib/crypto';
import { BinanceSyncAdapter } from './sync/BinanceSyncAdapter';
import { BybitSyncAdapter } from './sync/BybitSyncAdapter';
import { SyncHolding } from './sync/types';

const binanceAdapter = new BinanceSyncAdapter();
const bybitAdapter = new BybitSyncAdapter();

// 同步锁：防止同一平台并发同步
const syncLocks = new Set<number>();

interface SubAccountRow {
  id: number;
  name: string;
  display_name: string;
  account_type: string;
  sync_enabled: number;
}

export class ExchangeSyncService {
  /**
   * 同步指定平台的所有子账户
   */
  async syncPlatform(platformId: number): Promise<{ success: boolean; message: string }> {
    // 并发锁
    if (syncLocks.has(platformId)) {
      return { success: false, message: '该平台正在同步中，请稍后重试' };
    }

    const platform = db.prepare(
      'SELECT * FROM platforms WHERE id = ?'
    ).get(platformId) as any;

    if (!platform) {
      return { success: false, message: '平台不存在' };
    }

    if (platform.type !== 'exchange') {
      return { success: false, message: '手动平台不支持 API 同步' };
    }

    // 检查是否有可用的 API Key（环境变量或数据库）
    const envKeyMap: Record<string, { key: string; secret: string }> = {
      binance: { key: 'BINANCE_API_KEY', secret: 'BINANCE_API_SECRET' },
      bybit: { key: 'BYBIT_API_KEY', secret: 'BYBIT_API_SECRET' },
    };
    const envConfig = envKeyMap[platform.name];
    const hasEnvKey = envConfig && process.env[envConfig.key] && process.env[envConfig.secret];

    if (!hasEnvKey && !platform.api_key_encrypted) {
      return { success: false, message: '未配置 API Key' };
    }

    syncLocks.add(platformId);
    const startTime = Date.now();

    // 记录同步开始
    db.prepare(
      'UPDATE platforms SET last_sync_status = ?, updated_at = ? WHERE id = ?'
    ).run('syncing', startTime, platformId);

    db.prepare(
      'INSERT INTO sync_logs (platform_id, status, created_at) VALUES (?, ?, ?)'
    ).run(platformId, 'started', startTime);

    try {
      // 优先从环境变量读取 API Key，fallback 到数据库加密存储
      let apiKey: string;
      let apiSecret: string;

      if (hasEnvKey) {
        apiKey = process.env[envConfig.key]!.trim();
        apiSecret = process.env[envConfig.secret]!.trim();
        logger.debug(`[Sync] ${platform.display_name} 使用环境变量 API Key`);
      } else if (platform.api_key_encrypted && platform.api_secret_encrypted) {
        apiKey = decrypt(platform.api_key_encrypted);
        apiSecret = decrypt(platform.api_secret_encrypted);
      } else {
        return { success: false, message: '未配置 API Key' };
      }

      const subAccounts = db.prepare(
        'SELECT * FROM sub_accounts WHERE platform_id = ? AND sync_enabled = 1'
      ).all(platformId) as SubAccountRow[];

      let totalHoldings = 0;

      for (const sub of subAccounts) {
        const holdings = await this.fetchSubAccountHoldings(
          platform.name, sub.account_type, apiKey, apiSecret
        );

        this.writeHoldings(sub.id, holdings);
        totalHoldings += holdings.length;
      }

      const duration = Date.now() - startTime;

      // 更新平台状态
      db.prepare(
        'UPDATE platforms SET last_sync_at = ?, last_sync_status = ?, last_sync_error = NULL, updated_at = ? WHERE id = ?'
      ).run(Date.now(), 'success', Date.now(), platformId);

      // 记录成功日志
      db.prepare(
        'INSERT INTO sync_logs (platform_id, status, holdings_count, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(platformId, 'success', totalHoldings, duration, Date.now());

      logger.info(`[Sync] ${platform.display_name} 同步完成: ${totalHoldings} 个持仓, ${duration}ms`);

      return { success: true, message: `同步完成: ${totalHoldings} 个持仓` };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || '未知错误';

      db.prepare(
        'UPDATE platforms SET last_sync_status = ?, last_sync_error = ?, updated_at = ? WHERE id = ?'
      ).run('failed', errorMsg, Date.now(), platformId);

      db.prepare(
        'INSERT INTO sync_logs (platform_id, status, error_message, duration_ms, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(platformId, 'failed', errorMsg, duration, Date.now());

      logger.error(`[Sync] ${platform.display_name} 同步失败: ${errorMsg}`);

      return { success: false, message: `同步失败: ${errorMsg}` };
    } finally {
      syncLocks.delete(platformId);
    }
  }

  /**
   * 根据平台和子账户类型获取持仓
   */
  private async fetchSubAccountHoldings(
    platformName: string,
    accountType: string,
    apiKey: string,
    apiSecret: string
  ): Promise<SyncHolding[]> {
    switch (platformName) {
      case 'binance':
        switch (accountType) {
          case 'spot':
            return binanceAdapter.syncSpot(apiKey, apiSecret);
          case 'earn':
            return binanceAdapter.syncEarn(apiKey, apiSecret);
          case 'futures':
            return binanceAdapter.syncFutures(apiKey, apiSecret);
          default:
            logger.warn(`[Sync] Binance 不支持的子账户类型: ${accountType}`);
            return [];
        }
      case 'bybit':
        switch (accountType) {
          case 'unified':
            return bybitAdapter.syncUnified(apiKey, apiSecret);
          case 'funding':
            return bybitAdapter.syncFunding(apiKey, apiSecret);
          case 'earn':
            return bybitAdapter.syncEarn(apiKey, apiSecret);
          default:
            logger.warn(`[Sync] Bybit 不支持的子账户类型: ${accountType}`);
            return [];
        }
      default:
        logger.warn(`[Sync] 未知的交易所: ${platformName}`);
        return [];
    }
  }

  /**
   * 将同步到的持仓写入数据库（全量覆盖，但保留已有成本数据）
   */
  private writeHoldings(subAccountId: number, holdings: SyncHolding[]): void {
    // 1. 先读取旧的成本数据（symbol → { cost_price, cost_currency }）
    const oldHoldings = db.prepare(
      "SELECT symbol, cost_price, cost_currency FROM holdings WHERE sub_account_id = ? AND source = 'api_sync' AND cost_price > 0"
    ).all(subAccountId) as Array<{ symbol: string; cost_price: number; cost_currency: string }>;

    const costMap = new Map<string, { costPrice: number; costCurrency: string }>();
    for (const old of oldHoldings) {
      costMap.set(old.symbol, { costPrice: old.cost_price, costCurrency: old.cost_currency });
    }

    // 2. 删旧插新，回填成本
    const deleteStmt = db.prepare(
      "DELETE FROM holdings WHERE sub_account_id = ? AND source = 'api_sync'"
    );
    const insertStmt = db.prepare(`
      INSERT INTO holdings (sub_account_id, category, symbol, name, quantity, cost_price, cost_currency, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'api_sync', ?, ?)
    `);

    const now = Date.now();

    db.transaction(() => {
      deleteStmt.run(subAccountId);
      for (const h of holdings) {
        if (h.quantity > 0) {
          // 如果之前有成本数据，保留
          const oldCost = costMap.get(h.symbol);
          const costPrice = oldCost ? oldCost.costPrice : h.costPrice;
          const costCurrency = oldCost ? oldCost.costCurrency : h.costCurrency;

          insertStmt.run(
            subAccountId, h.category, h.symbol, h.name,
            h.quantity, costPrice, costCurrency, now, now
          );
        }
      }
    })();
  }

  /**
   * 同步所有启用了 API 的平台
   */
  async syncAllEnabled(): Promise<void> {
    const platforms = db.prepare(
      'SELECT id, display_name FROM platforms WHERE type = ? AND sync_enabled = 1 AND api_key_encrypted IS NOT NULL'
    ).all('exchange') as Array<{ id: number; display_name: string }>;

    if (platforms.length === 0) {
      logger.debug('[Sync] 没有启用同步的平台');
      return;
    }

    logger.info(`[Sync] 开始同步 ${platforms.length} 个平台`);

    for (const platform of platforms) {
      await this.syncPlatform(platform.id);
    }
  }

  /**
   * 获取同步日志
   */
  getSyncLogs(platformId: number, limit: number = 20): any[] {
    return db.prepare(`
      SELECT * FROM sync_logs
      WHERE platform_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(platformId, limit);
  }
}
