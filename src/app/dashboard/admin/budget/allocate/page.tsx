import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminBudgetAllocateView from '@/components/AdminBudgetAllocateView'

export default async function AdminBudgetAllocatePage() {
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
    { data: levelConfigs },
    { data: employees },
    { data: orgBudget },
    { data: managerBudgets },
    { data: challengesRaw },
  ] = await Promise.all([
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId).order('level').order('full_name'),
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('manager_budgets').select('*').eq('organization_id', orgId),
    supabase.from('challenges').select('id, token_budget, manager_id, status').eq('organization_id', orgId),
  ])

  const totalBudget = orgBudget?.total_tokens ?? 0
  if (!totalBudget) redirect('/dashboard/admin/budget')

  const challengeReserved = ((challengesRaw ?? []) as any[])
    .filter((c: any) => !c.manager_id && (c.status === 'draft' || c.status === 'active' || c.status === 'completed'))
    .reduce((s: number, c: any) => s + c.token_budget, 0)

  return (
    <AdminBudgetAllocateView
      orgId={orgId}
      employees={employees ?? []}
      levelConfigs={levelConfigs ?? []}
      totalBudget={totalBudget}
      challengeReserved={challengeReserved}
      initialAllocations={managerBudgets ?? []}
    />
  )
}
