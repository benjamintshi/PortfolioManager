import express from 'express';
import { InvestmentPlanService } from '../services/InvestmentPlanService';
import { logger } from '../lib/logger';

const router = express.Router();
const planService = new InvestmentPlanService();

// GET /api/plans
router.get('/', (req, res) => {
  try {
    const plans = planService.getAllPlans();
    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('获取投资计划列表失败:', error);
    res.status(500).json({ success: false, error: '获取列表失败' });
  }
});

// GET /api/plans/:id
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const plan = planService.getPlanById(id);
    if (!plan) {
      return res.status(404).json({ success: false, error: '计划不存在' });
    }
    res.json({ success: true, data: plan });
  } catch (error) {
    logger.error('获取投资计划失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// POST /api/plans
router.post('/', (req, res) => {
  try {
    const { symbol, name, category, direction, total_target_usd, status, tranches_json, stop_loss, stop_loss_note, take_profit, take_profit_note, rationale } = req.body;

    if (!symbol || !name || !category || !direction) {
      return res.status(400).json({ success: false, error: '缺少必填字段: symbol, name, category, direction' });
    }

    const validCategories = ['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ success: false, error: `category 必须为 ${validCategories.join(', ')}` });
    }

    if (!['long', 'short'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'direction 必须为 long 或 short' });
    }

    // Validate tranches_json if provided
    let tranchesStr = '[]';
    if (tranches_json) {
      try {
        const tranches = typeof tranches_json === 'string' ? JSON.parse(tranches_json) : tranches_json;
        if (!Array.isArray(tranches)) {
          return res.status(400).json({ success: false, error: 'tranches_json 必须为数组' });
        }
        tranchesStr = JSON.stringify(tranches);
      } catch {
        return res.status(400).json({ success: false, error: 'tranches_json 格式无效' });
      }
    }

    const id = planService.createPlan({
      symbol: String(symbol).toUpperCase(),
      name: String(name).trim(),
      category,
      tier: 'core',
      direction,
      total_target_usd: total_target_usd != null ? parseFloat(total_target_usd) : null,
      status: status || 'planning',
      tranches_json: tranchesStr,
      stop_loss: stop_loss != null ? parseFloat(stop_loss) : null,
      stop_loss_note: stop_loss_note || null,
      take_profit: take_profit != null ? parseFloat(take_profit) : null,
      take_profit_note: take_profit_note || null,
      rationale: rationale || null,
    });

    res.json({ success: true, data: { id } });
  } catch (error) {
    logger.error('创建投资计划失败:', error);
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

// PUT /api/plans/:id
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }

    const updates: any = {};
    const { symbol, name, category, direction, total_target_usd, status, tranches_json, stop_loss, stop_loss_note, take_profit, take_profit_note, rationale } = req.body;

    if (symbol !== undefined) updates.symbol = String(symbol).toUpperCase();
    if (name !== undefined) updates.name = String(name).trim();
    if (category !== undefined) {
      const validCategories = ['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit', 'cash'];
      if (!validCategories.includes(category)) {
        return res.status(400).json({ success: false, error: `category 必须为 ${validCategories.join(', ')}` });
      }
      updates.category = category;
    }
    if (direction !== undefined) {
      if (!['long', 'short'].includes(direction)) {
        return res.status(400).json({ success: false, error: 'direction 必须为 long 或 short' });
      }
      updates.direction = direction;
    }
    if (total_target_usd !== undefined) updates.total_target_usd = total_target_usd != null ? parseFloat(total_target_usd) : null;
    if (status !== undefined) updates.status = status;
    if (tranches_json !== undefined) {
      try {
        const tranches = typeof tranches_json === 'string' ? JSON.parse(tranches_json) : tranches_json;
        updates.tranches_json = JSON.stringify(tranches);
      } catch {
        return res.status(400).json({ success: false, error: 'tranches_json 格式无效' });
      }
    }
    if (stop_loss !== undefined) updates.stop_loss = stop_loss != null ? parseFloat(stop_loss) : null;
    if (stop_loss_note !== undefined) updates.stop_loss_note = stop_loss_note;
    if (take_profit !== undefined) updates.take_profit = take_profit != null ? parseFloat(take_profit) : null;
    if (take_profit_note !== undefined) updates.take_profit_note = take_profit_note;
    if (rationale !== undefined) updates.rationale = rationale;

    const ok = planService.updatePlan(id, updates);
    if (!ok) {
      return res.status(404).json({ success: false, error: '计划不存在或更新失败' });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    logger.error('更新投资计划失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const ok = planService.deletePlan(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: '计划不存在或删除失败' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除投资计划失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// POST /api/plans/:id/tranches/:index/execute
router.post('/:id/tranches/:index/execute', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = parseInt(req.params.index);
    if (isNaN(id) || isNaN(index)) {
      return res.status(400).json({ success: false, error: '无效的ID或批次索引' });
    }

    const { actualPrice } = req.body;
    if (actualPrice === undefined || actualPrice === null) {
      return res.status(400).json({ success: false, error: '缺少 actualPrice' });
    }
    const price = parseFloat(actualPrice);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, error: 'actualPrice 必须为正数' });
    }

    const updatedPlan = planService.executeTranche(id, index, price);
    if (!updatedPlan) {
      return res.status(404).json({ success: false, error: '计划不存在、批次索引无效或已执行' });
    }
    res.json({ success: true, data: updatedPlan });
  } catch (error) {
    logger.error('执行批次失败:', error);
    res.status(500).json({ success: false, error: '执行失败' });
  }
});

export default router;
