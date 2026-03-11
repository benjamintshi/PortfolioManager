import { useEffect, useState } from 'react'
import { CheckCircle, Clock, AlertTriangle, ArrowRight, RefreshCw, FileText, Plus, X, Save } from 'lucide-react'
import { useApi } from '@/hooks/useApi'

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:6002/api'

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
  high: { label: '高', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
  medium: { label: '中', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  low: { label: '低', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
}

const statusConfig = {
  pending: { label: '待执行', icon: Clock, color: 'text-muted-foreground' },
  in_progress: { label: '执行中', icon: ArrowRight, color: 'text-blue-400' },
  done: { label: '已完成', icon: CheckCircle, color: 'text-green-400' },
  skipped: { label: '已跳过', icon: AlertTriangle, color: 'text-yellow-400' },
}

const categoryEmoji: Record<string, string> = {
  crypto: '🪙', stock: '📈', gold: '🏆', cash: '💵',
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
    try {
      const res = await fetch(`${API_BASE}/roadmap`)
      const data = await res.json()
      if (data.success) {
        setItems(data.data.items)
        setGrouped(data.data.grouped)
      }
      
      const repRes = await fetch(`${API_BASE}/advisor/reports?limit=5`)
      const repData = await repRes.json()
      if (repData.success) setReports(repData.data)
    } catch (e) {
      console.error('加载失败:', e)
    }
  }

  useEffect(() => { loadData() }, [])

  const updateStatus = async (id: number, status: string, notes?: string) => {
    try {
      await fetch(`${API_BASE}/roadmap/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, execution_notes: notes }),
      })
      setSelectedItem(null)
      setExecutionNote('')
      await loadData()
    } catch (e) {
      console.error('更新失败:', e)
    }
  }

  const addItem = async () => {
    if (!newItem.action) return
    try {
      await fetch(`${API_BASE}/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      })
      setShowAddForm(false)
      setNewItem({ phase: '短期(1个月)', priority: 'medium', action: '', category: '', reason: '', deadline: '' })
      await loadData()
    } catch (e) {
      console.error('添加失败:', e)
    }
  }

  const stats = {
    total: items.length,
    done: items.filter(i => i.status === 'done').length,
    pending: items.filter(i => i.status === 'pending').length,
    progress: items.length > 0 ? Math.round(items.filter(i => i.status === 'done').length / items.length * 100) : 0,
  }

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">📋 资产配置路线图</h1>
          <p className="text-muted-foreground">跟踪再平衡计划执行进度</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={loadData} className="flex items-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80">
            <RefreshCw className="w-4 h-4" /><span>刷新</span>
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
            <Plus className="w-4 h-4" /><span>添加计划</span>
          </button>
        </div>
      </div>

      {/* 进度概览 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground">总计划</div>
          <div className="text-2xl font-bold text-foreground">{stats.total}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground">已完成</div>
          <div className="text-2xl font-bold text-green-400">{stats.done}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground">待执行</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
        </div>
        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="text-sm text-muted-foreground">完成率</div>
          <div className="text-2xl font-bold text-primary">{stats.progress}%</div>
          <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stats.progress}%` }} />
          </div>
        </div>
      </div>

      {/* 按阶段展示 */}
      {Object.entries(grouped).map(([phase, phaseItems]) => (
        <div key={phase} className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-secondary/30">
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
                    <StatusIcon className={`w-5 h-5 mt-0.5 ${statusCfg.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{categoryEmoji[item.category] || '📌'}</span>
                        <span className={`font-medium ${item.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.action}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityCfg.bg}`}>
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
                        <p className="text-sm text-green-400 mt-1">📝 {item.execution_notes}</p>
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
                          className="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-md hover:bg-blue-500/20">
                          开始
                        </button>
                      )}
                      <button onClick={() => { setSelectedItem(item); setExecutionNote('') }}
                        className="px-3 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/30 rounded-md hover:bg-green-500/20">
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
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
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
