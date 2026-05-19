import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgDetailView from '@/components/OrgDetailView'

export default async function OrgDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'super_admin') redirect('/dashboard')

  const [
    { data: org },
    { data: employees },
    { data: levelConfigs },
    { data: tenantAdminEmails },
    { data: orgBudget },
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('employees').select('*').eq('organization_id', orgId).order('level').order('full_name'),
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.rpc('get_tenant_admin_emails', { p_org_id: orgId }),
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
  ])

  if (!org) redirect('/dashboard')

  return (
    <OrgDetailView
      org={org}
      initialEmployees={employees ?? []}
      initialLevelConfigs={levelConfigs ?? []}
      initialTenantAdminEmails={tenantAdminEmails ?? []}
      initialBudget={orgBudget?.total_tokens ?? null}
    />
  )
}
