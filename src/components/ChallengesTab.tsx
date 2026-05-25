'use client'

import { useState, useMemo } from 'react'
import {
  Trophy, Plus, X, CheckCircle2, AlertCircle, Loader2,
  Calendar, Coins, ChevronRight, Users, Zap,
} from 'lucide-react'
import { publishChallenge, endChallenge, deleteChallenge } from '@/app/actions/challenges'
import CreateChallengeSheet from './CreateChallengeSheet'
import ChallengeDetailSheet from './ChallengeDetailSheet'
import type { Employee, OrgLevelConfig, ChallengeWithTiers, ManagerBudget, ChallengeCompletion } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

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

// ─── Challenge card ───────────────────────────────────────────────────────────
function ChallengeCard({
  challenge,
  completedCount,
  totalEmployees,
  onAction,
  loading,
}: {
  challenge: ChallengeWithTiers
  completedCount: number
  totalEmployees: number
  onAction: (action: 'publish' | 'end' | 'delete' | 'view') => void
  loading: boolean
}) {
  const progressPct = totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0

  const individualTier = challenge.tiers.find(t => t.is_individual)
  const enabledGroupTiers = challenge.tiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Top accent line per status */}
      <div className={`h-1 w-full ${
        challenge.status === 'active' ? 'bg-emerald-400' :
        challenge.status === 'ended'  ? 'bg-slate-300' :
                                         'bg-gray-200'
      }`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
            challenge.status === 'active' ? 'bg-emerald-50' : 'bg-gray-50'
          }`}>
            <Trophy size={16} className={challenge.status === 'active' ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900 truncate">{challenge.title}</p>
              <StatusBadge status={challenge.status} />
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
          <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
            <Coins size={9} />
            {fmt(challenge.token_budget)} reserved
          </span>
          {maxPerEmployee > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              <Zap size={9} />
              up to {fmt(maxPerEmployee)} / person
            </span>
          )}
        </div>

        {/* Progress (active + ended) */}
        {challenge.status !== 'draft' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Users size={10} /> {completedCount} / {totalEmployees} completed
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
        )}

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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {challenge.status === 'draft' && (
            <>
              <button
                onClick={() => onAction('publish')}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Publish
              </button>
              <button
                onClick={() => onAction('delete')}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold transition-colors disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
          {challenge.status === 'active' && (
            <>
              <button
                onClick={() => onAction('view')}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
              >
                <ChevronRight size={11} /> View Progress
              </button>
              <button
                onClick={() => onAction('end')}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : 'End'}
              </button>
            </>
          )}
          {challenge.status === 'ended' && (
            <button
              onClick={() => onAction('view')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-bold transition-colors border border-gray-200"
            >
              <ChevronRight size={11} /> View Results
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
        <Trophy size={28} className="text-indigo-300" />
      </div>
      <p className="text-sm font-bold text-gray-700">No challenges yet</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs">
        Create your first challenge to motivate your team and track completion across the organisation.
      </p>
      <button
        onClick={onNew}
        className="mt-5 flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-bold rounded-xl transition-colors"
      >
        <Plus size={14} /> Create First Challenge
      </button>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  orgId: string
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  totalBudget: number | null
  initialChallenges: ChallengeWithTiers[]
  initialManagerBudgets: ManagerBudget[]
  initialCompletions: ChallengeCompletion[]
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChallengesTab({
  orgId, employees, levelConfigs, totalBudget,
  initialChallenges, initialManagerBudgets, initialCompletions,
}: Props) {
  const [challenges, setChallenges] = useState(initialChallenges)
  const [completions, setCompletions] = useState(initialCompletions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [detailChallenge, setDetailChallenge] = useState<ChallengeWithTiers | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Build a map: challengeId → Set of completed employeeIds
  const completionMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const c of completions) {
      const s = map.get(c.challenge_id) ?? new Set<string>()
      s.add(c.employee_id)
      map.set(c.challenge_id, s)
    }
    return map
  }, [completions])

  // Available tokens for new challenges
  const availableTokens = useMemo(() => {
    if (totalBudget === null) return 0
    const managerUsed = initialManagerBudgets.reduce((s, b) => s + b.tokens, 0)
    const challengeUsed = challenges
      .filter(c => c.status !== 'ended')
      .reduce((s, c) => s + c.token_budget, 0)
    return Math.max(0, totalBudget - managerUsed - challengeUsed)
  }, [totalBudget, initialManagerBudgets, challenges])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(
    challenge: ChallengeWithTiers,
    action: 'publish' | 'end' | 'delete' | 'view',
  ) {
    if (action === 'view') {
      setDetailChallenge(challenge)
      return
    }

    setActionLoading(challenge.id)
    let result: { success?: true; error?: string }

    if (action === 'publish') result = await publishChallenge(challenge.id)
    else if (action === 'end')  result = await endChallenge(challenge.id)
    else                         result = await deleteChallenge(challenge.id)

    setActionLoading(null)

    if (result.error) { showToast('error', result.error); return }

    if (action === 'delete') {
      setChallenges(prev => prev.filter(c => c.id !== challenge.id))
      showToast('success', 'Challenge deleted')
    } else {
      const newStatus = action === 'publish' ? 'active' : 'ended'
      setChallenges(prev => prev.map(c =>
        c.id === challenge.id ? { ...c, status: newStatus as any } : c
      ))
      showToast('success', action === 'publish' ? 'Challenge published!' : 'Challenge ended')
    }
  }

  function handleCreated(c: ChallengeWithTiers) {
    setChallenges(prev => [c, ...prev])
    setSheetOpen(false)
    showToast('success', 'Challenge created as draft')
  }

  const active = challenges.filter(c => c.status === 'active').length
  const draft  = challenges.filter(c => c.status === 'draft').length

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Challenge list (hidden when creating) ── */}
      {!sheetOpen && (
        <>
          {/* Toolbar */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="text-sm font-bold text-gray-900">Challenges</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {active} active · {draft} draft · {challenges.length} total
              </p>
            </div>
            <div className="flex items-center gap-2">
              {totalBudget !== null && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg">
                  <Coins size={12} className="text-amber-500" />
                  {fmt(availableTokens)} available
                </div>
              )}
              <button
                onClick={() => setSheetOpen(true)}
                className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3.5 py-2 rounded-xl transition-colors active:scale-95"
              >
                <Plus size={14} /> New Challenge
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {challenges.length === 0 ? (
              <EmptyState onNew={() => setSheetOpen(true)} />
            ) : (
              <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto">
                {challenges.map(c => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    completedCount={completionMap.get(c.id)?.size ?? 0}
                    totalEmployees={employees.length}
                    onAction={action => handleAction(c, action)}
                    loading={actionLoading === c.id}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Full-page create form ── */}
      {sheetOpen && (
        <CreateChallengeSheet
          orgId={orgId}
          levelConfigs={levelConfigs}
          totalEmployees={employees.length}
          availableTokens={availableTokens}
          onCreated={handleCreated}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* Detail sheet */}
      {detailChallenge && (
        <>
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-10"
            onClick={() => setDetailChallenge(null)}
          />
          <ChallengeDetailSheet
            challenge={detailChallenge}
            employees={employees}
            levelConfigs={levelConfigs}
            completedEmployeeIds={completionMap.get(detailChallenge.id) ?? new Set()}
            onClose={() => setDetailChallenge(null)}
          />
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
