'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, tenantAdminAssignedHtml } from '@/lib/email'
import { revalidatePath } from 'next/cache'

export async function createOrganization(orgName: string, description: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }

  const rawSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = `${rawSlug}-${Math.random().toString(36).slice(2, 7)}`

  // 1. Create org — server-side client, auth is guaranteed
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName.trim(), slug, description: description.trim() || null, created_by: user.id })
    .select()
    .single()

  if (orgError) return { error: orgError.message }

  // 2. Link profile
  await supabase.from('profiles').update({ organization_id: org.id }).eq('id', user.id)

  // 3. Default level labels
  await supabase.from('org_level_configs').insert([
    { organization_id: org.id, level: 0, label: 'Tenant Admin' },
    { organization_id: org.id, level: 1, label: 'L1' },
    { organization_id: org.id, level: 2, label: 'L2' },
  ])

  // 4. L0 employee (the tenant admin themselves)
  const meta = user.user_metadata ?? {}
  const fullName = (meta.full_name as string) || user.email || 'Tenant Admin'
  await supabase.from('employees').insert({
    organization_id: org.id,
    full_name: fullName,
    email: user.email || null,
    level: 0,
    manager_id: null,
  })

  revalidatePath('/dashboard')
  return { success: true }
}

export async function createOrganizationAsSuperAdmin(orgName: string, description: string) {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return { error: 'Not authenticated' }

  const rawSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const slug = `${rawSlug}-${Math.random().toString(36).slice(2, 7)}`

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: orgName.trim(), slug, description: description.trim() || null, created_by: user.id })
    .select()
    .single()

  if (orgError) return { error: orgError.message }

  // Default level labels — tenant admin will rename these
  await supabase.from('org_level_configs').insert([
    { organization_id: org.id, level: 0, label: 'L0' },
    { organization_id: org.id, level: 1, label: 'L1' },
    { organization_id: org.id, level: 2, label: 'L2' },
  ])

  revalidatePath('/dashboard')
  return { success: true, org }
}

// ── Budget actions ────────────────────────────────────────────────────────────

export async function setOrgBudget(orgId: string, totalTokens: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('org_budgets')
    .upsert({ organization_id: orgId, total_tokens: totalTokens, created_by: user.id },
             { onConflict: 'organization_id' })
  if (error) return { error: error.message }

  revalidatePath(`/dashboard/org/${orgId}`)
  return { success: true }
}

export async function allocateManagerBudget(
  orgId: string,
  managerId: string,
  tokens: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch org total and current allocations (excluding this manager)
  const [{ data: orgBudget }, { data: existing }] = await Promise.all([
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('manager_budgets').select('tokens, manager_id').eq('organization_id', orgId),
  ])

  if (!orgBudget) return { error: 'No budget has been set for this organization yet.' }

  const usedByOthers = (existing ?? [])
    .filter(r => r.manager_id !== managerId)
    .reduce((sum, r) => sum + r.tokens, 0)

  if (usedByOthers + tokens > orgBudget.total_tokens) {
    return {
      error: `Cannot allocate ${tokens} tokens — only ${orgBudget.total_tokens - usedByOthers} remaining.`,
    }
  }

  const { error } = await supabase
    .from('manager_budgets')
    .upsert(
      { organization_id: orgId, manager_id: managerId, tokens, allocated_by: user.id },
      { onConflict: 'organization_id,manager_id' },
    )
  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function assignTenantAdmin(employeeEmail: string, orgId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('assign_tenant_admin', {
    p_employee_email: employeeEmail,
    p_org_id: orgId,
  })
  if (error) return { error: error.message }

  // Notify the newly-assigned tenant admin — fire-and-forget, doesn't block the response.
  // Uses the admin client because `profiles` RLS only allows reading your own row.
  ;(async () => {
    try {
      const admin = createAdminClient()
      const [{ data: org }, { data: profile }] = await Promise.all([
        supabase.from('organizations').select('name').eq('id', orgId).single(),
        admin.from('profiles').select('full_name').eq('email', employeeEmail).single(),
      ])
      const orgName = org?.name ?? 'your organization'
      await sendEmail(
        employeeEmail,
        profile?.full_name ?? '',
        `You're now a Tenant Admin of ${orgName}`,
        tenantAdminAssignedHtml(profile?.full_name ?? '', orgName),
      )
    } catch (err) {
      console.error('[Assign Tenant Admin] Email failed:', err)
    }
  })()

  return { success: true }
}
