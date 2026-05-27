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
      className={`w-52 bg-white rounded-2xl border-2 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group relative ${
        isTenantAdmin ? 'border-amber-400 ring-2 ring-amber-200/50' : 'border-gray-200 hover:border-indigo-300'
      }`}
    >
      {/* Accent bar */}
      <div 
        className="h-1.5 w-full"
        style={{ background: isTenantAdmin ? '#f59e0b' : color }}
      />

      {/* Card content */}
      <div className="p-4">
        {/* Level badge + Admin badge */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="text-[10px] font-black text-white px-2.5 py-1 rounded-lg shadow-sm flex-shrink-0"
            style={{ background: isTenantAdmin ? '#f59e0b' : color }}
          >
            L{node.level}
          </span>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider truncate">
            {label}
          </span>
          {isTenantAdmin && (
            <ShieldCheck size={13} className="text-amber-500 flex-shrink-0 ml-auto" />
          )}
        </div>

        {/* Name */}
        <div className="mb-3">
          <div className="text-base font-extrabold text-gray-900 leading-tight mb-0.5">
            {node.first_name}
          </div>
          <div className="text-base font-semibold text-gray-700 leading-tight">
            {node.last_name}
          </div>
          {isTenantAdmin && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600 mt-1.5">
              <ShieldCheck size={11} /> Tenant Admin
            </div>
          )}
        </div>

        {/* Meta info */}
        <div className="space-y-1.5">
          {node.employee_id && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
              <span className="font-mono font-semibold">{node.employee_id}</span>
            </div>
          )}
          {node.team_name && (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Users size={11} className="flex-shrink-0" />
              <span className="font-medium truncate">{node.team_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-br from-gray-50 to-gray-100/50 border-t border-gray-200">
        {!isL0 && !readOnly ? (
          <button
            onClick={() => onEdit(node)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 hover:text-indigo-600 transition-all opacity-0 group-hover:opacity-100 hover:scale-105"
          >
            <Pencil size={11} /> Edit
          </button>
        ) : <div />}

        {hasChildren && (
          <button
            onClick={onToggle}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ml-auto ${
              isExpanded 
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
          >
            {isExpanded
              ? <><ChevronUp size={12} /> {node.children.length}</>
              : <><ChevronDown size={12} /> {node.children.length}</>
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
          {/* Vertical connector line */}
          <div className="w-0.5 h-8 bg-gradient-to-b from-indigo-300 to-indigo-200 rounded-full" />
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
          className="mt-3 flex items-center gap-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 hover:border-indigo-300 rounded-xl px-4 py-2 transition-all shadow-sm hover:shadow-md hover:scale-105"
        >
          <ChevronDown size={13} />
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
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 to-indigo-50">

      {/* Level legend strip */}
      <div className="flex-shrink-0 flex items-center gap-2 px-6 py-4 bg-white/80 backdrop-blur-sm border-b-2 border-gray-200 shadow-sm flex-wrap">
        {presentLevels.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 text-[11px] font-black text-white px-3 py-1.5 rounded-lg shadow-sm"
              style={{ background: levelColor(level) }}
            >
              L{level}
            </span>
            <span className="text-[12px] font-bold text-gray-700">{label}</span>
            {level < presentLevels[presentLevels.length - 1].level && (
              <span className="text-gray-300 text-base mx-1">•</span>
            )}
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={expandAll} 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
          >
            Expand all
          </button>
          <button 
            onClick={collapseAll} 
            className="text-xs font-semibold text-gray-600 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm"
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
            />
          ))}
        </div>
      </div>
    </div>
  )
}
