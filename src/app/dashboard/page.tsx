import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrgSetup from '@/components/OrgSetup'
import SuperAdminDashboard from '@/components/SuperAdminDashboard'

export default async function DashboardPage() {
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
        const [
          { count: employeeCount },
          { count: levelCount },
          { count: challengeCount },
          { count: activeChallengeCount },
          { data: orgBudget },
          { data: managerBudgets },
        ] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('org_level_configs').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('organization_id', org.id),
          supabase.from('challenges').select('id', { count: 'exact', head: true }).eq('organization_id', org.id).eq('status', 'active'),
          supabase.from('org_budgets').select('total_tokens').eq('organization_id', org.id).single(),
          supabase.from('manager_budgets').select('tokens').eq('organization_id', org.id),
        ])
        const totalBudget = orgBudget?.total_tokens ?? null
        const allocatedTokens = (managerBudgets ?? []).reduce((s, b) => s + b.tokens, 0)
        return {
          org,
          employeeCount: employeeCount ?? 0,
          levelCount: levelCount ?? 0,
          challengeCount: challengeCount ?? 0,
          activeChallengeCount: activeChallengeCount ?? 0,
          totalBudget,
          allocatedTokens,
        }
      })
    )

    return <SuperAdminDashboard orgs={orgSummaries} />
  }

  if (!profile?.organization_id) {
    if (profile?.role === 'employee') redirect('/login')
    return <OrgSetup />
  }

  const orgId = profile.organization_id

  // ── Tenant admin redirect to admin routes ─────────────────────────────────
  if (profile.role === 'tenant_admin') {
    redirect('/dashboard/admin')
  }

  // ── Employee role ─────────────────────────────────────────────────────────
  if (profile.role === 'employee') {
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', user.email!)
      .single()

    if (!employee) redirect('/login')

    const { data: directReports } = await supabase
      .from('employees').select('id').eq('manager_id', employee.id)
    const hasReports = (directReports?.length ?? 0) > 0

    // Redirect to appropriate view based on manager status
    if (hasReports) {
      redirect('/dashboard/manager')
    } else {
      redirect('/dashboard/employee')
    }
  }

  // Fallback
  return null
}
