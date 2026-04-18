import { db } from '../database';
import { logger } from '../lib/logger';
import { PriceService } from './PriceService';
import { ExchangeRateService } from './ExchangeRateService';

export interface Asset {
  id: number;
  category: string;
  symbol: string;
  name: string;
  quantity: number;
  costPrice: number;
  costCurrency: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AssetWithPrice extends Asset {
  currentPrice: number;
  currentValue: number;
  costValue: number;
  profit: number;
  profitPercent: number;
}

export interface MergedAsset {
  symbol: string;
  name: string;
  category: string;
  totalQuantity: number;
  avgCostPrice: number;
  costCurrency: string;
  currentPrice: number;
  priceCurrency: string;
  totalValueUsd: number;
  totalCostUsd: number;
  profit: number;
  profitPercent: number;
  entries: AssetWithPrice[]; // 明细
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalValueCny: number;
  totalCostUsd: number;
  totalProfitUsd: number;
  totalProfitPercent: number;
  categories: Record<string, CategorySummary>;
  assets: AssetWithPrice[];
  mergedAssets: MergedAsset[];
  lastUpdated: number;
}

export interface CategorySummary {
  valueUsd: number;
  costUsd: number;
  profitUsd: number;
  profitPercent: number;
  percentage: number;
  count: number;
}

export interface PortfolioHistory {
  date: string;
  totalValueUsd: number;
  cryptoValueUsd: number;
  stockValueUsd: number;
  goldValueUsd: number;
  cryptoPct: number;
  stockPct: number;
  goldPct: number;
  exchangeRateUsdCny?: number;
  categoryDetails?: Record<string, { valueUsd: number; percentage: number }>;
}

export class PortfolioService {
  private priceService: PriceService;
  private exchangeRateService: ExchangeRateService;

  constructor() {
    this.priceService = new PriceService();
    this.exchangeRateService = new ExchangeRateService();
  }

  /**
   * 获取所有资产（从 holdings 表读取，含平台信息）
   */
  getAllAssets(): Asset[] {
    try {
      const stmt = db.prepare(`
        SELECT
          h.id, h.category, h.symbol, h.name, h.quantity,
          h.cost_price as costPrice, h.cost_currency as costCurrency,
          h.notes, h.created_at as createdAt, h.updated_at as updatedAt,
          sa.platform_id as platformId,
          p.display_name as platformName,
          sa.display_name as subAccountName
        FROM holdings h
        JOIN sub_accounts sa ON h.sub_account_id = sa.id
        JOIN platforms p ON sa.platform_id = p.id
        ORDER BY h.category, h.symbol
      `);

      return stmt.all() as Asset[];
    } catch (error) {
      logger.error('获取资产列表失败:', error);
      return [];
    }
  }

  /**
   * 按平台汇总资产
   */
  async getByPlatform(): Promise<any[]> {
    try {
      const summary = await this.getPortfolioSummary();
      const usdCnyRate = await this.exchangeRateService.getUSDCNYRate();

      const platforms = db.prepare(`
        SELECT p.id, p.name, p.display_name, p.icon, p.type,
               p.last_sync_at, p.last_sync_status
        FROM platforms p ORDER BY p.id
      `).all() as any[];

      return platforms.map(p => {
        const platformAssets = summary.assets.filter((a: any) => a.platformId === p.id);
        const valueUsd = platformAssets.reduce((s: number, a: any) => s + a.currentValue, 0);
        const costUsd = platformAssets.reduce((s: number, a: any) => s + a.costValue, 0);
        const profitUsd = valueUsd - costUsd;
        return {
          id: p.id,
          name: p.name,
          displayName: p.display_name,
          icon: p.icon,
          type: p.type,
          valueUsd,
          valueCny: valueUsd * usdCnyRate,
          costUsd,
          profitUsd,
          profitPercent: costUsd > 0 ? (profitUsd / costUsd) * 100 : 0,
          percentage: summary.totalValueUsd > 0 ? (valueUsd / summary.totalValueUsd) * 100 : 0,
          holdingsCount: platformAssets.length,
          lastSyncAt: p.last_sync_at,
          lastSyncStatus: p.last_sync_status,
        };
      }).filter(p => p.holdingsCount > 0 || p.type === 'exchange');
    } catch (error) {
      logger.error('按平台汇总失败:', error);
      return [];
    }
  }

  /**
   * 添加资产
   */
  addAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): number | null {
    try {
      const stmt = db.prepare(`
        INSERT INTO assets (category, symbol, name, quantity, cost_price, cost_currency, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        asset.category,
        asset.symbol,
        asset.name,
        asset.quantity,
        asset.costPrice,
        asset.costCurrency,
        asset.notes
      );
      
      logger.info(`添加资产: ${asset.name} (${asset.symbol})`);
      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error('添加资产失败:', error);
      return null;
    }
  }

  /**
   * 更新资产
   */
  updateAsset(id: number, updates: Partial<Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>>): boolean {
    try {
      const fields = [];
      const values = [];
      
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          // 转换字段名为数据库格式
          const dbField = key === 'costPrice' ? 'cost_price' : 
                         key === 'costCurrency' ? 'cost_currency' : key;
          fields.push(`${dbField} = ?`);
          values.push(value);
        }
      }
      
      if (fields.length === 0) return false;
      
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);
      
      const stmt = db.prepare(`
        UPDATE assets 
        SET ${fields.join(', ')}
        WHERE id = ?
      `);
      
      const result = stmt.run(...values);
      
      logger.info(`更新资产 ID ${id}`);
      return result.changes > 0;
    } catch (error) {
      logger.error('更新资产失败:', error);
      return false;
    }
  }

  /**
   * 删除资产
   */
  deleteAsset(id: number): boolean {
    try {
      // 使用事务确保数据一致性
      db.transaction(() => {
        // 先删除关联的交易记录
        const deleteTransactionsStmt = db.prepare('DELETE FROM transactions WHERE asset_id = ?');
        const transactionResult = deleteTransactionsStmt.run(id);
        
        // 再删除资产
        const deleteAssetStmt = db.prepare('DELETE FROM assets WHERE id = ?');
        const assetResult = deleteAssetStmt.run(id);
        
        if (assetResult.changes === 0) {
          throw new Error(`资产 ID ${id} 不存在`);
        }
        
        logger.info(`删除资产 ID ${id} 及其 ${transactionResult.changes} 条交易记录`);
      })();
      
      return true;
    } catch (error) {
      logger.error('删除资产失败:', error);
      return false;
    }
  }

  /**
   * 获取组合概览
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const assets = this.getAllAssets();
      const assetsWithPrice: AssetWithPrice[] = [];

      // 并发：汇率 + 批量价格（N+1 → 1+1）
      const [usdCnyRate, priceMap] = await Promise.all([
        this.exchangeRateService.getUSDCNYRate(),
        this.priceService.getPricesBatch(
          assets.map((a) => ({ symbol: a.symbol, category: a.category })),
        ),
      ]);

      // 为每个资产查价并计算盈亏
      for (const asset of assets) {
        const priceData = priceMap.get(asset.symbol) ?? null;
        const currentPrice = priceData ? priceData.price : 0;
        const priceCurrency = priceData?.currency || 'USD';
        
        // 同币种计算盈亏，最后统一转USD
        // 如果价格和成本都是CNY（基金、黄金），在CNY下比较
        // 如果价格是USD、成本是USD（crypto、美股），在USD下比较
        let currentValueUsd: number;
        let costValueUsd: number;
        
        if (priceCurrency === 'CNY' && asset.costCurrency === 'CNY') {
          // 两边都是CNY，先算CNY盈亏再转USD
          currentValueUsd = (currentPrice * asset.quantity) / usdCnyRate;
          costValueUsd = (asset.costPrice * asset.quantity) / usdCnyRate;
        } else if (priceCurrency === 'CNY' && asset.costCurrency === 'USD') {
          // 价格CNY，成本USD
          currentValueUsd = (currentPrice * asset.quantity) / usdCnyRate;
          costValueUsd = asset.costPrice * asset.quantity;
        } else if (priceCurrency === 'USD' && asset.costCurrency === 'CNY') {
          // 价格USD，成本CNY
          currentValueUsd = currentPrice * asset.quantity;
          costValueUsd = (asset.costPrice * asset.quantity) / usdCnyRate;
        } else {
          // 两边都是USD
          currentValueUsd = currentPrice * asset.quantity;
          costValueUsd = asset.costPrice * asset.quantity;
        }
        
        const currentValue = currentValueUsd;
        const costValue = costValueUsd;
        const profit = currentValue - costValue;
        const profitPercent = costValue > 0 ? (profit / costValue) * 100 : 0;
        
        assetsWithPrice.push({
          ...asset,
          currentPrice,
          currentValue,
          costValue,
          profit,
          profitPercent,
          priceCurrency: priceCurrency,
        } as any);
      }
      
      // Discover categories from actual assets
      const categorySet = new Set(assets.map(a => a.category));
      const categories: Record<string, CategorySummary> = {};
      for (const cat of categorySet) {
        categories[cat] = this.calculateCategorySummary(assetsWithPrice, cat);
      }
      
      // 计算总值
      const totalValueUsd = Object.values(categories).reduce((sum, cat) => sum + cat.valueUsd, 0);
      const totalCostUsd = Object.values(categories).reduce((sum, cat) => sum + cat.costUsd, 0);
      const totalProfitUsd = totalValueUsd - totalCostUsd;
      const totalProfitPercent = totalCostUsd > 0 ? (totalProfitUsd / totalCostUsd) * 100 : 0;
      
      // 更新各类别百分比
      for (const category of Object.values(categories)) {
        category.percentage = totalValueUsd > 0 ? (category.valueUsd / totalValueUsd) * 100 : 0;
      }
      
      // 合并同symbol资产
      const mergedMap = new Map<string, MergedAsset>();
      for (const a of assetsWithPrice) {
        const key = a.symbol;
        if (mergedMap.has(key)) {
          const m = mergedMap.get(key)!;
          m.totalQuantity += a.quantity;
          m.totalValueUsd += a.currentValue;
          m.totalCostUsd += a.costValue;
          m.entries.push(a);
        } else {
          mergedMap.set(key, {
            symbol: a.symbol,
            name: a.name,
            category: a.category,
            totalQuantity: a.quantity,
            avgCostPrice: 0,
            costCurrency: a.costCurrency,
            currentPrice: a.currentPrice,
            priceCurrency: (a as any).priceCurrency || 'USD',
            totalValueUsd: a.currentValue,
            totalCostUsd: a.costValue,
            profit: 0,
            profitPercent: 0,
            entries: [a],
          });
        }
      }
      const mergedAssets: MergedAsset[] = [];
      for (const m of mergedMap.values()) {
        m.profit = m.totalValueUsd - m.totalCostUsd;
        m.profitPercent = m.totalCostUsd > 0 ? (m.profit / m.totalCostUsd) * 100 : 0;
        // 加权平均成本 = 总成本 / 总数量（用原始币种）
        const totalCostOriginal = m.entries.reduce((s, e) => s + e.costPrice * e.quantity, 0);
        m.avgCostPrice = m.totalQuantity > 0 ? totalCostOriginal / m.totalQuantity : 0;
        // CNY资产的盈亏用CNY展示
        if (m.priceCurrency === 'CNY') {
          (m as any).totalValueCny = m.currentPrice * m.totalQuantity;
          (m as any).totalCostCny = totalCostOriginal;
          (m as any).profitCny = (m as any).totalValueCny - (m as any).totalCostCny;
        }
        mergedAssets.push(m);
      }

      return {
        totalValueUsd,
        totalValueCny: totalValueUsd * usdCnyRate,
        totalCostUsd,
        totalProfitUsd,
        totalProfitPercent,
        categories,
        assets: assetsWithPrice,
        mergedAssets,
        lastUpdated: Date.now()
      };
    } catch (error) {
      logger.error('获取组合概览失败:', error);
      throw error;
    }
  }

  /**
   * 计算类别汇总
   */
  private calculateCategorySummary(assets: AssetWithPrice[], category: string): CategorySummary {
    const categoryAssets = assets.filter(asset => asset.category === category);
    
    const valueUsd = categoryAssets.reduce((sum, asset) => sum + asset.currentValue, 0);
    const costUsd = categoryAssets.reduce((sum, asset) => sum + asset.costValue, 0);
    const profitUsd = valueUsd - costUsd;
    const profitPercent = costUsd > 0 ? (profitUsd / costUsd) * 100 : 0;
    
    return {
      valueUsd,
      costUsd,
      profitUsd,
      profitPercent,
      percentage: 0, // 将在上层计算
      count: categoryAssets.length
    };
  }

  /**
   * 生成每日组合快照
   */
  async generateDailySnapshot(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // 检查今天是否已有快照
      const existingSnapshot = db.prepare('SELECT id FROM portfolio_snapshots WHERE snapshot_date = ?').get(today);
      if (existingSnapshot) {
        logger.info(`今日快照已存在: ${today}`);
        return;
      }
      
      const summary = await this.getPortfolioSummary();
      const usdCnyRate = await this.exchangeRateService.getUSDCNYRate();

      // Backward compatible: still write old columns for crypto/stock/gold
      const cryptoCat = summary.categories['crypto'] || { valueUsd: 0, percentage: 0 };
      const stockCat = summary.categories['stock'] || { valueUsd: 0, percentage: 0 };
      const goldCat = summary.categories['gold'] || { valueUsd: 0, percentage: 0 };

      const stmt = db.prepare(`
        INSERT INTO portfolio_snapshots (
          total_value_usd, crypto_value_usd, stock_value_usd, gold_value_usd,
          crypto_pct, stock_pct, gold_pct, exchange_rate_usdcny, snapshot_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        summary.totalValueUsd,
        cryptoCat.valueUsd,
        stockCat.valueUsd,
        goldCat.valueUsd,
        cryptoCat.percentage / 100,
        stockCat.percentage / 100,
        goldCat.percentage / 100,
        usdCnyRate,
        today
      );

      // Write dynamic category details to portfolio_snapshot_details
      const snapshotId = result.lastInsertRowid as number;
      const detailStmt = db.prepare(`
        INSERT INTO portfolio_snapshot_details (snapshot_id, category, value_usd, percentage)
        VALUES (?, ?, ?, ?)
      `);
      for (const [cat, catSummary] of Object.entries(summary.categories)) {
        detailStmt.run(snapshotId, cat, catSummary.valueUsd, catSummary.percentage / 100);
      }

      logger.info(`生成每日快照: ${today}, 总价值: $${summary.totalValueUsd.toFixed(2)}`);
    } catch (error) {
      logger.error('生成每日快照失败:', error);
    }
  }

  /**
   * 获取组合历史数据
   */
  getPortfolioHistory(days: number = 30): PortfolioHistory[] {
    try {
      const stmt = db.prepare(`
        SELECT
          id,
          snapshot_date as date,
          total_value_usd as totalValueUsd,
          crypto_value_usd as cryptoValueUsd,
          stock_value_usd as stockValueUsd,
          gold_value_usd as goldValueUsd,
          crypto_pct as cryptoPct,
          stock_pct as stockPct,
          gold_pct as goldPct,
          exchange_rate_usdcny as exchangeRateUsdCny
        FROM portfolio_snapshots
        WHERE snapshot_date >= date('now', '-${days} days')
        ORDER BY snapshot_date ASC
      `);

      const rows = stmt.all() as any[];

      // Load category details for each snapshot
      const detailStmt = db.prepare(`
        SELECT category, value_usd as valueUsd, percentage
        FROM portfolio_snapshot_details
        WHERE snapshot_id = ?
      `);

      return rows.map(row => {
        const details = detailStmt.all(row.id) as Array<{ category: string; valueUsd: number; percentage: number }>;
        let categoryDetails: Record<string, { valueUsd: number; percentage: number }> | undefined;

        if (details.length > 0) {
          categoryDetails = {};
          for (const d of details) {
            categoryDetails[d.category] = { valueUsd: d.valueUsd, percentage: d.percentage };
          }
        } else {
          // Fallback to old columns
          categoryDetails = {
            crypto: { valueUsd: row.cryptoValueUsd, percentage: row.cryptoPct },
            stock: { valueUsd: row.stockValueUsd, percentage: row.stockPct },
            gold: { valueUsd: row.goldValueUsd, percentage: row.goldPct },
          };
        }

        const { id, ...rest } = row;
        return { ...rest, categoryDetails } as PortfolioHistory;
      });
    } catch (error) {
      logger.error('获取组合历史失败:', error);
      return [];
    }
  }

  /**
   * 计算相关性矩阵（简化版本）
   */
  async calculateCorrelationMatrix(): Promise<{crypto_stock: number, crypto_gold: number, stock_gold: number}> {
    try {
      // 获取过去30天的快照数据
      const history = this.getPortfolioHistory(30);
      
      if (history.length < 7) {
        // 数据不足，返回默认值
        return {
          crypto_stock: 0.3,
          crypto_gold: -0.1,
          stock_gold: 0.2
        };
      }
      
      // 计算各类别的价格变化序列
      const cryptoReturns = [];
      const stockReturns = [];
      const goldReturns = [];
      
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];
        
        if (prev.cryptoValueUsd > 0) {
          cryptoReturns.push((curr.cryptoValueUsd - prev.cryptoValueUsd) / prev.cryptoValueUsd);
        }
        if (prev.stockValueUsd > 0) {
          stockReturns.push((curr.stockValueUsd - prev.stockValueUsd) / prev.stockValueUsd);
        }
        if (prev.goldValueUsd > 0) {
          goldReturns.push((curr.goldValueUsd - prev.goldValueUsd) / prev.goldValueUsd);
        }
      }
      
      // 计算相关系数（简化版本）
      const correlation = (arr1: number[], arr2: number[]): number => {
        if (arr1.length !== arr2.length || arr1.length === 0) return 0;
        
        const mean1 = arr1.reduce((a, b) => a + b) / arr1.length;
        const mean2 = arr2.reduce((a, b) => a + b) / arr2.length;
        
        let numerator = 0;
        let sum1 = 0;
        let sum2 = 0;
        
        for (let i = 0; i < arr1.length; i++) {
          const diff1 = arr1[i] - mean1;
          const diff2 = arr2[i] - mean2;
          numerator += diff1 * diff2;
          sum1 += diff1 * diff1;
          sum2 += diff2 * diff2;
        }
        
        const denominator = Math.sqrt(sum1 * sum2);
        return denominator === 0 ? 0 : numerator / denominator;
      };
      
      const minLength = Math.min(cryptoReturns.length, stockReturns.length, goldReturns.length);
      
      return {
        crypto_stock: correlation(
          cryptoReturns.slice(0, minLength),
          stockReturns.slice(0, minLength)
        ),
        crypto_gold: correlation(
          cryptoReturns.slice(0, minLength),
          goldReturns.slice(0, minLength)
        ),
        stock_gold: correlation(
          stockReturns.slice(0, minLength),
          goldReturns.slice(0, minLength)
        )
      };
    } catch (error) {
      logger.error('计算相关性矩阵失败:', error);
      return {
        crypto_stock: 0,
        crypto_gold: 0,
        stock_gold: 0
      };
    }
  }
}