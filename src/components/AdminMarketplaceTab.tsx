'use client'

import { useState, useEffect, useTransition } from 'react'
import { ShoppingBag, Plus, Pencil, Check, X, Package, Clock, ChevronDown } from 'lucide-react'
import type { MarketplaceItem, MarketplaceRedemption } from '@/lib/types'
import {
  getMarketplaceItems,
  createMarketplaceItem,
  updateMarketplaceItem,
  getAllRedemptions,
  resolveRedemption,
} from '@/app/actions/marketplace'

function fmt(n: number) { return n.toLocaleString() }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORIES = ['Gift Card', 'Merchandise', 'Experience', 'Day Off', 'Voucher', 'Other']

// ─── Item Form ────────────────────────────────────────────────────────────────
function ItemForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial?: Partial<MarketplaceItem>
  onSave: (data: any) => void
  onCancel: () => void
  saving: boolean
  error: string | null
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [tokenPrice, setTokenPrice] = useState(String(initial?.token_price ?? ''))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseInt(tokenPrice)
    if (!name.trim() || isNaN(price) || price <= 0) return
    onSave({
      name,
      description: description || undefined,
      category: category || undefined,
      token_price: price,
      quantity_limit: null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">Item Name <span className="text-red-500">*</span></label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Amazon Gift Card $25"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Brief description of the reward…"
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-600 mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          >
            <option value="">No category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-bold text-gray-600 mb-1">Token Price <span className="text-red-500">*</span></label>
          <input
            type="number"
            min={1}
            value={tokenPrice}
            onChange={e => setTokenPrice(e.target.value)}
            placeholder="e.g. 500"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors"
            required
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
          {saving ? 'Saving…' : initial?.id ? 'Update Item' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
      <Check size={9} /> Approved
    </span>
  )
  if (status === 'rejected') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700">
      <X size={9} /> Rejected
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
      <Clock size={9} /> Pending
    </span>
  )
}

// ─── Redemption row ───────────────────────────────────────────────────────────
function RedemptionRow({
  r,
  onResolve,
}: {
  r: MarketplaceRedemption
  onResolve: (id: string, status: 'approved' | 'rejected', reason?: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  const isPending = r.status === 'pending'

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      r.status === 'approved' ? 'border-emerald-200 bg-emerald-50/40' :
      r.status === 'rejected' ? 'border-red-100 bg-red-50/30' :
      'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Package size={14} className="text-indigo-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{r.item?.name ?? '—'}</p>
          <p className="text-[11px] text-gray-400">
            <span className="font-semibold text-gray-600">{r.employee?.full_name ?? '—'}</span>
            {' · '}{fmt(r.tokens_spent)} tokens · {fmtDate(r.requested_at)}
          </p>
        </div>
        <StatusBadge status={r.status} />
        {isPending && (
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors ml-2"
          >
            Respond <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Rejected reason (read-only) */}
      {r.status === 'rejected' && r.admin_reason && (
        <div className="px-4 pb-3">
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
            <span className="font-bold">Reason: </span>{r.admin_reason}
          </p>
        </div>
      )}

      {/* Expand panel for pending */}
      {isPending && open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">
              Rejection reason <span className="font-normal text-gray-400">(required if rejecting, max 500 chars)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Explain why this request is rejected…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
            />
            <p className="text-[10px] text-gray-400 text-right mt-0.5">{reason.length}/500</p>
          </div>
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => startTransition(async () => {
                await onResolve(r.id, 'approved')
                setOpen(false)
              })}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <Check size={13} /> Approve
            </button>
            <button
              disabled={pending || !reason.trim()}
              onClick={() => startTransition(async () => {
                await onResolve(r.id, 'rejected', reason)
                setOpen(false)
              })}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
            >
              <X size={13} /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type SubTab = 'items' | 'requests'

export default function AdminMarketplaceTab({ orgId }: { orgId: string }) {
  const [subTab, setSubTab] = useState<SubTab>('items')
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [redemptions, setRedemptions] = useState<MarketplaceRedemption[]>([])
  const [loading, setLoading] = useState(true)

  // Item form state
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<MarketplaceItem | null>(null)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Requests filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')

  async function loadData() {
    setLoading(true)
    const [itemsData, redemptionsData] = await Promise.all([
      getMarketplaceItems(orgId),
      getAllRedemptions(orgId),
    ])
    setItems(itemsData)
    setRedemptions(redemptionsData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orgId])

  async function handleSaveItem(data: any) {
    setFormSaving(true)
    setFormError(null)
    let result
    if (editItem) {
      result = await updateMarketplaceItem(editItem.id, {
        name: data.name,
        description: data.description,
        category: data.category,
        token_price: data.token_price,
        quantity_limit: data.quantity_limit,
      })
    } else {
      result = await createMarketplaceItem({ orgId, ...data })
    }
    setFormSaving(false)
    if (result?.error) { setFormError(result.error); return }
    setShowForm(false)
    setEditItem(null)
    loadData()
  }

  async function handleToggleActive(item: MarketplaceItem) {
    await updateMarketplaceItem(item.id, { is_active: !item.is_active })
    loadData()
  }

  async function handleResolve(id: string, status: 'approved' | 'rejected', reason?: string) {
    await resolveRedemption(id, status, reason)
    loadData()
  }

  const pendingCount = redemptions.filter(r => r.status === 'pending').length
  const filteredRedemptions = statusFilter === 'all'
    ? redemptions
    : redemptions.filter(r => r.status === statusFilter)

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading marketplace…</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50 p-5">
      <div className="max-w-3xl mx-auto space-y-5">

        {/* Sub-tab toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setSubTab('items')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                subTab === 'items' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <ShoppingBag size={13} /> Manage Items
            </button>
            <button
              onClick={() => setSubTab('requests')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                subTab === 'requests' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Package size={13} /> Redemption Requests
              {pendingCount > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  subTab === 'requests' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Manage Items ── */}
        {subTab === 'items' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </p>
              {!showForm && !editItem && (
                <button
                  onClick={() => { setShowForm(true); setFormError(null) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                >
                  <Plus size={12} /> Add Item
                </button>
              )}
            </div>

            {/* Add form */}
            {showForm && !editItem && (
              <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                <h3 className="text-sm font-extrabold text-gray-900 mb-4">New Marketplace Item</h3>
                <ItemForm
                  onSave={handleSaveItem}
                  onCancel={() => { setShowForm(false); setFormError(null) }}
                  saving={formSaving}
                  error={formError}
                />
              </div>
            )}

            {/* Item list */}
            {items.length === 0 && !showForm ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                  <ShoppingBag size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No marketplace items yet</p>
                <p className="text-xs text-gray-400 mt-1">Add items that employees can redeem with tokens.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id}>
                    {editItem?.id === item.id ? (
                      <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
                        <h3 className="text-sm font-extrabold text-gray-900 mb-4">Edit Item</h3>
                        <ItemForm
                          initial={item}
                          onSave={handleSaveItem}
                          onCancel={() => { setEditItem(null); setFormError(null) }}
                          saving={formSaving}
                          error={formError}
                        />
                      </div>
                    ) : (
                      <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                        item.is_active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                      }`}>
                        <div className="flex items-center gap-3 p-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <ShoppingBag size={17} className="text-indigo-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-gray-900">{item.name}</p>
                              {item.category && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                  {item.category}
                                </span>
                              )}
                              {!item.is_active && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                                  Inactive
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs font-black text-indigo-600">{fmt(item.token_price)} tokens</span>
                              {item.quantity_limit != null && (
                                <span className="text-[11px] text-gray-400">Stock: {item.quantity_limit}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                                item.is_active
                                  ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                  : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                              }`}
                            >
                              {item.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              onClick={() => { setEditItem(item); setFormError(null) }}
                              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                            >
                              <Pencil size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Redemption Requests ── */}
        {subTab === 'requests' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                    statusFilter === f
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  {f === 'pending' && pendingCount > 0 && (
                    <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      statusFilter === 'pending' ? 'bg-white/20' : 'bg-amber-100 text-amber-700'
                    }`}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>

            {filteredRedemptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
                  <Package size={24} className="text-gray-300" />
                </div>
                <p className="text-sm font-bold text-gray-500">No requests{statusFilter !== 'all' ? ` with status "${statusFilter}"` : ''}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRedemptions.map(r => (
                  <RedemptionRow key={r.id} r={r} onResolve={handleResolve} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
