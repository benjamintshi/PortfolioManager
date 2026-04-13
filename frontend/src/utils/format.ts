/**
 * 格式化货币金额
 */
export function formatCurrency(amount: number, currency: 'USD' | 'CNY' = 'USD', compact = false): string {
  const formatter = new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    notation: compact ? 'compact' : 'standard',
    compactDisplay: 'short'
  });

  return formatter.format(amount);
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, precision = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(precision)}%`;
}

/**
 * 格式化数字
 */
export function formatNumber(value: number, precision = 2): string {
  if (value === 0) return '0';
  
  const formatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  });

  return formatter.format(value);
}

/**
 * 格式化大数字（K, M, B）
 */
export function formatCompactNumber(value: number): string {
  const formatter = new Intl.NumberFormat('zh-CN', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1
  });

  return formatter.format(value);
}

/**
 * 格式化盈亏金额
 */
export function formatProfitLoss(amount: number, currency: 'USD' | 'CNY' = 'USD'): string {
  const sign = amount >= 0 ? '+' : '';
  const formatted = formatCurrency(Math.abs(amount), currency);
  
  return `${sign}${formatted}`;
}

/**
 * 格式化时间
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < week) {
    return `${Math.floor(diff / day)}天前`;
  } else {
    return formatTime(timestamp);
  }
}

/**
 * 格式化日期
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * 获取资产类别中文名称
 */
export function getCategoryName(category: string): string {
  const names: Record<string, string> = {
    crypto: '加密货币',
    stock: '股票基金',
    gold: '黄金',
    bond: '固定收益',
    commodity: '大宗商品',
    reit: '不动产/REITs',
    cash: '现金',
  };

  return names[category] || category;
}

/**
 * 获取交易类型中文名称
 */
export function getTransactionTypeName(type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out'): string {
  const names = {
    buy: '买入',
    sell: '卖出',
    transfer_in: '转入',
    transfer_out: '转出'
  };
  
  return names[type] || type;
}

/**
 * 获取资产类别颜色
 */
export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    crypto: '#f7931e',
    stock: '#22c55e',
    gold: '#facc15',
    bond: '#3B82F6',
    commodity: '#D97706',
    reit: '#8B5CF6',
    cash: '#6b7280',
  };

  return colors[category] || '#9CA3AF';
}

/**
 * 获取盈亏颜色类名
 */
export function getProfitColorClass(profit: number): string {
  if (profit > 0) return 'text-profit';
  if (profit < 0) return 'text-loss';
  return 'text-neutral-400';
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/**
 * 验证是否为有效数字
 */
export function isValidNumber(value: any): boolean {
  return !isNaN(value) && !isNaN(parseFloat(value)) && isFinite(value);
}

/**
 * 安全解析数字
 */
export function safeParseFloat(value: any, defaultValue = 0): number {
  const parsed = parseFloat(value);
  return isValidNumber(parsed) ? parsed : defaultValue;
}

/**
 * 计算变化百分比
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}