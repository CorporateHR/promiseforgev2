'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function OrgSetup() {
  const router = useRouter()
  const supabase = createClient()
  const [orgName, setOrgName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!orgName.trim()) return
    setLoading(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('setup_organization', {
      p_name: orgName.trim(),
      p_description: description.trim() || null,
    })

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 mb-4">
            <Building2 size={28} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">Set up your organization</h2>
          <p className="text-sm text-gray-500 mt-1">You&apos;ll be the <strong>L0 Tenant Admin</strong></p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-7">
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Organization Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                required
                autoFocus
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
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !orgName.trim()}
              className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Organization →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
