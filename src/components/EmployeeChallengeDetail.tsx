'use client'

import { useState } from 'react'
import {
  ArrowLeft, Trophy, Calendar, CheckCircle2, AlertCircle,
  Loader2, Layers, Target, RefreshCw,
} from 'lucide-react'
import { recordCompletion, getLiveCompletions } from '@/app/actions/challenges'
import type { ChallengeWithTiers, ChallengeTier, Employee } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

// ─── Ancestry walk — walks UP manager chain to find ancestor at exact level ────
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

// ─── Check if an employee is a descendant of (or equal to) a given ancestor ───
function isUnder(employeeId: string, ancestorId: string, all: Employee[]): boolean {
  let cur: Employee | undefined = all.find(e => e.id === employeeId)
  while (cur) {
    if (cur.id === ancestorId) return true
    if (!cur.manager_id) return false
    cur = all.find(e => e.id === cur!.manager_id)
  }
  return false
}

// ─── Find the relevant peer-group for a given tier level ──────────────────────
// Standard case: group = employees sharing the same ancestor at tierLevel.
// Fallback: if the employee's chain skips tierLevel (e.g. L4→L1→L0 with no L2),
//           walk UP to the nearest ancestor ABOVE tierLevel, then find all
//           employees AT tierLevel who sit under that ancestor.
function getRelevantGroup(
  employee: Employee,
  tierLevel: number,
  allEmployees: Employee[],
): Employee[] {
  // Standard path — employee has a direct ancestor at this level
  const ancestorId = getAncestorAtLevel(employee.id, tierLevel, allEmployees)
  if (ancestorId) {
    return allEmployees.filter(
      e => getAncestorAtLevel(e.id, tierLevel, allEmployees) === ancestorId,
    )
  }

  // Fallback — employee's chain skips tierLevel (e.g. Anasa at L4 with L2 reports,
  // but no L2 node in her own manager chain).
  //
  // Rule: walk UP from the employee and use the FIRST node whose sub-tree already
  // contains at least one member AT tierLevel. Starting from the employee themselves
  // means a manager with tier-level reports (like Anasa) becomes the pivot
  // immediately, giving group = Anasa + her L2 reports + all their reports.
  // A leaf employee with no reports walks up until it reaches a suitable ancestor.
  let cur: Employee | undefined = allEmployees.find(e => e.id === employee.id)
  while (cur) {
    const curId = cur.id
    const hasLevelDescendant = allEmployees.some(
      e => e.level === tierLevel && e.id !== curId && isUnder(e.id, curId, allEmployees),
    )
    if (hasLevelDescendant) {
      // Only include employees who themselves have a valid ancestor at tierLevel
      // (i.e. are at tierLevel or below). This mirrors the standard path which
      // naturally excludes above-tier employees via the ancestorId equality check.
      return allEmployees.filter(
        e => isUnder(e.id, curId, allEmployees) &&
             getAncestorAtLevel(e.id, tierLevel, allEmployees) !== null,
      )
    }
    if (!cur.manager_id) break
    cur = allEmployees.find(e => e.id === cur!.manager_id)
  }

  // Last resort — only employees who have a valid ancestor at tierLevel
  return allEmployees.filter(e => getAncestorAtLevel(e.id, tierLevel, allEmployees) !== null)
}

// ─── Determine per-tier earned state for this employee ────────────────────────
function calcTierState(
  tier: ChallengeTier,
  employee: Employee,
  allEmployees: Employee[],
  completedSet: Set<string>,
): 'earned' | 'pending' | 'not_earned' {
  if (tier.is_individual) {
    return completedSet.has(employee.id) ? 'earned' : 'not_earned'
  }
  if (!tier.enabled) return 'not_earned'
  const group = getRelevantGroup(employee, tier.level, allEmployees)
  if (group.length === 0) return 'pending'
  const done = group.filter(e => completedSet.has(e.id)).length
  const pct = (done / group.length) * 100
  const groupMet = pct >= (tier.threshold_pct ?? 0)
  // Both conditions required: employee must have completed AND group must hit threshold
  if (groupMet && completedSet.has(employee.id)) return 'earned'
  return 'pending'
}

// ─── Group info for a tier row ────────────────────────────────────────────────
function getTierGroupInfo(
  tier: ChallengeTier,
  employee: Employee,
  allEmployees: Employee[],
  completedSet: Set<string>,
) {
  if (tier.is_individual) {
    const done = completedSet.has(employee.id) ? 1 : 0
    return { groupSize: 1, doneInGroup: done, thresholdCount: 1 }
  }
  const group = getRelevantGroup(employee, tier.level, allEmployees)
  const doneInGroup = group.filter(e => completedSet.has(e.id)).length
  const thresholdCount = Math.ceil(group.length * (tier.threshold_pct ?? 0) / 100)
  return { groupSize: group.length, doneInGroup, thresholdCount }
}

// ─── Days remaining helper ────────────────────────────────────────────────────
function daysLabel(due_date: string | null): string | null {
  if (!due_date) return null
  const diff = Math.ceil(
    (new Date(due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return `${Math.abs(diff)} days ago`
  if (diff === 0) return 'Due today'
  return `${diff} days left`
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  challenge: ChallengeWithTiers
  employee: Employee
  allEmployees: Employee[]
  allCompletions: { challenge_id: string; employee_id: string; completed_at: string }[]
  onBack: () => void
  onComplete: (challengeId: string, employeeId: string, completedAt: string) => void
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function EmployeeChallengeDetail({
  challenge,
  employee,
  allEmployees,
  allCompletions,
  onBack,
  onComplete,
}: Props) {
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  // Override completions with live data after refresh
  const [liveCompletedIds, setLiveCompletedIds] = useState<Set<string> | null>(null)

  async function handleRefresh() {
    setRefreshing(true)
    const result = await getLiveCompletions(challenge.id)
    setRefreshing(false)
    if ('error' in result) return
    setLiveCompletedIds(new Set(result.completedIds))
  }

  // Build completed set for this challenge — use live data if available
  const completedSet = liveCompletedIds ?? new Set(
    allCompletions.filter(c => c.challenge_id === challenge.id).map(c => c.employee_id),
  )
  const myCompletion = allCompletions.find(
    c => c.challenge_id === challenge.id && c.employee_id === employee.id,
  )
  const isCompleted = !!myCompletion

  const sortedTiers = [...challenge.tiers].sort((a, b) => a.level - b.level)
  const individualTier = sortedTiers.find(t => t.is_individual)
  const groupTiers = sortedTiers.filter(t => !t.is_individual && t.enabled)

  // Max potential = base + all enabled group bonuses
  const maxPotential =
    (individualTier?.base_tokens ?? 0) +
    groupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  // Earned = sum of tokens from tiers in 'earned' state
  const earned = sortedTiers.reduce((sum, tier) => {
    const state = calcTierState(tier, employee, allEmployees, completedSet)
    if (state !== 'earned') return sum
    return sum + (tier.is_individual ? tier.base_tokens : tier.bonus_tokens)
  }, 0)

  // Scope label: highest-in-hierarchy group tier (lowest level number)
  const scopeLabel = sortedTiers.filter(t => !t.is_individual)[0]?.label ?? null

  // Days label
  const days = daysLabel(challenge.due_date)

  const statusStyle = {
    draft:  'text-gray-500 bg-gray-100',
    active: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
    ended:  'text-slate-500 bg-slate-100',
  }[challenge.status] ?? 'text-gray-500 bg-gray-100'

  async function handleMarkComplete() {
    setCompleting(true)
    setError(null)
    const result = await recordCompletion(challenge.id, employee.id)
    setCompleting(false)
    if ('error' in result) { setError(result.error); return }
    onComplete(challenge.id, employee.id, new Date().toISOString())
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className={`h-1 w-full ${challenge.status === 'active' ? 'bg-indigo-500' : challenge.status === 'ended' ? 'bg-slate-300' : 'bg-gray-200'}`} />
          <div className="p-5">
            {/* Top row: back + title + status + refresh */}
            <div className="flex items-start gap-3 mb-2">
              <button
                onClick={onBack}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 mt-0.5"
              >
                <ArrowLeft size={16} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-extrabold text-gray-900">{challenge.title}</h1>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusStyle}`}>
                    {challenge.status}
                  </span>
                </div>
                {scopeLabel && (
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                    <Layers size={11} className="text-indigo-400" />
                    <span className="font-medium">{scopeLabel}-wide Scope</span>
                  </div>
                )}
              </div>
            </div>

            {/* Date + days + CTA */}
            <div className="flex items-center justify-between gap-3 mt-3 pl-11">
              <div className="flex items-center gap-3 flex-wrap">
                {(challenge.start_date || challenge.due_date) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar size={11} className="text-gray-400" />
                    {challenge.start_date && <span>{challenge.start_date}</span>}
                    {challenge.start_date && challenge.due_date && (
                      <span className="text-gray-300 mx-0.5">→</span>
                    )}
                    {challenge.due_date && <span>{challenge.due_date}</span>}
                  </div>
                )}
                {days && (
                  <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    {days}
                  </span>
                )}
              </div>

              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 flex-shrink-0"
                title="Refresh group progress"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>

              {/* Completed chip or Mark Complete button */}
              {isCompleted ? (
                <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex-shrink-0">
                  <CheckCircle2 size={14} />
                  Completed
                </div>
              ) : challenge.status === 'active' ? (
                <button
                  onClick={handleMarkComplete}
                  disabled={completing}
                  className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {completing
                    ? <><Loader2 size={13} className="animate-spin" /> Marking…</>
                    : <><CheckCircle2 size={13} /> Mark Complete</>}
                </button>
              ) : null}
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-3 ml-11 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* ── Objective ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
            Objective
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{challenge.description}</p>
        </div>

        {/* ── Max Potential + Earned ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* Max Potential */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">
              <Trophy size={11} />
              Max Potential
            </div>
            <p className="text-4xl font-black text-indigo-700 tabular-nums">{fmt(maxPotential)}</p>
            <p className="text-[11px] text-indigo-400 mt-1.5">Maximum you can earn</p>
          </div>

          {/* Earned */}
          <div className={`border rounded-2xl p-5 text-center ${
            earned > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-gray-50 border-gray-100'
          }`}>
            <div className={`flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest mb-2 ${
              earned > 0 ? 'text-emerald-500' : 'text-gray-400'
            }`}>
              <CheckCircle2 size={11} />
              Earned
            </div>
            <p className={`text-4xl font-black tabular-nums ${
              earned > 0 ? 'text-emerald-600' : 'text-gray-400'
            }`}>{fmt(earned)}</p>
            <p className={`text-[11px] mt-1.5 ${earned > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
              Tokens earned so far
            </p>
          </div>
        </div>

        {/* ── Cascade Tiers ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <Layers size={13} className="text-indigo-400" />
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              Cascade Tiers
            </p>
          </div>

          <div className="divide-y divide-gray-50">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_1.6fr_1.4fr_auto_auto] gap-x-3 px-5 py-2 text-[9px] font-black text-gray-300 uppercase tracking-widest">
              <span>Level</span>
              <span>Requirement</span>
              <span>Progress</span>
              <span className="text-right">Bonus</span>
              <span className="text-right min-w-[56px]">Earned</span>
            </div>

            {sortedTiers.map(tier => {
              const state = calcTierState(tier, employee, allEmployees, completedSet)
              const { groupSize, doneInGroup, thresholdCount } = getTierGroupInfo(
                tier, employee, allEmployees, completedSet,
              )
              const progressPct = groupSize > 0 ? Math.min(100, Math.round((doneInGroup / groupSize) * 100)) : 0
              const thresholdMet = state === 'earned'
              const isDisabled = !tier.enabled && !tier.is_individual

              return (
                <div
                  key={tier.level}
                  className={`px-5 py-3.5 grid grid-cols-[1fr_1.6fr_1.4fr_auto_auto] gap-x-3 items-center ${
                    isDisabled ? 'opacity-40' : ''
                  } ${state === 'pending' ? 'bg-amber-50/50' : ''}`}
                >
                  {/* Level */}
                  <div className="flex items-center gap-2 min-w-0">
                    {tier.is_individual ? (
                      <span
                        className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{ background: levelColor(tier.level) }}
                      >
                        L{tier.level}
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-gray-800 truncate">{tier.label}</span>
                  </div>

                  {/* Requirement */}
                  <div className="min-w-0">
                    {tier.is_individual ? (
                      <p className="text-[11px] text-gray-500 leading-tight">
                        {groupSize}/{groupSize} {groupSize === 1 ? 'person needs' : 'people need'} {thresholdCount}
                      </p>
                    ) : (
                      <>
                        <p className="text-[11px] text-gray-600 font-semibold leading-tight">
                          {thresholdCount}/{groupSize} need to complete
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {tier.threshold_pct}% threshold
                        </p>
                      </>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            thresholdMet ? 'bg-emerald-500' : 'bg-indigo-400'
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold flex-shrink-0 tabular-nums ${
                        thresholdMet ? 'text-emerald-600' : 'text-gray-500'
                      }`}>
                        {doneInGroup}/{thresholdCount}
                      </span>
                    </div>
                  </div>

                  {/* Bonus */}
                  <div className="text-right">
                    <span className="text-xs font-black text-gray-600">
                      +{fmt(tier.is_individual ? tier.base_tokens : tier.bonus_tokens)}
                    </span>
                  </div>

                  {/* Earned */}
                  <div className="text-right min-w-[56px]">
                    {state === 'earned' ? (
                      <span className="text-xs font-black text-emerald-600">
                        +{fmt(tier.is_individual ? tier.base_tokens : tier.bonus_tokens)}
                      </span>
                    ) : state === 'pending' ? (
                      <span className="text-[10px] font-bold text-amber-600 leading-tight">
                        Group<br />pending
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 font-bold">—</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Your Status ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
            Your Status
          </p>
          {isCompleted ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-black text-emerald-700">Challenge Completed!</p>
                {myCompletion?.completed_at && (
                  <p className="text-xs text-emerald-500 mt-0.5">
                    Completed on {new Date(myCompletion.completed_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })} at {new Date(myCompletion.completed_at).toLocaleTimeString('en-US', {
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>
          ) : challenge.status === 'active' ? (
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <Target size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-600">Not yet completed</p>
                <p className="text-xs text-gray-400 mt-0.5">Mark as complete when you're done</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl">
              <AlertCircle size={18} className="text-gray-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-500">Challenge ended</p>
                <p className="text-xs text-gray-400 mt-0.5">This challenge is no longer accepting completions</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
