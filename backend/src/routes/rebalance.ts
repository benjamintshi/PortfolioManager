import express from 'express';
import { RebalanceService } from '../services/RebalanceService';
import { PortfolioService } from '../services/PortfolioService';
import { logger } from '../lib/logger';

const router = express.Router();
const rebalanceService = new RebalanceService();
const portfolioService = new PortfolioService();

// 获取再平衡配置
router.get('/config', async (req, res) => {
  try {
    const config = rebalanceService.getRebalanceConfig();
    
    if (!config) {
      return res.status(404).json({
        success: false,
        error: '未找到再平衡配置'
      });
    }
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('获取再平衡配置失败:', error);
    res.status(500).json({
      success: false,
      error: '获取再平衡配置失败'
    });
  }
});

// 更新再平衡配置
router.put('/config', async (req, res) => {
  try {
    const { crypto, stock, gold, threshold } = req.body;
    
    // 验证输入
    if (crypto === undefined || stock === undefined || gold === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: crypto, stock, gold'
      });
    }
    
    const cryptoTarget = parseFloat(crypto);
    const stockTarget = parseFloat(stock);
    const goldTarget = parseFloat(gold);
    const thresholdValue = threshold !== undefined ? parseFloat(threshold) : 0.05;
    
    // 验证数值
    if (isNaN(cryptoTarget) || isNaN(stockTarget) || isNaN(goldTarget) || isNaN(thresholdValue)) {
      return res.status(400).json({
        success: false,
        error: '所有数值必须是有效数字'
      });
    }
    
    if (cryptoTarget < 0 || stockTarget < 0 || goldTarget < 0 || thresholdValue < 0) {
      return res.status(400).json({
        success: false,
        error: '所有数值必须大于等于0'
      });
    }
    
    if (thresholdValue > 1) {
      return res.status(400).json({
        success: false,
        error: '阈值必须小于等于1'
      });
    }
    
    const total = cryptoTarget + stockTarget + goldTarget;
    if (Math.abs(total - 1.0) > 0.001) {
      return res.status(400).json({
        success: false,
        error: `目标配比总和必须为1.0，当前为${total.toFixed(3)}`
      });
    }
    
    const success = rebalanceService.updateRebalanceConfig({
      cryptoTarget,
      stockTarget,
      goldTarget,
      threshold: thresholdValue
    });
    
    if (!success) {
      return res.status(500).json({
        success: false,
        error: '更新配置失败'
      });
    }
    
    res.json({
      success: true,
      message: '再平衡配置更新成功'
    });
  } catch (error) {
    logger.error('更新再平衡配置失败:', error);
    res.status(500).json({
      success: false,
      error: '更新再平衡配置失败'
    });
  }
});

// 获取再平衡建议
router.get('/suggest', async (req, res) => {
  try {
    const analysis = await rebalanceService.calculateRebalanceSuggestions();
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('获取再平衡建议失败:', error);
    res.status(500).json({
      success: false,
      error: '获取再平衡建议失败'
    });
  }
});

// 获取再平衡历史
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    
    if (limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        error: '限制数量应在 1-100 之间'
      });
    }
    
    const history = rebalanceService.getRebalanceHistory(limit);
    
    res.json({
      success: true,
      data: {
        history,
        count: history.length
      }
    });
  } catch (error) {
    logger.error('获取再平衡历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取再平衡历史失败'
    });
  }
});

// 记录再平衡执行
router.post('/execute', async (req, res) => {
  try {
    const { notes } = req.body;
    
    // 获取当前组合状态
    const portfolio = await portfolioService.getPortfolioSummary();
    const analysis = await rebalanceService.calculateRebalanceSuggestions();
    
    if (!analysis.needsRebalancing) {
      return res.status(400).json({
        success: false,
        error: '当前组合不需要再平衡'
      });
    }
    
    const beforePcts = {
      crypto: portfolio.categories.crypto.percentage / 100,
      stock: portfolio.categories.stock.percentage / 100,
      gold: portfolio.categories.gold.percentage / 100
    };
    
    const recordId = rebalanceService.recordRebalanceExecution(
      beforePcts,
      analysis.suggestions,
      notes
    );
    
    if (!recordId) {
      return res.status(500).json({
        success: false,
        error: '记录再平衡执行失败'
      });
    }
    
    res.json({
      success: true,
      data: {
        recordId,
        suggestions: analysis.suggestions,
        message: '再平衡执行记录已保存，请手动执行交易后更新结果'
      }
    });
  } catch (error) {
    logger.error('记录再平衡执行失败:', error);
    res.status(500).json({
      success: false,
      error: '记录再平衡执行失败'
    });
  }
});

// 更新再平衡执行结果
router.put('/execute/:id', async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    const { cryptoPct, stockPct, goldPct } = req.body;
    
    if (isNaN(recordId)) {
      return res.status(400).json({
        success: false,
        error: '无效的记录ID'
      });
    }
    
    // 验证输入
    if (cryptoPct === undefined || stockPct === undefined || goldPct === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: cryptoPct, stockPct, goldPct'
      });
    }
    
    const crypto = parseFloat(cryptoPct);
    const stock = parseFloat(stockPct);
    const gold = parseFloat(goldPct);
    
    if (isNaN(crypto) || isNaN(stock) || isNaN(gold)) {
      return res.status(400).json({
        success: false,
        error: '所有百分比必须是有效数字'
      });
    }
    
    const total = crypto + stock + gold;
    if (Math.abs(total - 1.0) > 0.01) {
      return res.status(400).json({
        success: false,
        error: `百分比总和必须接近1.0，当前为${total.toFixed(3)}`
      });
    }
    
    const success = rebalanceService.updateRebalanceResult(recordId, {
      crypto,
      stock,
      gold
    });
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '记录不存在或更新失败'
      });
    }
    
    res.json({
      success: true,
      message: '再平衡结果更新成功'
    });
  } catch (error) {
    logger.error('更新再平衡结果失败:', error);
    res.status(500).json({
      success: false,
      error: '更新再平衡结果失败'
    });
  }
});

// 获取最优配比建议
router.get('/optimal', async (req, res) => {
  try {
    const optimalAllocation = await rebalanceService.getOptimalAllocation();
    
    if (!optimalAllocation) {
      return res.json({
        success: true,
        data: {
          message: '历史数据不足，无法计算最优配比',
          fallback: {
            crypto: 0.4,
            stock: 0.4,
            gold: 0.2
          }
        }
      });
    }
    
    // 归一化确保总和为1
    const total = optimalAllocation.crypto + optimalAllocation.stock + optimalAllocation.gold;
    const normalized = {
      crypto: optimalAllocation.crypto / total,
      stock: optimalAllocation.stock / total,
      gold: optimalAllocation.gold / total
    };
    
    res.json({
      success: true,
      data: {
        optimal_allocation: normalized,
        description: '基于历史数据风险调整收益率计算的最优配比',
        disclaimer: '此建议仅供参考，投资有风险',
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('获取最优配比失败:', error);
    res.status(500).json({
      success: false,
      error: '获取最优配比失败'
    });
  }
});

// 检查再平衡警告
router.get('/check', async (req, res) => {
  try {
    const alert = await rebalanceService.checkRebalanceAlert();
    
    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    logger.error('检查再平衡警告失败:', error);
    res.status(500).json({
      success: false,
      error: '检查再平衡警告失败'
    });
  }
});

export default router;