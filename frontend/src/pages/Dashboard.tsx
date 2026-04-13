import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Wallet,
  Receipt,
  Percent,
  BarChart3,
} from 'lucide-react'
import { portfolioApi, exchangeRateApi, useApi } from '@/hooks/useApi'
import {
  formatCurrency,
  formatPercent,
  getProfitColorClass,
  getCategoryName,
  getCategoryColor,
} from '@/utils/format'
import PieChart from '@/components/PieChart'
import LineChart from '@/components/LineChart'
import MacroIndicators from '@/components/MacroIndicators'

interface PortfolioSummary {
  totalValueUsd: number
  totalValueCny: number
  totalCostUsd: number
  totalProfitUsd: number
  totalProfitPercent: number
  categories: Record<string, CategorySummary>
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

function StatCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
  delay = 0,
}: {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  variant?: 'default' | 'success' | 'danger'
  delay?: number
}) {
  const iconBg =
    variant === 'success'
      ? 'bg-success/10'
      : variant === 'danger'
        ? 'bg-danger/10'
        : 'bg-primary-soft'
  const iconColor =
    variant === 'success'
      ? 'text-success'
      : variant === 'danger'
        ? 'text-danger'
        : 'text-primary'

  return (
    <div
      className="stat-card animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div className={`flex size-10 items-center justify-center rounded-full ${iconBg}`}>
          <Icon className={`size-5 ${iconColor}`} strokeWidth={1.75} />
        </div>
      </div>
      <div className="mt-4">
        <div className="font-data text-2xl font-bold tracking-tight text-neutral-50">
          {value}
        </div>
        <p className="mt-1 text-sm text-neutral-400">{label}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(7.2)
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'CNY'>('USD')
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyDays, setHistoryDays] = useState(30)

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const [summaryData, rateData, historyResult] = await Promise.all([
        execute(() => portfolioApi.getSummary()),
        execute(() => exchangeRateApi.getCurrent()),
        execute(() => portfolioApi.getHistory(historyDays)),
      ])
      if (summaryData) setSummary(summaryData)
      if (rateData) setExchangeRate(rateData.rate)
      if (historyResult) setHistoryData(historyResult.history || [])
    } catch (err) {
      console.error('加载数据失败:', err)
    }
  }

  useEffect(() => {
    loadData()
  }, [historyDays])

  const toggleCurrency = () =>
    setCurrencyMode((prev) => (prev === 'USD' ? 'CNY' : 'USD'))

  const getDisplayValue = (usdValue: number) =>
    currencyMode === 'USD' ? usdValue : usdValue * exchangeRate

  // ── Loading skeleton ──
  if (loading && !summary) {
    return (
      <section className="relative max-w-[1400px] mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="glass rounded-lg h-32 animate-pulse"
              style={{ background: 'var(--arena-bg-surface)' }}
            />
          ))}
        </div>
      </section>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <section className="relative max-w-[1400px] mx-auto px-6 py-12">
        <div className="glass rounded-xl p-6 glow-border-danger">
          <h3 className="font-semibold text-danger">加载失败</h3>
          <p className="text-neutral-400 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/80 transition-colors"
          >
            重试
          </button>
        </div>
      </section>
    )
  }

  if (!summary) {
    return (
      <section className="relative max-w-[1400px] mx-auto px-6 py-24 text-center text-neutral-500">
        暂无数据
      </section>
    )
  }

  const totalValue = getDisplayValue(summary.totalValueUsd)
  const totalCost = getDisplayValue(summary.totalCostUsd)
  const totalProfit = getDisplayValue(summary.totalProfitUsd)

  const pieData = Object.entries(summary.categories)
    .map(([key, category]) => ({
      name: getCategoryName(key),
      value: category.percentage,
      color: getCategoryColor(key),
      amount: getDisplayValue(category.valueUsd),
    }))
    .filter((item) => item.value > 0)

  const lineData = historyData.map((item) => ({
    date: item.date,
    value: getDisplayValue(item.totalValueUsd),
    crypto: getDisplayValue(item.cryptoValueUsd),
    stock: getDisplayValue(item.stockValueUsd),
    gold: getDisplayValue(item.goldValueUsd),
  }))

  const profitVariant =
    summary.totalProfitUsd > 0
      ? 'success'
      : summary.totalProfitUsd < 0
        ? 'danger'
        : ('default' as const)

  return (
    <>
      {/* ── Hero header ── */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 50% 20%, rgba(59,130,246,0.15), transparent),
              radial-gradient(ellipse 60% 40% at 80% 60%, rgba(139,92,246,0.1), transparent)
            `,
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div
            className="flex items-center gap-3 mb-2 animate-fade-in-up"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BarChart3 className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">投资组合</span>
              </h1>
              <p className="text-sm text-neutral-400">
                总览 · 配置分析 · 净值追踪
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCurrency}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Wallet className="w-4 h-4" strokeWidth={1.75} />
                {currencyMode}
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                />
                刷新
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-500 mb-4">
            最后更新: {new Date(summary.lastUpdated).toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* ── Stat cards ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="总资产"
            value={
              <span className="font-data tabular-nums">
                {formatCurrency(totalValue, currencyMode)}
              </span>
            }
            icon={Wallet}
            delay={0}
          />
          <StatCard
            label="总成本"
            value={
              <span className="font-data tabular-nums">
                {formatCurrency(totalCost, currencyMode)}
              </span>
            }
            icon={Receipt}
            delay={50}
          />
          <StatCard
            label="总盈亏"
            value={
              <span
                className={`font-data tabular-nums ${
                  profitVariant === 'success'
                    ? 'text-success'
                    : profitVariant === 'danger'
                      ? 'text-danger'
                      : ''
                }`}
              >
                {formatCurrency(totalProfit, currencyMode, true)}
              </span>
            }
            icon={
              summary.totalProfitUsd > 0
                ? TrendingUp
                : summary.totalProfitUsd < 0
                  ? TrendingDown
                  : Minus
            }
            variant={profitVariant}
            delay={100}
          />
          <StatCard
            label="盈亏比例"
            value={
              <span
                className={`font-data tabular-nums ${
                  profitVariant === 'success'
                    ? 'text-success'
                    : profitVariant === 'danger'
                      ? 'text-danger'
                      : ''
                }`}
              >
                {formatPercent(summary.totalProfitPercent)}
              </span>
            }
            icon={Percent}
            variant={profitVariant}
            delay={150}
          />
        </div>
      </section>

      {/* ── Charts ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie chart */}
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <h3 className="text-base font-semibold text-neutral-50 mb-4">
              资产配置
            </h3>
            {pieData.length > 0 ? (
              <PieChart data={pieData} />
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                暂无资产数据
              </div>
            )}
          </div>

          {/* Line chart */}
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-50">
                组合净值历史
              </h3>
              <select
                value={historyDays}
                onChange={(e) => setHistoryDays(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg bg-arena-surface text-neutral-300 border border-[rgba(100,140,255,0.1)] text-sm font-medium focus:outline-none focus:border-primary/40"
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
              <div className="h-64 flex items-center justify-center text-neutral-500">
                暂无历史数据
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Category details ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
        <div
          className={`grid grid-cols-1 gap-4 ${
            Object.keys(summary.categories).length <= 3
              ? 'md:grid-cols-3'
              : Object.keys(summary.categories).length <= 4
                ? 'md:grid-cols-4'
                : 'md:grid-cols-3 lg:grid-cols-4'
          }`}
        >
          {Object.entries(summary.categories).map(([key, category]) => {
            if (category.valueUsd === 0) return null
            const value = getDisplayValue(category.valueUsd)
            const profit = getDisplayValue(category.profitUsd)

            return (
              <div
                key={key}
                className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)] hover:border-[rgba(100,140,255,0.25)] transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-base font-semibold text-neutral-50">
                    {getCategoryName(key)}
                  </h4>
                  <div
                    className="w-3 h-3 rounded-full ring-2 ring-white/10"
                    style={{ backgroundColor: getCategoryColor(key) }}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">当前价值</span>
                    <span className="text-sm font-medium text-neutral-100 font-data tabular-nums">
                      {formatCurrency(value, currencyMode)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">占比</span>
                    <span className="text-sm font-medium text-neutral-100 font-data">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">盈亏</span>
                    <span
                      className={`text-sm font-medium font-data tabular-nums ${getProfitColorClass(category.profitUsd)}`}
                    >
                      {formatCurrency(profit, currencyMode, true)} (
                      {formatPercent(category.profitPercent)})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-400">资产数量</span>
                    <span className="text-sm font-medium text-neutral-100 font-data">
                      {category.count} 个
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Macro indicators ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-16">
        <MacroIndicators />
      </section>
    </>
  )
}
