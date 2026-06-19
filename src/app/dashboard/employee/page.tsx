import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeePortal from '@/components/EmployeePortal'

export default async function EmployeeViewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: defaultTab } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) {
    redirect('/dashboard')
  }

  if (profile.role !== 'employee' && profile.role !== 'tenant_admin') {
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

  if (!organization || !employee) redirect('/login')

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
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('organization_id', orgId).in('status', ['active', 'completed', 'disabled']).order('created_at', { ascending: false }),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.rpc('get_org_completions', { p_org_id: orgId }),
  ])

  const allEmployees = (allOrgEmployees ?? []) as any[]

  // For manager-scoped challenges, show to employees in the creator's subtree
  // AND to the creator themselves (they participate in their own challenge).
  function isInSubtree(empId: string, managerId: string): boolean {
    const queue = [managerId]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const reports = allEmployees.filter((e: any) => e.manager_id === id)
      if (reports.some((r: any) => r.id === empId)) return true
      queue.push(...reports.map((r: any) => r.id))
    }
    return false
  }

  const allChallenges = ((activeChallengesRaw ?? []) as any[])
    .map(c => ({ ...c, tiers: c.challenge_tiers ?? [] }))
    .filter((c: any) => !c.manager_id || c.manager_id === employee.id || isInSubtree(employee.id, c.manager_id))
  const allCompletions = ((allCompletionsRaw ?? []) as any[]).map(({ challenge_id, employee_id, completed_at }: any) => ({ challenge_id, employee_id, completed_at }))

  // Fetch this employee's completions, then challenges separately (avoids complex join failures)
  const { data: myCompletions } = await supabase
    .from('challenge_completions')
    .select('challenge_id, completed_at')
    .eq('employee_id', employee.id)

  const earnedChallengeIds = (myCompletions ?? []).map((c: any) => c.challenge_id)

  const earnedEntries: any[] = []
  if (earnedChallengeIds.length > 0) {
    const { data: earnedChallengesRaw } = await supabase
      .from('challenges')
      .select('*, challenge_tiers(*)')
      .in('id', earnedChallengeIds)

    const cMap = new Map(
      ((earnedChallengesRaw ?? []) as any[]).map((c: any) => [
        c.id,
        { ...c, tiers: c.challenge_tiers ?? [] },
      ])
    )
    ;(myCompletions ?? []).forEach((c: any) => {
      const challenge = cMap.get(c.challenge_id)
      if (challenge) earnedEntries.push({ challenge_id: c.challenge_id, completed_at: c.completed_at, challenge })
    })
  }

  return (
    <EmployeePortal
      employee={employee}
      manager={managerRow ?? null}
      directReports={[]}
      peers={peers ?? []}
      levelConfigs={levelConfigs ?? []}
      organization={organization}
      activeChallenges={allChallenges}
      allEmployees={allEmployees}
      allChallengeCompletions={allCompletions}
      earnedEntries={earnedEntries}
      defaultTab={defaultTab}
    />
  )
}
