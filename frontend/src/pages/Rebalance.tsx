import { useEffect, useState } from 'react'
import { Target, AlertTriangle, CheckCircle, Settings, Plus, X } from 'lucide-react'
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
          <div className="h-8 bg-secondary rounded w-1/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-secondary rounded-lg"></div>
            <div className="h-64 bg-secondary rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">再平衡管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">监控和调整您的投资组合配置</p>
        </div>

        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium"
        >
          <Settings className="w-4 h-4" strokeWidth={1.75} />
          <span>配置</span>
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* 当前配置 */}
      {config && (
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">目标配置</h3>
          <div className={`grid grid-cols-2 gap-4 ${
            Object.keys(config.targets).length <= 4 ? 'md:grid-cols-' + (Object.keys(config.targets).length + 1) : 'md:grid-cols-4'
          }`}>
            {Object.entries(config.targets).map(([key, value]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-bold" style={{ color: getCategoryColor(key) }}>
                  {(value * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-muted-foreground">{getCategoryName(key)}</div>
              </div>
            ))}
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">{(config.threshold * 100).toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">偏离阈值</div>
            </div>
          </div>
        </div>
      )}

      {/* 再平衡状态 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 状态卡片 */}
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">再平衡状态</h3>
            {analysis && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ring-1 ${
                analysis.needsRebalancing
                  ? 'bg-amber-500/10 text-amber-400 ring-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20'
              }`}>
                {analysis.needsRebalancing ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>{analysis.needsRebalancing ? '需要调整' : '配置正常'}</span>
              </div>
            )}
          </div>

          {analysis && (
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-2">最大偏离度</div>
                <div className={`text-2xl font-bold ${
                  analysis.maxDeviation > (config?.threshold || 0.05) ? 'text-yellow-500' : 'text-green-500'
                }`}>
                  {formatPercent(analysis.maxDeviation * 100, 1)}
                </div>
              </div>

              <div>
                <div className="text-sm text-muted-foreground mb-2">建议摘要</div>
                <div className="text-sm text-foreground whitespace-pre-line">
                  {analysis.summary}
                </div>
              </div>

              {analysis.needsRebalancing && (
                <button
                  onClick={handleExecute}
                  className="w-full mt-4 px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors font-medium"
                >
                  记录执行再平衡
                </button>
              )}
            </div>
          )}
        </div>

        {/* 具体建议 */}
        <div className="bg-card/80 rounded-xl border border-border/60 ring-1 ring-border/20 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-4">具体建议</h3>

          {analysis?.suggestions && analysis.suggestions.length > 0 ? (
            <div className="space-y-4">
              {analysis.suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`border rounded-lg p-4 ${
                    suggestion.priority === 'high'
                      ? 'border-red-500/20 bg-red-500/5'
                      : suggestion.priority === 'medium'
                        ? 'border-yellow-500/20 bg-yellow-500/5'
                        : 'border-blue-500/20 bg-blue-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(suggestion.category) }}
                      ></div>
                      <span className="font-medium">{getCategoryName(suggestion.category)}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        suggestion.priority === 'high'
                          ? 'bg-red-500/20 text-red-500'
                          : suggestion.priority === 'medium'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-blue-500/20 text-blue-500'
                      }`}>
                        {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {suggestion.action === 'buy' ? '买入' : '卖出'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">当前占比</div>
                      <div className="font-medium">{(suggestion.currentPct * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">目标占比</div>
                      <div className="font-medium">{(suggestion.targetPct * 100).toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">建议金额</div>
                      <div className="font-medium">{formatCurrency(suggestion.amount, 'USD')}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">偏离度</div>
                      <div className="font-medium">{formatPercent(suggestion.deviation * 100, 1)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              当前配置均衡，无需调整
            </div>
          )}
        </div>
      </div>

      {/* 配置模态框 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-xl border border-border/60 p-6 w-full max-w-md ring-1 ring-border/40 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-foreground mb-4">配置目标配比</h3>

            <div className="space-y-4">
              {/* Dynamic category sliders */}
              {Object.entries(tempTargets).map(([key, value]) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-foreground">
                      {getCategoryName(key)} 目标比例 ({(value * 100).toFixed(0)}%)
                    </label>
                    <button
                      onClick={() => handleRemoveCategory(key)}
                      className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors"
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
                <div className="border-t border-border pt-4">
                  <label className="block text-sm font-medium text-foreground mb-2">添加类别目标</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={newCategoryKey}
                      onChange={(e) => setNewCategoryKey(e.target.value)}
                      className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm"
                    >
                      <option value="">选择类别...</option>
                      {availableCategories.map(c => (
                        <option key={c} value={c}>{getCategoryName(c)}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCategoryKey}
                      className="flex items-center gap-1 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>添加</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Threshold */}
              <div className="border-t border-border pt-4">
                <label className="block text-sm font-medium text-foreground mb-1">
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
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>已分配比例:</span>
                  <span className={targetsSum > 1.01 ? 'text-destructive font-medium' : ''}>
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
                  <span className="text-destructive">总比例超过100%，请调整</span>
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
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={targetsSum > 1.01}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
