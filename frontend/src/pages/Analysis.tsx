import { useEffect, useState } from 'react'
import { TrendingUp, BarChart3, Activity, Target } from 'lucide-react'
import { portfolioApi, rebalanceApi, useApi } from '@/hooks/useApi'
import { formatPercent, formatCurrency } from '@/utils/format'

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

export default function Analysis() {
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [optimalAllocation, setOptimalAllocation] = useState<any>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [riskMessage, setRiskMessage] = useState<string | null>(null)

  const { loading, error, execute } = useApi()

  // 加载分析数据
  const loadAnalysisData = async () => {
    setAnalysisLoading(true)
    try {
      const [correlationData, riskData, optimalData] = await Promise.all([
        execute(() => portfolioApi.getCorrelation()),
        execute(() => portfolioApi.getRisk(90)), // 90天风险数据
        execute(() => rebalanceApi.getOptimal())
      ])

      if (correlationData) setCorrelation(correlationData.correlation_matrix)
      if (riskData) {
        if ((riskData as any).insufficient) {
          setRiskMetrics(null)
          setRiskMessage((riskData as any).message || '历史数据不足，暂不展示风险指标')
        } else if (riskData.volatility !== undefined) {
          setRiskMetrics(riskData)
          setRiskMessage(null)
        }
      }
      if (optimalData) setOptimalAllocation(optimalData.optimal_allocation || optimalData.fallback)
    } catch (error) {
      console.error('加载分析数据失败:', error)
    } finally {
      setAnalysisLoading(false)
    }
  }

  useEffect(() => {
    loadAnalysisData()
  }, [])

  // 格式化相关性值
  const formatCorrelation = (value: number): string => {
    const abs = Math.abs(value)
    let strength = ''
    if (abs >= 0.7) strength = '强'
    else if (abs >= 0.3) strength = '中等'
    else strength = '弱'
    
    const direction = value >= 0 ? '正' : '负'
    return `${direction}相关(${strength})`
  }

  // 获取相关性颜色
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
          <div className="h-8 bg-secondary rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-secondary rounded-lg"></div>
            <div className="h-64 bg-secondary rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">投资分析</h1>
          <p className="text-muted-foreground">深度分析您的投资组合表现和风险</p>
        </div>
        
        <button
          onClick={loadAnalysisData}
          disabled={analysisLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <BarChart3 className={`w-4 h-4 ${analysisLoading ? 'animate-pulse' : ''}`} />
          <span>重新分析</span>
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* 相关性矩阵 */}
      <div className="bg-card rounded-lg border border-border p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Activity className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">资产相关性矩阵</h3>
        </div>
        
        {correlation ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-secondary/20 rounded-lg p-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getCorrelationColor(correlation.crypto_stock)}`}>
                  {(correlation.crypto_stock * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">加密货币 ↔ 股票</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCorrelation(correlation.crypto_stock)}
                </div>
              </div>
            </div>

            <div className="bg-secondary/20 rounded-lg p-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getCorrelationColor(correlation.crypto_gold)}`}>
                  {(correlation.crypto_gold * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">加密货币 ↔ 黄金</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCorrelation(correlation.crypto_gold)}
                </div>
              </div>
            </div>

            <div className="bg-secondary/20 rounded-lg p-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${getCorrelationColor(correlation.stock_gold)}`}>
                  {(correlation.stock_gold * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground mt-1">股票 ↔ 黄金</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCorrelation(correlation.stock_gold)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {analysisLoading ? '正在计算相关性...' : '暂无相关性数据'}
          </div>
        )}

        <div className="mt-4 text-sm text-muted-foreground">
          <p>• 正相关表示资产价格同向波动，负相关表示反向波动</p>
          <p>• 低相关性有利于分散投资风险</p>
        </div>
      </div>

      {/* 风险指标和最优配比 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 风险指标 */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">风险指标</h3>
          </div>

          {riskMetrics ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">年化收益率</div>
                  <div className={`text-xl font-bold ${
                    riskMetrics.annualized.return > 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {formatPercent(riskMetrics.annualized.return * 100)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">年化波动率</div>
                  <div className="text-xl font-bold text-orange-500">
                    {formatPercent(riskMetrics.annualized.volatility * 100)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">夏普比率</div>
                  <div className={`text-xl font-bold ${
                    riskMetrics.annualized.sharpe_ratio > 1 ? 'text-green-500' : 
                    riskMetrics.annualized.sharpe_ratio > 0 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {riskMetrics.annualized.sharpe_ratio.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">最大回撤</div>
                  <div className="text-xl font-bold text-red-500">
                    {formatPercent(riskMetrics.max_drawdown * 100)}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• 夏普比率 &gt; 1 表示风险调整收益较好</p>
                  <p>• 最大回撤显示历史最大亏损幅度</p>
                  <p>• 基于过去90天数据计算，剔除了单日异常大幅变动</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {analysisLoading
                ? '正在计算风险指标...'
                : (riskMessage || '历史数据不足，暂不展示风险指标')}
            </div>
          )}
        </div>

        {/* 最优配比建议 */}
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">最优配比建议</h3>
          </div>

          {optimalAllocation ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-crypto"></div>
                    <span className="text-sm">加密货币</span>
                  </div>
                  <div className="text-lg font-bold text-crypto">
                    {(optimalAllocation.crypto * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-stock"></div>
                    <span className="text-sm">股票基金</span>
                  </div>
                  <div className="text-lg font-bold text-stock">
                    {(optimalAllocation.stock * 100).toFixed(0)}%
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-gold"></div>
                    <span className="text-sm">黄金</span>
                  </div>
                  <div className="text-lg font-bold text-gold">
                    {(optimalAllocation.gold * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• 基于历史风险调整收益率优化</p>
                  <p>• 此建议仅供参考，投资有风险</p>
                  <p>• 建议结合个人风险偏好调整</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {analysisLoading ? '正在计算最优配比...' : '历史数据不足，无法计算最优配比'}
            </div>
          )}
        </div>
      </div>

      {/* 分析说明 */}
      <div className="bg-card rounded-lg border border-border p-6">
        <h3 className="text-lg font-semibold text-foreground mb-4">分析说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <div>
            <h4 className="font-medium text-foreground mb-2">相关性分析</h4>
            <ul className="space-y-1">
              <li>• 衡量不同资产价格变动的关联程度</li>
              <li>• 范围从-100%到+100%</li>
              <li>• 低相关性有助于分散风险</li>
              <li>• 负相关资产可作为对冲工具</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">风险指标</h4>
            <ul className="space-y-1">
              <li>• 夏普比率：风险调整后收益指标</li>
              <li>• 波动率：价格变动幅度衡量</li>
              <li>• 最大回撤：历史最大亏损幅度</li>
              <li>• 年化指标：按年度标准化计算</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}