import { useEffect, useState } from 'react'
import {
  Scale, Settings, Target, AlertTriangle, CheckCircle, Clock, Plus, X, Save,
  ChevronDown, ChevronRight, ArrowRight, Zap, Ban, ClipboardList, Map,
  TrendingUp, TrendingDown, ShieldAlert, CheckCircle2, Trash2,
} from 'lucide-react'
import { rebalanceApi, plansApi, roadmapApi, useApi, api } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getCategoryName, getCategoryColor } from '@/utils/format'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RebalanceConfig {
  targets: Record<string, number>
  threshold: number
  cryptoTarget?: number
  stockTarget?: number
  goldTarget?: number
}

interface RebalanceSuggestion {
  category: string
  action: 'buy' | 'sell'
  amount: number
  currentPct: number
  targetPct: number
  deviation: number
  priority: 'high' | 'medium' | 'low'
}

interface RebalanceAnalysis {
  needsRebalancing: boolean
  maxDeviation: number
  suggestions: RebalanceSuggestion[]
  summary: string
}

interface Tranche {
  batch: number
  entry_low: number
  entry_high: number
  allocation_pct: number
  amount_usd: number
  status: 'pending' | 'executed' | 'skipped'
  executed_at: number | null
  actual_price: number | null
  notes: string | null
}

interface InvestmentPlan {
  id: number
  symbol: string
  name: string
  category: string
  direction: 'long' | 'short'
  total_target_usd: number | null
  status: 'planning' | 'active' | 'partial' | 'completed' | 'cancelled'
  tranches?: Tranche[]
  stop_loss: number | null
  stop_loss_note: string | null
  take_profit: number | null
  take_profit_note: string | null
  rationale: string | null
  created_at: number
  updated_at: number
}

interface RoadmapItem {
  id: number
  phase: string
  priority: 'high' | 'medium' | 'low'
  action: string
  category: string
  target_amount: number | null
  target_currency: string
  reason: string
  status: 'pending' | 'in_progress' | 'done' | 'skipped'
  deadline: string
  executed_at: number | null
  execution_notes: string | null
  created_at: number
}

interface PlanForm {
  symbol: string
  name: string
  category: string
  direction: string
  total_target_usd: string
  tranches: Tranche[]
  stop_loss: string
  stop_loss_note: string
  take_profit: string
  take_profit_note: string
  rationale: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'config' | 'plans' | 'roadmap'

const ALL_CATEGORIES = ['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit']

const planStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planning: { label: '规划中', color: 'text-slate-400 bg-slate-500/15 ring-slate-500/20', icon: Clock },
  active: { label: '进行中', color: 'text-blue-400 bg-blue-500/15 ring-blue-500/20', icon: Target },
  partial: { label: '部分执行', color: 'text-amber-400 bg-amber-500/15 ring-amber-500/20', icon: Zap },
  completed: { label: '已完成', color: 'text-emerald-400 bg-emerald-500/15 ring-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'text-red-400 bg-red-500/15 ring-red-500/20', icon: Ban },
}

const roadmapPriorityConfig = {
  high: { label: '高', color: 'text-rose-400', bg: 'bg-rose-500/10 ring-rose-500/20' },
  medium: { label: '中', color: 'text-amber-400', bg: 'bg-amber-500/10 ring-amber-500/20' },
  low: { label: '低', color: 'text-emerald-400', bg: 'bg-emerald-500/10 ring-emerald-500/20' },
}

const roadmapStatusConfig = {
  pending: { label: '待执行', icon: Clock, color: 'text-neutral-400' },
  in_progress: { label: '执行中', icon: ArrowRight, color: 'text-primary' },
  done: { label: '已完成', icon: CheckCircle, color: 'text-emerald-400' },
  skipped: { label: '已跳过', icon: AlertTriangle, color: 'text-amber-400' },
}

const emptyTranche = (): Tranche => ({
  batch: 1, entry_low: 0, entry_high: 0, allocation_pct: 0, amount_usd: 0,
  status: 'pending', executed_at: null, actual_price: null, notes: null,
})

const emptyPlanForm: PlanForm = {
  symbol: '', name: '', category: 'crypto', direction: 'long', total_target_usd: '',
  tranches: [emptyTranche()], stop_loss: '', stop_loss_note: '', take_profit: '', take_profit_note: '', rationale: '',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeConfig(raw: Record<string, unknown>): RebalanceConfig {
  if (raw.targets && typeof raw.targets === 'object') {
    return { targets: { ...(raw.targets as Record<string, number>) }, threshold: (raw.threshold as number) ?? 0.05 }
  }
  const targets: Record<string, number> = {}
  if (raw.cryptoTarget != null) targets.crypto = raw.cryptoTarget as number
  if (raw.stockTarget != null) targets.stock = raw.stockTarget as number
  if (raw.goldTarget != null) targets.gold = raw.goldTarget as number
  if (raw.crypto != null && targets.crypto == null) targets.crypto = raw.crypto as number
  if (raw.stock != null && targets.stock == null) targets.stock = raw.stock as number
  if (raw.gold != null && targets.gold == null) targets.gold = raw.gold as number
  return { targets, threshold: (raw.threshold as number) ?? 0.05 }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Allocation() {
  const [activeTab, setActiveTab] = useState<TabKey>('config')

  // --- Tab 1: Rebalance state ---
  const [config, setConfig] = useState<RebalanceConfig | null>(null)
  const [analysis, setAnalysis] = useState<RebalanceAnalysis | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tempTargets, setTempTargets] = useState<Record<string, number>>({ crypto: 0.4, stock: 0.4, gold: 0.2 })
  const [tempThreshold, setTempThreshold] = useState(0.05)
  const [newCategoryKey, setNewCategoryKey] = useState('')

  // --- Tab 2: Investment plans state ---
  const [plans, setPlans] = useState<InvestmentPlan[]>([])
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({})
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showPlanForm, setShowPlanForm] = useState(false)
  const [planFormError, setPlanFormError] = useState('')
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm)
  const [executeModal, setExecuteModal] = useState<{ planId: number; trancheIndex: number; tranche: Tranche } | null>(null)
  const [executePrice, setExecutePrice] = useState('')

  // --- Tab 3: Roadmap state ---
  const [roadmapItems, setRoadmapItems] = useState<RoadmapItem[]>([])
  const [roadmapGrouped, setRoadmapGrouped] = useState<Record<string, RoadmapItem[]>>({})
  const [selectedRoadmapItem, setSelectedRoadmapItem] = useState<RoadmapItem | null>(null)
  const [executionNote, setExecutionNote] = useState('')
  const [showAddRoadmap, setShowAddRoadmap] = useState(false)
  const [newRoadmapItem, setNewRoadmapItem] = useState({ phase: '短期(1个月)', priority: 'medium', action: '', category: '', reason: '', deadline: '' })

  const { loading, error, execute } = useApi()

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadRebalanceData = async () => {
    try {
      const [configData, analysisData] = await Promise.all([
        execute(() => rebalanceApi.getConfig()),
        execute(() => rebalanceApi.getSuggestions()),
      ])
      if (configData) {
        const normalized = normalizeConfig(configData as Record<string, unknown>)
        setConfig(normalized)
        setTempTargets({ ...normalized.targets })
        setTempThreshold(normalized.threshold)
      }
      if (analysisData) setAnalysis(analysisData as RebalanceAnalysis)
    } catch (err) {
      console.error('加载再平衡数据失败:', err)
    }
  }

  const loadPlansData = async () => {
    try {
      const data = await execute(() => plansApi.getAll())
      if (data) {
        const planList = Array.isArray(data) ? data : []
        setPlans(planList)
        // 获取每个计划标的的当前价格
        const symbols = [...new Set(planList.map(p => p.symbol))]
        const prices: Record<string, number> = {}
        await Promise.all(symbols.map(async (sym) => {
          try {
            const resp = await api.get(`/prices/${encodeURIComponent(sym)}`)
            const d = (resp.data as any)?.data
            if (d?.price) prices[sym] = d.price
          } catch { /* ignore */ }
        }))
        setPlanPrices(prices)
      }
    } catch (err) {
      console.error('加载投资计划失败:', err)
    }
  }

  const loadRoadmapData = async () => {
    try {
      const roadmap = await execute(() => roadmapApi.getRoadmap())
      if (roadmap) {
        const r = roadmap as { items?: RoadmapItem[]; grouped?: Record<string, RoadmapItem[]> }
        if (r.items) {
          setRoadmapItems(r.items)
          setRoadmapGrouped(r.grouped || {})
        }
      }
    } catch (err) {
      console.error('加载路线图失败:', err)
    }
  }

  useEffect(() => {
    loadRebalanceData()
    loadPlansData()
    loadRoadmapData()
  }, [])

  // -------------------------------------------------------------------------
  // Tab 1 handlers
  // -------------------------------------------------------------------------

  const handleSaveConfig = async () => {
    try {
      await execute(() => rebalanceApi.updateConfig({ targets: tempTargets, threshold: tempThreshold } as Record<string, unknown>))
      setConfig({ targets: { ...tempTargets }, threshold: tempThreshold })
      setShowSettings(false)
      loadRebalanceData()
    } catch (err) {
      console.error('保存配置失败:', err)
    }
  }

  const handleExecuteRebalance = async () => {
    if (!confirm('确定要记录此次再平衡执行吗？')) return
    try {
      await execute(() => rebalanceApi.execute('手动执行'))
      loadRebalanceData()
    } catch (err) {
      console.error('记录再平衡失败:', err)
    }
  }

  const targetsSum = Object.values(tempTargets).reduce((s, v) => s + v, 0)
  const cashRemaining = Math.max(0, 1 - targetsSum)

  const handleAddCategory = () => {
    if (!newCategoryKey || newCategoryKey in tempTargets) return
    setTempTargets(prev => ({ ...prev, [newCategoryKey]: 0 }))
    setNewCategoryKey('')
  }

  const handleRemoveCategory = (key: string) => {
    setTempTargets(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const availableCategories = ALL_CATEGORIES.filter(c => !(c in tempTargets))

  // -------------------------------------------------------------------------
  // Tab 2 handlers
  // -------------------------------------------------------------------------

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleAddTranche = () => {
    setPlanForm(prev => ({
      ...prev,
      tranches: [...prev.tranches, { ...emptyTranche(), batch: prev.tranches.length + 1 }],
    }))
  }

  const handleRemoveTranche = (idx: number) => {
    setPlanForm(prev => ({
      ...prev,
      tranches: prev.tranches.filter((_, i) => i !== idx).map((t, i) => ({ ...t, batch: i + 1 })),
    }))
  }

  const handleTrancheChange = (idx: number, field: keyof Tranche, value: string | number) => {
    setPlanForm(prev => ({
      ...prev,
      tranches: prev.tranches.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }))
  }

  const handleCreatePlan = async () => {
    setPlanFormError('')
    if (!planForm.symbol.trim()) { setPlanFormError('请输入标的代码'); return }
    if (!planForm.name.trim()) { setPlanFormError('请输入名称'); return }

    const tranches = planForm.tranches.map(t => ({
      ...t,
      entry_low: Number(t.entry_low) || 0, entry_high: Number(t.entry_high) || 0,
      allocation_pct: Number(t.allocation_pct) || 0, amount_usd: Number(t.amount_usd) || 0,
      notes: t.notes || null,
    }))

    try {
      await execute(() => plansApi.create({
        symbol: planForm.symbol.trim().toUpperCase(),
        name: planForm.name.trim(),
        category: planForm.category,
        direction: planForm.direction,
        total_target_usd: planForm.total_target_usd ? parseFloat(planForm.total_target_usd) : undefined,
        tranches_json: tranches,
        stop_loss: planForm.stop_loss ? parseFloat(planForm.stop_loss) : undefined,
        stop_loss_note: planForm.stop_loss_note || undefined,
        take_profit: planForm.take_profit ? parseFloat(planForm.take_profit) : undefined,
        take_profit_note: planForm.take_profit_note || undefined,
        rationale: planForm.rationale || undefined,
      }))
      setShowPlanForm(false)
      setPlanForm(emptyPlanForm)
      await loadPlansData()
    } catch (err) {
      setPlanFormError('创建失败')
    }
  }

  const handleDeletePlan = async (id: number) => {
    if (!confirm('确定删除此投资计划？')) return
    try {
      await execute(() => plansApi.delete(id))
      await loadPlansData()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const handleExecuteTranche = async () => {
    if (!executeModal) return
    const price = parseFloat(executePrice)
    if (isNaN(price) || price <= 0) return
    try {
      await execute(() => plansApi.executeTranche(executeModal.planId, executeModal.trancheIndex, price))
      setExecuteModal(null)
      setExecutePrice('')
      await loadPlansData()
    } catch (err) {
      console.error('执行批次失败:', err)
    }
  }

  const handlePlanStatusChange = async (planId: number, newStatus: string) => {
    try {
      await execute(() => plansApi.update(planId, { status: newStatus }))
      await loadPlansData()
    } catch (err) {
      console.error('状态更新失败:', err)
    }
  }

  // -------------------------------------------------------------------------
  // Tab 3 handlers
  // -------------------------------------------------------------------------

  const handleRoadmapStatusUpdate = async (id: number, status: string, notes?: string) => {
    await execute(() => roadmapApi.updateItem(id, { status, execution_notes: notes }))
    setSelectedRoadmapItem(null)
    setExecutionNote('')
    await loadRoadmapData()
  }

  const handleAddRoadmapItem = async () => {
    if (!newRoadmapItem.action) return
    await execute(() => roadmapApi.addItem(newRoadmapItem))
    setShowAddRoadmap(false)
    setNewRoadmapItem({ phase: '短期(1个月)', priority: 'medium', action: '', category: '', reason: '', deadline: '' })
    await loadRoadmapData()
  }

  const roadmapStats = {
    total: roadmapItems.length,
    done: roadmapItems.filter(i => i.status === 'done').length,
    pending: roadmapItems.filter(i => i.status === 'pending').length,
    progress: roadmapItems.length > 0 ? Math.round(roadmapItems.filter(i => i.status === 'done').length / roadmapItems.length * 100) : 0,
  }

  // -------------------------------------------------------------------------
  // Tab button helper
  // -------------------------------------------------------------------------

  const tabButton = (key: TabKey, label: string) => (
    <button
      key={key}
      onClick={() => setActiveTab(key)}
      className={activeTab === key
        ? 'px-5 py-2 rounded-lg text-sm font-semibold bg-primary-soft text-primary shadow-sm'
        : 'px-5 py-2 rounded-lg text-sm font-semibold text-neutral-400 hover:text-neutral-200'}
    >
      {label}
    </button>
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* Hero */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">配置管理</span>
              </h1>
              <p className="text-sm text-neutral-400">目标配比 · 再平衡建议 · 建仓计划</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/80 text-sm font-medium"
            >
              <Settings className="w-4 h-4" strokeWidth={1.75} />
              <span>配置目标</span>
            </button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Tabs */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex bg-arena-surface rounded-xl p-1 border border-[rgba(100,140,255,0.08)]">
          {tabButton('config', '当前配置')}
          {tabButton('plans', '建仓计划')}
          {tabButton('roadmap', '执行路线图')}
        </div>
      </section>

      {/* Error */}
      {error && (
        <section className="relative max-w-[1400px] mx-auto px-6">
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Tab 1: 当前配置 */}
      {/* ================================================================= */}
      {activeTab === 'config' && (
        <section className="relative max-w-[1400px] mx-auto px-6 py-6 space-y-5">
          {/* Target allocation stat-cards */}
          {config && (
            <div className={`grid grid-cols-2 gap-4 ${
              Object.keys(config.targets).length <= 4
                ? 'md:grid-cols-' + (Object.keys(config.targets).length + 1)
                : 'md:grid-cols-4'
            }`}>
              {Object.entries(config.targets).map(([key, value], i) => (
                <div key={key} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="flex items-start justify-between">
                    <div className="flex size-10 items-center justify-center rounded-full" style={{ background: `${getCategoryColor(key)}1f` }}>
                      <Target className="size-5" style={{ color: getCategoryColor(key) }} strokeWidth={1.75} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="font-data text-2xl font-bold tracking-tight" style={{ color: getCategoryColor(key) }}>
                      {(value * 100).toFixed(0)}%
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">{getCategoryName(key)}</p>
                  </div>
                </div>
              ))}
              <div className="stat-card animate-fade-in-up" style={{ animationDelay: `${Object.keys(config.targets).length * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-full bg-neutral-500/10">
                    <AlertTriangle className="size-5 text-neutral-400" strokeWidth={1.75} />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="font-data text-2xl font-bold tracking-tight text-neutral-50">
                    {(config.threshold * 100).toFixed(0)}%
                  </div>
                  <p className="mt-1 text-sm text-neutral-400">偏离阈值</p>
                </div>
              </div>
            </div>
          )}

          {/* Status banner + suggestions */}
          {analysis && (
            <>
              <div
                className={`glass scan-line rounded-lg p-5 border ${
                  analysis.needsRebalancing
                    ? 'border-amber-500/20'
                    : 'border-emerald-500/20'
                }`}
                style={analysis.needsRebalancing
                  ? { borderColor: 'rgba(245,158,11,0.2)', boxShadow: 'inset 0 0 20px rgba(245,158,11,0.05), 0 0 20px rgba(245,158,11,0.05)' }
                  : { borderColor: 'rgba(16,185,129,0.2)', boxShadow: 'inset 0 0 20px rgba(16,185,129,0.05), 0 0 20px rgba(16,185,129,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex size-12 items-center justify-center rounded-full ${
                      analysis.needsRebalancing ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                    }`}>
                      {analysis.needsRebalancing
                        ? <AlertTriangle className="size-6 text-amber-400" strokeWidth={1.75} />
                        : <CheckCircle className="size-6 text-emerald-400" strokeWidth={1.75} />}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-neutral-50">
                        {analysis.needsRebalancing ? '需要调整' : '配置均衡'}
                      </div>
                      <div className="text-sm text-neutral-400">
                        最大偏离 <span className={`font-data font-semibold ${
                          analysis.maxDeviation > (config?.threshold || 0.05) ? 'text-amber-400' : 'text-emerald-400'
                        }`}>{formatPercent(analysis.maxDeviation * 100, 1)}</span>
                        {config && <span className="text-neutral-500"> / 阈值 {(config.threshold * 100).toFixed(0)}%</span>}
                      </div>
                    </div>
                  </div>
                  {analysis.needsRebalancing && (
                    <button
                      onClick={handleExecuteRebalance}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
                    >
                      记录执行再平衡
                    </button>
                  )}
                </div>
              </div>

              {analysis.suggestions && analysis.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-neutral-50">调仓建议</h3>
                  {analysis.suggestions.map((suggestion, index) => {
                    const isBuy = suggestion.action === 'buy'
                    const color = getCategoryColor(suggestion.category)
                    return (
                      <div
                        key={index}
                        className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] p-4 hover:border-[rgba(100,140,255,0.25)] transition-all animate-fade-in-up"
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3 min-w-[140px]">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                            <div>
                              <div className="font-medium text-neutral-50">{getCategoryName(suggestion.category)}</div>
                              <div className={`text-xs font-semibold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isBuy ? '买入' : '卖出'}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 mx-4">
                            <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                              <span>当前 {(suggestion.currentPct * 100).toFixed(1)}%</span>
                              <span>目标 {(suggestion.targetPct * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-2 bg-arena-surface rounded-full overflow-hidden relative">
                              <div
                                className="absolute inset-y-0 left-0 rounded-full opacity-40"
                                style={{ width: `${Math.min(suggestion.currentPct * 100 / Math.max(suggestion.targetPct, suggestion.currentPct) * 100, 100)}%`, backgroundColor: color }}
                              />
                              <div
                                className="absolute inset-y-0 left-0 rounded-full border-r-2 border-white/60"
                                style={{ width: `${Math.min(suggestion.targetPct * 100 / Math.max(suggestion.targetPct, suggestion.currentPct) * 100, 100)}%`, backgroundColor: `${color}40` }}
                              />
                            </div>
                          </div>
                          <div className="text-right min-w-[120px]">
                            <div className={`font-data text-lg font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isBuy ? '+' : '-'}{formatCurrency(Math.abs(suggestion.amount), 'USD')}
                            </div>
                            <div className="text-xs text-neutral-500">
                              偏离 {formatPercent(suggestion.deviation * 100, 1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* Tab 2: 建仓计划 */}
      {/* ================================================================= */}
      {activeTab === 'plans' && (
        <section className="relative max-w-[1400px] mx-auto px-6 py-6 space-y-5">
          {/* Header with add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" strokeWidth={1.75} />
              <h2 className="text-lg font-semibold text-neutral-50">投资计划</h2>
            </div>
            <button
              onClick={() => { setShowPlanForm(true); setPlanForm(emptyPlanForm); setPlanFormError('') }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-sm font-medium"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} /><span>新建计划</span>
            </button>
          </div>

          {/* Progress bar */}
          {plans.length > 0 && (() => {
            const totalPlans = plans.length
            const completedPlans = plans.filter(p => p.status === 'completed').length
            const completedPct = Math.round((completedPlans / totalPlans) * 100)
            return (
              <div className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-neutral-400">整体完成度</span>
                  <span className="text-sm font-medium text-neutral-50">{completedPlans}/{totalPlans} ({completedPct}%)</span>
                </div>
                <div className="w-full bg-arena-surface rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full transition-all duration-500" style={{ width: `${completedPct}%` }} />
                </div>
              </div>
            )
          })()}

          {/* Plan cards */}
          {plans.length === 0 ? (
            <div className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] p-12 text-center text-neutral-400">
              <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-40" strokeWidth={1.5} />
              <p>暂无投资计划</p>
              <p className="text-sm mt-2">点击「新建计划」创建分批建仓计划</p>
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map(plan => {
                const tranches = plan.tranches || []
                const executedCount = tranches.filter(t => t.status === 'executed').length
                const totalTranches = tranches.length
                const tranchePct = totalTranches > 0 ? Math.round((executedCount / totalTranches) * 100) : 0
                const isExpanded = expandedIds.has(plan.id)
                const status = planStatusConfig[plan.status] || planStatusConfig.planning
                const StatusIcon = status.icon

                return (
                  <div key={plan.id} className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] overflow-hidden">
                    {/* Card Header */}
                    <div className="p-4 cursor-pointer hover:bg-arena-hover transition-colors" onClick={() => toggleExpand(plan.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" strokeWidth={1.75} />
                            : <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" strokeWidth={1.75} />}
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(plan.category) }} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-neutral-50">{plan.name}</span>
                              <span className="text-sm text-neutral-400">{plan.symbol}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-md bg-arena-surface text-neutral-400">
                                {getCategoryName(plan.category)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {plan.direction === 'long' ? (
                                <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400">
                                  <TrendingUp className="w-3 h-3" strokeWidth={2} /> Long
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-xs text-red-400">
                                  <TrendingDown className="w-3 h-3" strokeWidth={2} /> Short
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-md ring-1 ${status.color}`}>
                                <StatusIcon className="w-3 h-3" strokeWidth={2} />
                                {status.label}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="hidden sm:flex items-center gap-3 text-xs">
                            {/* 当前价格 */}
                            {planPrices[plan.symbol] != null && (
                              <span className="flex items-center gap-1 text-primary font-data tabular-nums" title="当前价格">
                                现价 {planPrices[plan.symbol].toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              </span>
                            )}
                            {plan.stop_loss != null && (
                              <span className="flex items-center gap-1 text-red-400" title={plan.stop_loss_note || '止损'}>
                                <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
                                {plan.stop_loss.toLocaleString()}
                              </span>
                            )}
                            {plan.take_profit != null && (
                              <span className="flex items-center gap-1 text-emerald-400" title={plan.take_profit_note || '止盈'}>
                                <Target className="w-3.5 h-3.5" strokeWidth={1.75} />
                                {plan.take_profit.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {totalTranches > 0 && (
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <div className="flex-1 bg-arena-surface rounded-full h-1.5">
                                <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${tranchePct}%` }} />
                              </div>
                              <span className="text-xs text-neutral-400 tabular-nums whitespace-nowrap">
                                {executedCount}/{totalTranches}
                              </span>
                            </div>
                          )}
                          {plan.total_target_usd != null && plan.total_target_usd > 0 && (
                            <span className="text-sm font-medium text-neutral-50 tabular-nums whitespace-nowrap">
                              {formatCurrency(plan.total_target_usd)}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id) }}
                            className="p-1.5 hover:bg-danger/10 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4 text-danger/70 hover:text-danger" strokeWidth={1.75} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-[rgba(100,140,255,0.08)] px-4 pb-4">
                        {plan.rationale && (
                          <div className="pt-3 pb-2">
                            <div className="text-sm">
                              <span className="text-neutral-400">备注: </span>
                              <span className="text-neutral-50">{plan.rationale}</span>
                            </div>
                          </div>
                        )}
                        <div className="sm:hidden pt-2 pb-2 flex gap-4 text-xs">
                          {plan.stop_loss != null && (
                            <span className="flex items-center gap-1 text-red-400">
                              <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
                              止损 ${plan.stop_loss.toLocaleString()}
                              {plan.stop_loss_note && <span className="text-neutral-400 ml-1">({plan.stop_loss_note})</span>}
                            </span>
                          )}
                          {plan.take_profit != null && (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <Target className="w-3.5 h-3.5" strokeWidth={1.75} />
                              止盈 ${plan.take_profit.toLocaleString()}
                              {plan.take_profit_note && <span className="text-neutral-400 ml-1">({plan.take_profit_note})</span>}
                            </span>
                          )}
                        </div>
                        {/* Status change buttons */}
                        <div className="pt-2 pb-3 flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-neutral-400 mr-1">切换状态:</span>
                          {(['planning', 'active', 'partial', 'completed', 'cancelled'] as const).map(s => {
                            const sc = planStatusConfig[s]
                            return (
                              <button
                                key={s}
                                onClick={() => handlePlanStatusChange(plan.id, s)}
                                disabled={plan.status === s}
                                className={`text-xs px-2 py-1 rounded-lg ring-1 transition-colors disabled:opacity-40 ${
                                  plan.status === s ? sc.color : 'text-neutral-400 ring-[rgba(100,140,255,0.08)] hover:bg-arena-hover'
                                }`}
                              >
                                {sc.label}
                              </button>
                            )
                          })}
                        </div>
                        {/* Tranches Table */}
                        {tranches.length > 0 ? (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[rgba(100,140,255,0.08)]">
                                  <th className="py-2 px-2 text-left text-xs text-neutral-400 font-medium">批次</th>
                                  <th className="py-2 px-2 text-right text-xs text-neutral-400 font-medium">入场区间</th>
                                  <th className="py-2 px-2 text-right text-xs text-neutral-400 font-medium">距离</th>
                                  <th className="py-2 px-2 text-right text-xs text-neutral-400 font-medium">配比</th>
                                  <th className="py-2 px-2 text-right text-xs text-neutral-400 font-medium">金额</th>
                                  <th className="py-2 px-2 text-center text-xs text-neutral-400 font-medium">状态</th>
                                  <th className="py-2 px-2 text-right text-xs text-neutral-400 font-medium">成交价</th>
                                  <th className="py-2 px-2 text-left text-xs text-neutral-400 font-medium">备注</th>
                                  <th className="py-2 px-2 text-center text-xs text-neutral-400 font-medium">操作</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tranches.map((t, idx) => (
                                  <tr key={idx} className={`border-b border-[rgba(100,140,255,0.08)] ${t.status === 'executed' ? 'bg-emerald-500/5' : ''}`}>
                                    <td className="py-2 px-2 text-neutral-50 font-medium">#{t.batch}</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-neutral-50">
                                      {t.entry_low?.toLocaleString()} - {t.entry_high?.toLocaleString()}
                                    </td>
                                    <td className="py-2 px-2 text-right tabular-nums text-xs">
                                      {(() => {
                                        const curPrice = planPrices[plan.symbol]
                                        if (!curPrice || !t.entry_low || !t.entry_high || t.status === 'executed') return <span className="text-neutral-500">—</span>
                                        const midEntry = (t.entry_low + t.entry_high) / 2
                                        const isLong = plan.direction === 'long'
                                        // For long: negative distance means price is below entry (good); For short: positive means above entry (good)
                                        const distPct = ((curPrice - midEntry) / midEntry) * 100
                                        const inZone = curPrice >= t.entry_low && curPrice <= t.entry_high
                                        const isReady = isLong ? curPrice <= t.entry_high : curPrice >= t.entry_low
                                        if (inZone) return <span className="text-emerald-400 font-semibold">在区间内!</span>
                                        return (
                                          <span className={isReady ? 'text-amber-400' : 'text-neutral-400'}>
                                            {distPct > 0 ? '+' : ''}{distPct.toFixed(1)}%
                                          </span>
                                        )
                                      })()}
                                    </td>
                                    <td className="py-2 px-2 text-right tabular-nums text-neutral-50">{t.allocation_pct}%</td>
                                    <td className="py-2 px-2 text-right tabular-nums text-neutral-50">
                                      {t.amount_usd > 0 ? `$${t.amount_usd.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      {t.status === 'executed' ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20">已执行</span>
                                      ) : t.status === 'skipped' ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20">已跳过</span>
                                      ) : (
                                        <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20">待执行</span>
                                      )}
                                    </td>
                                    <td className="py-2 px-2 text-right tabular-nums">
                                      {t.actual_price != null
                                        ? <span className="text-emerald-400">${t.actual_price.toLocaleString()}</span>
                                        : <span className="text-neutral-400">-</span>}
                                    </td>
                                    <td className="py-2 px-2 text-neutral-400 text-xs max-w-[150px] truncate">{t.notes || '-'}</td>
                                    <td className="py-2 px-2 text-center">
                                      {t.status === 'pending' && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setExecuteModal({ planId: plan.id, trancheIndex: idx, tranche: t })
                                            setExecutePrice('')
                                          }}
                                          className="text-xs px-2 py-1 rounded-lg bg-primary-soft text-primary hover:bg-primary/25 transition-colors"
                                        >
                                          执行
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="py-4 text-center text-sm text-neutral-400">暂无分批数据</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* ================================================================= */}
      {/* Tab 3: 执行路线图 */}
      {/* ================================================================= */}
      {activeTab === 'roadmap' && (
        <section className="relative max-w-[1400px] mx-auto px-6 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-5 h-5 text-primary" strokeWidth={1.75} />
              <h2 className="text-lg font-semibold text-neutral-50">执行路线图</h2>
            </div>
            <button
              onClick={() => setShowAddRoadmap(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-sm font-medium"
            >
              <Plus className="w-4 h-4" strokeWidth={1.75} /><span>添加计划</span>
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="glass scan-line p-4 rounded-lg border border-[rgba(100,140,255,0.1)]">
              <div className="text-sm text-neutral-400 font-medium">总计划</div>
              <div className="text-xl font-bold text-neutral-50 mt-1">{roadmapStats.total}</div>
            </div>
            <div className="glass scan-line p-4 rounded-lg border border-[rgba(100,140,255,0.1)]">
              <div className="text-sm text-neutral-400 font-medium">已完成</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{roadmapStats.done}</div>
            </div>
            <div className="glass scan-line p-4 rounded-lg border border-[rgba(100,140,255,0.1)]">
              <div className="text-sm text-neutral-400 font-medium">待执行</div>
              <div className="text-xl font-bold text-amber-400 mt-1">{roadmapStats.pending}</div>
            </div>
            <div className="glass scan-line p-4 rounded-lg border border-[rgba(100,140,255,0.1)]">
              <div className="text-sm text-neutral-400 font-medium">完成率</div>
              <div className="text-xl font-bold text-primary mt-1">{roadmapStats.progress}%</div>
              <div className="mt-2 h-1.5 bg-arena-surface rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${roadmapStats.progress}%` }} />
              </div>
            </div>
          </div>

          {/* Grouped by phase */}
          <div className="space-y-4">
            {Object.entries(roadmapGrouped).map(([phase, phaseItems]) => (
              <div key={phase} className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[rgba(100,140,255,0.1)] bg-arena-surface/50">
                  <h3 className="text-lg font-semibold text-neutral-50">{phase}</h3>
                  <p className="text-sm text-neutral-400">
                    {phaseItems.filter(i => i.status === 'done').length}/{phaseItems.length} 完成
                  </p>
                </div>
                <div className="divide-y divide-[rgba(100,140,255,0.1)]">
                  {phaseItems.map(item => {
                    const statusCfg = roadmapStatusConfig[item.status]
                    const priorityCfg = roadmapPriorityConfig[item.priority]
                    const StatusIcon = statusCfg.icon

                    return (
                      <div key={item.id} className={`px-6 py-4 flex items-start justify-between ${item.status === 'done' ? 'opacity-60' : ''}`}>
                        <div className="flex items-start space-x-4 flex-1">
                          <StatusIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${statusCfg.color}`} strokeWidth={1.75} />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              {item.category && (
                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                              )}
                              <span className={`font-medium ${item.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-50'}`}>
                                {item.action}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-lg ring-1 ${priorityCfg.bg}`}>
                                {priorityCfg.label}优先
                              </span>
                            </div>
                            {item.reason && <p className="text-sm text-neutral-400 mt-1">{item.reason}</p>}
                            {item.target_amount && (
                              <p className="text-sm text-primary mt-1">
                                目标: {item.target_amount > 0 ? '+' : ''}{item.target_currency === 'USD' ? '$' : '¥'}{Math.abs(item.target_amount).toLocaleString()}
                              </p>
                            )}
                            {item.execution_notes && (
                              <p className="text-sm text-emerald-400 mt-1">{item.execution_notes}</p>
                            )}
                            {item.deadline && (
                              <p className="text-xs text-neutral-400 mt-1">截止: {item.deadline}</p>
                            )}
                          </div>
                        </div>
                        {item.status !== 'done' && (
                          <div className="flex items-center space-x-2 ml-4">
                            {item.status === 'pending' && (
                              <button
                                onClick={() => handleRoadmapStatusUpdate(item.id, 'in_progress')}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 hover:bg-primary/25"
                              >
                                开始
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedRoadmapItem(item); setExecutionNote('') }}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/25"
                            >
                              完成
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================================================================= */}
      {/* Modals */}
      {/* ================================================================= */}

      {/* Config modal (Tab 1) */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-md w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-neutral-50 mb-4">配置目标配比</h3>
            <div className="space-y-4">
              {Object.entries(tempTargets).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-neutral-50">
                      {getCategoryName(key)} 目标比例 ({(value * 100).toFixed(0)}%)
                    </label>
                    <button
                      onClick={() => handleRemoveCategory(key)}
                      className="p-1 hover:bg-danger/10 rounded text-neutral-400 hover:text-danger transition-colors"
                      title="移除此类别"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(key) }} />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={value}
                      onChange={(e) => setTempTargets(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}

              {availableCategories.length > 0 && (
                <div className="border-t border-[rgba(100,140,255,0.1)] pt-4">
                  <label className="block text-sm font-medium text-neutral-50 mb-2">添加类别目标</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={newCategoryKey}
                      onChange={(e) => setNewCategoryKey(e.target.value)}
                      className="flex-1 px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md text-sm"
                    >
                      <option value="">选择类别...</option>
                      {availableCategories.map(c => (
                        <option key={c} value={c}>{getCategoryName(c)}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryKey}
                      className="flex items-center gap-1 px-3 py-2 bg-primary text-white rounded-md hover:bg-primary/80 disabled:opacity-50 text-sm"
                    >
                      <Plus className="w-4 h-4" /><span>添加</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-[rgba(100,140,255,0.1)] pt-4">
                <label className="block text-sm font-medium text-neutral-50 mb-1">
                  偏离阈值 ({(tempThreshold * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={tempThreshold}
                  onChange={(e) => setTempThreshold(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="text-sm text-neutral-400 space-y-1">
                <div className="flex justify-between">
                  <span>已分配比例:</span>
                  <span className={targetsSum > 1.01 ? 'text-danger font-medium' : ''}>
                    {(targetsSum * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>剩余（现金）:</span>
                  <span style={{ color: getCategoryColor('cash') }}>
                    {(cashRemaining * 100).toFixed(0)}%
                  </span>
                </div>
                {targetsSum > 1.01 && (
                  <span className="text-danger">总比例超过100%，请调整</span>
                )}
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSettings(false)
                  if (config) {
                    setTempTargets({ ...config.targets })
                    setTempThreshold(config.threshold)
                  }
                }}
                className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md hover:bg-arena-hover transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={targetsSum > 1.01}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Execute tranche modal (Tab 2) */}
      {executeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-sm w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">执行批次 #{executeModal.tranche.batch}</h3>
              <button onClick={() => setExecuteModal(null)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="text-sm text-neutral-400">
                入场区间: ${executeModal.tranche.entry_low?.toLocaleString()} - ${executeModal.tranche.entry_high?.toLocaleString()}
              </div>
              <div className="text-sm text-neutral-400">
                计划金额: ${executeModal.tranche.amount_usd?.toLocaleString()}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">实际成交价</label>
                <div className="flex items-center">
                  <span className="px-2 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-l-md text-sm">$</span>
                  <input
                    type="number"
                    step="any"
                    value={executePrice}
                    onChange={e => setExecutePrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] border-l-0 rounded-r-md"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setExecuteModal(null)} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md text-sm">
                取消
              </button>
              <button
                onClick={handleExecuteTranche}
                disabled={loading || !executePrice || parseFloat(executePrice) <= 0}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm disabled:opacity-50 hover:bg-emerald-500"
              >
                <CheckCircle2 className="w-4 h-4" /> 确认执行
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add plan modal (Tab 2) */}
      {showPlanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-2xl w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">新建投资计划</h3>
              <button onClick={() => setShowPlanForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            {planFormError && <div className="mb-4 p-3 bg-danger/10 rounded-md text-danger text-sm">{planFormError}</div>}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">标的代码 *</label>
                  <input
                    value={planForm.symbol}
                    onChange={e => setPlanForm(p => ({ ...p, symbol: e.target.value }))}
                    placeholder="如 BTCUSDT"
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">名称 *</label>
                  <input
                    value={planForm.name}
                    onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="如 比特币"
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">类别</label>
                  <select
                    value={planForm.category}
                    onChange={e => setPlanForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                  >
                    <option value="crypto">加密货币</option>
                    <option value="stock">股票基金</option>
                    <option value="gold">黄金</option>
                    <option value="bond">固定收益</option>
                    <option value="commodity">大宗商品</option>
                    <option value="reit">不动产/REITs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">方向</label>
                  <select
                    value={planForm.direction}
                    onChange={e => setPlanForm(p => ({ ...p, direction: e.target.value }))}
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                  >
                    <option value="long">做多 (Long)</option>
                    <option value="short">做空 (Short)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">总目标金额 (USD)</label>
                  <input
                    type="number"
                    step="any"
                    value={planForm.total_target_usd}
                    onChange={e => setPlanForm(p => ({ ...p, total_target_usd: e.target.value }))}
                    placeholder="如 10000"
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                  />
                </div>
              </div>

              {/* Tranches */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">分批计划</label>
                  <button type="button" onClick={handleAddTranche} className="text-xs px-2 py-1 rounded-lg bg-primary-soft text-primary hover:bg-primary/25">
                    + 添加批次
                  </button>
                </div>
                <div className="space-y-2">
                  {planForm.tranches.map((t, idx) => (
                    <div key={idx} className="bg-arena-surface rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-neutral-400">批次 #{t.batch}</span>
                        {planForm.tranches.length > 1 && (
                          <button type="button" onClick={() => handleRemoveTranche(idx)} className="text-xs text-danger/70 hover:text-danger">
                            移除
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs text-neutral-400 mb-0.5">入场低价</label>
                          <input type="number" step="any" value={t.entry_low || ''} onChange={e => handleTrancheChange(idx, 'entry_low', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-0.5">入场高价</label>
                          <input type="number" step="any" value={t.entry_high || ''} onChange={e => handleTrancheChange(idx, 'entry_high', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-0.5">配比 %</label>
                          <input type="number" step="any" value={t.allocation_pct || ''} onChange={e => handleTrancheChange(idx, 'allocation_pct', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-neutral-400 mb-0.5">金额 USD</label>
                          <input type="number" step="any" value={t.amount_usd || ''} onChange={e => handleTrancheChange(idx, 'amount_usd', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded text-sm" />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-xs text-neutral-400 mb-0.5">备注</label>
                        <input value={t.notes || ''} onChange={e => handleTrancheChange(idx, 'notes', e.target.value)} placeholder="如: 支撑位附近首次入场" className="w-full px-2 py-1.5 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk management */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">止损价</label>
                  <input type="number" step="any" value={planForm.stop_loss} onChange={e => setPlanForm(p => ({ ...p, stop_loss: e.target.value }))} placeholder="如 60000" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">止损备注</label>
                  <input value={planForm.stop_loss_note} onChange={e => setPlanForm(p => ({ ...p, stop_loss_note: e.target.value }))} placeholder="如: 跌破关键支撑" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">止盈价</label>
                  <input type="number" step="any" value={planForm.take_profit} onChange={e => setPlanForm(p => ({ ...p, take_profit: e.target.value }))} placeholder="如 100000" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">止盈备注</label>
                  <input value={planForm.take_profit_note} onChange={e => setPlanForm(p => ({ ...p, take_profit_note: e.target.value }))} placeholder="如: 到达前高附近" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">备注/理由</label>
                <textarea
                  value={planForm.rationale}
                  onChange={e => setPlanForm(p => ({ ...p, rationale: e.target.value }))}
                  placeholder="如: 减半效应 + 机构入场 + ETF 资金流入"
                  rows={2}
                  className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowPlanForm(false)} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md text-sm">
                取消
              </button>
              <button
                onClick={handleCreatePlan}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roadmap completion modal (Tab 3) */}
      {selectedRoadmapItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-md w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <h3 className="text-lg font-semibold text-neutral-50 mb-2">标记完成</h3>
            <p className="text-sm text-neutral-400 mb-4">{selectedRoadmapItem.action}</p>
            <textarea
              value={executionNote}
              onChange={(e) => setExecutionNote(e.target.value)}
              placeholder="执行备注（如：买入了¥3000黄金ETF，净值3.61）"
              rows={3}
              className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setSelectedRoadmapItem(null)} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md">取消</button>
              <button
                onClick={() => handleRoadmapStatusUpdate(selectedRoadmapItem.id, 'done', executionNote)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                确认完成
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add roadmap item modal (Tab 3) */}
      {showAddRoadmap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-md w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-50">添加计划</h3>
              <button onClick={() => setShowAddRoadmap(false)}><X className="w-5 h-5 text-neutral-400" /></button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={newRoadmapItem.action}
                onChange={(e) => setNewRoadmapItem(p => ({ ...p, action: e.target.value }))}
                placeholder="计划内容"
                className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newRoadmapItem.phase}
                  onChange={(e) => setNewRoadmapItem(p => ({ ...p, phase: e.target.value }))}
                  className="px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                >
                  <option value="短期(1个月)">短期(1个月)</option>
                  <option value="中期(3个月)">中期(3个月)</option>
                  <option value="长期(6个月+)">长期(6个月+)</option>
                </select>
                <select
                  value={newRoadmapItem.priority}
                  onChange={(e) => setNewRoadmapItem(p => ({ ...p, priority: e.target.value }))}
                  className="px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
                >
                  <option value="high">高优先</option>
                  <option value="medium">中优先</option>
                  <option value="low">低优先</option>
                </select>
              </div>
              <input
                type="text"
                value={newRoadmapItem.reason}
                onChange={(e) => setNewRoadmapItem(p => ({ ...p, reason: e.target.value }))}
                placeholder="原因/理由"
                className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md"
              />
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button onClick={() => setShowAddRoadmap(false)} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md">取消</button>
              <button onClick={handleAddRoadmapItem} className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md">
                <Save className="w-4 h-4" /><span>保存</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
