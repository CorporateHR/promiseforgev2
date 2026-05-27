import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ManagerChallengeDetailWrapper from '@/components/ManagerChallengeDetailWrapper'

export default async function ManagerChallengeDetail({
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
    { data: levelConfigs },
    { data: employee },
    { data: challengeRaw },
    { data: allOrgEmployees },
    { data: completionsRaw },
  ] = await Promise.all([
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId).eq('email', user.email!).single(),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('id', challengeId).single(),
    supabase.from('employees').select('id, full_name, first_name, last_name, level, manager_id, email, employee_id, team_name').eq('organization_id', orgId),
    supabase.from('challenge_completions').select('challenge_id, employee_id, challenges!inner(organization_id)').eq('challenges.organization_id', orgId).eq('challenge_id', challengeId),
  ])

  if (!employee || !challengeRaw) redirect('/dashboard/manager')

  const challenge = {
    ...challengeRaw,
    tiers: (challengeRaw as any).challenge_tiers ?? [],
  }

  const completedIds = new Set((completionsRaw ?? []).map((c: any) => c.employee_id))

  return (
    <ManagerChallengeDetailWrapper
      challenge={challenge}
      manager={employee}
      levelConfigs={levelConfigs ?? []}
      allOrgEmployees={(allOrgEmployees ?? []) as any[]}
      initialCompletedIds={completedIds}
    />
  )
}
