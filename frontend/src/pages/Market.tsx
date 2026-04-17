import { useEffect, useState } from 'react'
import {
  Globe,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  Activity,
  Save,
  RefreshCw,
} from 'lucide-react'
import { eventsApi, indicatorsApi, useApi } from '@/hooks/useApi'

// ---------- Types ----------

interface MacroIndicator {
  id: number
  indicator_name: string
  value: number
  source: string | null
  timestamp: number
}

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

type MainTab = 'indicators' | 'events'
type EventFilter = 'upcoming' | 'all' | 'past'

// ---------- Constants ----------

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

const emptyEventForm = {
  event_name: '',
  event_date: '',
  event_type: 'data',
  importance: 'medium',
  affected_assets: '',
  expected_impact: '',
  notes: '',
}

// ---------- Helpers ----------

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

function getIndicatorRing(name: string, value: number): string {
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

// ---------- Component ----------

export default function Market() {
  const [mainTab, setMainTab] = useState<MainTab>('indicators')

  // Indicators state
  const [indicators, setIndicators] = useState<MacroIndicator[]>([])
  const [showIndicatorForm, setShowIndicatorForm] = useState(false)
  const [indicatorForm, setIndicatorForm] = useState({
    indicator_name: '',
    value: '',
    source: '',
  })
  const [indicatorFormError, setIndicatorFormError] = useState('')

  // Events state
  const [events, setEvents] = useState<MacroEvent[]>([])
  const [eventTab, setEventTab] = useState<EventFilter>('upcoming')
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState(emptyEventForm)
  const [eventFormError, setEventFormError] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { loading, error, execute } = useApi()

  // ---------- Data loading ----------

  const loadIndicators = async () => {
    try {
      const data = await execute(() => indicatorsApi.getLatest())
      if (data) setIndicators(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载宏观指标失败:', err)
    }
  }

  const loadEvents = async () => {
    try {
      const data = await execute(() => eventsApi.getAll())
      if (data) setEvents(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载事件失败:', err)
    }
  }

  useEffect(() => {
    loadIndicators()
    loadEvents()
  }, [])

  // ---------- Indicator handlers ----------

  const handleRecordIndicator = async () => {
    setIndicatorFormError('')
    if (!indicatorForm.indicator_name.trim()) {
      setIndicatorFormError('请输入指标名称')
      return
    }
    const val = parseFloat(indicatorForm.value)
    if (isNaN(val)) {
      setIndicatorFormError('请输入有效数值')
      return
    }

    try {
      await execute(() =>
        indicatorsApi.record({
          indicator_name: indicatorForm.indicator_name.trim(),
          value: val,
          source: indicatorForm.source.trim() || undefined,
        })
      )
      setShowIndicatorForm(false)
      setIndicatorForm({ indicator_name: '', value: '', source: '' })
      await loadIndicators()
    } catch {
      setIndicatorFormError('记录失败')
    }
  }

  // ---------- Event handlers ----------

  const handleAddEvent = async () => {
    setEventFormError('')
    if (!eventForm.event_name.trim()) {
      setEventFormError('请输入事件名称')
      return
    }
    if (!eventForm.event_date) {
      setEventFormError('请选择日期')
      return
    }

    try {
      await execute(() =>
        eventsApi.create({
          event_name: eventForm.event_name.trim(),
          event_date: eventForm.event_date,
          event_type: eventForm.event_type,
          importance: eventForm.importance,
          affected_assets: eventForm.affected_assets.trim() || undefined,
          expected_impact: eventForm.expected_impact.trim() || undefined,
          notes: eventForm.notes.trim() || undefined,
        })
      )
      setShowEventForm(false)
      setEventForm(emptyEventForm)
      await loadEvents()
    } catch {
      setEventFormError('添加失败')
    }
  }

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('确定要删除此事件？')) return
    try {
      await execute(() => eventsApi.delete(id))
      await loadEvents()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const filteredEvents = events.filter((e) => {
    if (eventTab === 'upcoming') return !isPast(e.event_date)
    if (eventTab === 'past') return isPast(e.event_date)
    return true
  })

  const eventSubTabs: { key: EventFilter; label: string }[] = [
    { key: 'upcoming', label: '即将到来' },
    { key: 'all', label: '全部' },
    { key: 'past', label: '已过期' },
  ]

  // ---------- Render ----------

  return (
    <>
      {/* Hero */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Globe className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">市场动态</span>
              </h1>
              <p className="text-sm text-neutral-400">
                宏观指标 &middot; 事件日历
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setShowEventForm(true)
                  setEventForm(emptyEventForm)
                  setEventFormError('')
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Plus className="w-4 h-4" /> 添加事件
              </button>
              <button
                onClick={() => {
                  setShowIndicatorForm(true)
                  setIndicatorFormError('')
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Activity className="w-4 h-4" /> 录入指标
              </button>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Error */}
      {error && (
        <section className="relative max-w-[1400px] mx-auto px-6 pt-6">
          <div className="rounded-xl bg-danger/10 border border-danger/20 p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        </section>
      )}

      {/* Main Tabs */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="flex bg-arena-surface rounded-xl p-1 border border-[rgba(100,140,255,0.08)] w-fit mb-6">
          {(
            [
              { key: 'indicators' as const, label: '宏观指标' },
              { key: 'events' as const, label: '事件日历' },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key)}
              className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mainTab === t.key
                  ? 'bg-primary-soft text-primary'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Indicators */}
        {mainTab === 'indicators' && (
          <div>
            {indicators.length === 0 ? (
              <div className="glass scan-line rounded-lg p-12 border border-[rgba(100,140,255,0.1)] text-center">
                <Activity className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-40" strokeWidth={1.5} />
                <p className="text-sm text-neutral-400">暂无指标数据</p>
                <button
                  onClick={() => {
                    setShowIndicatorForm(true)
                    setIndicatorFormError('')
                  }}
                  className="mt-2 text-sm text-primary hover:text-primary/80 font-medium"
                >
                  添加指标
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {indicators.map((ind) => (
                  <div
                    key={ind.id}
                    className={`glass scan-line rounded-lg p-5 border border-[rgba(100,140,255,0.1)] ring-1 ${getIndicatorRing(ind.indicator_name, ind.value)} hover:border-primary/20 transition-colors cursor-default`}
                  >
                    <div className="text-xs text-neutral-400 font-medium truncate">
                      {ind.indicator_name}
                    </div>
                    <div
                      className={`text-2xl font-bold font-data tabular-nums mt-1 ${getIndicatorColor(ind.indicator_name, ind.value)}`}
                    >
                      {typeof ind.value === 'number'
                        ? ind.value % 1 === 0
                          ? ind.value.toLocaleString()
                          : ind.value.toFixed(2)
                        : ind.value}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {ind.source && (
                        <span className="text-xs text-neutral-400/60 truncate">
                          {ind.source}
                        </span>
                      )}
                      <span className="text-xs text-neutral-400/60 ml-auto">
                        {formatTimeAgo(ind.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end mt-4">
              <button
                onClick={loadIndicators}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 bg-arena-surface border border-[rgba(100,140,255,0.08)] transition-colors"
              >
                <RefreshCw
                  className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
                  strokeWidth={1.75}
                />
                刷新
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Events */}
        {mainTab === 'events' && (
          <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 bg-arena-surface rounded-xl p-1 w-fit border border-[rgba(100,140,255,0.08)]">
              {eventSubTabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setEventTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    eventTab === t.key
                      ? 'bg-primary-soft text-primary'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Loading */}
            {loading && events.length === 0 && (
              <div className="text-center py-12 text-neutral-400">加载中...</div>
            )}

            {/* Empty */}
            {!loading && filteredEvents.length === 0 && (
              <div className="text-center py-12 text-neutral-400">
                {eventTab === 'upcoming'
                  ? '暂无即将到来的事件'
                  : eventTab === 'past'
                    ? '暂无已过期的事件'
                    : '暂无事件，点击右上角添加'}
              </div>
            )}

            {/* Event list */}
            <div className="space-y-2">
              {filteredEvents.map((event) => {
                const within7 = isWithin7Days(event.event_date)
                const past = isPast(event.event_date)
                const expanded = expandedId === event.id
                const hasDetails =
                  event.affected_assets ||
                  event.expected_impact ||
                  event.actual_result ||
                  event.notes

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
                        <button
                          onClick={() =>
                            hasDetails &&
                            setExpandedId(expanded ? null : event.id)
                          }
                          className={`flex-shrink-0 w-5 h-5 flex items-center justify-center ${
                            hasDetails
                              ? 'text-neutral-400 hover:text-neutral-200 cursor-pointer'
                              : 'text-transparent'
                          }`}
                          disabled={!hasDetails}
                        >
                          {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>

                        <div
                          className={`flex-shrink-0 w-24 text-sm font-medium font-data ${
                            within7 ? 'text-amber-400' : 'text-neutral-400'
                          }`}
                        >
                          {formatDate(event.event_date)}
                        </div>

                        <div className="flex-1 text-sm font-medium min-w-0 truncate text-neutral-200">
                          {event.event_name}
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${
                              typeColors[event.event_type] || typeColors.other
                            }`}
                          >
                            {typeLabels[event.event_type] || event.event_type}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ${
                              importanceColors[event.importance] ||
                              importanceColors.medium
                            }`}
                          >
                            {importanceLabels[event.importance] ||
                              event.importance}
                          </span>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
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
                        {(
                          [
                            ['影响资产', event.affected_assets],
                            ['预期影响', event.expected_impact],
                            ['实际结果', event.actual_result],
                            ['备注', event.notes],
                          ] as const
                        )
                          .filter(([, v]) => v)
                          .map(([label, val]) => (
                            <div key={label}>
                              <span className="text-neutral-400">
                                {label}：
                              </span>
                              <span className="text-neutral-200">{val}</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Add Event Modal */}
      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-neutral-50">
                添加宏观事件
              </h2>
              <button
                onClick={() => setShowEventForm(false)}
                className="p-1.5 rounded-lg hover:bg-arena-hover text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {eventFormError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-400">
                {eventFormError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                  事件名称 *
                </label>
                <input
                  type="text"
                  value={eventForm.event_name}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, event_name: e.target.value })
                  }
                  placeholder="如：美联储议息会议"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                    日期 *
                  </label>
                  <input
                    type="date"
                    value={eventForm.event_date}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        event_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                    类型
                  </label>
                  <select
                    value={eventForm.event_type}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        event_type: e.target.value,
                      })
                    }
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
                  <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                    重要性
                  </label>
                  <select
                    value={eventForm.importance}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        importance: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    <option value="high">高</option>
                    <option value="medium">中</option>
                    <option value="low">低</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                  影响资产
                </label>
                <input
                  type="text"
                  value={eventForm.affected_assets}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      affected_assets: e.target.value,
                    })
                  }
                  placeholder="如：BTC, 美股, 黄金"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                  预期影响
                </label>
                <textarea
                  value={eventForm.expected_impact}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      expected_impact: e.target.value,
                    })
                  }
                  placeholder="对投资组合的预期影响..."
                  rows={2}
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5 text-neutral-400">
                  备注
                </label>
                <textarea
                  value={eventForm.notes}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, notes: e.target.value })
                  }
                  placeholder="其他备注..."
                  rows={2}
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEventForm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddEvent}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Indicator Modal */}
      {showIndicatorForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-sm w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-50">
                记录指标
              </h3>
              <button
                onClick={() => setShowIndicatorForm(false)}
                className="p-1.5 rounded-lg hover:bg-arena-hover text-neutral-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {indicatorFormError && (
              <div className="mb-3 p-2 bg-danger/10 rounded-md text-danger text-sm">
                {indicatorFormError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">
                  指标名称
                </label>
                <input
                  value={indicatorForm.indicator_name}
                  onChange={(e) =>
                    setIndicatorForm((p) => ({
                      ...p,
                      indicator_name: e.target.value,
                    }))
                  }
                  placeholder="如: Fear & Greed Index"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    'Fear & Greed',
                    'VIX',
                    'DXY',
                    'US 10Y Yield',
                    'BTC Dominance',
                  ].map((preset) => (
                    <button
                      key={preset}
                      onClick={() =>
                        setIndicatorForm((p) => ({
                          ...p,
                          indicator_name: preset,
                        }))
                      }
                      className="text-xs px-2 py-0.5 rounded bg-arena-surface text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">
                  数值
                </label>
                <input
                  type="number"
                  step="any"
                  value={indicatorForm.value}
                  onChange={(e) =>
                    setIndicatorForm((p) => ({ ...p, value: e.target.value }))
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-neutral-400">
                  来源（可选）
                </label>
                <input
                  value={indicatorForm.source}
                  onChange={(e) =>
                    setIndicatorForm((p) => ({ ...p, source: e.target.value }))
                  }
                  placeholder="如: alternative.me"
                  className="w-full px-3 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowIndicatorForm(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleRecordIndicator}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>记录</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
