'use client'

import { useState, useMemo } from 'react'
import { Pencil, ChevronDown, ChevronUp, Users, ShieldCheck, Coins } from 'lucide-react'
import type { Employee, OrgLevelConfig, EmployeeNode } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

function buildTree(employees: Employee[]): EmployeeNode[] {
  const roots = employees.filter(e => !e.manager_id || e.level === 0)
  function recurse(emp: Employee): EmployeeNode {
    return {
      ...emp,
      children: employees
        .filter(e => e.manager_id === emp.id)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map(recurse),
    }
  }
  return roots.map(recurse)
}

// ─── Single card ──────────────────────────────────────────────────────────────
function ChartCard({
  node,
  levelConfigs,
  isExpanded,
  onToggle,
  onEdit,
  readOnly = false,
  tenantAdminEmails,
  onSelect,
  isSelectable,
  getAllocated,
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: (e: Employee) => void
  readOnly?: boolean
  tenantAdminEmails?: string[]
  onSelect?: (e: Employee) => void
  isSelectable?: (e: Employee) => boolean
  getAllocated?: (e: Employee) => number | null
}) {
  const label = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const color = levelColor(node.level)
  const hasChildren = node.children.length > 0
  const isL0 = node.level === 0
  const isTenantAdmin = !!tenantAdminEmails?.length && !!node.email &&
    tenantAdminEmails.some(e => e.toLowerCase() === node.email!.toLowerCase())
  const selectable = onSelect ? (isSelectable ? isSelectable(node) : true) : false
  const allocated = getAllocated ? (getAllocated(node) ?? 0) : 0

  return (
    <div
      className={`w-48 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden group relative ${
        isTenantAdmin ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200 hover:border-indigo-200'
      } ${onSelect && !selectable ? 'opacity-50' : ''}`}
    >
      {/* Accent bar */}
      <div
        className="h-1 w-full"
        style={{ background: isTenantAdmin ? '#f59e0b' : color }}
      />

      {/* Card content */}
      <div className="p-4">
        {/* Level badge + Admin badge */}
        <div className="flex items-center gap-1.5 mb-2.5">
          <span
            className="text-[9px] font-semibold text-white px-2 py-0.5 rounded flex-shrink-0"
            style={{ background: isTenantAdmin ? '#f59e0b' : color }}
          >
            L{node.level}
          </span>
          <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest truncate">
            {label}
          </span>
          {isTenantAdmin && (
            <ShieldCheck size={12} className="text-amber-400 flex-shrink-0 ml-auto" />
          )}
        </div>

        {/* Name */}
        <div className="mb-2.5">
          <div className="text-sm font-semibold text-gray-900 leading-snug">
            {node.first_name} {node.last_name}
          </div>
          {isTenantAdmin && (
            <div className="flex items-center gap-1 text-[10px] font-medium text-amber-500 mt-1">
              <ShieldCheck size={10} /> Tenant Admin
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="space-y-1">
          {node.employee_id && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <div className="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0" />
              <span className="font-mono">{node.employee_id}</span>
            </div>
          )}
          {node.team_name && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
              <Users size={10} className="flex-shrink-0" />
              <span className="truncate">{node.team_name}</span>
            </div>
          )}
          {allocated > 0 && (
            <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded-full w-fit mt-1">
              <Coins size={8} />
              {fmt(allocated)}
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-100">
        {onSelect ? (
          selectable ? (
            <button
              onClick={() => onSelect(node)}
              className="flex items-center gap-1 text-[10px] font-medium text-indigo-500 hover:text-indigo-700 transition-all opacity-0 group-hover:opacity-100"
            >
              <Coins size={10} /> {allocated > 0 ? 'Adjust' : 'Allocate'}
            </button>
          ) : <div />
        ) : !isL0 && !readOnly ? (
          <button
            onClick={() => onEdit(node)}
            className="flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-indigo-500 transition-all opacity-0 group-hover:opacity-100"
          >
            <Pencil size={10} /> Edit
          </button>
        ) : <div />}

        {hasChildren && (
          <button
            onClick={onToggle}
            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded transition-all ml-auto ${
              isExpanded
                ? 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {isExpanded
              ? <><ChevronUp size={11} /> {node.children.length}</>
              : <><ChevronDown size={11} /> {node.children.length}</>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Recursive chart node ─────────────────────────────────────────────────────
function ChartNode({
  node,
  levelConfigs,
  expanded,
  onToggle,
  onEdit,
  readOnly = false,
  tenantAdminEmails,
  onSelect,
  isSelectable,
  getAllocated,
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (e: Employee) => void
  readOnly?: boolean
  tenantAdminEmails?: string[]
  onSelect?: (e: Employee) => void
  isSelectable?: (e: Employee) => boolean
  getAllocated?: (e: Employee) => number | null
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0

  return (
    <div className="flex flex-col items-center">
      <ChartCard
        node={node}
        levelConfigs={levelConfigs}
        isExpanded={isExpanded}
        onToggle={() => onToggle(node.id)}
        onEdit={onEdit}
        readOnly={readOnly}
        tenantAdminEmails={tenantAdminEmails}
        onSelect={onSelect}
        isSelectable={isSelectable}
        getAllocated={getAllocated}
      />

      {hasChildren && isExpanded && (
        <>
          {/* Vertical connector line */}
          <div className="w-px h-6 bg-gray-200" />
          {/* Children row — connector lines handled by CSS .oc-child */}
          <div className="oc-children">
            {node.children.map(child => (
              <div key={child.id} className="oc-child">
                <ChartNode
                  node={child}
                  levelConfigs={levelConfigs}
                  expanded={expanded}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  readOnly={readOnly}
                  tenantAdminEmails={tenantAdminEmails}
                  onSelect={onSelect}
                  isSelectable={isSelectable}
                  getAllocated={getAllocated}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Collapsed indicator */}
      {hasChildren && !isExpanded && (
        <button
          onClick={() => onToggle(node.id)}
          className="mt-2 flex items-center gap-1.5 text-[10px] font-medium text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg px-3 py-1.5 transition-all"
        >
          <ChevronDown size={11} />
          <span>{node.children.length} report{node.children.length !== 1 ? 's' : ''}</span>
        </button>
      )}
    </div>
  )
}

// ─── Main OrgChartView ────────────────────────────────────────────────────────
interface Props {
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  onEdit: (e: Employee) => void
  readOnly?: boolean
  tenantAdminEmails?: string[]
  onSelect?: (e: Employee) => void
  isSelectable?: (e: Employee) => boolean
  getAllocated?: (e: Employee) => number | null
}

export default function OrgChartView({ employees, levelConfigs, onEdit, readOnly = false, tenantAdminEmails, onSelect, isSelectable, getAllocated }: Props) {
  const tree = useMemo(() => buildTree(employees), [employees])

  // Default: expand L0 only (shows L1 children)
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    employees.filter(e => e.level === 0).forEach(e => s.add(e.id))
    return s
  })

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const expandAll  = () => setExpanded(new Set(employees.map(e => e.id)))
  const collapseAll = () => setExpanded(new Set(employees.filter(e => e.level === 0).map(e => e.id)))

  // Dynamic levels: only show levels that exist in employees
  const presentLevels = useMemo(() => {
    const levels = [...new Set(employees.map(e => e.level))].sort((a, b) => a - b)
    return levels.map(l => ({
      level: l,
      label: levelConfigs.find(c => c.level === l)?.label ?? `L${l}`,
    }))
  }, [employees, levelConfigs])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50">

      {/* Level legend strip */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-white border-b border-gray-100 flex-wrap">
        {presentLevels.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1.5">
            <span
              className="text-[9px] font-semibold text-white px-2 py-0.5 rounded"
              style={{ background: levelColor(level) }}
            >
              L{level}
            </span>
            <span className="text-[11px] font-medium text-gray-500">{label}</span>
            {level < presentLevels[presentLevels.length - 1].level && (
              <span className="text-gray-200 text-sm mx-1">•</span>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={expandAll}
            className="text-xs font-medium text-indigo-500 hover:text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1.5 rounded-lg transition-all"
          >
            Expand all
          </button>
          <button
            onClick={collapseAll}
            className="text-xs font-medium text-gray-500 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg transition-all"
          >
            Collapse
          </button>
        </div>
      </div>

      {/* Chart canvas — scrollable in both directions */}
      <div className="flex-1 overflow-auto p-10">
        <div className={`inline-flex gap-16 items-start ${tree.length === 1 ? 'flex-col items-center min-w-full' : 'flex-row'}`}>
          {tree.map(root => (
            <ChartNode
              key={root.id}
              node={root}
              levelConfigs={levelConfigs}
              expanded={expanded}
              onToggle={toggle}
              onEdit={onEdit}
              readOnly={readOnly}
              tenantAdminEmails={tenantAdminEmails}
              onSelect={onSelect}
              isSelectable={isSelectable}
              getAllocated={getAllocated}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
