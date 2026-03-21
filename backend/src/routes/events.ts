import { Router, Request, Response } from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';

const router = Router();

// GET /api/events - 获取所有宏观事件
router.get('/', (req: Request, res: Response) => {
  try {
    const upcoming = req.query.upcoming === 'true';

    let sql = 'SELECT * FROM macro_events';
    const params: string[] = [];

    if (upcoming) {
      const today = new Date().toISOString().slice(0, 10);
      sql += ' WHERE event_date >= ?';
      params.push(today);
    }

    sql += ' ORDER BY event_date ASC';

    const events = db.prepare(sql).all(...params);
    res.json({ success: true, data: events });
  } catch (error) {
    logger.error('获取宏观事件列表失败:', error);
    res.status(500).json({ success: false, error: '获取列表失败' });
  }
});

// GET /api/events/:id - 获取单个事件
router.get('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }

    const event = db.prepare('SELECT * FROM macro_events WHERE id = ?').get(id);
    if (!event) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error('获取宏观事件失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// POST /api/events - 创建事件
router.post('/', (req: Request, res: Response) => {
  try {
    const { event_name, event_date, event_type, importance, affected_assets, expected_impact, actual_result, notes } = req.body;

    if (!event_name || !event_date) {
      return res.status(400).json({ success: false, error: '缺少必填字段: event_name, event_date' });
    }

    const validTypes = ['data', 'policy', 'earnings', 'geopolitical', 'other'];
    const type = event_type || 'data';
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, error: `event_type 必须为 ${validTypes.join(', ')}` });
    }

    const validImportance = ['high', 'medium', 'low'];
    const imp = importance || 'medium';
    if (!validImportance.includes(imp)) {
      return res.status(400).json({ success: false, error: `importance 必须为 ${validImportance.join(', ')}` });
    }

    const result = db.prepare(`
      INSERT INTO macro_events (event_name, event_date, event_type, importance, affected_assets, expected_impact, actual_result, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event_name.trim(),
      event_date,
      type,
      imp,
      affected_assets || null,
      expected_impact || null,
      actual_result || null,
      notes || null
    );

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    logger.error('创建宏观事件失败:', error);
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

// PUT /api/events/:id - 更新事件
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }

    const existing = db.prepare('SELECT * FROM macro_events WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }

    const fields: string[] = [];
    const values: any[] = [];
    const { event_name, event_date, event_type, importance, affected_assets, expected_impact, actual_result, notes } = req.body;

    if (event_name !== undefined) { fields.push('event_name = ?'); values.push(event_name.trim()); }
    if (event_date !== undefined) { fields.push('event_date = ?'); values.push(event_date); }
    if (event_type !== undefined) {
      const validTypes = ['data', 'policy', 'earnings', 'geopolitical', 'other'];
      if (!validTypes.includes(event_type)) {
        return res.status(400).json({ success: false, error: `event_type 必须为 ${validTypes.join(', ')}` });
      }
      fields.push('event_type = ?'); values.push(event_type);
    }
    if (importance !== undefined) {
      const validImportance = ['high', 'medium', 'low'];
      if (!validImportance.includes(importance)) {
        return res.status(400).json({ success: false, error: `importance 必须为 ${validImportance.join(', ')}` });
      }
      fields.push('importance = ?'); values.push(importance);
    }
    if (affected_assets !== undefined) { fields.push('affected_assets = ?'); values.push(affected_assets || null); }
    if (expected_impact !== undefined) { fields.push('expected_impact = ?'); values.push(expected_impact || null); }
    if (actual_result !== undefined) { fields.push('actual_result = ?'); values.push(actual_result || null); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes || null); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }

    values.push(id);
    db.prepare(`UPDATE macro_events SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    logger.error('更新宏观事件失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// DELETE /api/events/:id - 删除事件
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }

    const result = db.prepare('DELETE FROM macro_events WHERE id = ?').run(id);
    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: '事件不存在' });
    }

    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    logger.error('删除宏观事件失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

export default router;
