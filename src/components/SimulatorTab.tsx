'use client'

import { useState, useMemo } from 'react'
import { FlaskConical, Users, CheckCircle2, Clock, ChevronRight, Trophy } from 'lucide-react'
import SimulatorChallengeView from './SimulatorChallengeView'
import type { ChallengeWithTiers, Employee, OrgLevelConfig } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

type StatusFilter = 'all' | 'active' | 'draft' | 'ended'

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles = {
    draft:  'bg-gray-100 text-gray-500',
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    ended:  'bg-slate-100 text-slate-500',
  }[status] ?? 'bg-gray-100 text-gray-500'

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${styles}`}>
      {status}
    </span>
  )
}

// ─── Challenge row ────────────────────────────────────────────────────────────
function ChallengeRow({
  challenge,
  completedCount,
  totalEmployees,
  onClick,
}: {
  challenge: ChallengeWithTiers
  completedCount: number
  totalEmployees: number
  onClick: () => void
}) {
  const pct = totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0
  const pending = totalEmployees - completedCount

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      {/* Icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        challenge.status === 'active' ? 'bg-emerald-50' :
        challenge.status === 'ended' ? 'bg-slate-50' : 'bg-gray-50'
      }`}>
        <Trophy size={15} className={
          challenge.status === 'active' ? 'text-emerald-500' :
          challenge.status === 'ended' ? 'text-slate-400' : 'text-gray-300'
        } />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold text-gray-900 truncate">{challenge.title}</p>
          <StatusBadge status={challenge.status} />
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                challenge.status === 'ended' ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400 flex-shrink-0 tabular-nums w-8 text-right">
            {pct}%
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <CheckCircle2 size={10} />
            {fmt(completedCount)}
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 mt-0.5">
            <Clock size={10} />
            {fmt(pending)}
          </div>
        </div>
        <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  orgId: string
  challenges: ChallengeWithTiers[]
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  initialCompletions: { challenge_id: string; employee_id: string }[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SimulatorTab({
  challenges, employees, levelConfigs, initialCompletions,
}: Props) {
  const [completions, setCompletions] = useState(initialCompletions)
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithTiers | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Map: challengeId → Set of completed employeeIds
  const completionMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of completions) {
      const s = map.get(c.challenge_id) ?? new Set<string>()
      s.add(c.employee_id)
      map.set(c.challenge_id, s)
    }
    return map
  }, [completions])

  function handleCompletionAdded(challengeId: string, employeeIds: string[]) {
    setCompletions(prev => {
      const existing = new Set(
        prev.filter(c => c.challenge_id === challengeId).map(c => c.employee_id)
      )
      const newOnes = employeeIds
        .filter(id => !existing.has(id))
        .map(id => ({ challenge_id: challengeId, employee_id: id }))
      return [...prev, ...newOnes]
    })
  }

  const totalEmployees = employees.length
  const activeCount = challenges.filter(c => c.status === 'active').length
  const draftCount  = challenges.filter(c => c.status === 'draft').length
  const endedCount  = challenges.filter(c => c.status === 'ended').length
  const filtered    = challenges.filter(c => statusFilter === 'all' || c.status === statusFilter)

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Header + filters — only on the challenge list ── */}
      {!selectedChallenge && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
                <FlaskConical size={15} className="text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Simulator</p>
                <p className="text-[11px] text-gray-400">Admin-only · mark completions · send nudges</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500">
              <Users size={12} className="text-gray-400" />
              {fmt(totalEmployees)} participants
            </div>
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
            {([
              ['all',    `All (${challenges.length})`],
              ['active', `Active (${activeCount})`],
              ['draft',  `Draft (${draftCount})`],
              ['ended',  `Ended (${endedCount})`],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                  statusFilter === val
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Challenge list ── */}
      {!selectedChallenge && (
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <FlaskConical size={28} className="text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-400">No challenges to simulate</p>
              <p className="text-xs text-gray-300 mt-1">Create a challenge first from the Challenges tab</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(c => (
                <ChallengeRow
                  key={c.id}
                  challenge={c}
                  completedCount={completionMap.get(c.id)?.size ?? 0}
                  totalEmployees={totalEmployees}
                  onClick={() => setSelectedChallenge(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hierarchical challenge view — rendered directly as flex child so scroll works ── */}
      {selectedChallenge && (
        <SimulatorChallengeView
          challenge={selectedChallenge}
          employees={employees}
          levelConfigs={levelConfigs}
          completedIds={completionMap.get(selectedChallenge.id) ?? new Set()}
          onBack={() => setSelectedChallenge(null)}
          onCompletionAdded={handleCompletionAdded}
        />
      )}
    </div>
  )
}
