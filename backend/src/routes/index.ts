import express from 'express';
import assetsRouter from './assets';
import pricesRouter from './prices';
import portfolioRouter from './portfolio';
import rebalanceRouter from './rebalance';
import roadmapRouter from './roadmap';

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
router.use('/', roadmapRouter);

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