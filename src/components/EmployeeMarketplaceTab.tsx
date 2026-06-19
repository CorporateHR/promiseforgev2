'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import { ShoppingBag, Package, Coins, Check, X, Clock, AlertCircle } from 'lucide-react'
import type { MarketplaceItem, MarketplaceRedemption } from '@/lib/types'
import { getActiveMarketplaceItems, redeemItem, getMyRedemptions } from '@/app/actions/marketplace'

function fmt(n: number) { return n.toLocaleString() }
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

// ─── Item card ────────────────────────────────────────────────────────────────
function ItemCard({
  item,
  availableBalance,
  hasPending,
  onRedeem,
}: {
  item: MarketplaceItem
  availableBalance: number
  hasPending: boolean
  onRedeem: (item: MarketplaceItem) => void
}) {
  const affordable = availableBalance >= item.token_price
  const disabled = !affordable || hasPending

  let btnLabel = 'Redeem'
  let disabledReason = ''
  if (hasPending) { btnLabel = 'Requested'; disabledReason = 'You already have a pending request for this item.' }
  else if (!affordable) { btnLabel = `Need ${fmt(item.token_price - availableBalance)} more`; disabledReason = 'Insufficient token balance.' }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
      hasPending ? 'border-amber-200' : affordable ? 'border-gray-100 hover:border-indigo-200 hover:shadow-md' : 'border-gray-100 opacity-70'
    }`}>
      {/* Color strip */}
      <div className={`h-1.5 w-full ${hasPending ? 'bg-amber-400' : affordable ? 'bg-indigo-400' : 'bg-gray-200'}`} />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasPending ? 'bg-amber-50' : affordable ? 'bg-indigo-50' : 'bg-gray-50'
          }`}>
            <ShoppingBag size={17} className={hasPending ? 'text-amber-500' : affordable ? 'text-indigo-500' : 'text-gray-300'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900">{item.name}</p>
              {item.category && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                  {item.category}
                </span>
              )}
              {hasPending && <StatusBadge status="pending" />}
            </div>
            {item.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Coins size={13} className="text-indigo-500" />
            <span className="text-sm font-black text-indigo-600 tabular-nums">{fmt(item.token_price)}</span>
            <span className="text-xs text-gray-400">tokens</span>
            {item.quantity_limit != null && (
              <span className="ml-2 text-[10px] text-gray-400 border border-gray-200 rounded-full px-1.5 py-0.5">
                limited stock
              </span>
            )}
          </div>
          <div className="relative group">
            <button
              disabled={disabled}
              onClick={() => !disabled && onRedeem(item)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                hasPending
                  ? 'bg-amber-50 border border-amber-200 text-amber-700 cursor-default'
                  : affordable
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {btnLabel}
            </button>
            {disabledReason && !hasPending && (
              <div className="absolute bottom-full right-0 mb-1.5 w-48 bg-gray-800 text-white text-[10px] rounded-lg px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed">
                {disabledReason}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function RedeemModal({
  item,
  availableBalance,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  item: MarketplaceItem
  availableBalance: number
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  const after = availableBalance - item.token_price
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden">
        <div className="h-1.5 w-full bg-indigo-500" />
        <div className="px-6 py-5 space-y-4">
          <div>
            <h3 className="font-extrabold text-gray-900 text-base">Confirm Redemption</h3>
            <p className="text-xs text-gray-400 mt-0.5">This will lock tokens immediately and send a request to your admin.</p>
          </div>

          {/* Item preview */}
          <div className="flex items-center gap-3 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
            <div className="w-9 h-9 rounded-lg bg-white border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={15} className="text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
              {item.category && <p className="text-[11px] text-gray-400">{item.category}</p>}
            </div>
            <span className="text-sm font-black text-indigo-600 tabular-nums">{fmt(item.token_price)} tokens</span>
          </div>

          {/* Balance change */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1 border border-gray-100">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Current balance</span>
              <span className="font-bold text-gray-700">{fmt(availableBalance)} tokens</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Cost</span>
              <span className="font-bold text-red-500">−{fmt(item.token_price)} tokens</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
              <span className="font-bold text-gray-700">After redemption</span>
              <span className={`font-black tabular-nums ${after < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(after)} tokens
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
            {loading ? 'Requesting…' : 'Confirm Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type SubTab = 'browse' | 'requests'

export default function EmployeeMarketplaceTab({
  employeeId,
  orgId,
  earnedTokens,
}: {
  employeeId: string
  orgId: string
  earnedTokens: number
}) {
  const [subTab, setSubTab] = useState<SubTab>('browse')
  const [items, setItems] = useState<MarketplaceItem[]>([])
  const [redemptions, setRedemptions] = useState<MarketplaceRedemption[]>([])
  const [loading, setLoading] = useState(true)

  // Redeem modal
  const [redeemTarget, setRedeemTarget] = useState<MarketplaceItem | null>(null)
  const [redeemLoading, setRedeemLoading] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    const [itemsData, myRedemptions] = await Promise.all([
      getActiveMarketplaceItems(orgId),
      getMyRedemptions(employeeId),
    ])
    setItems(itemsData)
    setRedemptions(myRedemptions)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [employeeId, orgId])

  // Compute available balance = earned - locked (pending + approved)
  const lockedTokens = useMemo(
    () => redemptions
      .filter(r => r.status === 'pending' || r.status === 'approved')
      .reduce((s, r) => s + r.tokens_spent, 0),
    [redemptions],
  )
  const availableBalance = Math.max(0, earnedTokens - lockedTokens)

  // Set of item IDs with a pending redemption by this employee
  const pendingItemIds = useMemo(
    () => new Set(redemptions.filter(r => r.status === 'pending').map(r => r.item_id)),
    [redemptions],
  )

  async function handleConfirmRedeem() {
    if (!redeemTarget) return
    setRedeemLoading(true)
    setRedeemError(null)
    const result = await redeemItem(employeeId, redeemTarget.id, earnedTokens, orgId)
    setRedeemLoading(false)
    if (result?.error) { setRedeemError(result.error); return }
    setRedeemTarget(null)
    loadData()
  }

  const requestsCount = redemptions.length

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading marketplace…</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Balance banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-70 mb-2">Available Balance</p>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-black tabular-nums">{fmt(availableBalance)}</p>
          <p className="text-lg font-bold opacity-70 mb-0.5">tokens</p>
        </div>
        <p className="text-[11px] opacity-60 mt-1.5">
          {fmt(earnedTokens)} earned · {fmt(lockedTokens)} locked in requests
        </p>
      </div>

      {/* Sub-tab toggle */}
      <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
        <button
          onClick={() => setSubTab('browse')}
          className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            subTab === 'browse' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <ShoppingBag size={12} /> Browse Items
        </button>
        <button
          onClick={() => setSubTab('requests')}
          className={`flex items-center gap-1.5 flex-1 justify-center px-3 py-2 rounded-lg text-xs font-bold transition-all ${
            subTab === 'requests' ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <Package size={12} /> My Requests
          {requestsCount > 0 && (
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
              subTab === 'requests' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-600'
            }`}>
              {requestsCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Browse ── */}
      {subTab === 'browse' && (
        items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              <ShoppingBag size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-500">No items available</p>
            <p className="text-xs text-gray-400 mt-1">Check back later for new rewards.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                availableBalance={availableBalance}
                hasPending={pendingItemIds.has(item.id)}
                onRedeem={setRedeemTarget}
              />
            ))}
          </div>
        )
      )}

      {/* ── My Requests ── */}
      {subTab === 'requests' && (
        redemptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              <Package size={24} className="text-gray-300" />
            </div>
            <p className="text-sm font-bold text-gray-500">No requests yet</p>
            <p className="text-xs text-gray-400 mt-1">Redeem items from the Browse tab to see them here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {redemptions.map(r => (
              <div key={r.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                r.status === 'approved' ? 'border-emerald-200' :
                r.status === 'rejected' ? 'border-red-100' :
                'border-amber-200'
              }`}>
                <div className={`h-1 w-full ${
                  r.status === 'approved' ? 'bg-emerald-400' :
                  r.status === 'rejected' ? 'bg-red-400' :
                  'bg-amber-400'
                }`} />
                <div className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      r.status === 'approved' ? 'bg-emerald-50' :
                      r.status === 'rejected' ? 'bg-red-50' :
                      'bg-amber-50'
                    }`}>
                      <Package size={15} className={
                        r.status === 'approved' ? 'text-emerald-500' :
                        r.status === 'rejected' ? 'text-red-400' :
                        'text-amber-500'
                      } />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {r.item?.name ?? <span className="text-gray-400 italic font-normal">Item no longer available</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">{fmt(r.tokens_spent)} tokens · {fmtDate(r.requested_at)}</span>
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </div>
                  {/* Admin reason on rejection */}
                  {r.status === 'rejected' && r.admin_reason && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                      <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Admin reason</p>
                        <p className="text-xs text-red-700 mt-0.5">{r.admin_reason}</p>
                      </div>
                    </div>
                  )}
                  {r.status === 'rejected' && (
                    <p className="text-[11px] text-emerald-600 font-semibold">
                      ↩ {fmt(r.tokens_spent)} tokens refunded to your balance
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Redeem confirmation modal */}
      {redeemTarget && (
        <RedeemModal
          item={redeemTarget}
          availableBalance={availableBalance}
          onConfirm={handleConfirmRedeem}
          onCancel={() => { setRedeemTarget(null); setRedeemError(null) }}
          loading={redeemLoading}
          error={redeemError}
        />
      )}
    </div>
  )
}
