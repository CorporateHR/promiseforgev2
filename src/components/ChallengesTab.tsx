'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Trophy, Plus, X, CheckCircle2, AlertCircle, Loader2,
  Calendar, Coins, ChevronRight, Users, Zap, Pencil, Filter, RefreshCw,
} from 'lucide-react'
import { publishChallenge, endChallenge, deleteChallenge } from '@/app/actions/challenges'
import CreateChallengeSheet from './CreateChallengeSheet'
import type { Employee, OrgLevelConfig, ChallengeWithTiers, ManagerBudget, ChallengeCompletion } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  draft:     { cls: 'bg-gray-100 text-gray-500',                                    label: 'Draft' },
  active:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',     label: 'Active' },
  completed: { cls: 'bg-emerald-100 text-emerald-800 border border-emerald-400',    label: 'Completed' },
  disabled:  { cls: 'bg-slate-100 text-slate-400 border border-slate-200',          label: 'Disabled' },
}

function StatusBadge({ status }: { status: string }) {
  const { cls, label } = STATUS_BADGE[status]
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
      {label}
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
  isOwned,
}: {
  challenge: ChallengeWithTiers
  completedCount: number
  totalEmployees: number
  onAction: (action: 'publish' | 'end' | 'delete' | 'edit' | 'view') => void
  loading: boolean
  isOwned?: boolean
}) {
  const progressPct = totalEmployees > 0 ? Math.round((completedCount / totalEmployees) * 100) : 0
  const ds = challenge.status

  const individualTier = challenge.tiers.find(t => t.is_individual)
  const enabledGroupTiers = challenge.tiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const accentLine = { active: 'bg-emerald-400', draft: 'bg-gray-200', completed: 'bg-emerald-500', disabled: 'bg-slate-200' }[ds]
  const iconBg     = { active: 'bg-emerald-50',  draft: 'bg-gray-50',  completed: 'bg-emerald-100', disabled: 'bg-gray-50'  }[ds]
  const iconColor  = { active: 'text-emerald-600', draft: 'text-gray-400', completed: 'text-emerald-700', disabled: 'text-gray-300' }[ds]
  const barColor   = { active: 'bg-emerald-500', draft: 'bg-gray-300', completed: 'bg-emerald-500', disabled: 'bg-slate-300' }[ds]

  return (
    <div className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow overflow-hidden ${ds === 'disabled' ? 'border-gray-100 opacity-75' : 'border-gray-100'}`}>
      {/* Top accent line */}
      <div className={`h-1 w-full ${accentLine}`} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <Trophy size={16} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-bold truncate ${ds === 'disabled' ? 'text-gray-500' : 'text-gray-900'}`}>{challenge.title}</p>
              <StatusBadge status={ds} />
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
        {ds !== 'draft' && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[11px] text-gray-500">
                <Users size={10} /> {completedCount} / {totalEmployees} completed
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

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {challenge.status === 'draft' && (
            <>
              <button
                onClick={() => onAction('publish')}
                disabled={loading}
                title="Publish challenge"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                Publish
              </button>
              <button
                onClick={() => onAction('edit')}
                disabled={loading}
                title="Edit challenge"
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => onAction('delete')}
                disabled={loading}
                title="Delete challenge"
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
                title="View progress"
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors"
              >
                <ChevronRight size={11} /> View Progress
              </button>
              <button
                onClick={() => onAction('end')}
                disabled={loading}
                title="End challenge"
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 size={11} className="animate-spin" /> : 'End'}
              </button>
            </>
          )}
          {(challenge.status === 'completed' || challenge.status === 'disabled') && (
            <button
              onClick={() => onAction('view')}
              title="View results"
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
  currentUserId?: string
}

// ─── Main ─────────────────────────────────────────────────────────────────────
type SubTab = 'mine' | 'team' | 'all'
type StatusFilter = 'all' | 'active' | 'draft' | 'completed' | 'disabled'

export default function ChallengesTab({
  orgId, employees, levelConfigs, totalBudget,
  initialChallenges, initialManagerBudgets, initialCompletions,
  currentUserId,
}: Props) {
  const router = useRouter()
  const [challenges, setChallenges] = useState(initialChallenges)
  const [completions, setCompletions] = useState(initialCompletions)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingChallenge, setEditingChallenge] = useState<ChallengeWithTiers | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Sync when server re-passes fresh data (after router.refresh())
  useEffect(() => { setCompletions(initialCompletions) }, [initialCompletions])
  useEffect(() => { setChallenges(initialChallenges) }, [initialChallenges])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [subTab, setSubTab] = useState<SubTab>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    await new Promise(r => setTimeout(r, 800))
    setRefreshing(false)
  }

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
      .filter(c => c.status === 'draft' || c.status === 'active')
      .reduce((s, c) => s + c.token_budget, 0)
    return Math.max(0, totalBudget - managerUsed - challengeUsed)
  }, [totalBudget, initialManagerBudgets, challenges])

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleAction(
    challenge: ChallengeWithTiers,
    action: 'publish' | 'end' | 'delete' | 'edit' | 'view',
  ) {
    if (action === 'view') {
      router.push(`/dashboard/admin/challenges/${challenge.id}`)
      return
    }
    if (action === 'edit') {
      setEditingChallenge(challenge)
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
      const newStatus = action === 'publish' ? 'active'
        : ('newStatus' in result ? result.newStatus : 'disabled')
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

  function handleUpdated(c: ChallengeWithTiers) {
    setChallenges(prev => prev.map(ch => ch.id === c.id ? c : ch))
    setEditingChallenge(null)
    showToast('success', 'Challenge updated')
  }

  const displayChallenges = useMemo(() => {
    let list = challenges
    if (subTab === 'mine') list = list.filter(c => currentUserId && c.created_by === currentUserId)
    else if (subTab === 'team') list = list.filter(c => !currentUserId || c.created_by !== currentUserId)
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter)
    }
    return list
  }, [challenges, subTab, statusFilter, currentUserId])

  const active    = displayChallenges.filter(c => c.status === 'active').length
  const draft     = displayChallenges.filter(c => c.status === 'draft').length
  const completed = challenges.filter(c => c.status === 'completed').length
  const disabled  = challenges.filter(c => c.status === 'disabled').length

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Full-page edit form ── */}
      {editingChallenge && (
        <CreateChallengeSheet
          orgId={orgId}
          levelConfigs={levelConfigs}
          totalEmployees={employees.length}
          availableTokens={availableTokens + editingChallenge.token_budget}
          initialChallenge={editingChallenge}
          onCreated={handleCreated}
          onUpdated={handleUpdated}
          onClose={() => setEditingChallenge(null)}
        />
      )}

      {/* ── Full-page create form ── */}
      {!editingChallenge && sheetOpen && (
        <CreateChallengeSheet
          orgId={orgId}
          levelConfigs={levelConfigs}
          totalEmployees={employees.length}
          availableTokens={availableTokens}
          onCreated={handleCreated}
          onClose={() => setSheetOpen(false)}
        />
      )}

      {/* ── Challenge list (hidden when creating or editing) ── */}
      {!sheetOpen && !editingChallenge && (
        <>
          {/* Toolbar */}
          <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">Challenges</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {active} active · {draft} draft · {displayChallenges.length} shown
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
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh completion data"
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  Refresh
                </button>
                <button
                  onClick={() => setSheetOpen(true)}
                  className="flex items-center gap-1.5 text-sm font-bold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3.5 py-2 rounded-xl transition-colors active:scale-95"
                >
                  <Plus size={14} /> New Challenge
                </button>
              </div>
            </div>
            {/* Filters row */}
            <div className="flex items-center gap-2">
              {/* Ownership tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {([['all', 'All'], ['mine', 'My Challenges'], ['team', 'Team Challenges']] as [SubTab, string][]).map(([key, label]) => (
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
                          ? challenges.filter(c => currentUserId && c.created_by === currentUserId).length
                          : challenges.filter(c => !currentUserId || c.created_by !== currentUserId).length}
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
                  onChange={e => setStatusFilter(e.target.value as StatusFilter)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                >
                  <option value="all">All</option>
                  <option value="active">Active ({challenges.filter(c => c.status === 'active').length})</option>
                  <option value="draft">Draft ({challenges.filter(c => c.status === 'draft').length})</option>
                  <option value="completed">Completed ({completed})</option>
                  <option value="disabled">Disabled ({disabled})</option>
                </select>
                <span className={statusFilter === 'all' ? 'text-gray-600' : 'text-indigo-600 font-bold'}>
                  {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </span>
                <ChevronRight size={11} className="text-gray-400 rotate-90 flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {displayChallenges.length === 0 ? (
              subTab === 'all'
                ? <EmptyState onNew={() => setSheetOpen(true)} />
                : (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                    <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                      <Trophy size={28} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-bold text-gray-700">No challenges here</p>
                    <p className="text-xs text-gray-400 mt-1.5">
                      {subTab === 'mine' ? 'You haven\'t created any challenges yet.' : 'No challenges created by your team yet.'}
                    </p>
                  </div>
                )
            ) : (
              <div className="grid grid-cols-1 gap-3 max-w-3xl mx-auto">
                {displayChallenges.map(c => (
                  <ChallengeCard
                    key={c.id}
                    challenge={c}
                    completedCount={completionMap.get(c.id)?.size ?? 0}
                    totalEmployees={employees.length}
                    onAction={action => handleAction(c, action)}
                    loading={actionLoading === c.id}
                    isOwned={!!(currentUserId && c.created_by === currentUserId)}
                  />
                ))}
              </div>
            )}
          </div>
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
