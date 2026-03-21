import express from 'express';
import { PriceAlertService } from '../services/PriceAlertService';
import { ASSET_CATEGORIES } from '../database';
import { logger } from '../lib/logger';

const router = express.Router();
const alertService = new PriceAlertService();

router.get('/', (req, res) => {
  try {
    const alerts = alertService.getAll();
    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('获取价格提醒失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

router.get('/with-prices', async (req, res) => {
  try {
    const alerts = alertService.getAll();
    const { PriceService } = await import('../services/PriceService');
    const priceService = new PriceService();
    const result = await Promise.all(alerts.map(async (a) => {
      let currentPrice: number | null = null;
      try {
        const p = await priceService.getPrice(a.symbol, a.category);
        currentPrice = p?.price ?? null;
      } catch (err) {
        logger.debug(`获取 ${a.symbol} 价格失败，跳过`, err);
      }
      const triggered = currentPrice != null && (
        (a.direction === 'buy' && currentPrice <= a.trigger_price) ||
        (a.direction === 'sell' && currentPrice >= a.trigger_price)
      );
      return { ...a, currentPrice, triggered };
    }));
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('获取价格提醒失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const alert = alertService.getById(id);
    if (!alert) {
      return res.status(404).json({ success: false, error: '提醒不存在' });
    }
    res.json({ success: true, data: alert });
  } catch (error) {
    logger.error('获取价格提醒失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const { symbol, name, category, direction, trigger_price, currency, enabled, cooldown_minutes, notes } = req.body;
    if (!symbol || !name || !category || !direction || trigger_price === undefined) {
      return res.status(400).json({ success: false, error: '缺少必填字段: symbol, name, category, direction, trigger_price' });
    }
    // Alerts support all categories except cash
    const alertCategories = (ASSET_CATEGORIES as readonly string[]).filter(c => c !== 'cash');
    if (!alertCategories.includes(category)) {
      return res.status(400).json({ success: false, error: `category 必须为 ${alertCategories.join(', ')}` });
    }
    if (!['buy', 'sell'].includes(direction)) {
      return res.status(400).json({ success: false, error: 'direction 必须为 buy 或 sell' });
    }
    const price = parseFloat(trigger_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ success: false, error: 'trigger_price 必须为正数' });
    }

    const id = alertService.create({
      symbol: String(symbol).toUpperCase(),
      name: String(name).trim(),
      category,
      direction,
      trigger_price: price,
      currency: currency || 'USD',
      enabled: enabled !== undefined ? (enabled ? 1 : 0) : 1,
      cooldown_minutes: parseInt(cooldown_minutes) || 60,
      notes: notes || null,
      last_triggered_at: null
    } as any);

    res.json({ success: true, data: { id } });
  } catch (error) {
    logger.error('添加价格提醒失败:', error);
    res.status(500).json({ success: false, error: '添加失败' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const { symbol, name, category, direction, trigger_price, currency, enabled, cooldown_minutes, notes } = req.body;
    const updates: any = {};
    if (symbol !== undefined) updates.symbol = String(symbol).toUpperCase();
    if (name !== undefined) updates.name = String(name).trim();
    if (category !== undefined) {
      const alertCategories = (ASSET_CATEGORIES as readonly string[]).filter(c => c !== 'cash');
      if (!alertCategories.includes(category)) {
        return res.status(400).json({ success: false, error: `category 必须为 ${alertCategories.join(', ')}` });
      }
      updates.category = category;
    }
    if (direction !== undefined) {
      if (!['buy', 'sell'].includes(direction)) {
        return res.status(400).json({ success: false, error: 'direction 必须为 buy 或 sell' });
      }
      updates.direction = direction;
    }
    if (trigger_price !== undefined) {
      const price = parseFloat(trigger_price);
      if (isNaN(price) || price <= 0) {
        return res.status(400).json({ success: false, error: 'trigger_price 必须为正数' });
      }
      updates.trigger_price = price;
    }
    if (currency !== undefined) updates.currency = currency;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (cooldown_minutes !== undefined) updates.cooldown_minutes = parseInt(cooldown_minutes) || 60;
    if (notes !== undefined) updates.notes = notes;

    const ok = alertService.update(id, updates);
    if (!ok) {
      return res.status(404).json({ success: false, error: '提醒不存在或更新失败' });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    logger.error('更新价格提醒失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const ok = alertService.delete(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: '提醒不存在或删除失败' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除价格提醒失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

router.post('/check', async (req, res) => {
  try {
    const result = await alertService.checkAndNotify();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('检查价格提醒失败:', error);
    res.status(500).json({ success: false, error: '检查失败' });
  }
});

export default router;
