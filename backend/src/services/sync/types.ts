export interface SyncHolding {
  symbol: string;       // 'BTC', 'ETH', 'USDT'
  name: string;
  category: 'crypto' | 'cash';
  quantity: number;
  costPrice: number;    // 0 (API doesn't provide cost)
  costCurrency: string; // 'USD'
}
