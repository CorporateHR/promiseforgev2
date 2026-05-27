import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeePortal from '@/components/EmployeePortal'

export default async function AdminEmployeeViewPage() {
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
    { data: managerRow },
    { data: peers },
    { data: activeChallengesRaw },
    { data: allOrgEmployees },
    { data: allCompletionsRaw },
  ] = await Promise.all([
    employee.manager_id
      ? supabase.from('employees').select('*').eq('id', employee.manager_id).single()
      : Promise.resolve({ data: null }),
    employee.manager_id
      ? supabase.from('employees').select('*').eq('organization_id', orgId).eq('manager_id', employee.manager_id).neq('id', employee.id).order('full_name')
      : Promise.resolve({ data: [] }),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('organization_id', orgId).eq('status', 'active').order('created_at', { ascending: false }),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.from('challenge_completions').select('challenge_id, employee_id, completed_at, challenges!inner(organization_id)').eq('challenges.organization_id', orgId),
  ])

  const activeChallenges = ((activeChallengesRaw ?? []) as any[]).map(c => ({ ...c, tiers: c.challenge_tiers ?? [] }))
  const allCompletions = ((allCompletionsRaw ?? []) as any[]).map(({ challenge_id, employee_id, completed_at }: any) => ({ challenge_id, employee_id, completed_at }))

  return (
    <EmployeePortal
      employee={employee}
      manager={managerRow ?? null}
      directReports={[]}
      peers={peers ?? []}
      levelConfigs={levelConfigs ?? []}
      organization={organization}
      activeChallenges={activeChallenges}
      allEmployees={(allOrgEmployees ?? []) as any[]}
      allChallengeCompletions={allCompletions}
    />
  )
}
