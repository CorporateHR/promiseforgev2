'use client'

import { useState, useMemo, useCallback } from 'react'
import { allocateManagerBudget } from '@/app/actions/budget'
import {
  Coins, Loader2, CheckCircle2, AlertCircle, Plus,
  Search, X, ChevronRight, Pencil, Trash2,
} from 'lucide-react'
import type { Employee, OrgLevelConfig, ManagerBudget } from '@/lib/types'

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
  currentAllocations,
  editingManager,
  onSave,
  onClose,
}: {
  managers: Employee[]
  levelConfigs: OrgLevelConfig[]
  totalBudget: number
  currentAllocations: Record<string, number>
  editingManager: Employee | null
  onSave: (managerId: string, tokens: number) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState<'pick' | 'amount'>(editingManager ? 'amount' : 'pick')
  const [selected, setSelected] = useState<Employee | null>(editingManager)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState<string>(
    editingManager ? String(currentAllocations[editingManager.id] ?? '') : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = Object.values(currentAllocations).reduce((s, v) => s + v, 0)
  // remaining after removing the current allocation of selected manager (so editing is fair)
  const otherAllocated = selected
    ? totalAllocated - (currentAllocations[selected.id] ?? 0)
    : totalAllocated
  const remaining = totalBudget - otherAllocated
  const inputTokens = parseInt(value) || 0
  const isOver = inputTokens > remaining

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
    if (!selected || !inputTokens || isOver) return
    setSaving(true)
    setError(null)
    const result = await onSave(selected.id, inputTokens)
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
                    {fmt(allocated)} tk
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

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Selected manager card */}
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
              style={{ background: color.bg }}
            >
              {initials(selected)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{selected.full_name}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                L{selected.level} · {getLabel(selected.level)}
                {selected.team_name && ` · ${selected.team_name}`}
              </p>
            </div>
          </div>

          {/* Available balance */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">Available to allocate</p>
              <p className="text-lg font-black text-gray-900 tabular-nums">{fmt(remaining)} tk</p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, (otherAllocated / totalBudget) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              {fmt(otherAllocated)} of {fmt(totalBudget)} already allocated to other managers
            </p>
          </div>

          {/* Token input */}
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-2">
              Tokens to allocate
            </label>
            <div className={`flex items-center gap-2 border rounded-xl px-4 py-3 transition-all ${
              isOver
                ? 'border-red-300 bg-red-50'
                : 'border-gray-200 bg-gray-50 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100'
            }`}>
              <Coins size={16} className={isOver ? 'text-red-400' : 'text-gray-400'} />
              <input
                autoFocus={!!editingManager}
                type="number"
                min="0"
                max={remaining}
                value={value}
                onChange={e => { setValue(e.target.value); setError(null) }}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-black text-gray-800 outline-none placeholder-gray-300 tabular-nums"
              />
              <span className="text-sm text-gray-400 font-semibold">tokens</span>
            </div>
            {isOver && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} /> Exceeds available by {fmt(inputTokens - remaining)} tokens
              </p>
            )}
          </div>

          {/* Quick chips */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 mb-2">Quick amounts</p>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1_000, 5_000].map(n => (
                <button
                  key={n}
                  disabled={n > remaining}
                  onClick={() => setValue(String(n))}
                  className="py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>
            {remaining > 0 && (
              <button
                onClick={() => setValue(String(remaining))}
                className="w-full mt-2 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Use all remaining · {fmt(remaining)} tokens
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
            disabled={saving || !inputTokens || isOver}
            className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : <><Coins size={14} /> Allocate Tokens</>}
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
  orgId, employees, levelConfigs, totalBudget, initialAllocations,
}: Props) {
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

  // Build sorted allocations (allocated managers first, with their index in managers[])
  const allocations: Allocation[] = useMemo(() => {
    return managers
      .map((m, i) => ({ manager: m, tokens: tokenMap[m.id] ?? 0, colorIndex: i }))
      .filter(a => a.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
  }, [managers, tokenMap])

  const totalAllocated = allocations.reduce((s, a) => s + a.tokens, 0)
  const remaining = totalBudget !== null ? totalBudget - totalAllocated : null
  const usedPct = totalBudget ? Math.min(100, (totalAllocated / totalBudget) * 100) : 0
  const isNearLimit = remaining !== null && remaining >= 0 && usedPct >= 80

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave(managerId: string, tokens: number) {
    const result = await allocateManagerBudget(orgId, managerId, tokens)
    if (result.error) {
      showToast('error', result.error)
      throw new Error(result.error)
    }
    setTokenMap(prev => ({ ...prev, [managerId]: tokens }))
    showToast('success', 'Tokens allocated successfully')
  }

  async function handleRemove(managerId: string) {
    const result = await allocateManagerBudget(orgId, managerId, 0)
    if (result.error) { showToast('error', result.error); return }
    setTokenMap(prev => { const n = { ...prev }; delete n[managerId]; return n })
    showToast('success', 'Allocation removed')
  }

  function openAllocate() { setEditingManager(null); setSheetOpen(true) }
  function openEdit(m: Employee) { setEditingManager(m); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setEditingManager(null) }

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

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

          <div className="grid grid-cols-3 gap-3 mb-4">
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Total tokens</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{fmt(totalBudget)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Allocated</p>
              <p className="text-2xl font-black text-gray-900 tabular-nums">{fmt(totalAllocated)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-0.5">Remaining</p>
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
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">Allocations</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {allocations.length} of {managers.length} managers allocated
              </p>
            </div>
            <button
              onClick={openAllocate}
              className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3.5 py-2 rounded-xl transition-colors active:scale-95"
            >
              <Plus size={14} /> Allocate
            </button>
          </div>

          {allocations.length === 0 ? (
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
                        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                      >
                        <Pencil size={13} />
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
          <div className="absolute inset-y-0 right-0 w-80 bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {editingManager ? `Edit · ${editingManager.first_name}` : 'Allocate Tokens'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmt(totalBudget - totalAllocated + (editingManager ? (tokenMap[editingManager.id] ?? 0) : 0))} tokens available
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
