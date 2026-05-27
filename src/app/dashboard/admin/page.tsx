import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgManager from '@/components/OrgManager'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id || profile.role !== 'tenant_admin') {
    redirect('/dashboard')
  }

  const orgId = profile.organization_id

  const [
    { data: organization },
    { data: levelConfigs },
    { data: employees },
    { data: orgBudget },
    { data: managerBudgets },
    { data: challengesRaw },
    { data: completionsRaw },
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId).order('level').order('full_name'),
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('manager_budgets').select('*').eq('organization_id', orgId),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.from('challenge_completions').select('*, challenges!inner(organization_id)').eq('challenges.organization_id', orgId),
  ])

  if (!organization) redirect('/login')

  const initialChallenges = ((challengesRaw ?? []) as any[]).map(c => ({
    ...c,
    tiers: c.challenge_tiers ?? [],
  }))

  return (
    <OrgManager
      organization={organization}
      initialLevelConfigs={levelConfigs ?? []}
      initialEmployees={employees ?? []}
      orgId={orgId}
      totalBudget={orgBudget?.total_tokens ?? null}
      initialManagerBudgets={managerBudgets ?? []}
      initialChallenges={initialChallenges}
      initialCompletions={(completionsRaw ?? []) as any[]}
    />
  )
}
