import { useEffect, useState } from 'react'
import { TrendingUp, Activity, Target, BarChart3 } from 'lucide-react'
import { portfolioApi, rebalanceApi, useApi } from '@/hooks/useApi'
import { formatPercent, getCategoryName, getCategoryColor } from '@/utils/format'

interface CorrelationMatrix {
  crypto_stock: number
  crypto_gold: number
  stock_gold: number
}

interface RiskMetrics {
  mean_daily_return: number
  volatility: number
  sharpe_ratio: number
  max_drawdown: number
  annualized: {
    return: number
    volatility: number
    sharpe_ratio: number
  }
  insufficient?: boolean
  message?: string
}

export default function Analytics() {
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [optimalAllocation, setOptimalAllocation] = useState<Record<string, unknown> | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [riskMessage, setRiskMessage] = useState<string | null>(null)

  const { loading, error, execute } = useApi()

  const loadAnalysisData = async () => {
    setAnalysisLoading(true)
    try {
      const [correlationData, riskData, optimalData] = await Promise.all([
        execute(() => portfolioApi.getCorrelation()),
        execute(() => portfolioApi.getRisk(90)),
        execute(() => rebalanceApi.getOptimal()),
      ])

      if (correlationData) setCorrelation(correlationData.correlation_matrix)
      if (riskData) {
        if ((riskData as Record<string, unknown>).insufficient) {
          setRiskMetrics(null)
          setRiskMessage(
            ((riskData as Record<string, unknown>).message as string) ||
              '历史数据不足，暂不展示风险指标'
          )
        } else if (riskData.volatility !== undefined) {
          setRiskMetrics(riskData)
          setRiskMessage(null)
        }
      }
      if (optimalData)
        setOptimalAllocation(optimalData.optimal_allocation || optimalData.fallback)
    } catch (err) {
      console.error('加载分析数据失败:', err)
    } finally {
      setAnalysisLoading(false)
    }
  }

  useEffect(() => {
    loadAnalysisData()
  }, [])

  const formatCorrelation = (value: number): string => {
    const abs = Math.abs(value)
    let strength = ''
    if (abs >= 0.7) strength = '强'
    else if (abs >= 0.3) strength = '中等'
    else strength = '弱'
    const direction = value >= 0 ? '正' : '负'
    return `${direction}相关(${strength})`
  }

  const getCorrelationColor = (value: number): string => {
    const abs = Math.abs(value)
    if (abs >= 0.7) return value > 0 ? 'text-red-500' : 'text-blue-500'
    if (abs >= 0.3) return value > 0 ? 'text-orange-500' : 'text-cyan-500'
    return 'text-gray-500'
  }

  if (loading && !correlation) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-arena-surface rounded w-1/4" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-arena-surface rounded-lg" />
            <div className="h-64 bg-arena-surface rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Hero */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">分析中心</span>
              </h1>
              <p className="text-sm text-neutral-400">
                风险评估 &middot; 相关性分析 &middot; 历史表现
              </p>
            </div>
            <button
              onClick={loadAnalysisData}
              disabled={analysisLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
            >
              <BarChart3
                className={`w-4 h-4 ${analysisLoading ? 'animate-pulse' : ''}`}
                strokeWidth={1.75}
              />
              <span>重新分析</span>
            </button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Error */}
      {error && (
        <section className="relative max-w-[1400px] mx-auto px-6 pt-6">
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        </section>
      )}

      {/* Stat Cards */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <div className="text-xs text-neutral-400 font-medium mb-1">年化收益率</div>
            <div
              className={`text-2xl font-bold font-data tabular-nums ${
                riskMetrics
                  ? riskMetrics.annualized.return > 0
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-neutral-500'
              }`}
            >
              {riskMetrics
                ? formatPercent(riskMetrics.annualized.return * 100)
                : '--'}
            </div>
          </div>
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <div className="text-xs text-neutral-400 font-medium mb-1">年化波动率</div>
            <div className="text-2xl font-bold font-data tabular-nums text-amber-400">
              {riskMetrics
                ? formatPercent(riskMetrics.annualized.volatility * 100)
                : '--'}
            </div>
          </div>
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <div className="text-xs text-neutral-400 font-medium mb-1">夏普比率</div>
            <div
              className={`text-2xl font-bold font-data tabular-nums ${
                riskMetrics
                  ? riskMetrics.annualized.sharpe_ratio > 1
                    ? 'text-emerald-400'
                    : riskMetrics.annualized.sharpe_ratio > 0
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  : 'text-neutral-500'
              }`}
            >
              {riskMetrics ? riskMetrics.annualized.sharpe_ratio.toFixed(2) : '--'}
            </div>
          </div>
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <div className="text-xs text-neutral-400 font-medium mb-1">最大回撤</div>
            <div className="text-2xl font-bold font-data tabular-nums text-rose-400">
              {riskMetrics
                ? formatPercent(riskMetrics.max_drawdown * 100)
                : '--'}
            </div>
          </div>
        </div>
      </section>

      {/* Correlation Matrix */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
          <div className="flex items-center space-x-2 mb-4">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-neutral-50">资产相关性矩阵</h3>
          </div>

          {correlation ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  { key: 'crypto_stock' as const, label: '加密货币 <-> 股票' },
                  { key: 'crypto_gold' as const, label: '加密货币 <-> 黄金' },
                  { key: 'stock_gold' as const, label: '股票 <-> 黄金' },
                ] as const
              ).map((item) => (
                <div key={item.key} className="bg-arena-surface/50 rounded-xl p-4">
                  <div className="text-center">
                    <div
                      className={`text-2xl font-bold font-data tabular-nums ${getCorrelationColor(correlation[item.key])}`}
                    >
                      {(correlation[item.key] * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-neutral-400 mt-1">{item.label}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {formatCorrelation(correlation[item.key])}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-400">
              {analysisLoading ? '正在计算相关性...' : '暂无相关性数据'}
            </div>
          )}

          <div className="mt-4 text-sm text-neutral-400">
            <p>正相关表示资产价格同向波动，负相关表示反向波动</p>
            <p>低相关性有利于分散投资风险</p>
          </div>
        </div>
      </section>

      {/* Optimal Allocation */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
        <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-neutral-50">最优配比建议</h3>
          </div>

          {optimalAllocation ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {Object.entries(optimalAllocation)
                  .filter(([, value]) => typeof value === 'number')
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getCategoryColor(key) }}
                        />
                        <span className="text-sm text-neutral-200">
                          {getCategoryName(key)}
                        </span>
                      </div>
                      <div
                        className="text-lg font-bold font-data tabular-nums"
                        style={{ color: getCategoryColor(key) }}
                      >
                        {((value as number) * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
              </div>

              <div className="border-t border-[rgba(100,140,255,0.1)] pt-4">
                <div className="text-sm text-neutral-400 space-y-1">
                  <p>基于历史风险调整收益率优化</p>
                  <p>此建议仅供参考，投资有风险</p>
                  <p>建议结合个人风险偏好调整</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-neutral-400">
              {analysisLoading
                ? '正在计算最优配比...'
                : '历史数据不足，无法计算最优配比'}
            </div>
          )}
        </div>
      </section>

      {/* Analysis Notes */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-16">
        <div className="glass scan-line rounded-lg p-6 border border-[rgba(100,140,255,0.1)]">
          <h3 className="text-lg font-semibold text-neutral-50 mb-4">分析说明</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-neutral-400">
            <div>
              <h4 className="font-medium text-neutral-50 mb-2">相关性分析</h4>
              <ul className="space-y-1">
                <li>衡量不同资产价格变动的关联程度</li>
                <li>范围从-100%到+100%</li>
                <li>低相关性有助于分散风险</li>
                <li>负相关资产可作为对冲工具</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-neutral-50 mb-2">风险指标</h4>
              <ul className="space-y-1">
                <li>夏普比率：风险调整后收益指标</li>
                <li>波动率：价格变动幅度衡量</li>
                <li>最大回撤：历史最大亏损幅度</li>
                <li>年化指标：按年度标准化计算</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
