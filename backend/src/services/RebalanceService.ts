import { db } from '../database';
import { logger } from '../lib/logger';
import { PortfolioService, PortfolioSummary } from './PortfolioService';

export interface RebalanceConfig {
  id?: number;
  targets: Record<string, number>;
  threshold: number;
  updatedAt?: number;
}

export interface RebalanceSuggestion {
  category: string;
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
  beforePcts: Record<string, number>;
  afterPcts?: Record<string, number>;
  // Keep legacy fields for backward compatibility
  beforeCryptoPct?: number;
  beforeStockPct?: number;
  beforeGoldPct?: number;
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
   * 获取再平衡配置（从 v2 表读取）
   */
  getRebalanceConfig(): RebalanceConfig | null {
    try {
      const configRow = db.prepare(`
        SELECT id, threshold, updated_at as updatedAt
        FROM rebalance_config_v2
        ORDER BY updated_at DESC
        LIMIT 1
      `).get() as any;

      if (!configRow) return null;

      const targetRows = db.prepare(`
        SELECT category, target
        FROM rebalance_targets
        WHERE config_id = ?
      `).all(configRow.id) as Array<{ category: string; target: number }>;

      const targets: Record<string, number> = {};
      for (const row of targetRows) {
        targets[row.category] = row.target;
      }

      return {
        id: configRow.id,
        targets,
        threshold: configRow.threshold,
        updatedAt: configRow.updatedAt,
      };
    } catch (error) {
      logger.error('获取再平衡配置失败:', error);
      return null;
    }
  }

  /**
   * 更新再平衡配置（写入 v2 表）
   */
  updateRebalanceConfig(config: { targets: Record<string, number>; threshold: number }): boolean {
    try {
      // 验证配置：目标之和 <= 1.0（cash 为隐含余数）
      const total = Object.values(config.targets).reduce((sum, v) => sum + v, 0);
      if (total > 1.0 + 0.001) {
        logger.error(`配置验证失败: 目标总和=${total}, 应 <= 1.0`);
        return false;
      }

      if (config.threshold < 0 || config.threshold > 1) {
        logger.error(`阈值无效: ${config.threshold}, 应在0-1之间`);
        return false;
      }

      db.transaction(() => {
        // 删除旧配置及其目标
        const oldConfigs = db.prepare('SELECT id FROM rebalance_config_v2').all() as any[];
        for (const old of oldConfigs) {
          db.prepare('DELETE FROM rebalance_targets WHERE config_id = ?').run(old.id);
        }
        db.prepare('DELETE FROM rebalance_config_v2').run();

        // 插入新配置
        const insertConfig = db.prepare('INSERT INTO rebalance_config_v2 (threshold) VALUES (?)');
        const result = insertConfig.run(config.threshold);
        const configId = result.lastInsertRowid as number;

        // 插入各分类目标
        const insertTarget = db.prepare('INSERT INTO rebalance_targets (config_id, category, target) VALUES (?, ?, ?)');
        for (const [category, target] of Object.entries(config.targets)) {
          insertTarget.run(configId, category, target);
        }

        // 同步更新旧表以保持向后兼容
        db.prepare('DELETE FROM rebalance_config').run();
        const cryptoTarget = config.targets['crypto'] || 0;
        const stockTarget = config.targets['stock'] || 0;
        const goldTarget = config.targets['gold'] || 0;
        db.prepare(`
          INSERT INTO rebalance_config (crypto_target, stock_target, gold_target, threshold)
          VALUES (?, ?, ?, ?)
        `).run(cryptoTarget, stockTarget, goldTarget, config.threshold);
      })();

      const targetStr = Object.entries(config.targets).map(([k, v]) => `${k}=${v}`).join(', ');
      logger.info(`更新再平衡配置: ${targetStr}, 阈值=${config.threshold}`);
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

      const suggestions: RebalanceSuggestion[] = [];
      let maxDeviation = 0;

      // Iterate over all categories in the config targets dynamically
      for (const [category, targetPct] of Object.entries(config.targets)) {
        const catSummary = portfolio.categories[category];
        const currentPct = catSummary ? catSummary.percentage / 100 : 0;
        const diff = currentPct - targetPct;
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
            currentPct,
            targetPct,
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
  private getCategoryName(category: string): string {
    switch (category) {
      case 'crypto': return '加密货币';
      case 'stock': return '股票基金';
      case 'gold': return '黄金';
      case 'bond': return '固定收益';
      case 'commodity': return '大宗商品';
      case 'reit': return '不动产';
      case 'cash': return '现金';
      default: return category;
    }
  }

  /**
   * 记录再平衡执行
   */
  recordRebalanceExecution(
    beforePcts: Record<string, number>,
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
        JSON.stringify(beforePcts),
        JSON.stringify(beforePcts),
        JSON.stringify(beforePcts),
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
    afterPcts: Record<string, number>
  ): boolean {
    try {
      const stmt = db.prepare(`
        UPDATE rebalance_history
        SET after_crypto_pct = ?, after_stock_pct = ?, after_gold_pct = ?
        WHERE id = ?
      `);

      const jsonStr = JSON.stringify(afterPcts);
      const result = stmt.run(jsonStr, jsonStr, jsonStr, recordId);

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

      return records.map(record => {
        // Parse beforePcts: try JSON first, fall back to legacy numeric columns
        let beforePcts: Record<string, number>;
        try {
          const parsed = JSON.parse(record.beforeCryptoPct);
          if (typeof parsed === 'object' && parsed !== null) {
            beforePcts = parsed;
          } else {
            throw new Error('not an object');
          }
        } catch {
          beforePcts = {
            crypto: record.beforeCryptoPct || 0,
            stock: record.beforeStockPct || 0,
            gold: record.beforeGoldPct || 0,
          };
        }

        // Parse afterPcts
        let afterPcts: Record<string, number> | undefined;
        if (record.afterCryptoPct != null) {
          try {
            const parsed = JSON.parse(record.afterCryptoPct);
            if (typeof parsed === 'object' && parsed !== null) {
              afterPcts = parsed;
            } else {
              throw new Error('not an object');
            }
          } catch {
            afterPcts = {
              crypto: record.afterCryptoPct || 0,
              stock: record.afterStockPct || 0,
              gold: record.afterGoldPct || 0,
            };
          }
        }

        return {
          id: record.id,
          beforePcts,
          afterPcts,
          // Legacy fields for backward compatibility
          beforeCryptoPct: record.beforeCryptoPct,
          beforeStockPct: record.beforeStockPct,
          beforeGoldPct: record.beforeGoldPct,
          afterCryptoPct: record.afterCryptoPct,
          afterStockPct: record.afterStockPct,
          afterGoldPct: record.afterGoldPct,
          suggestions: JSON.parse(record.suggestions || '[]'),
          executedAt: record.executedAt,
          notes: record.notes,
          createdAt: record.createdAt,
        };
      });
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
   * Returns dynamic Record<string, number> based on config targets
   */
  async getOptimalAllocation(): Promise<Record<string, number> | null> {
    try {
      const config = this.getRebalanceConfig();
      if (!config) {
        logger.warn('无再平衡配置，无法计算最优配比');
        return null;
      }

      // 获取组合历史数据
      const history = this.portfolioService.getPortfolioHistory(90); // 3个月数据

      if (history.length < 30) {
        logger.warn('历史数据不足，无法计算最优配比');
        return null;
      }

      // Use categoryDetails from history for all categories in the config
      const categories = Object.keys(config.targets);

      // Build value series for each category
      const valueSeries: Record<string, number[]> = {};
      for (const cat of categories) {
        valueSeries[cat] = history.map(h => {
          if (h.categoryDetails && h.categoryDetails[cat]) {
            return h.categoryDetails[cat].valueUsd;
          }
          // Fallback to legacy fields
          if (cat === 'crypto') return h.cryptoValueUsd;
          if (cat === 'stock') return h.stockValueUsd;
          if (cat === 'gold') return h.goldValueUsd;
          return 0;
        });
      }

      // Calculate returns, volatility, and Sharpe ratio for each category
      const sharpeRatios: Record<string, number> = {};
      for (const cat of categories) {
        const returns = this.calculateReturns(valueSeries[cat]);
        const vol = this.calculateVolatility(returns);
        const meanReturn = this.calculateMeanReturn(returns);
        sharpeRatios[cat] = meanReturn / (vol || 1);
      }

      // 基于夏普比率的权重分配
      const totalSharpe = Object.values(sharpeRatios).reduce((sum, v) => sum + Math.abs(v), 0);

      if (totalSharpe === 0) {
        // Equal weight fallback
        const equalWeight = 1.0 / categories.length;
        const result: Record<string, number> = {};
        for (const cat of categories) {
          result[cat] = parseFloat(equalWeight.toFixed(2));
        }
        return result;
      }

      const result: Record<string, number> = {};
      for (const cat of categories) {
        result[cat] = Math.max(0.05, Math.min(0.7, Math.abs(sharpeRatios[cat]) / totalSharpe));
      }

      return result;
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
