import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { initDatabase } from './database';
import { logger } from './lib/logger';
import apiRoutes from './routes';
import { PriceService } from './services/PriceService';
import { PortfolioService } from './services/PortfolioService';
import { RebalanceService } from './services/RebalanceService';
import { NotificationService } from './services/NotificationService';
import { binanceWs } from './services/BinanceWebSocket';
import { MacroIndicatorService } from './services/MacroIndicatorService';

const app = express();
const port = process.env.PORT || 6002;

// 中间件
app.use(cors({
  origin: ['http://localhost:3007', 'http://127.0.0.1:3007'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body
  });
  next();
});

// API路由
app.use('/api', apiRoutes);

// 根路径
app.get('/', (req, res) => {
  res.json({
    service: 'Portfolio Manager Backend',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    docs: '/api/health'
  });
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('未处理的错误:', err);
  
  res.status(500).json({
    success: false,
    error: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// 服务实例
let priceService: PriceService;
let portfolioService: PortfolioService;
let rebalanceService: RebalanceService;
let notificationService: NotificationService;
let macroIndicatorService: MacroIndicatorService;

// 初始化服务
function initServices() {
  priceService = new PriceService();
  portfolioService = new PortfolioService();
  rebalanceService = new RebalanceService();
  notificationService = new NotificationService();
  macroIndicatorService = new MacroIndicatorService();

  logger.info('服务初始化完成');
}

// 定时任务
function setupCronJobs() {
  // 每5分钟更新crypto价格，并检查价格提醒
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.debug('开始更新加密货币价格');
      await priceService.updateAllPrices();
    } catch (error) {
      logger.error('定时更新加密货币价格失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每15分钟更新股票/黄金价格
  cron.schedule('*/15 * * * *', async () => {
    try {
      logger.debug('开始更新股票/黄金价格');
      await priceService.updateAllPrices();
    } catch (error) {
      logger.error('定时更新股票/黄金价格失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每小时更新汇率
  cron.schedule('0 * * * *', async () => {
    try {
      logger.debug('开始更新汇率');
      // 汇率会在需要时自动更新，这里只是触发一次
    } catch (error) {
      logger.error('定时更新汇率失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每2小时更新宏观指标
  cron.schedule('0 */2 * * *', async () => {
    try {
      await macroIndicatorService.fetchAll();
    } catch (error) {
      logger.error('定时更新宏观指标失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每天00:00生成组合快照
  cron.schedule('0 0 * * *', async () => {
    try {
      logger.info('开始生成每日快照');
      await portfolioService.generateDailySnapshot();
    } catch (error) {
      logger.error('生成每日快照失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每天08:00检查再平衡提醒
  cron.schedule('0 8 * * *', async () => {
    try {
      logger.info('检查再平衡提醒');
      const alert = await rebalanceService.checkRebalanceAlert();
      
      if (alert.needsAlert) {
        await notificationService.sendRebalanceAlert(alert.message);
        logger.info('发送再平衡提醒');
      } else {
        logger.debug('无需发送再平衡提醒');
      }
    } catch (error) {
      logger.error('检查再平衡提醒失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  // 每天21:00发送每日报告
  cron.schedule('0 21 * * *', async () => {
    try {
      logger.info('发送每日报告');
      
      const summary = await portfolioService.getPortfolioSummary();
      
      await notificationService.sendDailyReport(
        summary.totalValueUsd,
        summary.totalProfitUsd,
        summary.totalProfitPercent,
        {
          crypto: summary.categories.crypto.percentage / 100,
          stock: summary.categories.stock.percentage / 100,
          gold: summary.categories.gold.percentage / 100
        }
      );
    } catch (error) {
      logger.error('发送每日报告失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });

  logger.info('定时任务设置完成');
}

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    initDatabase();
    
    // 初始化服务
    initServices();
    
    // 设置定时任务
    setupCronJobs();
    
    // 启动 Binance WebSocket 实时价格
    binanceWs.start();

    // 启动HTTP服务器
    app.listen(port, () => {
      logger.info(`Portfolio Manager Backend 启动成功`);
      logger.info(`服务地址: http://localhost:${port}`);
      logger.info(`API文档: http://localhost:${port}/api/health`);
      
      // 启动后立即更新一次价格和宏观指标
      setTimeout(() => {
        priceService.updateAllPrices().catch(error => {
          logger.error('初始价格更新失败:', error);
        });
        macroIndicatorService.fetchAll().catch(error => {
          logger.error('初始宏观指标采集失败:', error);
        });
      }, 5000);
    });
    
  } catch (error) {
    logger.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 优雅退出处理
function setupGracefulShutdown() {
  const shutdown = (signal: string) => {
    logger.info(`收到 ${signal} 信号，开始优雅退出...`);
    binanceWs.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 启动应用
if (require.main === module) {
  setupGracefulShutdown();
  startServer();
}

export default app;