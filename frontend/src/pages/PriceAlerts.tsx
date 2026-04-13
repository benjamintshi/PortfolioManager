import { useEffect, useState } from 'react'
import { Bell, Plus, Edit2, Trash2, RefreshCw, X, Save, TrendingDown, TrendingUp } from 'lucide-react'
import { alertsApi, useApi } from '@/hooks/useApi'
import { getCategoryColor } from '@/utils/format'

interface PriceAlert {
  id: number
  symbol: string
  name: string
  category: string
  direction: 'buy' | 'sell'
  trigger_price: number
  currency: string
  enabled: number
  cooldown_minutes: number
  last_triggered_at: number | null
  notes: string | null
  currentPrice?: number | null
  triggered?: boolean
}

const emptyForm: {
  symbol: string
  name: string
  category: string
  direction: 'buy' | 'sell'
  trigger_price: string
  currency: string
  cooldown_minutes: number
  notes: string
} = {
  symbol: '',
  name: '',
  category: 'crypto',
  direction: 'buy',
  trigger_price: '',
  currency: 'USD',
  cooldown_minutes: 60,
  notes: '',
}

export default function PriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const data = await execute(() => alertsApi.getWithPrices())
      if (data) setAlerts(Array.isArray(data) ? data : (data as any).data ?? [])
    } catch (err) {
      console.error('加载失败:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleAdd = async () => {
    setFormError('')
    if (!form.symbol.trim()) { setFormError('请输入标的代码'); return }
    if (!form.name.trim()) { setFormError('请输入名称'); return }
    const price = parseFloat(form.trigger_price)
    if (isNaN(price) || price <= 0) { setFormError('请输入有效触发价'); return }

    try {
      await execute(() => alertsApi.create({
        symbol: form.symbol.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category,
        direction: form.direction,
        trigger_price: price,
        currency: form.currency,
        cooldown_minutes: form.cooldown_minutes,
        notes: form.notes.trim() || undefined,
      }))
      setShowForm(false)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setFormError('添加失败')
    }
  }

  const handleUpdate = async () => {
    if (!editingId) return
    setFormError('')
    const price = parseFloat(form.trigger_price)
    if (isNaN(price) || price <= 0) { setFormError('请输入有效触发价'); return }

    try {
      await execute(() => alertsApi.update(editingId, {
        symbol: form.symbol.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category,
        direction: form.direction,
        trigger_price: price,
        currency: form.currency,
        cooldown_minutes: form.cooldown_minutes,
        notes: form.notes.trim() || undefined,
      }))
      setEditingId(null)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setFormError('更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除此提醒？')) return
    try {
      await execute(() => alertsApi.delete(id))
      await loadData()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const handleEdit = (a: PriceAlert) => {
    setEditingId(a.id)
    setForm({
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      direction: a.direction,
      trigger_price: String(a.trigger_price),
      currency: a.currency || 'USD',
      cooldown_minutes: a.cooldown_minutes || 60,
      notes: a.notes || '',
    })
  }

  const handleCheck = async () => {
    try {
      const data = await execute(() => alertsApi.check())
      if ((data as any)?.triggered > 0) {
        await loadData()
      }
    } catch (err) {
      console.error('检查失败:', err)
    }
  }

  const formatPrice = (p: number, currency: string) =>
    currency === 'CNY' ? `¥${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`

  const triggeredCount = alerts.filter(a => a.triggered).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-50 flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15 ring-1 ring-primary/20">
              <Bell className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <span>价格提醒</span>
            {triggeredCount > 0 && (
              <span className="text-sm font-medium px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/20 animate-pulse">
                {triggeredCount} 条已触发
              </span>
            )}
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">到达指定价格时发送 Telegram 通知，并在页面高亮</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCheck} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-arena-surface text-neutral-300 hover:bg-arena-hover disabled:opacity-50 text-sm font-medium">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} /><span>立即检查</span>
          </button>
          <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); setFormError('') }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" strokeWidth={1.75} /><span>添加提醒</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 p-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      <div className="glass rounded-xl border border-[rgba(100,140,255,0.1)] overflow-hidden">
        {alerts.length === 0 ? (
          <div className="p-12 text-center text-neutral-400">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-40" strokeWidth={1.5} />
            <p>暂无价格提醒，点击「添加提醒」创建</p>
            <p className="text-sm mt-2">系统已预置 ETH/SOL/ADA/BNB 做T 买入/卖出提醒</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-header">
                <tr>
                  <th className="table-cell text-left">标的</th>
                  <th className="table-cell text-left">方向</th>
                  <th className="table-cell text-right">触发价</th>
                  <th className="table-cell text-right">当前价</th>
                  <th className="table-cell text-center">状态</th>
                  <th className="table-cell text-left">备注</th>
                  <th className="table-cell text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className={`table-row ${a.triggered ? 'bg-emerald-500/10 border-l-4 border-l-primary' : ''}`}>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(a.category) }} />
                        <div>
                          <div className="font-medium">{a.name}</div>
                          <div className="text-xs text-neutral-400">{a.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      {a.direction === 'buy' ? (
                        <span className="inline-flex items-center text-emerald-400"><TrendingDown className="w-4 h-4 mr-1" strokeWidth={1.75} />买入</span>
                      ) : (
                        <span className="inline-flex items-center text-amber-400"><TrendingUp className="w-4 h-4 mr-1" strokeWidth={1.75} />卖出</span>
                      )}
                    </td>
                    <td className="table-cell text-right tabular-nums font-medium">
                      {formatPrice(a.trigger_price, a.currency)}
                    </td>
                    <td className="table-cell text-right tabular-nums">
                      {a.currentPrice != null ? formatPrice(a.currentPrice, a.currency) : <span className="text-neutral-400">-</span>}
                    </td>
                    <td className="table-cell text-center">
                      {a.triggered ? (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium ring-1 ring-emerald-500/20">已触发</span>
                      ) : a.enabled === 0 ? (
                        <span className="text-neutral-400 text-sm">已禁用</span>
                      ) : (
                        <span className="text-neutral-400 text-sm">监控中</span>
                      )}
                    </td>
                    <td className="table-cell text-sm text-neutral-400 max-w-[200px] truncate">{a.notes || '-'}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-center space-x-1">
                        <button onClick={() => handleEdit(a)} className="p-1 hover:bg-arena-hover rounded" title="编辑">
                          <Edit2 className="w-4 h-4 text-neutral-400" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="p-1 hover:bg-danger/10 rounded" title="删除">
                          <Trash2 className="w-4 h-4 text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-sm text-neutral-400">
        <p>• 每 5 分钟自动检查价格，触发后发送 Telegram 通知（需配置 TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID）</p>
        <p>• 同一提醒默认 60 分钟内不重复通知，可在编辑时调整</p>
      </div>

      {(showForm || editingId) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-strong rounded-xl border border-[rgba(100,140,255,0.1)] p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">{editingId ? '编辑提醒' : '添加提醒'}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setFormError('') }}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            {formError && <div className="mb-4 p-3 bg-danger/10 rounded-md text-danger text-sm">{formError}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">标的代码</label>
                <input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))}
                  placeholder="如 ETHUSDT、017436" disabled={!!editingId}
                  className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">名称</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="如 ETH" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">类别</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md">
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
                  <select value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md">
                    <option value="buy">买入提醒</option>
                    <option value="sell">卖出提醒</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">触发价格</label>
                <div className="flex">
                  <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}
                    className="px-2 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-l-md text-sm">
                    <option value="USD">$</option>
                    <option value="CNY">¥</option>
                  </select>
                  <input type="number" step="any" value={form.trigger_price} onChange={e => setForm(p => ({ ...p, trigger_price: e.target.value }))}
                    placeholder="0.00" className="flex-1 px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] border-l-0 rounded-r-md" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">冷却时间（分钟）</label>
                <input type="number" value={form.cooldown_minutes} onChange={e => setForm(p => ({ ...p, cooldown_minutes: parseInt(e.target.value) || 60 }))}
                  className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">备注（可选）</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="如：做T买入区间" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => { setShowForm(false); setEditingId(null) }} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md">取消</button>
              <button onClick={editingId ? handleUpdate : handleAdd} disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50">
                <Save className="w-4 h-4" /><span>保存</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
