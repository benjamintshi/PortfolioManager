import express from 'express';
import { PortfolioService } from '../services/PortfolioService';
import { logger } from '../lib/logger';

const router = express.Router();
const portfolioService = new PortfolioService();

// 获取组合概览
router.get('/by-platform', async (req, res) => {
  try {
    const data = await portfolioService.getByPlatform();
    res.json({ success: true, data });
  } catch (error) {
    logger.error('获取平台分布失败:', error);
    res.status(500).json({ success: false, error: '获取平台分布失败' });
  }
});

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

export default router;