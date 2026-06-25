'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function AcceptInviteForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const tokenHash = searchParams.get('token_hash')
  const email = searchParams.get('email')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleActivate() {
    if (!tokenHash) {
      setError('This invite link is missing required information.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'invite' })
      if (verifyError) throw verifyError
      router.push('/auth/set-password')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError('This invite link is invalid or has expired. Please ask your admin to resend your invite.')
      console.error('Invite activation failed:', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-100 p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#1e3a5f] text-yellow-300 px-4 py-2 rounded-xl font-bold text-lg mb-3">
            ⚡ Promiseforge
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re invited</h1>
          <p className="text-sm text-gray-500 mt-1">
            {email ? <>Activate the account for <span className="font-semibold">{email}</span></> : 'Activate your account to get started'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 space-y-4">
          {!tokenHash && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 leading-relaxed">
              This invite link is missing required information. Please use the link from your email exactly as sent.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 leading-relaxed">
              {error}
            </div>
          )}

          <button
            onClick={handleActivate}
            disabled={loading || !tokenHash}
            className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Activating…' : 'Activate My Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteForm />
    </Suspense>
  )
}
