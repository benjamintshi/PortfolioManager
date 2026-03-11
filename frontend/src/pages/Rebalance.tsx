import { useEffect, useState } from 'react'
import { Target, AlertTriangle, CheckCircle, Settings } from 'lucide-react'
import { rebalanceApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getCategoryName, getCategoryColor } from '@/utils/format'

interface RebalanceConfig {
  cryptoTarget: number
  stockTarget: number
  goldTarget: number
  threshold: number
}

interface RebalanceSuggestion {
  category: 'crypto' | 'stock' | 'gold'
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

export default function Rebalance() {
  const [config, setConfig] = useState<RebalanceConfig | null>(null)
  const [analysis, setAnalysis] = useState<RebalanceAnalysis | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [tempConfig, setTempConfig] = useState<RebalanceConfig>({
    cryptoTarget: 0.4,
    stockTarget: 0.4,
    goldTarget: 0.2,
    threshold: 0.05
  })

  const { loading, error, execute } = useApi()

  // 加载数据
  const loadData = async () => {
    try {
      const [configData, analysisData] = await Promise.all([
        execute(() => rebalanceApi.getConfig()),
        execute(() => rebalanceApi.getSuggestions())
      ])

      if (configData) {
        setConfig(configData)
        setTempConfig(configData)
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
      await execute(() => rebalanceApi.updateConfig(tempConfig))
      setConfig(tempConfig)
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
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">再平衡管理</h1>
          <p className="text-muted-foreground">监控和调整您的投资组合配置</p>
        </div>
        
        <button
          onClick={() => setShowSettings(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>配置</span>
        </button>
      </div>

      {/* 错误信息 */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* 当前配置 */}
      {config && (
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">目标配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-crypto">{(config.cryptoTarget * 100).toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">加密货币</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-stock">{(config.stockTarget * 100).toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">股票基金</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gold">{(config.goldTarget * 100).toFixed(0)}%</div>
              <div className="text-sm text-muted-foreground">黄金</div>
            </div>
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
        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">再平衡状态</h3>
            {analysis && (
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                analysis.needsRebalancing 
                  ? 'bg-yellow-500/10 text-yellow-500' 
                  : 'bg-green-500/10 text-green-500'
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
                  className="w-full mt-4 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors"
                >
                  记录执行再平衡
                </button>
              )}
            </div>
          )}
        </div>

        {/* 具体建议 */}
        <div className="bg-card rounded-lg border border-border p-6">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg border border-border p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">配置目标配比</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  加密货币目标比例 ({(tempConfig.cryptoTarget * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={tempConfig.cryptoTarget}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    cryptoTarget: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  股票基金目标比例 ({(tempConfig.stockTarget * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={tempConfig.stockTarget}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    stockTarget: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  黄金目标比例 ({(tempConfig.goldTarget * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={tempConfig.goldTarget}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    goldTarget: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  偏离阈值 ({(tempConfig.threshold * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.2"
                  step="0.01"
                  value={tempConfig.threshold}
                  onChange={(e) => setTempConfig(prev => ({
                    ...prev,
                    threshold: parseFloat(e.target.value)
                  }))}
                  className="w-full"
                />
              </div>

              <div className="text-sm text-muted-foreground">
                总比例: {((tempConfig.cryptoTarget + tempConfig.stockTarget + tempConfig.goldTarget) * 100).toFixed(0)}%
                {Math.abs(tempConfig.cryptoTarget + tempConfig.stockTarget + tempConfig.goldTarget - 1) > 0.01 && (
                  <span className="text-destructive ml-2">（应为100%）</span>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowSettings(false)
                  setTempConfig(config || tempConfig)
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={Math.abs(tempConfig.cryptoTarget + tempConfig.stockTarget + tempConfig.goldTarget - 1) > 0.01}
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