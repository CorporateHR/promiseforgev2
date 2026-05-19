'use client'

import { Mail, Users, Building2 } from 'lucide-react'
import type { Employee, OrgLevelConfig, Organization } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }

interface Props {
  employee: Employee
  manager: Employee | null
  peers: Employee[]
  directReports: Employee[]
  levelConfigs: OrgLevelConfig[]
  organization: Organization
}

export default function EmployeePortal({
  employee,
  manager,
  peers,
  directReports,
  levelConfigs,
  organization,
}: Props) {
  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const color = levelColor(employee.level)
  const isManager = directReports.length > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Org badge */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Building2 size={14} className="text-indigo-500" />
          <span className="font-semibold text-gray-700">{organization.name}</span>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="h-2 w-full" style={{ background: color }} />
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-sm"
                style={{ background: color }}
              >
                {employee.first_name[0]}{employee.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-extrabold text-gray-900">
                    {employee.first_name} {employee.last_name}
                  </h1>
                  <span
                    className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
                    style={{ background: color }}
                  >
                    L{employee.level} · {getLabel(employee.level)}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-gray-200 text-gray-500 bg-gray-50">
                    {isManager ? 'Manager' : 'Employee'}
                  </span>
                </div>
                {employee.employee_id && (
                  <div className="text-xs font-mono text-gray-400 mt-0.5">{employee.employee_id}</div>
                )}
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {employee.email && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Mail size={13} className="text-gray-400" />
                      {employee.email}
                    </div>
                  )}
                  {employee.team_name && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users size={13} className="text-gray-400" />
                      {employee.team_name}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manager */}
        {manager && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Reports To</h2>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                style={{ background: levelColor(manager.level) }}
              >
                {manager.first_name[0]}{manager.last_name[0]}
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {manager.first_name} {manager.last_name}
                </div>
                <div className="text-xs text-gray-400">
                  {manager.employee_id && <span className="font-mono mr-2">{manager.employee_id}</span>}
                  L{manager.level} · {getLabel(manager.level)}
                  {manager.team_name && ` · ${manager.team_name}`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Direct reports — only shown if manager */}
        {directReports.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Direct Reports <span className="text-gray-300 font-normal">({directReports.length})</span>
            </h2>
            <div className="space-y-2">
              {directReports.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                    style={{ background: levelColor(r.level) }}
                  >
                    {r.first_name[0]}{r.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">{r.first_name} {r.last_name}</div>
                    <div className="text-[11px] text-gray-400">
                      {r.employee_id && <span className="font-mono mr-1.5">{r.employee_id}</span>}
                      {r.team_name}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ background: levelColor(r.level) }}
                  >
                    L{r.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Peers */}
        {peers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              Peers <span className="text-gray-300 font-normal">({peers.length})</span>
            </h2>
            <div className="space-y-2">
              {peers.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                    style={{ background: levelColor(p.level) }}
                  >
                    {p.first_name[0]}{p.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-800">
                      {p.first_name} {p.last_name}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {p.employee_id && <span className="font-mono mr-1.5">{p.employee_id}</span>}
                      {p.team_name}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
