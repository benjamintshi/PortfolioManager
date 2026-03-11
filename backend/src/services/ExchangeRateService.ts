import YahooFinance from 'yahoo-finance2';
const yahooFinance = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
import { db } from '../database';
import { logger } from '../lib/logger';

export interface ExchangeRate {
  pair: string;
  rate: number;
  timestamp: number;
}

export class ExchangeRateService {
  /**
   * 获取USD/CNY汇率
   */
  async getUSDCNYRate(): Promise<number> {
    try {
      // 先尝试从缓存获取（1小时内有效）
      const cached = this.getCachedRate('USDCNY', 60 * 60 * 1000);
      if (cached) {
        return cached.rate;
      }

      // 从Yahoo Finance获取
      const quote = await yahooFinance.quote('USDCNY=X', {}, { suppressNotices: ['yahooSurvey'] });
      
      if (quote && quote.regularMarketPrice) {
        const rate = quote.regularMarketPrice;
        
        // 缓存汇率
        this.cacheRate('USDCNY', rate);
        
        logger.debug(`获取USD/CNY汇率: ${rate}`);
        return rate;
      }
      
      // 如果获取失败，返回默认值
      logger.warn('无法获取USD/CNY汇率，使用默认值7.2');
      return 7.2;
    } catch (error) {
      logger.error('获取汇率失败:', error);
      
      // 尝试从缓存获取较老的数据（24小时内）
      const oldCached = this.getCachedRate('USDCNY', 24 * 60 * 60 * 1000);
      if (oldCached) {
        logger.warn('使用缓存的汇率数据');
        return oldCached.rate;
      }
      
      // 返回默认值
      return 7.2;
    }
  }

  /**
   * 缓存汇率数据
   */
  private cacheRate(pair: string, rate: number): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO exchange_rates (pair, rate, timestamp)
        VALUES (?, ?, ?)
      `);
      
      stmt.run(pair, rate, Date.now());
      
      // 清理超过7天的旧数据
      const cleanupStmt = db.prepare(`
        DELETE FROM exchange_rates 
        WHERE timestamp < ?
      `);
      cleanupStmt.run(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
    } catch (error) {
      logger.error('缓存汇率失败:', error);
    }
  }

  /**
   * 从缓存获取汇率
   */
  private getCachedRate(pair: string, maxAgeMs: number): ExchangeRate | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM exchange_rates 
        WHERE pair = ? AND timestamp > ?
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      const row = stmt.get(pair, Date.now() - maxAgeMs) as any;
      
      if (row) {
        return {
          pair: row.pair,
          rate: row.rate,
          timestamp: row.timestamp
        };
      }
      
      return null;
    } catch (error) {
      logger.error('获取缓存汇率失败:', error);
      return null;
    }
  }

  /**
   * USD转CNY
   */
  async convertUSDToCNY(usdAmount: number): Promise<number> {
    const rate = await this.getUSDCNYRate();
    return usdAmount * rate;
  }

  /**
   * CNY转USD
   */
  async convertCNYToUSD(cnyAmount: number): Promise<number> {
    const rate = await this.getUSDCNYRate();
    return cnyAmount / rate;
  }

  /**
   * 获取当前汇率信息（用于API返回）
   */
  async getCurrentRate(): Promise<{ rate: number; timestamp: number; source: string }> {
    const cached = this.getCachedRate('USDCNY', 60 * 60 * 1000);
    
    if (cached) {
      return {
        rate: cached.rate,
        timestamp: cached.timestamp,
        source: 'cache'
      };
    }
    
    // 获取新汇率
    const rate = await this.getUSDCNYRate();
    
    return {
      rate,
      timestamp: Date.now(),
      source: 'yahoo-finance'
    };
  }
}