'use client'

import { useState } from 'react'
import { X, Trophy, Calendar, Users, Coins, Zap, CheckCircle2, Clock, RefreshCw, AlertCircle } from 'lucide-react'
import { getLiveCompletions } from '@/app/actions/challenges'
import type { ChallengeWithTiers, Employee, OrgLevelConfig } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

// ─── Walk org hierarchy to find ancestor at a given level ────────────────────
function getAncestorAtLevel(
  employeeId: string,
  targetLevel: number,
  all: Employee[],
): string | null {
  let cur: Employee | undefined = all.find(e => e.id === employeeId)
  while (cur) {
    if (cur.level === targetLevel) return cur.id
    if (!cur.manager_id) return null
    cur = all.find(e => e.id === cur!.manager_id)
  }
  return null
}

function groupByAncestor(
  employees: Employee[],
  tierLevel: number,
): Map<string, Employee[]> {
  const groups = new Map<string, Employee[]>()
  for (const emp of employees) {
    const ancestorId = getAncestorAtLevel(emp.id, tierLevel, employees)
    if (!ancestorId) continue
    const g = groups.get(ancestorId) ?? []
    g.push(emp)
    groups.set(ancestorId, g)
  }
  return groups
}

interface Props {
  challenge: ChallengeWithTiers
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  completedEmployeeIds: Set<string>
  onClose: () => void
}

export default function ChallengeDetailSheet({
  challenge, employees, levelConfigs, completedEmployeeIds, onClose,
}: Props) {
  const [completedIds, setCompletedIds] = useState(completedEmployeeIds)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    const result = await getLiveCompletions(challenge.id)
    setRefreshing(false)
    if ('error' in result) { setRefreshError(result.error); return }
    setCompletedIds(new Set(result.completedIds))
  }

  // Use local state instead of prop directly
  const completedEmployeeIdsLocal = completedIds

  const sortedTiers = [...challenge.tiers].sort((a, b) => a.level - b.level)
  const individualTier = sortedTiers.find(t => t.is_individual)
  const groupTiers = sortedTiers.filter(t => !t.is_individual && t.enabled)

  const totalEmployees = employees.length
  const completedCount = completedEmployeeIdsLocal.size
  const progressPct = totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0

  const maxPerEmployee =
    (individualTier?.base_tokens ?? 0) +
    groupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  const statusColor = {
    draft: 'text-gray-500 bg-gray-100',
    active: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    ended: 'text-slate-600 bg-slate-100',
  }[challenge.status] ?? 'text-gray-500 bg-gray-100'

  return (
    <div className="absolute inset-y-0 right-0 w-[460px] bg-white border-l border-gray-100 shadow-2xl z-20 flex flex-col">

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
            challenge.status === 'active' ? 'bg-emerald-50' : 'bg-gray-50'
          }`}>
            <Trophy size={15} className={challenge.status === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">{challenge.title}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize mt-1 inline-block ${statusColor}`}>
              {challenge.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh completion status"
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {refreshError && (
        <div className="flex items-center gap-2 px-5 py-2 bg-red-50 border-b border-red-100 text-xs text-red-600">
          <AlertCircle size={11} /> {refreshError}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* Description */}
        <div className="bg-gray-50 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-gray-700 leading-relaxed">{challenge.description}</p>
          {(challenge.start_date || challenge.due_date) && (
            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
              <Calendar size={11} className="text-gray-400" />
              {challenge.start_date && <span>{challenge.start_date}</span>}
              {challenge.start_date && challenge.due_date && <span className="text-gray-300">→</span>}
              {challenge.due_date && <span>{challenge.due_date}</span>}
            </div>
          )}
        </div>

        {/* Overall progress (active / ended only) */}
        {challenge.status !== 'draft' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Overall Progress</p>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-3xl font-black text-gray-900 tabular-nums">{progressPct}%</span>
              <span className="text-sm text-gray-400">{completedCount} of {totalEmployees} completed</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  challenge.status === 'ended' ? 'bg-slate-400' : 'bg-emerald-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tier breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Token Tiers</p>
            {maxPerEmployee > 0 && (
              <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">
                Up to {fmt(maxPerEmployee)} tokens per employee
              </p>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {sortedTiers.map(tier => {
              // Per-tier group progress (for non-individual tiers)
              const groups = !tier.is_individual && challenge.status !== 'draft'
                ? groupByAncestor(employees, tier.level)
                : null

              const groupsHit = groups
                ? Array.from(groups.values()).filter(group => {
                    const completed = group.filter(e => completedEmployeeIdsLocal.has(e.id)).length
                    return group.length > 0 && (completed / group.length) * 100 >= (tier.threshold_pct ?? 0)
                  }).length
                : 0

              const totalGroups = groups ? groups.size : 0

              return (
                <div
                  key={tier.level}
                  className={`px-4 py-3.5 ${(!tier.enabled && !tier.is_individual) ? 'opacity-40' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                      style={{ background: levelColor(tier.level) }}
                    >
                      L{tier.level}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-gray-800">{tier.label}</p>
                        <span className={`text-xs font-black flex-shrink-0 ${
                          tier.is_individual ? 'text-gray-700' : 'text-indigo-600'
                        }`}>
                          {tier.is_individual
                            ? `${fmt(tier.base_tokens)} base`
                            : tier.enabled ? `+${fmt(tier.bonus_tokens)} bonus` : 'disabled'
                          }
                        </span>
                      </div>

                      {!tier.is_individual && tier.enabled && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {tier.threshold_pct}% of group must complete to unlock
                        </p>
                      )}
                      {tier.is_individual && (
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          Awarded to each person who completes
                        </p>
                      )}

                      {/* Group progress bars */}
                      {groups && groups.size > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {Array.from(groups.entries()).map(([ancestorId, group]) => {
                            const ancestor = employees.find(e => e.id === ancestorId)
                            const done = group.filter(e => completedEmployeeIdsLocal.has(e.id)).length
                            const pct = Math.round((done / group.length) * 100)
                            const hit = pct >= (tier.threshold_pct ?? 0)
                            return (
                              <div key={ancestorId}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] text-gray-500 truncate max-w-[160px]">
                                    {ancestor?.full_name ?? 'Group'}
                                  </span>
                                  <span className={`text-[10px] font-bold ${hit ? 'text-emerald-600' : 'text-gray-400'}`}>
                                    {done}/{group.length} {hit && '✓'}
                                  </span>
                                </div>
                                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${hit ? 'bg-emerald-500' : 'bg-indigo-300'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                          <p className="text-[10px] text-gray-400 mt-1">
                            {groupsHit} of {totalGroups} group{totalGroups !== 1 ? 's' : ''} hit threshold
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Budget reserved */}
        <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl">
          <div className="flex items-center gap-2">
            <Coins size={13} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">Token budget reserved</span>
          </div>
          <span className="text-xs font-black text-amber-800">{fmt(challenge.token_budget)}</span>
        </div>

      </div>
    </div>
  )
}
