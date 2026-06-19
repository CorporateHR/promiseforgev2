import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminChallengeDetailView from '@/components/AdminChallengeDetailView'

export default async function AdminChallengeDetailPage({
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

  if (!profile?.organization_id || profile.role !== 'tenant_admin') {
    redirect('/dashboard')
  }

  const orgId = profile.organization_id

  const [
    { data: levelConfigs },
    { data: employees },
    { data: challengeRaw },
    { data: completionsRaw },
  ] = await Promise.all([
    supabase.from('org_level_configs').select('*').eq('organization_id', orgId).order('level'),
    supabase.from('employees').select('*').eq('organization_id', orgId).order('level').order('full_name'),
    supabase.from('challenges').select('*, challenge_tiers(*)').eq('id', challengeId).single(),
    supabase.from('challenge_completions').select('employee_id').eq('challenge_id', challengeId),
  ])

  if (!challengeRaw) redirect('/dashboard/admin/challenges')

  const challenge = {
    ...challengeRaw,
    tiers: (challengeRaw as any).challenge_tiers ?? [],
  }

  const completedEmployeeIds = new Set((completionsRaw ?? []).map((c: any) => c.employee_id))
  const isCreator = (challengeRaw as any).created_by === user.id

  return (
    <AdminChallengeDetailView
      challenge={challenge}
      levelConfigs={levelConfigs ?? []}
      allEmployees={employees ?? []}
      initialCompletedIds={completedEmployeeIds}
      isCreator={isCreator}
    />
  )
}
