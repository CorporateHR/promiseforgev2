import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerView from '@/components/ManagerView'

export default async function ManagerViewPage({
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
    { data: managerBudgetRow },
    { data: employeeAllocations },
    { data: employeeTransactions },
    { data: managerBudgetTransactions },
    { data: allOrgEmployeesRaw },
    { data: challengesRaw },
    { data: completionsRaw },
    { data: directReports },
  ] = await Promise.all([
    supabase.from('manager_budgets').select('tokens, updated_at').eq('manager_id', employee.id).single(),
    supabase.from('employee_allocations').select('*').eq('manager_id', employee.id),
    supabase.from('employee_budget_transactions').select('*').eq('manager_id', employee.id).order('created_at', { ascending: false }),
    supabase.from('manager_budget_transactions').select('*').eq('manager_id', employee.id).order('created_at', { ascending: false }),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('organization_id', orgId).order('created_at', { ascending: false }),
    supabase.rpc('get_org_completions', { p_org_id: orgId }),
    supabase.from('employees').select('*').eq('manager_id', employee.id).order('full_name'),
  ])
  
  const allOrgEmployees = (allOrgEmployeesRaw ?? []) as any[]

  // Walk up the manager chain to collect ancestor employee IDs
  function getAncestorIds(empId: string): string[] {
    const ids: string[] = []
    let cur: any = allOrgEmployees.find((e: any) => e.id === empId)
    while (cur?.manager_id) {
      const parent: any = allOrgEmployees.find((e: any) => e.id === cur.manager_id)
      if (!parent) break
      ids.push(parent.id)
      cur = parent
    }
    return ids
  }

  // Walk down the org tree to collect all subordinate employee IDs
  function getSubtreeIds(empId: string): Set<string> {
    const ids = new Set<string>()
    const queue = [empId]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const reports = allOrgEmployees.filter((e: any) => e.manager_id === id)
      reports.forEach((r: any) => { ids.add(r.id); queue.push(r.id) })
    }
    return ids
  }

  const ancestorIds = getAncestorIds(employee.id)
  const subtreeIds = getSubtreeIds(employee.id)

  const allChallenges = ((challengesRaw ?? []) as any[]).map(c => ({ ...c, tiers: c.challenge_tiers ?? [] }))
  const managerChallenges = allChallenges.filter((c: any) =>
    // Org-wide challenges (active/ended)
    (c.manager_id === null && ['active', 'completed', 'disabled'].includes(c.status)) ||
    // This manager's own challenges (any status — they manage the lifecycle)
    c.manager_id === employee.id ||
    // Ancestor-created scoped challenges that include this manager's team (active/ended only)
    (c.manager_id !== null && ancestorIds.includes(c.manager_id) && ['active', 'completed', 'disabled'].includes(c.status)) ||
    // Subordinate-created challenges — visibility only, no management (active/ended only)
    (c.manager_id !== null && subtreeIds.has(c.manager_id) && ['active', 'completed', 'disabled'].includes(c.status))
  )
  const managerCompletions = ((completionsRaw ?? []) as any[]).map(({ challenge_id, employee_id }: any) => ({ challenge_id, employee_id }))

  return (
    <ManagerView
      employee={employee}
      directReports={directReports ?? []}
      levelConfigs={levelConfigs ?? []}
      organization={organization}
      managerBudget={managerBudgetRow?.tokens ?? null}
      managerBudgetDate={(managerBudgetRow as any)?.updated_at ?? null}
      initialAllocations={employeeAllocations ?? []}
      initialEmployeeTransactions={employeeTransactions ?? []}
      managerBudgetTransactions={managerBudgetTransactions ?? []}
      allOrgEmployees={allOrgEmployees}
      challenges={managerChallenges}
      challengeCompletions={managerCompletions}
      defaultTab={defaultTab}
    />
  )
}
