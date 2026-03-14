import { Router, Request, Response } from 'express';
import { db } from '../database';
import { logger } from '../lib/logger';
import { AdvisorAgentService } from '../services/AdvisorAgentService';

const router = Router();
const agentService = new AdvisorAgentService();

/**
 * 触发智能体分析（手动）
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const result = await agentService.runAnalysis();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('智能体分析失败:', error);
    res.status(500).json({ success: false, error: '分析失败' });
  }
});

/**
 * 获取报告列表
 */
router.get('/reports', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const reports = db.prepare(`
      SELECT id, report_type, title, content, health_score, suggestions_json, insights_json, total_value_usd, created_at
      FROM advisor_reports
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit);

    const parsed = (reports as any[]).map(r => ({
      ...r,
      suggestions: r.suggestions_json ? JSON.parse(r.suggestions_json) : [],
      insights: r.insights_json ? JSON.parse(r.insights_json) : null,
    }));

    res.json({ success: true, data: parsed });
  } catch (error) {
    logger.error('获取报告失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

/**
 * 获取单条报告
 */
router.get('/reports/:id', (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '无效ID' });
    }
    const report = db.prepare(`
      SELECT id, report_type, title, content, health_score, suggestions_json, insights_json, total_value_usd, created_at
      FROM advisor_reports WHERE id = ?
    `).get(id) as any;

    if (!report) {
      return res.status(404).json({ success: false, error: '报告不存在' });
    }
    report.suggestions = report.suggestions_json ? JSON.parse(report.suggestions_json) : [];
    report.insights = report.insights_json ? JSON.parse(report.insights_json) : null;

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('获取报告失败:', error);
    res.status(500).json({ success: false, error: '获取失败' });
  }
});

/**
 * 提交反馈（用于自我进化）
 */
router.post('/feedback', (req: Request, res: Response) => {
  try {
    const { report_id, rating, acted_on, notes } = req.body;
    if (!report_id) {
      return res.status(400).json({ success: false, error: '缺少 report_id' });
    }
    agentService.recordFeedback(
      parseInt(report_id),
      rating ? parseInt(rating) : undefined,
      !!acted_on,
      notes
    );
    res.json({ success: true, message: '反馈已记录' });
  } catch (error) {
    logger.error('记录反馈失败:', error);
    res.status(500).json({ success: false, error: '记录失败' });
  }
});

export default router;
