'use client'

import { useMemo } from 'react'
import {
  Coins, ArrowDownLeft, ArrowUpRight, CheckCircle2, Trophy, Users,
} from 'lucide-react'
import type { Employee, OrgLevelConfig, EmployeeAllocation, EmployeeBudgetTransaction, ManagerBudgetTransaction, ChallengeWithTiers } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  managerBudget: number | null
  managerBudgetDate: string | null
  managerId: string
  orgName: string
  challenges: ChallengeWithTiers[]
  employeeAllocations: EmployeeAllocation[]
  employeeTransactions?: EmployeeBudgetTransaction[]
  managerBudgetTransactions?: ManagerBudgetTransaction[]
  employees: Employee[]
  levelConfigs: OrgLevelConfig[]
}

type EntryKind = 'credit' | 'debit' | 'settled'

interface LedgerEntry {
  kind: EntryKind
  date: string
  label: string
  sub?: string
  amount: number
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <p className="text-[11px] text-gray-400 mb-1">{label} <span className="text-gray-300">(tokens)</span></p>
      <p className={`text-xl font-black tabular-nums ${accent ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Ledger row ───────────────────────────────────────────────────────────────
function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isCredit  = entry.kind === 'credit'
  const isSettled = entry.kind === 'settled'

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isCredit  ? 'bg-emerald-50' :
        isSettled ? 'bg-gray-100'   :
                    'bg-indigo-50'
      }`}>
        {isCredit  ? <ArrowDownLeft  size={15} className="text-emerald-600" /> :
         isSettled ? <CheckCircle2   size={15} className="text-gray-400"    /> :
                     <ArrowUpRight   size={15} className="text-indigo-500"  />}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{entry.label}</p>
        {entry.sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{entry.sub}</p>}
      </div>

      <span className="text-[11px] text-gray-400 flex-shrink-0 hidden sm:block">
        {fmtDate(entry.date)}
      </span>

      <span className={`text-sm font-black tabular-nums flex-shrink-0 text-right w-24 ${
        isCredit  ? 'text-emerald-600'                   :
        isSettled ? 'text-gray-400 line-through'          :
                    'text-gray-800'
      }`}>
        {isCredit ? '+' : isSettled ? '' : '−'}
        {fmt(entry.amount)} tokens
      </span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function NoBudgetState({ orgName }: { orgName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
        <Coins size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-bold text-gray-700">No budget assigned yet</p>
      <p className="text-xs text-gray-400 mt-1.5 max-w-xs">
        {orgName} admin hasn't allocated tokens to you yet.
      </p>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManagerBudgetTab({
  managerBudget, managerBudgetDate, managerId, orgName,
  challenges, employeeAllocations, employeeTransactions = [],
  managerBudgetTransactions = [], employees, levelConfigs,
}: Props) {
  const getLabel   = (l: number) => levelConfigs.find(c => c.level === l)?.label ?? `L${l}`
  const getEmployee = (id: string) => employees.find(e => e.id === id)

  // Challenges owned by this manager (they reserve from their budget)
  const myChallenges = useMemo(
    () => challenges.filter(c => c.manager_id === managerId),
    [challenges, managerId],
  )

  const challengeReserved = useMemo(
    () => myChallenges
      .filter(c => c.status === 'draft' || c.status === 'active')
      .reduce((s, c) => s + c.token_budget, 0),
    [myChallenges],
  )

  const totalAllocated = useMemo(
    () => employeeAllocations.reduce((s, a) => s + a.tokens, 0),
    [employeeAllocations],
  )

  const received = managerBudget ?? 0
  const available = received - challengeReserved - totalAllocated
  const isOver = available < 0

  // Build ledger using real delta transactions; fall back to current-state for employees
  // that were allocated before transaction logging was introduced.
  const ledger: LedgerEntry[] = useMemo(() => {
    const entries: LedgerEntry[] = []

    if (managerBudgetTransactions.length > 0) {
      for (const txn of managerBudgetTransactions) {
        entries.push({
          kind: txn.amount > 0 ? 'credit' : 'debit',
          date: txn.created_at,
          label: txn.amount > 0 ? `Received from ${orgName}` : `Returned to ${orgName}`,
          sub: txn.amount > 0 ? 'Budget allocated by admin' : 'Budget returned to pool',
          amount: Math.abs(txn.amount),
        })
      }
    } else if (received > 0) {
      entries.push({
        kind: 'credit',
        date: managerBudgetDate ?? new Date().toISOString(),
        label: `Received from ${orgName}`,
        sub: 'Budget allocated by admin',
        amount: received,
      })
    }

    // Real delta transactions (positive = allocated, negative = returned)
    const employeesWithTxns = new Set(employeeTransactions.map(t => t.employee_id))
    for (const txn of employeeTransactions) {
      const emp = getEmployee(txn.employee_id)
      const isReturn = txn.amount < 0
      entries.push({
        kind: isReturn ? 'credit' : 'debit',
        date: txn.created_at,
        label: isReturn
          ? `Returned from ${emp?.full_name ?? 'Employee'}`
          : `Allocated to ${emp?.full_name ?? 'Employee'}`,
        sub: emp ? `L${emp.level} · ${getLabel(emp.level)}${emp.team_name ? ` · ${emp.team_name}` : ''}` : undefined,
        amount: Math.abs(txn.amount),
      })
    }

    // Fallback: employees with current allocations but no transaction history yet
    for (const a of employeeAllocations) {
      if (employeesWithTxns.has(a.employee_id)) continue
      const emp = getEmployee(a.employee_id)
      entries.push({
        kind: 'debit',
        date: a.updated_at,
        label: `Allocated to ${emp?.full_name ?? 'Employee'}`,
        sub: emp ? `L${emp.level} · ${getLabel(emp.level)}${emp.team_name ? ` · ${emp.team_name}` : ''}` : undefined,
        amount: a.tokens,
      })
    }

    for (const c of myChallenges) {
      entries.push({
        kind: (c.status === 'completed' || c.status === 'disabled') ? 'settled' : 'debit',
        date: (c.status === 'completed' || c.status === 'disabled') ? (c.updated_at ?? c.created_at) : c.created_at,
        label: c.title,
        sub: (c.status === 'completed' || c.status === 'disabled') ? 'Challenge ended · tokens settled' : `Challenge ${c.status} · reserved`,
        amount: c.token_budget,
      })
    }

    return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [received, managerBudgetDate, managerBudgetTransactions, orgName, employeeTransactions, employeeAllocations, myChallenges, employees, levelConfigs])

  if (!managerBudget) return <NoBudgetState orgName={orgName} />

  return (
    <div className="space-y-4">

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Received"
          value={fmt(received)}
          sub={`from ${orgName}`}
        />
        <SummaryCard
          label="To Team"
          value={fmt(totalAllocated)}
          sub={`${employeeAllocations.length} employee${employeeAllocations.length !== 1 ? 's' : ''}`}
        />
        <SummaryCard
          label="In Challenges"
          value={fmt(challengeReserved)}
          sub={`${myChallenges.filter(c => c.status === 'draft' || c.status === 'active').length} active/draft`}
        />
        <SummaryCard
          label={isOver ? 'Over budget' : 'Available'}
          value={fmt(Math.abs(available))}
          accent={isOver ? 'text-red-600' : 'text-emerald-600'}
          sub={isOver ? 'exceeds balance' : 'unallocated'}
        />
      </div>

      {/* ── Progress bar ── */}
      {received > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Allocation Breakdown</p>
            <p className="text-[11px] text-gray-400 tabular-nums">
              {Math.min(100, Math.round(((totalAllocated + challengeReserved) / received) * 100))}% used
            </p>
          </div>
          <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
            {totalAllocated > 0 && (
              <div
                className="h-full bg-indigo-500 transition-all"
                style={{ width: `${Math.min(100, (totalAllocated / received) * 100)}%` }}
              />
            )}
            {challengeReserved > 0 && (
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${Math.min(100, (challengeReserved / received) * 100)}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-[10px] text-gray-500">To team ({fmt(totalAllocated)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-[10px] text-gray-500">Challenges ({fmt(challengeReserved)})</span>
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="w-2 h-2 rounded-full bg-gray-200" />
              <span className="text-[10px] text-gray-500">Free ({fmt(Math.max(0, available))})</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction ledger ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100">
          <p className="text-sm font-bold text-gray-900">Transactions</p>
          <p className="text-[11px] text-gray-400 mt-0.5">All budget movements for your account</p>
        </div>

        {ledger.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center px-6">
            <Trophy size={24} className="text-gray-200 mb-2" />
            <p className="text-sm font-semibold text-gray-500">No transactions yet</p>
            <p className="text-xs text-gray-400 mt-1">Allocations and challenge activity will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ledger.map((entry, i) => (
              <LedgerRow key={i} entry={entry} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
