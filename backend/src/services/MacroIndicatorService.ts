import YahooFinance from 'yahoo-finance2';
const yahooFinance = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
import axios from 'axios';
import { db } from '../database';
import { logger } from '../lib/logger';

interface IndicatorResult {
  indicator_name: string;
  value: number;
  source: string;
}

export class MacroIndicatorService {
  /**
   * 从 Yahoo Finance 获取单个报价
   */
  private async getYahooQuote(symbol: string): Promise<number | null> {
    try {
      const quote = await yahooFinance.quote(symbol, {}, { suppressNotices: ['yahooSurvey'] });
      return quote?.regularMarketPrice ?? null;
    } catch (error) {
      logger.warn(`Yahoo Finance 获取 ${symbol} 失败:`, error);
      return null;
    }
  }

  /**
   * Fear & Greed Index (alternative.me)
   */
  private async fetchFearGreed(): Promise<IndicatorResult | null> {
    try {
      const resp = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 10000 });
      const value = parseInt(resp.data?.data?.[0]?.value);
      if (!isNaN(value)) {
        return { indicator_name: 'Fear & Greed', value, source: 'alternative.me' };
      }
    } catch (error) {
      logger.warn('Fear & Greed 获取失败:', error);
    }
    return null;
  }

  /**
   * BTC Dominance (CoinGecko)
   */
  private async fetchBtcDominance(): Promise<IndicatorResult | null> {
    try {
      const resp = await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 10000 });
      const dominance = resp.data?.data?.market_cap_percentage?.btc;
      if (typeof dominance === 'number') {
        return { indicator_name: 'BTC Dominance', value: parseFloat(dominance.toFixed(1)), source: 'coingecko' };
      }
    } catch (error) {
      logger.warn('BTC Dominance 获取失败:', error);
    }
    return null;
  }

  /**
   * 批量采集所有宏观指标
   */
  async fetchAll(): Promise<void> {
    logger.info('[MacroIndicator] 开始采集宏观指标');
    const results: IndicatorResult[] = [];

    // 并行获取所有数据
    const [fearGreed, btcDom, vix, dxy, us10y, usdcny] = await Promise.allSettled([
      this.fetchFearGreed(),
      this.fetchBtcDominance(),
      this.getYahooQuote('^VIX'),
      this.getYahooQuote('DX-Y.NYB'),
      this.getYahooQuote('^TNX'),
      this.getYahooQuote('USDCNY=X'),
    ]);

    if (fearGreed.status === 'fulfilled' && fearGreed.value) {
      results.push(fearGreed.value);
    }
    if (btcDom.status === 'fulfilled' && btcDom.value) {
      results.push(btcDom.value);
    }
    if (vix.status === 'fulfilled' && vix.value !== null) {
      results.push({ indicator_name: 'VIX', value: vix.value, source: 'yahoo-finance' });
    }
    if (dxy.status === 'fulfilled' && dxy.value !== null) {
      results.push({ indicator_name: 'DXY', value: dxy.value, source: 'yahoo-finance' });
    }
    if (us10y.status === 'fulfilled' && us10y.value !== null) {
      results.push({ indicator_name: 'US 10Y Yield', value: us10y.value, source: 'yahoo-finance' });
    }
    if (usdcny.status === 'fulfilled' && usdcny.value !== null) {
      results.push({ indicator_name: 'USDCNY', value: usdcny.value, source: 'yahoo-finance' });
    }

    // 写入数据库
    if (results.length > 0) {
      const timestamp = Date.now();
      const insert = db.prepare(
        'INSERT INTO macro_indicators (indicator_name, value, source, timestamp) VALUES (?, ?, ?, ?)'
      );
      const insertAll = db.transaction(() => {
        for (const r of results) {
          insert.run(r.indicator_name, r.value, r.source, timestamp);
        }
      });
      insertAll();
      logger.info(`[MacroIndicator] 采集完成，更新 ${results.length} 个指标: ${results.map(r => `${r.indicator_name}=${r.value}`).join(', ')}`);
    } else {
      logger.warn('[MacroIndicator] 所有数据源均失败，未更新');
    }
  }
}
