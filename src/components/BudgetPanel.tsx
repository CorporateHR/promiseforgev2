'use client'

import { useState, useMemo } from 'react'
import { Coins, ChevronDown, ChevronUp, Loader2, Check } from 'lucide-react'
import { allocateManagerBudget } from '@/app/actions/org'
import type { Employee, OrgBudget, ManagerBudget } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

interface Props {
  orgId: string
  orgBudget: OrgBudget | null
  managerBudgets: ManagerBudget[]
  managers: Employee[]   // employees who have direct reports
  levelConfigs: { level: number; label: string }[]
}

export default function BudgetPanel({
  orgId, orgBudget, managerBudgets: initialManagerBudgets, managers, levelConfigs,
}: Props) {
  const [budgets, setBudgets] = useState<ManagerBudget[]>(initialManagerBudgets)
  const [editing, setEditing] = useState<string | null>(null)  // manager_id being edited
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const totalTokens = orgBudget?.total_tokens ?? 0
  const allocated   = useMemo(() => budgets.reduce((s, b) => s + b.tokens, 0), [budgets])
  const remaining   = totalTokens - allocated
  const pct         = totalTokens > 0 ? Math.min((allocated / totalTokens) * 100, 100) : 0

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const getBudget = (managerId: string) => budgets.find(b => b.manager_id === managerId)?.tokens ?? 0

  function startEdit(managerId: string) {
    setEditing(managerId)
    setInputVal(String(getBudget(managerId)))
    setError(null)
  }

  async function handleSave(managerId: string) {
    const tokens = parseInt(inputVal, 10)
    if (isNaN(tokens) || tokens < 0) { setError('Enter a valid number ≥ 0'); return }

    setSaving(true)
    setError(null)
    const result = await allocateManagerBudget(orgId, managerId, tokens)
    setSaving(false)

    if (result.error) { setError(result.error); return }

    setBudgets(prev => {
      const without = prev.filter(b => b.manager_id !== managerId)
      if (tokens === 0) return without
      const existing = prev.find(b => b.manager_id === managerId)
      return [
        ...without,
        { ...(existing ?? { id: '', organization_id: orgId, allocated_by: null, created_at: '', updated_at: '' }),
          manager_id: managerId, tokens },
      ]
    })
    setEditing(null)
    setSavedId(managerId)
    setTimeout(() => setSavedId(null), 2000)
  }

  if (!orgBudget) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm">
        <Coins size={15} className="flex-shrink-0" />
        No budget allocated yet — ask your Super Admin to set a budget for this organization.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins size={16} className="text-indigo-500" />
            <span className="text-sm font-bold text-gray-900">Budget Overview</span>
          </div>
          <span className="text-xs text-gray-400">
            <span className="font-bold text-gray-700">{allocated.toLocaleString()}</span> / {totalTokens.toLocaleString()} tokens used
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center gap-6 text-xs text-gray-500">
          <span><span className="font-bold text-indigo-600">{allocated.toLocaleString()}</span> allocated</span>
          <span><span className={`font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>{remaining.toLocaleString()}</span> remaining</span>
          <span><span className="font-bold text-gray-700">{totalTokens.toLocaleString()}</span> total</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">{error}</div>
      )}

      {/* Manager list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Allocate to Managers</h3>
        </div>

        {managers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No managers found in this organization.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {managers.map(mgr => {
              const current = getBudget(mgr.id)
              const isEditing = editing === mgr.id
              const isSaved   = savedId === mgr.id
              const color     = levelColor(mgr.level)
              const label     = getLabel(mgr.level)

              return (
                <div key={mgr.id} className="px-5 py-3.5 flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-black text-xs"
                    style={{ background: color }}
                  >
                    {mgr.first_name[0]}{mgr.last_name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">{mgr.first_name} {mgr.last_name}</div>
                    <div className="text-[11px] text-gray-400">
                      {mgr.employee_id && <span className="font-mono mr-1.5">{mgr.employee_id}</span>}
                      <span
                        className="font-semibold px-1.5 py-0.5 rounded text-white text-[10px]"
                        style={{ background: color }}
                      >{label}</span>
                      {mgr.team_name && <span className="ml-1.5">{mgr.team_name}</span>}
                    </div>
                  </div>

                  {/* Token allocation */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          value={inputVal}
                          onChange={e => setInputVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSave(mgr.id); if (e.key === 'Escape') setEditing(null) }}
                          className="w-24 px-2 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 text-sm font-mono text-center focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSave(mgr.id)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={11} className="animate-spin" /> : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(mgr.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                      >
                        <Coins size={12} className="text-gray-400 group-hover:text-indigo-500" />
                        <span className={`text-sm font-bold font-mono ${current > 0 ? 'text-indigo-600' : 'text-gray-300'}`}>
                          {current.toLocaleString()}
                        </span>
                        {isSaved
                          ? <Check size={12} className="text-green-500" />
                          : <ChevronDown size={12} className="text-gray-300 group-hover:text-indigo-400" />
                        }
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
