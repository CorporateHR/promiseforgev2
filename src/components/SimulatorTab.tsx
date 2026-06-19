'use client'

import { useState, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { FlaskConical, Users, CheckCircle2, Clock, ChevronRight, Trophy } from 'lucide-react'
import SimulatorChallengeView from './SimulatorChallengeView'
import type { ChallengeWithTiers, Employee, OrgLevelConfig } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

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
      <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <Trophy size={15} className="text-emerald-500" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate mb-1">{challenge.title}</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400 flex-shrink-0 tabular-nums w-8 text-right">
            {pct}%
          </span>
        </div>
      </div>

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
  onCompletionsChange?: (completions: { challenge_id: string; employee_id: string }[]) => void
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SimulatorTab({
  challenges, employees, levelConfigs, initialCompletions, onCompletionsChange,
}: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [completions, setCompletions] = useState(initialCompletions)

  const initialChallenge = useMemo(() => {
    const id = searchParams.get('challenge')
    return id ? (challenges.find(c => c.id === id) ?? null) : null
  }, [])  // intentionally empty deps — only read once on mount

  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeWithTiers | null>(initialChallenge)

  function selectChallenge(c: ChallengeWithTiers) {
    setSelectedChallenge(c)
    window.history.replaceState(null, '', `${pathname}?challenge=${c.id}`)
  }

  function goBack() {
    setSelectedChallenge(null)
    window.history.replaceState(null, '', pathname)
  }

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
    const existing = new Set(
      completions.filter(c => c.challenge_id === challengeId).map(c => c.employee_id)
    )
    const next = [
      ...completions,
      ...employeeIds.filter(id => !existing.has(id)).map(id => ({ challenge_id: challengeId, employee_id: id })),
    ]
    setCompletions(next)
    onCompletionsChange?.(next)
  }

  function handleCompletionRemoved(challengeId: string, employeeIds: string[]) {
    const removed = new Set(employeeIds)
    const next = completions.filter(c => !(c.challenge_id === challengeId && removed.has(c.employee_id)))
    setCompletions(next)
    onCompletionsChange?.(next)
  }

  function getScopedCount(challenge: ChallengeWithTiers): number {
    if (!challenge.manager_id) return employees.length
    let count = 1
    const queue = [challenge.manager_id]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const reports = employees.filter(e => e.manager_id === id)
      count += reports.length
      queue.push(...reports.map(r => r.id))
    }
    return count
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Header — only on the challenge list ── */}
      {!selectedChallenge && (
        <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
            {fmt(employees.length)} participants
          </div>
        </div>
      )}

      {/* ── Challenge list ── */}
      {!selectedChallenge && (
        <div className="flex-1 overflow-y-auto">
          {challenges.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <FlaskConical size={28} className="text-gray-200 mb-3" />
              <p className="text-sm font-semibold text-gray-400">No active challenges to simulate</p>
              <p className="text-xs text-gray-300 mt-1">Activate a challenge first from the Challenges tab</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {challenges.map(c => (
                <ChallengeRow
                  key={c.id}
                  challenge={c}
                  completedCount={completionMap.get(c.id)?.size ?? 0}
                  totalEmployees={getScopedCount(c)}
                  onClick={() => selectChallenge(c)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Hierarchical challenge view ── */}
      {selectedChallenge && (
        <SimulatorChallengeView
          challenge={selectedChallenge}
          employees={employees}
          levelConfigs={levelConfigs}
          completedIds={completionMap.get(selectedChallenge.id) ?? new Set()}
          onBack={goBack}
          onCompletionAdded={handleCompletionAdded}
          onCompletionRemoved={handleCompletionRemoved}
        />
      )}
    </div>
  )
}
