'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Building2, Coins, Plus, X, Search,
  Trash2, CheckCircle2, AlertCircle, Loader2, ChevronRight,
  Trophy, Calendar, RefreshCw, Bell, ChevronDown, Pencil, Filter,
} from 'lucide-react'
import { allocateEmployeeBudget } from '@/app/actions/budget'
import { getLiveCompletions, publishChallenge, endChallenge, deleteChallenge } from '@/app/actions/challenges'
import { nudgeEmployeeAsManager, nudgeAllIncompleteAsManager } from '@/app/actions/simulator'
import CreateChallengeSheet from './CreateChallengeSheet'
import ManagerBudgetTab from './ManagerBudgetTab'
import type { Employee, OrgLevelConfig, Organization, EmployeeAllocation, EmployeeBudgetTransaction, ManagerBudgetTransaction, ChallengeWithTiers, EmployeeNode } from '@/lib/types'

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

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

// ─── Subtree util ────────────────────────────────────────────────────────────
function getSubtree(managerId: string, all: Employee[]): Employee[] {
  const result: Employee[] = []
  const queue = [managerId]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const reports = all.filter(e => e.manager_id === id)
    result.push(...reports)
    queue.push(...reports.map(r => r.id))
  }
  return result
}

// ─── Build tree ───────────────────────────────────────────────────────────────
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
  const roots = employees.filter(e => e.id === rootId)
  return roots.map(recurse)
}

function flatSubtree(node: EmployeeNode): Employee[] {
  const result: Employee[] = [node]
  for (const child of node.children) result.push(...flatSubtree(child))
  return result
}

// ─── Team tree node (recursive, for My Team tab) ─────────────────────────────
function TeamTreeNode({
  node,
  levelConfigs,
  depth,
  expanded,
  onToggle,
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const color = levelColor(node.level)

  return (
    <div>
      <div
        className="flex items-center gap-2 py-3 pr-5 hover:bg-gray-50/60 transition-colors border-b border-gray-50 last:border-b-0"
        style={{ paddingLeft: `${20 + depth * 20}px` }}
      >
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
          {hasChildren && (
            <button
              onClick={() => onToggle(node.id)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
            >
              {isExpanded
                ? <ChevronDown size={12} className="text-gray-500" />
                : <ChevronRight size={12} className="text-gray-400" />}
            </button>
          )}
        </div>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
          style={{ background: color }}
        >
          {node.first_name[0]}{node.last_name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{node.full_name}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {node.employee_id && <span className="font-mono mr-1.5">{node.employee_id}</span>}
            {getLabel(node.level)}
            {node.team_name && ` · ${node.team_name}`}
          </p>
        </div>
        {hasChildren && (
          <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full flex-shrink-0">
            {node.children.length} report{node.children.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {isExpanded && hasChildren && node.children.map(child => (
        <TeamTreeNode
          key={child.id}
          node={child}
          levelConfigs={levelConfigs}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

// ─── Allocate side sheet ──────────────────────────────────────────────────────
function AllocateSheet({
  reports,
  levelConfigs,
  managerBudget,
  currentAllocations,
  editingEmployee,
  onSave,
  onClose,
}: {
  reports: Employee[]
  levelConfigs: OrgLevelConfig[]
  managerBudget: number
  currentAllocations: Record<string, number>
  editingEmployee: Employee | null
  onSave: (employeeId: string, tokens: number) => Promise<void>
  onClose: () => void
}) {
  const [step, setStep] = useState<'pick' | 'amount'>(editingEmployee ? 'amount' : 'pick')
  const [selected, setSelected] = useState<Employee | null>(editingEmployee)
  const [query, setQuery] = useState('')
  const [value, setValue] = useState<string>('')   // always start empty — user enters a delta
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = Object.values(currentAllocations).reduce((s, v) => s + v, 0)
  const otherAllocated = selected
    ? totalAllocated - (currentAllocations[selected.id] ?? 0)
    : totalAllocated
  const remaining = managerBudget - otherAllocated

  // Delta-based: value is the amount to ADD (negative to deduct)
  const currentAmount = selected ? (currentAllocations[selected.id] ?? 0) : 0
  const delta = value === '' || value === '-' ? 0 : (parseInt(value, 10) || 0)
  const newTotal = currentAmount + delta
  const isDeduction = delta < 0
  const isBelowZero = newTotal < 0
  const isOver = newTotal > remaining
  const hasError = isBelowZero || isOver

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  const filtered = reports.filter(r => {
    const q = query.toLowerCase()
    return (
      r.full_name.toLowerCase().includes(q) ||
      (r.employee_id ?? '').toLowerCase().includes(q) ||
      (r.team_name ?? '').toLowerCase().includes(q)
    )
  })

  async function handleSave() {
    if (!selected || delta === 0 || hasError) return
    setSaving(true)
    setError(null)
    try {
      await onSave(selected.id, newTotal)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
      setSaving(false)
    }
  }

  // ── Step 1: pick a report ───────────────────────────────────────────────────
  if (step === 'pick') {
    return (
      <>
        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-indigo-400 focus-within:bg-white transition-colors">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search your team…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-10">No team members match</p>
          )}
          {filtered.map((r, i) => {
            const color = palette(i)
            const allocated = currentAllocations[r.id] ?? 0
            return (
              <button
                key={r.id}
                onClick={() => { setSelected(r); setValue(''); setStep('amount') }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                  style={{ background: levelColor(r.level) }}
                >
                  {initials(r)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.full_name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    L{r.level} · {getLabel(r.level)}
                    {r.team_name && ` · ${r.team_name}`}
                  </p>
                </div>
                {allocated > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0">
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

  // ── Step 2: set amount ──────────────────────────────────────────────────────
  if (step === 'amount' && selected) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {!editingEmployee && (
          <button
            onClick={() => setStep('pick')}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 px-5 py-3 border-b border-gray-100 transition-colors"
          >
            ← Back to team list
          </button>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Identity + stats — single compact card */}
          <div className="rounded-2xl border border-gray-100 bg-gray-50 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                style={{ background: levelColor(selected.level) }}
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


// ─── Manager challenge card ───────────────────────────────────────────────────
function ManagerChallengeCard({
  challenge,
  completedCount,
  totalCount,
  isOwned,
  onAction,
  onEdit,
  actionLoading,
}: {
  challenge: ChallengeWithTiers
  completedCount: number
  totalCount: number
  isOwned: boolean
  onAction: (action: 'publish' | 'end' | 'delete') => void
  onEdit: () => void
  actionLoading: boolean
}) {
  const router = useRouter()
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const individualTier = challenge.tiers.find(t => t.is_individual)
  const enabledGroupTiers = challenge.tiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const ds = challenge.status
  const BADGE: Record<string, { cls: string; label: string }> = {
    draft:     { cls: 'bg-gray-100 text-gray-500',                                   label: 'Draft' },
    active:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',    label: 'Active' },
    completed: { cls: 'bg-emerald-100 text-emerald-800 border border-emerald-400',   label: 'Completed' },
    disabled:  { cls: 'bg-slate-100 text-slate-400 border border-slate-200',         label: 'Disabled' },
  }
  const accentLine = { active: 'bg-emerald-400', draft: 'bg-gray-200', completed: 'bg-emerald-500', disabled: 'bg-slate-200' }[ds]
  const iconBg     = { active: 'bg-emerald-50',  draft: 'bg-gray-50',  completed: 'bg-emerald-100', disabled: 'bg-gray-50'  }[ds]
  const iconColor  = { active: 'text-emerald-600', draft: 'text-gray-400', completed: 'text-emerald-700', disabled: 'text-gray-300' }[ds]
  const barColor   = { active: 'bg-emerald-500', draft: 'bg-gray-300', completed: 'bg-emerald-500', disabled: 'bg-slate-300' }[ds]

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${ds === 'disabled' ? 'border-gray-100 opacity-75' : 'border-gray-100'}`}>
      <div className={`h-1 w-full ${accentLine}`} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Trophy size={16} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-bold truncate ${ds === 'disabled' ? 'text-gray-500' : 'text-gray-900'}`}>{challenge.title}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${BADGE[ds].cls}`}>
                {BADGE[ds].label}
              </span>
              {isOwned && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 flex-shrink-0">
                  My challenge
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">{challenge.description}</p>
          </div>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(challenge.start_date || challenge.due_date) && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full">
              <Calendar size={9} />
              {challenge.start_date && challenge.start_date}
              {challenge.start_date && challenge.due_date && ' → '}
              {challenge.due_date && challenge.due_date}
            </span>
          )}
          {maxPerEmployee > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              <Coins size={9} />
              up to {fmt(maxPerEmployee)} / person
            </span>
          )}
        </div>

        {/* Progress (scoped to manager's subtree) — only shown when not draft */}
        {ds !== 'draft' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Users size={10} /> {completedCount} / {totalCount} my team completed
              </span>
              <span className="text-[11px] font-bold text-gray-700">{progressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tier pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {challenge.tiers
            .filter(t => t.enabled || t.is_individual)
            .sort((a, b) => a.level - b.level)
            .map(t => (
              <span key={t.level} className="text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                L{t.level} {t.is_individual ? `${fmt(t.base_tokens)}tokens` : `+${fmt(t.bonus_tokens)}@${t.threshold_pct}%`}
              </span>
            ))}
        </div>

        {/* Actions */}
        {isOwned && challenge.status !== 'completed' && challenge.status !== 'disabled' ? (
          <div className="flex gap-2">
            {challenge.status === 'draft' && (
              <>
                <button
                  onClick={() => onAction('publish')}
                  disabled={actionLoading}
                  title="Publish challenge"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={11} className="animate-spin" /> : <Trophy size={11} />}
                  Publish
                </button>
                <button
                  onClick={onEdit}
                  disabled={actionLoading}
                  title="Edit challenge"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => onAction('delete')}
                  disabled={actionLoading}
                  title="Delete challenge"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={11} />
                </button>
              </>
            )}
            {challenge.status === 'active' && (
              <>
                <button
                  onClick={() => router.push(`/dashboard/manager/challenges/${challenge.id}`)}
                  title="View progress"
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                >
                  <ChevronRight size={11} /> View Progress
                </button>
                <button
                  onClick={() => onAction('end')}
                  disabled={actionLoading}
                  title="End challenge"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                </button>
              </>
            )}
          </div>
        ) : (
          challenge.status !== 'draft' && (
            <button
              onClick={() => router.push(`/dashboard/manager/challenges/${challenge.id}`)}
              title={challenge.status === 'active' ? 'View progress' : 'View results'}
              className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                challenge.status === 'active'
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
              }`}
            >
              <ChevronRight size={11} />
              {challenge.status === 'active' ? 'View Progress' : 'View Results'}
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─── Person row (used inside groups and at top level) ────────────────────────
function PersonRow({
  emp,
  done,
  isActive,
  levelConfigs,
  onNudge,
  nudging,
}: {
  emp: Employee
  done: boolean
  isActive: boolean
  levelConfigs: OrgLevelConfig[]
  onNudge: (emp: Employee) => void
  nudging: boolean
}) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  return (
    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${done ? 'bg-emerald-50/20' : ''}`}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
        style={{ background: levelColor(emp.level) }}
      >
        {emp.first_name[0]}{emp.last_name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-900 truncate">{emp.full_name}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {getLabel(emp.level)}
          {emp.team_name && <span className="text-gray-400 font-medium"> · {emp.team_name}</span>}
        </p>
      </div>
      {done ? (
        <div className="flex items-center gap-1.5 flex-shrink-0 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-[11px] font-bold text-emerald-600">Done</span>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Pending</span>
          {isActive && (
            <button
              onClick={() => onNudge(emp)}
              disabled={nudging}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
            >
              {nudging ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
              Nudge
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Hierarchical group card (recursive, similar to simulator) ───────────────
function TeamGroupCard({
  node,
  completedIds,
  isActive,
  levelConfigs,
  onNudge,
  nudgingId,
  expanded,
  onToggle,
}: {
  node: EmployeeNode
  completedIds: Set<string>
  isActive: boolean
  levelConfigs: OrgLevelConfig[]
  onNudge: (emp: Employee) => void
  nudgingId: string | null
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const subtree = flatSubtree(node)
  const doneCount = subtree.filter(e => completedIds.has(e.id)).length
  const totalCount = subtree.length
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const groupColor = levelColor(node.level)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="px-4 py-3 flex items-center gap-3 bg-gray-50/50 border-b border-gray-100">
        {hasChildren && (
          <button
            onClick={() => onToggle(node.id)}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            {isExpanded
              ? <ChevronDown size={14} className="text-gray-500" />
              : <ChevronRight size={14} className="text-gray-400" />}
          </button>
        )}
        {!hasChildren && <div className="w-6" />}
        
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
          style={{ background: groupColor }}
        >
          {node.first_name[0]}{node.last_name[0]}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{node.full_name}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {getLabel(node.level)}
            {node.team_name && <span className="text-gray-400"> · {node.team_name}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-bold text-gray-500 tabular-nums">
            {doneCount}/{totalCount}
          </span>
          {completedIds.has(node.id) ? (
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">Done</span>
            </div>
          ) : isActive && (
            <button
              onClick={() => onNudge(node)}
              disabled={nudgingId === node.id}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold transition-colors disabled:opacity-40"
            >
              {nudgingId === node.id ? <Loader2 size={9} className="animate-spin" /> : <Bell size={9} />}
              Nudge
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div className="p-2 space-y-2">
          {node.children.map(child => (
            child.children.length > 0 ? (
              <TeamGroupCard
                key={child.id}
                node={child}
                completedIds={completedIds}
                isActive={isActive}
                levelConfigs={levelConfigs}
                onNudge={onNudge}
                nudgingId={nudgingId}
                expanded={expanded}
                onToggle={onToggle}
              />
            ) : (
              <PersonRow
                key={child.id}
                emp={child}
                done={completedIds.has(child.id)}
                isActive={isActive}
                levelConfigs={levelConfigs}
                onNudge={onNudge}
                nudging={nudgingId === child.id}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Manager challenge detail (hierarchical view) ────────────────────────────
function ManagerChallengeDetail({
  challenge,
  manager,
  subtree,
  allOrgEmployees,
  initialCompletedIds,
  levelConfigs,
  onBack,
}: {
  challenge: ChallengeWithTiers
  manager: Employee
  subtree: Employee[]
  allOrgEmployees: Employee[]
  initialCompletedIds: Set<string>
  levelConfigs: OrgLevelConfig[]
  onBack: () => void
}) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  const [completedIds, setCompletedIds] = useState(initialCompletedIds)
  const [refreshing, setRefreshing] = useState(false)
  const [nudgingId, setNudgingId] = useState<string | null>(null)
  const [nudgingAll, setNudgingAll] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBySearch = searchQuery.trim()
    ? subtree.filter(e =>
        e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  // Expansion state - start with manager's direct reports expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const directReports = allOrgEmployees.filter(e => e.manager_id === manager.id)
    return new Set(directReports.map(e => e.id))
  })

  const isActive = challenge.status === 'active'

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  // Helper to get all descendant IDs
  const getDescendantIds = (nodeId: string): string[] => {
    const descendants: string[] = []
    const children = allOrgEmployees.filter(e => e.manager_id === nodeId)
    for (const child of children) {
      descendants.push(child.id)
      descendants.push(...getDescendantIds(child.id))
    }
    return descendants
  }

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        // Collapsing: remove this node AND all descendants
        next.delete(id)
        const descendants = getDescendantIds(id)
        descendants.forEach(descId => next.delete(descId))
      } else {
        // Expanding: just add this node
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(subtree.map(e => e.id)))
  const collapseAll = () => {
    const directReports = allOrgEmployees.filter(e => e.manager_id === manager.id)
    setExpanded(new Set(directReports.map(e => e.id)))
  }

  async function handleRefresh() {
    setRefreshing(true)
    const result = await getLiveCompletions(challenge.id)
    setRefreshing(false)
    if ('error' in result) { showToast('error', result.error); return }
    setCompletedIds(new Set(result.completedIds))
  }

  async function handleNudge(emp: Employee) {
    setNudgingId(emp.id)
    const result = await nudgeEmployeeAsManager(challenge.id, emp.id)
    setNudgingId(null)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${emp.first_name}`)
  }

  async function handleNudgeAll() {
    setNudgingAll(true)
    const result = await nudgeAllIncompleteAsManager(challenge.id)
    setNudgingAll(false)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${result.count} team member${result.count !== 1 ? 's' : ''}`)
  }

  const completedCount = subtree.filter(e => completedIds.has(e.id)).length
  const totalCount = subtree.length
  const pendingCount = totalCount - completedCount
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const sortedTiers = [...challenge.tiers].sort((a, b) => a.level - b.level)
  const individualTier = sortedTiers.find(t => t.is_individual)
  const enabledGroupTiers = sortedTiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const ds = challenge.status
  const STATUS_DETAIL_BADGE: Record<string, { cls: string; label: string }> = {
    active:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200', label: 'Active' },
    completed: { cls: 'bg-teal-50 text-teal-700 border border-teal-200',          label: 'Completed' },
    disabled:  { cls: 'bg-slate-100 text-slate-500',                              label: 'Disabled' },
    draft:     { cls: 'bg-gray-100 text-gray-500',                                label: 'Draft' },
  }
  const statusBadge = STATUS_DETAIL_BADGE[ds] ?? STATUS_DETAIL_BADGE.draft

  // Build tree from manager's direct reports
  const tree = useMemo(() => {
    const directReports = allOrgEmployees.filter(e => e.manager_id === manager.id)
    return directReports.map(dr => {
      function recurse(emp: Employee): EmployeeNode {
        return {
          ...emp,
          children: allOrgEmployees
            .filter(e => e.manager_id === emp.id)
            .sort((a, b) => a.full_name.localeCompare(b.full_name))
            .map(recurse),
        }
      }
      return recurse(dr)
    }).sort((a, b) => {
      // Managers first, then leaves
      const aHasChildren = a.children.length > 0 ? 0 : 1
      const bHasChildren = b.children.length > 0 ? 0 : 1
      if (aHasChildren !== bHasChildren) return aHasChildren - bHasChildren
      return a.full_name.localeCompare(b.full_name)
    })
  }, [allOrgEmployees, manager.id])

  return (
    <div className="space-y-4 relative">
      {/* Back nav + controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ChevronRight size={14} className="rotate-180" /> Back to challenges
        </button>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search employees…"
              className="pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs w-44 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button onClick={expandAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
        </div>
      </div>

      {/* Challenge header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`h-1 w-full ${ds === 'active' ? 'bg-emerald-400' : ds === 'completed' ? 'bg-teal-400' : 'bg-slate-300'}`} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ds === 'active' ? 'bg-emerald-50' : ds === 'completed' ? 'bg-teal-50' : 'bg-gray-50'}`}>
              <Trophy size={18} className={ds === 'active' ? 'text-emerald-600' : ds === 'completed' ? 'text-teal-600' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-extrabold text-gray-900">{challenge.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge.cls}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{challenge.description}</p>
              {(challenge.start_date || challenge.due_date) && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                  <Calendar size={11} />
                  {challenge.start_date && <span>{challenge.start_date}</span>}
                  {challenge.start_date && challenge.due_date && <span className="text-gray-300">→</span>}
                  {challenge.due_date && <span>{challenge.due_date}</span>}
                </div>
              )}
            </div>
          </div>
          {maxPerEmployee > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl mt-1">
              <Coins size={13} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-indigo-700">Up to {fmt(maxPerEmployee)} tokens per person</span>
            </div>
          )}
        </div>
      </div>

      {/* Team progress summary */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">My Team's Progress</p>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-black text-gray-900 tabular-nums">{progressPct}%</span>
          <span className="text-sm text-gray-400">{completedCount} of {totalCount} completed</span>
        </div>
        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${ds === 'active' ? 'bg-emerald-500' : ds === 'completed' ? 'bg-teal-500' : 'bg-slate-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Nudge All banner — active + has pending people */}
      {isActive && pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3.5 bg-[#1e3a5f] rounded-2xl shadow-sm">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{pendingCount} team member{pendingCount !== 1 ? 's' : ''} yet to complete</p>
            <p className="text-[11px] text-white/60 mt-0.5">Send a reminder to everyone who hasn't finished yet</p>
          </div>
          <button
            onClick={handleNudgeAll}
            disabled={nudgingAll}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-amber-900 px-3.5 py-2 rounded-xl transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {nudgingAll ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
            Nudge All
          </button>
        </div>
      )}

      {/* Hierarchical team list — manager row first, then direct reports */}
      {filteredBySearch ? (
        filteredBySearch.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            No team members match &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden space-y-0">
            {filteredBySearch.map(emp => (
              <PersonRow
                key={emp.id}
                emp={emp}
                done={completedIds.has(emp.id)}
                isActive={isActive}
                levelConfigs={levelConfigs}
                onNudge={handleNudge}
                nudging={nudgingId === emp.id}
              />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {/* Manager (you) as a participant */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${completedIds.has(manager.id) ? 'bg-emerald-50/20' : ''}`}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
                style={{ background: levelColor(manager.level) }}
              >
                {manager.first_name[0]}{manager.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-gray-900 truncate">{manager.full_name} <span className="text-[11px] font-normal text-indigo-500">(You)</span></p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {getLabel(manager.level)}
                  {manager.team_name && <span className="text-gray-400 font-medium"> · {manager.team_name}</span>}
                </p>
              </div>
              {completedIds.has(manager.id) ? (
                <div className="flex items-center gap-1.5 flex-shrink-0 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100/50">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span className="text-[11px] font-bold text-emerald-600">Done</span>
                </div>
              ) : (
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">Pending</span>
              )}
            </div>
          </div>

          {tree.map(node => (
            node.children.length > 0 ? (
              <TeamGroupCard
                key={node.id}
                node={node}
                completedIds={completedIds}
                isActive={isActive}
                levelConfigs={levelConfigs}
                onNudge={handleNudge}
                nudgingId={nudgingId}
                expanded={expanded}
                onToggle={toggleExpanded}
              />
            ) : (
              <div key={node.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <PersonRow
                  emp={node}
                  done={completedIds.has(node.id)}
                  isActive={isActive}
                  levelConfigs={levelConfigs}
                  onNudge={handleNudge}
                  nudging={nudgingId === node.id}
                />
              </div>
            )
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

type ChallengeSubTab = 'mine' | 'others' | 'all'
type ChallengeStatusFilter = 'all' | 'active' | 'draft' | 'completed' | 'disabled'

// ─── Challenges tab (list + detail navigation) ────────────────────────────────
function ManagerChallengesTab({
  employee,
  challenges: initialChallenges,
  challengeCompletions,
  allOrgEmployees,
  levelConfigs,
  managerBudget,
}: {
  employee: Employee
  challenges: ChallengeWithTiers[]
  challengeCompletions: { challenge_id: string; employee_id: string }[]
  allOrgEmployees: Employee[]
  levelConfigs: OrgLevelConfig[]
  managerBudget: number | null
}) {
  const [localChallenges, setLocalChallenges] = useState<ChallengeWithTiers[]>(initialChallenges)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<ChallengeWithTiers | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [subTab, setSubTab] = useState<ChallengeSubTab>('all')
  const [statusFilter, setStatusFilter] = useState<ChallengeStatusFilter>('all')

  const subtree = useMemo(() => {
    const self = allOrgEmployees.find(e => e.id === employee.id)
    const reports = getSubtree(employee.id, allOrgEmployees)
    return self ? [self, ...reports] : reports
  }, [employee.id, allOrgEmployees])

  const subtreeCount = subtree.length

  // Build tier configs from actual levels in subtree.
  // levelConfigs may not have an entry for every level (e.g. L3 employees exist but no L3 config row).
  // Synthesise a fallback config for any missing level so all subtree levels get a tier.
  const subtreeLevelConfigs = useMemo(() => {
    const distinctLevels = [...new Set(subtree.map(e => e.level))].sort((a, b) => a - b)
    return distinctLevels.map(level => {
      const existing = levelConfigs.find(c => c.level === level)
      return existing ?? {
        id: `synthetic-${level}`,
        organization_id: employee.organization_id,
        level,
        label: `L${level}`,
        created_at: '',
        updated_at: '',
      }
    })
  }, [subtree, levelConfigs, employee.organization_id])

  const managerChallengesReserved = useMemo(
    () => localChallenges
      .filter(c => c.manager_id === employee.id && (c.status === 'draft' || c.status === 'active'))
      .reduce((s, c) => s + c.token_budget, 0),
    [localChallenges, employee.id],
  )

  const availableForChallenges = (managerBudget ?? 0) - managerChallengesReserved

  const completionMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of challengeCompletions) {
      const s = map.get(c.challenge_id) ?? new Set<string>()
      s.add(c.employee_id)
      map.set(c.challenge_id, s)
    }
    return map
  }, [challengeCompletions])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(challengeId: string, action: 'publish' | 'end' | 'delete') {
    setActionLoadingId(challengeId)
    let result: { success?: true; error?: string }
    if (action === 'publish') result = await publishChallenge(challengeId)
    else if (action === 'end') result = await endChallenge(challengeId)
    else result = await deleteChallenge(challengeId)
    setActionLoadingId(null)

    if ('error' in result && result.error) { showToast('error', result.error); return }

    if (action === 'delete') {
      setLocalChallenges(prev => prev.filter(c => c.id !== challengeId))
      showToast('success', 'Challenge deleted')
    } else {
      const nextStatus = action === 'publish' ? 'active'
        : ('newStatus' in result ? result.newStatus : 'disabled')
      setLocalChallenges(prev => prev.map(c => c.id === challengeId ? { ...c, status: nextStatus as any } : c))
      showToast('success', action === 'publish' ? 'Challenge published' : 'Challenge ended')
    }
  }

  const displayChallenges = useMemo(() => {
    let list = localChallenges
    if (subTab === 'mine') list = list.filter(c => c.manager_id === employee.id)
    else if (subTab === 'others') list = list.filter(c => c.manager_id !== employee.id)
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter)
    }
    return list
  }, [localChallenges, subTab, statusFilter, employee.id])

  // ── Create / Edit sheet overlay ───────────────────────────────────────────────
  if (createSheetOpen || editingChallenge !== null) {
    return (
      <div className="flex flex-col h-full -mx-5 -my-4">
        <CreateChallengeSheet
          orgId={employee.organization_id}
          mode="manager"
          levelConfigs={subtreeLevelConfigs}
          totalEmployees={subtreeCount}
          availableTokens={editingChallenge
            ? availableForChallenges + editingChallenge.token_budget
            : availableForChallenges}
          initialChallenge={editingChallenge ?? undefined}
          onCreated={challenge => {
            setLocalChallenges(prev => [{ ...challenge, manager_id: employee.id }, ...prev])
            setCreateSheetOpen(false)
            showToast('success', 'Challenge created as draft')
          }}
          onUpdated={challenge => {
            setLocalChallenges(prev => prev.map(c => c.id === challenge.id ? challenge : c))
            setEditingChallenge(null)
            showToast('success', 'Challenge updated')
          }}
          onClose={() => {
            setCreateSheetOpen(false)
            setEditingChallenge(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3 relative">
      {/* Header row with create button */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {displayChallenges.length} challenge{displayChallenges.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setCreateSheetOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold transition-colors"
        >
          <Plus size={12} /> Create Challenge
        </button>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2">
        {/* Ownership tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {([['all', 'All'], ['mine', 'My Challenges'], ['others', 'Team Challenges']] as [ChallengeSubTab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSubTab(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                subTab === key ? 'bg-white shadow text-gray-900' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
              {key !== 'all' && (
                <span className={`ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  subTab === key ? 'bg-gray-100 text-gray-600' : 'bg-white/60 text-gray-400'
                }`}>
                  {key === 'mine'
                    ? localChallenges.filter(c => c.manager_id === employee.id).length
                    : localChallenges.filter(c => c.manager_id !== employee.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200" />

        {/* Status dropdown */}
        <div className="relative flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-xs font-semibold text-gray-600 cursor-pointer hover:border-gray-300 transition-colors">
          <Filter size={11} className="text-gray-400 flex-shrink-0" />
          <span className="text-gray-400 font-normal">Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as ChallengeStatusFilter)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          >
            <option value="all">All</option>
            <option value="active">Active ({localChallenges.filter(c => c.status === 'active').length})</option>
            <option value="draft">Draft ({localChallenges.filter(c => c.status === 'draft').length})</option>
            <option value="completed">Completed ({localChallenges.filter(c => c.status === 'completed').length})</option>
            <option value="disabled">Disabled ({localChallenges.filter(c => c.status === 'disabled').length})</option>
          </select>
          <span className={statusFilter === 'all' ? 'text-gray-600' : 'text-indigo-600 font-bold'}>
            {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </span>
          <ChevronRight size={11} className="text-gray-400 rotate-90 flex-shrink-0" />
        </div>
      </div>

      {displayChallenges.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
            <Trophy size={20} className="text-gray-300" />
          </div>
          {subTab === 'all' ? (
            <>
              <p className="text-sm font-semibold text-gray-400">No challenges yet</p>
              <p className="text-xs text-gray-300 mt-1">Active and ended challenges will appear here</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-400">No challenges here</p>
              <p className="text-xs text-gray-300 mt-1">
                {subTab === 'mine' ? "You haven't created any challenges yet." : 'No challenges from your team yet.'}
              </p>
            </>
          )}
        </div>
      ) : (
        displayChallenges.map(challenge => {
          const completedIds = completionMap.get(challenge.id) ?? new Set<string>()
          const isOwned = challenge.manager_id === employee.id

          // For subordinate-created challenges, scope the progress to the subordinate's
          // own subtree (not the current manager's full subtree) — the manager has
          // visibility only, and the count should reflect the challenge's actual scope.
          const isSubordinateChallenge =
            challenge.manager_id !== null &&
            !isOwned &&
            subtree.some(e => e.id === challenge.manager_id)

          const displayScope = isSubordinateChallenge
            ? (() => {
                const subMgr = allOrgEmployees.find(e => e.id === challenge.manager_id!)
                const reports = getSubtree(challenge.manager_id!, allOrgEmployees)
                return subMgr ? [subMgr, ...reports] : reports
              })()
            : subtree

          return (
            <ManagerChallengeCard
              key={challenge.id}
              challenge={challenge}
              completedCount={displayScope.filter(e => completedIds.has(e.id)).length}
              totalCount={displayScope.length}
              isOwned={isOwned}
              onAction={action => handleAction(challenge.id, action)}
              onEdit={() => setEditingChallenge(challenge)}
              actionLoading={actionLoadingId === challenge.id}
            />
          )
        })
      )}

      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  employee: Employee
  directReports: Employee[]
  levelConfigs: OrgLevelConfig[]
  organization: Organization
  managerBudget: number | null
  managerBudgetDate: string | null
  initialAllocations: EmployeeAllocation[]
  initialEmployeeTransactions?: EmployeeBudgetTransaction[]
  managerBudgetTransactions?: ManagerBudgetTransaction[]
  allOrgEmployees: Employee[]
  challenges: ChallengeWithTiers[]
  challengeCompletions: { challenge_id: string; employee_id: string }[]
  defaultTab?: string
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const MANAGER_TABS = ['team', 'challenges', 'budget'] as const
type ManagerTab = typeof MANAGER_TABS[number]

export default function ManagerView({
  employee, directReports, levelConfigs, organization,
  managerBudget, managerBudgetDate, initialAllocations,
  initialEmployeeTransactions = [],
  managerBudgetTransactions = [],
  allOrgEmployees, challenges, challengeCompletions, defaultTab,
}: Props) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const color = levelColor(employee.level)

  const router = useRouter()
  const validDefault = MANAGER_TABS.includes(defaultTab as ManagerTab) ? defaultTab as ManagerTab : 'team'
  const [tab, setTab] = useState<ManagerTab>(validDefault)

  function changeTab(next: ManagerTab) {
    setTab(next)
    window.history.replaceState(null, '', `?tab=${next}`)
  }
  const [tokenMap, setTokenMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialAllocations.forEach(a => { map[a.employee_id] = a.tokens })
    return map
  })
  const [employeeTransactions, setEmployeeTransactions] = useState<EmployeeBudgetTransaction[]>(initialEmployeeTransactions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')

  async function handleRefreshBudget() {
    setRefreshing(true)
    router.refresh()
    setTimeout(() => setRefreshing(false), 800)
  }

  const totalAllocated = Object.values(tokenMap).reduce((s, v) => s + v, 0)
  const remaining = managerBudget !== null ? managerBudget - totalAllocated : null
  const usedPct = managerBudget ? Math.min(100, (totalAllocated / managerBudget) * 100) : 0

  const teamTree = useMemo(
    () => directReports.map(dr => buildTree(allOrgEmployees, dr.id)[0]).filter(Boolean) as EmployeeNode[],
    [directReports, allOrgEmployees],
  )
  const subtreeEmployees = useMemo(
    () => getSubtree(employee.id, allOrgEmployees),
    [employee.id, allOrgEmployees],
  )
  const subtreeCount = subtreeEmployees.length

  const filteredTeam = useMemo(() => {
    if (!teamSearch.trim()) return null
    const q = teamSearch.toLowerCase()
    return subtreeEmployees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      (e.email ?? '').toLowerCase().includes(q)
    )
  }, [subtreeEmployees, teamSearch])
  const [teamExpanded, setTeamExpanded] = useState<Set<string>>(() => new Set())

  function toggleTeam(id: string) {
    setTeamExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        getSubtree(id, allOrgEmployees).forEach(e => next.delete(e.id))
      } else {
        next.add(id)
      }
      return next
    })
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave(employeeId: string, tokens: number) {
    const oldTokens = tokenMap[employeeId] ?? 0
    const delta = tokens - oldTokens
    const result = await allocateEmployeeBudget(
      employee.organization_id,
      employee.id,
      employeeId,
      tokens,
    )
    if (result.error) { showToast('error', result.error); throw new Error(result.error) }
    setTokenMap(prev => ({ ...prev, [employeeId]: tokens }))
    setEmployeeTransactions(prev => [{
      id: crypto.randomUUID(),
      organization_id: employee.organization_id,
      manager_id: employee.id,
      employee_id: employeeId,
      amount: delta,
      new_total: tokens,
      allocated_by: null,
      created_at: new Date().toISOString(),
    }, ...prev])
    showToast('success', delta > 0 ? 'Tokens allocated' : 'Tokens returned to your budget')
  }

  async function handleRemove(employeeId: string) {
    const result = await allocateEmployeeBudget(
      employee.organization_id,
      employee.id,
      employeeId,
      0,
    )
    if (result.error) { showToast('error', result.error); return }
    const oldTokens = tokenMap[employeeId] ?? 0
    setTokenMap(prev => { const n = { ...prev }; delete n[employeeId]; return n })
    if (oldTokens > 0) {
      setEmployeeTransactions(prev => [{
        id: crypto.randomUUID(),
        organization_id: employee.organization_id,
        manager_id: employee.id,
        employee_id: employeeId,
        amount: -oldTokens,
        new_total: 0,
        allocated_by: null,
        created_at: new Date().toISOString(),
      }, ...prev])
    }
    showToast('success', 'Allocation removed')
  }

  function openAllocate() { router.push('/dashboard/manager/budget/allocate') }
  function openEdit(r: Employee) { setEditingEmployee(r); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setEditingEmployee(null) }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden relative">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        {/* Manager identity */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
            style={{ background: color }}
          >
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-gray-900 leading-tight">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-[11px] text-gray-400">
              L{employee.level} · {getLabel(employee.level)}
              {employee.team_name && ` · ${employee.team_name}`}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Compact tab pills */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => changeTab('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'team'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Users size={12} /> My Team
            </button>
            <button
              onClick={() => changeTab('challenges')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'challenges'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Trophy size={12} /> Challenges
              {challenges.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  tab === 'challenges' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {challenges.length}
                </span>
              )}
            </button>
            <button
              onClick={() => changeTab('budget')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'budget'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Coins size={12} /> Budget
            </button>
          </div>

          {/* Refresh button — only in budget tab */}
          {tab === 'budget' && (
            <button
              onClick={handleRefreshBudget}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 ml-1"
              title="Refresh budget data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}

          {/* Allocate button — only in budget tab */}
          {tab === 'budget' && managerBudget !== null && managerBudget > 0 && directReports.length > 0 && (
            <button
              onClick={openAllocate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Plus size={12} /> Allocate
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50 p-5">
        <div className="max-w-2xl mx-auto space-y-4">

        {tab === 'challenges' && (
          <ManagerChallengesTab
            employee={employee}
            challenges={challenges}
            challengeCompletions={challengeCompletions}
            allOrgEmployees={allOrgEmployees}
            levelConfigs={levelConfigs}
            managerBudget={managerBudget}
          />
        )}

        {tab === 'budget' && (
          <>
            <ManagerBudgetTab
              managerBudget={managerBudget}
              managerBudgetDate={managerBudgetDate}
              managerId={employee.id}
              orgName={organization.name}
              challenges={challenges}
              employeeAllocations={initialAllocations}
              employeeTransactions={employeeTransactions}
              managerBudgetTransactions={managerBudgetTransactions}
              employees={allOrgEmployees}
              levelConfigs={levelConfigs}
            />

            {/* Team token allocations */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">
                  Team Allocations
                  <span className="text-gray-400 font-normal ml-1.5">({directReports.length})</span>
                </p>
                {managerBudget !== null && managerBudget > 0 && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {Object.keys(tokenMap).length} member{Object.keys(tokenMap).length !== 1 ? 's' : ''} have token allocations
                  </p>
                )}
              </div>
              {directReports.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No direct reports yet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {directReports.map(r => {
                    const allocated = tokenMap[r.id] ?? 0
                    const pct = managerBudget && allocated ? ((allocated / managerBudget) * 100).toFixed(0) : null
                    return (
                      <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 group hover:bg-gray-50/60 transition-colors">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                          style={{ background: levelColor(r.level) }}
                        >
                          {r.first_name[0]}{r.last_name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{r.full_name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {r.employee_id && <span className="font-mono mr-1.5">{r.employee_id}</span>}
                            L{r.level} · {getLabel(r.level)}
                            {r.team_name && ` · ${r.team_name}`}
                          </p>
                        </div>
                        {allocated > 0 ? (
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(allocated)}</p>
                            {pct && <p className="text-[11px] text-indigo-500 font-semibold">{pct}% of budget</p>}
                          </div>
                        ) : (
                          managerBudget !== null && managerBudget > 0 && (
                            <span className="text-[11px] text-gray-300 flex-shrink-0">No allocation</span>
                          )
                        )}
                        {managerBudget !== null && managerBudget > 0 && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => openEdit(r)}
                              title="Add / adjust tokens"
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                            >
                              <Plus size={13} />
                            </button>
                            {allocated > 0 && (
                              <button
                                onClick={() => handleRemove(r.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'team' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  My Team
                  <span className="text-gray-400 font-normal ml-1.5">({subtreeCount})</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {directReports.length} direct report{directReports.length !== 1 ? 's' : ''}
                  {subtreeCount > directReports.length && `, ${subtreeCount - directReports.length} subordinate${subtreeCount - directReports.length !== 1 ? 's' : ''} below`}
                </p>
              </div>
              <div className="relative flex-shrink-0">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs w-52 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
                />
                {teamSearch && (
                  <button
                    onClick={() => setTeamSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {!teamSearch && subtreeCount > directReports.length && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setTeamExpanded(new Set(subtreeEmployees.map(e => e.id)))}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Expand all
                  </button>
                  <button
                    onClick={() => setTeamExpanded(new Set())}
                    className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    Collapse
                  </button>
                </div>
              )}
            </div>
            {directReports.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No direct reports yet</p>
            ) : filteredTeam ? (
              filteredTeam.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No team members match &ldquo;{teamSearch}&rdquo;</p>
              ) : (
                <div>
                  {filteredTeam.map(emp => (
                    <TeamTreeNode
                      key={emp.id}
                      node={{ ...emp, children: [] }}
                      levelConfigs={levelConfigs}
                      depth={0}
                      expanded={teamExpanded}
                      onToggle={toggleTeam}
                    />
                  ))}
                </div>
              )
            ) : (
              <div>
                {teamTree.map(node => (
                  <TeamTreeNode
                    key={node.id}
                    node={node}
                    levelConfigs={levelConfigs}
                    depth={0}
                    expanded={teamExpanded}
                    onToggle={toggleTeam}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        </div>
      </div>

      {/* ── Side sheet ──────────────────────────────────────────────────────── */}
      {sheetOpen && managerBudget !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            onClick={closeSheet}
          />
          <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {editingEmployee ? `Adjust · ${editingEmployee.first_name}` : 'Allocate Tokens'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {fmt(managerBudget - totalAllocated + (editingEmployee ? (tokenMap[editingEmployee.id] ?? 0) : 0))} tokens available
                </p>
              </div>
              <button
                onClick={closeSheet}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <AllocateSheet
              reports={directReports}
              levelConfigs={levelConfigs}
              managerBudget={managerBudget}
              currentAllocations={tokenMap}
              editingEmployee={editingEmployee}
              onSave={handleSave}
              onClose={closeSheet}
            />
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
