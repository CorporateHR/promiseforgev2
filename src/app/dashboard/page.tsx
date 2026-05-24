import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgManager from '@/components/OrgManager'
import OrgSetup from '@/components/OrgSetup'
import EmployeePortal from '@/components/EmployeePortal'
import ManagerView from '@/components/ManagerView'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { view } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // ── Super admin — sees all orgs ───────────────────────────────────────────
  if (profile?.role === 'super_admin') {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .order('name')

    const orgList = orgs ?? []

    const orgSummaries = await Promise.all(
      orgList.map(async org => {
        const [{ count: employeeCount }, { count: levelCount }] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('org_level_configs').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
        ])
        return { org, employeeCount: employeeCount ?? 0, levelCount: levelCount ?? 0 }
      })
    )

    return <SuperAdminDashboard orgs={orgSummaries} />
  }

  if (!profile?.organization_id) {
    if (profile?.role === 'employee') redirect('/login')
    return <OrgSetup />
  }

  const orgId = profile.organization_id

  // ── Employee role ─────────────────────────────────────────────────────────
  if (profile.role === 'employee') {
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

    const { data: directReports } = await supabase
      .from('employees').select('*').eq('manager_id', employee.id).order('full_name')
    const hasReports = (directReports?.length ?? 0) > 0

    // Default view: manager if they have reports, employee otherwise
    const effectiveView = view === 'employee' ? 'employee'
      : view === 'manager' ? 'manager'
      : hasReports ? 'manager' : 'employee'

    if (effectiveView === 'manager') {
      const [{ data: managerBudgetRow }, { data: employeeAllocations }] = await Promise.all([
        supabase.from('manager_budgets').select('tokens').eq('manager_id', employee.id).single(),
        supabase.from('employee_allocations').select('*').eq('manager_id', employee.id),
      ])
      return (
        <ManagerView
          employee={employee}
          directReports={directReports ?? []}
          levelConfigs={levelConfigs ?? []}
          organization={organization}
          managerBudget={managerBudgetRow?.tokens ?? null}
          initialAllocations={employeeAllocations ?? []}
        />
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

  // ── Tenant admin: manager view ────────────────────────────────────────────
  if (view === 'manager') {
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
    ] = await Promise.all([
      supabase.from('employees').select('*').eq('manager_id', employee.id).order('full_name'),
      supabase.from('manager_budgets').select('tokens').eq('manager_id', employee.id).single(),
      supabase.from('employee_allocations').select('*').eq('manager_id', employee.id),
    ])

    return (
      <ManagerView
        employee={employee}
        directReports={directReports ?? []}
        levelConfigs={levelConfigs ?? []}
        organization={organization}
        managerBudget={managerBudgetRow?.tokens ?? null}
        initialAllocations={employeeAllocations ?? []}
      />
    )
  }

  // ── Tenant admin: employee view ───────────────────────────────────────────
  if (view === 'employee') {
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

  // ── Tenant admin dashboard ────────────────────────────────────────────────
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
