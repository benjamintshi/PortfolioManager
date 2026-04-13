import { useEffect, useState } from 'react'
import { CalendarDays, Plus, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { eventsApi, useApi } from '@/hooks/useApi'

interface MacroEvent {
  id: number
  event_name: string
  event_date: string
  event_type: string
  importance: string
  affected_assets: string | null
  expected_impact: string | null
  actual_result: string | null
  notes: string | null
  created_at: number
}

type TabFilter = 'all' | 'upcoming' | 'past'

const emptyForm = {
  event_name: '',
  event_date: '',
  event_type: 'data',
  importance: 'medium',
  affected_assets: '',
  expected_impact: '',
  notes: '',
}

const typeLabels: Record<string, string> = {
  data: '数据',
  policy: '政策',
  earnings: '财报',
  geopolitical: '地缘',
  other: '其他',
}

const typeColors: Record<string, string> = {
  data: 'bg-blue-500/20 text-blue-400 ring-blue-500/30',
  policy: 'bg-purple-500/20 text-purple-400 ring-purple-500/30',
  earnings: 'bg-amber-500/20 text-amber-400 ring-amber-500/30',
  geopolitical: 'bg-red-500/20 text-red-400 ring-red-500/30',
  other: 'bg-gray-500/20 text-gray-400 ring-gray-500/30',
}

const importanceColors: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 ring-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/30',
  low: 'bg-green-500/20 text-green-400 ring-green-500/30',
}

const importanceLabels: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

function isWithin7Days(dateStr: string): boolean {
  const eventDate = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffMs = eventDate.getTime() - today.getTime()
  return diffMs >= 0 && diffMs <= 7 * 24 * 60 * 60 * 1000
}

function isPast(dateStr: string): boolean {
  const eventDate = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return eventDate.getTime() < today.getTime()
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${month}月${day}日 ${weekdays[d.getDay()]}`
}

export default function MacroEvents() {
  const [events, setEvents] = useState<MacroEvent[]>([])
  const [tab, setTab] = useState<TabFilter>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const data = await execute(() => eventsApi.getAll())
      if (data) setEvents(Array.isArray(data) ? data : [])
    } catch (err) { console.error('加载失败:', err) }
  }
  useEffect(() => { loadData() }, [])

  const filteredEvents = events.filter(e => {
    if (tab === 'upcoming') return !isPast(e.event_date)
    if (tab === 'past') return isPast(e.event_date)
    return true
  })

  const handleAdd = async () => {
    setFormError('')
    if (!form.event_name.trim()) { setFormError('请输入事件名称'); return }
    if (!form.event_date) { setFormError('请选择日期'); return }

    try {
      await execute(() => eventsApi.create({
        event_name: form.event_name.trim(),
        event_date: form.event_date,
        event_type: form.event_type,
        importance: form.importance,
        affected_assets: form.affected_assets.trim() || undefined,
        expected_impact: form.expected_impact.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }))
      setShowForm(false)
      setForm(emptyForm)
      await loadData()
    } catch (err) {
      setFormError('添加失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此事件？')) return
    try { await execute(() => eventsApi.delete(id)); await loadData() }
    catch (err) { console.error('删除失败:', err) }
  }
  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'upcoming', label: '即将到来' },
    { key: 'past', label: '已过期' },
  ]

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <CalendarDays className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">宏观事件</span>
              </h1>
              <p className="text-sm text-neutral-400">跟踪影响市场的关键事件</p>
            </div>
            <button
              onClick={() => { setShowForm(true); setForm(emptyForm); setFormError('') }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
            >
              <Plus className="w-4 h-4" /> 添加事件
            </button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Tabs + Content */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <div className="flex gap-1 bg-arena-surface rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-primary-soft text-primary'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && events.length === 0 && (
        <div className="text-center py-12 text-neutral-400">加载中...</div>
      )}

      {/* Empty */}
      {!loading && filteredEvents.length === 0 && (
        <div className="text-center py-12 text-neutral-400">
          {tab === 'upcoming' ? '暂无即将到来的事件' : tab === 'past' ? '暂无已过期的事件' : '暂无事件，点击右上角添加'}
        </div>
      )}

      {/* Event list */}
      <div className="space-y-2">
        {filteredEvents.map(event => {
          const within7 = isWithin7Days(event.event_date)
          const past = isPast(event.event_date)
          const expanded = expandedId === event.id
          const hasDetails = event.affected_assets || event.expected_impact || event.actual_result || event.notes

          return (
            <div
              key={event.id}
              className={`rounded-xl border transition-colors ${
                within7
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : past
                    ? 'border-[rgba(100,140,255,0.08)] glass opacity-70'
                    : 'border-[rgba(100,140,255,0.1)] glass'
              }`}
            >
              {/* Main row */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Expand toggle */}
                  <button
                    onClick={() => hasDetails && setExpandedId(expanded ? null : event.id)}
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center ${hasDetails ? 'text-neutral-400 hover:text-neutral-200 cursor-pointer' : 'text-transparent'}`}
                    disabled={!hasDetails}
                  >
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>

                  {/* Date */}
                  <div className={`flex-shrink-0 w-24 text-sm font-medium ${within7 ? 'text-amber-400' : 'text-neutral-400'}`}>
                    {formatDate(event.event_date)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 text-sm font-medium min-w-0 truncate">
                    {event.event_name}
                  </div>

                  {/* Badges + Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${typeColors[event.event_type] || typeColors.other}`}>
                      {typeLabels[event.event_type] || event.event_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${importanceColors[event.importance] || importanceColors.medium}`}>
                      {importanceLabels[event.importance] || event.importance}
                    </span>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {expanded && hasDetails && (
                <div className="px-4 pb-3 pl-12 space-y-1.5 text-sm">
                  {[
                    ['影响资产', event.affected_assets],
                    ['预期影响', event.expected_impact],
                    ['实际结果', event.actual_result],
                    ['备注', event.notes],
                  ].filter(([, v]) => v).map(([label, val]) => (
                    <div key={label as string}><span className="text-neutral-400">{label}：</span>{val}</div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      </section>

      {/* Add Event Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">添加宏观事件</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-arena-hover text-neutral-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">{formError}</div>
            )}

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">事件名称 *</label>
                <input
                  type="text"
                  value={form.event_name}
                  onChange={e => setForm({ ...form, event_name: e.target.value })}
                  placeholder="如：美联储议息会议"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Date + Type + Importance row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">日期 *</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm({ ...form, event_date: e.target.value })}
                    className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">类型</label>
                  <select
                    value={form.event_type}
                    onChange={e => setForm({ ...form, event_type: e.target.value })}
                    className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="data">数据</option>
                    <option value="policy">政策</option>
                    <option value="earnings">财报</option>
                    <option value="geopolitical">地缘</option>
                    <option value="other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">重要性</label>
                  <select
                    value={form.importance}
                    onChange={e => setForm({ ...form, importance: e.target.value })}
                    className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
              </div>

              {/* Affected assets */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">影响资产</label>
                <input
                  type="text"
                  value={form.affected_assets}
                  onChange={e => setForm({ ...form, affected_assets: e.target.value })}
                  placeholder="如：BTC, 美股, 黄金"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              {/* Expected impact */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">预期影响</label>
                <textarea
                  value={form.expected_impact}
                  onChange={e => setForm({ ...form, expected_impact: e.target.value })}
                  placeholder="对投资组合的预期影响..."
                  rows={2}
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">备注</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="其他备注..."
                  rows={2}
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
