'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ChevronRight, Trophy, Calendar, CheckCircle2, RefreshCw,
  Loader2, ChevronDown, Users, Pencil, Trash2, AlertCircle, Search, X, Bell,
} from 'lucide-react'
import { getLiveCompletions, deleteChallenge, endChallenge, updateChallenge, updatePublishedChallengeInfo } from '@/app/actions/challenges'
import { nudgeEmployee, nudgeAll } from '@/app/actions/simulator'
import type { Employee, OrgLevelConfig, ChallengeWithTiers, EmployeeNode } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

function flatSubtree(node: EmployeeNode): Employee[] {
  const result: Employee[] = [node]
  for (const child of node.children) result.push(...flatSubtree(child))
  return result
}

interface Props {
  challenge: ChallengeWithTiers
  levelConfigs: OrgLevelConfig[]
  allEmployees: Employee[]
  initialCompletedIds: Set<string>
  isCreator?: boolean
}

export default function AdminChallengeDetailView({
  challenge,
  levelConfigs,
  allEmployees,
  initialCompletedIds,
  isCreator = false,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState(initialCompletedIds)
  const [refreshing, setRefreshing] = useState(false)
  const [localChallenge, setLocalChallenge] = useState(challenge)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    title: challenge.title,
    description: challenge.description,
    start_date: challenge.start_date ?? '',
    due_date: challenge.due_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [nudgingId, setNudgingId] = useState<string | null>(null)
  const [nudgingAll, setNudgingAll] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const topLevel = allEmployees.filter(e => !e.manager_id || !allEmployees.find(m => m.id === e.manager_id))
    return new Set(topLevel.map(e => e.id))
  })
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBySearch = searchQuery.trim()
    ? allEmployees.filter(e =>
        e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  const completedCount = allEmployees.filter(e => completedIds.has(e.id)).length
  const totalCount = allEmployees.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const ds = localChallenge.status  // 'draft' | 'active' | 'completed' | 'disabled'

  const canEdit = isCreator && (ds === 'active' || ds === 'completed')
  const canDelete = isCreator && ds === 'draft'
  const canEnd = isCreator && ds === 'active'

  function openEdit() {
    setEditForm({
      title: localChallenge.title,
      description: localChallenge.description,
      start_date: localChallenge.start_date ?? '',
      due_date: localChallenge.due_date ?? '',
    })
    setSaveError(null)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    const payload = {
      title: editForm.title,
      description: editForm.description,
      start_date: editForm.start_date || null,
      due_date: editForm.due_date || null,
    }
    const result = (localChallenge.status === 'active' || localChallenge.status === 'completed')
      ? await updatePublishedChallengeInfo(localChallenge.id, payload)
      : await updateChallenge(localChallenge.id, {
          ...payload,
          tiers: localChallenge.tiers.map(t => ({
            level: t.level,
            label: t.label,
            is_individual: t.is_individual,
            enabled: t.enabled,
            threshold_pct: t.threshold_pct ?? 100,
            base_tokens: t.base_tokens,
            bonus_tokens: t.bonus_tokens,
          })),
        })
    setSaving(false)
    if ('error' in result) { setSaveError(result.error); return }
    setLocalChallenge(prev => ({ ...prev, ...payload }))
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this challenge? This cannot be undone.')) return
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteChallenge(localChallenge.id)
    setDeleting(false)
    if ('error' in result) { setDeleteError(result.error); return }
    router.push('/dashboard/admin/challenges')
  }

  async function handleEnd() {
    if (!confirm('End this challenge? This cannot be undone.')) return
    setEnding(true)
    const result = await endChallenge(localChallenge.id)
    setEnding(false)
    if ('error' in result) { setDeleteError(result.error); return }
    setLocalChallenge(prev => ({ ...prev, status: result.newStatus }))
  }

  const getDescendantIds = (nodeId: string): string[] => {
    const descendants: string[] = []
    const children = allEmployees.filter(e => e.manager_id === nodeId)
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
        next.delete(id)
        const descendants = getDescendantIds(id)
        descendants.forEach(descId => next.delete(descId))
      } else {
        next.add(id)
      }
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(allEmployees.map(e => e.id)))
  const collapseAll = () => {
    const topLevel = allEmployees.filter(e => !e.manager_id || !allEmployees.find(m => m.id === e.manager_id))
    setExpanded(new Set(topLevel.map(e => e.id)))
  }

  async function handleRefresh() {
    setRefreshing(true)
    const result = await getLiveCompletions(localChallenge.id)
    setRefreshing(false)
    if ('error' in result) return
    setCompletedIds(new Set(result.completedIds))
  }

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleNudge(emp: Employee) {
    setNudgingId(emp.id)
    const result = await nudgeEmployee(localChallenge.id, emp.id)
    setNudgingId(null)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${emp.first_name}`)
  }

  async function handleNudgeAll() {
    setNudgingAll(true)
    const result = await nudgeAll(localChallenge.id)
    setNudgingAll(false)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${result.count} employee${result.count !== 1 ? 's' : ''}`)
  }

  const isActive = ds === 'active'
  const pendingCount = totalCount - completedCount

  const sortedTiers = [...localChallenge.tiers].sort((a, b) => a.level - b.level)
  const individualTier = sortedTiers.find(t => t.is_individual)
  const enabledGroupTiers = sortedTiers.filter(t => !t.is_individual && t.enabled)
  const maxPerEmployee = (individualTier?.base_tokens ?? 0) + enabledGroupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  const STATUS_BADGE: Record<string, string> = {
    active:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
    completed: 'bg-teal-50 text-teal-700 border border-teal-200',
    disabled:  'bg-slate-100 text-slate-500',
    draft:     'bg-gray-100 text-gray-500',
  }
  const statusBadgeStyle = STATUS_BADGE[ds] ?? 'bg-gray-100 text-gray-500'

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  // Build tree
  function buildTree(emp: Employee): EmployeeNode {
    return {
      ...emp,
      children: allEmployees
        .filter(e => e.manager_id === emp.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(buildTree),
    }
  }

  const topLevelEmployees = allEmployees.filter(e => !e.manager_id || !allEmployees.find(m => m.id === e.manager_id))
  const tree = topLevelEmployees.map(buildTree).sort((a, b) => {
    const aHasChildren = a.children.length > 0 ? 0 : 1
    const bHasChildren = b.children.length > 0 ? 0 : 1
    if (aHasChildren !== bHasChildren) return aHasChildren - bHasChildren
    return a.full_name.localeCompare(b.full_name)
  })

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/admin/challenges')}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronRight size={14} className="rotate-180" /> Back to challenges
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {canEdit && !editing && (
            <button
              onClick={openEdit}
              title="Edit challenge"
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-xl transition-colors"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
          {canEnd && (
            <button
              onClick={handleEnd}
              disabled={ending}
              title="End challenge"
              className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {ending ? <Loader2 size={12} className="animate-spin" /> : null}
              {ending ? 'Ending…' : 'End'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title="Delete challenge"
              className="flex items-center gap-1.5 text-xs font-bold text-red-500 hover:text-red-700 bg-white border border-red-200 hover:border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh completions"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-300 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search employees…"
              className="pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs w-48 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
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
          <button onClick={expandAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
        </div>
      </div>

      {deleteError && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
          <AlertCircle size={12} /> {deleteError}
        </div>
      )}

      {/* Challenge header */}
      <div className="bg-white mx-5 mt-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
        <div className={`h-1 w-full ${ds === 'active' ? 'bg-emerald-400' : ds === 'completed' ? 'bg-teal-400' : 'bg-slate-300'}`} />
        <div className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ds === 'active' ? 'bg-emerald-50' : ds === 'completed' ? 'bg-teal-50' : 'bg-gray-50'}`}>
              <Trophy size={18} className={ds === 'active' ? 'text-emerald-600' : ds === 'completed' ? 'text-teal-600' : 'text-gray-400'} />
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <div className="space-y-2">
                  <input
                    className="w-full text-sm font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Challenge title"
                  />
                  <textarea
                    className="w-full text-sm text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                    rows={2}
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description"
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1">
                      <Calendar size={11} className="text-gray-400 flex-shrink-0" />
                      <input
                        type="date"
                        className="text-xs text-gray-600 border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
                        value={editForm.start_date}
                        onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))}
                      />
                    </div>
                    <span className="text-gray-300 text-xs">→</span>
                    <div className="flex-1">
                      <input
                        type="date"
                        className="text-xs text-gray-600 border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 w-full"
                        value={editForm.due_date}
                        onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={11} className="animate-spin" /> : null}
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-base font-extrabold text-gray-900">{localChallenge.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusBadgeStyle}`}>
                      {ds}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{localChallenge.description}</p>
                  {(localChallenge.start_date || localChallenge.due_date) && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400">
                      <Calendar size={11} />
                      {localChallenge.start_date && <span>{localChallenge.start_date}</span>}
                      {localChallenge.start_date && localChallenge.due_date && <span>→</span>}
                      {localChallenge.due_date && <span>{localChallenge.due_date}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Users size={14} /> Overall Progress
              </span>
              <span className="text-sm font-bold text-gray-900">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${ds === 'disabled' ? 'bg-slate-400' : ds === 'completed' ? 'bg-teal-500' : 'bg-emerald-500'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{completedCount} of {totalCount} completed</span>
            </div>
          </div>

          {/* Tiers */}
          {maxPerEmployee > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedTiers
                .filter(t => t.enabled || t.is_individual)
                .map(t => (
                  <span key={t.level} className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
                    L{t.level} {t.is_individual ? `${fmt(t.base_tokens)}tokens` : `+${fmt(t.bonus_tokens)}@${t.threshold_pct}%`}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Nudge All banner */}
      {isActive && pendingCount > 0 && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3.5 bg-[#1e3a5f] rounded-2xl shadow-sm flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">{pendingCount} employee{pendingCount !== 1 ? 's' : ''} yet to complete</p>
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

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold text-white ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Organization tree */}
      <div className="flex-1 overflow-auto px-5 py-4">
        {filteredBySearch ? (
          filteredBySearch.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              No employees match &ldquo;{searchQuery}&rdquo;
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              {filteredBySearch.map(emp => (
                <PersonRow
                  key={emp.id}
                  emp={emp}
                  done={completedIds.has(emp.id)}
                  levelConfigs={levelConfigs}
                  isActive={isActive}
                  onNudge={handleNudge}
                  nudging={nudgingId === emp.id}
                />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {tree.map(node => (
              <TeamGroupCard
                key={node.id}
                node={node}
                completedIds={completedIds}
                levelConfigs={levelConfigs}
                expanded={expanded}
                onToggle={toggleExpanded}
                isActive={isActive}
                onNudge={handleNudge}
                nudgingId={nudgingId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Team group card component
function TeamGroupCard({
  node,
  completedIds,
  levelConfigs,
  expanded,
  onToggle,
  isActive = false,
  onNudge,
  nudgingId,
}: {
  node: EmployeeNode
  completedIds: Set<string>
  levelConfigs: OrgLevelConfig[]
  expanded: Set<string>
  onToggle: (id: string) => void
  isActive?: boolean
  onNudge?: (emp: Employee) => void
  nudgingId?: string | null
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
          ) : isActive && onNudge && (
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

      {isExpanded && hasChildren && (
        <div className="p-2 space-y-2">
          {node.children.map(child => (
            child.children.length > 0 ? (
              <TeamGroupCard
                key={child.id}
                node={child}
                completedIds={completedIds}
                levelConfigs={levelConfigs}
                expanded={expanded}
                onToggle={onToggle}
                isActive={isActive}
                onNudge={onNudge}
                nudgingId={nudgingId}
              />
            ) : (
              <PersonRow
                key={child.id}
                emp={child}
                done={completedIds.has(child.id)}
                levelConfigs={levelConfigs}
                isActive={isActive}
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

function PersonRow({
  emp,
  done,
  levelConfigs,
  isActive = false,
  onNudge,
  nudging = false,
}: {
  emp: Employee
  done: boolean
  levelConfigs: OrgLevelConfig[]
  isActive?: boolean
  onNudge?: (emp: Employee) => void
  nudging?: boolean
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
          {isActive && onNudge && (
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
