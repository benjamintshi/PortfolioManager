import express from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';

const router = express.Router();

// 获取所有划转记录
router.get('/', (req, res) => {
  try {
    const transfers = db.prepare(`
      SELECT
        t.id,
        t.from_sub_account_id,
        t.to_sub_account_id,
        t.symbol,
        t.quantity,
        t.fee,
        t.fee_symbol,
        t.notes,
        t.executed_at,
        t.created_at,
        fp.display_name AS from_platform_name,
        fsa.display_name AS from_sub_account_name,
        tp.display_name AS to_platform_name,
        tsa.display_name AS to_sub_account_name
      FROM transfers t
      JOIN sub_accounts fsa ON fsa.id = t.from_sub_account_id
      JOIN platforms fp ON fp.id = fsa.platform_id
      JOIN sub_accounts tsa ON tsa.id = t.to_sub_account_id
      JOIN platforms tp ON tp.id = tsa.platform_id
      ORDER BY t.executed_at DESC
    `).all();

    res.json({ success: true, data: transfers });
  } catch (error) {
    logger.error('获取划转记录失败:', error);
    res.status(500).json({ success: false, error: '获取划转记录失败' });
  }
});

// 创建划转
router.post('/', (req, res) => {
  try {
    const {
      from_sub_account_id,
      to_sub_account_id,
      symbol,
      quantity,
      fee,
      fee_symbol,
      notes,
      executed_at,
    } = req.body;

    // 验证必填字段
    if (!from_sub_account_id || !to_sub_account_id || !symbol || !quantity) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: from_sub_account_id, to_sub_account_id, symbol, quantity',
      });
    }

    if (from_sub_account_id === to_sub_account_id) {
      return res.status(400).json({
        success: false,
        error: '转出和转入账户不能相同',
      });
    }

    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({
        success: false,
        error: '数量必须大于0',
      });
    }

    const parsedFee = fee ? parseFloat(fee) : 0;
    if (isNaN(parsedFee) || parsedFee < 0) {
      return res.status(400).json({
        success: false,
        error: '手续费不能为负数',
      });
    }

    const executeTransfer = db.transaction(() => {
      // 1. 查找转出账户的持仓
      const fromHolding = db.prepare(
        `SELECT * FROM holdings WHERE sub_account_id = ? AND symbol = ?`
      ).get(from_sub_account_id, symbol) as Record<string, unknown> | undefined;

      if (!fromHolding) {
        throw new TransferError(400, `转出账户中未找到 ${symbol} 持仓`);
      }

      const fromQuantity = fromHolding.quantity as number;

      // 2. 检查余额
      if (fromQuantity < parsedQuantity) {
        throw new TransferError(400, '余额不足');
      }

      // 3. 减少转出账户持仓
      const remainingQuantity = fromQuantity - parsedQuantity;
      if (remainingQuantity === 0) {
        db.prepare(`DELETE FROM holdings WHERE id = ?`).run(fromHolding.id);
      } else {
        db.prepare(
          `UPDATE holdings SET quantity = ?, updated_at = ? WHERE id = ?`
        ).run(remainingQuantity, Date.now(), fromHolding.id);
      }

      // 4. 查找或创建转入账户持仓
      const toHolding = db.prepare(
        `SELECT * FROM holdings WHERE sub_account_id = ? AND symbol = ?`
      ).get(to_sub_account_id, symbol) as Record<string, unknown> | undefined;

      const actualReceived = parsedQuantity - parsedFee;

      if (toHolding) {
        db.prepare(
          `UPDATE holdings SET quantity = quantity + ?, updated_at = ? WHERE id = ?`
        ).run(actualReceived, Date.now(), toHolding.id);
      } else {
        db.prepare(`
          INSERT INTO holdings (sub_account_id, category, symbol, name, quantity, cost_price, cost_currency, source)
          VALUES (?, ?, ?, ?, ?, 0, ?, 'manual')
        `).run(
          to_sub_account_id,
          fromHolding.category,
          symbol,
          fromHolding.name,
          actualReceived,
          fromHolding.cost_currency || 'USD',
        );
      }

      // 5. 插入划转记录
      const result = db.prepare(`
        INSERT INTO transfers (from_sub_account_id, to_sub_account_id, symbol, quantity, fee, fee_symbol, notes, executed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        from_sub_account_id,
        to_sub_account_id,
        symbol,
        parsedQuantity,
        parsedFee,
        fee_symbol || null,
        notes || null,
        executed_at ? parseInt(executed_at) : Date.now(),
      );

      return result.lastInsertRowid;
    });

    const transferId = executeTransfer();

    // 查询完整记录返回
    const created = db.prepare(`
      SELECT
        t.id,
        t.from_sub_account_id,
        t.to_sub_account_id,
        t.symbol,
        t.quantity,
        t.fee,
        t.fee_symbol,
        t.notes,
        t.executed_at,
        t.created_at,
        fp.display_name AS from_platform_name,
        fsa.display_name AS from_sub_account_name,
        tp.display_name AS to_platform_name,
        tsa.display_name AS to_sub_account_name
      FROM transfers t
      JOIN sub_accounts fsa ON fsa.id = t.from_sub_account_id
      JOIN platforms fp ON fp.id = fsa.platform_id
      JOIN sub_accounts tsa ON tsa.id = t.to_sub_account_id
      JOIN platforms tp ON tp.id = tsa.platform_id
      WHERE t.id = ?
    `).get(transferId);

    res.json({ success: true, data: created });
  } catch (error) {
    if (error instanceof TransferError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }
    logger.error('创建划转失败:', error);
    res.status(500).json({ success: false, error: '创建划转失败' });
  }
});

// 删除划转记录（不回滚持仓变更）
router.delete('/:id', (req, res) => {
  try {
    const transferId = parseInt(req.params.id);

    if (isNaN(transferId)) {
      return res.status(400).json({
        success: false,
        error: '无效的划转ID',
      });
    }

    const result = db.prepare(`DELETE FROM transfers WHERE id = ?`).run(transferId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: '划转记录不存在',
      });
    }

    res.json({ success: true, message: '划转记录已删除' });
  } catch (error) {
    logger.error('删除划转记录失败:', error);
    res.status(500).json({ success: false, error: '删除划转记录失败' });
  }
});

class TransferError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'TransferError';
  }
}

export default router;
