import crypto from 'node:crypto';
import axios, { AxiosError } from 'axios';
import { logger } from '../../lib/logger';

export interface SyncHolding {
  symbol: string;
  name: string;
  category: 'crypto' | 'cash';
  quantity: number;
  costPrice: number;
  costCurrency: string;
}

const STABLECOINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'FDUSD']);

// 现货账户中应忽略的 token（理财锁仓凭证，在 earn 子账户中已有真实数据）
const SPOT_IGNORE = new Set(['LDUSDT', 'LDBTC', 'LDETH', 'LDBNB', 'LDSOL']);

const ASSET_NAMES: Record<string, string> = {
  BTC: '比特币',
  ETH: '以太坊',
  SOL: 'Solana',
  BNB: 'BNB',
  ADA: 'Cardano',
  AVAX: 'Avalanche',
  SUI: 'Sui',
  DOT: 'Polkadot',
  XRP: 'Ripple',
  DOGE: 'Dogecoin',
  USDT: 'USDT',
  USDC: 'USDC',
  BUSD: 'BUSD',
  DAI: 'DAI',
  TUSD: 'TUSD',
  FDUSD: 'FDUSD',
  MNT: 'Mantle',
};

const REQUEST_TIMEOUT = 10000;

export class BinanceSyncAdapter {
  private baseUrl = 'https://api.binance.com';

  async syncSpot(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.request('/api/v3/account', {}, apiKey, apiSecret);
      const balances = (data.balances ?? []) as Array<{ asset: string; free: string; locked: string }>;

      return balances
        .map((b) => ({
          asset: b.asset,
          quantity: parseFloat(b.free) + parseFloat(b.locked),
        }))
        .filter((b) => b.quantity > 0 && !SPOT_IGNORE.has(b.asset))
        .map((b) => this.toHolding(b.asset, b.quantity));
    } catch (err) {
      const axErr = err as AxiosError;
      const respData = axErr.response?.data as Record<string, unknown> | undefined;
      logger.warn(`Binance spot sync failed: ${axErr.response?.status} ${JSON.stringify(respData)}`);
      return [];
    }
  }

  async syncEarn(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    const flexible = await this.fetchEarnPositions(
      '/sapi/v1/simple-earn/flexible/position',
      'totalAmount',
      apiKey,
      apiSecret,
    );
    const locked = await this.fetchEarnPositions(
      '/sapi/v1/simple-earn/locked/position',
      'amount',
      apiKey,
      apiSecret,
    );
    return [...flexible, ...locked];
  }

  private async fetchEarnPositions(
    path: string,
    amountField: string,
    apiKey: string,
    apiSecret: string,
  ): Promise<SyncHolding[]> {
    try {
      const data = await this.request(path, { size: '100' }, apiKey, apiSecret);
      const rows = (data.rows ?? []) as Array<Record<string, unknown>>;

      return rows
        .map((row) => ({
          asset: row.asset as string,
          quantity: parseFloat(String(row[amountField] ?? '0')),
        }))
        .filter((r) => r.quantity > 0)
        .map((r) => this.toHolding(r.asset, r.quantity));
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      const axErr = err as AxiosError;
      const respData = axErr.response?.data as Record<string, unknown> | undefined;
      if (status === 403) {
        logger.warn(`Binance earn endpoint ${path} returned 403 — API key may lack earn permission`);
      } else {
        logger.warn(`Binance earn sync failed for ${path}: ${status} ${JSON.stringify(respData)}`);
      }
      return [];
    }
  }

  /**
   * 合约账户持仓 (USDT-M Futures)
   * GET https://fapi.binance.com/fapi/v2/account
   * 返回 totalWalletBalance（钱包余额）+ positions（持仓）
   */
  async syncFutures(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.requestFutures('/fapi/v2/account', {}, apiKey, apiSecret);

      const holdings: SyncHolding[] = [];

      // 钱包余额（USDT 保证金）
      const walletBalance = parseFloat(String(data.totalWalletBalance ?? '0'));
      const unrealizedProfit = parseFloat(String(data.totalUnrealizedProfit ?? '0'));
      const totalBalance = walletBalance + unrealizedProfit;

      if (totalBalance > 0.01) {
        holdings.push({
          symbol: 'USDT',
          name: 'USDT (合约)',
          category: 'cash',
          quantity: totalBalance,
          costPrice: 0,
          costCurrency: 'USD',
        });
      }

      // 活跃持仓
      const positions = (data.positions ?? []) as Array<Record<string, unknown>>;
      for (const pos of positions) {
        const notional = Math.abs(parseFloat(String(pos.notional ?? '0')));
        const posAmt = parseFloat(String(pos.positionAmt ?? '0'));
        if (notional < 1 || posAmt === 0) continue;

        const symbol = String(pos.symbol ?? '').replace('USDT', '');
        holdings.push({
          symbol: `${symbol}`,
          name: `${this.getAssetName(symbol)} (合约)`,
          category: 'crypto',
          quantity: Math.abs(posAmt),
          costPrice: 0,
          costCurrency: 'USD',
        });
      }

      return holdings;
    } catch (err) {
      const axErr = err as AxiosError;
      const respData = axErr.response?.data as Record<string, unknown> | undefined;
      logger.warn(`Binance futures sync failed: ${axErr.response?.status} ${JSON.stringify(respData)}`);
      return [];
    }
  }

  private async requestFutures(
    path: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ): Promise<Record<string, unknown>> {
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();

    const allParams: Record<string, string> = {
      ...params,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };

    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', trimmedSecret)
      .update(queryString)
      .digest('hex');

    const url = `https://fapi.binance.com${path}?${queryString}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': trimmedKey },
      timeout: REQUEST_TIMEOUT,
    });
    return response.data;
  }

  private async request(
    path: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ): Promise<Record<string, unknown>> {
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();

    // Binance 签名规范：
    // 1. 拼接所有参数为 query string（不 URL encode，不排序）
    // 2. 加 timestamp + recvWindow
    // 3. HMAC-SHA256 签名
    // 4. 把 signature 追加到 query string
    const allParams: Record<string, string> = {
      ...params,
      recvWindow: '5000',
      timestamp: String(Date.now()),
    };

    const queryString = Object.entries(allParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', trimmedSecret)
      .update(queryString)
      .digest('hex');

    const url = `${this.baseUrl}${path}?${queryString}&signature=${signature}`;

    const response = await axios.get(url, {
      headers: { 'X-MBX-APIKEY': trimmedKey },
      timeout: REQUEST_TIMEOUT,
    });
    return response.data;
  }

  private isStablecoin(asset: string): boolean {
    return STABLECOINS.has(asset.toUpperCase());
  }

  private getAssetName(asset: string): string {
    return ASSET_NAMES[asset.toUpperCase()] ?? asset;
  }

  private toHolding(asset: string, quantity: number): SyncHolding {
    return {
      symbol: asset,
      name: this.getAssetName(asset),
      category: this.isStablecoin(asset) ? 'cash' : 'crypto',
      quantity,
      costPrice: 0,
      costCurrency: 'USD',
    };
  }
}
