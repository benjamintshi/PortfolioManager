import { db } from '../database';
import { logger } from '../lib/logger';
import { PortfolioService, PortfolioSummary } from './PortfolioService';

export interface RebalanceConfig {
  id?: number;
  cryptoTarget: number;
  stockTarget: number;
  goldTarget: number;
  threshold: number;
  updatedAt?: number;
}

export interface RebalanceSuggestion {
  category: 'crypto' | 'stock' | 'gold' | 'cash';
  action: 'buy' | 'sell';
  amount: number;
  currentPct: number;
  targetPct: number;
  deviation: number;
  priority: 'high' | 'medium' | 'low';
}

export interface RebalanceAnalysis {
  needsRebalancing: boolean;
  maxDeviation: number;
  suggestions: RebalanceSuggestion[];
  summary: string;
}

export interface RebalanceRecord {
  id: number;
  beforeCryptoPct: number;
  beforeStockPct: number;
  beforeGoldPct: number;
  afterCryptoPct?: number;
  afterStockPct?: number;
  afterGoldPct?: number;
  suggestions: string;
  executedAt: number;
  notes?: string;
  createdAt: number;
}

export class RebalanceService {
  private portfolioService: PortfolioService;

  constructor() {
    this.portfolioService = new PortfolioService();
  }

  /**
   * 获取再平衡配置
   */
  getRebalanceConfig(): RebalanceConfig | null {
    try {
      const stmt = db.prepare(`
        SELECT 
          id, crypto_target as cryptoTarget, stock_target as stockTarget, 
          gold_target as goldTarget, threshold, updated_at as updatedAt
        FROM rebalance_config 
        ORDER BY updated_at DESC 
        LIMIT 1
      `);
      
      return stmt.get() as RebalanceConfig || null;
    } catch (error) {
      logger.error('获取再平衡配置失败:', error);
      return null;
    }
  }

  /**
   * 更新再平衡配置
   */
  updateRebalanceConfig(config: Omit<RebalanceConfig, 'id' | 'updatedAt'>): boolean {
    try {
      // 验证配置
      const total = config.cryptoTarget + config.stockTarget + config.goldTarget;
      if (Math.abs(total - 1.0) > 0.001) {
        logger.error(`配置验证失败: 总和=${total}, 应为1.0`);
        return false;
      }
      
      if (config.threshold < 0 || config.threshold > 1) {
        logger.error(`阈值无效: ${config.threshold}, 应在0-1之间`);
        return false;
      }

      // 删除旧配置
      db.prepare('DELETE FROM rebalance_config').run();
      
      // 插入新配置
      const stmt = db.prepare(`
        INSERT INTO rebalance_config (crypto_target, stock_target, gold_target, threshold)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(config.cryptoTarget, config.stockTarget, config.goldTarget, config.threshold);
      
      logger.info(`更新再平衡配置: Crypto=${config.cryptoTarget}, Stock=${config.stockTarget}, Gold=${config.goldTarget}, 阈值=${config.threshold}`);
      return true;
    } catch (error) {
      logger.error('更新再平衡配置失败:', error);
      return false;
    }
  }

  /**
   * 计算再平衡建议
   */
  async calculateRebalanceSuggestions(): Promise<RebalanceAnalysis> {
    try {
      const config = this.getRebalanceConfig();
      if (!config) {
        throw new Error('未找到再平衡配置');
      }

      const portfolio = await this.portfolioService.getPortfolioSummary();
      
      if (portfolio.totalValueUsd === 0) {
        return {
          needsRebalancing: false,
          maxDeviation: 0,
          suggestions: [],
          summary: '组合总价值为0，无需再平衡'
        };
      }

      const current = {
        crypto: portfolio.categories.crypto.percentage / 100,
        stock: portfolio.categories.stock.percentage / 100,
        gold: portfolio.categories.gold.percentage / 100
      };

      const target = {
        crypto: config.cryptoTarget,
        stock: config.stockTarget,
        gold: config.goldTarget
      };

      const suggestions: RebalanceSuggestion[] = [];
      let maxDeviation = 0;

      // 计算每个类别的偏离度
      for (const category of ['crypto', 'stock', 'gold'] as const) {
        const diff = current[category] - target[category];
        const absDiff = Math.abs(diff);
        
        if (absDiff > maxDeviation) {
          maxDeviation = absDiff;
        }

        if (absDiff > config.threshold) {
          const amount = absDiff * portfolio.totalValueUsd;
          const priority = absDiff > config.threshold * 2 ? 'high' :
                          absDiff > config.threshold * 1.5 ? 'medium' : 'low';

          suggestions.push({
            category,
            action: diff > 0 ? 'sell' : 'buy',
            amount,
            currentPct: current[category],
            targetPct: target[category],
            deviation: diff,
            priority
          });
        }
      }

      // 生成建议摘要
      const summary = this.generateSuggestionSummary(suggestions, portfolio.totalValueUsd);

      return {
        needsRebalancing: suggestions.length > 0,
        maxDeviation,
        suggestions,
        summary
      };
    } catch (error) {
      logger.error('计算再平衡建议失败:', error);
      throw error;
    }
  }

  /**
   * 生成建议摘要文本
   */
  private generateSuggestionSummary(suggestions: RebalanceSuggestion[], totalValue: number): string {
    if (suggestions.length === 0) {
      return '组合配比在目标范围内，无需再平衡';
    }

    const sellSuggestions = suggestions.filter(s => s.action === 'sell');
    const buySuggestions = suggestions.filter(s => s.action === 'buy');

    let summary = '建议进行再平衡：';
    
    // 卖出建议
    for (const suggestion of sellSuggestions) {
      const categoryName = this.getCategoryName(suggestion.category);
      const percentage = (suggestion.deviation * 100).toFixed(1);
      summary += `\n• 卖出价值 $${suggestion.amount.toFixed(0)} 的${categoryName}（当前占比 ${(suggestion.currentPct * 100).toFixed(1)}%，目标 ${(suggestion.targetPct * 100).toFixed(1)}%，偏离 +${percentage}%）`;
    }

    // 买入建议
    for (const suggestion of buySuggestions) {
      const categoryName = this.getCategoryName(suggestion.category);
      const percentage = Math.abs(suggestion.deviation * 100).toFixed(1);
      summary += `\n• 买入价值 $${suggestion.amount.toFixed(0)} 的${categoryName}（当前占比 ${(suggestion.currentPct * 100).toFixed(1)}%，目标 ${(suggestion.targetPct * 100).toFixed(1)}%，偏离 -${percentage}%）`;
    }

    return summary;
  }

  /**
   * 获取类别中文名称
   */
  private getCategoryName(category: 'crypto' | 'stock' | 'gold' | 'cash'): string {
    switch (category) {
      case 'crypto': return '加密货币';
      case 'stock': return '股票基金';
      case 'gold': return '黄金';
      default: return category;
    }
  }

  /**
   * 记录再平衡执行
   */
  recordRebalanceExecution(
    beforePcts: { crypto: number; stock: number; gold: number },
    suggestions: RebalanceSuggestion[],
    notes?: string
  ): number | null {
    try {
      const stmt = db.prepare(`
        INSERT INTO rebalance_history (
          before_crypto_pct, before_stock_pct, before_gold_pct,
          suggestions, executed_at, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        beforePcts.crypto,
        beforePcts.stock,
        beforePcts.gold,
        JSON.stringify(suggestions),
        Date.now(),
        notes
      );
      
      logger.info('记录再平衡执行');
      return result.lastInsertRowid as number;
    } catch (error) {
      logger.error('记录再平衡执行失败:', error);
      return null;
    }
  }

  /**
   * 更新再平衡执行结果
   */
  updateRebalanceResult(
    recordId: number,
    afterPcts: { crypto: number; stock: number; gold: number }
  ): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE rebalance_history 
        SET after_crypto_pct = ?, after_stock_pct = ?, after_gold_pct = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(afterPcts.crypto, afterPcts.stock, afterPcts.gold, recordId);
      
      logger.info(`更新再平衡结果 ID ${recordId}`);
      return result.changes > 0;
    } catch (error) {
      logger.error('更新再平衡结果失败:', error);
      return false;
    }
  }

  /**
   * 获取再平衡历史
   */
  getRebalanceHistory(limit: number = 20): RebalanceRecord[] {
    try {
      const stmt = db.prepare(`
        SELECT 
          id, before_crypto_pct as beforeCryptoPct, before_stock_pct as beforeStockPct,
          before_gold_pct as beforeGoldPct, after_crypto_pct as afterCryptoPct,
          after_stock_pct as afterStockPct, after_gold_pct as afterGoldPct,
          suggestions, executed_at as executedAt, notes, created_at as createdAt
        FROM rebalance_history
        ORDER BY executed_at DESC
        LIMIT ?
      `);
      
      const records = stmt.all(limit) as any[];
      
      // 解析suggestions JSON
      return records.map(record => ({
        ...record,
        suggestions: JSON.parse(record.suggestions || '[]')
      }));
    } catch (error) {
      logger.error('获取再平衡历史失败:', error);
      return [];
    }
  }

  /**
   * 检查是否需要再平衡（用于定时提醒）
   */
  async checkRebalanceAlert(): Promise<{ needsAlert: boolean; message: string }> {
    try {
      const analysis = await this.calculateRebalanceSuggestions();
      
      if (!analysis.needsRebalancing) {
        return {
          needsAlert: false,
          message: '组合配比正常，无需调整'
        };
      }

      // 检查是否有高优先级建议
      const highPrioritySuggestions = analysis.suggestions.filter(s => s.priority === 'high');
      
      if (highPrioritySuggestions.length === 0) {
        return {
          needsAlert: false,
          message: '偏离较小，暂时无需调整'
        };
      }

      // 生成告警消息
      const config = this.getRebalanceConfig()!;
      const portfolio = await this.portfolioService.getPortfolioSummary();
      
      let message = '⚖️ 再平衡提醒：\n';
      
      for (const suggestion of highPrioritySuggestions) {
        const categoryName = this.getCategoryName(suggestion.category);
        const currentPct = (suggestion.currentPct * 100).toFixed(1);
        const targetPct = (suggestion.targetPct * 100).toFixed(1);
        const deviation = Math.abs(suggestion.deviation * 100).toFixed(1);
        
        message += `${categoryName}占比${currentPct}%（目标${targetPct}%），偏离${deviation}%\n`;
      }
      
      message += `\n总资产价值：$${portfolio.totalValueUsd.toFixed(0)}`;
      message += `\n最大偏离：${(analysis.maxDeviation * 100).toFixed(1)}%（阈值${(config.threshold * 100).toFixed(1)}%）`;

      return {
        needsAlert: true,
        message
      };
    } catch (error) {
      logger.error('检查再平衡告警失败:', error);
      return {
        needsAlert: false,
        message: '检查失败'
      };
    }
  }

  /**
   * 获取最优配比建议（基于历史数据的简化版Markowitz优化）
   */
  async getOptimalAllocation(): Promise<{ crypto: number; stock: number; gold: number } | null> {
    try {
      // 获取组合历史数据
      const history = this.portfolioService.getPortfolioHistory(90); // 3个月数据
      
      if (history.length < 30) {
        logger.warn('历史数据不足，无法计算最优配比');
        return null;
      }

      // 计算各类别的历史收益和风险
      const returns = {
        crypto: this.calculateReturns(history.map(h => h.cryptoValueUsd)),
        stock: this.calculateReturns(history.map(h => h.stockValueUsd)),
        gold: this.calculateReturns(history.map(h => h.goldValueUsd))
      };

      const volatility = {
        crypto: this.calculateVolatility(returns.crypto),
        stock: this.calculateVolatility(returns.stock),
        gold: this.calculateVolatility(returns.gold)
      };

      // 简化的风险调整收益率
      const sharpeRatio = {
        crypto: this.calculateMeanReturn(returns.crypto) / (volatility.crypto || 1),
        stock: this.calculateMeanReturn(returns.stock) / (volatility.stock || 1),
        gold: this.calculateMeanReturn(returns.gold) / (volatility.gold || 1)
      };

      // 基于夏普比率的权重分配（简化版本）
      const totalSharpe = Math.abs(sharpeRatio.crypto) + Math.abs(sharpeRatio.stock) + Math.abs(sharpeRatio.gold);
      
      if (totalSharpe === 0) {
        // 如果无法计算，返回均等权重
        return { crypto: 0.33, stock: 0.34, gold: 0.33 };
      }

      return {
        crypto: Math.max(0.1, Math.min(0.7, Math.abs(sharpeRatio.crypto) / totalSharpe)),
        stock: Math.max(0.1, Math.min(0.7, Math.abs(sharpeRatio.stock) / totalSharpe)),
        gold: Math.max(0.1, Math.min(0.7, Math.abs(sharpeRatio.gold) / totalSharpe))
      };
    } catch (error) {
      logger.error('计算最优配比失败:', error);
      return null;
    }
  }

  /**
   * 计算收益率序列
   */
  private calculateReturns(values: number[]): number[] {
    const returns = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        returns.push((values[i] - values[i - 1]) / values[i - 1]);
      }
    }
    return returns;
  }

  /**
   * 计算平均收益率
   */
  private calculateMeanReturn(returns: number[]): number {
    if (returns.length === 0) return 0;
    return returns.reduce((sum, r) => sum + r, 0) / returns.length;
  }

  /**
   * 计算波动率
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = this.calculateMeanReturn(returns);
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }
}