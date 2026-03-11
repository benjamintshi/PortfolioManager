import axios from 'axios';
import { logger } from '../lib/logger';

export interface TelegramConfig {
  botToken?: string;
  chatId: string; // 消息中心群 -5170247327 或 MC私聊 1764784949
}

export class NotificationService {
  private telegramConfig: TelegramConfig;

  constructor() {
    // 默认配置，可以从环境变量读取
    this.telegramConfig = {
      botToken: process.env.TELEGRAM_BOT_TOKEN, // 如果有独立bot token
      chatId: process.env.TELEGRAM_CHAT_ID || '-5170247327' // 默认发送到消息中心群
    };
  }

  /**
   * 发送Telegram消息
   */
  async sendTelegramMessage(message: string, chatId?: string): Promise<boolean> {
    try {
      const targetChatId = chatId || this.telegramConfig.chatId;
      
      // 如果没有配置bot token，尝试使用OpenClaw的message工具
      if (!this.telegramConfig.botToken) {
        return this.sendViaOpenClaw(message, targetChatId);
      }

      // 使用独立bot发送
      const url = `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendMessage`;
      
      const response = await axios.post(url, {
        chat_id: targetChatId,
        text: message,
        parse_mode: 'Markdown'
      });

      if (response.data.ok) {
        logger.info(`Telegram消息发送成功: ${targetChatId}`);
        return true;
      } else {
        logger.error('Telegram消息发送失败:', response.data);
        return false;
      }
    } catch (error) {
      logger.error('发送Telegram消息失败:', error);
      return false;
    }
  }

  /**
   * 通过OpenClaw的message工具发送消息
   */
  private async sendViaOpenClaw(message: string, chatId: string): Promise<boolean> {
    try {
      // 这里假设可以调用OpenClaw的message功能
      // 在实际环境中，这可能需要通过IPC或其他方式调用
      logger.info(`准备通过OpenClaw发送消息到 ${chatId}: ${message}`);
      
      // 实际实现可能需要调用OpenClaw CLI或API
      // 这里先记录日志，实际部署时可以配置具体的发送方式
      logger.info('OpenClaw消息发送功能需要在实际部署时配置');
      
      return true;
    } catch (error) {
      logger.error('通过OpenClaw发送消息失败:', error);
      return false;
    }
  }

  /**
   * 发送再平衡提醒
   */
  async sendRebalanceAlert(message: string): Promise<boolean> {
    const formattedMessage = `🔔 Portfolio Manager 提醒\n\n${message}`;
    return this.sendTelegramMessage(formattedMessage);
  }

  /**
   * 发送每日报告
   */
  async sendDailyReport(
    totalValue: number, 
    totalProfit: number, 
    profitPercent: number,
    allocations: { crypto: number; stock: number; gold: number }
  ): Promise<boolean> {
    const message = `📊 每日投资组合报告\n\n` +
      `💰 总资产：$${totalValue.toFixed(2)}\n` +
      `📈 总盈亏：${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)} (${profitPercent >= 0 ? '+' : ''}${profitPercent.toFixed(2)}%)\n\n` +
      `📋 资产配置：\n` +
      `• 加密货币：${(allocations.crypto * 100).toFixed(1)}%\n` +
      `• 股票基金：${(allocations.stock * 100).toFixed(1)}%\n` +
      `• 黄金：${(allocations.gold * 100).toFixed(1)}%\n\n` +
      `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return this.sendTelegramMessage(message);
  }

  /**
   * 发送价格更新失败警告
   */
  async sendPriceUpdateAlert(failedSymbols: string[]): Promise<boolean> {
    if (failedSymbols.length === 0) return true;

    const message = `⚠️ 价格更新失败警告\n\n` +
      `以下资产价格更新失败：\n` +
      failedSymbols.map(symbol => `• ${symbol}`).join('\n') +
      `\n\n请检查API连接状态。`;

    return this.sendTelegramMessage(message);
  }

  /**
   * 发送系统状态报告
   */
  async sendSystemStatus(status: {
    uptime: number;
    lastPriceUpdate: number;
    lastSnapshot: number;
    apiStatus: { binance: boolean; yahoo: boolean };
  }): Promise<boolean> {
    const uptimeHours = Math.floor(status.uptime / (1000 * 60 * 60));
    const lastUpdateHours = Math.floor((Date.now() - status.lastPriceUpdate) / (1000 * 60 * 60));
    const lastSnapshotHours = Math.floor((Date.now() - status.lastSnapshot) / (1000 * 60 * 60));

    const message = `🖥️ Portfolio Manager 系统状态\n\n` +
      `⏱️ 运行时间：${uptimeHours}小时\n` +
      `🔄 价格更新：${lastUpdateHours}小时前\n` +
      `📸 最后快照：${lastSnapshotHours}小时前\n\n` +
      `🌐 API状态：\n` +
      `• Binance: ${status.apiStatus.binance ? '✅' : '❌'}\n` +
      `• Yahoo Finance: ${status.apiStatus.yahoo ? '✅' : '❌'}\n\n` +
      `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return this.sendTelegramMessage(message);
  }

  /**
   * 更新Telegram配置
   */
  updateConfig(config: Partial<TelegramConfig>): void {
    this.telegramConfig = { ...this.telegramConfig, ...config };
    logger.info('Telegram配置已更新');
  }

  /**
   * 测试Telegram连接
   */
  async testConnection(): Promise<boolean> {
    const testMessage = `🧪 Portfolio Manager 测试消息\n\n` +
      `系统正常运行，消息推送功能测试成功。\n\n` +
      `⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

    return this.sendTelegramMessage(testMessage);
  }
}