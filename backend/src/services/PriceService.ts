import YahooFinance from 'yahoo-finance2';
const yahooFinance = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
import axios from 'axios';
import { db } from '../database';
import { logger } from '../lib/logger';

export interface PriceData {
  symbol: string;
  price: number;
  currency: string;
  source: string;
  timestamp: number;
}

export class PriceService {
  private binanceApiUrl = process.env.BINANCE_API_URL || 'http://localhost:4001';

  /**
   * 获取加密货币价格（从binance-data-infra获取）
   */
  async getCryptoPrice(symbol: string): Promise<PriceData | null> {
    try {
      // 规范化symbol格式：如果不是以USDT结尾，就加上USDT
      const binanceSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
      
      // 验证symbol格式
      if (!/^[A-Z]{3,10}USDT$/.test(binanceSymbol)) {
        logger.error(`无效的Binance符号格式: ${binanceSymbol}`);
        return null;
      }
      
      logger.debug(`尝试获取加密货币价格: ${binanceSymbol}`);
      
      const response = await axios.get(`${this.binanceApiUrl}/api/price/${binanceSymbol}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.price) {
        const price = parseFloat(response.data.price);
        if (isNaN(price) || price <= 0) {
          logger.error(`无效的价格数据: ${response.data.price}`);
          return null;
        }
        
        return {
          symbol: symbol,
          price: price,
          currency: 'USD',
          source: 'binance',
          timestamp: Date.now()
        };
      }
      
      logger.warn(`Binance返回空价格数据: ${symbol}`);
      return null;
    } catch (error) {
      if (error.response?.status === 400) {
        logger.error(`Binance API错误: Invalid symbol ${symbol}`);
        return null;
      }
      
      logger.error(`获取加密货币价格失败 ${symbol}:`, error);
      
      // 回退1: Binance公开API
      const binanceSymbol = symbol.endsWith('USDT') ? symbol : `${symbol}USDT`;
      try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, { timeout: 5000 });
        if (response.data?.price) {
          const price = parseFloat(response.data.price);
          if (price > 0) return { symbol, price, currency: 'USD', source: 'binance-api', timestamp: Date.now() };
        }
      } catch (e: any) {
        logger.debug(`Binance API fallback失败 ${binanceSymbol}: ${e.response?.status || e.message}`);
      }
      
      // 回退2: Bybit API（部分币Binance没有但Bybit有）
      try {
        const response = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${binanceSymbol}`, { timeout: 5000 });
        const list = response.data?.result?.list;
        if (list?.[0]?.lastPrice) {
          const price = parseFloat(list[0].lastPrice);
          if (price > 0) return { symbol, price, currency: 'USD', source: 'bybit-api', timestamp: Date.now() };
        }
      } catch (e: any) {
        logger.debug(`Bybit API fallback失败 ${binanceSymbol}: ${e.message}`);
      }
      
      logger.error(`所有API均无法获取 ${symbol} 价格`);
      return null;
    }
  }

  /**
   * 获取中国基金净值（天天基金API）
   */
  async getChinaFundPrice(fundCode: string): Promise<PriceData | null> {
    try {
      const response = await axios.get(
        `http://fundgz.1234567.com.cn/js/${fundCode}.js`,
        { timeout: 5000, responseType: 'text' }
      );
      
      // 解析JSONP: jsonpgz({...});
      const match = response.data.match(/jsonpgz\((.+)\)/);
      if (match) {
        const data = JSON.parse(match[1]);
        // gsz = 估算净值（更实时），dwjz = 最新公布净值
        // 优先使用估算净值，缺失时再回退到最新净值
        const rawPrice = data.gsz || data.dwjz;
        const price = parseFloat(rawPrice);
        if (!isNaN(price) && price > 0) {
          return {
            symbol: fundCode,
            price: price,
            currency: 'CNY',
            source: 'eastmoney',
            timestamp: Date.now()
          };
        }
      }
      
      logger.warn(`天天基金无数据: ${fundCode}`);
      return null;
    } catch (error) {
      logger.error(`获取基金净值失败 ${fundCode}:`, error);
      return null;
    }
  }

  /**
   * 判断是否为中国基金代码（6位纯数字）
   */
  private isChinaFundCode(symbol: string): boolean {
    return /^\d{6}$/.test(symbol);
  }

  /**
   * 获取股票/基金价格（中国基金用天天基金，其他用Yahoo Finance）
   */
  async getStockPrice(symbol: string): Promise<PriceData | null> {
    // 中国基金代码走天天基金API
    if (this.isChinaFundCode(symbol)) {
      return this.getChinaFundPrice(symbol);
    }

    try {
      const quote = await yahooFinance.quote(symbol, {}, { suppressNotices: ['yahooSurvey'] });
      
      if (quote && quote.regularMarketPrice) {
        return {
          symbol: symbol,
          price: quote.regularMarketPrice,
          currency: quote.currency || 'USD',
          source: 'yahoo-finance',
          timestamp: Date.now()
        };
      }
      
      logger.warn(`无法从Yahoo Finance获取${symbol}价格`);
      return null;
    } catch (error) {
      logger.error(`获取股票价格失败 ${symbol}:`, error);
      return null;
    }
  }

  /**
   * 获取黄金价格（人民币/克）
   * 从Yahoo GC=F获取美元/盎司 → 转换为人民币/克
   * 1盎司 = 31.1035克
   */
  async getGoldPrice(symbol?: string): Promise<PriceData | null> {
    try {
      // 使用黄金期货 GC=F
      const quote = await yahooFinance.quote('GC=F', {}, { suppressNotices: ['yahooSurvey'] });
      
      if (quote && quote.regularMarketPrice) {
        const usdPerOunce = quote.regularMarketPrice;
        // 转换为人民币/克
        const exchangeRate = await this.getUSDCNYRate();
        const cnyPerGram = (usdPerOunce * exchangeRate) / 31.1035;
        
        return {
          symbol: symbol || 'GC=F',
          price: cnyPerGram,
          currency: 'CNY',
          source: 'yahoo-finance-gold',
          timestamp: Date.now()
        };
      }
      
      logger.warn('无法获取黄金价格');
      return null;
    } catch (error) {
      logger.error('获取黄金价格失败:', error);
      return null;
    }
  }

  /**
   * 获取USD/CNY汇率
   */
  private async getUSDCNYRate(): Promise<number> {
    try {
      const quote = await yahooFinance.quote('USDCNY=X', {}, { suppressNotices: ['yahooSurvey'] });
      if (quote && quote.regularMarketPrice) {
        return quote.regularMarketPrice;
      }
    } catch (e) {
      logger.warn('获取汇率失败，使用默认值7.1');
    }
    return 7.1; // 默认值
  }

  /**
   * 缓存价格数据到数据库
   */
  cachePriceData(priceData: PriceData): void {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO price_cache (symbol, price, currency, source, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        priceData.symbol,
        priceData.price,
        priceData.currency,
        priceData.source,
        priceData.timestamp
      );
      
      logger.debug(`缓存价格数据: ${priceData.symbol} = ${priceData.price} ${priceData.currency}`);
    } catch (error) {
      logger.error('缓存价格数据失败:', error);
    }
  }

  /**
   * 从缓存获取价格数据
   */
  getCachedPrice(symbol: string, maxAgeMs: number = 5 * 60 * 1000): PriceData | null {
    try {
      const stmt = db.prepare(`
        SELECT * FROM price_cache 
        WHERE symbol = ? AND timestamp > ?
        ORDER BY timestamp DESC 
        LIMIT 1
      `);
      
      const row = stmt.get(symbol, Date.now() - maxAgeMs) as any;
      
      if (row) {
        return {
          symbol: row.symbol,
          price: row.price,
          currency: row.currency,
          source: row.source,
          timestamp: row.timestamp
        };
      }
      
      return null;
    } catch (error) {
      logger.error('获取缓存价格失败:', error);
      return null;
    }
  }

  /**
   * 获取价格（优先从缓存，过期则重新获取）
   */
  async getPrice(symbol: string, category: 'crypto' | 'stock' | 'gold' | 'cash'): Promise<PriceData | null> {
    // 先尝试从缓存获取
    const cached = this.getCachedPrice(symbol);
    if (cached) {
      return cached;
    }

    // 缓存过期，重新获取
    let priceData: PriceData | null = null;
    
    try {
      switch (category) {
        case 'crypto':
          // 稳定币直接返回1
          if (['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD'].includes(symbol.replace('USDT', '').toUpperCase()) || symbol === 'USDT') {
            return { symbol, price: 1, currency: 'USD', source: 'static', timestamp: Date.now() };
          }
          // 确保crypto类型只用Binance API
          if (!this.isValidCryptoSymbol(symbol)) {
            logger.error(`无效的加密货币符号: ${symbol}`);
            return null;
          }
          priceData = await this.getCryptoPrice(symbol);
          break;
        case 'stock':
          // 确保stock类型只用Yahoo Finance
          if (this.isCryptoSymbol(symbol)) {
            logger.error(`股票类别不应包含加密货币符号: ${symbol}`);
            return null;
          }
          priceData = await this.getStockPrice(symbol);
          break;
        case 'gold':
          priceData = await this.getGoldPrice(symbol);
          break;
        case 'cash':
          return { symbol, price: 1, currency: 'USD', source: 'static', timestamp: Date.now() };
        default:
          logger.error(`不支持的资产类别: ${category}`);
          return null;
      }
    } catch (error) {
      logger.error(`获取 ${symbol} (${category}) 价格失败:`, error);
      return null;
    }
    
    // 缓存新数据
    if (priceData) {
      this.cachePriceData(priceData);
    }
    
    return priceData;
  }

  /**
   * 检查是否为有效的加密货币符号
   */
  private isValidCryptoSymbol(symbol: string): boolean {
    // 常见的加密货币符号格式
    const cryptoPatterns = [
      /^[A-Z]{3,10}$/, // BTC, ETH, DOGE等
      /^[A-Z]{3,10}USDT$/, // BTCUSDT格式
    ];
    
    return cryptoPatterns.some(pattern => pattern.test(symbol));
  }

  /**
   * 检查符号是否疑似加密货币
   */
  private isCryptoSymbol(symbol: string): boolean {
    // 常见加密货币符号列表（部分）
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'DOGE', 'XRP', 'LTC', 'BCH', 'LINK'];
    const baseSymbol = symbol.replace('USDT', '');
    
    return cryptoSymbols.includes(baseSymbol) || symbol.endsWith('USDT');
  }

  /**
   * 批量更新所有资产价格
   */
  async updateAllPrices(): Promise<void> {
    try {
      // 获取所有资产
      const assets = db.prepare('SELECT DISTINCT symbol, category FROM assets').all() as Array<{symbol: string, category: string}>;
      
      logger.info(`开始更新${assets.length}个资产的价格`);
      
      for (const asset of assets) {
        await this.getPrice(asset.symbol, asset.category as 'crypto' | 'stock' | 'gold' | 'cash');
        // 避免频率限制
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.info('价格更新完成');
    } catch (error) {
      logger.error('批量更新价格失败:', error);
    }
  }

  /**
   * 获取历史价格（简单实现，实际可以扩展为更复杂的历史数据）
   */
  getHistoricalPrices(symbol: string, days: number = 30): Array<{timestamp: number, price: number}> {
    try {
      const stmt = db.prepare(`
        SELECT timestamp, price FROM price_cache 
        WHERE symbol = ? AND timestamp > ?
        ORDER BY timestamp ASC
      `);
      
      const startTime = Date.now() - (days * 24 * 60 * 60 * 1000);
      const rows = stmt.all(symbol, startTime) as Array<{timestamp: number, price: number}>;
      
      return rows;
    } catch (error) {
      logger.error('获取历史价格失败:', error);
      return [];
    }
  }
}