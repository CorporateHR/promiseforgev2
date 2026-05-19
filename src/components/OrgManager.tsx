'use client'

import { useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronRight,
  Users, User, Building2, Search, X, List, GitFork, Coins,
} from 'lucide-react'
import EmployeeModal from './EmployeeModal'
import OrgChartView from './OrgChartView'
import LevelConfigPanel from './LevelConfigPanel'
import BudgetTab from './BudgetTab'
import type { Organization, Employee, OrgLevelConfig, EmployeeNode, ManagerBudget } from '@/lib/types'

interface Props {
  organization: Organization
  initialLevelConfigs: OrgLevelConfig[]
  initialEmployees: Employee[]
  orgId: string
  totalBudget: number | null
  initialManagerBudgets: ManagerBudget[]
}

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

// Build recursive tree from flat list
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

// ─── Delete confirm modal ─────────────────────────────────────────
function DeleteModal({
  employee,
  childCount,
  onConfirm,
  onCancel,
  loading,
  error,
}: {
  employee: Employee
  childCount: number
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Delete Employee</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{employee.full_name}</strong>?
          </p>
          {childCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-2">
              ⚠ This person has <strong>{childCount} direct report{childCount !== 1 ? 's' : ''}</strong>. Their manager will be set to none.
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
          )}
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Employee card ────────────────────────────────────────────────
function EmployeeCard({
  node,
  levelConfigs,
  allEmployees,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  depth = 0,
}: {
  node: EmployeeNode
  levelConfigs: OrgLevelConfig[]
  allEmployees: Employee[]
  expanded: Set<string>
  onToggle: (id: string) => void
  onEdit: (e: Employee) => void
  onDelete: (e: Employee) => void
  onAddChild: (managerId: string, defaultLevel: number) => void
  depth?: number
}) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const label = levelConfigs.find(c => c.level === node.level)?.label ?? `L${node.level}`
  const color = levelColor(node.level)
  const isL0 = node.level === 0

  return (
    <div style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      {/* Connector line */}
      <div className="relative">
        {depth > 0 && (
          <div
            className="absolute left-[-20px] top-[22px] bottom-0 w-px bg-gray-200"
            style={{ top: 0, height: '100%' }}
          />
        )}

        <div className="group flex items-start gap-2 py-1">
          {/* Expand toggle */}
          <button
            onClick={() => hasChildren && onToggle(node.id)}
            className={`mt-2 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${
              hasChildren ? 'text-gray-400 hover:text-gray-600 hover:bg-gray-100' : 'text-transparent'
            }`}
          >
            {hasChildren
              ? isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
              : null}
          </button>

          {/* Card */}
          <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-gray-300 transition-all overflow-hidden">
            <div className="flex items-center gap-3 px-3 py-2.5">
              {/* Level badge */}
              <div
                className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-black text-xs shadow-sm"
                style={{ background: color }}
              >
                L{node.level}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-gray-900 truncate">
                    {node.first_name} <span className="font-semibold">{node.last_name}</span>
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    style={{ background: `${color}14`, borderColor: `${color}40`, color }}
                  >
                    {label}
                  </span>
                  {node.employee_id && (
                    <span className="text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                      {node.employee_id}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {node.email && <span className="text-[11px] text-gray-400 truncate">{node.email}</span>}
                  {node.team_name && (
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Users size={9} /> {node.team_name}
                    </span>
                  )}
                  {hasChildren && (
                    <span className="text-[11px] text-gray-400">
                      {node.children.length} direct report{node.children.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onAddChild(node.id, node.level + 1)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border border-dashed border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                >
                  <Plus size={10} /> Add report
                </button>
                {!isL0 && (
                  <>
                    <button
                      onClick={() => onEdit(node)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDelete(node)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="relative ml-6 pl-4 border-l border-gray-200 mt-1 space-y-1">
            {node.children.map(child => (
              <EmployeeCard
                key={child.id}
                node={child}
                levelConfigs={levelConfigs}
                allEmployees={allEmployees}
                expanded={expanded}
                onToggle={onToggle}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Add Employee Panel ───────────────────────────────────────────
function AddEmployeePanel({
  employees,
  levelConfigs,
  initialManagerId,
  onSave,
  onCancel,
  loading,
  error,
}: {
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  initialManagerId?: string
  onSave: (data: Omit<Employee, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [firstName, setFirstName]   = useState('')
  const [lastName, setLastName]     = useState('')
  const [email, setEmail]           = useState('')
  const [teamName, setTeamName]     = useState('')
  const [managerId, setManagerId]   = useState<string>(initialManagerId ?? '')
  const [managerSearch, setManagerSearch] = useState('')
  const [managerOpen, setManagerOpen]     = useState(!initialManagerId)

  const selectedManager = employees.find(e => e.id === managerId)
  const derivedLevel    = selectedManager ? selectedManager.level + 1 : null
  const getLabel        = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  const filteredManagers = useMemo(() => {
    const q = managerSearch.toLowerCase()
    return employees.filter(e =>
      !q ||
      e.full_name.toLowerCase().includes(q) ||
      (e.employee_id ?? '').toLowerCase().includes(q) ||
      (e.team_name ?? '').toLowerCase().includes(q)
    )
  }, [employees, managerSearch])

  const canSubmit =
    employeeId.trim() !== '' &&
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    teamName.trim() !== '' &&
    managerId !== '' &&
    derivedLevel !== null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    await onSave({
      employee_id: employeeId.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      email: email.trim() || null,
      team_name: teamName.trim(),
      level: derivedLevel!,
      manager_id: managerId,
    })
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Add Employee</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Level is automatically set from manager</p>
        </div>
        <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
          <X size={14} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
        <div className="px-4 py-4 space-y-3 flex-1">

          {/* Employee ID */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Employee ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={employeeId} onChange={e => setEmployeeId(e.target.value)}
              placeholder="EMP001"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                First Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                Last Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="jane@company.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Team */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
              placeholder="Engineering Alpha"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Manager searchable picker */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
              Manager <span className="text-red-500">*</span>
            </label>

            {/* Selected manager chip */}
            {selectedManager && !managerOpen && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-indigo-200 bg-indigo-50 mb-2">
                <div
                  className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ background: levelColor(selectedManager.level) }}
                >
                  L{selectedManager.level}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-900 truncate">{selectedManager.full_name}</div>
                  <div className="text-[10px] text-gray-400">
                    {selectedManager.employee_id && <span className="font-mono mr-1">{selectedManager.employee_id}</span>}
                    {getLabel(selectedManager.level)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setManagerId(''); setManagerSearch(''); setManagerOpen(true) }}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Level auto-badge */}
            {derivedLevel !== null && (
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px] text-gray-500">Will be assigned:</span>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: levelColor(derivedLevel) }}
                >
                  L{derivedLevel} — {getLabel(derivedLevel)}
                </span>
              </div>
            )}

            {/* Search + dropdown */}
            {(!selectedManager || managerOpen) && (
              <div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-2 mb-1">
                  <Search size={12} className="text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    autoFocus={!initialManagerId}
                    value={managerSearch}
                    onChange={e => { setManagerSearch(e.target.value); setManagerOpen(true) }}
                    onFocus={() => setManagerOpen(true)}
                    placeholder="Search by name or ID…"
                    className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder-gray-400"
                  />
                </div>
                {managerOpen && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    {filteredManagers.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">No matches</p>
                    ) : filteredManagers.map(m => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => { setManagerId(m.id); setManagerOpen(false); setManagerSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition-colors"
                      >
                        <div
                          className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                          style={{ background: levelColor(m.level) }}
                        >
                          L{m.level}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-gray-900 truncate">{m.full_name}</div>
                          <div className="text-[10px] text-gray-400">
                            {m.employee_id && <span className="font-mono">{m.employee_id}</span>}
                            {m.team_name && <span className="ml-1">· {m.team_name}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex gap-2 flex-shrink-0">
          <button type="button" onClick={onCancel}
            className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading || !canSubmit}
            className="flex-1 py-2 text-xs font-semibold text-white bg-[#1e3a5f] hover:bg-[#162d4a] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? 'Adding…' : 'Add Employee'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Main OrgManager ──────────────────────────────────────────────
export default function OrgManager({
  organization,
  initialLevelConfigs,
  initialEmployees,
  orgId,
  totalBudget,
  initialManagerBudgets,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const refresh = useCallback(() => router.refresh(), [router])

  const [levelConfigs, setLevelConfigs] = useState<OrgLevelConfig[]>(initialLevelConfigs)
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees)
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(initialEmployees.filter(e => e.level === 0).map(e => e.id))
  )
  const [search, setSearch] = useState('')

  const [activeView, setActiveView] = useState<'list' | 'chart' | 'budget'>('list')

  // Modal state
  const [addModal, setAddModal] = useState<{ managerId?: string; defaultLevel?: number } | null>(null)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [levelSaving, setLevelSaving] = useState(false)

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Expand all / collapse all
  const expandAll = () => setExpanded(new Set(employees.map(e => e.id)))
  const collapseAll = () => setExpanded(new Set(employees.filter(e => e.level === 0).map(e => e.id)))

  // Filter employees by search
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employees
    const q = search.toLowerCase()
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.team_name?.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q)
    )
  }, [employees, search])

  const tree = useMemo(() => buildTree(filteredEmployees), [filteredEmployees])

  const countByLevel = useMemo(() =>
    employees.reduce((acc, e) => {
      acc[e.level] = (acc[e.level] ?? 0) + 1
      return acc
    }, {} as Record<number, number>),
    [employees]
  )

  // ─── Employee CRUD ───────────────────────────────────────────────
  async function handleAddEmployee(data: Omit<Employee, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    setModalLoading(true)
    setModalError(null)
    try {
      const { data: emp, error } = await supabase
        .from('employees')
        .insert({ ...data, organization_id: orgId })
        .select()
        .single()
      if (error) throw error
      setEmployees(prev => [...prev, emp])
      setExpanded(prev => {
        const next = new Set(prev)
        if (data.manager_id) next.add(data.manager_id)
        return next
      })
      setAddModal(null)
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to add employee')
    } finally {
      setModalLoading(false)
    }
  }

  async function handleEditEmployee(data: Omit<Employee, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) {
    if (!editEmployee) return
    setModalLoading(true)
    setModalError(null)
    try {
      const { data: emp, error } = await supabase
        .from('employees')
        .update(data)
        .eq('id', editEmployee.id)
        .select()
        .single()
      if (error) throw error
      setEmployees(prev => prev.map(e => e.id === emp.id ? emp : e))
      setEditEmployee(null)
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to update employee')
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDeleteEmployee() {
    if (!deleteEmployee) return
    setModalLoading(true)
    setModalError(null)
    try {
      const { error } = await supabase.from('employees').delete().eq('id', deleteEmployee.id)
      if (error) throw error
      setEmployees(prev => prev.filter(e => e.id !== deleteEmployee.id))
      setDeleteEmployee(null)
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to delete employee')
    } finally {
      setModalLoading(false)
    }
  }

  // ─── Level Config CRUD ───────────────────────────────────────────
  async function handleSaveLevels(configs: { level: number; label: string }[]) {
    setLevelSaving(true)
    try {
      for (const { level, label } of configs) {
        await supabase
          .from('org_level_configs')
          .upsert({ organization_id: orgId, level, label }, { onConflict: 'organization_id,level' })
      }
      // Refresh local state
      const { data } = await supabase
        .from('org_level_configs')
        .select('*')
        .eq('organization_id', orgId)
        .order('level')
      if (data) setLevelConfigs(data)
    } finally {
      setLevelSaving(false)
    }
  }

  async function handleAddLevel(level: number, label: string) {
    const { data, error } = await supabase
      .from('org_level_configs')
      .insert({ organization_id: orgId, level, label })
      .select()
      .single()
    if (!error && data) setLevelConfigs(prev => [...prev, data].sort((a, b) => a.level - b.level))
  }

  async function handleDeleteLevel(level: number) {
    if (countByLevel[level] > 0) return // Don't delete levels with employees
    await supabase
      .from('org_level_configs')
      .delete()
      .eq('organization_id', orgId)
      .eq('level', level)
    setLevelConfigs(prev => prev.filter(c => c.level !== level))
  }

  // ─── Effective level configs — includes auto-entries for levels with employees ──
  const effectiveLevelConfigs = useMemo(() => {
    const configured = new Map(levelConfigs.map(c => [c.level, c]))
    const presentLevels = [...new Set(employees.map(e => e.level))].sort((a, b) => a - b)
    const merged: OrgLevelConfig[] = presentLevels.map(l =>
      configured.get(l) ?? {
        id: `auto-${l}`,
        organization_id: orgId,
        level: l,
        label: `L${l}`,
        created_at: '',
        updated_at: '',
      }
    )
    // Also include configured levels not yet populated
    for (const c of levelConfigs) {
      if (!merged.find(m => m.level === c.level)) merged.push(c)
    }
    return merged.sort((a, b) => a.level - b.level)
  }, [levelConfigs, employees, orgId])

  // ─── Stats ────────────────────────────────────────────────────────
  const totalEmployees = employees.length
  const maxLevel = Math.max(...employees.map(e => e.level), 0)

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Left: Level config (only in list view, not when budget tab active) */}
      {activeView === 'list' && addModal === null && (
        <LevelConfigPanel
          levelConfigs={effectiveLevelConfigs}
          employeeCountByLevel={countByLevel}
          onSave={handleSaveLevels}
          onAddLevel={handleAddLevel}
          onDeleteLevel={handleDeleteLevel}
          saving={levelSaving}
        />
      )}

      {/* Right: content area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Building2 size={17} className="text-indigo-600 flex-shrink-0" />
            <div>
              <h1 className="text-sm font-extrabold text-gray-900 leading-tight">{organization.name}</h1>
              <p className="text-[11px] text-gray-400">
                {totalEmployees} {totalEmployees === 1 ? 'person' : 'people'} · {maxLevel + 1} level{maxLevel + 1 !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Search — only in list view */}
          {activeView === 'list' && (
            <div className="relative flex-1 max-w-xs ml-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search employees…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-xs focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* List/Chart/Budget tabs */}
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveView('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeView === 'list'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <List size={12} /> List
              </button>
              <button
                onClick={() => setActiveView('chart')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeView === 'chart'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <GitFork size={12} /> Chart
              </button>
              <button
                onClick={() => setActiveView('budget')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                  activeView === 'budget'
                    ? 'bg-white shadow text-gray-900'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Coins size={12} /> Budget
              </button>
            </div>

            {activeView === 'list' && (
              <>
                <button onClick={expandAll}  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Expand all</button>
                <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Collapse</button>
              </>
            )}
            <button
              onClick={() => { setAddModal({}); setModalError(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Plus size={12} /> Add Employee
            </button>
          </div>
        </div>

        {/* ── Budget view ── */}
        {activeView === 'budget' && (
          <BudgetTab
            orgId={orgId}
            employees={employees}
            levelConfigs={effectiveLevelConfigs}
            totalBudget={totalBudget}
            initialAllocations={initialManagerBudgets}
          />
        )}

        {/* ── Chart view ── */}
        {activeView === 'chart' && (
          <OrgChartView
            employees={employees}
            levelConfigs={effectiveLevelConfigs}
            onEdit={emp => { setEditEmployee(emp); setModalError(null) }}
          />
        )}

        {/* ── List view ── */}
        {activeView === 'list' && (
          <div className="flex-1 overflow-auto px-5 py-4">
            {tree.length === 0 && !search ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <User size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-500 font-semibold text-sm">No employees yet</p>
                <p className="text-gray-400 text-xs mt-1 mb-4">Your L0 Tenant Admin should appear here</p>
                <button onClick={refresh} className="text-xs text-indigo-600 hover:underline">Refresh</button>
              </div>
            ) : search && filteredEmployees.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                No employees match &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="space-y-1 max-w-3xl">
                {tree.map(node => (
                  <EmployeeCard
                    key={node.id}
                    node={node}
                    levelConfigs={effectiveLevelConfigs}
                    allEmployees={employees}
                    expanded={expanded}
                    onToggle={toggle}
                    onEdit={emp => { setEditEmployee(emp); setModalError(null) }}
                    onDelete={emp => { setDeleteEmployee(emp); setModalError(null) }}
                    onAddChild={(managerId, defaultLevel) => {
                      setAddModal({ managerId, defaultLevel })
                      setModalError(null)
                      setExpanded(prev => { const n = new Set(prev); n.add(managerId); return n })
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Employee panel (right column) */}
      {addModal !== null && (
        <AddEmployeePanel
          employees={employees}
          levelConfigs={effectiveLevelConfigs}
          initialManagerId={addModal.managerId}
          onSave={handleAddEmployee}
          onCancel={() => setAddModal(null)}
          loading={modalLoading}
          error={modalError}
        />
      )}

      {/* Edit Modal */}
      {editEmployee && (
        <EmployeeModal
          mode="edit"
          initial={editEmployee}
          employees={employees}
          levelConfigs={levelConfigs}
          onSave={handleEditEmployee}
          onCancel={() => setEditEmployee(null)}
          loading={modalLoading}
          error={modalError}
        />
      )}

      {/* Delete Modal */}
      {deleteEmployee && (
        <DeleteModal
          employee={deleteEmployee}
          childCount={employees.filter(e => e.manager_id === deleteEmployee.id).length}
          onConfirm={handleDeleteEmployee}
          onCancel={() => setDeleteEmployee(null)}
          loading={modalLoading}
          error={modalError}
        />
      )}

    </div>
  )
}
