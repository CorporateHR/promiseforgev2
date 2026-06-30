'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { allocateManagerBudget } from '@/app/actions/budget'
import {
  Coins, Loader2, CheckCircle2, AlertCircle, Plus, PlusCircle,
  Search, X, ChevronRight, ChevronDown, Trash2,
  ArrowDownLeft, ArrowUpRight, Trophy, RefreshCw,
} from 'lucide-react'
import type { Employee, OrgLevelConfig, ManagerBudget, ManagerBudgetTransaction, ChallengeWithTiers } from '@/lib/types'

// ─── Palette ──────────────────────────────────────────────────────────────────
const PALETTE = [
  { bg: '#4f46e5', light: '#eef2ff' },
  { bg: '#0891b2', light: '#ecfeff' },
  { bg: '#059669', light: '#ecfdf5' },
  { bg: '#d97706', light: '#fffbeb' },
  { bg: '#db2777', light: '#fdf2f8' },
  { bg: '#7c3aed', light: '#f5f3ff' },
  { bg: '#ea580c', light: '#fff7ed' },
  { bg: '#0f766e', light: '#f0fdfa' },
]
function palette(i: number) { return PALETTE[i % PALETTE.length] }
function fmt(n: number) { return n.toLocaleString() }
function initials(e: Employee) { return `${e.first_name[0]}${e.last_name[0]}` }

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  orgId: string
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  totalBudget: number | null
  initialAllocations: ManagerBudget[]
  initialTransactions: ManagerBudgetTransaction[]
  orgChallenges: ChallengeWithTiers[]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

type EntryKind = 'credit' | 'debit' | 'settled'
interface LedgerEntry {
  kind: EntryKind
  date: string
  label: string
  sub?: string
  amount: number
}

interface Allocation {
  manager: Employee
  tokens: number
  colorIndex: number
}

// ─── Allocate side sheet ──────────────────────────────────────────────────────
function AllocateSheet({
  managers,
  levelConfigs,
  totalBudget,
  challengeReserved,
  currentAllocations,
  editingManager,
  onSave,
  onClose,
}: {
  managers: Employee[]
  levelConfigs: OrgLevelConfig[]
  totalBudget: number
  challengeReserved: number
  currentAllocations: Record<string, number>
  editingManager: Employee | null
  onSave: (managerId: string, tokens: number) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState<'pick' | 'amount'>(editingManager ? 'amount' : 'pick')
  const [selected, setSelected] = useState<Employee | null>(editingManager)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState<string>('')   // always start empty — user enters a delta
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = Object.values(currentAllocations).reduce((s, v) => s + v, 0)
  const otherAllocated = selected
    ? totalAllocated - (currentAllocations[selected.id] ?? 0)
    : totalAllocated
  const remaining = totalBudget - otherAllocated - challengeReserved

  // Delta-based: value is the amount to ADD (negative to deduct)
  const currentAmount = selected ? (currentAllocations[selected.id] ?? 0) : 0
  const delta = value === '' || value === '-' ? 0 : (parseInt(value, 10) || 0)
  const newTotal = currentAmount + delta
  const isDeduction = delta < 0
  const isBelowZero = newTotal < 0
  const isOver = newTotal > remaining
  const hasError = isBelowZero || isOver

  const filtered = managers.filter(m => {
    const q = query.toLowerCase()
    return (
      m.full_name.toLowerCase().includes(q) ||
      (m.employee_id ?? '').toLowerCase().includes(q) ||
      (m.team_name ?? '').toLowerCase().includes(q)
    )
  })

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  async function handleSave() {
    if (!selected || delta === 0 || hasError) return
    setSaving(true)
    setError(null)
    const result = await onSave(selected.id, newTotal)
    setSaving(false)
    // onSave throws on error
    onClose()
  }

  // ── Step 1: Pick a manager ─────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <>
        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search managers…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Manager list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-10">No managers match</p>
          )}
          {filtered.map((m, i) => {
            const color = palette(i)
            const allocated = currentAllocations[m.id] ?? 0
            return (
              <button
                key={m.id}
                onClick={() => { setSelected(m); setStep('amount') }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                  style={{ background: color.bg }}
                >
                  {initials(m)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.full_name}</p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {m.employee_id && <span className="font-mono mr-1.5">{m.employee_id}</span>}
                    L{m.level} · {getLabel(m.level)}
                    {m.team_name && ` · ${m.team_name}`}
                  </p>
                </div>
                {allocated > 0 && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: color.light, color: color.bg }}
                  >
                    {fmt(allocated)} tokens
                  </span>
                )}
                <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
              </button>
            )
          })}
        </div>
      </>
    )
  }

  // ── Step 2: Set amount ─────────────────────────────────────────────────────
  if (step === 'amount' && selected) {
    const idx = managers.findIndex(m => m.id === selected.id)
    const color = palette(idx)

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Back to pick (if not editing) */}
        {!editingManager && (
          <button
            onClick={() => setStep('pick')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 px-5 py-3 border-b border-gray-100 transition-colors"
          >
            ← Back to manager list
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Identity + stats — single compact card */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                style={{ background: color.bg }}
              >
                {initials(selected)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{selected.full_name}</p>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                  L{selected.level} · {getLabel(selected.level)}
                  {selected.team_name && ` · ${selected.team_name}`}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-200/60 grid grid-cols-2 divide-x divide-gray-200/60">
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Current</p>
                <p className="text-sm font-black tabular-nums text-gray-800">
                  {currentAmount > 0 ? `${fmt(currentAmount)} tokens` : <span className="text-gray-400 font-semibold text-xs">None</span>}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Available</p>
                <p className="text-sm font-black text-emerald-600 tabular-nums">{fmt(remaining)} tokens</p>
              </div>
            </div>
          </div>

          {/* Delta input */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5">
              Amount to add <span className="font-normal text-gray-400">· use − to deduct</span>
            </label>
            <div className={`flex items-center gap-2 border rounded-xl px-4 py-3 transition-all ${
              hasError
                ? 'border-red-300 bg-red-50'
                : isDeduction
                  ? 'border-amber-300 bg-amber-50 focus-within:border-amber-400'
                  : 'border-gray-200 bg-gray-50 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100'
            }`}>
              <Coins size={15} className={hasError ? 'text-red-400' : isDeduction ? 'text-amber-500' : 'text-gray-400'} />
              <input
                autoFocus
                type="text"
                inputMode="numeric"
                value={value}
                onChange={e => { setValue(e.target.value); setError(null) }}
                placeholder="e.g. 5000 or -2000"
                className="flex-1 bg-transparent text-2xl font-black text-gray-800 outline-none placeholder:text-gray-300 placeholder:text-base tabular-nums"
              />
              <span className="text-xs font-bold text-gray-400 flex-shrink-0">tokens</span>
            </div>

            {/* Validation errors */}
            {isBelowZero && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} /> Cannot deduct more than current allocation ({fmt(currentAmount)} tokens)
              </p>
            )}
            {isOver && !isBelowZero && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} /> Exceeds available budget by {fmt(newTotal - remaining)} tokens
              </p>
            )}

            {/* New total preview */}
            {delta !== 0 && !hasError && (
              <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 border ${
                isDeduction ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className={`text-xs font-semibold ${isDeduction ? 'text-amber-700' : 'text-emerald-700'}`}>
                  New total
                </span>
                <span className={`text-sm font-black tabular-nums ${isDeduction ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {fmt(newTotal)} tokens
                </span>
              </div>
            )}
          </div>

          {/* Quick add chips */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 mb-2">Quick add</p>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1_000, 5_000].map(n => (
                <button
                  key={n}
                  disabled={n > remaining}
                  onClick={() => setValue(String(n))}
                  className="py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  +{n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>
            {remaining > 0 && (
              <button
                onClick={() => setValue(String(remaining))}
                className="w-full mt-2 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Add all remaining · +{fmt(remaining)} tokens
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2.5">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* Save footer */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || delta === 0 || hasError}
            className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : <><Coins size={14} /> {isDeduction ? 'Deduct Tokens' : 'Add Tokens'}</>}
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function NoBudgetState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-32 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
        <Coins size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-bold text-gray-700">No budget assigned yet</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs">
        Your super admin needs to set a token budget for this organisation before
        you can allocate tokens to managers.
      </p>
    </div>
  )
}

// ─── Stacked bar ──────────────────────────────────────────────────────────────
function StackedBar({
  allocations,
  totalBudget,
}: {
  allocations: Allocation[]
  totalBudget: number
}) {
  return (
    <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
      {allocations.map(a => (
        <div
          key={a.manager.id}
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.min(100, (a.tokens / totalBudget) * 100)}%`,
            background: palette(a.colorIndex).bg,
          }}
        />
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BudgetTab({
  orgId, employees, levelConfigs, totalBudget, initialAllocations, initialTransactions, orgChallenges,
}: Props) {
  // Org-wide challenges (manager_id null) reserve from the org budget while draft/active,
  // and stay reserved once completed (100% completion = worst-case budget fully paid out).
  // Only 'disabled' challenges currently free their budget back (partial completion, no real settlement yet).
  const challengeReserved = useMemo(
    () => orgChallenges
      .filter(c => !c.manager_id && (c.status === 'draft' || c.status === 'active' || c.status === 'completed'))
      .reduce((s, c) => s + c.token_budget, 0),
    [orgChallenges],
  )
  // All managers (derived from org chart)
  const managers = useMemo(() => {
    const reporterSet = new Set(employees.filter(e => e.manager_id).map(e => e.manager_id!))
    return employees.filter(e => reporterSet.has(e.id))
  }, [employees])

  // token map: managerId → tokens
  const [tokenMap, setTokenMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialAllocations.forEach(a => { map[a.manager_id] = a.tokens })
    return map
  })

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingManager, setEditingManager] = useState<Employee | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [allocationsOpen, setAllocationsOpen] = useState(false)

  // Build sorted allocations (allocated managers first, with their index in managers[])
  const allocations: Allocation[] = useMemo(() => {
    return managers
      .map((m, i) => ({ manager: m, tokens: tokenMap[m.id] ?? 0, colorIndex: i }))
      .filter(a => a.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
  }, [managers, tokenMap])

  const totalAllocated = allocations.reduce((s, a) => s + a.tokens, 0)
  const totalConsumed = totalAllocated + challengeReserved
  const remaining = totalBudget !== null ? totalBudget - totalConsumed : null
  const usedPct = totalBudget ? Math.min(100, (totalConsumed / totalBudget) * 100) : 0
  const isNearLimit = remaining !== null && remaining >= 0 && usedPct >= 80

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave(managerId: string, tokens: number) {
    const oldTokens = tokenMap[managerId] ?? 0
    const delta = tokens - oldTokens
    const result = await allocateManagerBudget(orgId, managerId, tokens)
    if (result.error) {
      showToast('error', result.error)
      throw new Error(result.error)
    }
    setTokenMap(prev => ({ ...prev, [managerId]: tokens }))
    // Optimistically add the transaction to the ledger
    setTransactions(prev => [{
      id: crypto.randomUUID(),
      organization_id: orgId,
      manager_id: managerId,
      amount: delta,
      new_total: tokens,
      allocated_by: null,
      created_at: new Date().toISOString(),
    }, ...prev])
    showToast('success', delta > 0 ? 'Tokens allocated' : 'Tokens returned to pool')
  }

  async function handleRemove(managerId: string) {
    const oldTokens = tokenMap[managerId] ?? 0
    const result = await allocateManagerBudget(orgId, managerId, 0)
    if (result.error) { showToast('error', result.error); return }
    setTokenMap(prev => { const n = { ...prev }; delete n[managerId]; return n })
    if (oldTokens > 0) {
      setTransactions(prev => [{
        id: crypto.randomUUID(),
        organization_id: orgId,
        manager_id: managerId,
        amount: -oldTokens,
        new_total: 0,
        allocated_by: null,
        created_at: new Date().toISOString(),
      }, ...prev])
    }
    showToast('success', 'Allocation removed')
  }

  function openAllocate() { router.push('/dashboard/admin/budget/allocate') }
  function openEdit(m: Employee) { setEditingManager(m); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setEditingManager(null) }

  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const getEmployee = (id: string) => employees.find(e => e.id === id)

  // Keep a live copy of transactions so new ones added this session appear immediately
  const [transactions, setTransactions] = useState(initialTransactions)

  // Build transaction ledger from real delta records
  const ledger = useMemo<LedgerEntry[]>(() => {
    const entries: LedgerEntry[] = []

    // Credit: budget received from super admin (no precise date — pin to top)
    if (totalBudget && totalBudget > 0) {
      entries.push({
        kind: 'credit' as const,
        date: '9999-12-31',
        label: 'Received from Super Admin',
        sub: 'Organisation token budget set',
        amount: totalBudget,
      })
    }

    // Real delta transactions (positive = allocated out, negative = returned)
    const managersWithTxns = new Set(transactions.map(t => t.manager_id))
    for (const txn of transactions) {
      const mgr = getEmployee(txn.manager_id)
      const isReturn = txn.amount < 0
      entries.push({
        kind: isReturn ? 'credit' as const : 'debit' as const,
        date: txn.created_at,
        label: isReturn
          ? `Returned from ${mgr?.full_name ?? 'Manager'}`
          : `Allocated to ${mgr?.full_name ?? 'Manager'}`,
        sub: mgr ? `L${mgr.level} · ${getLabel(mgr.level)}${mgr.team_name ? ` · ${mgr.team_name}` : ''}` : undefined,
        amount: Math.abs(txn.amount),
      })
    }

    // Fallback: managers with current allocations but no transaction history yet
    for (const alloc of initialAllocations) {
      if (alloc.tokens <= 0 || managersWithTxns.has(alloc.manager_id)) continue
      const mgr = getEmployee(alloc.manager_id)
      entries.push({
        kind: 'debit' as const,
        date: alloc.updated_at,
        label: `Allocated to ${mgr?.full_name ?? 'Manager'}`,
        sub: mgr ? `L${mgr.level} · ${getLabel(mgr.level)}${mgr.team_name ? ` · ${mgr.team_name}` : ''}` : undefined,
        amount: alloc.tokens,
      })
    }

    // Org-wide challenges (manager_id null)
    for (const c of orgChallenges.filter(ch => !ch.manager_id)) {
      const isSettled = c.status === 'disabled'
      entries.push({
        kind: isSettled ? 'settled' as const : 'debit' as const,
        date: isSettled ? (c.updated_at ?? c.created_at) : c.created_at,
        label: c.title,
        sub: isSettled ? 'Challenge ended · tokens settled' : `Org-wide challenge · ${c.status}`,
        amount: c.token_budget,
      })
    }

    return entries.sort((a, b) => {
      if (a.kind === 'credit' && a.date === '9999-12-31') return -1
      if (b.kind === 'credit' && b.date === '9999-12-31') return 1
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })
  }, [totalBudget, transactions, initialAllocations, orgChallenges, employees, levelConfigs])

  if (!totalBudget) return <NoBudgetState />

  const remainColor = remaining !== null && remaining < 0
    ? 'text-red-600'
    : isNearLimit
    ? 'text-amber-600'
    : 'text-emerald-600'

  return (
    <div className="flex flex-col h-full overflow-hidden relative">

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

        {/* Budget status card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
            Budget Overview
          </p>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Received</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{fmt(totalBudget)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">from super admin</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Distributed</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{fmt(totalAllocated)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">to managers</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">In Challenges</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{fmt(challengeReserved)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">reserved</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Available</p>
              <p className={`text-2xl font-black tabular-nums ${remainColor}`}>
                {remaining !== null ? fmt(Math.abs(remaining)) : '—'}
              </p>
            </div>
          </div>

          <StackedBar allocations={allocations} totalBudget={totalBudget} />

          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-400">{usedPct.toFixed(0)}% allocated</p>
            {isNearLimit && remaining !== null && remaining >= 0 && (
              <p className="text-[11px] font-semibold text-amber-600">
                Only {fmt(remaining)} tokens left
              </p>
            )}
            {remaining !== null && remaining < 0 && (
              <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> Over by {fmt(Math.abs(remaining))}
              </p>
            )}
          </div>
        </div>

        {/* Allocations list */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div
            className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-gray-50 transition-colors"
            onClick={() => setAllocationsOpen(o => !o)}
          >
            <div className="flex items-center gap-2">
              <ChevronDown
                size={15}
                className={`text-gray-400 transition-transform duration-200 ${allocationsOpen ? '' : '-rotate-90'}`}
              />
              <div>
                <p className="text-sm font-bold text-gray-900">Allocations</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {allocations.length} of {managers.length} managers allocated
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                title="Refresh budget data"
              >
                <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
              <button
                onClick={openAllocate}
                className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3.5 py-2 rounded-xl transition-colors active:scale-95"
              >
                <Plus size={14} /> Allocate
              </button>
            </div>
          </div>

          {allocationsOpen && (allocations.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
                <Coins size={20} className="text-indigo-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No allocations yet</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Click "Allocate" to assign tokens to a manager from your budget.
              </p>
              <button
                onClick={openAllocate}
                className="mt-4 flex items-center gap-1.5 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} /> Allocate to first manager
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {allocations.map(({ manager: m, tokens, colorIndex }) => {
                const color = palette(colorIndex)
                const pct = ((tokens / totalBudget) * 100).toFixed(0)
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3.5 group">
                    {/* Colour dot matching stacked bar */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color.bg }}
                    />

                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                      style={{ background: color.bg }}
                    >
                      {initials(m)}
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{m.full_name}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        L{m.level} · {getLabel(m.level)}
                        {m.team_name && ` · ${m.team_name}`}
                      </p>
                    </div>

                    {/* Token amount + percentage */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(tokens)}</p>
                      <p className="text-[11px] font-semibold" style={{ color: color.bg }}>{pct}%</p>
                    </div>

                    {/* Row actions (visible on hover) */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => openEdit(m)}
                        title="Add / adjust tokens"
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                      <button
                        onClick={() => handleRemove(m.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Transaction ledger */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-900">Transactions</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Budget movements for this organisation</p>
          </div>

          {ledger.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <Trophy size={22} className="text-gray-200 mb-2" />
              <p className="text-sm font-semibold text-gray-500">No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {ledger.map((entry, i) => {
                const isCredit  = entry.kind === 'credit'
                const isSettled = entry.kind === 'settled'
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCredit  ? 'bg-emerald-50' :
                      isSettled ? 'bg-gray-100'   :
                                  'bg-indigo-50'
                    }`}>
                      {isCredit  ? <ArrowDownLeft size={15} className="text-emerald-600" />  :
                       isSettled ? <CheckCircle2  size={15} className="text-gray-400"    />  :
                                   <ArrowUpRight  size={15} className="text-indigo-500"  />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{entry.label}</p>
                      {entry.sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{entry.sub}</p>}
                    </div>
                    {entry.kind !== 'credit' && (
                      <span className="text-[11px] text-gray-400 flex-shrink-0 hidden sm:block">
                        {fmtDate(entry.date)}
                      </span>
                    )}
                    <span className={`text-sm font-black tabular-nums flex-shrink-0 text-right w-24 ${
                      isCredit  ? 'text-emerald-600'            :
                      isSettled ? 'text-gray-400 line-through'  :
                                  'text-gray-800'
                    }`}>
                      {isCredit ? '+' : isSettled ? '' : '−'}
                      {fmt(entry.amount)} tokens
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Right side sheet overlay ──────────────────────────────────────── */}
      {sheetOpen && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            onClick={closeSheet}
          />

          {/* Sheet */}
          <div className="absolute inset-y-0 right-0 w-96 bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {editingManager ? `Adjust · ${editingManager.first_name}` : 'Allocate Tokens'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmt(totalBudget - totalConsumed + (editingManager ? (tokenMap[editingManager.id] ?? 0) : 0))} tokens available
                </p>
              </div>
              <button
                onClick={closeSheet}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Sheet body */}
            <AllocateSheet
              managers={managers}
              levelConfigs={levelConfigs}
              totalBudget={totalBudget}
              challengeReserved={challengeReserved}
              currentAllocations={tokenMap}
              editingManager={editingManager}
              onSave={handleSave}
              onClose={closeSheet}
            />
          </div>
        </>
      )}

      {/* ── Toast  ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
