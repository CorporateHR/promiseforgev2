'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Users, Building2, Trophy, Calendar, Zap, CheckCircle2, ChevronRight, User, Coins, RefreshCw, ShoppingBag } from 'lucide-react'
import EmployeeEarningsTab, { type EarnedEntry, computeEarnings } from './EmployeeEarningsTab'
import EmployeeMarketplaceTab from './EmployeeMarketplaceTab'
import type { Employee, OrgLevelConfig, Organization, ChallengeWithTiers } from '@/lib/types'

const LEVEL_COLORS = [
  '#1e3a5f', '#3730a3', '#0f766e', '#92400e',
  '#5b21b6', '#1d4ed8', '#0369a1', '#065f46',
]
function levelColor(l: number) { return LEVEL_COLORS[l % LEVEL_COLORS.length] }
function fmt(n: number) { return n.toLocaleString() }

// ─── Compact challenge list card (click to open detail view) ──────────────────
const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  draft:     { cls: 'bg-gray-100 text-gray-500',                                 label: 'Draft' },
  active:    { cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200',  label: 'Active' },
  completed: { cls: 'bg-emerald-100 text-emerald-800 border border-emerald-400', label: 'Completed' },
  disabled:  { cls: 'bg-slate-100 text-slate-400 border border-slate-200',       label: 'Disabled' },
}
const STATUS_ACCENT: Record<string, string> = {
  active: 'bg-emerald-400', draft: 'bg-gray-200', completed: 'bg-emerald-500', disabled: 'bg-slate-200',
}
const STATUS_ICON_BG: Record<string, string> = {
  active: 'bg-emerald-50', draft: 'bg-gray-50', completed: 'bg-emerald-100', disabled: 'bg-gray-50',
}
const STATUS_ICON_COLOR: Record<string, string> = {
  active: 'text-emerald-600', draft: 'text-gray-400', completed: 'text-emerald-700', disabled: 'text-gray-300',
}

function ChallengeListCard({
  challenge,
  isCompleted,
  onClick,
}: {
  challenge: ChallengeWithTiers
  isCompleted: boolean
  onClick: () => void
}) {
  const ds = challenge.status ?? 'active'
  const badge = STATUS_BADGE[ds] ?? STATUS_BADGE.active
  const individualTier = challenge.tiers.find(t => t.is_individual)
  const groupTiers = challenge.tiers.filter(t => !t.is_individual && t.enabled)
  const maxEarnings =
    (individualTier?.base_tokens ?? 0) + groupTiers.reduce((s, t) => s + t.bonus_tokens, 0)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all active:scale-[0.99] ${ds === 'disabled' ? 'opacity-75' : ''}`}
    >
      <div className={`h-1 w-full ${STATUS_ACCENT[ds] ?? 'bg-indigo-400'}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${STATUS_ICON_BG[ds] ?? 'bg-indigo-50'}`}>
            <Trophy size={16} className={STATUS_ICON_COLOR[ds] ?? 'text-indigo-500'} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-sm font-bold ${ds === 'disabled' ? 'text-gray-500' : 'text-gray-900'}`}>{challenge.title}</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                {badge.label}
              </span>
              {isCompleted && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full flex-shrink-0">
                  <CheckCircle2 size={9} /> You completed
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{challenge.description}</p>
            {(challenge.start_date || challenge.due_date) && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1">
                <Calendar size={10} />
                {challenge.start_date && <span>{challenge.start_date}</span>}
                {challenge.start_date && challenge.due_date && <span>→</span>}
                {challenge.due_date && <span>{challenge.due_date}</span>}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {maxEarnings > 0 && (
              <div className="flex items-center gap-1 text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                <Zap size={10} /> {fmt(maxEarnings)} tokens
              </div>
            )}
            <ChevronRight size={14} className="text-gray-300" />
          </div>
        </div>
      </div>
    </button>
  )
}

interface Props {
  employee: Employee
  manager: Employee | null
  peers: Employee[]
  directReports: Employee[]
  levelConfigs: OrgLevelConfig[]
  organization: Organization
  activeChallenges: ChallengeWithTiers[]
  allEmployees: Employee[]
  allChallengeCompletions: {
    challenge_id: string
    employee_id: string
    completed_at: string
  }[]
  earnedEntries?: EarnedEntry[]
  defaultTab?: string
}

const VALID_TABS = ['overview', 'challenges', 'earnings', 'marketplace'] as const
type TabId = typeof VALID_TABS[number]

export default function EmployeePortal({
  employee,
  manager,
  peers,
  directReports,
  levelConfigs,
  organization,
  activeChallenges,
  allEmployees,
  allChallengeCompletions: initialCompletions,
  earnedEntries = [],
  defaultTab,
}: Props) {
  const router = useRouter()
  const [completions, setCompletions] = useState(initialCompletions)
  const [refreshing, setRefreshing] = useState(false)

  // Sync completions when server re-fetches (after router.refresh())
  useEffect(() => { setCompletions(initialCompletions) }, [initialCompletions])

  const validDefault = VALID_TABS.includes(defaultTab as TabId) ? defaultTab as TabId : 'overview'
  const [tab, setTab] = useState<TabId>(validDefault)
  const [challengeFilter, setChallengeFilter] = useState<'active' | 'completed' | 'disabled' | 'all'>('active')

  function changeTab(next: TabId) {
    setTab(next)
    // Update the URL without a server round-trip so data never disappears on tab switch.
    // The server only reads ?tab= on the initial page load to restore the correct tab.
    window.history.replaceState(null, '', `?tab=${next}`)
  }

  async function handleRefresh() {
    setRefreshing(true)
    router.refresh()
    // Brief delay so the spinner is visible; router.refresh() is async internally
    setTimeout(() => setRefreshing(false), 800)
  }

  const getLabel = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const color = levelColor(employee.level)
  const isManager = directReports.length > 0

  const completedIds = new Set(
    completions.filter(c => c.employee_id === employee.id).map(c => c.challenge_id),
  )

  // Total earned tokens — used for marketplace balance
  const totalEarnedTokens = useMemo(() => {
    if (!earnedEntries || earnedEntries.length === 0) return 0
    return earnedEntries.reduce((sum, entry) => {
      const { total } = computeEarnings(entry, employee, completions, allEmployees)
      return sum + total
    }, 0)
  }, [earnedEntries, employee, completions, allEmployees])

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        {/* Employee identity */}
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0 shadow-sm"
            style={{ background: color }}
          >
            {employee.first_name[0]}{employee.last_name[0]}
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-gray-900 leading-tight">
              {employee.first_name} {employee.last_name}
            </h1>
            <p className="text-[11px] text-gray-400">
              L{employee.level} · {getLabel(employee.level)}
              {employee.team_name && ` · ${employee.team_name}`}
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Compact tab pills */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => changeTab('overview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'overview'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <User size={12} /> Overview
            </button>
            <button
              onClick={() => changeTab('challenges')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'challenges'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Trophy size={12} /> Challenges
              {activeChallenges.filter(c => c.status === 'active').length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  tab === 'challenges' ? 'bg-gray-100 text-gray-700' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {activeChallenges.filter(c => c.status === 'active').length}
                </span>
              )}
            </button>
            <button
              onClick={() => changeTab('earnings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'earnings'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Coins size={12} /> Earnings
              {earnedEntries.length > 0 && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  tab === 'earnings' ? 'bg-gray-100 text-gray-700' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {earnedEntries.length}
                </span>
              )}
            </button>
            <button
              onClick={() => changeTab('marketplace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                tab === 'marketplace'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <ShoppingBag size={12} /> Marketplace
            </button>
          </div>
          {/* Refresh button — shown on Earnings tab */}
          {tab === 'earnings' && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 ml-1"
              title="Refresh earnings data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-indigo-50 p-5">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Overview tab */}
          {tab === 'overview' && (
            <>
              {/* Profile card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="h-2 w-full" style={{ background: color }} />
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl flex-shrink-0 shadow-sm"
                      style={{ background: color }}
                    >
                      {employee.first_name[0]}{employee.last_name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extrabold text-gray-900">
                          {employee.first_name} {employee.last_name}
                        </h2>
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
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Building2 size={13} className="text-gray-400" />
                          {organization.name}
                        </div>
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

              {/* Direct reports */}
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
            </>
          )}

          {/* Challenges tab */}
          {tab === 'challenges' && (() => {
            const FILTERS = [
              { key: 'active',    label: 'Active' },
              { key: 'completed', label: 'Completed' },
              { key: 'disabled',  label: 'Disabled' },
              { key: 'all',       label: 'All' },
            ] as const
            const counts: Record<string, number> = {}
            for (const f of FILTERS) {
              counts[f.key] = f.key === 'all'
                ? activeChallenges.length
                : activeChallenges.filter(c => c.status === f.key).length
            }
            const displayed = challengeFilter === 'all'
              ? activeChallenges
              : activeChallenges.filter(c => c.status === challengeFilter)

            return (
              <div className="space-y-4">
                {/* Filter tabs */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5 self-start">
                  {FILTERS.map(f => (
                    <button
                      key={f.key}
                      onClick={() => setChallengeFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        challengeFilter === f.key
                          ? 'bg-white shadow text-gray-900'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {f.label}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                        challengeFilter === f.key ? 'bg-gray-100 text-gray-700' : 'bg-gray-200/60 text-gray-400'
                      }`}>
                        {counts[f.key]}
                      </span>
                    </button>
                  ))}
                </div>

                {/* List */}
                {displayed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                      <Trophy size={20} className="text-gray-300" />
                    </div>
                    <p className="text-sm font-semibold text-gray-400">No {challengeFilter === 'all' ? '' : challengeFilter + ' '}challenges</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayed.map(c => (
                      <ChallengeListCard
                        key={c.id}
                        challenge={c}
                        isCompleted={completedIds.has(c.id)}
                        onClick={() => router.push(`/dashboard/employee/challenges/${c.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Earnings tab */}
          {tab === 'earnings' && (
            <EmployeeEarningsTab
              employee={employee}
              earnedEntries={earnedEntries}
              allChallengeCompletions={completions}
              allOrgEmployees={allEmployees}
              levelConfigs={levelConfigs}
            />
          )}

          {/* Marketplace tab */}
          {tab === 'marketplace' && (
            <EmployeeMarketplaceTab
              employeeId={employee.id}
              orgId={organization.id}
              earnedTokens={totalEarnedTokens}
            />
          )}

        </div>
      </div>
    </div>
  )
}
