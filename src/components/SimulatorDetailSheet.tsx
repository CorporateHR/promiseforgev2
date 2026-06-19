'use client'

import { useState, useMemo } from 'react'
import {
  X, Search, CheckCircle2, Clock, Bell, BellRing,
  Loader2, Users, ChevronDown, AlertCircle,
} from 'lucide-react'
import {
  adminMarkCompletion,
  adminMarkAllCompletion,
  nudgeEmployee,
  nudgeAll,
} from '@/app/actions/simulator'
import type { ChallengeWithTiers, Employee, OrgLevelConfig } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

interface Props {
  challenge: ChallengeWithTiers
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  completedIds: Set<string>
  onClose: () => void
  onCompletionAdded: (challengeId: string, employeeIds: string[]) => void
}

type RowLoading = 'marking' | 'nudging' | null

export default function SimulatorDetailSheet({
  challenge, employees, levelConfigs, completedIds: initialCompleted,
  onClose, onCompletionAdded,
}: Props) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set(initialCompleted))
  const [rowLoading, setRowLoading] = useState<Record<string, RowLoading>>({})
  const [bulkLoading, setBulkLoading] = useState<'marking' | 'nudging' | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  const getLabel = (level: number) =>
    levelConfigs.find(c => c.level === level)?.label ?? `L${level}`

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const filtered = useMemo(() => {
    return employees
      .filter(e => {
        const matchSearch = search.trim() === '' ||
          e.full_name.toLowerCase().includes(search.toLowerCase()) ||
          (e.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (e.employee_id ?? '').toLowerCase().includes(search.toLowerCase())
        const done = completedIds.has(e.id)
        const matchFilter =
          filter === 'all' ? true :
          filter === 'done' ? done :
          !done
        return matchSearch && matchFilter
      })
      .sort((a, b) => {
        // Pending first, then by name
        const aDone = completedIds.has(a.id)
        const bDone = completedIds.has(b.id)
        if (aDone !== bDone) return aDone ? 1 : -1
        return a.full_name.localeCompare(b.full_name)
      })
  }, [employees, search, filter, completedIds])

  const pendingCount = employees.filter(e => !completedIds.has(e.id)).length
  const doneCount = completedIds.size

  // ── Mark single employee complete ──────────────────────────────────────────
  async function handleMark(employeeId: string) {
    setRowLoading(prev => ({ ...prev, [employeeId]: 'marking' }))
    const result = await adminMarkCompletion(challenge.id, employeeId)
    setRowLoading(prev => ({ ...prev, [employeeId]: null }))

    if ('error' in result) { showToast('error', result.error); return }

    setCompletedIds(prev => new Set([...prev, employeeId]))
    onCompletionAdded(challenge.id, [employeeId])
    showToast('success', 'Marked as complete')
  }

  // ── Nudge single employee ──────────────────────────────────────────────────
  async function handleNudge(employeeId: string) {
    setRowLoading(prev => ({ ...prev, [employeeId]: 'nudging' }))
    const result = await nudgeEmployee(challenge.id, employeeId)
    setRowLoading(prev => ({ ...prev, [employeeId]: null }))

    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', 'Nudge sent!')
  }

  // ── Mark ALL complete ──────────────────────────────────────────────────────
  async function handleMarkAll() {
    setBulkLoading('marking')
    const result = await adminMarkAllCompletion(challenge.id)
    setBulkLoading(null)

    if ('error' in result) { showToast('error', result.error); return }

    const allIds = employees.map(e => e.id)
    setCompletedIds(new Set(allIds))
    onCompletionAdded(challenge.id, allIds)
    showToast('success', `${result.count} employees marked complete`)
  }

  // ── Nudge ALL pending ──────────────────────────────────────────────────────
  async function handleNudgeAll() {
    setBulkLoading('nudging')
    const result = await nudgeAll(challenge.id)
    setBulkLoading(null)

    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${result.count} employees`)
  }

  const isActive = challenge.status === 'active'

  return (
    <div className="absolute inset-y-0 right-0 w-[500px] bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-black text-gray-900 truncate">{challenge.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                challenge.status === 'active'  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                (challenge.status === 'completed' || challenge.status === 'disabled') ? 'bg-slate-100 text-slate-500' :
                                                  'bg-gray-100 text-gray-500'
              }`}>
                {challenge.status}
              </span>
              <span className="text-[11px] text-gray-400">
                <span className="font-bold text-emerald-600">{doneCount}</span> done ·{' '}
                <span className="font-bold text-amber-600">{pendingCount}</span> pending
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: employees.length > 0 ? `${Math.round((doneCount / employees.length) * 100)}%` : '0%' }}
            />
          </div>
        </div>

        {/* Bulk actions — only for active challenges */}
        {isActive && (
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleNudgeAll}
              disabled={bulkLoading !== null || pendingCount === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bulkLoading === 'nudging'
                ? <><Loader2 size={11} className="animate-spin" /> Nudging…</>
                : <><BellRing size={11} /> Nudge All ({pendingCount})</>}
            </button>
            <button
              onClick={handleMarkAll}
              disabled={bulkLoading !== null || pendingCount === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bulkLoading === 'marking'
                ? <><Loader2 size={11} className="animate-spin" /> Marking…</>
                : <><CheckCircle2 size={11} /> Mark All Complete</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Search + filter ── */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-gray-50 flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
          <Search size={12} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-300 outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as any)}
            className="appearance-none text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 outline-none cursor-pointer"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* ── Participant list ── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Users size={24} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">No participants found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(emp => {
              const done = completedIds.has(emp.id)
              const loading = rowLoading[emp.id] ?? null

              return (
                <div
                  key={emp.id}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    done ? 'bg-emerald-50/40' : 'hover:bg-gray-50/80'
                  }`}
                >
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {done
                      ? <CheckCircle2 size={16} className="text-emerald-500" />
                      : <Clock size={16} className="text-gray-300" />}
                  </div>

                  {/* Employee info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-gray-900 truncate">{emp.full_name}</p>
                      <span
                        className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: levelColor(emp.level) }}
                      >
                        {getLabel(emp.level)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {emp.email ?? emp.employee_id ?? '—'}
                    </p>
                  </div>

                  {/* Actions — only for active challenges */}
                  {isActive && !done && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Nudge */}
                      <button
                        onClick={() => handleNudge(emp.id)}
                        disabled={loading !== null}
                        title="Nudge via email"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors disabled:opacity-40"
                      >
                        {loading === 'nudging'
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Bell size={11} />}
                      </button>

                      {/* Mark complete */}
                      <button
                        onClick={() => handleMark(emp.id)}
                        disabled={loading !== null}
                        title="Mark as complete"
                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors disabled:opacity-40"
                      >
                        {loading === 'marking'
                          ? <Loader2 size={11} className="animate-spin" />
                          : <CheckCircle2 size={11} />}
                      </button>
                    </div>
                  )}

                  {done && (
                    <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0">
                      Done
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white whitespace-nowrap ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={13} />
            : <AlertCircle size={13} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
