import express from 'express';
import { PortfolioService } from '../services/PortfolioService';
import { db, ASSET_CATEGORIES } from '../database';
import { logger } from '../lib/logger';

const router = express.Router();
const portfolioService = new PortfolioService();

// 获取所有资产列表
router.get('/', async (req, res) => {
  try {
    const assets = portfolioService.getAllAssets();
    
    res.json({
      success: true,
      data: assets
    });
  } catch (error) {
    logger.error('获取资产列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取资产列表失败'
    });
  }
});

// 添加资产
router.post('/', async (req, res) => {
  try {
    const { category, symbol, name, quantity, costPrice, costCurrency, notes } = req.body;
    
    // 验证必填字段
    if (!category || !symbol || !name || quantity === undefined || costPrice === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证类别（支持现金）
    if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产类别'
      });
    }
    
    // 验证数值
    if (quantity < 0 || costPrice < 0) {
      return res.status(400).json({
        success: false,
        error: '数量和成本价不能为负数'
      });
    }
    
    const assetId = portfolioService.addAsset({
      category,
      symbol: symbol.toUpperCase(),
      name,
      quantity: parseFloat(quantity),
      costPrice: parseFloat(costPrice),
      costCurrency: costCurrency || 'USD',
      notes
    });
    
    if (!assetId) {
      return res.status(500).json({
        success: false,
        error: '添加资产失败'
      });
    }
    
    res.json({
      success: true,
      data: { id: assetId }
    });
  } catch (error) {
    logger.error('添加资产失败:', error);
    res.status(500).json({
      success: false,
      error: '添加资产失败'
    });
  }
});

// 更新资产
router.put('/:id', async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    const updates = req.body;
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产ID'
      });
    }
    
    // 验证更新字段
    const allowedFields = ['category', 'symbol', 'name', 'quantity', 'costPrice', 'costCurrency', 'notes'];
    const updateData: any = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        if (key === 'symbol') {
          updateData[key] = (value as string).toUpperCase();
        } else if (key === 'quantity' || key === 'costPrice') {
          const numValue = parseFloat(value as string);
          if (isNaN(numValue) || numValue < 0) {
            return res.status(400).json({
              success: false,
              error: `无效的${key}值`
            });
          }
          updateData[key] = numValue;
        } else if (key === 'category' && !(ASSET_CATEGORIES as readonly string[]).includes(value as string)) {
          return res.status(400).json({
            success: false,
            error: '无效的资产类别'
          });
        } else {
          updateData[key] = value;
        }
      }
    }
    
    const success = portfolioService.updateAsset(assetId, updateData);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '资产不存在或更新失败'
      });
    }
    
    res.json({
      success: true,
      message: '资产更新成功'
    });
  } catch (error) {
    logger.error('更新资产失败:', error);
    res.status(500).json({
      success: false,
      error: '更新资产失败'
    });
  }
});

// 删除资产
router.delete('/:id', async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产ID'
      });
    }
    
    const success = portfolioService.deleteAsset(assetId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: '资产不存在或删除失败'
      });
    }
    
    res.json({
      success: true,
      message: '资产删除成功'
    });
  } catch (error) {
    logger.error('删除资产失败:', error);
    res.status(500).json({
      success: false,
      error: '删除资产失败'
    });
  }
});

// 记录交易
router.post('/:id/transactions', async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    const { type, quantity, price, currency, fee, notes, executedAt } = req.body;
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产ID'
      });
    }
    
    // 验证必填字段
    if (!type || quantity === undefined || price === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段'
      });
    }
    
    // 验证交易类型
    if (!['buy', 'sell', 'transfer_in', 'transfer_out'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '无效的交易类型'
      });
    }
    
    // 验证数值
    if (quantity <= 0 || price < 0) {
      return res.status(400).json({
        success: false,
        error: '数量必须大于0，价格不能为负数'
      });
    }
    
    const stmt = db.prepare(`
      INSERT INTO transactions (asset_id, type, quantity, price, currency, fee, notes, executed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      assetId,
      type,
      parseFloat(quantity),
      parseFloat(price),
      currency || 'USD',
      fee ? parseFloat(fee) : 0,
      notes,
      executedAt ? parseInt(executedAt) : Date.now()
    );
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    logger.error('记录交易失败:', error);
    res.status(500).json({
      success: false,
      error: '记录交易失败'
    });
  }
});

// 获取交易历史
router.get('/:id/transactions', async (req, res) => {
  try {
    const assetId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    
    if (isNaN(assetId)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产ID'
      });
    }
    
    const stmt = db.prepare(`
      SELECT 
        id, type, quantity, price, currency, fee, notes,
        executed_at as executedAt, created_at as createdAt
      FROM transactions
      WHERE asset_id = ?
      ORDER BY executed_at DESC
      LIMIT ?
    `);
    
    const transactions = stmt.all(assetId, limit);
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    logger.error('获取交易历史失败:', error);
    res.status(500).json({
      success: false,
      error: '获取交易历史失败'
    });
  }
});

export default router;