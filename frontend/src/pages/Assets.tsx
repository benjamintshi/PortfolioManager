import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, RefreshCw, Search, X, Save, ChevronDown, ChevronRight, Copy, Coins } from 'lucide-react'
import { assetsApi, portfolioApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatPercent, getCategoryName, getCategoryColor, getProfitColorClass } from '@/utils/format'

interface Asset {
  id: number
  category: string
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
  category: string
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
  category: string
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

const PRESETS: Record<string, { symbol: string; name: string; category: string }[]> = {
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
  bond: [
    { symbol: 'TLT', name: '20年+国债 ETF', category: 'bond' },
    { symbol: 'SHY', name: '1-3年国债 ETF', category: 'bond' },
    { symbol: 'IEI', name: '3-7年国债 ETF', category: 'bond' },
  ],
  commodity: [
    { symbol: 'COPX', name: '铜矿 ETF', category: 'commodity' },
    { symbol: 'CPER', name: '铜期货 ETF', category: 'commodity' },
    { symbol: 'URA', name: '铀矿 ETF', category: 'commodity' },
    { symbol: 'DBC', name: '大宗商品指数 ETF', category: 'commodity' },
  ],
  reit: [
    { symbol: 'VNQ', name: '不动产 ETF', category: 'reit' },
    { symbol: 'XLRE', name: '房地产精选 ETF', category: 'reit' },
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

  const handlePreset = (preset: { symbol: string; name: string; category: string }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-50">{isEdit ? '编辑资产' : '添加资产'}</h3>
          <button onClick={() => { isEdit ? setShowEditForm(false) : setShowAddForm(false); setFormError('') }}>
            <X className="w-5 h-5 text-neutral-400 hover:text-neutral-200" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-danger text-sm">{formError}</div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-50 mb-1">类别</label>
            <select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value as any }))} disabled={isEdit}
              className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md disabled:opacity-50">
              <option value="crypto">加密货币</option>
              <option value="stock">股票基金</option>
              <option value="gold">黄金贵金属</option>
              <option value="bond">固定收益</option>
              <option value="commodity">大宗商品</option>
              <option value="reit">不动产/REITs</option>
              <option value="cash">现金</option>
            </select>
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-neutral-50 mb-1">快捷选择</label>
              <div className="flex flex-wrap gap-2">
                {(PRESETS[form.category] || []).map(preset => (
                  <button key={preset.symbol} onClick={() => handlePreset(preset)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${form.symbol === preset.symbol ? 'bg-primary text-white border-primary' : 'bg-arena-surface text-neutral-300 border-[rgba(100,140,255,0.1)] hover:bg-arena-hover'}`}>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-neutral-50 mb-1">资产代码</label>
            <input type="text" value={form.symbol} onChange={(e) => setForm(prev => ({ ...prev, symbol: e.target.value }))} disabled={isEdit}
              placeholder="如 BTCUSDT / AAPL / 017436" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md disabled:opacity-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-50 mb-1">名称</label>
            <input type="text" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="如：比特币" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-50 mb-1">持仓数量</label>
              <input type="number" step="any" value={form.quantity} onChange={(e) => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="0.00" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-50 mb-1">单位成本价</label>
              <div className="flex">
                <select value={form.costCurrency} onChange={(e) => setForm(prev => ({ ...prev, costCurrency: e.target.value as any }))}
                  className="px-2 py-2 bg-arena-surface border border-[rgba(100,140,255,0.1)] rounded-l-md text-sm">
                  <option value="USD">$</option>
                  <option value="CNY">¥</option>
                </select>
                <input type="number" step="any" value={form.costPrice} onChange={(e) => setForm(prev => ({ ...prev, costPrice: e.target.value }))}
                  placeholder="0.00" className="flex-1 px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] border-l-0 rounded-r-md" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-50 mb-1">备注（可选）</label>
            <input type="text" value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="如：Bybit合约账户" className="w-full px-3 py-2 bg-arena-base border border-[rgba(100,140,255,0.1)] rounded-md" />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button onClick={() => { isEdit ? setShowEditForm(false) : setShowAddForm(false); setFormError('') }}
            className="px-4 py-2 bg-arena-surface text-neutral-300 rounded-md hover:bg-arena-hover transition-colors">取消</button>
          <button onClick={isEdit ? handleUpdate : handleAdd} disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/80 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /><span>{loading ? '保存中...' : '保存'}</span>
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">资产管理</span>
              </h1>
              <p className="text-sm text-neutral-400">管理您的投资组合资产</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadData} disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-arena-surface text-neutral-300 hover:bg-arena-hover disabled:opacity-50 text-sm font-medium">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} /><span>刷新</span>
              </button>
              <button onClick={() => { setForm({ ...emptyForm }); setFormError(''); setShowAddForm(true) }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/80 text-sm font-medium">
                <Plus className="w-4 h-4" strokeWidth={1.75} /><span>添加资产</span>
              </button>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>
      <section className="relative max-w-[1400px] mx-auto px-6 pb-6 space-y-5">

      {/* 过滤器 */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" strokeWidth={1.75} />
          <input type="text" placeholder="搜索资产名称或代码..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-arena-surface border border-[rgba(100,140,255,0.1)] focus:ring-2 focus:ring-primary/50 focus:border-primary/50 text-sm" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-xl bg-arena-surface border border-[rgba(100,140,255,0.1)] text-sm font-medium">
          <option value="all">全部类别</option>
          <option value="crypto">加密货币</option>
          <option value="stock">股票基金</option>
          <option value="gold">黄金</option>
          <option value="bond">固定收益</option>
          <option value="commodity">大宗商品</option>
          <option value="reit">不动产/REITs</option>
          <option value="cash">现金</option>
        </select>
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/20 rounded-lg p-4">
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* 合并资产列表 */}
      <div className="glass rounded-xl border border-[rgba(100,140,255,0.1)] overflow-hidden">
        {loading && !mergedAssets.length ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-neutral-400">加载中...</p>
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-neutral-400">{mergedAssets.length === 0 ? '暂无资产，点击"添加资产"开始' : '没有匹配的资产'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-[rgba(100,140,255,0.1)]">
                <tr>
                  <th className="px-4 py-3 text-sm text-left w-8"></th>
                  <th className="px-4 py-3 text-sm text-left">资产</th>
                  <th className="px-4 py-3 text-sm text-left">类别</th>
                  <th className="px-4 py-3 text-sm text-right">总数量</th>
                  <th className="px-4 py-3 text-sm text-right">均价</th>
                  <th className="px-4 py-3 text-sm text-right">现价</th>
                  <th className="px-4 py-3 text-sm text-right">市值</th>
                  <th className="px-4 py-3 text-sm text-right">盈亏</th>
                  <th className="px-4 py-3 text-sm text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((ma) => {
                  const isExpanded = expandedSymbols.has(ma.symbol)
                  const hasMultiple = ma.entries.length > 1

                  return (
                    <>
                      {/* 合并行 */}
                      <tr key={ma.symbol} className="border-b border-[rgba(100,140,255,0.05)] hover:bg-arena-hover/50 transition-colors">
                        <td className="px-4 py-3 text-sm">
                          {hasMultiple && (
                            <button onClick={() => toggleExpand(ma.symbol)} className="p-0.5 hover:bg-arena-hover rounded">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-neutral-400" />
                                : <ChevronRight className="w-4 h-4 text-neutral-400" />}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div>
                            <div className="font-medium text-neutral-50">{ma.name}</div>
                            <div className="text-sm text-neutral-400">{ma.symbol} {hasMultiple && <span className="text-xs bg-arena-surface px-1.5 py-0.5 rounded">{ma.entries.length}笔</span>}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getCategoryColor(ma.category) }} />
                            <span className="text-sm">{getCategoryName(ma.category)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-data tabular-nums">{ma.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                        <td className="px-4 py-3 text-sm text-right font-data tabular-nums">
                          <span className="text-xs text-neutral-400">{ma.costCurrency === 'CNY' ? '¥' : '$'}</span>
                          {ma.avgCostPrice.toFixed(4)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-data tabular-nums">
                          {ma.currentPrice > 0 ? (
                            <>{ma.currentPrice.toFixed(4)}</>
                          ) : <span className="text-neutral-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-data tabular-nums font-medium">
                          {ma.priceCurrency === 'CNY' && ma.totalValueCny != null ? (
                            <div>
                              <div>¥{ma.totalValueCny.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                              <div className="text-xs text-neutral-400">≈{formatCurrency(ma.totalValueUsd, 'USD')}</div>
                            </div>
                          ) : (
                            formatCurrency(ma.totalValueUsd, 'USD')
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-data tabular-nums ${getProfitColorClass(ma.profit)}`}>
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
                        <td className="px-4 py-3 text-sm text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button onClick={() => handleCopy(ma.entries[0])} className="p-1 hover:bg-primary/10 rounded" title="复制添加">
                              <Copy className="w-4 h-4 text-primary" />
                            </button>
                            {!hasMultiple && ma.entries[0] && (
                              <>
                                <button onClick={() => handleEdit(ma.entries[0])} className="p-1 hover:bg-arena-hover rounded" title="编辑">
                                  <Edit2 className="w-4 h-4 text-neutral-400 hover:text-neutral-200" />
                                </button>
                                <button onClick={() => handleDelete(ma.entries[0].id)} className="p-1 hover:bg-danger/10 rounded" title="删除">
                                  <Trash2 className="w-4 h-4 text-danger" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* 展开的明细行 */}
                      {isExpanded && hasMultiple && ma.entries.map((entry, idx) => (
                        <tr key={`${ma.symbol}-${entry.id}`} className="bg-arena-surface/30 border-l-2 border-primary/30">
                          <td className="px-4 py-3 text-sm"></td>
                          <td className="px-4 py-3 text-sm pl-8">
                            <div className="text-sm text-neutral-400">
                              第{idx + 1}笔 {entry.notes && <span className="text-xs">· {entry.notes}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm"></td>
                          <td className="px-4 py-3 text-sm text-right font-data tabular-nums text-sm">{entry.quantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td className="px-4 py-3 text-sm text-right font-data tabular-nums text-sm">
                            <span className="text-xs text-neutral-400">{entry.costCurrency === 'CNY' ? '¥' : '$'}</span>
                            {entry.costPrice.toFixed(4)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-data tabular-nums text-sm">{entry.currentPrice.toFixed(4)}</td>
                          <td className="px-4 py-3 text-sm text-right font-data tabular-nums text-sm">{formatCurrency(entry.currentValue, 'USD')}</td>
                          <td className={`px-4 py-3 text-sm text-right font-data tabular-nums text-sm ${getProfitColorClass(entry.profit)}`}>
                            {formatCurrency(entry.profit, 'USD', true)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="flex items-center justify-center space-x-1">
                              <button onClick={() => handleCopy(entry)} className="p-1 hover:bg-primary/10 rounded" title="复制添加">
                                <Copy className="w-3.5 h-3.5 text-primary" />
                              </button>
                              <button onClick={() => handleEdit(entry)} className="p-1 hover:bg-arena-hover rounded" title="编辑">
                                <Edit2 className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-200" />
                              </button>
                              <button onClick={() => handleDelete(entry.id)} className="p-1 hover:bg-danger/10 rounded" title="删除">
                                <Trash2 className="w-3.5 h-3.5 text-danger" />
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
        <div className="flex items-center justify-between text-sm text-neutral-400 px-2">
          <span>共 {filteredAssets.length} 项资产（{filteredAssets.reduce((s, a) => s + a.entries.length, 0)} 笔持仓）</span>
          <span>总市值: {formatCurrency(filteredAssets.reduce((s, a) => s + a.totalValueUsd, 0), 'USD')}</span>
        </div>
      )}

      {showAddForm && renderForm(false)}
      {showEditForm && renderForm(true)}
      </section>
    </>
  )
}
