'use client'

import { useMemo } from 'react'
import { Coins, Trophy, CheckCircle2, XCircle, Zap, Users } from 'lucide-react'
import type { Employee, OrgLevelConfig, ChallengeWithTiers } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface EarnedEntry {
  challenge_id: string
  completed_at: string
  challenge: ChallengeWithTiers
}

interface Props {
  employee: Employee
  earnedEntries: EarnedEntry[]
  allChallengeCompletions: { challenge_id: string; employee_id: string }[]
  allOrgEmployees: Employee[]
  levelConfigs: OrgLevelConfig[]
}

// ─── Shared tier logic — mirrors EmployeeChallengeDetail exactly ──────────────

function getAncestorAtLevel(employeeId: string, targetLevel: number, all: Employee[]): string | null {
  let cur: Employee | undefined = all.find(e => e.id === employeeId)
  while (cur) {
    if (cur.level === targetLevel) return cur.id
    if (!cur.manager_id) return null
    cur = all.find(e => e.id === cur!.manager_id)
  }
  return null
}

function isUnder(employeeId: string, ancestorId: string, all: Employee[]): boolean {
  let cur: Employee | undefined = all.find(e => e.id === employeeId)
  while (cur) {
    if (cur.id === ancestorId) return true
    if (!cur.manager_id) return false
    cur = all.find(e => e.id === cur!.manager_id)
  }
  return false
}

function getRelevantGroup(employee: Employee, tierLevel: number, allEmployees: Employee[]): Employee[] {
  const ancestorId = getAncestorAtLevel(employee.id, tierLevel, allEmployees)
  if (ancestorId) {
    return allEmployees.filter(e => getAncestorAtLevel(e.id, tierLevel, allEmployees) === ancestorId)
  }
  let cur: Employee | undefined = allEmployees.find(e => e.id === employee.id)
  while (cur) {
    const curId = cur.id
    const hasLevelDescendant = allEmployees.some(
      e => e.level === tierLevel && e.id !== curId && isUnder(e.id, curId, allEmployees),
    )
    if (hasLevelDescendant) {
      return allEmployees.filter(
        e => isUnder(e.id, curId, allEmployees) &&
             getAncestorAtLevel(e.id, tierLevel, allEmployees) !== null,
      )
    }
    if (!cur.manager_id) break
    cur = allEmployees.find(e => e.id === cur!.manager_id)
  }
  return allEmployees.filter(e => getAncestorAtLevel(e.id, tierLevel, allEmployees) !== null)
}

type TierState = 'earned' | 'pending' | 'not_earned'

function calcTierState(
  tier: ChallengeWithTiers['tiers'][number],
  employee: Employee,
  allEmployees: Employee[],
  completedSet: Set<string>,
): TierState {
  if (tier.is_individual) return completedSet.has(employee.id) ? 'earned' : 'not_earned'
  if (!tier.enabled) return 'not_earned'
  const group = getRelevantGroup(employee, tier.level, allEmployees)
  if (group.length === 0) return 'pending'
  if (group.length === 1 && group[0].id === employee.id) return 'not_earned'
  const done = group.filter(e => completedSet.has(e.id)).length
  const pct = (done / group.length) * 100
  if (pct >= (tier.threshold_pct ?? 0) && completedSet.has(employee.id)) return 'earned'
  return 'pending'
}

// ─── Per-challenge earnings calc ──────────────────────────────────────────────
function scopedEmployees(challenge: ChallengeWithTiers, allOrgEmployees: Employee[]): Employee[] {
  if (!challenge.manager_id) return allOrgEmployees
  const mgr = allOrgEmployees.find(e => e.id === challenge.manager_id)
  const result: Employee[] = mgr ? [mgr] : []
  const queue = [challenge.manager_id]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    const reports = allOrgEmployees.filter(e => e.manager_id === id)
    result.push(...reports)
    queue.push(...reports.map(r => r.id))
  }
  return result
}

export function computeEarnings(
  entry: EarnedEntry,
  employee: Employee,
  allCompletions: { challenge_id: string; employee_id: string }[],
  allOrgEmployees: Employee[],
): { individual: number; groupBonuses: { label: string; amount: number; state: TierState; pct: number }[]; total: number } {
  const { challenge } = entry
  const tiers = [...(challenge.tiers ?? [])].sort((a, b) => a.level - b.level)

  // Scope employees to the challenge's manager subtree (mirrors EmployeeChallengeDetail)
  const allEmployees = scopedEmployees(challenge, allOrgEmployees)

  const completedSet = new Set(
    allCompletions.filter(c => c.challenge_id === challenge.id).map(c => c.employee_id)
  )

  const individualTier = tiers.find(t => t.is_individual)
  const individual = individualTier && calcTierState(individualTier, employee, allEmployees, completedSet) === 'earned'
    ? (individualTier.base_tokens ?? 0)
    : 0

  const groupBonuses = tiers
    .filter(t => !t.is_individual && t.enabled)
    .map(t => {
      const state = calcTierState(t, employee, allEmployees, completedSet)
      return {
        label: t.label || `L${t.level}`,
        amount: t.bonus_tokens,
        state,
        pct: t.threshold_pct ?? 0,
      }
    })

  const bonusTotal = groupBonuses.filter(b => b.state === 'earned').reduce((s, b) => s + b.amount, 0)
  const total = individual + bonusTotal

  return { individual, groupBonuses, total }
}

// ─── Challenge earnings row ───────────────────────────────────────────────────
function ChallengeEarningRow({
  entry, employee, allCompletions, allOrgEmployees, levelConfigs,
}: {
  entry: EarnedEntry
  employee: Employee
  allCompletions: { challenge_id: string; employee_id: string }[]
  allOrgEmployees: Employee[]
  levelConfigs: OrgLevelConfig[]
}) {
  const { challenge } = entry
  const { individual, groupBonuses, total } = computeEarnings(
    entry, employee, allCompletions, allOrgEmployees,
  )
  const hasGroups = groupBonuses.length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 w-full bg-emerald-400" />
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <Trophy size={18} className="text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{challenge.title}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{fmtDate(entry.completed_at)}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <div className="flex items-center gap-1 text-base font-black text-emerald-600 tabular-nums">
              <Zap size={14} /> {fmt(total)} tokens
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
          {/* Group bonuses */}
          {hasGroups && groupBonuses.map((b, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {b.state === 'earned'
                  ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                  : b.state === 'pending'
                  ? <CheckCircle2 size={13} className="text-amber-400   flex-shrink-0" />
                  : <XCircle      size={13} className="text-gray-300    flex-shrink-0" />}
                <span className={`text-xs ${b.state === 'earned' ? 'text-gray-600' : b.state === 'pending' ? 'text-amber-700' : 'text-gray-400'}`}>
                  {b.label}
                  <span className="ml-1 text-gray-400">({b.pct}% threshold)</span>
                </span>
              </div>
              <span className={`text-xs font-bold tabular-nums ${
                b.state === 'earned'  ? 'text-emerald-700' :
                b.state === 'pending' ? 'text-amber-600'   :
                'text-gray-400'
              }`}>
                {b.state === 'earned'  ? `+${fmt(b.amount)} tokens` :
                 b.state === 'pending' ? `+${fmt(b.amount)} tokens — pending` :
                 `+${fmt(b.amount)} tokens — not met`}
              </span>
            </div>
          ))}

          {/* Individual reward — always last */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {individual > 0
                ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
                : <XCircle      size={13} className="text-gray-300    flex-shrink-0" />}
              <span className="text-xs text-gray-600">Individual completion</span>
            </div>
            <span className={`text-xs font-bold tabular-nums ${individual > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
              {individual > 0 ? `+${fmt(individual)} tokens` : `+${fmt(entry.challenge.tiers.find(t => t.is_individual)?.base_tokens ?? 0)} tokens — not earned`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function NoEarningsState() {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
        <Coins size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-bold text-gray-700">No earnings yet</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs">
        Complete challenges to start earning tokens. Your rewards will appear here.
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function EmployeeEarningsTab({
  employee, earnedEntries, allChallengeCompletions, allOrgEmployees, levelConfigs,
}: Props) {
  // Sort entries by completion date desc
  const sorted = useMemo(
    () => [...earnedEntries].sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    ),
    [earnedEntries],
  )

  const totalEarned = useMemo(
    () => sorted.reduce((sum, entry) => {
      const { total } = computeEarnings(entry, employee, allChallengeCompletions, allOrgEmployees)
      return sum + total
    }, 0),
    [sorted, employee, allChallengeCompletions, allOrgEmployees],
  )

  if (sorted.length === 0) return <NoEarningsState />

  return (
    <div className="space-y-4">

      {/* ── Total banner ── */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-80 mb-2">Total Earned</p>
        <div className="flex items-end gap-2">
          <p className="text-4xl font-black tabular-nums">{fmt(totalEarned)}</p>
          <p className="text-lg font-bold opacity-80 mb-0.5">tokens</p>
        </div>
        <p className="text-[11px] opacity-70 mt-1.5">
          From {sorted.length} challenge completion{sorted.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Per-challenge breakdown ── */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Challenge Breakdown</p>
        {sorted.map(entry => (
          <ChallengeEarningRow
            key={entry.challenge_id}
            entry={entry}
            employee={employee}
            allCompletions={allChallengeCompletions}
            allOrgEmployees={allOrgEmployees}
            levelConfigs={levelConfigs}
          />
        ))}
      </div>

    </div>
  )
}
