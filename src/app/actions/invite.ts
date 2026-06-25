'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, employeeInviteHtml } from '@/lib/email'

interface InviteRecipient {
  email: string
  full_name: string
}

export interface InviteResult {
  invited: number
  skipped: number
  failed: { email: string; reason: string }[]
}

export async function inviteEmployees(orgId: string, recipients: InviteRecipient[]): Promise<InviteResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { invited: 0, skipped: 0, failed: recipients.map(r => ({ email: r.email, reason: 'Not authenticated' })) }

  const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
  const orgName = org?.name ?? 'your organization'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const admin = createAdminClient()

  let invited = 0
  let skipped = 0
  const failed: { email: string; reason: string }[] = []

  for (const { email, full_name } of recipients) {
    if (!email) continue

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        data: { full_name, role: 'employee' },
        redirectTo: `${appUrl}/auth/accept-invite`,
      },
    })

    if (error || !data?.user) {
      if (error?.message?.toLowerCase().includes('already been registered') || error?.message?.toLowerCase().includes('already registered')) {
        skipped++
        continue
      }
      failed.push({ email, reason: error?.message ?? 'Unknown error' })
      continue
    }

    await admin.from('profiles').update({ organization_id: orgId }).eq('id', data.user.id)

    // Don't email the raw action_link — it's a GET endpoint that redeems the one-time
    // token on fetch, and email providers (Gmail, enterprise Safe Links, etc.) prefetch
    // links to scan them, which burns the token before the user ever clicks it. Instead,
    // link to our own page and only call verifyOtp() on an explicit user click there.
    const activationLink = `${appUrl}/auth/accept-invite?token_hash=${encodeURIComponent(data.properties.hashed_token)}&email=${encodeURIComponent(email)}`

    try {
      await sendEmail(
        email,
        full_name,
        `You're invited to join ${orgName} on Promise Forge`,
        employeeInviteHtml(full_name, orgName, activationLink),
      )
      invited++
    } catch (emailErr) {
      failed.push({ email, reason: emailErr instanceof Error ? emailErr.message : 'Failed to send invite email' })
    }
  }

  return { invited, skipped, failed }
}
