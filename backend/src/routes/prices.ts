import express from 'express';
import { PriceService } from '../services/PriceService';
import { logger } from '../lib/logger';

const router = express.Router();
const priceService = new PriceService();

// 获取所有资产当前价格
router.get('/', async (req, res) => {
  try {
    // 从数据库获取所有资产
    const { PortfolioService } = await import('../services/PortfolioService');
    const portfolioService = new PortfolioService();
    const assets = portfolioService.getAllAssets();
    
    const prices = [];
    const errors = [];
    
    for (const asset of assets) {
      try {
        const priceData = await priceService.getPrice(asset.symbol, asset.category);
        
        if (priceData) {
          prices.push({
            symbol: asset.symbol,
            category: asset.category,
            name: asset.name,
            price: priceData.price,
            currency: priceData.currency,
            source: priceData.source,
            timestamp: priceData.timestamp
          });
        } else {
          errors.push(`无法获取 ${asset.symbol} 的价格`);
        }
      } catch (error) {
        errors.push(`获取 ${asset.symbol} 价格失败: ${error}`);
      }
    }
    
    res.json({
      success: true,
      data: {
        prices,
        errors: errors.length > 0 ? errors : undefined,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('获取价格列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取价格列表失败'
    });
  }
});

// 获取历史价格
router.get('/history', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const category = req.query.category as string;
    const days = parseInt(req.query.days as string) || 30;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        error: '需要提供 symbol 参数'
      });
    }

    if (!category || !['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: '需要指定有效的资产类别 (crypto, stock, gold, bond, commodity, reit)'
      });
    }
    
    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: '天数范围应在 1-365 之间'
      });
    }
    
    const symbolUpper = symbol.toUpperCase();
    const historyData = priceService.getHistoricalPrices(symbolUpper, days);
    
    if (historyData.length === 0) {
      return res.status(404).json({
        success: false,
        error: `无法获取 ${symbolUpper} 的价格历史`
      });
    }
    
    res.json({
      success: true,
      data: {
        symbol: symbolUpper,
        category,
        days,
        history: historyData,
        count: historyData.length
      }
    });
  } catch (error) {
    logger.error('获取历史价格失败:', error);
    res.status(500).json({
      success: false,
      error: '获取历史价格失败'
    });
  }
});

// 获取单个资产价格
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const category = req.query.category as string;

    if (!category || !['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash'].includes(category)) {
      return res.status(400).json({
        success: false,
        error: '需要指定有效的资产类别 (crypto, stock, gold, bond, commodity, reit, cash)'
      });
    }
    
    const priceData = await priceService.getPrice(symbol, category);
    
    if (!priceData) {
      return res.status(404).json({
        success: false,
        error: `无法获取 ${symbol} 的价格`
      });
    }
    
    res.json({
      success: true,
      data: priceData
    });
  } catch (error) {
    logger.error('获取单个资产价格失败:', error);
    res.status(500).json({
      success: false,
      error: '获取价格失败'
    });
  }
});

// 手动更新所有价格
router.post('/update', async (req, res) => {
  try {
    // 异步更新价格，不阻塞响应
    priceService.updateAllPrices().catch(error => {
      logger.error('后台价格更新失败:', error);
    });
    
    res.json({
      success: true,
      message: '价格更新任务已启动',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('启动价格更新失败:', error);
    res.status(500).json({
      success: false,
      error: '启动价格更新失败'
    });
  }
});

// 获取价格缓存统计
router.get('/cache/stats', async (req, res) => {
  try {
    const { db } = await import('../database');
    
    const stats = db.prepare(`
      SELECT 
        source,
        COUNT(*) as count,
        MIN(timestamp) as oldest,
        MAX(timestamp) as newest
      FROM price_cache
      GROUP BY source
    `).all();
    
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM price_cache').get() as { count: number };
    
    res.json({
      success: true,
      data: {
        total: totalCount.count,
        by_source: stats,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('获取缓存统计失败:', error);
    res.status(500).json({
      success: false,
      error: '获取缓存统计失败'
    });
  }
});

// 清理过期缓存
router.delete('/cache/cleanup', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const { db } = await import('../database');
    
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const result = db.prepare('DELETE FROM price_cache WHERE timestamp < ?').run(cutoffTime);
    
    res.json({
      success: true,
      message: `清理了 ${result.changes} 条过期缓存记录`,
      deleted_count: result.changes
    });
  } catch (error) {
    logger.error('清理缓存失败:', error);
    res.status(500).json({
      success: false,
      error: '清理缓存失败'
    });
  }
});

export default router;