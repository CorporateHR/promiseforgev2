'use client'

import { useState, useMemo } from 'react'
import {
  ArrowLeft, CheckCircle2, Bell, Loader2, BellRing,
  AlertCircle, Users, Zap, ChevronDown, ChevronRight, Search, X,
} from 'lucide-react'
import {
  adminMarkGroupCompletion,
  nudgeGroup,
  adminMarkAllCompletion,
  nudgeAll,
} from '@/app/actions/simulator'
import type { ChallengeWithTiers, ChallengeTier, Employee, OrgLevelConfig, EmployeeNode } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

function buildTree(employees: Employee[]): EmployeeNode[] {
  const roots = employees.filter(e => !e.manager_id)
  function recurse(emp: Employee): EmployeeNode {
    return {
      ...emp,
      children: employees
        .filter(e => e.manager_id === emp.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(recurse),
    }
  }
  return roots.sort((a, b) => a.full_name.localeCompare(b.full_name)).map(recurse)
}

function flatSubtree(node: EmployeeNode): Employee[] {
  const result: Employee[] = [node]
  for (const child of node.children) result.push(...flatSubtree(child))
  return result
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  challenge: ChallengeWithTiers
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  completedIds: Set<string>
  onBack: () => void
  onCompletionAdded: (challengeId: string, employeeIds: string[]) => void
}

// ─── Clickable completion dot ─────────────────────────────────────────────────
function CompletionDot({
  empId, loadingKey, completedIds, isActive, loadingMap, onMark, size = 'md',
}: {
  empId: string
  loadingKey: string
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  onMark: (key: string, ids: string[]) => void
  size?: 'sm' | 'md'
}) {
  const done = completedIds.has(empId)
  const loading = loadingMap[loadingKey] ?? null
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  const iconSize = size === 'sm' ? 9 : 11

  return (
    <button
      onClick={() => { if (!done && isActive && loading === null) onMark(loadingKey, [empId]) }}
      disabled={done || !isActive || loading !== null}
      title={done ? 'Completed' : 'Mark complete'}
      className={`${dim} rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
        done
          ? 'bg-emerald-500 border-emerald-500 cursor-default'
          : isActive
            ? 'border-gray-300 bg-white hover:border-emerald-400 hover:bg-emerald-50 cursor-pointer'
            : 'border-gray-200 bg-white cursor-default'
      }`}
    >
      {done && <CheckCircle2 size={iconSize} className="text-white" strokeWidth={3} />}
      {!done && loading === 'marking' && <Loader2 size={iconSize} className="text-emerald-300 animate-spin" />}
    </button>
  )
}

// ─── Individual employee row ──────────────────────────────────────────────────
function EmployeeRow({
  emp, completedIds, isActive, loadingMap, onMark, onNudge, searchQuery,
}: {
  emp: Employee
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  searchQuery?: string
}) {
  const done = completedIds.has(emp.id)
  const loading = loadingMap[emp.id] ?? null
  const isMatch = !searchQuery || emp.full_name.toLowerCase().includes(searchQuery.toLowerCase())

  // Highlight matching portion of name
  function HighlightedName() {
    if (!searchQuery || !isMatch) return <span>{emp.full_name}</span>
    const q = searchQuery.toLowerCase()
    const idx = emp.full_name.toLowerCase().indexOf(q)
    if (idx === -1) return <span>{emp.full_name}</span>
    return (
      <span>
        {emp.full_name.slice(0, idx)}
        <mark className="bg-amber-200 text-gray-900 rounded px-0.5">{emp.full_name.slice(idx, idx + q.length)}</mark>
        {emp.full_name.slice(idx + q.length)}
      </span>
    )
  }

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      done ? 'bg-emerald-50/60' : 'hover:bg-gray-50'
    } ${searchQuery && !isMatch ? 'opacity-30' : ''}`}>
      {/* Clickable completion dot */}
      <CompletionDot
        empId={emp.id}
        loadingKey={emp.id}
        completedIds={completedIds}
        isActive={isActive}
        loadingMap={loadingMap}
        onMark={onMark}
      />

      {/* Name */}
      <span className={`flex-1 text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>
        <HighlightedName />
      </span>

      {/* Nudge button (only for pending + active) */}
      {isActive && !done && (
        <button
          onClick={() => onNudge(emp.id, [emp.id])}
          disabled={loading !== null}
          title="Nudge"
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors disabled:opacity-40 flex-shrink-0"
        >
          {loading === 'nudging' ? <Loader2 size={11} className="animate-spin" /> : <Bell size={11} />}
        </button>
      )}
    </div>
  )
}

// ─── Group action buttons ─────────────────────────────────────────────────────
function GroupActions({
  nodeId, subtreeIds, completedIds, isActive, loadingMap, bonusTokens,
  doneCount, totalCount, thresholdCount, onMark, onNudge, label,
}: {
  nodeId: string
  subtreeIds: string[]
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  bonusTokens: number
  doneCount: number
  totalCount: number
  thresholdCount: number
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  label: string
}) {
  const pending = totalCount - doneCount
  const loading = loadingMap[nodeId] ?? null
  const allDone = pending === 0 && totalCount > 0

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Progress */}
      <span className="text-xs font-bold text-gray-500 tabular-nums">
        {doneCount}/{totalCount}
        {thresholdCount > 0 && (
          <span className="text-gray-400 font-normal"> ({thresholdCount} needed)</span>
        )}
      </span>

      {/* Bonus */}
      {bonusTokens > 0 && (
        <span className="flex items-center gap-0.5 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
          <Zap size={8} /> +{fmt(bonusTokens)}
        </span>
      )}

      {allDone ? (
        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
          <CheckCircle2 size={11} /> All done
        </span>
      ) : isActive && (
        <>
          <button
            onClick={() => onNudge(nodeId, subtreeIds)}
            disabled={loading !== null || pending === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors disabled:opacity-40"
          >
            {loading === 'nudging' ? <Loader2 size={10} className="animate-spin" /> : <Bell size={10} />}
            Nudge
          </button>
          <button
            onClick={() => onMark(nodeId, subtreeIds)}
            disabled={loading !== null || pending === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors disabled:opacity-40"
          >
            {loading === 'marking' ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
            Complete
          </button>
        </>
      )}
    </div>
  )
}

// ─── Leaf group card (L3 and below — shows individual rows) ──────────────────
function LeafGroupCard({
  node, tierBonus, thresholdPct, completedIds, isActive, loadingMap, levelConfigs,
  onMark, onNudge, expanded, onToggle, searchQuery,
}: {
  node: EmployeeNode
  tierBonus: number
  thresholdPct: number
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  levelConfigs: OrgLevelConfig[]
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  expanded: Set<string>
  onToggle: (id: string) => void
  searchQuery?: string
}) {
  const subtree = flatSubtree(node)
  const subtreeIds = subtree.map(e => e.id)
  const doneCount = subtreeIds.filter(id => completedIds.has(id)).length
  const totalCount = subtreeIds.length
  const thresholdCount = Math.ceil(totalCount * thresholdPct / 100)
  const levelLabel = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const isExpanded = expanded.has(node.id)
  const members = subtree.filter(emp => emp.id !== node.id)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Card header */}
      <div className="px-3 py-2.5 flex items-center gap-2 flex-wrap">
        <CompletionDot
          empId={node.id}
          loadingKey={node.id + ':self'}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          onMark={onMark}
          size="sm"
        />
        <button
          onClick={() => onToggle(node.id)}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
        >
          {isExpanded
            ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
          <span className="font-bold text-sm text-gray-900 truncate">{node.full_name}</span>
        </button>
        <span
          className="text-[9px] font-black text-white px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: levelColor(node.level) }}
        >
          {levelLabel}
        </span>
        <div className="flex-1" />
        <GroupActions
          nodeId={node.id}
          subtreeIds={subtreeIds}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          bonusTokens={tierBonus}
          doneCount={doneCount}
          totalCount={totalCount}
          thresholdCount={thresholdCount}
          onMark={onMark}
          onNudge={onNudge}
          label={levelLabel}
        />
      </div>

      {/* Individual rows — skip the group leader (already shown in header) */}
      {isExpanded && members.length > 0 && (
        <div className="border-t border-gray-100 p-1.5 space-y-0.5">
          {members.map(emp => (
            <EmployeeRow
              key={emp.id}
              emp={emp}
              completedIds={completedIds}
              isActive={isActive}
              loadingMap={loadingMap}
              onMark={onMark}
              onNudge={onNudge}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mid group card (L2 — contains leaf groups in 2-col) ─────────────────────
function MidGroupCard({
  node, tiers, completedIds, isActive, loadingMap, levelConfigs, onMark, onNudge,
  leafTierLevel, expanded, onToggle, searchQuery,
}: {
  node: EmployeeNode
  tiers: ChallengeTier[]
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  levelConfigs: OrgLevelConfig[]
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  leafTierLevel: number
  expanded: Set<string>
  onToggle: (id: string) => void
  searchQuery?: string
}) {
  const subtree = flatSubtree(node)
  const subtreeIds = subtree.map(e => e.id)
  const doneCount = subtreeIds.filter(id => completedIds.has(id)).length
  const totalCount = subtreeIds.length
  const tier = tiers.find(t => t.level === node.level)
  const bonusTokens = tier?.bonus_tokens ?? 0
  const thresholdPct = tier?.threshold_pct ?? 0
  const thresholdCount = Math.ceil(totalCount * thresholdPct / 100)
  const levelLabel = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const leafTier = tiers.find(t => t.level === leafTierLevel)
  const isExpanded = expanded.has(node.id)

  return (
    <div className="bg-indigo-50/40 rounded-xl border border-indigo-100 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
        <CompletionDot
          empId={node.id}
          loadingKey={node.id + ':self'}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          onMark={onMark}
          size="sm"
        />
        <button
          onClick={() => onToggle(node.id)}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
        >
          {isExpanded
            ? <ChevronDown size={13} className="text-indigo-400 flex-shrink-0" />
            : <ChevronRight size={13} className="text-indigo-400 flex-shrink-0" />}
          <span className="font-bold text-sm text-gray-900">{node.full_name}</span>
        </button>
        <span
          className="text-[9px] font-black text-white px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: levelColor(node.level) }}
        >
          {levelLabel}
        </span>
        <div className="flex-1" />
        <GroupActions
          nodeId={node.id}
          subtreeIds={subtreeIds}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          bonusTokens={bonusTokens}
          doneCount={doneCount}
          totalCount={totalCount}
          thresholdCount={thresholdCount}
          onMark={onMark}
          onNudge={onNudge}
          label={levelLabel}
        />
      </div>

      {/* Leaf group cards in 2-column grid */}
      {isExpanded && (
        node.children.length > 0 ? (
          <div className="px-3 pb-3 grid grid-cols-2 gap-2">
            {node.children.map(child => (
              <LeafGroupCard
                key={child.id}
                node={child}
                tierBonus={leafTier?.bonus_tokens ?? 0}
                thresholdPct={leafTier?.threshold_pct ?? 0}
                completedIds={completedIds}
                isActive={isActive}
                loadingMap={loadingMap}
                levelConfigs={levelConfigs}
                onMark={onMark}
                onNudge={onNudge}
                expanded={expanded}
                onToggle={onToggle}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        ) : (
          /* No children — show own row directly */
          <div className="border-t border-indigo-100 px-3 pb-3 pt-1 space-y-0.5">
            <EmployeeRow
              emp={node}
              completedIds={completedIds}
              isActive={isActive}
              loadingMap={loadingMap}
              onMark={onMark}
              onNudge={onNudge}
              searchQuery={searchQuery}
            />
          </div>
        )
      )}
    </div>
  )
}

// ─── Top section card (L1 — contains mid groups) ─────────────────────────────
function TopGroupCard({
  node, tiers, completedIds, isActive, loadingMap, levelConfigs, onMark, onNudge,
  midTierLevel, leafTierLevel, expanded, onToggle, searchQuery,
}: {
  node: EmployeeNode
  tiers: ChallengeTier[]
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  levelConfigs: OrgLevelConfig[]
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  midTierLevel: number
  leafTierLevel: number
  expanded: Set<string>
  onToggle: (id: string) => void
  searchQuery?: string
}) {
  const subtree = flatSubtree(node)
  const subtreeIds = subtree.map(e => e.id)
  const doneCount = subtreeIds.filter(id => completedIds.has(id)).length
  const totalCount = subtreeIds.length
  const tier = tiers.find(t => t.level === node.level)
  const bonusTokens = tier?.bonus_tokens ?? 0
  const thresholdPct = tier?.threshold_pct ?? 0
  const thresholdCount = Math.ceil(totalCount * thresholdPct / 100)
  const levelLabel = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const isExpanded = expanded.has(node.id)

  return (
    <div className="bg-emerald-50/50 rounded-2xl border border-emerald-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center gap-2 flex-wrap">
        <CompletionDot
          empId={node.id}
          loadingKey={node.id + ':self'}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          onMark={onMark}
        />
        <button
          onClick={() => onToggle(node.id)}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
        >
          {isExpanded
            ? <ChevronDown size={14} className="text-emerald-500 flex-shrink-0" />
            : <ChevronRight size={14} className="text-emerald-500 flex-shrink-0" />}
          <span className="font-black text-base text-gray-900">{node.full_name}</span>
        </button>
        <span
          className="text-[9px] font-black text-white px-1.5 py-0.5 rounded flex-shrink-0"
          style={{ background: levelColor(node.level) }}
        >
          {levelLabel}
        </span>
        <div className="flex-1" />
        <GroupActions
          nodeId={node.id}
          subtreeIds={subtreeIds}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          bonusTokens={bonusTokens}
          doneCount={doneCount}
          totalCount={totalCount}
          thresholdCount={thresholdCount}
          onMark={onMark}
          onNudge={onNudge}
          label={levelLabel}
        />
      </div>

      {/* Mid group cards */}
      {isExpanded && (
        node.children.length > 0 ? (
          <div className="border-t border-emerald-100 p-4 space-y-3">
            {node.children.map(child => (
              <MidGroupCard
                key={child.id}
                node={child}
                tiers={tiers}
                completedIds={completedIds}
                isActive={isActive}
                loadingMap={loadingMap}
                levelConfigs={levelConfigs}
                onMark={onMark}
                onNudge={onNudge}
                leafTierLevel={leafTierLevel}
                expanded={expanded}
                onToggle={onToggle}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-emerald-100 p-4 space-y-0.5">
            <EmployeeRow
              emp={node}
              completedIds={completedIds}
              isActive={isActive}
              loadingMap={loadingMap}
              onMark={onMark}
              onNudge={onNudge}
              searchQuery={searchQuery}
            />
          </div>
        )
      )}
    </div>
  )
}

// ─── Root section (L0 — full-width, teal card) ───────────────────────────────
function RootCard({
  node, tiers, completedIds, isActive, loadingMap, levelConfigs, onMark, onNudge,
  topTierLevel, midTierLevel, leafTierLevel, expanded, onToggle, searchQuery,
}: {
  node: EmployeeNode
  tiers: ChallengeTier[]
  completedIds: Set<string>
  isActive: boolean
  loadingMap: Record<string, 'marking' | 'nudging' | null>
  levelConfigs: OrgLevelConfig[]
  onMark: (id: string, ids: string[]) => void
  onNudge: (id: string, ids: string[]) => void
  topTierLevel: number
  midTierLevel: number
  leafTierLevel: number
  expanded: Set<string>
  onToggle: (id: string) => void
  searchQuery?: string
}) {
  const subtree = flatSubtree(node)
  const subtreeIds = subtree.map(e => e.id)
  const doneCount = subtreeIds.filter(id => completedIds.has(id)).length
  const totalCount = subtreeIds.length
  const tier = tiers.find(t => t.level === node.level)
  const bonusTokens = tier?.bonus_tokens ?? 0
  const thresholdPct = tier?.threshold_pct ?? 0
  const thresholdCount = Math.ceil(totalCount * thresholdPct / 100)
  const levelLabel = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const isExpanded = expanded.has(node.id)

  return (
    <div className="bg-teal-50 rounded-2xl border border-teal-200 overflow-hidden">
      {/* Root header */}
      <div className="px-6 py-4 flex items-center gap-3 flex-wrap">
        <CompletionDot
          empId={node.id}
          loadingKey={node.id + ':self'}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          onMark={onMark}
        />
        <button
          onClick={() => onToggle(node.id)}
          className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
        >
          {isExpanded
            ? <ChevronDown size={16} className="text-teal-500 flex-shrink-0" />
            : <ChevronRight size={16} className="text-teal-500 flex-shrink-0" />}
          <span className="font-black text-lg text-gray-900">{node.full_name}</span>
        </button>
        <span
          className="text-[10px] font-black text-white px-2 py-0.5 rounded-md flex-shrink-0"
          style={{ background: levelColor(node.level) }}
        >
          {levelLabel}
        </span>
        <div className="flex-1" />
        <GroupActions
          nodeId={node.id}
          subtreeIds={subtreeIds}
          completedIds={completedIds}
          isActive={isActive}
          loadingMap={loadingMap}
          bonusTokens={bonusTokens}
          doneCount={doneCount}
          totalCount={totalCount}
          thresholdCount={thresholdCount}
          onMark={onMark}
          onNudge={onNudge}
          label={levelLabel}
        />
      </div>

      {/* Top-level children */}
      {isExpanded && (
        node.children.length > 0 ? (
          <div className="border-t border-teal-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {node.children.map(child => (
              <TopGroupCard
                key={child.id}
                node={child}
                tiers={tiers}
                completedIds={completedIds}
                isActive={isActive}
                loadingMap={loadingMap}
                levelConfigs={levelConfigs}
                onMark={onMark}
                onNudge={onNudge}
                midTierLevel={midTierLevel}
                leafTierLevel={leafTierLevel}
                expanded={expanded}
                onToggle={onToggle}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        ) : (
          <div className="border-t border-teal-100 p-5 space-y-0.5">
            <EmployeeRow
              emp={node}
              completedIds={completedIds}
              isActive={isActive}
              loadingMap={loadingMap}
              onMark={onMark}
              onNudge={onNudge}
              searchQuery={searchQuery}
            />
          </div>
        )
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SimulatorChallengeView({
  challenge, employees, levelConfigs, completedIds: initialCompleted,
  onBack, onCompletionAdded,
}: Props) {
  const [completedIds, setCompletedIds] = useState(new Set(initialCompleted))
  const [loadingMap, setLoadingMap] = useState<Record<string, 'marking' | 'nudging' | null>>({})
  const [bulkLoading, setBulkLoading] = useState<'marking' | 'nudging' | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Default: only L0 (root) nodes expanded — user drills in manually
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(employees.filter(e => e.level === 0).map(e => e.id))
  )
  const toggleExpanded = (id: string) =>
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  const expandAll   = () => setExpanded(new Set(employees.map(e => e.id)))
  const collapseAll = () => setExpanded(new Set(employees.filter(e => e.level === 0).map(e => e.id)))

  // ── Search ──────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('')

  const matchingIds = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return null
    return new Set(employees.filter(e => e.full_name.toLowerCase().includes(q)).map(e => e.id))
  }, [search, employees])

  // When searching, auto-expand all ancestors of matching employees
  const effectiveExpanded = useMemo(() => {
    if (!matchingIds) return expanded
    const parentMap = new Map(
      employees.filter(e => e.manager_id).map(e => [e.id, e.manager_id!])
    )
    const toExpand = new Set<string>()
    matchingIds.forEach(id => {
      let cur = parentMap.get(id)
      while (cur) { toExpand.add(cur); cur = parentMap.get(cur) }
    })
    return new Set([...expanded, ...toExpand])
  }, [matchingIds, expanded, employees])

  const tree = useMemo(() => buildTree(employees), [employees])

  // Sort group tiers by level asc; individual is always the highest level
  const groupTiers = useMemo(
    () => challenge.tiers.filter(t => !t.is_individual && t.enabled).sort((a, b) => a.level - b.level),
    [challenge.tiers],
  )
  const indivTier = challenge.tiers.find(t => t.is_individual)

  // Tier levels by position: [L0=root, L1=top, L2=mid, L3=leaf], L4=individual
  const [rootTierLevel, topTierLevel, midTierLevel, leafTierLevel] = [
    groupTiers[0]?.level ?? 0,
    groupTiers[1]?.level ?? 1,
    groupTiers[2]?.level ?? 2,
    groupTiers[3]?.level ?? (indivTier?.level ?? 4),
  ]

  const totalCount = employees.length
  const doneCount = completedIds.size
  const pendingCount = totalCount - doneCount
  const isActive = challenge.status === 'active'

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  function setNodeLoading(nodeId: string, state: 'marking' | 'nudging' | null) {
    setLoadingMap(prev => ({ ...prev, [nodeId]: state }))
  }

  async function handleMark(nodeId: string, employeeIds: string[]) {
    const incomplete = employeeIds.filter(id => !completedIds.has(id))
    if (incomplete.length === 0) return
    setNodeLoading(nodeId, 'marking')
    const result = await adminMarkGroupCompletion(challenge.id, incomplete)
    setNodeLoading(nodeId, null)
    if ('error' in result) { showToast('error', result.error); return }
    setCompletedIds(prev => new Set([...prev, ...incomplete]))
    onCompletionAdded(challenge.id, incomplete)
    showToast('success', incomplete.length === 1 ? 'Marked complete' : `${result.count} marked complete`)
  }

  async function handleNudge(nodeId: string, employeeIds: string[]) {
    setNodeLoading(nodeId, 'nudging')
    const result = await nudgeGroup(challenge.id, employeeIds)
    setNodeLoading(nodeId, null)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', result.count === 0 ? 'No pending members' : `Nudge sent to ${result.count}`)
  }

  async function handleMarkAll() {
    setBulkLoading('marking')
    const result = await adminMarkAllCompletion(challenge.id)
    setBulkLoading(null)
    if ('error' in result) { showToast('error', result.error); return }
    const allIds = employees.map(e => e.id)
    setCompletedIds(new Set(allIds))
    onCompletionAdded(challenge.id, allIds)
    showToast('success', `${result.count} employees marked complete`)
  }

  async function handleNudgeAll() {
    setBulkLoading('nudging')
    const result = await nudgeAll(challenge.id)
    setBulkLoading(null)
    if ('error' in result) { showToast('error', result.error); return }
    showToast('success', `Nudge sent to ${result.count} employees`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-100 bg-white space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-gray-900">{challenge.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="font-bold text-emerald-600">{doneCount}</span> done ·{' '}
              <span className="font-bold text-amber-600">{pendingCount}</span> pending ·{' '}
              {totalCount} total
            </p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={expandAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
            <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
          </div>

          {isActive && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleNudgeAll}
                disabled={bulkLoading !== null || pendingCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold transition-colors disabled:opacity-40"
              >
                {bulkLoading === 'nudging'
                  ? <><Loader2 size={11} className="animate-spin" /> Nudging…</>
                  : <><BellRing size={11} /> Nudge All</>}
              </button>
              <button
                onClick={handleMarkAll}
                disabled={bulkLoading !== null || pendingCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors disabled:opacity-40"
              >
                {bulkLoading === 'marking'
                  ? <><Loader2 size={11} className="animate-spin" /> Marking…</>
                  : <><CheckCircle2 size={11} /> Mark All</>}
              </button>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-indigo-300 focus-within:bg-white transition-colors">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search employee…"
            className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <X size={13} />
            </button>
          )}
          {matchingIds !== null && (
            <span className="text-[11px] font-bold text-indigo-600 flex-shrink-0">
              {matchingIds.size} found
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${Math.round((doneCount / totalCount) * 100)}%` : '0%' }}
          />
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users size={28} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">No employees found</p>
          </div>
        ) : (
          tree.map(root => (
            <RootCard
              key={root.id}
              node={root}
              tiers={challenge.tiers}
              completedIds={completedIds}
              isActive={isActive}
              loadingMap={loadingMap}
              levelConfigs={levelConfigs}
              onMark={handleMark}
              onNudge={handleNudge}
              topTierLevel={topTierLevel}
              midTierLevel={midTierLevel}
              leafTierLevel={leafTierLevel}
              expanded={effectiveExpanded}
              onToggle={toggleExpanded}
              searchQuery={search.trim() || undefined}
            />
          ))
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold text-white whitespace-nowrap ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}
