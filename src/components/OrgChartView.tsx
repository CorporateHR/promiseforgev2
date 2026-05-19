'use client'

import { useState, useMemo } from 'react'
import { Pencil, ChevronDown, ChevronUp, Users, ShieldCheck } from 'lucide-react'
import type { Employee, OrgLevelConfig, EmployeeNode } from '@/lib/types'

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
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  isExpanded: boolean
  onToggle: () => void
  onEdit: (e: Employee) => void
  readOnly?: boolean
  tenantAdminEmails?: string[]
}) {
  const label = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const color = levelColor(node.level)
  const hasChildren = node.children.length > 0
  const isL0 = node.level === 0
  const isTenantAdmin = !!tenantAdminEmails?.length && !!node.email &&
    tenantAdminEmails.some(e => e.toLowerCase() === node.email!.toLowerCase())

  return (
    <div
      className={`w-44 bg-white rounded-xl border shadow-sm hover:shadow-md transition-all overflow-hidden group ${
        isTenantAdmin ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
      }`}
      style={{ borderTop: `3px solid ${isTenantAdmin ? '#f59e0b' : color}` }}
    >
      {/* Level badge + name */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <span
          className="text-[9px] font-black text-white px-1.5 py-0.5 rounded-md flex-shrink-0"
          style={{ background: isTenantAdmin ? '#f59e0b' : color }}
        >
          L{node.level}
        </span>
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide truncate">
          {label}
        </span>
        {isTenantAdmin && (
          <ShieldCheck size={11} className="text-amber-500 flex-shrink-0 ml-auto" />
        )}
      </div>

      {/* Name */}
      <div className="px-3 pb-2">
        <div className="text-sm font-bold text-gray-900 leading-tight">
          {node.first_name} <span className="font-semibold">{node.last_name}</span>
        </div>
        {isTenantAdmin && (
          <div className="text-[10px] font-semibold text-amber-500 mt-0.5">Tenant Admin</div>
        )}
        {node.employee_id && (
          <div className="text-[10px] font-mono text-gray-400 mt-0.5">{node.employee_id}</div>
        )}
        {node.team_name && (
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-gray-400">
            <Users size={8} /> {node.team_name}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-100">
        {!isL0 && !readOnly ? (
          <button
            onClick={() => onEdit(node)}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
          >
            <Pencil size={9} /> Edit
          </button>
        ) : <div />}

        {hasChildren && (
          <button
            onClick={onToggle}
            className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-indigo-600 transition-colors ml-auto"
          >
            {isExpanded
              ? <><ChevronUp size={10} /> {node.children.length}</>
              : <><ChevronDown size={10} /> {node.children.length}</>
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
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (e: Employee) => void
  readOnly?: boolean
  tenantAdminEmails?: string[]
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
      />

      {hasChildren && isExpanded && (
        <>
          {/* Vertical line from card down to horizontal bar */}
          <div className="w-px h-7 bg-slate-300" />
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
          className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-full px-2.5 py-0.5 transition-colors"
        >
          <ChevronDown size={9} />
          {node.children.length} report{node.children.length !== 1 ? 's' : ''} hidden
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
}

export default function OrgChartView({ employees, levelConfigs, onEdit, readOnly = false, tenantAdminEmails }: Props) {
  const tree = useMemo(() => buildTree(employees), [employees])

  // Default: expand L0 and L1 only
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    employees.filter(e => e.level <= 1).forEach(e => s.add(e.id))
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
    <div className="flex flex-col h-full overflow-hidden">

      {/* Level legend strip */}
      <div className="flex-shrink-0 flex items-center gap-1.5 px-5 py-2.5 bg-white border-b border-gray-200 flex-wrap">
        {presentLevels.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1.5">
            <span
              className="flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-md"
              style={{ background: levelColor(level) }}
            >
              L{level}
            </span>
            <span className="text-[11px] font-semibold text-gray-600">{label}</span>
            {level < presentLevels[presentLevels.length - 1].level && (
              <span className="text-gray-200 text-sm">·</span>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={expandAll}   className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
        </div>
      </div>

      {/* Chart canvas — scrollable in both directions */}
      <div className="flex-1 overflow-auto p-8">
        <div className={`inline-flex gap-12 items-start ${tree.length === 1 ? 'flex-col items-center min-w-full' : 'flex-row'}`}>
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}
