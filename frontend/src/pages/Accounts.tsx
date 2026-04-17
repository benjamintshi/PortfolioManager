import { useEffect, useState, useCallback } from 'react'
import {
  Landmark, RefreshCw, Plus, Key, ArrowRightLeft,
  ChevronDown, ChevronRight, Trash2, Edit2, X, Save, Shield,
} from 'lucide-react'
import { platformsApi, holdingsApi, transfersApi, useApi } from '@/hooks/useApi'
import { formatCurrency, formatRelativeTime, getCategoryName } from '@/utils/format'

// ── Types ──

interface SubAccount {
  id: number
  name: string
  displayName: string
  accountType: string
}

interface Platform {
  id: number
  name: string
  displayName: string
  type: string
  icon: string | null
  hasApiKey: boolean
  apiKeyMasked: string | null
  syncEnabled: boolean
  lastSyncAt: number | null
  lastSyncStatus: string | null
  subAccounts: SubAccount[]
}

interface Holding {
  id: number
  sub_account_id: number
  symbol: string
  name: string
  category: string
  quantity: number
  cost_price: number
  cost_currency: string
  source: string
  platform_display_name: string
  sub_account_display_name: string
}

interface Transfer {
  id: number
  from_platform_display_name: string
  from_sub_account_display_name: string
  to_platform_display_name: string
  to_sub_account_display_name: string
  symbol: string
  quantity: number
  fee: number | null
  executed_at: number
}

type TabKey = 'platforms' | 'transfers' | 'sync-logs'

// ── Empty Forms ──

const emptyHoldingForm = {
  sub_account_id: 0,
  category: 'crypto',
  symbol: '',
  name: '',
  quantity: '',
  cost_price: '',
  cost_currency: 'USD',
}

const emptyTransferForm = {
  from_sub_account_id: 0,
  to_sub_account_id: 0,
  symbol: '',
  quantity: '',
  fee: '',
  executed_at: new Date().toISOString().slice(0, 16),
}

const emptyApiKeyForm = {
  apiKey: '',
  apiSecret: '',
}

const categories = [
  { value: 'crypto', label: '加密货币' },
  { value: 'stock', label: '股票基金' },
  { value: 'gold', label: '黄金' },
  { value: 'bond', label: '固定收益' },
  { value: 'commodity', label: '大宗商品' },
  { value: 'reit', label: '不动产/REITs' },
  { value: 'cash', label: '现金' },
]

// ── Helpers ──

function SyncStatusDot({ status }: { status: string | null }) {
  if (status === 'success') {
    return <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
  }
  if (status === 'failed') {
    return <span className="inline-block w-2 h-2 rounded-full bg-danger" />
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-neutral-500" />
}

function SyncBadge({ status }: { status: string | null }) {
  if (status === 'success') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-success/10 text-success border border-success/20">
        已同步
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-danger/10 text-danger border border-danger/20">
        同步失败
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
      未同步
    </span>
  )
}

// ── Main Component ──

export default function Accounts() {
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [tab, setTab] = useState<TabKey>('platforms')
  const [expandedPlatform, setExpandedPlatform] = useState<number | null>(null)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  // Modals
  const [showApiKeyModal, setShowApiKeyModal] = useState(false)
  const [apiKeyPlatformId, setApiKeyPlatformId] = useState<number | null>(null)
  const [apiKeyForm, setApiKeyForm] = useState(emptyApiKeyForm)

  const [showHoldingModal, setShowHoldingModal] = useState(false)
  const [holdingForm, setHoldingForm] = useState(emptyHoldingForm)
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null)

  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferForm, setTransferForm] = useState(emptyTransferForm)

  const [formError, setFormError] = useState('')

  const { loading, error, execute } = useApi()

  // ── Data Loading ──

  const loadPlatforms = useCallback(async () => {
    try {
      const data = await execute(() => platformsApi.getAll())
      if (data) setPlatforms(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载平台失败:', err)
    }
  }, [execute])

  const loadHoldings = useCallback(async () => {
    try {
      const data = await execute(() => holdingsApi.getAll())
      if (data) setHoldings(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载持仓失败:', err)
    }
  }, [execute])

  const loadTransfers = useCallback(async () => {
    try {
      const data = await execute(() => transfersApi.getAll())
      if (data) setTransfers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('加载转账失败:', err)
    }
  }, [execute])

  useEffect(() => {
    loadPlatforms()
    loadHoldings()
    loadTransfers()
  }, [])

  // ── Stats ──

  const totalPlatforms = platforms.length
  const syncedPlatforms = platforms.filter(p => p.lastSyncStatus === 'success').length
  const lastSyncTime = platforms
    .filter(p => p.lastSyncAt)
    .sort((a, b) => (b.lastSyncAt ?? 0) - (a.lastSyncAt ?? 0))[0]?.lastSyncAt ?? null

  // ── All sub-accounts flattened (for transfer dropdowns) ──

  const allSubAccounts = platforms.flatMap(p =>
    p.subAccounts.map(sa => ({
      ...sa,
      platformName: p.displayName,
      platformId: p.id,
    }))
  )

  // ── Handlers ──

  const handleSync = async (platformId: number) => {
    setSyncingId(platformId)
    try {
      await execute(() => platformsApi.sync(platformId))
      await loadPlatforms()
      await loadHoldings()
    } catch (err) {
      console.error('同步失败:', err)
    } finally {
      setSyncingId(null)
    }
  }

  const openApiKeyModal = (platformId: number) => {
    setApiKeyPlatformId(platformId)
    setApiKeyForm(emptyApiKeyForm)
    setFormError('')
    setShowApiKeyModal(true)
  }

  const handleSaveApiKey = async () => {
    setFormError('')
    if (!apiKeyForm.apiKey.trim()) { setFormError('请输入 API Key'); return }
    if (!apiKeyForm.apiSecret.trim()) { setFormError('请输入 API Secret'); return }
    if (apiKeyPlatformId === null) return

    try {
      await execute(() => platformsApi.setApiKey(apiKeyPlatformId, {
        apiKey: apiKeyForm.apiKey.trim(),
        apiSecret: apiKeyForm.apiSecret.trim(),
      }))
      setShowApiKeyModal(false)
      await loadPlatforms()
    } catch (err) {
      setFormError('保存失败')
    }
  }

  const openHoldingModal = (subAccountId: number) => {
    setEditingHoldingId(null)
    setHoldingForm({ ...emptyHoldingForm, sub_account_id: subAccountId })
    setFormError('')
    setShowHoldingModal(true)
  }

  const openEditHoldingModal = (h: Holding) => {
    setEditingHoldingId(h.id)
    setHoldingForm({
      sub_account_id: h.sub_account_id,
      category: h.category,
      symbol: h.symbol,
      name: h.name,
      quantity: String(h.quantity),
      cost_price: String(h.cost_price),
      cost_currency: h.cost_currency,
    })
    setFormError('')
    setShowHoldingModal(true)
  }

  const handleSaveHolding = async () => {
    setFormError('')
    const qty = parseFloat(holdingForm.quantity)
    const price = parseFloat(holdingForm.cost_price)

    if (editingHoldingId) {
      // 编辑模式
      try {
        await execute(() => holdingsApi.update(editingHoldingId, {
          name: holdingForm.name.trim(),
          quantity: isNaN(qty) ? undefined : qty,
          cost_price: isNaN(price) ? undefined : price,
          cost_currency: holdingForm.cost_currency,
        }))
        setShowHoldingModal(false)
        setEditingHoldingId(null)
        await loadHoldings()
      } catch (err) {
        setFormError('更新失败')
      }
    } else {
      // 添加模式
      if (!holdingForm.symbol.trim()) { setFormError('请输入资产代码'); return }
      if (!holdingForm.name.trim()) { setFormError('请输入资产名称'); return }
      if (isNaN(qty) || qty <= 0) { setFormError('请输入有效数量'); return }
      if (isNaN(price) || price < 0) { setFormError('请输入有效成本价'); return }

      try {
        await execute(() => holdingsApi.create({
          sub_account_id: holdingForm.sub_account_id,
          category: holdingForm.category,
          symbol: holdingForm.symbol.trim().toUpperCase(),
          name: holdingForm.name.trim(),
          quantity: qty,
          cost_price: price,
          cost_currency: holdingForm.cost_currency,
        }))
        setShowHoldingModal(false)
        await loadHoldings()
      } catch (err) {
        setFormError('添加失败')
      }
    }
  }

  const handleDeleteHolding = async (id: number) => {
    if (!confirm('确定要删除此持仓？')) return
    try {
      await execute(() => holdingsApi.delete(id))
      await loadHoldings()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  const openTransferModal = () => {
    setTransferForm({
      ...emptyTransferForm,
      executed_at: new Date().toISOString().slice(0, 16),
    })
    setFormError('')
    setShowTransferModal(true)
  }

  const handleAddTransfer = async () => {
    setFormError('')
    if (!transferForm.from_sub_account_id) { setFormError('请选择转出账户'); return }
    if (!transferForm.to_sub_account_id) { setFormError('请选择转入账户'); return }
    if (transferForm.from_sub_account_id === transferForm.to_sub_account_id) {
      setFormError('转出和转入账户不能相同'); return
    }
    if (!transferForm.symbol.trim()) { setFormError('请输入资产代码'); return }
    const qty = parseFloat(transferForm.quantity)
    if (isNaN(qty) || qty <= 0) { setFormError('请输入有效数量'); return }

    const fee = transferForm.fee ? parseFloat(transferForm.fee) : undefined

    try {
      await execute(() => transfersApi.create({
        from_sub_account_id: transferForm.from_sub_account_id,
        to_sub_account_id: transferForm.to_sub_account_id,
        symbol: transferForm.symbol.trim().toUpperCase(),
        quantity: qty,
        fee: fee,
        executed_at: new Date(transferForm.executed_at).getTime(),
      }))
      setShowTransferModal(false)
      await loadTransfers()
    } catch (err) {
      setFormError('记录失败')
    }
  }

  const handleDeleteTransfer = async (id: number) => {
    if (!confirm('确定要删除此转账记录？')) return
    try {
      await execute(() => transfersApi.delete(id))
      await loadTransfers()
    } catch (err) {
      console.error('删除失败:', err)
    }
  }

  // ── Holdings grouped by platform → sub-account ──

  const getHoldingsForSubAccount = (subAccountId: number) =>
    holdings.filter(h => {
      // Match by sub_account_display_name since holdings don't have sub_account_id directly
      // We need to match platform + sub_account combination
      const sa = allSubAccounts.find(s => s.id === subAccountId)
      if (!sa) return false
      return h.platform_display_name === sa.platformName &&
             h.sub_account_display_name === sa.displayName
    })

  // ── Tabs Config ──

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'platforms', label: '全部平台' },
    { key: 'transfers', label: '转账记录' },
    { key: 'sync-logs', label: '同步日志' },
  ]

  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-16">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--arena-bg-void)] via-[#0d1117] to-[var(--arena-bg-base)] h-[320px]" />
        <div className="relative max-w-[1400px] mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Landmark className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-extrabold tracking-tight">
                <span className="text-gradient-primary">账户管理</span>
              </h1>
              <p className="text-sm text-neutral-400">多平台资产归属 · API 自动同步 · 转账追踪</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openTransferModal}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <ArrowRightLeft className="w-4 h-4" /> 记录转账
              </button>
              <button
                onClick={() => {/* placeholder: add platform */}}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Plus className="w-4 h-4" /> 添加平台
              </button>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </section>

      {/* Stat Cards */}
      <section className="relative max-w-[1400px] mx-auto px-6 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="stat-card">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">平台总数</p>
            <p className="text-2xl font-bold text-gradient-primary font-data tabular-nums">{totalPlatforms}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">总持仓数</p>
            <p className="text-2xl font-bold text-gradient-primary font-data tabular-nums">{holdings.length}</p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">已同步</p>
            <p className="text-2xl font-bold text-gradient-primary font-data tabular-nums">
              {syncedPlatforms}/{totalPlatforms}
            </p>
          </div>
          <div className="stat-card">
            <p className="text-xs text-neutral-400 uppercase tracking-wider mb-1">最后同步</p>
            <p className="text-sm font-semibold text-neutral-200 font-data tabular-nums">
              {lastSyncTime ? formatRelativeTime(lastSyncTime) : '—'}
            </p>
          </div>
        </div>
      </section>

      {/* Tabs + Content */}
      <section className="relative max-w-[1400px] mx-auto px-6 pb-12 space-y-4">
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
        {loading && platforms.length === 0 && (
          <div className="text-center py-12 text-neutral-400">加载中...</div>
        )}

        {/* ── Platforms Tab ── */}
        {tab === 'platforms' && (
          <div className="space-y-4">
            {platforms.length === 0 && !loading && (
              <div className="text-center py-12 text-neutral-400">暂无平台，点击右上角添加</div>
            )}
            {platforms.map(platform => {
              const isExpanded = expandedPlatform === platform.id
              const isSyncing = syncingId === platform.id
              const isExchange = platform.type === 'exchange'
              const platformHoldings = holdings.filter(
                h => h.platform_display_name === platform.displayName
              )
              const holdingCount = platformHoldings.length

              return (
                <div
                  key={platform.id}
                  className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] animate-fade-in-up"
                >
                  {/* Platform Header */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none"
                    onClick={() => setExpandedPlatform(isExpanded ? null : platform.id)}
                  >
                    <span className="text-xl">{platform.icon || '🏦'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-100">{platform.displayName}</span>
                        <SyncBadge status={platform.lastSyncStatus} />
                        <span className="text-xs text-neutral-500 font-data tabular-nums">
                          {holdingCount} 持仓
                        </span>
                      </div>
                      {platform.lastSyncAt && (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          上次同步: {formatRelativeTime(platform.lastSyncAt)}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isExchange && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); openApiKeyModal(platform.id) }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-primary hover:bg-primary/5 transition-all"
                            title="配置 API Key"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleSync(platform.id) }}
                            disabled={isSyncing}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-success hover:bg-success/5 transition-all disabled:opacity-50"
                            title="同步"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          </button>
                        </>
                      )}
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-neutral-400" />
                        : <ChevronRight className="w-4 h-4 text-neutral-400" />
                      }
                    </div>
                  </div>

                  {/* Expanded: Sub-accounts + Holdings */}
                  {isExpanded && (
                    <div className="border-t border-[rgba(100,140,255,0.08)] px-5 py-4 space-y-4">
                      {platform.subAccounts.length === 0 && (
                        <p className="text-sm text-neutral-500">暂无子账户</p>
                      )}
                      {platform.subAccounts.map(sa => {
                        const saHoldings = getHoldingsForSubAccount(sa.id)
                        return (
                          <div key={sa.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-neutral-200">{sa.displayName}</span>
                                <span className="px-2 py-0.5 rounded-full text-xs bg-neutral-500/10 text-neutral-400 border border-neutral-500/20">
                                  {sa.accountType === 'spot' ? '现货' :
                                   sa.accountType === 'futures' ? '合约' :
                                   sa.accountType === 'savings' ? '储蓄' :
                                   sa.accountType === 'earn' ? '理财' :
                                   sa.accountType}
                                </span>
                                <span className="text-xs text-neutral-500 font-data tabular-nums">
                                  {saHoldings.length} 项
                                </span>
                              </div>
                              {!isExchange && (
                                <button
                                  onClick={() => openHoldingModal(sa.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-400 hover:text-primary hover:bg-primary/5 transition-all"
                                >
                                  <Plus className="w-3 h-3" /> 添加持仓
                                </button>
                              )}
                            </div>

                            {saHoldings.length > 0 ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                  <thead>
                                    <tr className="border-b border-[rgba(100,140,255,0.06)]">
                                      <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 pr-4">资产</th>
                                      <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 pr-4">类别</th>
                                      <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 pr-4 text-right">数量</th>
                                      <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 pr-4 text-right">成本价</th>
                                      <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 pr-4 text-right">来源</th>
                                      {!isExchange && (
                                        <th className="text-xs font-semibold text-neutral-400 uppercase pb-2 text-right">操作</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {saHoldings.map(h => (
                                      <tr key={h.id} className="border-b border-[rgba(100,140,255,0.04)] last:border-0">
                                        <td className="py-2 pr-4">
                                          <div>
                                            <span className="text-sm text-neutral-200 font-semibold">{h.symbol}</span>
                                            <span className="text-xs text-neutral-500 ml-2">{h.name}</span>
                                          </div>
                                        </td>
                                        <td className="text-sm text-neutral-300 py-2 pr-4">
                                          {getCategoryName(h.category)}
                                        </td>
                                        <td className="text-sm text-neutral-200 font-data tabular-nums py-2 pr-4 text-right">
                                          {h.quantity}
                                        </td>
                                        <td className="text-sm text-neutral-200 font-data tabular-nums py-2 pr-4 text-right">
                                          {formatCurrency(h.cost_price, h.cost_currency === 'CNY' ? 'CNY' : 'USD')}
                                        </td>
                                        <td className="text-xs text-neutral-500 py-2 pr-4 text-right">
                                          {h.source === 'api_sync' ? 'API' : '手动'}
                                        </td>
                                        <td className="py-2 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => openEditHoldingModal(h)}
                                              className="p-1 rounded text-neutral-500 hover:text-primary hover:bg-primary/10 transition-all"
                                              title="编辑"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            {h.source !== 'api_sync' && (
                                              <button
                                                onClick={() => handleDeleteHolding(h.id)}
                                                className="p-1 rounded text-neutral-500 hover:text-danger hover:bg-danger/10 transition-all"
                                                title="删除"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-neutral-500 pl-2">暂无持仓</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Transfers Tab ── */}
        {tab === 'transfers' && (
          <div className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)]">
            {transfers.length === 0 ? (
              <div className="text-center py-12 text-neutral-400">暂无转账记录</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[rgba(100,140,255,0.08)]">
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3">时间</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3">转出</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3">转入</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3">资产</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3 text-right">数量</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3 text-right">手续费</th>
                      <th className="text-xs font-semibold text-neutral-400 uppercase px-5 py-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map(t => (
                      <tr key={t.id} className="border-b border-[rgba(100,140,255,0.04)] last:border-0 hover:bg-[rgba(100,140,255,0.03)] transition-colors">
                        <td className="text-sm text-neutral-300 font-data tabular-nums px-5 py-3">
                          {formatRelativeTime(t.executed_at)}
                        </td>
                        <td className="text-sm text-neutral-200 px-5 py-3">
                          <span>{t.from_platform_display_name}</span>
                          <span className="text-xs text-neutral-500 ml-1">/ {t.from_sub_account_display_name}</span>
                        </td>
                        <td className="text-sm text-neutral-200 px-5 py-3">
                          <span>{t.to_platform_display_name}</span>
                          <span className="text-xs text-neutral-500 ml-1">/ {t.to_sub_account_display_name}</span>
                        </td>
                        <td className="text-sm text-neutral-200 font-semibold px-5 py-3">{t.symbol}</td>
                        <td className="text-sm text-neutral-200 font-data tabular-nums px-5 py-3 text-right">{t.quantity}</td>
                        <td className="text-sm text-neutral-300 font-data tabular-nums px-5 py-3 text-right">
                          {t.fee != null ? t.fee : '—'}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => handleDeleteTransfer(t.id)}
                            className="p-1 rounded text-neutral-500 hover:text-danger hover:bg-danger/10 transition-all"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Sync Logs Tab ── */}
        {tab === 'sync-logs' && (
          <div className="glass scan-line rounded-lg border border-[rgba(100,140,255,0.1)] p-6">
            <div className="text-center py-8 text-neutral-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 text-neutral-500" />
              <p className="text-sm">同步日志功能开发中</p>
              <p className="text-xs text-neutral-500 mt-1">可在各平台卡片中查看同步状态</p>
            </div>
          </div>
        )}
      </section>

      {/* ── API Key Modal ── */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <button
              onClick={() => setShowApiKeyModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-5">
              <Key className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-neutral-100">配置 API Key</h3>
            </div>

            {/* Security warning */}
            <div className="flex items-start gap-2 mb-5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Shield className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300">
                API Key 将加密存储在服务器端。请确保只授予只读权限，不要开启提现/交易权限。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={apiKeyForm.apiKey}
                  onChange={e => setApiKeyForm(f => ({ ...f, apiKey: e.target.value }))}
                  placeholder="输入 API Key"
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">API Secret</label>
                <input
                  type="password"
                  value={apiKeyForm.apiSecret}
                  onChange={e => setApiKeyForm(f => ({ ...f, apiSecret: e.target.value }))}
                  placeholder="输入 API Secret"
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>

            {formError && (
              <p className="text-xs text-danger mt-3">{formError}</p>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveApiKey}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Holding Modal ── */}
      {showHoldingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <button
              onClick={() => setShowHoldingModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-5">
              <Plus className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-neutral-100">{editingHoldingId ? '编辑持仓' : '添加持仓'}</h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">资产代码</label>
                  <input
                    value={holdingForm.symbol}
                    onChange={e => setHoldingForm(f => ({ ...f, symbol: e.target.value }))}
                    placeholder="如 BTC, AAPL"
                    disabled={!!editingHoldingId}
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">资产名称</label>
                  <input
                    value={holdingForm.name}
                    onChange={e => setHoldingForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="如 比特币"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">类别</label>
                <select
                  value={holdingForm.category}
                  onChange={e => setHoldingForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] focus:outline-none focus:border-primary/40"
                >
                  {categories.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">数量</label>
                  <input
                    type="number"
                    value={holdingForm.quantity}
                    onChange={e => setHoldingForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">成本价</label>
                  <input
                    type="number"
                    value={holdingForm.cost_price}
                    onChange={e => setHoldingForm(f => ({ ...f, cost_price: e.target.value }))}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">成本货币</label>
                <select
                  value={holdingForm.cost_currency}
                  onChange={e => setHoldingForm(f => ({ ...f, cost_currency: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] focus:outline-none focus:border-primary/40"
                >
                  <option value="USD">USD</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-danger mt-3">{formError}</p>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowHoldingModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveHolding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Save className="w-4 h-4" /> {editingHoldingId ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Modal ── */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative glass-strong rounded-xl p-6 max-w-lg w-full mx-4 border border-[rgba(100,140,255,0.15)] shadow-glow-md">
            <button
              onClick={() => setShowTransferModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-5">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-neutral-100">记录转账</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">转出账户</label>
                <select
                  value={transferForm.from_sub_account_id}
                  onChange={e => setTransferForm(f => ({ ...f, from_sub_account_id: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] focus:outline-none focus:border-primary/40"
                >
                  <option value={0}>选择转出账户</option>
                  {allSubAccounts.map(sa => (
                    <option key={sa.id} value={sa.id}>{sa.platformName} / {sa.displayName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-neutral-400 mb-1.5">转入账户</label>
                <select
                  value={transferForm.to_sub_account_id}
                  onChange={e => setTransferForm(f => ({ ...f, to_sub_account_id: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] focus:outline-none focus:border-primary/40"
                >
                  <option value={0}>选择转入账户</option>
                  {allSubAccounts.map(sa => (
                    <option key={sa.id} value={sa.id}>{sa.platformName} / {sa.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">资产代码</label>
                  <input
                    value={transferForm.symbol}
                    onChange={e => setTransferForm(f => ({ ...f, symbol: e.target.value }))}
                    placeholder="如 BTC, USDT"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">数量</label>
                  <input
                    type="number"
                    value={transferForm.quantity}
                    onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">手续费</label>
                  <input
                    type="number"
                    value={transferForm.fee}
                    onChange={e => setTransferForm(f => ({ ...f, fee: e.target.value }))}
                    placeholder="可选"
                    step="any"
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] placeholder:text-neutral-500 focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">执行时间</label>
                  <input
                    type="datetime-local"
                    value={transferForm.executed_at}
                    onChange={e => setTransferForm(f => ({ ...f, executed_at: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-arena-surface text-neutral-200 border border-[rgba(100,140,255,0.1)] focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>
            </div>

            {formError && (
              <p className="text-xs text-danger mt-3">{formError}</p>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-xl text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddTransfer}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm text-neutral-300 bg-arena-surface border border-[rgba(100,140,255,0.1)] hover:border-primary/40 hover:text-primary transition-all"
              >
                <Save className="w-4 h-4" /> 记录
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
