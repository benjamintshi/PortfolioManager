import { useEffect, useState } from 'react'
import { Activity, Plus, X, Save, RefreshCw } from 'lucide-react'
import { indicatorsApi, useApi } from '@/hooks/useApi'

interface MacroIndicator {
  id: number
  indicator_name: string
  value: number
  source: string | null
  timestamp: number
}

// Color coding based on indicator name and value
function getIndicatorColor(name: string, value: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('fear') || lower.includes('greed') || lower.includes('fg')) {
    if (value >= 75) return 'text-emerald-400'
    if (value >= 50) return 'text-emerald-300'
    if (value >= 25) return 'text-amber-400'
    return 'text-rose-400'
  }
  if (lower.includes('vix')) {
    if (value >= 30) return 'text-rose-400'
    if (value >= 20) return 'text-amber-400'
    return 'text-emerald-400'
  }
  if (lower.includes('dxy') || lower.includes('dollar')) {
    if (value >= 105) return 'text-rose-400'
    if (value >= 100) return 'text-amber-400'
    return 'text-emerald-400'
  }
  return 'text-neutral-50'
}

function getIndicatorBg(name: string, value: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('fear') || lower.includes('greed') || lower.includes('fg')) {
    if (value >= 75) return 'ring-emerald-500/20'
    if (value >= 50) return 'ring-emerald-500/15'
    if (value >= 25) return 'ring-amber-500/20'
    return 'ring-rose-500/20'
  }
  if (lower.includes('vix')) {
    if (value >= 30) return 'ring-rose-500/20'
    if (value >= 20) return 'ring-amber-500/20'
    return 'ring-emerald-500/20'
  }
  return 'ring-[rgba(100,140,255,0.1)]'
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

export default function MacroIndicators() {
  const [indicators, setIndicators] = useState<MacroIndicator[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ indicator_name: '', value: '', source: '' })
  const [formError, setFormError] = useState('')

  const { loading, execute } = useApi()

  const loadData = async () => {
    try {
      const data = await execute(() => indicatorsApi.getLatest())
      if (data) setIndicators(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载宏观指标失败:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  const handleRecord = async () => {
    setFormError('')
    if (!form.indicator_name.trim()) { setFormError('请输入指标名称'); return }
    const val = parseFloat(form.value)
    if (isNaN(val)) { setFormError('请输入有效数值'); return }

    try {
      await execute(() => indicatorsApi.record({
        indicator_name: form.indicator_name.trim(),
        value: val,
        source: form.source.trim() || undefined,
      }))
      setShowForm(false)
      setForm({ indicator_name: '', value: '', source: '' })
      await loadData()
    } catch (err) {
      setFormError('记录失败')
    }
  }

  return (
    <div className="glass rounded-xl border border-[rgba(100,140,255,0.1)]">
      <div className="px-5 py-4 border-b border-[rgba(100,140,255,0.1)] flex items-center justify-between">
        <h3 className="text-base font-semibold text-neutral-50 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" strokeWidth={1.75} />
          宏观指标
        </h3>
        <div className="flex items-center gap-1.5">
          <button onClick={loadData} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-arena-hover transition-colors" title="刷新">
            <RefreshCw className={`w-3.5 h-3.5 text-neutral-400 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
          </button>
          <button onClick={() => { setShowForm(true); setFormError('') }}
            className="p-1.5 rounded-lg hover:bg-arena-hover transition-colors" title="添加指标">
            <Plus className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {indicators.length === 0 ? (
        <div className="p-6 text-center">
          <Activity className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-40" strokeWidth={1.5} />
          <p className="text-sm text-neutral-400">暂无指标数据</p>
          <button onClick={() => { setShowForm(true); setFormError('') }}
            className="mt-2 text-sm text-primary hover:text-primary/80 font-medium">
            添加指标
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {indicators.map(ind => (
            <div key={ind.id}
              className={`p-3 rounded-xl bg-arena-surface/50 ring-1 ${getIndicatorBg(ind.indicator_name, ind.value)} hover:bg-arena-surface transition-colors cursor-default`}>
              <div className="text-xs text-neutral-400 font-medium truncate">{ind.indicator_name}</div>
              <div className={`text-lg font-bold tabular-nums mt-0.5 ${getIndicatorColor(ind.indicator_name, ind.value)}`}>
                {typeof ind.value === 'number' ? (
                  ind.value % 1 === 0 ? ind.value.toLocaleString() : ind.value.toFixed(2)
                ) : ind.value}
              </div>
              <div className="flex items-center justify-between mt-1">
                {ind.source && (
                  <span className="text-xs text-neutral-400/60 truncate">{ind.source}</span>
                )}
                <span className="text-xs text-neutral-400/60 ml-auto">{formatTimeAgo(ind.timestamp)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加指标弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass rounded-xl border border-[rgba(100,140,255,0.1)] p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-50">记录指标</h3>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>

            {formError && <div className="mb-3 p-2 bg-danger/10 rounded-md text-danger text-sm">{formError}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">指标名称</label>
                <input value={form.indicator_name} onChange={e => setForm(p => ({ ...p, indicator_name: e.target.value }))}
                  placeholder="如: Fear & Greed Index"
                  className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md text-sm" />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Fear & Greed', 'VIX', 'DXY', 'US 10Y Yield', 'BTC Dominance'].map(preset => (
                    <button key={preset} onClick={() => setForm(p => ({ ...p, indicator_name: preset }))}
                      className="text-xs px-2 py-0.5 rounded bg-arena-surface text-neutral-400 hover:text-neutral-200 transition-colors">
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">数值</label>
                <input type="number" step="any" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
                  placeholder="0.00" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">来源（可选）</label>
                <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                  placeholder="如: alternative.me" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md text-sm" />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-5">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md text-sm">取消</button>
              <button onClick={handleRecord} disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md disabled:opacity-50 text-sm">
                <Save className="w-4 h-4" /><span>记录</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
