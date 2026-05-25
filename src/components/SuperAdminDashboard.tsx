'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganizationAsSuperAdmin } from '@/app/actions/org'
import {
  Building2, Users, Layers, Plus, X, Loader2,
  Trophy, Coins, ChevronRight,
} from 'lucide-react'
import type { Organization } from '@/lib/types'

function fmt(n: number) { return n.toLocaleString() }

interface OrgSummary {
  org: Organization
  employeeCount: number
  levelCount: number
  challengeCount: number
  activeChallengeCount: number
  totalBudget: number | null
  allocatedTokens: number
}

// ─── Create Org Modal ─────────────────────────────────────────────────────────
function CreateOrgModal({ onCreated, onClose }: {
  onCreated: (summary: OrgSummary) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await createOrganizationAsSuperAdmin(name, description)
    if (result.error) { setError(result.error); setLoading(false); return }
    onCreated({
      org: result.org!,
      employeeCount: 0,
      levelCount: 3,
      challengeCount: 0,
      activeChallengeCount: 0,
      totalBudget: null,
      allocatedTokens: 0,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">New Organization</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Organization Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Acme Corporation"
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A short description"
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !name.trim()}
              className="flex-1 py-2.5 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Org card ─────────────────────────────────────────────────────────────────
function OrgCard({ summary, onClick }: { summary: OrgSummary; onClick: () => void }) {
  const { org, employeeCount, levelCount, challengeCount, activeChallengeCount, totalBudget, allocatedTokens } = summary
  const remaining = totalBudget !== null ? totalBudget - allocatedTokens : null
  const usedPct = totalBudget && totalBudget > 0 ? Math.min(100, (allocatedTokens / totalBudget) * 100) : 0
  const isOver = remaining !== null && remaining < 0

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group overflow-hidden"
    >
      {/* Colour accent */}
      <div className="h-1 w-full bg-indigo-500 opacity-60 group-hover:opacity-100 transition-opacity" />

      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
            {org.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors text-sm">
              {org.name}
            </p>
            {org.description && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{org.description}</p>
            )}
          </div>
          <ChevronRight size={14} className="text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 mb-1">
              <Users size={9} /> People
            </div>
            <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(employeeCount)}</p>
            <p className="text-[10px] text-gray-400">{levelCount} levels</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 mb-1">
              <Trophy size={9} /> Challenges
            </div>
            <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(challengeCount)}</p>
            <p className="text-[10px] text-emerald-600 font-semibold">{activeChallengeCount} active</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-2.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 mb-1">
              <Coins size={9} /> Budget
            </div>
            {totalBudget !== null ? (
              <>
                <p className="text-sm font-black text-gray-900 tabular-nums">{fmt(totalBudget)}</p>
                <p className={`text-[10px] font-semibold ${isOver ? 'text-red-500' : 'text-gray-400'}`}>
                  {fmt(allocatedTokens)} alloc.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-black text-gray-300">—</p>
                <p className="text-[10px] text-gray-300">not set</p>
              </>
            )}
          </div>
        </div>

        {/* Budget progress bar */}
        {totalBudget !== null && totalBudget > 0 && (
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-gray-400">{usedPct.toFixed(0)}% allocated</span>
              <span className={`text-[10px] font-bold ${isOver ? 'text-red-500' : 'text-emerald-600'}`}>
                {remaining !== null ? `${fmt(Math.abs(remaining))} ${isOver ? 'over' : 'free'}` : ''}
              </span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isOver ? 'bg-red-400' : usedPct >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard({ orgs: initialOrgs }: { orgs: OrgSummary[] }) {
  const router = useRouter()
  const [orgs, setOrgs] = useState<OrgSummary[]>(initialOrgs)
  const [showCreateModal, setShowCreateModal] = useState(false)

  function handleOrgCreated(summary: OrgSummary) {
    setOrgs(prev => [...prev, summary].sort((a, b) => a.org.name.localeCompare(b.org.name)))
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Page header */}
      <div className="px-8 py-6 border-b border-gray-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orgs.length} organization{orgs.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus size={16} /> New Organization
        </button>
      </div>

      {/* Org grid */}
      <div className="max-w-6xl mx-auto px-8 py-8">
        {orgs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No organizations yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {orgs.map(summary => (
              <OrgCard
                key={summary.org.id}
                summary={summary}
                onClick={() => router.push(`/dashboard/org/${summary.org.id}`)}
              />
            ))}

            {/* Add org card */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-white/60 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-white transition-all p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-indigo-500 min-h-[200px]"
            >
              <Plus size={22} />
              <span className="text-sm font-semibold">Add Organization</span>
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateOrgModal
          onCreated={handleOrgCreated}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  )
}
