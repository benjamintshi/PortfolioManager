import WebSocket from 'ws';
import { logger } from '../lib/logger';
import { db } from '../database';

interface TickerData {
  price: number;
  timestamp: number;
}

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;
const PING_INTERVAL_MS = 30000;
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

/**
 * Binance WebSocket 实时价格订阅。
 * 使用 individual mini-ticker streams (<symbol>@miniTicker)，
 * 收到推送后更新内存缓存，供 PriceService 同步读取。
 */
export class BinanceWebSocket {
  private prices = new Map<string, TickerData>();
  private ws: WebSocket | null = null;
  private symbols: string[] = [];
  private reconnectDelay = RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private isShuttingDown = false;

  /**
   * 从数据库加载 crypto 资产符号并启动 WebSocket
   */
  start(): void {
    this.symbols = this.loadCryptoSymbols();
    if (this.symbols.length === 0) {
      logger.warn('[BinanceWS] 无 crypto 资产，跳过 WebSocket 连接');
      return;
    }
    logger.info(`[BinanceWS] 订阅 ${this.symbols.length} 个交易对: ${this.symbols.join(', ')}`);
    this.connect();
  }

  /**
   * 获取实时价格（同步，直接读内存）
   */
  getPrice(symbol: string): TickerData | null {
    const key = this.normalizeSymbol(symbol);
    return this.prices.get(key) ?? null;
  }

  /**
   * WebSocket 是否已连接
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 关闭连接
   */
  stop(): void {
    this.isShuttingDown = true;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('[BinanceWS] 已关闭');
  }

  /**
   * 当资产列表变更时刷新订阅
   */
  refresh(): void {
    const newSymbols = this.loadCryptoSymbols();
    if (newSymbols.join(',') === this.symbols.join(',')) return;

    this.symbols = newSymbols;
    logger.info(`[BinanceWS] 资产变更，重新订阅 ${this.symbols.length} 个交易对`);
    this.isShuttingDown = false;
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect();
  }

  private loadCryptoSymbols(): string[] {
    const stablecoins = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD']);
    const rows = db
      .prepare("SELECT DISTINCT symbol FROM assets WHERE category = 'crypto'")
      .all() as Array<{ symbol: string }>;

    return rows
      .map(r => r.symbol.replace(/USDT$/, '').toUpperCase())
      .filter(s => !stablecoins.has(s))
      .map(s => `${s}USDT`);
  }

  private normalizeSymbol(symbol: string): string {
    const base = symbol.replace(/USDT$/, '').toUpperCase();
    return `${base}USDT`;
  }

  private connect(): void {
    if (this.isShuttingDown) return;

    // 组合 stream：<symbol>@miniTicker/...
    const streams = this.symbols.map(s => `${s.toLowerCase()}@miniTicker`).join('/');
    const url = `${BINANCE_WS_BASE}/${streams}`;

    logger.debug(`[BinanceWS] 连接 ${url.substring(0, 80)}...`);
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      logger.info('[BinanceWS] 连接成功');
      this.reconnectDelay = RECONNECT_DELAY_MS;
      this.startPing();
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      this.handleMessage(data);
    });

    this.ws.on('error', (err: Error) => {
      logger.error(`[BinanceWS] 错误: ${err.message}`);
    });

    this.ws.on('close', () => {
      logger.warn('[BinanceWS] 连接断开');
      this.clearTimers();
      this.scheduleReconnect();
    });
  }

  private handleMessage(raw: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(raw.toString());
      // miniTicker 格式: { e: '24hrMiniTicker', s: 'BTCUSDT', c: '67000.00', ... }
      if (msg.e === '24hrMiniTicker' && msg.s && msg.c) {
        const price = parseFloat(msg.c);
        if (price > 0) {
          this.prices.set(msg.s, { price, timestamp: Date.now() });
        }
      }
    } catch {
      // 忽略非 JSON 消息（pong 等）
    }
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  private scheduleReconnect(): void {
    if (this.isShuttingDown) return;

    logger.info(`[BinanceWS] ${this.reconnectDelay / 1000}s 后重连...`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const binanceWs = new BinanceWebSocket();
