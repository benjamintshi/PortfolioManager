import { useState, useCallback } from 'react';
import axios, { AxiosResponse, AxiosError } from 'axios';

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// API状态类型
export interface ApiState<T = any> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// 创建axios实例
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 这里可以添加认证token等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    // 统一错误处理
    const message = error.response?.data?.error || error.message || '网络错误';
    console.error('API Error:', message, error);
    return Promise.reject(new Error(message));
  }
);

/**
 * 通用API Hook
 */
export function useApi<T = any>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async <R = T>(
    apiCall: () => Promise<AxiosResponse<ApiResponse<R>>>
  ): Promise<R | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await apiCall();
      
      if (response.data.success) {
        setState({
          data: response.data.data as any,
          loading: false,
          error: null,
        });
        return response.data.data as R;
      } else {
        throw new Error(response.data.error || '请求失败');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * 资产相关API
 */
export const assetsApi = {
  // 获取所有资产
  getAll: () => api.get<ApiResponse>('/assets'),
  
  // 添加资产
  create: (asset: {
    category: string;
    symbol: string;
    name: string;
    quantity: number;
    costPrice: number;
    costCurrency?: string;
    notes?: string;
  }) => api.post<ApiResponse>('/assets', asset),
  
  // 更新资产
  update: (id: number, updates: any) => 
    api.put<ApiResponse>(`/assets/${id}`, updates),
  
  // 删除资产
  delete: (id: number) => api.delete<ApiResponse>(`/assets/${id}`),
  
  // 获取交易历史
  getTransactions: (id: number, limit?: number) => 
    api.get<ApiResponse>(`/assets/${id}/transactions`, { params: { limit } }),
  
  // 记录交易
  createTransaction: (id: number, transaction: {
    type: 'buy' | 'sell' | 'transfer_in' | 'transfer_out';
    quantity: number;
    price: number;
    currency?: string;
    fee?: number;
    notes?: string;
    executedAt?: number;
  }) => api.post<ApiResponse>(`/assets/${id}/transactions`, transaction),
};

/**
 * 价格相关API
 */
export const pricesApi = {
  // 获取所有价格
  getAll: () => api.get<ApiResponse>('/prices'),
  
  // 获取单个价格
  getPrice: (symbol: string, category: string) =>
    api.get<ApiResponse>(`/prices/${symbol}`, { params: { category } }),
  
  // 获取历史价格
  getHistory: (symbol: string, days?: number) =>
    api.get<ApiResponse>(`/prices/history/${symbol}`, { params: { days } }),
  
  // 手动更新价格
  updatePrices: () => api.post<ApiResponse>('/prices/update'),
  
  // 获取缓存统计
  getCacheStats: () => api.get<ApiResponse>('/prices/cache/stats'),
  
  // 清理缓存
  cleanupCache: (days?: number) => 
    api.delete<ApiResponse>('/prices/cache/cleanup', { params: { days } }),
};

/**
 * 组合相关API
 */
export const portfolioApi = {
  // 获取组合概览
  getSummary: () => api.get<ApiResponse>('/portfolio/summary'),
  
  // 获取组合历史
  getHistory: (days?: number) =>
    api.get<ApiResponse>('/portfolio/history', { params: { days } }),

  // 生成快照
  createSnapshot: () => api.post<ApiResponse>('/portfolio/snapshot'),

  // 获取统计信息
  getStats: () => api.get<ApiResponse>('/portfolio/stats'),
};

/**
 * 再平衡相关API
 */
export const rebalanceApi = {
  // 获取配置
  getConfig: () => api.get<ApiResponse>('/rebalance/config'),
  
  // 更新配置
  updateConfig: (config: {
    targets?: Record<string, number>;
    threshold?: number;
    // legacy fields
    cryptoTarget?: number;
    stockTarget?: number;
    goldTarget?: number;
    crypto?: number;
    stock?: number;
    gold?: number;
  }) => api.put<ApiResponse>('/rebalance/config', config),
  
  // 获取建议
  getSuggestions: () => api.get<ApiResponse>('/rebalance/suggest'),
  
  // 获取历史
  getHistory: (limit?: number) => 
    api.get<ApiResponse>('/rebalance/history', { params: { limit } }),
  
  // 记录执行
  execute: (notes?: string) => 
    api.post<ApiResponse>('/rebalance/execute', { notes }),
  
  // 更新执行结果
  updateResult: (id: number, result: Record<string, number>) =>
    api.put<ApiResponse>(`/rebalance/execute/${id}`, result),

  // 检查警告
  checkAlert: () => api.get<ApiResponse>('/rebalance/check'),
};

/**
 * 路线图 API
 */
export const roadmapApi = {
  getRoadmap: () => api.get<ApiResponse>('/roadmap'),
  addItem: (item: { phase: string; priority: string; action: string; category?: string; target_amount?: number; target_currency?: string; reason?: string; deadline?: string }) =>
    api.post<ApiResponse>('/roadmap', item),
  updateItem: (id: number, updates: { status?: string; execution_notes?: string }) =>
    api.put<ApiResponse>(`/roadmap/${id}`, updates),
  deleteItem: (id: number) => api.delete<ApiResponse>(`/roadmap/${id}`),
  getAdvisorReports: (limit?: number) => api.get<ApiResponse>('/advisor/reports', { params: { limit } }),
};

/**
 * 资产管理智能体 API
 */
export const advisorApi = {
  runAnalyze: () => api.post<ApiResponse>('/advisor/analyze'),
  getReports: (limit?: number) => api.get<ApiResponse>('/advisor/reports', { params: { limit } }),
  getReport: (id: number) => api.get<ApiResponse>(`/advisor/reports/${id}`),
  submitFeedback: (reportId: number, data: { rating?: number; acted_on?: boolean; notes?: string }) =>
    api.post<ApiResponse>('/advisor/feedback', { report_id: reportId, ...data }),
};

/**
 * 汇率API
 */
export const exchangeRateApi = {
  // 获取当前汇率
  getCurrent: () => api.get<ApiResponse>('/exchange-rate'),
};

/**
 * 价格提醒API
 */
export const alertsApi = {
  getAll: () => api.get<ApiResponse>('/alerts'),
  getWithPrices: () => api.get<ApiResponse>('/alerts/with-prices'),
  create: (alert: { symbol: string; name: string; category: string; direction: string; trigger_price: number; currency?: string; enabled?: boolean; cooldown_minutes?: number; notes?: string }) =>
    api.post<ApiResponse>('/alerts', alert),
  update: (id: number, updates: any) => api.put<ApiResponse>(`/alerts/${id}`, updates),
  delete: (id: number) => api.delete<ApiResponse>(`/alerts/${id}`),
  check: () => api.post<ApiResponse>('/alerts/check'),
};

/**
 * 宏观指标API
 */
export const indicatorsApi = {
  getLatest: () => api.get<ApiResponse>('/indicators'),
  getHistory: (name: string, days?: number) =>
    api.get<ApiResponse>(`/indicators/${encodeURIComponent(name)}/history`, { params: { days } }),
  record: (data: { indicator_name: string; value: number; source?: string }) =>
    api.post<ApiResponse>('/indicators', data),
  recordBatch: (indicators: { indicator_name: string; value: number; source?: string }[]) =>
    api.post<ApiResponse>('/indicators/batch', { indicators }),
};

/**
 * 投资计划API
 */
export const plansApi = {
  getAll: () => api.get<ApiResponse>('/plans'),
  get: (id: number) => api.get<ApiResponse>(`/plans/${id}`),
  create: (plan: {
    symbol: string;
    name: string;
    category: string;
    direction: string;
    total_target_usd?: number;
    status?: string;
    tranches_json?: any;
    stop_loss?: number;
    stop_loss_note?: string;
    take_profit?: number;
    take_profit_note?: string;
    rationale?: string;
  }) => api.post<ApiResponse>('/plans', plan),
  update: (id: number, updates: any) => api.put<ApiResponse>(`/plans/${id}`, updates),
  delete: (id: number) => api.delete<ApiResponse>(`/plans/${id}`),
  executeTranche: (planId: number, trancheIndex: number, actualPrice: number) =>
    api.post<ApiResponse>(`/plans/${planId}/tranches/${trancheIndex}/execute`, { actualPrice }),
};

/**
 * 宏观事件API
 */
export const eventsApi = {
  getAll: () => api.get<ApiResponse>('/events'),
  getUpcoming: () => api.get<ApiResponse>('/events', { params: { upcoming: 'true' } }),
  create: (event: {
    event_name: string;
    event_date: string;
    event_type?: string;
    importance?: string;
    affected_assets?: string;
    expected_impact?: string;
    actual_result?: string;
    notes?: string;
  }) => api.post<ApiResponse>('/events', event),
  update: (id: number, updates: any) => api.put<ApiResponse>(`/events/${id}`, updates),
  delete: (id: number) => api.delete<ApiResponse>(`/events/${id}`),
};

/**
 * 平台API
 */
export const platformsApi = {
  getAll: () => api.get<ApiResponse>('/platforms'),
  create: (data: { name: string; displayName: string; type: string; icon?: string }) =>
    api.post<ApiResponse>('/platforms', data),
  update: (id: number, data: any) => api.put<ApiResponse>(`/platforms/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse>(`/platforms/${id}`),
  setApiKey: (id: number, data: { apiKey: string; apiSecret: string; apiPassphrase?: string }) =>
    api.put<ApiResponse>(`/platforms/${id}/api-key`, data),
  deleteApiKey: (id: number) => api.delete<ApiResponse>(`/platforms/${id}/api-key`),
  sync: (id: number) => api.post<ApiResponse>(`/platforms/${id}/sync`),
  getSyncLogs: (id: number, limit?: number) =>
    api.get<ApiResponse>(`/platforms/${id}/sync-logs`, { params: { limit } }),
  addSubAccount: (platformId: number, data: { name: string; displayName: string; accountType: string }) =>
    api.post<ApiResponse>(`/platforms/${platformId}/sub-accounts`, data),
  updateSubAccount: (id: number, data: any) =>
    api.put<ApiResponse>(`/platforms/sub-accounts/${id}`, data),
  deleteSubAccount: (id: number) =>
    api.delete<ApiResponse>(`/platforms/sub-accounts/${id}`),
};

/**
 * 持仓API
 */
export const holdingsApi = {
  getAll: (params?: { platform_id?: number; sub_account_id?: number; category?: string; symbol?: string }) =>
    api.get<ApiResponse>('/holdings', { params }),
  create: (data: {
    sub_account_id: number; category: string; symbol: string; name: string;
    quantity: number; cost_price: number; cost_currency?: string; notes?: string;
  }) => api.post<ApiResponse>('/holdings', data),
  update: (id: number, data: any) => api.put<ApiResponse>(`/holdings/${id}`, data),
  delete: (id: number) => api.delete<ApiResponse>(`/holdings/${id}`),
};

/**
 * 转账API
 */
export const transfersApi = {
  getAll: () => api.get<ApiResponse>('/transfers'),
  create: (data: {
    from_sub_account_id: number; to_sub_account_id: number;
    symbol: string; quantity: number; fee?: number; fee_symbol?: string;
    notes?: string; executed_at: number;
  }) => api.post<ApiResponse>('/transfers', data),
  delete: (id: number) => api.delete<ApiResponse>(`/transfers/${id}`),
};

/**
 * 系统API
 */
export const systemApi = {
  health: () => api.get<ApiResponse>('/health'),
  testNotify: () => api.post<ApiResponse>('/notify/test'),
};

// 默认导出
export { api };