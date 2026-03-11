import { db } from '../database';
import { logger } from '../lib/logger';
import { PriceService } from './PriceService';
import { ExchangeRateService } from './ExchangeRateService';

export interface Asset {
  id: number;
  category: 'crypto' | 'stock' | 'gold' | 'cash';
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
  category: 'crypto' | 'stock' | 'gold' | 'cash';
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
  categories: {
    crypto: CategorySummary;
    stock: CategorySummary;
    gold: CategorySummary;
    cash: CategorySummary;
  };
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
}

export class PortfolioService {
  private priceService: PriceService;
  private exchangeRateService: ExchangeRateService;

  constructor() {
    this.priceService = new PriceService();
    this.exchangeRateService = new ExchangeRateService();
  }

  /**
   * 获取所有资产
   */
  getAllAssets(): Asset[] {
    try {
      const stmt = db.prepare(`
        SELECT 
          id, category, symbol, name, quantity, 
          cost_price as costPrice, cost_currency as costCurrency,
          notes, created_at as createdAt, updated_at as updatedAt
        FROM assets 
        ORDER BY category, symbol
      `);
      
      return stmt.all() as Asset[];
    } catch (error) {
      logger.error('获取资产列表失败:', error);
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
      
      // 获取当前汇率
      const usdCnyRate = await this.exchangeRateService.getUSDCNYRate();
      
      // 为每个资产获取当前价格并计算盈亏
      for (const asset of assets) {
        const priceData = await this.priceService.getPrice(asset.symbol, asset.category);
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
      
      // 计算各类别汇总
      const categories = {
        crypto: this.calculateCategorySummary(assetsWithPrice, 'crypto'),
        stock: this.calculateCategorySummary(assetsWithPrice, 'stock'),
        gold: this.calculateCategorySummary(assetsWithPrice, 'gold'),
        cash: this.calculateCategorySummary(assetsWithPrice, 'cash'),
      };
      
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
      
      const stmt = db.prepare(`
        INSERT INTO portfolio_snapshots (
          total_value_usd, crypto_value_usd, stock_value_usd, gold_value_usd,
          crypto_pct, stock_pct, gold_pct, exchange_rate_usdcny, snapshot_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        summary.totalValueUsd,
        summary.categories.crypto.valueUsd,
        summary.categories.stock.valueUsd,
        summary.categories.gold.valueUsd,
        summary.categories.crypto.percentage / 100,
        summary.categories.stock.percentage / 100,
        summary.categories.gold.percentage / 100,
        usdCnyRate,
        today
      );
      
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
      
      return stmt.all() as PortfolioHistory[];
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