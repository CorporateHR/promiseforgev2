'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Coins, CheckCircle2, AlertCircle, Loader2, X,
  ChevronDown, ChevronRight, Search,
} from 'lucide-react'
import { allocateManagerBudget } from '@/app/actions/budget'
import type { Employee, OrgLevelConfig, ManagerBudget, EmployeeNode } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }
function initials(e: Employee) { return `${e.first_name[0]}${e.last_name[0]}` }

function buildTree(employees: Employee[], rootId: string): EmployeeNode[] {
  function recurse(emp: Employee): EmployeeNode {
    return {
      ...emp,
      children: employees
        .filter(e => e.manager_id === emp.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(recurse),
    }
  }
  return employees.filter(e => e.id === rootId).map(recurse)
}

// ─── Row ─────────────────────────────────────────────────────────────────────
function AllocRow({
  node, levelConfigs, tokenMap, directReportSet, onSelect, expanded, onToggle,
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  tokenMap: Record<string, number>
  directReportSet: Set<string>
  onSelect: (e: Employee) => void
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const selectable = directReportSet.has(node.id)
  const allocated = tokenMap[node.id] ?? 0
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const color = levelColor(node.level)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center gap-3">
        {hasChildren ? (
          <button
            onClick={() => onToggle(node.id)}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            {isExpanded
              ? <ChevronDown size={14} className="text-gray-500" />
              : <ChevronRight size={14} className="text-gray-400" />}
          </button>
        ) : <div className="w-6 flex-shrink-0" />}

        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
          style={{ background: color }}
        >
          {initials(node)}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{node.full_name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {getLabel(node.level)}
            {node.team_name && <span className="text-gray-400"> · {node.team_name}</span>}
          </p>
        </div>

        {selectable ? (
          <div className="flex items-center gap-3 flex-shrink-0">
            {allocated > 0 && (
              <div className="text-right">
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Budget</p>
                <p className="text-xs font-black tabular-nums text-gray-800">{fmt(allocated)} tokens</p>
              </div>
            )}
            <button
              onClick={() => onSelect(node)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              {allocated > 0 ? 'Adjust' : 'Allocate'}
            </button>
          </div>
        ) : null}
      </div>

      {isExpanded && hasChildren && (
        <div className="px-2 pb-2 pt-1 space-y-2 border-t border-gray-100">
          {node.children.map(child => (
            <AllocRow
              key={child.id}
              node={child}
              levelConfigs={levelConfigs}
              tokenMap={tokenMap}
              directReportSet={directReportSet}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  orgId: string
  managerEmployee: Employee
  subtreeEmployees: Employee[]
  directReportIds: string[]   // immediate reports (for expand default)
  allocatableIds: string[]    // full subtree — everyone this manager can allocate to
  levelConfigs: OrgLevelConfig[]
  managerBudget: number           // this manager's pool (from admin)
  initialAllocations: ManagerBudget[]  // manager_budgets rows for full subtree
  allocatedFromMyPool: number     // net total this manager has given (from transaction log)
  myAllocations: Record<string, number> // net per-person this manager has given
}

export default function ManagerBudgetAllocateView({
  orgId, managerEmployee, subtreeEmployees, directReportIds, allocatableIds, levelConfigs,
  managerBudget, initialAllocations, allocatedFromMyPool, myAllocations: myAllocationsInit,
}: Props) {
  const router = useRouter()

  // tokenMap: each direct report's current manager_budgets total
  // key = direct report's employee ID (= manager_budgets.manager_id)
  const [tokenMap, setTokenMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialAllocations.forEach(a => { map[a.manager_id] = a.tokens })
    return map
  })

  // Track what THIS manager has given each person (net, from transaction log)
  const [myAllocationMap, setMyAllocationMap] = useState<Record<string, number>>(myAllocationsInit)
  // Track total this manager has given (net)
  const [ownGiven, setOwnGiven] = useState(allocatedFromMyPool)

  const [selected, setSelected] = useState<Employee | null>(null)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([managerEmployee.id]))
  const [search, setSearch] = useState('')

  const directReportSet = useMemo(() => new Set(allocatableIds), [allocatableIds])

  const searchResults = useMemo(() => {
    if (!search.trim()) return []
    const q = search.trim().toLowerCase()
    return subtreeEmployees.filter(e => e.id !== managerEmployee.id && e.full_name.toLowerCase().includes(q))
  }, [search, subtreeEmployees, managerEmployee.id])

  const chartEmployees = useMemo(
    () => subtreeEmployees.map(e => e.id === managerEmployee.id ? { ...e, manager_id: null } : e),
    [subtreeEmployees, managerEmployee.id],
  )
  const tree = useMemo(() => buildTree(chartEmployees, managerEmployee.id), [chartEmployees, managerEmployee.id])

  const currentAmount = selected ? (tokenMap[selected.id] ?? 0) : 0
  // What THIS manager has given to the selected person
  const myGivenToSelected = selected ? (myAllocationMap[selected.id] ?? 0) : 0
  // Pool available = manager's total minus what they've given others (exclude selected person)
  const remaining = managerBudget - (ownGiven - myGivenToSelected)

  const delta = value === '' || value === '-' ? 0 : (parseInt(value, 10) || 0)
  const newTotal = currentAmount + delta
  const isDeduction = delta < 0
  // Can only deduct what THIS manager personally gave (not tokens from admin or others)
  const isBelowZero = delta < -myGivenToSelected || newTotal < 0
  const isOver = delta > remaining
  const hasError = isBelowZero || isOver

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleSelect(e: Employee) {
    setSelected(e)
    setValue('')
    setError(null)
  }

  function closeSheet() {
    setSelected(null)
    setValue('')
    setError(null)
  }

  async function handleSave() {
    if (!selected || delta === 0 || hasError) return
    setSaving(true)
    setError(null)
    const result = await allocateManagerBudget(orgId, selected.id, newTotal)
    if (result.error) { setError(result.error); setSaving(false); return }
    // Update direct report's total budget
    setTokenMap(prev => ({ ...prev, [selected.id]: Math.max(0, newTotal) }))
    // Update this manager's pool tracking
    setMyAllocationMap(prev => ({ ...prev, [selected.id]: (prev[selected.id] ?? 0) + delta }))
    setOwnGiven(prev => prev + delta)
    setSaving(false)
    closeSheet()
    showToast('success', delta > 0 ? 'Tokens allocated' : 'Tokens returned to pool')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <button
          onClick={() => router.push('/dashboard/manager?tab=budget')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronRight size={14} className="rotate-180" /> Back to budget
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-gray-900">Allocate Budget</h1>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl">
            <Coins size={12} />
            {fmt(managerBudget - ownGiven)} tokens available
          </span>
          <button onClick={() => setExpanded(new Set(subtreeEmployees.map(e => e.id)))} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
          <button onClick={() => setExpanded(new Set([managerEmployee.id]))} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-5 pt-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employees…"
            className="flex-1 text-sm text-gray-800 bg-transparent outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Hierarchy list or search results */}
      <div className="flex-1 overflow-auto px-5 pb-4">
        {search.trim() ? (
          <div className="space-y-2">
            {searchResults.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-10">No employees match "{search}"</p>
            ) : searchResults.map(emp => {
              const allocated = tokenMap[emp.id] ?? 0
              const selectable = directReportSet.has(emp.id)
              const myGiven = myAllocationMap[emp.id] ?? 0
              const color = levelColor(emp.level)
              const label = levelConfigs.find(c => c.level === emp.level)?.label ?? `L${emp.level}`
              return (
                <div key={emp.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{ background: color }}>
                    {initials(emp)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{emp.full_name}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {label}{emp.team_name && <span className="text-gray-400"> · {emp.team_name}</span>}
                    </p>
                  </div>
                  {selectable ? (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {allocated > 0 && (
                        <div className="text-right">
                          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Budget</p>
                          <p className="text-xs font-black tabular-nums text-gray-800">{fmt(allocated)} tokens</p>
                          {myGiven > 0 && <p className="text-[9px] text-gray-400">You: {fmt(myGiven)}</p>}
                        </div>
                      )}
                      <button
                        onClick={() => handleSelect(emp)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        {allocated > 0 ? 'Adjust' : 'Allocate'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {tree.map(node => (
              <AllocRow
                key={node.id}
                node={node}
                levelConfigs={levelConfigs}
                tokenMap={tokenMap}
                directReportSet={directReportSet}
                onSelect={handleSelect}
                expanded={expanded}
                onToggle={toggleExpanded}
              />
            ))}
          </div>
        )}
      </div>

      {/* Side sheet */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-10" onClick={closeSheet} />
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <p className="text-sm font-bold text-gray-900">
                {tokenMap[selected.id] ? `Adjust · ${selected.first_name}` : 'Allocate Tokens'}
              </p>
              <button onClick={closeSheet} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
              {/* Identity card */}
              <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0" style={{ background: levelColor(selected.level) }}>
                    {initials(selected)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{selected.full_name}</p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      L{selected.level} · {getLabel(selected.level)}{selected.team_name && ` · ${selected.team_name}`}
                    </p>
                  </div>
                </div>
                <div className="border-t border-gray-200/60 px-4 py-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Current budget</p>
                  <p className="text-sm font-black tabular-nums text-gray-800">
                    {currentAmount > 0
                      ? `${fmt(currentAmount)} tokens`
                      : <span className="text-gray-400 font-semibold text-xs">None allocated</span>
                    }
                  </p>
                  {myGivenToSelected > 0 && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      You contributed {fmt(myGivenToSelected)} of this
                    </p>
                  )}
                </div>
              </div>

              {/* Delta input */}
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1.5">
                  Amount to add <span className="font-normal text-gray-400">· use − to deduct</span>
                </label>
                <div className={`flex items-center gap-2 border rounded-xl px-4 py-3 transition-all ${
                  hasError ? 'border-red-300 bg-red-50' : isDeduction ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50 focus-within:border-indigo-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100'
                }`}>
                  <Coins size={15} className={hasError ? 'text-red-400' : isDeduction ? 'text-amber-500' : 'text-gray-400'} />
                  <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={value}
                    onChange={e => { setValue(e.target.value); setError(null) }}
                    placeholder="e.g. 5000 or -2000"
                    className="flex-1 min-w-0 bg-transparent text-2xl font-black text-gray-800 outline-none placeholder:text-gray-300 placeholder:text-base tabular-nums"
                  />
                  <span className="text-xs font-bold text-gray-400 flex-shrink-0">tokens</span>
                </div>
                {isBelowZero && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} />
                    {myGivenToSelected > 0
                      ? `You can only deduct up to ${fmt(myGivenToSelected)} tokens (what you contributed)`
                      : 'Cannot deduct — you have not allocated any tokens to this person'}
                  </p>
                )}
                {isOver && !isBelowZero && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={11} /> Exceeds your available budget by {fmt(delta - remaining)} tokens
                  </p>
                )}
                {delta !== 0 && !hasError && (
                  <div className={`mt-2 flex items-center justify-between rounded-xl px-3 py-2 border ${isDeduction ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <span className={`text-xs font-semibold ${isDeduction ? 'text-amber-700' : 'text-emerald-700'}`}>New total</span>
                    <span className={`text-sm font-black tabular-nums ${isDeduction ? 'text-amber-700' : 'text-emerald-700'}`}>{fmt(newTotal)} tokens</span>
                  </div>
                )}
              </div>

              {/* Quick add */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 mb-2">Quick add</p>
                <div className="grid grid-cols-4 gap-2">
                  {[100, 500, 1_000, 5_000].map(n => (
                    <button key={n} disabled={n > remaining} onClick={() => setValue(String(n))} className="py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                      +{n >= 1000 ? `${n / 1000}k` : n}
                    </button>
                  ))}
                </div>
                {remaining > 0 && (
                  <button onClick={() => setValue(String(remaining))} className="w-full mt-2 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
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

            <div className="flex-shrink-0 px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={closeSheet} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || delta === 0 || hasError} className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Coins size={14} /> {isDeduction ? 'Deduct Tokens' : 'Add Tokens'}</>}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
