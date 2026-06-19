import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EmployeeChallengeDetailWrapper from '@/components/EmployeeChallengeDetailWrapper'

export default async function EmployeeChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>
}) {
  const { challengeId } = await params
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
    { data: employee },
    { data: challengeRaw },
    { data: allOrgEmployees },
    { data: allCompletionsRaw },
    { data: levelConfigs },
  ] = await Promise.all([
    supabase.from('employees').select('*').eq('organization_id', orgId).eq('email', user.email!).single(),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('id', challengeId).single(),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.rpc('get_org_completions', { p_org_id: orgId }),
    supabase.from('org_level_configs').select('level, label').eq('organization_id', orgId),
  ])

  if (!employee || !challengeRaw) redirect('/dashboard/employee')

  const challenge = {
    ...challengeRaw,
    tiers: (challengeRaw as any).challenge_tiers ?? [],
  }

  const allCompletions = ((allCompletionsRaw ?? []) as any[]).map(({ challenge_id, employee_id, completed_at }: any) => ({ challenge_id, employee_id, completed_at }))

  return (
    <EmployeeChallengeDetailWrapper
      challenge={challenge}
      employee={employee}
      allEmployees={(allOrgEmployees ?? []) as any[]}
      allCompletions={allCompletions}
      levelConfigs={levelConfigs ?? []}
    />
  )
}
