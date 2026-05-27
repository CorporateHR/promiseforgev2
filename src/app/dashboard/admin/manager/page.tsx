import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerView from '@/components/ManagerView'

export default async function AdminManagerViewPage() {
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
    { data: employee },
  ] = await Promise.all([
    supabase.from('organizations').select('*').eq('id', orgId).single(),
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId).eq('email', user.email!).single(),
  ])

  if (!organization) redirect('/login')

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-gray-400">
        <p className="text-sm font-semibold">No employee profile found for {user.email}</p>
        <p className="text-xs mt-1">Ask your super admin to add you to the org chart.</p>
      </div>
    )
  }

  const [
    { data: directReports },
    { data: managerBudgetRow },
    { data: employeeAllocations },
    { data: allOrgEmployeesRaw },
    { data: challengesRaw },
    { data: completionsRaw },
  ] = await Promise.all([
    supabase.from('employees').select('*').eq('manager_id', employee.id).order('full_name'),
    supabase.from('manager_budgets').select('tokens').eq('manager_id', employee.id).single(),
    supabase.from('employee_allocations').select('*').eq('manager_id', employee.id),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('organization_id', orgId).in('status', ['active', 'ended']).order('created_at', { ascending: false }),
    supabase.from('challenge_completions').select('challenge_id, employee_id, challenges!inner(organization_id)').eq('challenges.organization_id', orgId),
  ])
  
  const managerChallenges = ((challengesRaw ?? []) as any[]).map(c => ({ ...c, tiers: c.challenge_tiers ?? [] }))
  const managerCompletions = ((completionsRaw ?? []) as any[]).map(({ challenge_id, employee_id }: any) => ({ challenge_id, employee_id }))

  return (
    <ManagerView
      employee={employee}
      directReports={directReports ?? []}
      levelConfigs={levelConfigs ?? []}
      organization={organization}
      managerBudget={managerBudgetRow?.tokens ?? null}
      initialAllocations={employeeAllocations ?? []}
      allOrgEmployees={(allOrgEmployeesRaw ?? []) as any[]}
      challenges={managerChallenges}
      challengeCompletions={managerCompletions}
    />
  )
}
