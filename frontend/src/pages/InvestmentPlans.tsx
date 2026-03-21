import { useEffect, useState } from 'react'
import {
  ClipboardList, Plus, Trash2, ChevronDown, ChevronRight, X, Save,
  TrendingUp, TrendingDown, Target, ShieldAlert, CheckCircle2, Clock, Ban, Zap
} from 'lucide-react'
import { plansApi, useApi } from '@/hooks/useApi'
import { getCategoryName, getCategoryColor, formatCurrency } from '@/utils/format'

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

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  planning: { label: '规划中', color: 'text-slate-400 bg-slate-500/15 ring-slate-500/20', icon: Clock },
  active: { label: '进行中', color: 'text-blue-400 bg-blue-500/15 ring-blue-500/20', icon: Target },
  partial: { label: '部分执行', color: 'text-amber-400 bg-amber-500/15 ring-amber-500/20', icon: Zap },
  completed: { label: '已完成', color: 'text-emerald-400 bg-emerald-500/15 ring-emerald-500/20', icon: CheckCircle2 },
  cancelled: { label: '已取消', color: 'text-red-400 bg-red-500/15 ring-red-500/20', icon: Ban },
}

const emptyTranche = (): Tranche => ({
  batch: 1, entry_low: 0, entry_high: 0, allocation_pct: 0, amount_usd: 0,
  status: 'pending', executed_at: null, actual_price: null, notes: null,
})

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

const emptyForm: PlanForm = {
  symbol: '', name: '', category: 'crypto', direction: 'long', total_target_usd: '',
  tranches: [emptyTranche()], stop_loss: '', stop_loss_note: '', take_profit: '', take_profit_note: '', rationale: '',
}

export default function InvestmentPlans() {
  const [plans, setPlans] = useState<InvestmentPlan[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState('')
  const [executeModal, setExecuteModal] = useState<{ planId: number; trancheIndex: number; tranche: Tranche } | null>(null)
  const [executePrice, setExecutePrice] = useState('')
  const [form, setForm] = useState<PlanForm>(emptyForm)

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const data = await execute(() => plansApi.getAll())
      if (data) setPlans(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载投资计划失败:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleAddTranche = () => {
    setForm(prev => ({
      ...prev,
      tranches: [...prev.tranches, { ...emptyTranche(), batch: prev.tranches.length + 1 }],
    }))
  }

  const handleRemoveTranche = (idx: number) => {
    setForm(prev => ({
      ...prev,
      tranches: prev.tranches.filter((_, i) => i !== idx).map((t, i) => ({ ...t, batch: i + 1 })),
    }))
  }

  const handleTrancheChange = (idx: number, field: keyof Tranche, value: string | number) => {
    setForm(prev => ({
      ...prev,
      tranches: prev.tranches.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }))
  }

  const handleCreate = async () => {
    setFormError('')
    if (!form.symbol.trim()) { setFormError('请输入标的代码'); return }
    if (!form.name.trim()) { setFormError('请输入名称'); return }

    const tranches = form.tranches.map(t => ({
      ...t,
      entry_low: Number(t.entry_low) || 0, entry_high: Number(t.entry_high) || 0,
      allocation_pct: Number(t.allocation_pct) || 0, amount_usd: Number(t.amount_usd) || 0,
      notes: t.notes || null,
    }))

    try {
      await execute(() => plansApi.create({
        symbol: form.symbol.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category,
        direction: form.direction,
        total_target_usd: form.total_target_usd ? parseFloat(form.total_target_usd) : undefined,
        tranches_json: tranches,
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : undefined,
        stop_loss_note: form.stop_loss_note || undefined,
        take_profit: form.take_profit ? parseFloat(form.take_profit) : undefined,
        take_profit_note: form.take_profit_note || undefined,
        rationale: form.rationale || undefined,
      }))
      setShowForm(false)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setFormError('创建失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此投资计划？')) return
    try {
      await execute(() => plansApi.delete(id))
      await loadData()
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
      await loadData()
    } catch (err) {
      console.error('执行批次失败:', err)
    }
  }

  const handleStatusChange = async (planId: number, newStatus: string) => {
    try {
      await execute(() => plansApi.update(planId, { status: newStatus }))
      await loadData()
    } catch (err) {
      console.error('状态更新失败:', err)
    }
  }

  const totalPlans = plans.length
  const completedPlans = plans.filter(p => p.status === 'completed').length
  const completedPct = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15 ring-1 ring-primary/20">
              <ClipboardList className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <span>投资计划</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">分批建仓管理与执行跟踪</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setForm(emptyForm); setFormError('') }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
        >
          <Plus className="w-4 h-4" strokeWidth={1.75} /><span>新建计划</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Progress bar */}
      {totalPlans > 0 && (
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">整体完成度</span>
            <span className="text-sm font-medium text-foreground">{completedPlans}/{totalPlans} ({completedPct}%)</span>
          </div>
          <div className="w-full bg-secondary/60 rounded-full h-2">
            <div
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${completedPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Plan Cards */}
      {plans.length === 0 ? (
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-12 text-center text-muted-foreground">
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
            const status = statusConfig[plan.status] || statusConfig.planning
            const StatusIcon = status.icon

            return (
              <div key={plan.id} className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 overflow-hidden">
                {/* Card Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => toggleExpand(plan.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />
                      }
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(plan.category) }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">{plan.name}</span>
                          <span className="text-sm text-muted-foreground">{plan.symbol}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded-md bg-secondary/60 text-muted-foreground ring-1 ring-border/40">
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
                        {plan.stop_loss != null && (
                          <span className="flex items-center gap-1 text-red-400" title={plan.stop_loss_note || '止损'}>
                            <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
                            ${plan.stop_loss.toLocaleString()}
                          </span>
                        )}
                        {plan.take_profit != null && (
                          <span className="flex items-center gap-1 text-emerald-400" title={plan.take_profit_note || '止盈'}>
                            <Target className="w-3.5 h-3.5" strokeWidth={1.75} />
                            ${plan.take_profit.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {totalTranches > 0 && (
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <div className="flex-1 bg-secondary/60 rounded-full h-1.5">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${tranchePct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {executedCount}/{totalTranches}
                          </span>
                        </div>
                      )}
                      {plan.total_target_usd != null && plan.total_target_usd > 0 && (
                        <span className="text-sm font-medium text-foreground tabular-nums whitespace-nowrap">
                          {formatCurrency(plan.total_target_usd)}
                        </span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(plan.id) }}
                        className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4 text-destructive/70 hover:text-destructive" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-border/40 px-4 pb-4">
                    {plan.rationale && (
                      <div className="pt-3 pb-2">
                        <div className="text-sm">
                          <span className="text-muted-foreground">备注: </span>
                          <span className="text-foreground">{plan.rationale}</span>
                        </div>
                      </div>
                    )}

                    {/* Stop loss / Take profit on mobile */}
                    <div className="sm:hidden pt-2 pb-2 flex gap-4 text-xs">
                      {plan.stop_loss != null && (
                        <span className="flex items-center gap-1 text-red-400">
                          <ShieldAlert className="w-3.5 h-3.5" strokeWidth={1.75} />
                          止损 ${plan.stop_loss.toLocaleString()}
                          {plan.stop_loss_note && <span className="text-muted-foreground ml-1">({plan.stop_loss_note})</span>}
                        </span>
                      )}
                      {plan.take_profit != null && (
                        <span className="flex items-center gap-1 text-emerald-400">
                          <Target className="w-3.5 h-3.5" strokeWidth={1.75} />
                          止盈 ${plan.take_profit.toLocaleString()}
                          {plan.take_profit_note && <span className="text-muted-foreground ml-1">({plan.take_profit_note})</span>}
                        </span>
                      )}
                    </div>

                    {/* Status change buttons */}
                    <div className="pt-2 pb-3 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground mr-1">切换状态:</span>
                      {['planning', 'active', 'partial', 'completed', 'cancelled'].map(s => {
                        const sc = statusConfig[s]
                        return (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(plan.id, s)}
                            disabled={plan.status === s}
                            className={`text-xs px-2 py-1 rounded-lg ring-1 transition-colors disabled:opacity-40 ${
                              plan.status === s ? sc.color : 'text-muted-foreground ring-border/40 hover:bg-secondary/40'
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
                            <tr className="border-b border-border/40">
                              <th className="py-2 px-2 text-left text-xs text-muted-foreground font-medium">批次</th>
                              <th className="py-2 px-2 text-right text-xs text-muted-foreground font-medium">入场区间</th>
                              <th className="py-2 px-2 text-right text-xs text-muted-foreground font-medium">配比</th>
                              <th className="py-2 px-2 text-right text-xs text-muted-foreground font-medium">金额</th>
                              <th className="py-2 px-2 text-center text-xs text-muted-foreground font-medium">状态</th>
                              <th className="py-2 px-2 text-right text-xs text-muted-foreground font-medium">成交价</th>
                              <th className="py-2 px-2 text-left text-xs text-muted-foreground font-medium">备注</th>
                              <th className="py-2 px-2 text-center text-xs text-muted-foreground font-medium">操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tranches.map((t, idx) => (
                              <tr key={idx} className={`border-b border-border/20 ${t.status === 'executed' ? 'bg-emerald-500/5' : ''}`}>
                                <td className="py-2 px-2 text-foreground font-medium">#{t.batch}</td>
                                <td className="py-2 px-2 text-right tabular-nums text-foreground">
                                  ${t.entry_low?.toLocaleString()} - ${t.entry_high?.toLocaleString()}
                                </td>
                                <td className="py-2 px-2 text-right tabular-nums text-foreground">{t.allocation_pct}%</td>
                                <td className="py-2 px-2 text-right tabular-nums text-foreground">
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
                                    : <span className="text-muted-foreground">-</span>
                                  }
                                </td>
                                <td className="py-2 px-2 text-muted-foreground text-xs max-w-[150px] truncate">{t.notes || '-'}</td>
                                <td className="py-2 px-2 text-center">
                                  {t.status === 'pending' && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExecuteModal({ planId: plan.id, trancheIndex: idx, tranche: t })
                                        setExecutePrice('')
                                      }}
                                      className="text-xs px-2 py-1 rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 hover:bg-primary/25 transition-colors"
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
                      <div className="py-4 text-center text-sm text-muted-foreground">暂无分批数据</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Execute Tranche Modal */}
      {executeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border/60 p-6 w-full max-w-sm ring-1 ring-border/40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">执行批次 #{executeModal.tranche.batch}</h3>
              <button onClick={() => setExecuteModal(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div className="text-sm text-muted-foreground">
                入场区间: ${executeModal.tranche.entry_low?.toLocaleString()} - ${executeModal.tranche.entry_high?.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">
                计划金额: ${executeModal.tranche.amount_usd?.toLocaleString()}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">实际成交价</label>
                <div className="flex items-center">
                  <span className="px-2 py-2 bg-secondary border border-border rounded-l-md text-sm">$</span>
                  <input
                    type="number"
                    step="any"
                    value={executePrice}
                    onChange={e => setExecutePrice(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 px-3 py-2 bg-background border border-border border-l-0 rounded-r-md"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setExecuteModal(null)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm">
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

      {/* Add Plan Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border/60 p-6 w-full max-w-2xl ring-1 ring-border/40 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">新建投资计划</h3>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            {formError && <div className="mb-4 p-3 bg-destructive/10 rounded-md text-destructive text-sm">{formError}</div>}
            <div className="space-y-4">
              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">标的代码 *</label>
                  <input
                    value={form.symbol}
                    onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                    placeholder="如 BTCUSDT"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">名称 *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="如 比特币"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">类别</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md"
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
                    value={form.direction}
                    onChange={e => setForm(p => ({ ...p, direction: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md"
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
                    value={form.total_target_usd}
                    onChange={e => setForm(p => ({ ...p, total_target_usd: e.target.value }))}
                    placeholder="如 10000"
                    className="w-full px-3 py-2 bg-background border border-border rounded-md"
                  />
                </div>
              </div>

              {/* Tranches */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">分批计划</label>
                  <button
                    type="button"
                    onClick={handleAddTranche}
                    className="text-xs px-2 py-1 rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 hover:bg-primary/25"
                  >
                    + 添加批次
                  </button>
                </div>
                <div className="space-y-2">
                  {form.tranches.map((t, idx) => (
                    <div key={idx} className="bg-secondary/30 rounded-lg p-3 ring-1 ring-border/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">批次 #{t.batch}</span>
                        {form.tranches.length > 1 && (
                          <button type="button" onClick={() => handleRemoveTranche(idx)} className="text-xs text-destructive/70 hover:text-destructive">
                            移除
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-0.5">入场低价</label>
                          <input type="number" step="any" value={t.entry_low || ''} onChange={e => handleTrancheChange(idx, 'entry_low', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-0.5">入场高价</label>
                          <input type="number" step="any" value={t.entry_high || ''} onChange={e => handleTrancheChange(idx, 'entry_high', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-0.5">配比 %</label>
                          <input type="number" step="any" value={t.allocation_pct || ''} onChange={e => handleTrancheChange(idx, 'allocation_pct', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-0.5">金额 USD</label>
                          <input type="number" step="any" value={t.amount_usd || ''} onChange={e => handleTrancheChange(idx, 'amount_usd', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm" />
                        </div>
                      </div>
                      <div className="mt-2">
                        <label className="block text-xs text-muted-foreground mb-0.5">备注</label>
                        <input value={t.notes || ''} onChange={e => handleTrancheChange(idx, 'notes', e.target.value)} placeholder="如: 支撑位附近首次入场" className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risk management */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">止损价</label>
                  <input type="number" step="any" value={form.stop_loss} onChange={e => setForm(p => ({ ...p, stop_loss: e.target.value }))} placeholder="如 60000" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">止损备注</label>
                  <input value={form.stop_loss_note} onChange={e => setForm(p => ({ ...p, stop_loss_note: e.target.value }))} placeholder="如: 跌破关键支撑" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">止盈价</label>
                  <input type="number" step="any" value={form.take_profit} onChange={e => setForm(p => ({ ...p, take_profit: e.target.value }))} placeholder="如 100000" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">止盈备注</label>
                  <input value={form.take_profit_note} onChange={e => setForm(p => ({ ...p, take_profit_note: e.target.value }))} placeholder="如: 到达前高附近" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
                </div>
              </div>

              {/* Rationale */}
              <div>
                <label className="block text-sm font-medium mb-1">备注/理由</label>
                <textarea
                  value={form.rationale}
                  onChange={e => setForm(p => ({ ...p, rationale: e.target.value }))}
                  placeholder="如: 减半效应 + 机构入场 + ETF 资金流入"
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-md resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm">
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
