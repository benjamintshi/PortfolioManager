import express from 'express';
import assetsRouter from './assets';
import pricesRouter from './prices';
import portfolioRouter from './portfolio';
import rebalanceRouter from './rebalance';
import roadmapRouter from './roadmap';
import alertsRouter from './alerts';
import advisorRouter from './advisor';

const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'portfolio-manager-backend'
  });
});

// 资产管理智能体分析（直接挂载避免路由冲突）
router.post('/advisor/analyze', async (req, res) => {
  try {
    const { AdvisorAgentService } = await import('../services/AdvisorAgentService');
    const agent = new AdvisorAgentService();
    const result = await agent.runAnalysis();
    res.json({ success: true, data: result });
  } catch (error) {
    const { logger } = await import('../lib/logger');
    logger.error('智能体分析失败:', error);
    res.status(500).json({ success: false, error: '分析失败' });
  }
});

// 注册子路由
router.use('/assets', assetsRouter);
router.use('/prices', pricesRouter);
router.use('/portfolio', portfolioRouter);
router.use('/rebalance', rebalanceRouter);
router.use('/alerts', alertsRouter);
router.use('/advisor', advisorRouter);
router.use('/', roadmapRouter);

// 测试 Telegram 消息发送
router.post('/notify/test', async (req, res) => {
  try {
    const { NotificationService } = await import('../services/NotificationService');
    const notificationService = new NotificationService();
    const ok = await notificationService.testConnection();
    res.json({ success: ok, message: ok ? '测试消息已发送' : '发送失败，请检查 TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID' });
  } catch (error) {
    console.error('测试消息发送失败:', error);
    res.status(500).json({ success: false, error: '发送失败' });
  }
});

// 汇率API（简单实现）
router.get('/exchange-rate', async (req, res) => {
  try {
    const { ExchangeRateService } = await import('../services/ExchangeRateService');
    const exchangeRateService = new ExchangeRateService();
    
    const rateInfo = await exchangeRateService.getCurrentRate();
    
    res.json({
      success: true,
      data: {
        pair: 'USDCNY',
        rate: rateInfo.rate,
        timestamp: rateInfo.timestamp,
        source: rateInfo.source
      }
    });
  } catch (error) {
    console.error('获取汇率失败:', error);
    res.status(500).json({
      success: false,
      error: '获取汇率失败'
    });
  }
});

export default router;