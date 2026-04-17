import express from 'express';
import { db, ASSET_CATEGORIES } from '../database';
import { logger } from '../lib/logger';

const router = express.Router();

// 获取持仓列表（支持筛选）
router.get('/', (req, res) => {
  try {
    const { platform_id, sub_account_id, category, symbol } = req.query;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (platform_id) {
      conditions.push('sa.platform_id = ?');
      params.push(parseInt(platform_id as string));
    }

    if (sub_account_id) {
      conditions.push('h.sub_account_id = ?');
      params.push(parseInt(sub_account_id as string));
    }

    if (category) {
      conditions.push('h.category = ?');
      params.push(category as string);
    }

    if (symbol) {
      conditions.push('h.symbol LIKE ?');
      params.push(`%${(symbol as string).toUpperCase()}%`);
    }

    const whereClause = conditions.length > 0
      ? 'WHERE ' + conditions.join(' AND ')
      : '';

    const stmt = db.prepare(`
      SELECT
        h.id,
        h.sub_account_id,
        sa.platform_id,
        p.name AS platform_name,
        p.display_name AS platform_display_name,
        sa.name AS sub_account_name,
        sa.display_name AS sub_account_display_name,
        h.category,
        h.symbol,
        h.name,
        h.quantity,
        h.cost_price,
        h.cost_currency,
        h.source,
        h.notes,
        h.created_at,
        h.updated_at
      FROM holdings h
      JOIN sub_accounts sa ON h.sub_account_id = sa.id
      JOIN platforms p ON sa.platform_id = p.id
      ${whereClause}
      ORDER BY h.category, h.symbol
    `);

    const holdings = stmt.all(...params);

    res.json({
      success: true,
      data: holdings
    });
  } catch (error) {
    logger.error('获取持仓列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取持仓列表失败'
    });
  }
});

// 创建持仓
router.post('/', (req, res) => {
  try {
    const { sub_account_id, category, symbol, name, quantity, cost_price, cost_currency, notes } = req.body;

    // 验证必填字段
    if (!sub_account_id || !category || !symbol || !name || quantity === undefined || cost_price === undefined) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: sub_account_id, category, symbol, name, quantity, cost_price'
      });
    }

    // 验证类别
    if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) {
      return res.status(400).json({
        success: false,
        error: '无效的资产类别'
      });
    }

    // 验证数值
    const parsedQuantity = parseFloat(quantity);
    const parsedCostPrice = parseFloat(cost_price);
    if (isNaN(parsedQuantity) || parsedQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: '数量不能为负数'
      });
    }
    if (isNaN(parsedCostPrice) || parsedCostPrice < 0) {
      return res.status(400).json({
        success: false,
        error: '成本价不能为负数'
      });
    }

    // 验证 sub_account_id 存在
    const subAccount = db.prepare('SELECT id FROM sub_accounts WHERE id = ?').get(sub_account_id);
    if (!subAccount) {
      return res.status(400).json({
        success: false,
        error: '子账户不存在'
      });
    }

    const stmt = db.prepare(`
      INSERT INTO holdings (sub_account_id, category, symbol, name, quantity, cost_price, cost_currency, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?)
    `);

    const result = stmt.run(
      sub_account_id,
      category,
      symbol.toUpperCase(),
      name,
      parsedQuantity,
      parsedCostPrice,
      cost_currency || 'USD',
      notes || null
    );

    res.json({
      success: true,
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    logger.error('创建持仓失败:', error);
    res.status(500).json({
      success: false,
      error: '创建持仓失败'
    });
  }
});

// 更新持仓
router.put('/:id', (req, res) => {
  try {
    const holdingId = parseInt(req.params.id);
    if (isNaN(holdingId)) {
      return res.status(400).json({
        success: false,
        error: '无效的持仓ID'
      });
    }

    // 查找持仓并检查 source
    const existing = db.prepare('SELECT id, source FROM holdings WHERE id = ?').get(holdingId) as { id: number; source: string } | undefined;
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '持仓不存在'
      });
    }
    // api_sync 持仓只允许编辑成本相关字段
    const allowedFields = existing.source === 'manual'
      ? ['name', 'quantity', 'cost_price', 'cost_currency', 'notes'] as const
      : ['cost_price', 'cost_currency', 'notes'] as const;
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (field === 'quantity' || field === 'cost_price') {
          const numValue = parseFloat(req.body[field]);
          if (isNaN(numValue) || numValue < 0) {
            return res.status(400).json({
              success: false,
              error: `无效的${field}值`
            });
          }
          setClauses.push(`${field} = ?`);
          params.push(numValue);
        } else {
          setClauses.push(`${field} = ?`);
          params.push(req.body[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        error: '没有提供更新字段'
      });
    }

    setClauses.push("updated_at = strftime('%s', 'now') * 1000");
    params.push(holdingId);

    const stmt = db.prepare(`UPDATE holdings SET ${setClauses.join(', ')} WHERE id = ?`);
    stmt.run(...params);

    res.json({
      success: true,
      message: '持仓更新成功'
    });
  } catch (error) {
    logger.error('更新持仓失败:', error);
    res.status(500).json({
      success: false,
      error: '更新持仓失败'
    });
  }
});

// 删除持仓
router.delete('/:id', (req, res) => {
  try {
    const holdingId = parseInt(req.params.id);
    if (isNaN(holdingId)) {
      return res.status(400).json({
        success: false,
        error: '无效的持仓ID'
      });
    }

    // 查找持仓并检查 source
    const existing = db.prepare('SELECT id, source FROM holdings WHERE id = ?').get(holdingId) as { id: number; source: string } | undefined;
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '持仓不存在'
      });
    }
    if (existing.source !== 'manual') {
      return res.status(403).json({
        success: false,
        error: '只能删除手动创建的持仓'
      });
    }

    db.prepare('DELETE FROM holdings WHERE id = ?').run(holdingId);

    res.json({
      success: true,
      message: '持仓删除成功'
    });
  } catch (error) {
    logger.error('删除持仓失败:', error);
    res.status(500).json({
      success: false,
      error: '删除持仓失败'
    });
  }
});

export default router;
