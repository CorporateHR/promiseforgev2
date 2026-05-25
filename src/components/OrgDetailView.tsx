'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { assignTenantAdmin } from '@/app/actions/org'
import { setOrgBudget } from '@/app/actions/budget'
import OrgChartView from './OrgChartView'
import EmployeeUploadModal from './EmployeeUploadModal'
import { ArrowLeft, Users, Upload, ShieldCheck, X, Search, Loader2, Coins } from 'lucide-react'
import type { Organization, Employee, OrgLevelConfig } from '@/lib/types'

// ─── Set Budget Modal ─────────────────────────────────────────────────────────
function SetBudgetModal({ orgId, currentBudget, onSaved, onClose }: {
  orgId: string
  currentBudget: number | null
  onSaved: (tokens: number) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(currentBudget?.toString() ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    const tokens = parseInt(value)
    if (!tokens || tokens <= 0) { setError('Enter a valid number of tokens'); return }
    setError(null)
    setLoading(true)
    const result = await setOrgBudget(orgId, tokens)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSaved(tokens)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">Set Token Budget</h2>
            <p className="text-xs text-gray-400 mt-0.5">Total tokens the tenant admin can allocate</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Total Tokens <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 focus-within:bg-white focus-within:border-blue-400 transition-colors">
              <Coins size={14} className="text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                type="number"
                min="1"
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="e.g. 10000"
                className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
              />
              <span className="text-xs text-gray-400 flex-shrink-0">tokens</span>
            </div>
            {currentBudget && (
              <p className="text-xs text-gray-400 mt-1">Current budget: {currentBudget.toLocaleString()} tokens</p>
            )}
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={loading || !value}
              className="flex-1 py-2.5 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><Coins size={14} /> Set Budget</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Tenant Admin Modal ────────────────────────────────────────────────
function AssignTenantAdminModal({ employees, orgId, onAssigned, onClose }: {
  employees: Employee[]
  orgId: string
  onAssigned: (emp: Employee) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    return (
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      (e.employee_id ?? '').toLowerCase().includes(q) ||
      (e.email ?? '').toLowerCase().includes(q)
    )
  })

  async function handleAssign() {
    if (!selected?.email) { setError('This employee has no email — they need an account first.'); return }
    setError(null)
    setLoading(true)
    const result = await assignTenantAdmin(selected.email, orgId)
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onAssigned(selected)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Assign Tenant Admin</h2>
            <p className="text-xs text-gray-400 mt-0.5">This person will manage the organization dashboard</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name, ID or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No employees match</p>
          ) : (
            filtered.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelected(emp)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  selected?.id === emp.id
                    ? 'bg-indigo-50 border border-indigo-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {emp.first_name[0]}{emp.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900">{emp.first_name} {emp.last_name}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {emp.employee_id && <span className="font-mono mr-2">{emp.employee_id}</span>}
                    {emp.email ?? <span className="text-red-400">no email</span>}
                  </div>
                </div>
                {selected?.id === emp.id && <ShieldCheck size={16} className="text-indigo-500 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-3">{error}</div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleAssign} disabled={!selected || loading}
              className="flex-1 py-2.5 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading
                ? <><Loader2 size={14} className="animate-spin" /> Assigning…</>
                : <><ShieldCheck size={14} /> Assign as Tenant Admin</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Small stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ─── Challenge row (read-only) ────────────────────────────────────────────────
function ChallengeRow({ challenge, completionCount, employeeCount }: {
  challenge: { id: string; title: string; status: string; token_budget: number }
  completionCount: number
  employeeCount: number
}) {
  const pct = employeeCount > 0 ? Math.round((completionCount / employeeCount) * 100) : 0
  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    draft:  'bg-gray-100 text-gray-500',
    ended:  'bg-slate-100 text-slate-500',
  }
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 truncate">{challenge.title}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${statusStyles[challenge.status] ?? 'bg-gray-100 text-gray-500'}`}>
            {challenge.status}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${challenge.status === 'ended' ? 'bg-slate-400' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-bold text-gray-700 tabular-nums">{completionCount}/{employeeCount}</p>
        <p className="text-[10px] text-gray-400">{challenge.token_budget.toLocaleString()} tk budget</p>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface Props {
  org: Organization
  initialEmployees: Employee[]
  initialLevelConfigs: OrgLevelConfig[]
  initialTenantAdminEmails?: string[]
  initialBudget: number | null
  initialChallenges?: { id: string; title: string; status: string; token_budget: number }[]
  initialManagerBudgets?: { manager_id: string; tokens: number }[]
  initialCompletions?: { challenge_id: string; employee_id: string }[]
}

type Tab = 'overview' | 'chart'

export default function OrgDetailView({
  org, initialEmployees, initialLevelConfigs, initialTenantAdminEmails, initialBudget,
  initialChallenges = [], initialManagerBudgets = [], initialCompletions = [],
}: Props) {
  const router = useRouter()
  const [employees, setEmployees] = useState(initialEmployees)
  const [tenantAdminEmails, setTenantAdminEmails] = useState<string[]>(initialTenantAdminEmails ?? [])
  const [showUpload, setShowUpload] = useState(false)
  const [showAssignAdmin, setShowAssignAdmin] = useState(false)
  const [showSetBudget, setShowSetBudget] = useState(false)
  const [budget, setBudget] = useState<number | null>(initialBudget)
  const [tab, setTab] = useState<Tab>('overview')

  function handleImported(newEmployees: Employee[]) {
    setEmployees(prev => [...prev, ...newEmployees])
    setShowUpload(false)
  }

  // Derived metrics
  const managerAllocated = initialManagerBudgets.reduce((s, b) => s + b.tokens, 0)
  const activeChallenges = initialChallenges.filter(c => c.status === 'active')
  const draftChallenges  = initialChallenges.filter(c => c.status === 'draft')
  const endedChallenges  = initialChallenges.filter(c => c.status === 'ended')
  // Active + draft challenges have tokens reserved (ended ones are settled)
  const challengeReserved = initialChallenges
    .filter(c => c.status !== 'ended')
    .reduce((s, c) => s + c.token_budget, 0)
  const totalConsumed = managerAllocated + challengeReserved
  const remaining = budget !== null ? budget - totalConsumed : null
  const usedPct = budget && budget > 0 ? Math.min(100, (totalConsumed / budget) * 100) : 0
  const isOver = remaining !== null && remaining < 0

  // Completion map: challengeId → count
  const completionMap = new Map<string, number>()
  for (const c of initialCompletions) {
    completionMap.set(c.challenge_id, (completionMap.get(c.challenge_id) ?? 0) + 1)
  }

  const levelCount = new Set(employees.map(e => e.level)).size

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft size={14} /> Organizations
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800">{org.name}</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
          {employees.length} people
        </span>
        {budget !== null && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <Coins size={11} /> {budget.toLocaleString()} tokens
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 ml-2">
          {(['overview', 'chart'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold capitalize transition-all ${
                tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'overview' ? 'Overview' : 'Org Chart'}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowSetBudget(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200 hover:border-amber-200">
            <Coins size={14} /> {budget ? 'Edit Budget' : 'Set Budget'}
          </button>
          <button onClick={() => setShowAssignAdmin(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-indigo-700 bg-gray-100 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200 hover:border-indigo-200">
            <ShieldCheck size={14} /> Assign Tenant Admin
          </button>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-[#1e3a5f] hover:bg-[#162d4a] text-white px-3 py-1.5 rounded-lg transition-colors">
            <Upload size={14} /> Upload CSV
          </button>
        </div>
      </div>

      {/* ── Overview tab ── */}
      {tab === 'overview' && (
        <div className="flex-1 overflow-y-auto bg-gray-50 px-8 py-8 space-y-6">

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Employees" value={employees.length.toLocaleString()} sub={`${levelCount} levels`} />
            <StatCard
              label="Token Budget"
              value={budget !== null ? budget.toLocaleString() : '—'}
              sub={budget !== null ? `${totalConsumed.toLocaleString()} consumed` : 'Not set yet'}
              accent={budget !== null ? undefined : 'text-gray-400'}
            />
            <StatCard
              label="Challenges"
              value={initialChallenges.length.toLocaleString()}
              sub={`${activeChallenges.length} active · ${draftChallenges.length} draft`}
            />
            <StatCard
              label="Completions"
              value={initialCompletions.length.toLocaleString()}
              sub={`across ${activeChallenges.length + endedChallenges.length} run challenges`}
            />
          </div>

          {/* Budget breakdown */}
          {budget !== null && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-4">Budget Overview</p>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Total</p>
                  <p className="text-2xl font-black text-gray-900 tabular-nums">{budget.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Manager budgets</p>
                  <p className="text-2xl font-black text-gray-900 tabular-nums">{managerAllocated.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{initialManagerBudgets.length} managers</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">Challenge reserves</p>
                  <p className="text-2xl font-black text-gray-900 tabular-nums">{challengeReserved.toLocaleString()}</p>
                  <p className="text-[10px] text-gray-400">{activeChallenges.length + draftChallenges.length} active/draft</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 mb-0.5">{isOver ? 'Over budget' : 'Remaining'}</p>
                  <p className={`text-2xl font-black tabular-nums ${isOver ? 'text-red-600' : 'text-emerald-600'}`}>
                    {remaining !== null ? Math.abs(remaining).toLocaleString() : '—'}
                  </p>
                </div>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : usedPct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">{usedPct.toFixed(0)}% consumed ({totalConsumed.toLocaleString()} of {budget.toLocaleString()} tokens)</p>
            </div>
          )}

          {/* Challenges */}
          {initialChallenges.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Challenges</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {activeChallenges.length} active · {draftChallenges.length} draft · {endedChallenges.length} ended
                </p>
              </div>
              <div>
                {initialChallenges.map(c => (
                  <ChallengeRow
                    key={c.id}
                    challenge={c}
                    completionCount={completionMap.get(c.id) ?? 0}
                    employeeCount={employees.length}
                  />
                ))}
              </div>
            </div>
          )}

          {initialChallenges.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <p className="text-sm font-semibold">No challenges created yet</p>
              <p className="text-xs mt-1">The tenant admin creates challenges from their dashboard.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Chart tab ── */}
      {tab === 'chart' && (
        <div className="flex-1 overflow-hidden">
          {employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Users size={40} className="mb-3 text-gray-200" />
              <p className="text-sm">No employees yet.</p>
              <button onClick={() => setShowUpload(true)}
                className="mt-4 flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors">
                <Upload size={14} /> Upload CSV to add employees
              </button>
            </div>
          ) : (
            <OrgChartView
              employees={employees}
              levelConfigs={initialLevelConfigs}
              onEdit={() => {}}
              readOnly
              tenantAdminEmails={tenantAdminEmails}
            />
          )}
        </div>
      )}

      {showSetBudget && (
        <SetBudgetModal orgId={org.id} currentBudget={budget} onSaved={setBudget} onClose={() => setShowSetBudget(false)} />
      )}
      {showUpload && (
        <EmployeeUploadModal employees={employees} levelConfigs={initialLevelConfigs} orgId={org.id} onImported={handleImported} onCancel={() => setShowUpload(false)} />
      )}
      {showAssignAdmin && (
        <AssignTenantAdminModal
          employees={employees}
          orgId={org.id}
          onAssigned={emp => { if (emp.email) setTenantAdminEmails(prev => [...prev, emp.email!]) }}
          onClose={() => setShowAssignAdmin(false)}
        />
      )}
    </div>
  )
}
