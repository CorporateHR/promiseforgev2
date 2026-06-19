import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgDetailView from '@/components/OrgDetailView'

export default async function OrgDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { orgId } = await params
  const { tab: defaultTab } = await searchParams
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
    { data: challenges },
    { data: managerBudgets },
    { data: budgetTransactions },
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('employees').select('*').eq('organization_id', orgId).order('level').order('full_name'),
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.rpc('get_tenant_admin_emails', { p_org_id: orgId }),
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('challenges').select('id, title, status, token_budget, created_at, updated_at, manager_id').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('manager_budgets').select('manager_id, tokens').eq('organization_id', orgId),
    supabase.from('org_budget_transactions').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
  ])

  const challengeIds = (challenges ?? []).map((c: { id: string }) => c.id)
  const { data: completions } = await supabase
    .from('challenge_completions')
    .select('challenge_id, employee_id')
    .in('challenge_id', challengeIds.length > 0 ? challengeIds : ['00000000-0000-0000-0000-000000000000'])

  if (!org) redirect('/dashboard')

  return (
    <OrgDetailView
      org={org}
      initialEmployees={employees ?? []}
      initialLevelConfigs={levelConfigs ?? []}
      initialTenantAdminEmails={tenantAdminEmails ?? []}
      initialBudget={orgBudget?.total_tokens ?? null}
      initialChallenges={(challenges ?? []) as any[]}
      initialManagerBudgets={managerBudgets ?? []}
      initialCompletions={completions ?? []}
      initialBudgetTransactions={(budgetTransactions ?? []) as any[]}
      defaultTab={defaultTab}
    />
  )
}
