'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { Employee, OrgLevelConfig } from '@/lib/types'

interface Props {
  mode: 'add' | 'edit'
  initial?: Partial<Employee>
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
  onSave: (data: Omit<Employee, 'id' | 'organization_id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

export default function EmployeeModal({
  mode, initial, employees, levelConfigs, onSave, onCancel, loading = false, error,
}: Props) {
  const firstRef = useRef<HTMLInputElement>(null)

  const [employeeId, setEmployeeId] = useState(initial?.employee_id ?? '')
  const [firstName, setFirstName]   = useState(initial?.first_name ?? '')
  const [lastName, setLastName]     = useState(initial?.last_name ?? '')
  const [email, setEmail]           = useState(initial?.email ?? '')
  const [teamName, setTeamName]     = useState(initial?.team_name ?? '')
  const [managerId, setManagerId]   = useState<string>(initial?.manager_id ?? '')

  useEffect(() => { firstRef.current?.focus() }, [])

  // Derive level from selected manager
  const managerEmployee = employees.find(e => e.id === managerId)
  const derivedLevel = managerEmployee ? managerEmployee.level + 1 : null

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`

  // All existing employees can be managers (except self)
  const possibleManagers = employees.filter(e => e.id !== initial?.id)

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
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    await onSave({
      employee_id: employeeId.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: fullName,
      email: email.trim() || null,
      team_name: teamName.trim(),
      level: derivedLevel!,
      manager_id: managerId,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-100 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-base">
              {mode === 'add' ? 'Add Employee' : 'Edit Employee'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Level is automatically set from the selected manager</p>
          </div>
          <button onClick={onCancel} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

            {/* Employee ID — mandatory */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Employee ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                placeholder="EMP001"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            {/* First + Last name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstRef}
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Email + Team Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="jane@company.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Team Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Engineering Alpha"
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Manager — mandatory, level auto-derived */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Manager <span className="text-red-500">*</span>
              </label>
              <select
                value={managerId}
                onChange={e => setManagerId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              >
                <option value="">— Select manager —</option>
                {possibleManagers.map(m => (
                  <option key={m.id} value={m.id}>
                    [{m.employee_id ?? '—'}] {m.full_name} · {getLabel(m.level)}
                  </option>
                ))}
              </select>

              {/* Level badge — auto derived */}
              {derivedLevel !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Auto-assigned level:</span>
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white"
                    style={{ background: levelColor(derivedLevel) }}
                  >
                    L{derivedLevel} — {getLabel(derivedLevel)}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#162d4a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving…' : mode === 'add' ? 'Add Employee' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
