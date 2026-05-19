'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganizationAsSuperAdmin } from '@/app/actions/org'
import { Building2, Users, Layers, Plus, X, Loader2 } from 'lucide-react'
import type { Organization } from '@/lib/types'

interface OrgSummary {
  org: Organization
  employeeCount: number
  levelCount: number
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
    onCreated({ org: result.org!, employeeCount: 0, levelCount: 3 })
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orgs.map(({ org, employeeCount, levelCount }) => (
            <button
              key={org.id}
              onClick={() => router.push(`/dashboard/org/${org.id}`)}
              className="text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all p-5 group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                  {org.name[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                    {org.name}
                  </div>
                  {org.description && (
                    <div className="text-xs text-gray-400 truncate">{org.description}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-gray-400" />
                  <span>{employeeCount} people</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-gray-400" />
                  <span>{levelCount} levels</span>
                </div>
              </div>
            </button>
          ))}

          {/* Add org card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-white/60 rounded-2xl border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-white transition-all p-5 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-indigo-500 min-h-[120px]"
          >
            <Plus size={22} />
            <span className="text-sm font-semibold">Add Organization</span>
          </button>
        </div>

        {orgs.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <Building2 size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">No organizations yet</p>
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
