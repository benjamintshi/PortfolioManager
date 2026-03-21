import { Router, Request, Response } from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';

const router = Router();

// 获取每个指标的最新值
router.get('/', (req: Request, res: Response) => {
  try {
    const indicators = db.prepare(`
      SELECT m1.*
      FROM macro_indicators m1
      INNER JOIN (
        SELECT indicator_name, MAX(timestamp) AS max_ts
        FROM macro_indicators
        GROUP BY indicator_name
      ) m2 ON m1.indicator_name = m2.indicator_name AND m1.timestamp = m2.max_ts
      ORDER BY m1.indicator_name ASC
    `).all();

    res.json({ success: true, data: indicators });
  } catch (error) {
    logger.error('获取宏观指标失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 获取指定指标的历史数据
router.get('/:name/history', (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const days = parseInt(req.query.days as string) || 30;
    const sinceTs = Date.now() - days * 24 * 60 * 60 * 1000;

    const history = db.prepare(`
      SELECT * FROM macro_indicators
      WHERE indicator_name = ? AND timestamp >= ?
      ORDER BY timestamp ASC
    `).all(name, sinceTs);

    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('获取指标历史失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

// 记录单个指标值
router.post('/', (req: Request, res: Response) => {
  try {
    const { indicator_name, value, source } = req.body;

    if (!indicator_name || value === undefined || value === null) {
      return res.status(400).json({ success: false, error: '缺少必填字段: indicator_name, value' });
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return res.status(400).json({ success: false, error: 'value 必须为数字' });
    }

    const timestamp = Date.now();

    const result = db.prepare(`
      INSERT INTO macro_indicators (indicator_name, value, source, timestamp)
      VALUES (?, ?, ?, ?)
    `).run(indicator_name, numValue, source || null, timestamp);

    res.json({ success: true, data: { id: result.lastInsertRowid } });
  } catch (error) {
    logger.error('记录宏观指标失败:', error);
    res.status(500).json({ success: false, error: '记录失败' });
  }
});

// 批量记录指标值
router.post('/batch', (req: Request, res: Response) => {
  try {
    const { indicators } = req.body;

    if (!Array.isArray(indicators) || indicators.length === 0) {
      return res.status(400).json({ success: false, error: '缺少 indicators 数组' });
    }

    const timestamp = Date.now();
    const insert = db.prepare(`
      INSERT INTO macro_indicators (indicator_name, value, source, timestamp)
      VALUES (?, ?, ?, ?)
    `);

    const results: number[] = [];

    const insertAll = db.transaction(() => {
      for (const ind of indicators) {
        if (!ind.indicator_name || ind.value === undefined || ind.value === null) continue;
        const numValue = parseFloat(ind.value);
        if (isNaN(numValue)) continue;

        const result = insert.run(ind.indicator_name, numValue, ind.source || null, timestamp);
        results.push(result.lastInsertRowid as number);
      }
    });

    insertAll();

    res.json({ success: true, data: { inserted: results.length, ids: results } });
  } catch (error) {
    logger.error('批量记录宏观指标失败:', error);
    res.status(500).json({ success: false, error: '批量记录失败' });
  }
});

export default router;
