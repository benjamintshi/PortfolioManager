import express from 'express';
import { PortfolioService } from '../services/PortfolioService';
import { logger } from '../lib/logger';

const router = express.Router();
const portfolioService = new PortfolioService();

// 获取组合概览
router.get('/summary', async (req, res) => {
  try {
    const summary = await portfolioService.getPortfolioSummary();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('获取组合概览失败:', error);
    res.status(500).json({
      success: false,
      error: '获取组合概览失败'
    });
  }
});

// 获取组合历史数据
router.get('/history', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    
    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: '天数范围应在 1-365 之间'
      });
    }
    
    const history = portfolioService.getPortfolioHistory(days);
    
    res.json({
      success: true,
      data: {
        history,
        days,
        count: history.length
      }
    });
  } catch (error) {
    logger.error('获取组合历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取组合历史失败'
    });
  }
});

// 获取相关性矩阵
router.get('/correlation', async (req, res) => {
  try {
    const correlation = await portfolioService.calculateCorrelationMatrix();
    
    res.json({
      success: true,
      data: {
        correlation_matrix: correlation,
        description: {
          crypto_stock: '加密货币与股票基金的相关性',
          crypto_gold: '加密货币与黄金的相关性',
          stock_gold: '股票基金与黄金的相关性'
        },
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('获取相关性矩阵失败:', error);
    res.status(500).json({
      success: false,
      error: '获取相关性矩阵失败'
    });
  }
});

// 手动生成每日快照
router.post('/snapshot', async (req, res) => {
  try {
    await portfolioService.generateDailySnapshot();
    
    res.json({
      success: true,
      message: '每日快照生成成功',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('生成每日快照失败:', error);
    res.status(500).json({
      success: false,
      error: '生成每日快照失败'
    });
  }
});

// 获取组合统计信息
router.get('/stats', async (req, res) => {
  try {
    const { db } = await import('../database');
    
    // 资产统计
    const assetStats = db.prepare(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(quantity * cost_price) as total_cost
      FROM assets
      GROUP BY category
    `).all();
    
    // 交易统计
    const transactionStats = db.prepare(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(quantity * price) as total_value
      FROM transactions
      GROUP BY type
    `).all();
    
    // 快照统计
    const snapshotStats = db.prepare(`
      SELECT 
        COUNT(*) as count,
        MIN(snapshot_date) as earliest_date,
        MAX(snapshot_date) as latest_date,
        MAX(total_value_usd) as max_value,
        MIN(total_value_usd) as min_value
      FROM portfolio_snapshots
    `).get();
    
    res.json({
      success: true,
      data: {
        assets: assetStats,
        transactions: transactionStats,
        snapshots: snapshotStats,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('获取组合统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取组合统计失败'
    });
  }
});

// 计算风险指标
router.get('/risk', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const history = portfolioService.getPortfolioHistory(days);

    const MIN_HISTORY_DAYS = 14;
    const MAX_ABS_DAILY_RETURN = 0.3; // 单日收益超过 ±30% 视为被大额现金流污染
    const MIN_RETURN_OBSERVATIONS = 10;
    
    if (history.length < MIN_HISTORY_DAYS) {
      return res.json({
        success: true,
        data: {
          message: `历史天数不足，至少需要 ${MIN_HISTORY_DAYS} 天数据`,
          insufficient: true,
          required_days: MIN_HISTORY_DAYS,
          available_days: history.length
        }
      });
    }
    
    // 计算总收益率序列
    const rawReturns: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prevValue = history[i - 1].totalValueUsd;
      const currValue = history[i].totalValueUsd;
      
      if (prevValue > 0) {
        rawReturns.push((currValue - prevValue) / prevValue);
      }
    }

    // 过滤掉绝对值过大的单日变动（通常是大额申赎/录入资产导致）
    const returns = rawReturns.filter(r => Math.abs(r) <= MAX_ABS_DAILY_RETURN);
    
    if (returns.length < MIN_RETURN_OBSERVATIONS) {
      return res.json({
        success: true,
        data: {
          message: '有效收益序列过少，可能被大额资金流入/流出严重干扰，暂不计算风险指标',
          insufficient: true,
          required_observations: MIN_RETURN_OBSERVATIONS,
          available_observations: returns.length
        }
      });
    }
    
    // 计算平均收益率
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // 计算波动率
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // 简化的夏普比率（假设无风险利率为0）
    const sharpeRatio = volatility > 0 ? meanReturn / volatility : 0;
    
    // 年化处理：使用复利形式，并按交易日估算
    const TRADING_DAYS = 252;
    const annualReturn = Math.pow(1 + meanReturn, TRADING_DAYS) - 1;
    const annualVolatility = volatility * Math.sqrt(TRADING_DAYS);
    const annualSharpe = sharpeRatio * Math.sqrt(TRADING_DAYS);

    // 简单的“合理性”过滤：如果年化收益或夏普比率极端，认为受资金流严重干扰
    const MAX_REASONABLE_ANNUAL_RETURN = 1.5; // 150%
    const MAX_REASONABLE_ANNUAL_SHARPE = 5;

    if (annualReturn > MAX_REASONABLE_ANNUAL_RETURN || Math.abs(annualSharpe) > MAX_REASONABLE_ANNUAL_SHARPE) {
      return res.json({
        success: true,
        data: {
          message: '历史记录受大额资金流入/流出影响，风险指标严重失真，暂不展示',
          insufficient: true,
          suspect: true,
          period_days: days
        }
      });
    }
    
    // 最大回撤（仍然基于总市值序列）
    let maxDrawdown = 0;
    let peak = 0;
    
    for (const snapshot of history) {
      if (snapshot.totalValueUsd > peak) {
        peak = snapshot.totalValueUsd;
      }
      
      const drawdown = peak > 0 ? (peak - snapshot.totalValueUsd) / peak : 0;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    res.json({
      success: true,
      data: {
        period_days: days,
        mean_daily_return: meanReturn,
        volatility: volatility,
        sharpe_ratio: sharpeRatio,
        max_drawdown: maxDrawdown,
        annualized: {
          return: annualReturn,
          volatility: annualVolatility,
          sharpe_ratio: annualSharpe
        },
        insufficient: false,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('计算风险指标失败:', error);
    res.status(500).json({
      success: false,
      error: '计算风险指标失败'
    });
  }
});

export default router;