import { useEffect, useState, useMemo } from 'react'
import { Package, Search, ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { holdingsApi, platformsApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatNumber, getCategoryName, getCategoryColor } from '@/utils/format'

interface Holding {
  id: number
  symbol: string
  name: string
  category: string
  quantity: number
  cost_price: number
  cost_currency: string
  source: string
  notes: string | null
  platform_id: number
  platform_display_name: string
  sub_account_display_name: string
}

interface Platform {
  id: number
  name: string
  displayName: string
}

interface MergedHolding {
  symbol: string
  name: string
  category: string
  totalQuantity: number
  totalCost: number
  costCurrency: string
  entries: Holding[]
}

const CATEGORIES = [
  { value: 'all', label: '全部类别' },
  { value: 'crypto', label: '加密货币' },
  { value: 'stock', label: '股票基金' },
  { value: 'gold', label: '黄金' },
  { value: 'bond', label: '固定收益' },
  { value: 'commodity', label: '大宗商品' },
  { value: 'reit', label: '不动产/REITs' },
  { value: 'cash', label: '现金' },
]

export default function Holdings() {
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'CNY'>('USD')

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const [holdingsData, platformsData] = await Promise.all([
        execute(() => holdingsApi.getAll()),
        execute(() => platformsApi.getAll()),
      ])
      if (holdingsData) setHoldings(holdingsData as Holding[])
      if (platformsData) setPlatforms(platformsData as Platform[])
    } catch (err) {
      console.error('加载持仓数据失败:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  const merged = useMemo(() => {
    let filtered = holdings

    if (filterPlatform !== 'all') {
      filtered = filtered.filter(h => String(h.platform_id) === filterPlatform)
    }

    const map = new Map<string, MergedHolding>()
    for (const h of filtered) {
      const existing = map.get(h.symbol)
      if (existing) {
        existing.totalQuantity += h.quantity
        existing.totalCost += h.quantity * h.cost_price
        existing.entries.push(h)
      } else {
        map.set(h.symbol, {
          symbol: h.symbol,
          name: h.name,
          category: h.category,
          totalQuantity: h.quantity,
          totalCost: h.quantity * h.cost_price,
          costCurrency: h.cost_currency,
          entries: [h],
        })
      }
    }

    let result = Array.from(map.values())

    if (filterCategory !== 'all') {
      result = result.filter(m => m.category === filterCategory)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(m =>
        m.name.toLowerCase().includes(term) || m.symbol.toLowerCase().includes(term)
      )
    }

    return result
  }, [holdings, filterCategory, filterPlatform, searchTerm])

  const toggleExpand = (symbol: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
  }

  const computeAvgPrice = (m: MergedHolding): number => {
    if (m.totalQuantity === 0) return 0
    return m.totalCost / m.totalQuantity
  }

  const totalCost = merged.reduce((sum, m) => sum + m.totalCost, 0)

  return (
    <>
      {/* Hero */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Package className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">持仓一览</span>
              </h1>
              <p className="text-sm text-neutral-400">跨平台聚合视图</p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-arena-surface border border-[rgba(100,140,255,0.1)] p-0.5">
              <button
                onClick={() => setDisplayCurrency('USD')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${displayCurrency === 'USD' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                USD
              </button>
              <button
                onClick={() => setDisplayCurrency('CNY')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${displayCurrency === 'CNY' ? 'bg-primary text-white' : 'text-neutral-400 hover:text-neutral-200'}`}
              >
                CNY
              </button>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Content */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6 space-y-5">

        {/* Filter bar */}
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" strokeWidth={1.75} />
            <input
              type="text"
              placeholder="搜索代码或名称..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-arena-surface border border-[rgba(100,140,255,0.1)] focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 text-neutral-400">
            <Filter className="w-4 h-4" strokeWidth={1.75} />
          </div>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-arena-surface border border-[rgba(100,140,255,0.1)] text-sm font-medium"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <select
            value={filterPlatform}
            onChange={(e) => setFilterPlatform(e.target.value)}
            className="px-3 py-2 rounded-xl bg-arena-surface border border-[rgba(100,140,255,0.1)] text-sm font-medium"
          >
            <option value="all">全部平台</option>
            {platforms.map(p => (
              <option key={p.id} value={String(p.id)}>{p.displayName}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
            <p className="text-danger">{error}</p>
          </div>
        )}

        {/* Table */}
        <div className="glass rounded-lg border border-[rgba(100,140,255,0.1)] overflow-hidden">
          {loading && holdings.length === 0 ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-neutral-400">加载中...</p>
            </div>
          ) : merged.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-neutral-400">
                {holdings.length === 0 ? '暂无持仓数据' : '没有匹配的持仓'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[rgba(100,140,255,0.1)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider w-8" />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">资产</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">类别</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">总数量</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">均价</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-400 uppercase tracking-wider">总成本</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-400 uppercase tracking-wider">分布平台</th>
                  </tr>
                </thead>
                {merged.map((m) => {
                    const isExpanded = expandedSymbols.has(m.symbol)
                    const hasMultiple = m.entries.length > 1
                    const avgPrice = computeAvgPrice(m)
                    const uniquePlatforms = [...new Set(m.entries.map(e => e.platform_display_name))]

                    return (
                      <tbody key={m.symbol}>
                        {/* Merged row */}
                        <tr
                          className="border-b border-[rgba(100,140,255,0.05)] hover:bg-arena-hover/50 transition-colors cursor-pointer"
                          onClick={() => hasMultiple && toggleExpand(m.symbol)}
                        >
                          <td className="px-4 py-3 text-sm text-neutral-200">
                            {hasMultiple && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(m.symbol) }}
                                className="p-0.5 hover:bg-arena-hover rounded"
                              >
                                {isExpanded
                                  ? <ChevronDown className="w-4 h-4 text-neutral-400" />
                                  : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200">
                            <div>
                              <div className="font-medium text-neutral-50">{m.name}</div>
                              <div className="text-neutral-400 text-xs">{m.symbol}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(m.category) }} />
                              <span>{getCategoryName(m.category)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200 font-data tabular-nums text-right">
                            {formatNumber(m.totalQuantity, 6)}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200 font-data tabular-nums text-right">
                            {formatCurrency(avgPrice, displayCurrency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200 font-data tabular-nums text-right font-medium">
                            {formatCurrency(m.totalCost, displayCurrency)}
                          </td>
                          <td className="px-4 py-3 text-sm text-neutral-200">
                            <div className="flex flex-wrap gap-1.5">
                              {uniquePlatforms.map(name => (
                                <span
                                  key={name}
                                  className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-primary/20"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded sub-rows */}
                        {isExpanded && hasMultiple && m.entries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="bg-arena-surface/30 border-l-2 border-primary/30 border-b border-[rgba(100,140,255,0.03)]"
                          >
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 pl-10 text-sm">
                              <span className="text-neutral-400">{entry.platform_display_name}</span>
                              <span className="text-neutral-500 mx-1">/</span>
                              <span className="text-neutral-500 text-xs">{entry.sub_account_display_name}</span>
                            </td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-sm text-neutral-300 font-data tabular-nums text-right">
                              {formatNumber(entry.quantity, 6)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-neutral-300 font-data tabular-nums text-right">
                              {formatCurrency(entry.cost_price, displayCurrency)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-neutral-300 font-data tabular-nums text-right">
                              {formatCurrency(entry.quantity * entry.cost_price, displayCurrency)}
                            </td>
                            <td className="px-4 py-2.5 text-sm text-neutral-500 text-xs">
                              {entry.source === 'api_sync' ? '自动同步' : '手动录入'}
                              {entry.notes && <span className="ml-2">{entry.notes}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    )
                  })}
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        {merged.length > 0 && (
          <div className="flex items-center justify-between text-sm text-neutral-400 px-2">
            <span>共 {merged.length} 项资产（{merged.reduce((s, m) => s + m.entries.length, 0)} 笔持仓）</span>
            <span>总成本: {formatCurrency(totalCost, displayCurrency)}</span>
          </div>
        )}
      </section>
    </>
  )
}
