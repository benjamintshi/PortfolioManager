import { useEffect, useState } from 'react'
import { CheckCircle, Clock, AlertTriangle, ArrowRight, RefreshCw, FileText, Plus, X, Save } from 'lucide-react'
import { useApi, roadmapApi } from '@/hooks/useApi'
import { getCategoryColor } from '@/utils/format'

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

interface AdvisorReport {
  id: number
  report_type: string
  title: string
  content: string
  health_score: number
  market_fg: number
  total_value_usd: number
  created_at: number
}

const priorityConfig = {
  high: { label: '高', color: 'text-rose-400', bg: 'bg-rose-500/10 ring-rose-500/20' },
  medium: { label: '中', color: 'text-amber-400', bg: 'bg-amber-500/10 ring-amber-500/20' },
  low: { label: '低', color: 'text-emerald-400', bg: 'bg-emerald-500/10 ring-emerald-500/20' },
}

const statusConfig = {
  pending: { label: '待执行', icon: Clock, color: 'text-muted-foreground' },
  in_progress: { label: '执行中', icon: ArrowRight, color: 'text-primary' },
  done: { label: '已完成', icon: CheckCircle, color: 'text-emerald-400' },
  skipped: { label: '已跳过', icon: AlertTriangle, color: 'text-amber-400' },
}


export default function Roadmap() {
  const [items, setItems] = useState<RoadmapItem[]>([])
  const [grouped, setGrouped] = useState<Record<string, RoadmapItem[]>>({})
  const [reports, setReports] = useState<AdvisorReport[]>([])
  const [selectedItem, setSelectedItem] = useState<RoadmapItem | null>(null)
  const [executionNote, setExecutionNote] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newItem, setNewItem] = useState({ phase: '短期(1个月)', priority: 'medium', action: '', category: '', reason: '', deadline: '' })
  const { loading, execute } = useApi()

  const loadData = async () => {
    const roadmap = await execute(() => roadmapApi.getRoadmap())
    if (roadmap?.items) {
      setItems(roadmap.items)
      setGrouped(roadmap.grouped || {})
    }
    const reportsData = await execute(() => roadmapApi.getAdvisorReports(5))
    if (Array.isArray(reportsData)) setReports(reportsData)
  }

  useEffect(() => { loadData() }, [])

  const updateStatus = async (id: number, status: string, notes?: string) => {
    await execute(() => roadmapApi.updateItem(id, { status, execution_notes: notes }))
    setSelectedItem(null)
    setExecutionNote('')
    await loadData()
  }

  const addItem = async () => {
    if (!newItem.action) return
    await execute(() => roadmapApi.addItem(newItem))
    setShowAddForm(false)
    setNewItem({ phase: '短期(1个月)', priority: 'medium', action: '', category: '', reason: '', deadline: '' })
    await loadData()
  }

  const stats = {
    total: items.length,
    done: items.filter(i => i.status === 'done').length,
    pending: items.filter(i => i.status === 'pending').length,
    progress: items.length > 0 ? Math.round(items.filter(i => i.status === 'done').length / items.length * 100) : 0,
  }

  return (
    <div className="p-6 space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">资产配置路线图</h1>
          <p className="text-sm text-muted-foreground mt-0.5">跟踪再平衡计划执行进度</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/60 text-secondary-foreground hover:bg-secondary/80 text-sm font-medium">
            <RefreshCw className="w-4 h-4" strokeWidth={1.75} /><span>刷新</span>
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium">
            <Plus className="w-4 h-4" strokeWidth={1.75} /><span>添加计划</span>
          </button>
        </div>
      </div>

      {/* 进度概览 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card/80 p-4 rounded-xl border border-border/60 ring-1 ring-border/20">
          <div className="text-sm text-muted-foreground font-medium">总计划</div>
          <div className="text-xl font-bold text-foreground mt-1">{stats.total}</div>
        </div>
        <div className="bg-card/80 p-4 rounded-xl border border-border/60 ring-1 ring-border/20">
          <div className="text-sm text-muted-foreground font-medium">已完成</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{stats.done}</div>
        </div>
        <div className="bg-card/80 p-4 rounded-xl border border-border/60 ring-1 ring-border/20">
          <div className="text-sm text-muted-foreground font-medium">待执行</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{stats.pending}</div>
        </div>
        <div className="bg-card/80 p-4 rounded-xl border border-border/60 ring-1 ring-border/20">
          <div className="text-sm text-muted-foreground font-medium">完成率</div>
          <div className="text-xl font-bold text-primary mt-1">{stats.progress}%</div>
          <div className="mt-2 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
          </div>
        </div>
      </div>

      {/* 按阶段展示 */}
      {Object.entries(grouped).map(([phase, phaseItems]) => (
        <div key={phase} className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-secondary/30">
            <h2 className="text-lg font-semibold text-foreground">{phase}</h2>
            <p className="text-sm text-muted-foreground">
              {phaseItems.filter(i => i.status === 'done').length}/{phaseItems.length} 完成
            </p>
          </div>
          <div className="divide-y divide-border">
            {phaseItems.map(item => {
              const statusCfg = statusConfig[item.status]
              const priorityCfg = priorityConfig[item.priority]
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
                        <span className={`font-medium ${item.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.action}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ring-1 ${priorityCfg.bg}`}>
                          {priorityCfg.label}优先
                        </span>
                      </div>
                      {item.reason && <p className="text-sm text-muted-foreground mt-1">{item.reason}</p>}
                      {item.target_amount && (
                        <p className="text-sm text-primary mt-1">
                          目标: {item.target_amount > 0 ? '+' : ''}{item.target_currency === 'USD' ? '$' : '¥'}{Math.abs(item.target_amount).toLocaleString()}
                        </p>
                      )}
                      {item.execution_notes && (
                        <p className="text-sm text-emerald-400 mt-1">{item.execution_notes}</p>
                      )}
                      {item.deadline && (
                        <p className="text-xs text-muted-foreground mt-1">截止: {item.deadline}</p>
                      )}
                    </div>
                  </div>
                  
                  {item.status !== 'done' && (
                    <div className="flex items-center space-x-2 ml-4">
                      {item.status === 'pending' && (
                        <button onClick={() => updateStatus(item.id, 'in_progress')}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/15 text-primary ring-1 ring-primary/20 hover:bg-primary/25">
                          开始
                        </button>
                      )}
                      <button onClick={() => { setSelectedItem(item); setExecutionNote('') }}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/25">
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

      {/* 最近分析报告 */}
      {reports.length > 0 && (
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-lg font-semibold text-foreground flex items-center space-x-2">
              <FileText className="w-5 h-5" /><span>分析报告</span>
            </h2>
          </div>
          <div className="divide-y divide-border">
            {reports.map(report => (
              <div key={report.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-foreground">{report.title}</h3>
                  <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                    {report.health_score && <span>健康评分: {report.health_score}/100</span>}
                    <span>{new Date(report.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <pre className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap font-sans">{report.content.slice(0, 500)}...</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 完成确认弹窗 */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border/60 p-6 w-full max-w-md ring-1 ring-border/40">
            <h3 className="text-lg font-semibold text-foreground mb-2">标记完成</h3>
            <p className="text-sm text-muted-foreground mb-4">{selectedItem.action}</p>
            <textarea value={executionNote} onChange={(e) => setExecutionNote(e.target.value)}
              placeholder="执行备注（如：买入了¥3000黄金ETF，净值3.61）" rows={3}
              className="w-full px-3 py-2 bg-background border border-border rounded-md mb-4" />
            <div className="flex justify-end space-x-3">
              <button onClick={() => setSelectedItem(null)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">取消</button>
              <button onClick={() => updateStatus(selectedItem.id, 'done', executionNote)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">确认完成</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加计划弹窗 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border/60 p-6 w-full max-w-md ring-1 ring-border/40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">添加计划</h3>
              <button onClick={() => setShowAddForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" value={newItem.action} onChange={(e) => setNewItem(p => ({ ...p, action: e.target.value }))}
                placeholder="计划内容" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
              <div className="grid grid-cols-2 gap-3">
                <select value={newItem.phase} onChange={(e) => setNewItem(p => ({ ...p, phase: e.target.value }))}
                  className="px-3 py-2 bg-background border border-border rounded-md">
                  <option value="短期(1个月)">短期(1个月)</option>
                  <option value="中期(3个月)">中期(3个月)</option>
                  <option value="长期(6个月+)">长期(6个月+)</option>
                </select>
                <select value={newItem.priority} onChange={(e) => setNewItem(p => ({ ...p, priority: e.target.value }))}
                  className="px-3 py-2 bg-background border border-border rounded-md">
                  <option value="high">高优先</option>
                  <option value="medium">中优先</option>
                  <option value="low">低优先</option>
                </select>
              </div>
              <input type="text" value={newItem.reason} onChange={(e) => setNewItem(p => ({ ...p, reason: e.target.value }))}
                placeholder="原因/理由" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
            </div>
            <div className="flex justify-end space-x-3 mt-4">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md">取消</button>
              <button onClick={addItem} className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md">
                <Save className="w-4 h-4" /><span>保存</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
