import { useEffect, useState } from 'react'
import { Target, AlertTriangle, CheckCircle, Settings, Plus, X, Scale } from 'lucide-react'
import { rebalanceApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getCategoryName, getCategoryColor } from '@/utils/format'

interface RebalanceConfig {
  targets: Record<string, number>
  threshold: number
  // legacy fields for backward compatibility
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

// All known categories for the "add target" dropdown
const ALL_CATEGORIES = ['crypto', 'stock', 'gold', 'bond', 'commodity', 'reit']

/**
 * Normalize config from backend: supports both new { targets, threshold }
 * and legacy { cryptoTarget, stockTarget, goldTarget, threshold } formats.
 */
function normalizeConfig(raw: any): RebalanceConfig {
  if (raw.targets && typeof raw.targets === 'object') {
    return { targets: { ...raw.targets }, threshold: raw.threshold ?? 0.05 }
  }
  // legacy format
  const targets: Record<string, number> = {}
  if (raw.cryptoTarget != null) targets.crypto = raw.cryptoTarget
  if (raw.stockTarget != null) targets.stock = raw.stockTarget
  if (raw.goldTarget != null) targets.gold = raw.goldTarget
  // also check short keys
  if (raw.crypto != null && targets.crypto == null) targets.crypto = raw.crypto
  if (raw.stock != null && targets.stock == null) targets.stock = raw.stock
  if (raw.gold != null && targets.gold == null) targets.gold = raw.gold
  return { targets, threshold: raw.threshold ?? 0.05 }
}

export default function Rebalance() {
  const [config, setConfig] = useState<RebalanceConfig | null>(null)
  const [analysis, setAnalysis] = useState<RebalanceAnalysis | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tempTargets, setTempTargets] = useState<Record<string, number>>({ crypto: 0.4, stock: 0.4, gold: 0.2 })
  const [tempThreshold, setTempThreshold] = useState(0.05)
  const [newCategoryKey, setNewCategoryKey] = useState('')

  const { loading, error, execute } = useApi()

  // 加载数据
  const loadData = async () => {
    try {
      const [configData, analysisData] = await Promise.all([
        execute(() => rebalanceApi.getConfig()),
        execute(() => rebalanceApi.getSuggestions())
      ])

      if (configData) {
        const normalized = normalizeConfig(configData)
        setConfig(normalized)
        setTempTargets({ ...normalized.targets })
        setTempThreshold(normalized.threshold)
      }
      if (analysisData) setAnalysis(analysisData)
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 保存配置
  const handleSaveConfig = async () => {
    try {
      await execute(() => rebalanceApi.updateConfig({ targets: tempTargets, threshold: tempThreshold } as any))
      const newConfig: RebalanceConfig = { targets: { ...tempTargets }, threshold: tempThreshold }
      setConfig(newConfig)
      setShowSettings(false)
      // 重新计算建议
      loadData()
    } catch (error) {
      console.error('保存配置失败:', error)
    }
  }

  // 执行再平衡
  const handleExecute = async () => {
    if (!confirm('确定要记录此次再平衡执行吗？')) return

    try {
      await execute(() => rebalanceApi.execute('手动执行'))
      loadData()
    } catch (error) {
      console.error('记录再平衡失败:', error)
    }
  }

  // 计算目标总和
  const targetsSum = Object.values(tempTargets).reduce((s, v) => s + v, 0)
  const cashRemaining = Math.max(0, 1 - targetsSum)

  // 添加新类别目标
  const handleAddCategory = () => {
    if (!newCategoryKey || newCategoryKey in tempTargets) return
    setTempTargets(prev => ({ ...prev, [newCategoryKey]: 0 }))
    setNewCategoryKey('')
  }

  // 删除类别目标
  const handleRemoveCategory = (key: string) => {
    setTempTargets(prev => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // 可添加的类别（尚未在 targets 中的）
  const availableCategories = ALL_CATEGORIES.filter(c => !(c in tempTargets))

  if (loading && !config) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-arena-surface rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-arena-surface rounded-lg"></div>
            <div className="h-64 bg-arena-surface rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">再平衡管理</span>
              </h1>
              <p className="text-sm text-neutral-400">监控和调整您的投资组合配置</p>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/80 text-sm font-medium"
            >
              <Settings className="w-4 h-4" strokeWidth={1.75} />
              <span>配置</span>
            </button>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6 space-y-5">

      {/* 错误信息 */}
      {error && (
        <div className="rounded-xl bg-danger/10 border border-danger/20 p-4">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {/* 目标配置 — stat cards */}
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

      {/* 状态 + 建议卡片 */}
      {analysis && (
        <>
          {/* 状态横条 */}
          <div className={`glass scan-line rounded-lg p-5 border ${
            analysis.needsRebalancing
              ? 'border-amber-500/20 glow-border'
              : 'border-emerald-500/20 glow-border-success'
          }`} style={analysis.needsRebalancing ? { borderColor: 'rgba(245,158,11,0.2)', boxShadow: 'inset 0 0 20px rgba(245,158,11,0.05), 0 0 20px rgba(245,158,11,0.05)' } : undefined}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`flex size-12 items-center justify-center rounded-full ${
                  analysis.needsRebalancing ? 'bg-amber-500/10' : 'bg-emerald-500/10'
                }`}>
                  {analysis.needsRebalancing
                    ? <AlertTriangle className="size-6 text-amber-400" strokeWidth={1.75} />
                    : <CheckCircle className="size-6 text-emerald-400" strokeWidth={1.75} />
                  }
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
                  onClick={handleExecute}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all"
                >
                  记录执行再平衡
                </button>
              )}
            </div>
          </div>

          {/* 具体建议列表 */}
          {analysis.suggestions && analysis.suggestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-neutral-50">调仓建议</h3>
              {analysis.suggestions.map((suggestion, index) => {
                const isBuy = suggestion.action === 'buy'
                const color = getCategoryColor(suggestion.category)
                return (
                  <div
                    key={index}
                    className="glass rounded-lg border border-[rgba(100,140,255,0.1)] p-4 hover:border-[rgba(100,140,255,0.25)] transition-all animate-fade-in-up"
                    style={{ animationDelay: `${index * 60}ms` }}
                  >
                    <div className="flex items-center gap-4">
                      {/* 左侧：资产 + 操作方向 */}
                      <div className="flex items-center gap-3 min-w-[140px]">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                        <div>
                          <div className="font-medium text-neutral-50">{getCategoryName(suggestion.category)}</div>
                          <div className={`text-xs font-semibold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isBuy ? '买入' : '卖出'}
                          </div>
                        </div>
                      </div>

                      {/* 中间：进度条 — 当前 → 目标 */}
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

                      {/* 右侧：金额 + 偏离 */}
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

      {/* 配置模态框 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-md w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-neutral-50 mb-4">配置目标配比</h3>

            <div className="space-y-4">
              {/* Dynamic category sliders */}
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
                      onChange={(e) => setTempTargets(prev => ({
                        ...prev,
                        [key]: parseFloat(e.target.value)
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>
              ))}

              {/* Add new category */}
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
                      <Plus className="w-4 h-4" />
                      <span>添加</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Threshold */}
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

              {/* Summary */}
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
      </section>
    </>
  )
}
