import { useEffect, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Wallet,
  BarChart3,
  Activity,
  AlertTriangle,
} from 'lucide-react'
import { portfolioApi, exchangeRateApi, indicatorsApi, useApi, api } from '@/hooks/useApi'
import {
  formatCurrency,
  formatPercent,
  getProfitColorClass,
  getCategoryName,
  getCategoryColor,
} from '@/utils/format'
import PieChart from '@/components/PieChart'
import LineChart from '@/components/LineChart'

// ── Types ──

interface CategorySummary {
  valueUsd: number
  costUsd: number
  profitUsd: number
  profitPercent: number
  percentage: number
  count: number
}

interface PortfolioSummary {
  totalValueUsd: number
  totalValueCny: number
  totalCostUsd: number
  totalProfitUsd: number
  totalProfitPercent: number
  categories: Record<string, CategorySummary>
  mergedAssets: unknown[]
  lastUpdated: number
}

interface PlatformItem {
  displayName: string
  icon: string
  valueUsd: number
  profitUsd: number
  profitPercent: number
  percentage: number
  holdingsCount: number
}

interface MacroIndicator {
  indicator_name: string
  value: number
  source: string | null
  timestamp: number
}

// ── Palette for platform pie slices ──

const PLATFORM_COLORS = [
  '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
  '#f59e0b', '#ec4899', '#f97316', '#14b8a6',
]

// ── Sub-components ──

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

function MacroBadge({ name, value }: { name: string; value: number }) {
  const lower = name.toLowerCase()

  let colorClass = 'text-neutral-50'
  let ringClass = 'ring-[rgba(100,140,255,0.15)]'

  if (lower.includes('fear') || lower.includes('greed') || lower.includes('fg')) {
    if (value >= 75) { colorClass = 'text-emerald-400'; ringClass = 'ring-emerald-500/20' }
    else if (value >= 50) { colorClass = 'text-emerald-300'; ringClass = 'ring-emerald-500/15' }
    else if (value >= 25) { colorClass = 'text-amber-400'; ringClass = 'ring-amber-500/20' }
    else { colorClass = 'text-rose-400'; ringClass = 'ring-rose-500/20' }
  } else if (lower.includes('vix')) {
    if (value >= 30) { colorClass = 'text-rose-400'; ringClass = 'ring-rose-500/20' }
    else if (value >= 20) { colorClass = 'text-amber-400'; ringClass = 'ring-amber-500/20' }
    else { colorClass = 'text-emerald-400'; ringClass = 'ring-emerald-500/20' }
  } else if (lower.includes('dxy') || lower.includes('dollar')) {
    if (value >= 105) { colorClass = 'text-rose-400'; ringClass = 'ring-rose-500/20' }
    else if (value >= 100) { colorClass = 'text-amber-400'; ringClass = 'ring-amber-500/20' }
    else { colorClass = 'text-emerald-400'; ringClass = 'ring-emerald-500/20' }
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ring-1 ${ringClass} bg-arena-surface text-sm`}
    >
      <span className="text-neutral-400">{name}</span>
      <span className={`font-data tabular-nums font-semibold ${colorClass}`}>
        {value % 1 === 0 ? value : value.toFixed(2)}
      </span>
    </span>
  )
}

// ── Helpers ──

const HISTORY_OPTIONS = [
  { label: '7天', value: 7 },
  { label: '30天', value: 30 },
  { label: '90天', value: 90 },
  { label: '1年', value: 365 },
] as const

const INDICATOR_DISPLAY_NAMES: Record<string, boolean> = {
  'Fear & Greed': true,
  'VIX': true,
  'DXY': true,
}

// ── Main component ──

export default function Dashboard() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [exchangeRate, setExchangeRate] = useState<number>(7.2)
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'CNY'>('USD')
  const [historyData, setHistoryData] = useState<{ date: string; totalValueUsd: number; cryptoValueUsd: number; stockValueUsd: number; goldValueUsd: number }[]>([])
  const [historyDays, setHistoryDays] = useState(30)
  const [platforms, setPlatforms] = useState<PlatformItem[]>([])
  const [indicators, setIndicators] = useState<MacroIndicator[]>([])

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const [summaryData, rateData, historyResult, platformResult, indicatorResult] = await Promise.all([
        execute(() => portfolioApi.getSummary()),
        execute(() => exchangeRateApi.getCurrent()),
        execute(() => portfolioApi.getHistory(historyDays)),
        execute(() => api.get('/portfolio/by-platform')),
        execute(() => indicatorsApi.getLatest()),
      ])
      if (summaryData) setSummary(summaryData as PortfolioSummary)
      if (rateData) setExchangeRate((rateData as { rate: number }).rate)
      if (historyResult) setHistoryData((historyResult as { history: typeof historyData }).history || [])
      if (platformResult) setPlatforms((platformResult as { data: PlatformItem[] }).data || platformResult as unknown as PlatformItem[])
      if (indicatorResult) setIndicators(indicatorResult as MacroIndicator[])
    } catch {
      // errors are surfaced via the useApi error state
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

  // ── Derived data ──
  const totalValue = getDisplayValue(summary.totalValueUsd)
  const totalProfit = getDisplayValue(summary.totalProfitUsd)

  const profitVariant =
    summary.totalProfitUsd > 0
      ? 'success'
      : summary.totalProfitUsd < 0
        ? 'danger'
        : ('default' as const)

  const categoryPieData = Object.entries(summary.categories)
    .map(([key, category]) => ({
      name: getCategoryName(key),
      value: category.percentage,
      color: getCategoryColor(key),
      amount: getDisplayValue(category.valueUsd),
    }))
    .filter((item) => item.value > 0)

  const platformPieData = platforms.map((p, i) => ({
    name: p.displayName,
    value: p.percentage,
    color: PLATFORM_COLORS[i % PLATFORM_COLORS.length],
    amount: getDisplayValue(p.valueUsd),
  })).filter((item) => item.value > 0)

  const lineData = historyData.map((item) => ({
    date: item.date,
    value: getDisplayValue(item.totalValueUsd),
    crypto: getDisplayValue(item.cryptoValueUsd),
    stock: getDisplayValue(item.stockValueUsd),
    gold: getDisplayValue(item.goldValueUsd),
  }))

  const featuredIndicators = Array.isArray(indicators)
    ? indicators.filter((ind) => {
        const n = ind.indicator_name
        return INDICATOR_DISPLAY_NAMES[n] ||
          n.toLowerCase().includes('fear') ||
          n.toLowerCase().includes('vix') ||
          n.toLowerCase().includes('dxy')
      })
    : []

  return (
    <>
      {/* ── 1. Hero Section ── */}
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
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
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

      {/* ── 2. Stat Cards ── */}
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
                {formatCurrency(totalProfit, currencyMode, true)}{' '}
                <span className="text-base">({formatPercent(summary.totalProfitPercent)})</span>
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
            delay={50}
          />
          <StatCard
            label="今日变动"
            value={
              <span className="font-data tabular-nums text-neutral-500">&mdash;</span>
            }
            icon={Activity}
            delay={100}
          />
          <StatCard
            label="配置偏离"
            value={
              <span className="font-data tabular-nums text-neutral-500">&mdash;</span>
            }
            icon={AlertTriangle}
            delay={150}
          />
        </div>
      </section>

      {/* ── 3. Dual Pie Charts ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Category distribution */}
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <h3 className="text-base font-semibold text-neutral-50 mb-4">
              按类别分布
            </h3>
            {categoryPieData.length > 0 ? (
              <PieChart data={categoryPieData} />
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                暂无资产数据
              </div>
            )}
          </div>

          {/* Platform distribution */}
          <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
            <h3 className="text-base font-semibold text-neutral-50 mb-4">
              按平台分布
            </h3>
            {platformPieData.length > 0 ? (
              <PieChart data={platformPieData} />
            ) : (
              <div className="h-64 flex items-center justify-center text-neutral-500">
                暂无平台数据
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 4. Net Value Curve ── */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
        <div className="glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-neutral-50">
              组合净值历史
            </h3>
            <div className="flex gap-1">
              {HISTORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHistoryDays(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    historyDays === opt.value
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {lineData.length > 0 ? (
            <LineChart data={lineData} />
          ) : (
            <div className="h-64 flex items-center justify-center text-neutral-500">
              暂无历史数据
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Macro Indicator Badges ── */}
      {featuredIndicators.length > 0 && (
        <section className="relative max-w-[1400px] mx-auto px-6 pb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-neutral-400 mr-1">宏观指标</span>
            {featuredIndicators.map((ind) => (
              <MacroBadge
                key={ind.indicator_name}
                name={ind.indicator_name}
                value={ind.value}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── 6. Platform Overview Cards ── */}
      {platforms.length > 0 && (
        <section className="relative max-w-[1400px] mx-auto px-6 pb-16">
          <h3 className="text-base font-semibold text-neutral-50 mb-4">平台概览</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {platforms.map((p) => (
              <div
                key={p.displayName}
                className="glass scan-line rounded-lg p-4 border border-[rgba(100,140,255,0.1)] hover:border-[rgba(100,140,255,0.25)] transition-all"
              >
                <div className="flex items-center gap-2 mb-3">
                  {p.icon ? (
                    <span className="text-lg">{p.icon}</span>
                  ) : (
                    <div className="w-6 h-6 rounded bg-arena-surface flex items-center justify-center text-xs text-neutral-400">
                      {p.displayName.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-semibold text-neutral-50 truncate">
                    {p.displayName}
                  </span>
                </div>
                <div className="font-data tabular-nums text-lg font-bold text-neutral-50 mb-1">
                  {formatCurrency(getDisplayValue(p.valueUsd), currencyMode)}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={`font-data tabular-nums ${getProfitColorClass(p.profitUsd)}`}>
                    {formatPercent(p.profitPercent)}
                  </span>
                  <span className="text-neutral-500">
                    {p.holdingsCount} 持仓
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
