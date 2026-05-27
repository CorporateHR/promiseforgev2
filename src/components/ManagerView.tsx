'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Building2, Coins, Plus, X, Search,
  Pencil, Trash2, CheckCircle2, AlertCircle, Loader2, ChevronRight,
  Trophy, Calendar, RefreshCw, Bell, ChevronDown,
} from 'lucide-react'
import { allocateEmployeeBudget } from '@/app/actions/budget'
import { getLiveCompletions } from '@/app/actions/challenges'
import { nudgeEmployeeAsManager, nudgeAllIncompleteAsManager } from '@/app/actions/simulator'
import type { Employee, OrgLevelConfig, Organization, EmployeeAllocation, ChallengeWithTiers, EmployeeNode } from '@/lib/types'

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
  const [value, setValue] = useState(
    editingEmployee ? String(currentAllocations[editingEmployee.id] ?? '') : ''
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalAllocated = Object.values(currentAllocations).reduce((s, v) => s + v, 0)
  const otherAllocated = selected
    ? totalAllocated - (currentAllocations[selected.id] ?? 0)
    : totalAllocated
  const available = managerBudget - otherAllocated
  const inputTokens = parseInt(value) || 0
  const isOver = inputTokens > available

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
    if (!selected || !inputTokens || isOver) return
    setSaving(true)
    setError(null)
    try {
      await onSave(selected.id, inputTokens)
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
                onClick={() => { setSelected(r); setValue(allocated ? String(allocated) : ''); setStep('amount') }}
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

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Selected employee card */}
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-gray-50">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
              style={{ background: levelColor(selected.level) }}
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

          {/* Budget available */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">Your available budget</p>
              <p className="text-lg font-black text-gray-900 tabular-nums">{fmt(available)} tk</p>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, (otherAllocated / managerBudget) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400">
              {fmt(otherAllocated)} of {fmt(managerBudget)} allocated to others
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
                autoFocus={!!editingEmployee}
                type="number"
                min="0"
                max={available}
                value={value}
                onChange={e => { setValue(e.target.value); setError(null) }}
                placeholder="0"
                className="flex-1 bg-transparent text-xl font-black text-gray-800 outline-none placeholder-gray-300 tabular-nums"
              />
              <span className="text-sm text-gray-400 font-semibold">tokens</span>
            </div>
            {isOver && (
              <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                <AlertCircle size={11} /> Exceeds your budget by {fmt(inputTokens - available)} tokens
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
                  disabled={n > available}
                  onClick={() => setValue(String(n))}
                  className="py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
            </div>
            {available > 0 && (
              <button
                onClick={() => setValue(String(available))}
                className="w-full mt-2 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-bold text-gray-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Use all available · {fmt(available)} tokens
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
            disabled={saving || !inputTokens || isOver}
            className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : <><Coins size={14} /> Allocate</>}
          </button>
        </div>
      </div>
    )
  }

  return null
}

// ─── Manager challenge card (read-only, scoped progress) ─────────────────────
function ManagerChallengeCard({
  challenge,
  completedCount,
  totalCount,
}: {
  challenge: ChallengeWithTiers
  completedCount: number
  totalCount: number
}) {
  const router = useRouter()
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const individualTier = challenge.tiers.find(t => t.is_individual)
  const enabledGroupTiers = challenge.tiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const statusBadgeStyle = (({
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    ended:  'bg-slate-100 text-slate-500',
    draft:  'bg-gray-100 text-gray-500',
  } as Record<string, string>)[challenge.status]) ?? 'bg-gray-100 text-gray-500'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className={`h-1 w-full ${challenge.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300'}`} />
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            challenge.status === 'active' ? 'bg-emerald-50' : 'bg-gray-50'
          }`}>
            <Trophy size={16} className={challenge.status === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">{challenge.title}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusBadgeStyle}`}>
                {challenge.status}
              </span>
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

        {/* Progress (scoped to manager's subtree) */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <Users size={10} /> {completedCount} / {totalCount} my team completed
            </span>
            <span className="text-[11px] font-bold text-gray-700">{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${challenge.status === 'ended' ? 'bg-slate-400' : 'bg-emerald-500'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tier pills */}
        <div className="flex flex-wrap gap-1 mb-3">
          {challenge.tiers
            .filter(t => t.enabled || t.is_individual)
            .sort((a, b) => a.level - b.level)
            .map(t => (
              <span key={t.level} className="text-[9px] font-bold text-gray-500 bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded-md">
                L{t.level} {t.is_individual ? `${fmt(t.base_tokens)}tk` : `+${fmt(t.bonus_tokens)}@${t.threshold_pct}%`}
              </span>
            ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push(`/dashboard/manager/challenges/${challenge.id}`)}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            challenge.status === 'active'
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
              : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
          }`}
        >
          <ChevronRight size={11} />
          {challenge.status === 'active' ? 'View Progress' : 'View Results'}
        </button>
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

  const statusBadgeStyle = (({
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    ended:  'bg-slate-100 text-slate-500',
    draft:  'bg-gray-100 text-gray-500',
  } as Record<string, string>)[challenge.status]) ?? 'bg-gray-100 text-gray-500'

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
        <div className={`h-1 w-full ${isActive ? 'bg-emerald-400' : 'bg-slate-300'}`} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <Trophy size={18} className={isActive ? 'text-emerald-600' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-base font-extrabold text-gray-900">{challenge.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadgeStyle}`}>
                  {challenge.status}
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
            className={`h-full rounded-full transition-all duration-500 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
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

      {/* Hierarchical team list */}
      <div className="space-y-3">
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

// ─── Challenges tab (list + detail navigation) ────────────────────────────────
function ManagerChallengesTab({
  employee,
  challenges,
  challengeCompletions,
  allOrgEmployees,
  levelConfigs,
}: {
  employee: Employee
  challenges: ChallengeWithTiers[]
  challengeCompletions: { challenge_id: string; employee_id: string }[]
  allOrgEmployees: Employee[]
  levelConfigs: OrgLevelConfig[]
}) {

  const subtree = useMemo(
    () => getSubtree(employee.id, allOrgEmployees),
    [employee.id, allOrgEmployees],
  )

  const completionMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of challengeCompletions) {
      const s = map.get(c.challenge_id) ?? new Set<string>()
      s.add(c.employee_id)
      map.set(c.challenge_id, s)
    }
    return map
  }, [challengeCompletions])

  // ── List view ────────────────────────────────────────────────────────────────
  if (challenges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
          <Trophy size={20} className="text-gray-300" />
        </div>
        <p className="text-sm font-semibold text-gray-400">No challenges yet</p>
        <p className="text-xs text-gray-300 mt-1">Active and ended challenges will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {challenges.map(challenge => {
        const completedIds = completionMap.get(challenge.id) ?? new Set<string>()
        return (
          <ManagerChallengeCard
            key={challenge.id}
            challenge={challenge}
            completedCount={subtree.filter(e => completedIds.has(e.id)).length}
            totalCount={subtree.length}
          />
        )
      })}
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
  initialAllocations: EmployeeAllocation[]
  allOrgEmployees: Employee[]
  challenges: ChallengeWithTiers[]
  challengeCompletions: { challenge_id: string; employee_id: string }[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManagerView({
  employee, directReports, levelConfigs, organization,
  managerBudget, initialAllocations,
  allOrgEmployees, challenges, challengeCompletions,
}: Props) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const color = levelColor(employee.level)

  const [tab, setTab] = useState<'team' | 'challenges'>('team')
  const [tokenMap, setTokenMap] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    initialAllocations.forEach(a => { map[a.employee_id] = a.tokens })
    return map
  })
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const totalAllocated = Object.values(tokenMap).reduce((s, v) => s + v, 0)
  const remaining = managerBudget !== null ? managerBudget - totalAllocated : null
  const usedPct = managerBudget ? Math.min(100, (totalAllocated / managerBudget) * 100) : 0

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleSave(employeeId: string, tokens: number) {
    const result = await allocateEmployeeBudget(
      employee.organization_id,
      employee.id,
      employeeId,
      tokens,
    )
    if (result.error) { showToast('error', result.error); throw new Error(result.error) }
    setTokenMap(prev => ({ ...prev, [employeeId]: tokens }))
    showToast('success', 'Tokens allocated')
  }

  async function handleRemove(employeeId: string) {
    const result = await allocateEmployeeBudget(
      employee.organization_id,
      employee.id,
      employeeId,
      0,
    )
    if (result.error) { showToast('error', result.error); return }
    setTokenMap(prev => { const n = { ...prev }; delete n[employeeId]; return n })
    showToast('success', 'Allocation removed')
  }

  function openAllocate() { setEditingEmployee(null); setSheetOpen(true) }
  function openEdit(r: Employee) { setEditingEmployee(r); setSheetOpen(true) }
  function closeSheet() { setSheetOpen(false); setEditingEmployee(null) }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6 relative">
      <div className="max-w-2xl mx-auto space-y-5">
            {/* Org badge */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Building2 size={14} className="text-indigo-500" />
              <span className="font-semibold text-gray-700">{organization.name}</span>
            </div>

            {/* Manager identity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="h-2 w-full" style={{ background: color }} />
              <div className="px-6 py-4 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-sm"
                  style={{ background: color }}
                >
                  {employee.first_name[0]}{employee.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-gray-900">
                      {employee.first_name} {employee.last_name}
                    </span>
                    <span
                      className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
                      style={{ background: color }}
                    >
                      L{employee.level} · {getLabel(employee.level)}
                    </span>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-gray-50">
                      Manager
                    </span>
                  </div>
                  {employee.team_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-400 mt-0.5">
                      <Users size={12} /> {employee.team_name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1 flex gap-1">
              <button
                onClick={() => setTab('team')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tab === 'team'
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users size={14} /> My Team
              </button>
              <button
                onClick={() => setTab('challenges')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  tab === 'challenges'
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Trophy size={14} /> Challenges
                {challenges.length > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    tab === 'challenges' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-600'
                  }`}>
                    {challenges.length}
                  </span>
                )}
              </button>
            </div>

        {tab === 'challenges' && (
          <ManagerChallengesTab
            employee={employee}
            challenges={challenges}
            challengeCompletions={challengeCompletions}
            allOrgEmployees={allOrgEmployees}
            levelConfigs={levelConfigs}
          />
        )}

        {tab === 'team' && (
          <>

        {/* Budget card — only shown if budget was assigned */}
        {managerBudget !== null && managerBudget > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">My Token Budget</p>
              <Coins size={14} className="text-amber-500" />
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Assigned to me</p>
                <p className="text-xl font-black text-gray-900 tabular-nums">{fmt(managerBudget)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Allocated</p>
                <p className="text-xl font-black text-gray-900 tabular-nums">{fmt(totalAllocated)}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 mb-0.5">Remaining</p>
                <p className={`text-xl font-black tabular-nums ${remaining !== null && remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {remaining !== null ? fmt(Math.abs(remaining)) : '—'}
                </p>
              </div>
            </div>

            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">{usedPct.toFixed(0)}% distributed to team</p>
          </div>
        )}

        {/* Team + allocations */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">
                My Team
                <span className="text-gray-400 font-normal ml-1.5">({directReports.length})</span>
              </p>
              {managerBudget !== null && managerBudget > 0 && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {Object.keys(tokenMap).length} member{Object.keys(tokenMap).length !== 1 ? 's' : ''} have token allocations
                </p>
              )}
            </div>
            {managerBudget !== null && managerBudget > 0 && directReports.length > 0 && (
              <button
                onClick={openAllocate}
                className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3.5 py-2 rounded-xl transition-colors active:scale-95"
              >
                <Plus size={14} /> Allocate
              </button>
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

                    {/* Token badge */}
                    {allocated > 0 ? (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(allocated)}</p>
                        {pct && <p className="text-[11px] text-indigo-500 font-semibold">{pct}% of your budget</p>}
                      </div>
                    ) : (
                      managerBudget !== null && managerBudget > 0 && (
                        <span className="text-[11px] text-gray-300 flex-shrink-0">No allocation</span>
                      )
                    )}

                    {/* Row actions */}
                    {managerBudget !== null && managerBudget > 0 && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button
                          onClick={() => openEdit(r)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors"
                        >
                          <Pencil size={13} />
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
      </div>

      {/* ── Side sheet ──────────────────────────────────────────────────────── */}
      {sheetOpen && managerBudget !== null && (
        <>
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            onClick={closeSheet}
          />
          <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {editingEmployee ? `Edit · ${editingEmployee.first_name}` : 'Allocate Tokens'}
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
