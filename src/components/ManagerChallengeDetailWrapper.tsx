'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ChevronRight, Trophy, Calendar, CheckCircle2, RefreshCw,
  Loader2, Bell, ChevronDown, Users,
} from 'lucide-react'
import { getLiveCompletions } from '@/app/actions/challenges'
import { nudgeEmployeeAsManager, nudgeAllIncompleteAsManager } from '@/app/actions/simulator'
import type { Employee, OrgLevelConfig, ChallengeWithTiers, EmployeeNode } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

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

function flatSubtree(node: EmployeeNode): Employee[] {
  const result: Employee[] = [node]
  for (const child of node.children) result.push(...flatSubtree(child))
  return result
}

interface Props {
  challenge: ChallengeWithTiers
  manager: Employee
  levelConfigs: OrgLevelConfig[]
  allOrgEmployees: Employee[]
  initialCompletedIds: Set<string>
}

export default function ManagerChallengeDetailWrapper({
  challenge,
  manager,
  levelConfigs,
  allOrgEmployees,
  initialCompletedIds,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState(initialCompletedIds)
  const [refreshing, setRefreshing] = useState(false)
  const [nudgingId, setNudgingId] = useState<string | null>(null)
  const [nudgingAll, setNudgingAll] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const directReports = allOrgEmployees.filter(e => e.manager_id === manager.id)
    return new Set(directReports.map(e => e.id))
  })

  const subtree = getSubtree(manager.id, allOrgEmployees)
  const isActive = challenge.status === 'active'

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

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
        next.delete(id)
        const descendants = getDescendantIds(id)
        descendants.forEach(descId => next.delete(descId))
      } else {
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

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  // Build tree
  function buildTree(emp: Employee): EmployeeNode {
    return {
      ...emp,
      children: allOrgEmployees
        .filter(e => e.manager_id === emp.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(buildTree),
    }
  }

  const directReports = allOrgEmployees.filter(e => e.manager_id === manager.id)
  const tree = directReports.map(buildTree).sort((a, b) => {
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
            onClick={() => router.push('/dashboard/manager')}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ChevronRight size={14} className="rotate-180" /> Back to challenges
          </button>
        </div>
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
      <div className="bg-white mx-5 mt-4 rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
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
                  {challenge.start_date && challenge.due_date && <span>→</span>}
                  {challenge.due_date && <span>{challenge.due_date}</span>}
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          <div className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                <Users size={14} /> Team Progress
              </span>
              <span className="text-sm font-bold text-gray-900">{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all ${challenge.status === 'ended' ? 'bg-slate-400' : 'bg-emerald-500'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{completedCount} / {totalCount} completed</span>
              {pendingCount > 0 && isActive && (
                <button
                  onClick={handleNudgeAll}
                  disabled={nudgingAll}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold transition-colors disabled:opacity-50"
                >
                  {nudgingAll ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
                  Nudge All ({pendingCount})
                </button>
              )}
            </div>
          </div>

          {/* Tiers */}
          {maxPerEmployee > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedTiers
                .filter(t => t.enabled || t.is_individual)
                .map(t => (
                  <span key={t.level} className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
                    L{t.level} {t.is_individual ? `${fmt(t.base_tokens)}tk` : `+${fmt(t.bonus_tokens)}@${t.threshold_pct}%`}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Team tree */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="space-y-2">
          {tree.map(node => (
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
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// Team group card component
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
