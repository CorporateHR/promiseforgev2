'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  ChevronRight, Trophy, Calendar, CheckCircle2, RefreshCw,
  Loader2, ChevronDown, Users,
} from 'lucide-react'
import { getLiveCompletions } from '@/app/actions/challenges'
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
}

export default function AdminChallengeDetailView({
  challenge,
  levelConfigs,
  allEmployees,
  initialCompletedIds,
}: Props) {
  const router = useRouter()
  const [completedIds, setCompletedIds] = useState(initialCompletedIds)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const topLevel = allEmployees.filter(e => !e.manager_id || !allEmployees.find(m => m.id === e.manager_id))
    return new Set(topLevel.map(e => e.id))
  })

  const isActive = challenge.status === 'active'

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
    const result = await getLiveCompletions(challenge.id)
    setRefreshing(false)
    if ('error' in result) return
    setCompletedIds(new Set(result.completedIds))
  }

  const completedCount = allEmployees.filter(e => completedIds.has(e.id)).length
  const totalCount = allEmployees.length
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
            onClick={() => router.push('/dashboard/admin')}
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
                <Users size={14} /> Overall Progress
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
                    L{t.level} {t.is_individual ? `${fmt(t.base_tokens)}tk` : `+${fmt(t.bonus_tokens)}@${t.threshold_pct}%`}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Organization tree */}
      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="space-y-2">
          {tree.map(node => (
            <TeamGroupCard
              key={node.id}
              node={node}
              completedIds={completedIds}
              levelConfigs={levelConfigs}
              expanded={expanded}
              onToggle={toggleExpanded}
            />
          ))}
        </div>
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
}: {
  node: EmployeeNode
  completedIds: Set<string>
  levelConfigs: OrgLevelConfig[]
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
          {completedIds.has(node.id) && (
            <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-600">Done</span>
            </div>
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
              />
            ) : (
              <PersonRow
                key={child.id}
                emp={child}
                done={completedIds.has(child.id)}
                levelConfigs={levelConfigs}
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
}: {
  emp: Employee
  done: boolean
  levelConfigs: OrgLevelConfig[]
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
        </div>
      )}
    </div>
  )
}
