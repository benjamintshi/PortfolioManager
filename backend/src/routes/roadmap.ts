import { Router, Request, Response } from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';

const router = Router();

// 获取所有roadmap计划
router.get('/roadmap', (req: Request, res: Response) => {
  try {
    const items = db.prepare(`
      SELECT * FROM rebalance_roadmap ORDER BY 
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
        created_at ASC
    `).all();
    
    // 按phase分组
    const grouped: Record<string, any[]> = {};
    for (const item of items as any[]) {
      if (!grouped[item.phase]) grouped[item.phase] = [];
      grouped[item.phase].push(item);
    }
    
    res.json({ success: true, data: { items, grouped } });
  } catch (error) {
    logger.error('获取roadmap失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 添加roadmap项
router.post('/roadmap', (req: Request, res: Response) => {
  try {
    const { phase, priority, action, category, target_amount, target_currency, reason, deadline } = req.body;
    
    if (!phase || !priority || !action) {
      return res.status(400).json({ success: false, error: '缺少必填字段' });
    }
    
    const result = db.prepare(`
      INSERT INTO rebalance_roadmap (phase, priority, action, category, target_amount, target_currency, reason, deadline)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(phase, priority, action, category || null, target_amount || null, target_currency || 'USD', reason || null, deadline || null);
    
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    logger.error('添加roadmap失败:', error);
    res.status(500).json({ success: false, error: '添加失败' });
  }
});

// 更新roadmap状态（执行记录）
router.put('/roadmap/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, execution_notes } = req.body;
    
    const updates: string[] = ['updated_at = ?'];
    const values: any[] = [Date.now()];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'done') {
        updates.push('executed_at = ?');
        values.push(Date.now());
      }
    }
    if (execution_notes) {
      updates.push('execution_notes = ?');
      values.push(execution_notes);
    }
    
    values.push(id);
    
    const result = db.prepare(`UPDATE rebalance_roadmap SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    
    res.json({ success: true, data: { changes: result.changes } });
  } catch (error) {
    logger.error('更新roadmap失败:', error);
    res.status(500).json({ success: false, error: '更新失败' });
  }
});

// 删除roadmap项
router.delete('/roadmap/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM rebalance_roadmap WHERE id = ?').run(req.params.id);
    res.json({ success: true, data: { changes: result.changes } });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// 获取advisor报告
router.get('/advisor/reports', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const reports = db.prepare('SELECT * FROM advisor_reports ORDER BY created_at DESC LIMIT ?').all(limit);
    res.json({ success: true, data: reports });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 保存advisor报告
router.post('/advisor/reports', (req: Request, res: Response) => {
  try {
    const { report_type, title, content, health_score, market_fg, market_vix, total_value_usd } = req.body;
    
    const result = db.prepare(`
      INSERT INTO advisor_reports (report_type, title, content, health_score, market_fg, market_vix, total_value_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(report_type, title, content, health_score || null, market_fg || null, market_vix || null, total_value_usd || null);
    
    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    res.status(500).json({ success: false, error: '保存失败' });
  }
});

export default router;
