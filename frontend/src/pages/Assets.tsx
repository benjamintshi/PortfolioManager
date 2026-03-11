import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Search, X, Save, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import { assetsApi, portfolioApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getCategoryName, getCategoryColor, getProfitColorClass } from '@/utils/format'

interface Asset {
  id: number
  category: 'crypto' | 'stock' | 'gold' | 'cash'
  symbol: string
  name: string
  quantity: number
  costPrice: number
  costCurrency: string
  currentPrice: number
  currentValue: number
  costValue: number
  profit: number
  profitPercent: number
  notes?: string
}

interface MergedAsset {
  symbol: string
  name: string
  category: 'crypto' | 'stock' | 'gold' | 'cash'
  totalQuantity: number
  avgCostPrice: number
  costCurrency: string
  currentPrice: number
  priceCurrency: string
  totalValueUsd: number
  totalCostUsd: number
  totalValueCny?: number
  totalCostCny?: number
  profitCny?: number
  profit: number
  profitPercent: number
  entries: Asset[]
}

interface AssetForm {
  category: 'crypto' | 'stock' | 'gold' | 'cash'
  symbol: string
  name: string
  quantity: string
  costPrice: string
  costCurrency: 'USD' | 'CNY'
  notes: string
}

const emptyForm: AssetForm = {
  category: 'crypto',
  symbol: '',
  name: '',
  quantity: '',
  costPrice: '',
  costCurrency: 'USD',
  notes: '',
}

const PRESETS: Record<string, { symbol: string; name: string; category: 'crypto' | 'stock' | 'gold' }[]> = {
  crypto: [
    { symbol: 'BTCUSDT', name: '比特币 BTC', category: 'crypto' },
    { symbol: 'ETHUSDT', name: '以太坊 ETH', category: 'crypto' },
    { symbol: 'SOLUSDT', name: 'Solana SOL', category: 'crypto' },
    { symbol: 'BNBUSDT', name: 'BNB', category: 'crypto' },
    { symbol: 'XRPUSDT', name: 'XRP', category: 'crypto' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin DOGE', category: 'crypto' },
  ],
  stock: [
    { symbol: 'AAPL', name: '苹果 Apple', category: 'stock' },
    { symbol: 'MSFT', name: '微软 Microsoft', category: 'stock' },
    { symbol: 'NVDA', name: '英伟达 NVIDIA', category: 'stock' },
    { symbol: 'TSLA', name: '特斯拉 Tesla', category: 'stock' },
    { symbol: 'SPY', name: '标普500 ETF', category: 'stock' },
  ],
  gold: [
    { symbol: 'GC=F', name: '黄金（按克）', category: 'gold' },
  ],
}

export default function Assets() {
  const [mergedAssets, setMergedAssets] = useState<MergedAsset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<MergedAsset[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [form, setForm] = useState<AssetForm>({ ...emptyForm })
  const [formError, setFormError] = useState('')

  const { loading, error, execute } = useApi()

  const loadData = async () => {
    try {
      const data = await execute(() => portfolioApi.getSummary())
      if (data?.mergedAssets) {
        setMergedAssets(data.mergedAssets)
      }
    } catch (err) {
      console.error('加载失败:', err)
    }
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    let filtered = mergedAssets
    if (filterCategory !== 'all') {
      filtered = filtered.filter(a => a.category === filterCategory)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(term) || a.symbol.toLowerCase().includes(term)
      )
    }
    setFilteredAssets(filtered)
  }, [mergedAssets, filterCategory, searchTerm])

  const toggleExpand = (symbol: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev)
      next.has(symbol) ? next.delete(symbol) : next.add(symbol)
      return next
    })
  }

  // 添加资产
  const handleAdd = async () => {
    setFormError('')
    if (!form.symbol.trim()) { setFormError('请输入资产代码'); return }
    if (!form.name.trim()) { setFormError('请输入资产名称'); return }
    if (!form.quantity || parseFloat(form.quantity) <= 0) { setFormError('请输入有效数量'); return }
    if (!form.costPrice || parseFloat(form.costPrice) <= 0) { setFormError('请输入有效成本价'); return }

    try {
      await execute(() => assetsApi.create({
        category: form.category,
        symbol: form.symbol.trim().toUpperCase(),
        name: form.name.trim(),
        quantity: parseFloat(form.quantity),
        costPrice: parseFloat(form.costPrice),
        costCurrency: form.costCurrency,
        notes: form.notes.trim() || undefined,
      }))
      setShowAddForm(false)
      setForm({ ...emptyForm })
      await loadData()
    } catch (err) {
      setFormError('添加失败，请重试')
    }
  }

  const handleEdit = (asset: Asset) => {
    setEditingAsset(asset)
    setForm({
      category: asset.category,
      symbol: asset.symbol,
      name: asset.name,
      quantity: String(asset.quantity),
      costPrice: String(asset.costPrice),
      costCurrency: (asset.costCurrency || 'USD') as 'USD' | 'CNY',
      notes: (asset as any).notes || '',
    })
    setFormError('')
    setShowEditForm(true)
  }

  const handleUpdate = async () => {
    if (!editingAsset) return
    setFormError('')
    try {
      await execute(() => assetsApi.update(editingAsset.id, {
        name: form.name.trim(),
        quantity: parseFloat(form.quantity),
        costPrice: parseFloat(form.costPrice),
        costCurrency: form.costCurrency,
        notes: form.notes.trim() || undefined,
      }))
      setShowEditForm(false)
      setEditingAsset(null)
      await loadData()
    } catch (err) {
      setFormError('更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除？关联交易记录将一并删除。')) return
    try {
      await execute(() => assetsApi.delete(id))
      await loadData()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const handlePreset = (preset: { symbol: string; name: string; category: 'crypto' | 'stock' | 'gold' }) => {
    setForm(prev => ({ ...prev, symbol: preset.symbol, name: preset.name, category: preset.category }))
  }

  const handleCopy = (entry: Asset) => {
    setForm({
      category: entry.category,
      symbol: entry.symbol,
      name: entry.name,
      quantity: '',
      costPrice: '',
      costCurrency: (entry.costCurrency || 'USD') as 'USD' | 'CNY',
      notes: '',
    })
    setFormError('')
    setShowAddForm(true)
  }

  // 表单渲染
  const renderForm = (isEdit: boolean) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-card rounded-lg border border-border p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{isEdit ? '编辑资产' : '添加资产'}</h3>
          <button onClick={() => { isEdit ? setShowEditForm(false) : setShowAddForm(false); setFormError('') }}>
            <X className="w-5 h-5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">{formError}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">类别</label>
            <select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as any }))} disabled={isEdit}
              className="w-full px-3 py-2 bg-background border border-border rounded-md disabled:opacity-50">
              <option value="crypto">🪙 加密货币</option>
              <option value="stock">📈 股票基金</option>
              <option value="gold">🏆 黄金贵金属</option>
              <option value="cash">💵 现金</option>
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">快捷选择</label>
              <div className="flex flex-wrap gap-2">
                {(PRESETS[form.category] || []).map(preset => (
                  <button key={preset.symbol} onClick={() => handlePreset(preset)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${form.symbol === preset.symbol ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/80'}`}>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">资产代码</label>
            <input type="text" value={form.symbol} onChange={(e) => setForm(prev => ({ ...prev, symbol: e.target.value }))} disabled={isEdit}
              placeholder="如 BTCUSDT / AAPL / 017436" className="w-full px-3 py-2 bg-background border border-border rounded-md disabled:opacity-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">名称</label>
            <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="如：比特币" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">持仓数量</label>
              <input type="number" step="any" value={form.quantity} onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="0.00" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">单位成本价</label>
              <div className="flex">
                <select value={form.costCurrency} onChange={(e) => setForm(prev => ({ ...prev, costCurrency: e.target.value as any }))}
                  className="px-2 py-2 bg-secondary border border-border rounded-l-md text-sm">
                  <option value="USD">$</option>
                  <option value="CNY">¥</option>
                </select>
                <input type="number" step="any" value={form.costPrice} onChange={(e) => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
                  placeholder="0.00" className="flex-1 px-3 py-2 bg-background border border-border border-l-0 rounded-r-md" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">备注（可选）</label>
            <input type="text" value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="如：Bybit合约账户" className="w-full px-3 py-2 bg-background border border-border rounded-md" />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={() => { isEdit ? setShowEditForm(false) : setShowAddForm(false); setFormError('') }}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">取消</button>
          <button onClick={isEdit ? handleUpdate : handleAdd} disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /><span>{loading ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">资产管理</h1>
          <p className="text-muted-foreground">管理您的投资组合资产</p>
        </div>
        <div className="flex items-center space-x-3">
          <button onClick={loadData} disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /><span>刷新</span>
          </button>
          <button onClick={() => { setForm({ ...emptyForm }); setFormError(''); setShowAddForm(true) }}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" /><span>添加资产</span>
          </button>
        </div>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="搜索资产名称或代码..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-md focus:ring-2 focus:ring-primary focus:border-transparent" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-md">
          <option value="all">全部类别</option>
          <option value="crypto">🪙 加密货币</option>
          <option value="stock">📈 股票基金</option>
          <option value="gold">🏆 黄金</option>
          <option value="cash">💵 现金</option>
        </select>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      )}

      {/* 合并资产列表 */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        {loading && !mergedAssets.length ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">加载中...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">{mergedAssets.length === 0 ? '暂无资产，点击"添加资产"开始' : '没有匹配的资产'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="table-header">
                <tr>
                  <th className="table-cell text-left w-8"></th>
                  <th className="table-cell text-left">资产</th>
                  <th className="table-cell text-left">类别</th>
                  <th className="table-cell text-right">总数量</th>
                  <th className="table-cell text-right">均价</th>
                  <th className="table-cell text-right">现价</th>
                  <th className="table-cell text-right">市值</th>
                  <th className="table-cell text-right">盈亏</th>
                  <th className="table-cell text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((ma) => {
                  const isExpanded = expandedSymbols.has(ma.symbol)
                  const hasMultiple = ma.entries.length > 1

                  return (
                    <>
                      {/* 合并行 */}
                      <tr key={ma.symbol} className="table-row hover:bg-secondary/30">
                        <td className="table-cell">
                          {hasMultiple && (
                            <button onClick={() => toggleExpand(ma.symbol)} className="p-0.5 hover:bg-secondary rounded">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </button>
                          )}
                        </td>
                        <td className="table-cell">
                          <div>
                            <div className="font-medium text-foreground">{ma.name}</div>
                            <div className="text-sm text-muted-foreground">{ma.symbol} {hasMultiple && <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{ma.entries.length}笔</span>}</div>
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(ma.category) }} />
                            <span className="text-sm">{getCategoryName(ma.category)}</span>
                          </div>
                        </td>
                        <td className="table-cell text-right tabular-nums">{ma.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className="table-cell text-right tabular-nums">
                          <span className="text-xs text-muted-foreground">{ma.costCurrency === 'CNY' ? '¥' : '$'}</span>
                          {ma.avgCostPrice.toFixed(4)}
                        </td>
                        <td className="table-cell text-right tabular-nums">
                          {ma.currentPrice > 0 ? (
                            <>{ma.currentPrice.toFixed(4)}</>
                          ) : <span className="text-muted-foreground">-</span>}
                        </td>
                        <td className="table-cell text-right tabular-nums font-medium">
                          {ma.priceCurrency === 'CNY' && ma.totalValueCny != null ? (
                            <div>
                              <div>¥{ma.totalValueCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-xs text-muted-foreground">≈{formatCurrency(ma.totalValueUsd, 'USD')}</div>
                            </div>
                          ) : (
                            formatCurrency(ma.totalValueUsd, 'USD')
                          )}
                        </td>
                        <td className={`table-cell text-right tabular-nums ${getProfitColorClass(ma.profit)}`}>
                          {ma.priceCurrency === 'CNY' && ma.profitCny != null ? (
                            <div>
                              <div>{ma.profitCny >= 0 ? '+' : ''}¥{ma.profitCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-xs">({formatPercent(ma.profitPercent)})</div>
                            </div>
                          ) : (
                            <div>
                              <div>{formatCurrency(ma.profit, 'USD', true)}</div>
                              <div className="text-xs">({formatPercent(ma.profitPercent)})</div>
                            </div>
                          )}
                        </td>
                        <td className="table-cell text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => handleCopy(ma.entries[0])} className="p-1 hover:bg-primary/10 rounded" title="复制添加">
                              <Copy className="w-4 h-4 text-primary" />
                            </button>
                            {!hasMultiple && ma.entries[0] && (
                              <>
                                <button onClick={() => handleEdit(ma.entries[0])} className="p-1 hover:bg-secondary rounded" title="编辑">
                                  <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </button>
                                <button onClick={() => handleDelete(ma.entries[0].id)} className="p-1 hover:bg-destructive/10 rounded" title="删除">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 展开的明细行 */}
                      {isExpanded && hasMultiple && ma.entries.map((entry, idx) => (
                        <tr key={`${ma.symbol}-${entry.id}`} className="bg-secondary/20 border-l-2 border-primary/30">
                          <td className="table-cell"></td>
                          <td className="table-cell pl-8">
                            <div className="text-sm text-muted-foreground">
                              第{idx + 1}笔 {entry.notes && <span className="text-xs">· {entry.notes}</span>}
                            </div>
                          </td>
                          <td className="table-cell"></td>
                          <td className="table-cell text-right tabular-nums text-sm">{entry.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td className="table-cell text-right tabular-nums text-sm">
                            <span className="text-xs text-muted-foreground">{entry.costCurrency === 'CNY' ? '¥' : '$'}</span>
                            {entry.costPrice.toFixed(4)}
                          </td>
                          <td className="table-cell text-right tabular-nums text-sm">{entry.currentPrice.toFixed(4)}</td>
                          <td className="table-cell text-right tabular-nums text-sm">{formatCurrency(entry.currentValue, 'USD')}</td>
                          <td className={`table-cell text-right tabular-nums text-sm ${getProfitColorClass(entry.profit)}`}>
                            {formatCurrency(entry.profit, 'USD', true)}
                          </td>
                          <td className="table-cell text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button onClick={() => handleCopy(entry)} className="p-1 hover:bg-primary/10 rounded" title="复制添加">
                                <Copy className="w-3.5 h-3.5 text-primary" />
                              </button>
                              <button onClick={() => handleEdit(entry)} className="p-1 hover:bg-secondary rounded" title="编辑">
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                              </button>
                              <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-destructive/10 rounded" title="删除">
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 汇总 */}
      {filteredAssets.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-2">
          <span>共 {filteredAssets.length} 项资产（{filteredAssets.reduce((s, a) => s + a.entries.length, 0)} 笔持仓）</span>
          <span>总市值: {formatCurrency(filteredAssets.reduce((s, a) => s + a.totalValueUsd, 0), 'USD')}</span>
        </div>
      )}

      {showAddForm && renderForm(false)}
      {showEditForm && renderForm(true)}
    </div>
  )
}
