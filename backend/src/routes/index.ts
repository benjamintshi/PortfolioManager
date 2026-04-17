import express from 'express';
import assetsRouter from './assets';
import pricesRouter from './prices';
import portfolioRouter from './portfolio';
import rebalanceRouter from './rebalance';
import roadmapRouter from './roadmap';
import indicatorsRouter from './indicators';
import plansRouter from './plans';
import eventsRouter from './events';
import platformsRouter from './platforms';
import holdingsRouter from './holdings';
import transfersRouter from './transfers';

const router = express.Router();

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    service: 'portfolio-manager-backend'
  });
});

// 注册子路由
router.use('/assets', assetsRouter);
router.use('/prices', pricesRouter);
router.use('/portfolio', portfolioRouter);
router.use('/rebalance', rebalanceRouter);
router.use('/indicators', indicatorsRouter);
router.use('/plans', plansRouter);
router.use('/events', eventsRouter);
router.use('/platforms', platformsRouter);
router.use('/holdings', holdingsRouter);
router.use('/transfers', transfersRouter);
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

// 汇率API
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
