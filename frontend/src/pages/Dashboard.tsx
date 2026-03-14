import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Wallet, Receipt, Percent } from 'lucide-react'
import { portfolioApi, exchangeRateApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getProfitColorClass, getCategoryName, getCategoryColor } from '@/utils/format'
import PieChart from '@/components/PieChart'
import LineChart from '@/components/LineChart'

interface PortfolioSummary {
  totalValueUsd: number
  totalValueCny: number
  totalCostUsd: number
  totalProfitUsd: number
  totalProfitPercent: number
  categories: {
    crypto: CategorySummary
    stock: CategorySummary
    gold: CategorySummary
  }
  assets: any[]
  lastUpdated: number
}

interface CategorySummary {
  valueUsd: number
  costUsd: number
  profitUsd: number
  profitPercent: number
  percentage: number
  count: number
}

export default function Dashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(7.2)
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'CNY'>('USD')
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyDays, setHistoryDays] = useState(30)
  
  const { loading, error, execute } = useApi()

  // 加载数据
  const loadData = async () => {
    try {
      const [summaryData, rateData, historyResult] = await Promise.all([
        execute(() => portfolioApi.getSummary()),
        execute(() => exchangeRateApi.getCurrent()),
        execute(() => portfolioApi.getHistory(historyDays))
      ])

      if (summaryData) setSummary(summaryData)
      if (rateData) setExchangeRate(rateData.rate)
      if (historyResult) setHistoryData(historyResult.history || [])
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [historyDays])

  // 刷新数据
  const handleRefresh = () => {
    loadData()
  }

  // 切换货币显示
  const toggleCurrency = () => {
    setCurrencyMode(prev => prev === 'USD' ? 'CNY' : 'USD')
  }

  // 获取显示值
  const getDisplayValue = (usdValue: number) => {
    return currencyMode === 'USD' ? usdValue : usdValue * exchangeRate
  }

  if (loading && !summary) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-secondary rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-secondary rounded-lg"></div>
            <div className="h-80 bg-secondary rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <h3 className="font-semibold text-destructive">加载失败</h3>
          <p className="text-destructive/80 mt-1">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-3 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    )
  }

  if (!summary) {
    return <div className="p-6">暂无数据</div>
  }

  const totalValue = getDisplayValue(summary.totalValueUsd)
  const totalCost = getDisplayValue(summary.totalCostUsd)
  const totalProfit = getDisplayValue(summary.totalProfitUsd)

  // 饼图数据
  const pieData = [
    {
      name: getCategoryName('crypto'),
      value: summary.categories.crypto.percentage,
      color: getCategoryColor('crypto'),
      amount: getDisplayValue(summary.categories.crypto.valueUsd)
    },
    {
      name: getCategoryName('stock'),
      value: summary.categories.stock.percentage,
      color: getCategoryColor('stock'),
      amount: getDisplayValue(summary.categories.stock.valueUsd)
    },
    {
      name: getCategoryName('gold'),
      value: summary.categories.gold.percentage,
      color: getCategoryColor('gold'),
      amount: getDisplayValue(summary.categories.gold.valueUsd)
    }
  ].filter(item => item.value > 0)

  // 折线图数据
  const lineData = historyData.map(item => ({
    date: item.date,
    value: getDisplayValue(item.totalValueUsd),
    crypto: getDisplayValue(item.cryptoValueUsd),
    stock: getDisplayValue(item.stockValueUsd),
    gold: getDisplayValue(item.goldValueUsd)
  }))

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">投资组合总览</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            最后更新: {new Date(summary.lastUpdated).toLocaleString('zh-CN')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={toggleCurrency}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/60 text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
          >
            <Wallet className="w-4 h-4" strokeWidth={1.75} />
            <span>{currencyMode}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            <span>刷新</span>
          </button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 总资产 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20 hover:ring-primary/20 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">总资产</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">
                {formatCurrency(totalValue, currencyMode)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 ring-1 ring-primary/15">
              <Wallet className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* 总成本 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20 hover:ring-primary/20 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">总成本</p>
              <p className="text-xl font-bold text-foreground tabular-nums mt-1">
                {formatCurrency(totalCost, currencyMode)}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-muted ring-1 ring-border/40">
              <Receipt className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
          </div>
        </div>

        {/* 总盈亏 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20 hover:ring-primary/20 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">总盈亏</p>
              <p className={`text-xl font-bold tabular-nums mt-1 ${getProfitColorClass(summary.totalProfitUsd)}`}>
                {formatCurrency(totalProfit, currencyMode, true)}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ring-1 ${
              summary.totalProfitUsd > 0 
                ? 'bg-emerald-500/10 ring-emerald-500/20' 
                : summary.totalProfitUsd < 0 
                  ? 'bg-rose-500/10 ring-rose-500/20' 
                  : 'bg-muted ring-border/40'
            }`}>
              {summary.totalProfitUsd > 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
              ) : summary.totalProfitUsd < 0 ? (
                <TrendingDown className="w-5 h-5 text-rose-400" strokeWidth={1.75} />
              ) : (
                <Minus className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
              )}
            </div>
          </div>
        </div>

        {/* 盈亏比例 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20 hover:ring-primary/20 transition-all">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">盈亏比例</p>
              <p className={`text-xl font-bold tabular-nums mt-1 ${getProfitColorClass(summary.totalProfitUsd)}`}>
                {formatPercent(summary.totalProfitPercent)}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ring-1 ${
              summary.totalProfitPercent > 0 
                ? 'bg-emerald-500/10 ring-emerald-500/20' 
                : summary.totalProfitPercent < 0 
                  ? 'bg-rose-500/10 ring-rose-500/20' 
                  : 'bg-muted ring-border/40'
            }`}>
              {summary.totalProfitPercent > 0 ? (
                <Percent className="w-5 h-5 text-emerald-400" strokeWidth={1.75} />
              ) : summary.totalProfitPercent < 0 ? (
                <TrendingDown className="w-5 h-5 text-rose-400" strokeWidth={1.75} />
              ) : (
                <Minus className="w-5 h-5 text-muted-foreground" strokeWidth={1.75} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 资产配置饼图 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20">
          <h3 className="text-base font-semibold text-foreground mb-4">资产配置</h3>
          {pieData.length > 0 ? (
            <PieChart data={pieData} />
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              暂无资产数据
            </div>
          )}
        </div>

        {/* 组合净值历史 */}
        <div className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-foreground">组合净值历史</h3>
            <select
              value={historyDays}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg bg-secondary/60 text-secondary-foreground border border-border/60 text-sm font-medium"
            >
              <option value={7}>7天</option>
              <option value={30}>30天</option>
              <option value={90}>90天</option>
              <option value={365}>1年</option>
            </select>
          </div>
          {lineData.length > 0 ? (
            <LineChart data={lineData} />
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              暂无历史数据
            </div>
          )}
        </div>
      </div>

      {/* 资产类别详情 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(summary.categories).map(([key, category]) => {
          if (category.valueUsd === 0) return null
          
          const categoryKey = key as 'crypto' | 'stock' | 'gold'
          const value = getDisplayValue(category.valueUsd)
          const cost = getDisplayValue(category.costUsd)
          const profit = getDisplayValue(category.profitUsd)
          
          return (
            <div key={key} className="bg-card/80 p-5 rounded-xl border border-border/60 ring-1 ring-border/20">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-base font-semibold text-foreground">
                  {getCategoryName(categoryKey)}
                </h4>
                <div 
                  className="w-3 h-3 rounded-full ring-2 ring-white/10"
                  style={{ backgroundColor: getCategoryColor(categoryKey) }}
                />
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">当前价值</span>
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    {formatCurrency(value, currencyMode)}
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">占比</span>
                  <span className="text-sm font-medium text-foreground">
                    {category.percentage.toFixed(1)}%
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">盈亏</span>
                  <span className={`text-sm font-medium tabular-nums ${getProfitColorClass(category.profitUsd)}`}>
                    {formatCurrency(profit, currencyMode, true)} ({formatPercent(category.profitPercent)})
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">资产数量</span>
                  <span className="text-sm font-medium text-foreground">
                    {category.count} 个
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}