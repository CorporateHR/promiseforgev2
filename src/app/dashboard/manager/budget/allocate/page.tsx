import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerBudgetAllocateView from '@/components/ManagerBudgetAllocateView'

export default async function ManagerBudgetAllocatePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile?.organization_id) redirect('/dashboard')
  if (profile.role !== 'employee' && profile.role !== 'tenant_admin') redirect('/dashboard')

  const orgId = profile.organization_id

  const [
    { data: employee },
    { data: levelConfigs },
    { data: allOrgEmployeesRaw },
  ] = await Promise.all([
    supabase.from('employees').select('*').eq('organization_id', orgId).eq('email', user.email!).single(),
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId),
  ])

  if (!employee) redirect('/dashboard/manager')

  const allOrgEmployees = (allOrgEmployeesRaw ?? []) as any[]

  // Full subtree (all descendants), not just direct reports
  function getSubtreeIds(empId: string): Set<string> {
    const ids = new Set<string>()
    const queue = [empId]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      allOrgEmployees
        .filter((e: any) => e.manager_id === id)
        .forEach((r: any) => { ids.add(r.id); queue.push(r.id) })
    }
    return ids
  }

  const subtreeIds = getSubtreeIds(employee.id)
  const subtreeIdList = [...subtreeIds] as string[]
  const subtreeEmployees = [employee, ...allOrgEmployees.filter((e: any) => subtreeIds.has(e.id))]
  const directReportIds = allOrgEmployees
    .filter((e: any) => e.manager_id === employee.id)
    .map((e: any) => e.id as string)

  const [
    { data: managerBudgetRow },
    { data: subtreeBudgets },
    { data: myTransactions },
  ] = await Promise.all([
    // This manager's own pool (given by admin)
    supabase.from('manager_budgets').select('tokens').eq('manager_id', employee.id).single(),
    // Current manager_budgets for all subtree members (what each person has to distribute)
    subtreeIdList.length > 0
      ? supabase.from('manager_budgets').select('*').eq('organization_id', orgId).in('manager_id', subtreeIdList)
      : Promise.resolve({ data: [] }),
    // Only transactions where THIS manager was the allocator — to compute pool usage
    subtreeIdList.length > 0
      ? supabase.from('manager_budget_transactions').select('manager_id, amount').eq('organization_id', orgId).eq('allocated_by', user.id).in('manager_id', subtreeIdList)
      : Promise.resolve({ data: [] }),
  ])

  const managerBudget = managerBudgetRow?.tokens ?? 0
  if (!managerBudget) redirect('/dashboard/manager?tab=budget')

  // Net amount this manager has contributed per person
  const myAllocations: Record<string, number> = {}
  for (const t of (myTransactions ?? []) as any[]) {
    myAllocations[t.manager_id] = (myAllocations[t.manager_id] ?? 0) + t.amount
  }
  const allocatedFromMyPool = Object.values(myAllocations).reduce((s, v) => s + v, 0)

  return (
    <ManagerBudgetAllocateView
      orgId={orgId}
      managerEmployee={employee}
      subtreeEmployees={subtreeEmployees}
      directReportIds={directReportIds}
      allocatableIds={subtreeIdList}
      levelConfigs={levelConfigs ?? []}
      managerBudget={managerBudget}
      initialAllocations={(subtreeBudgets ?? []) as any[]}
      allocatedFromMyPool={allocatedFromMyPool}
      myAllocations={myAllocations}
    />
  )
}
