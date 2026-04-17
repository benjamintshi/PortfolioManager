import crypto from 'node:crypto';
import axios from 'axios';
import { logger } from '../../lib/logger';
import type { SyncHolding } from './types';

const RECV_WINDOW = '5000';
const REQUEST_TIMEOUT = 10000;

const STABLECOINS = new Set([
  'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'USDD',
]);

const COIN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  DOT: 'Polkadot',
  AVAX: 'Avalanche',
  MATIC: 'Polygon',
  LINK: 'Chainlink',
  UNI: 'Uniswap',
  ATOM: 'Cosmos',
  LTC: 'Litecoin',
  FIL: 'Filecoin',
  ARB: 'Arbitrum',
  OP: 'Optimism',
  APT: 'Aptos',
  SUI: 'Sui',
  NEAR: 'NEAR Protocol',
  USDT: 'Tether',
  USDC: 'USD Coin',
  DAI: 'Dai',
  BUSD: 'Binance USD',
  TUSD: 'TrueUSD',
  FDUSD: 'First Digital USD',
  USDD: 'USDD',
  USDP: 'Pax Dollar',
};

interface UnifiedWalletResponse {
  retCode: number;
  retMsg: string;
  result: {
    list: Array<{
      accountType: string;
      coin: Array<{
        coin: string;
        walletBalance: string;
        equity: string;
      }>;
    }>;
  };
}

interface FundingAssetResponse {
  retCode: number;
  retMsg: string;
  result: {
    spot: {
      assets: Array<{
        coin: string;
        free: string;
        frozen: string;
      }>;
    };
  };
}

export class BybitSyncAdapter {
  private baseUrl = 'https://api.bybit.com';

  async syncUnified(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.request<UnifiedWalletResponse>(
        '/v5/account/wallet-balance',
        { accountType: 'UNIFIED' },
        apiKey,
        apiSecret,
      );

      if (data.retCode !== 0) {
        logger.error(`Bybit unified account error: ${data.retMsg}`);
        return [];
      }

      const account = data.result.list[0];
      if (!account) {
        logger.warn('Bybit unified account: no account data returned');
        return [];
      }

      const holdings: SyncHolding[] = [];

      for (const coin of account.coin) {
        const quantity = parseFloat(coin.walletBalance);
        if (quantity <= 0 || isNaN(quantity)) continue;

        holdings.push({
          symbol: coin.coin,
          name: this.getCoinName(coin.coin),
          category: this.isStablecoin(coin.coin) ? 'cash' : 'crypto',
          quantity,
          costPrice: 0,
          costCurrency: 'USD',
        });
      }

      logger.info(`Bybit unified sync: ${holdings.length} holdings`);
      return holdings;
    } catch (error) {
      logger.error('Bybit unified sync failed', error);
      return [];
    }
  }

  /**
   * 资金账户 — 用 wallet-balance FUND 类型
   */
  async syncFunding(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.request<UnifiedWalletResponse>(
        '/v5/account/wallet-balance',
        { accountType: 'FUND' },
        apiKey,
        apiSecret,
      );

      if (data.retCode !== 0) {
        logger.error(`Bybit funding account error: ${data.retMsg}`);
        return [];
      }

      const holdings: SyncHolding[] = [];
      const accounts = data.result?.list ?? [];

      for (const account of accounts) {
        const coins = account.coin ?? [];
        for (const coin of coins) {
          const quantity = parseFloat(coin.walletBalance ?? '0');
          if (quantity <= 0 || isNaN(quantity)) continue;

          holdings.push({
            symbol: coin.coin,
            name: this.getCoinName(coin.coin),
            category: this.isStablecoin(coin.coin) ? 'cash' : 'crypto',
            quantity,
            costPrice: 0,
            costCurrency: 'USD',
          });
        }
      }

      logger.info(`Bybit funding sync: ${holdings.length} holdings`);
      return holdings;
    } catch (error: any) {
      // FUND accountType 可能不被支持，用 all-coins-balance fallback
      logger.warn(`Bybit funding sync failed: ${error.response?.data?.retMsg || error.message}`);
      return this.syncFundingFallback(apiKey, apiSecret);
    }
  }

  /**
   * 资金账户 fallback — 用 /v5/asset/transfer/query-asset-info
   */
  private async syncFundingFallback(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.request<any>(
        '/v5/asset/coin/query-info',
        {},
        apiKey,
        apiSecret,
      );

      if (data.retCode !== 0) {
        logger.warn(`Bybit funding fallback error: ${data.retMsg}`);
        return [];
      }

      // 不同端点返回格式不同，尝试解析
      const rows = data.result?.rows ?? data.result ?? [];
      if (!Array.isArray(rows)) return [];

      const holdings: SyncHolding[] = [];
      for (const row of rows) {
        const coin = row.coin || row.currency;
        const qty = parseFloat(row.walletBalance || row.availableAmount || row.free || '0');
        if (!coin || qty <= 0) continue;
        holdings.push({
          symbol: coin,
          name: this.getCoinName(coin),
          category: this.isStablecoin(coin) ? 'cash' : 'crypto',
          quantity: qty,
          costPrice: 0,
          costCurrency: 'USD',
        });
      }

      logger.info(`Bybit funding fallback: ${holdings.length} holdings`);
      return holdings;
    } catch (error: any) {
      logger.warn(`Bybit funding fallback also failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 理财账户 — Bybit Earn 产品
   */
  async syncEarn(apiKey: string, apiSecret: string): Promise<SyncHolding[]> {
    try {
      const data = await this.request<any>(
        '/v5/earn/position',
        {},
        apiKey,
        apiSecret,
      );

      if (data.retCode !== 0) {
        logger.warn(`Bybit earn error: ${data.retMsg}`);
        return [];
      }

      const rows = data.result?.list ?? [];
      const holdings: SyncHolding[] = [];

      for (const row of rows) {
        const coin = row.coin || row.coinType;
        const qty = parseFloat(row.quantity || row.holdAmount || '0');
        if (!coin || qty <= 0) continue;
        holdings.push({
          symbol: coin,
          name: `${this.getCoinName(coin)} (理财)`,
          category: this.isStablecoin(coin) ? 'cash' : 'crypto',
          quantity: qty,
          costPrice: 0,
          costCurrency: 'USD',
        });
      }

      logger.info(`Bybit earn sync: ${holdings.length} holdings`);
      return holdings;
    } catch (error: any) {
      logger.warn(`Bybit earn sync failed: ${error.response?.data?.retMsg || error.message}`);
      return [];
    }
  }

  private sign(
    timestamp: string,
    apiKey: string,
    recvWindow: string,
    queryString: string,
    apiSecret: string,
  ): string {
    const signString = `${timestamp}${apiKey}${recvWindow}${queryString}`;
    return crypto.createHmac('sha256', apiSecret).update(signString).digest('hex');
  }

  private async request<T>(
    path: string,
    params: Record<string, string>,
    apiKey: string,
    apiSecret: string,
  ): Promise<T> {
    const trimmedKey = apiKey.trim();
    const trimmedSecret = apiSecret.trim();
    const timestamp = Date.now().toString();
    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(timestamp, trimmedKey, RECV_WINDOW, queryString, trimmedSecret);

    const response = await axios.get<T>(`${this.baseUrl}${path}`, {
      params,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'X-BAPI-API-KEY': trimmedKey,
        'X-BAPI-SIGN': signature,
        'X-BAPI-SIGN-TYPE': '2',
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      },
    });

    return response.data;
  }

  private isStablecoin(coin: string): boolean {
    return STABLECOINS.has(coin);
  }

  private getCoinName(coin: string): string {
    return COIN_NAMES[coin] ?? coin;
  }
}
