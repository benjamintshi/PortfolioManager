import { db } from '../database';
import { PriceService } from './PriceService';
import { NotificationService } from './NotificationService';
import { logger } from '../lib/logger';

export interface PriceAlert {
  id: number;
  symbol: string;
  name: string;
  category: string;
  direction: 'buy' | 'sell';
  trigger_price: number;
  currency: string;
  enabled: number;
  cooldown_minutes: number;
  last_triggered_at: number | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

export class PriceAlertService {
  private priceService: PriceService;
  private notificationService: NotificationService;

  constructor() {
    this.priceService = new PriceService();
    this.notificationService = new NotificationService();
  }

  getAll(): PriceAlert[] {
    const stmt = db.prepare(`
      SELECT * FROM price_alerts ORDER BY category, symbol, direction
    `);
    return stmt.all() as PriceAlert[];
  }

  getById(id: number): PriceAlert | null {
    const stmt = db.prepare('SELECT * FROM price_alerts WHERE id = ?');
    return (stmt.get(id) as PriceAlert) || null;
  }

  create(alert: Omit<PriceAlert, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = db.prepare(`
      INSERT INTO price_alerts (symbol, name, category, direction, trigger_price, currency, enabled, cooldown_minutes, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      alert.symbol,
      alert.name,
      alert.category,
      alert.direction,
      alert.trigger_price,
      alert.currency || 'USD',
      alert.enabled !== undefined ? alert.enabled : 1,
      alert.cooldown_minutes || 60,
      alert.notes || null
    );
    return result.lastInsertRowid as number;
  }

  update(id: number, updates: Partial<PriceAlert>): boolean {
    const allowed = ['symbol', 'name', 'category', 'direction', 'trigger_price', 'currency', 'enabled', 'cooldown_minutes', 'notes'];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowed.includes(key) && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value as any);
      }
    }
    if (fields.length === 0) return false;

    fields.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE price_alerts SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  delete(id: number): boolean {
    const stmt = db.prepare('DELETE FROM price_alerts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * 检查所有启用的价格提醒，触发则发通知
   */
  async checkAndNotify(): Promise<{ triggered: number; notified: string[] }> {
    const alerts = this.getAll().filter(a => a.enabled === 1);
    const notified: string[] = [];
    let triggered = 0;

    const now = Date.now();
    const cooldownMs = (minutes: number) => minutes * 60 * 1000;

    for (const alert of alerts) {
      try {
        const priceData = await this.priceService.getPrice(alert.symbol, alert.category);
        if (!priceData || priceData.price <= 0) continue;

        const currentPrice = priceData.price;
        const currency = priceData.currency || alert.currency;
        const symbol = alert.symbol;

        let shouldTrigger = false;
        if (alert.direction === 'buy') {
          shouldTrigger = currentPrice <= alert.trigger_price;
        } else {
          shouldTrigger = currentPrice >= alert.trigger_price;
        }

        if (!shouldTrigger) continue;

        const lastTriggered = alert.last_triggered_at;
        if (lastTriggered && (now - lastTriggered) < cooldownMs(alert.cooldown_minutes)) {
          continue;
        }

        const action = alert.direction === 'buy' ? '做T买入' : '做T卖出';
        const priceStr = currency === 'CNY' ? `¥${alert.trigger_price}` : `$${alert.trigger_price}`;
        const currentStr = currency === 'CNY' ? `¥${currentPrice.toFixed(4)}` : `$${currentPrice.toFixed(2)}`;

        const message = `🔔 价格提醒\n\n` +
          `【${alert.name} (${symbol})】${action}时机\n` +
          `触发价: ${priceStr}\n` +
          `当前价: ${currentStr}\n` +
          `${alert.notes ? `备注: ${alert.notes}\n` : ''}` +
          `\n⏰ ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`;

        const sent = await this.notificationService.sendTelegramMessage(message);
        if (sent) {
          notified.push(`${symbol} ${action}`);
          triggered++;
          db.prepare('UPDATE price_alerts SET last_triggered_at = ?, updated_at = ? WHERE id = ?')
            .run(now, now, alert.id);
          logger.info(`价格提醒已发送: ${alert.name} ${action} @ ${currentStr}`);
        }
      } catch (err) {
        logger.error(`检查价格提醒失败 ${alert.symbol}:`, err);
      }
    }

    return { triggered, notified };
  }
}
