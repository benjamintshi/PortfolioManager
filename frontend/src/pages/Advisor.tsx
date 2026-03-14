import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, ChevronRight, ThumbsDown, CheckCircle, Loader2, TrendingDown, Shield, Target, Zap, BarChart3 } from 'lucide-react'
import { advisorApi, useApi } from '@/hooks/useApi'

interface AdvisorInsights {
  healthBreakdown?: Array<{ label: string; score: number; max: number; reason: string }>
  scenarios?: Array<{ name: string; description: string; portfolioImpact: number; impactUsd: number }>
  concentration?: {
    top3Pct: number
    topAsset: { name: string; pct: number }
    warning: string | null
  }
  actionableItems?: Array<{
    text: string
    priority: 'high' | 'medium' | 'low'
    category: string
    action?: string
  }>
  summary?: string
}

interface AdvisorReport {
  id: number
  report_type: string
  title: string
  content: string
  health_score: number
  suggestions: string[]
  insights?: AdvisorInsights | null
  total_value_usd: number
  created_at: number
}

function getHealthColor(score: number) {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-rose-400'
}

function getHealthBg(score: number) {
  if (score >= 80) return 'bg-emerald-500/15 ring-emerald-500/20'
  if (score >= 60) return 'bg-amber-500/15 ring-amber-500/20'
  return 'bg-rose-500/15 ring-rose-500/20'
}

function HealthGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = score >= 80 ? 'stroke-emerald-400' : score >= 60 ? 'stroke-amber-400' : 'stroke-rose-400'
  const circumference = 2 * Math.PI * 45
  const strokeDash = (pct / 100) * circumference
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary/50" />
        <circle
          cx="50" cy="50" r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - strokeDash}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getHealthColor(score)}`}>{score}</span>
        <span className="text-xs text-muted-foreground">健康度</span>
      </div>
    </div>
  )
}

export default function Advisor() {
  const [reports, setReports] = useState<AdvisorReport[]>([])
  const [selectedReport, setSelectedReport] = useState<AdvisorReport | null>(null)
  const [feedbackSent, setFeedbackSent] = useState<Set<number>>(new Set())

  const { loading, error, execute } = useApi()
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const loadReports = async () => {
    try {
      const data = await execute(() => advisorApi.getReports(30))
      const list = Array.isArray(data) ? data : (data as any)?.data
      if (list) setReports(list)
    } catch (_) {
      /* 加载失败时静默，可能后端未启动 */
    }
  }

  useEffect(() => { loadReports() }, [])

  const handleAnalyze = async () => {
    setAnalyzeError(null)
    try {
      const result = await execute(() => advisorApi.runAnalyze())
      if (result?.id) {
        await loadReports()
        const detail = await execute(() => advisorApi.getReport(result.id))
        const report = (detail as any)?.data ?? detail
        if (report) setSelectedReport(report)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '分析失败'
      setAnalyzeError(msg.includes('Network') || msg.includes('fetch') ? '无法连接后端，请确认 backend 已启动 (npm run dev)' : msg)
    }
  }

  const handleFeedback = async (reportId: number, actedOn: boolean) => {
    await execute(() => advisorApi.submitFeedback(reportId, { acted_on: actedOn }))
    setFeedbackSent(prev => new Set(prev).add(reportId))
  }

  const insights = selectedReport?.insights

  return (
    <div className="p-6 space-y-6">
      {/* Hero */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20">
              <Sparkles className="w-7 h-7 text-primary" strokeWidth={1.75} />
            </div>
            资产管理大师
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            机构级深度分析：组合健康度、场景压力测试、集中度监控、可执行建议。参考 Jenova、ProCogia 等专业智能体设计，零配置开箱即用。
          </p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-sm font-semibold shrink-0"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" strokeWidth={1.75} /> : <RefreshCw className="w-5 h-5" strokeWidth={1.75} />}
          <span>{loading ? '分析中...' : '立即分析'}</span>
        </button>
      </div>

      {(error || analyzeError) && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3">
          <span className="text-rose-400 shrink-0">⚠</span>
          <div>
            <p className="text-sm font-medium text-rose-400">{analyzeError || error}</p>
            <p className="text-xs text-muted-foreground mt-1">请确认后端已启动：cd backend && npm run dev</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* 报告列表 */}
        <div className="xl:col-span-1 bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 bg-secondary/20">
            <h2 className="text-sm font-semibold text-foreground">历史报告</h2>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {reports.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>暂无报告</p>
                <p className="mt-1">点击「立即分析」生成</p>
              </div>
            ) : (
              reports.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className={`w-full px-4 py-3 text-left border-b border-border/40 hover:bg-secondary/30 transition-colors flex items-center justify-between ${
                    selectedReport?.id === r.id ? 'bg-primary/10 ring-l-2 ring-primary' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{r.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${getHealthColor(r.health_score)}`}>{r.health_score} 分</span>
                      <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))
            )}
          </div>
        </div>

        {/* 主内容区 */}
        <div className="xl:col-span-3 space-y-6">
          {selectedReport ? (
            <>
              {/* 健康度仪表盘 */}
              <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex items-center gap-6">
                    <HealthGauge score={selectedReport.health_score} />
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">{selectedReport.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(selectedReport.created_at).toLocaleString('zh-CN')}
                        {selectedReport.total_value_usd > 0 && (
                          <span className="ml-2">· 总资产 ${selectedReport.total_value_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        )}
                      </p>
                      {insights?.summary && (
                        <p className="text-sm text-foreground/80 mt-2 max-w-md">{insights.summary}</p>
                      )}
                    </div>
                  </div>
                  {!feedbackSent.has(selectedReport.id) && (
                    <div className="flex items-center gap-2 md:ml-auto">
                      <span className="text-xs text-muted-foreground">有帮助？</span>
                      <button onClick={() => handleFeedback(selectedReport.id, true)} className="p-2 rounded-lg hover:bg-emerald-500/20 text-emerald-400" title="已采纳">
                        <CheckCircle className="w-5 h-5" strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleFeedback(selectedReport.id, false)} className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-400" title="未采纳">
                        <ThumbsDown className="w-5 h-5" strokeWidth={1.75} />
                      </button>
                    </div>
                  )}
                </div>

                {/* 健康度拆解 */}
                {insights?.healthBreakdown && insights.healthBreakdown.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border/60">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" /> 健康度拆解
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {insights.healthBreakdown.map((h, i) => (
                        <div key={i} className="rounded-lg bg-secondary/30 p-3 ring-1 ring-border/30">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{h.label}</span>
                            <span className="font-medium">{h.score}/{h.max}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(h.score / h.max) * 100}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate" title={h.reason}>{h.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 场景压力测试 */}
              {insights?.scenarios && insights.scenarios.length > 0 && (
                <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-primary" /> 场景压力测试
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">模拟不同市场冲击对组合的影响</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.scenarios.map((s, i) => (
                      <div key={i} className="rounded-xl bg-secondary/20 p-4 ring-1 ring-border/30 hover:ring-primary/20 transition-all">
                        <div className="font-medium text-foreground">{s.name}</div>
                        <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className={`text-lg font-bold ${s.portfolioImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {s.portfolioImpact >= 0 ? '+' : ''}{s.portfolioImpact.toFixed(1)}%
                          </span>
                          <span className="text-xs text-muted-foreground">
                            约 ${Math.abs(s.impactUsd).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 集中度 + 可执行建议 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {insights?.concentration && (
                  <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-6">
                    <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" /> 集中度分析
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">前三大持仓占比</span>
                        <span className="font-medium">{insights.concentration.top3Pct.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">最大单一持仓</span>
                        <span className="font-medium">{insights.concentration.topAsset.name} {insights.concentration.topAsset.pct.toFixed(1)}%</span>
                      </div>
                      {insights.concentration.warning && (
                        <div className="mt-3 p-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20 text-amber-400 text-sm">
                          {insights.concentration.warning}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-6">
                  <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" /> 可执行建议
                  </h3>
                  <ul className="space-y-3">
                    {(insights?.actionableItems || selectedReport.suggestions?.map((s, i) => ({ text: s, priority: 'medium' as const, category: 'general' })) || []).map((item, i) => {
                      const it = typeof item === 'string' ? { text: item, priority: 'medium' as const, category: 'general' } : item
                      const priorityColor = it.priority === 'high' ? 'text-rose-400' : it.priority === 'medium' ? 'text-amber-400' : 'text-muted-foreground'
                      return (
                        <li key={i} className="flex items-start gap-3">
                          <span className={`text-xs font-medium shrink-0 ${priorityColor}`}>
                            {it.priority === 'high' ? '高' : it.priority === 'medium' ? '中' : '低'}
                          </span>
                          <span className="text-foreground/90 text-sm">{it.text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>

              {/* 详细报告（可折叠） */}
              <details className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 overflow-hidden">
                <summary className="px-6 py-4 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
                  查看完整报告
                </summary>
                <div className="px-6 pb-6 pt-0 text-foreground/90 leading-relaxed space-y-2">
                  {selectedReport.content.split('\n').map((line, i) => {
                    if (line.startsWith('## ')) return <h3 key={i} className="text-base font-semibold mt-4 mb-2 first:mt-0">{line.replace('## ', '')}</h3>
                    if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} className="pl-4 flex gap-2"><span className="text-primary">•</span><span>{line.slice(2)}</span></div>
                    if (line.trim()) return <p key={i}>{line}</p>
                    return <br key={i} />
                  })}
                </div>
              </details>
            </>
          ) : (
            <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-16 text-center">
              <Sparkles className="w-16 h-16 mx-auto mb-6 opacity-30" strokeWidth={1.5} />
              <h3 className="text-lg font-semibold text-foreground mb-2">选择报告或生成新分析</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                左侧选择历史报告，或点击「立即分析」生成包含健康度拆解、场景压力测试、集中度分析的新报告
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
