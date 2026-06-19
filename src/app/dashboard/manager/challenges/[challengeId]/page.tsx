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
    supabase.rpc('get_org_completions', { p_org_id: orgId }),
  ])

  if (!employee || !challengeRaw) redirect('/dashboard/manager')

  const challenge = {
    ...challengeRaw,
    tiers: (challengeRaw as any).challenge_tiers ?? [],
  }

  const allEmployees = (allOrgEmployees ?? []) as any[]

  // If this is a subordinate's challenge (created by someone below the current manager),
  // show the detail from the challenge creator's perspective so the scope is correct.
  const challengeManagerId = (challengeRaw as any).manager_id as string | null
  let effectiveManager = employee
  if (challengeManagerId && challengeManagerId !== employee.id) {
    // Check if challenge creator is in current manager's subtree
    function isInSubtree(targetId: string, rootId: string): boolean {
      const queue = [rootId]
      const seen = new Set<string>()
      while (queue.length) {
        const id = queue.shift()!
        if (seen.has(id)) continue
        seen.add(id)
        const reports = allEmployees.filter((e: any) => e.manager_id === id)
        if (reports.some((r: any) => r.id === targetId)) return true
        queue.push(...reports.map((r: any) => r.id))
      }
      return false
    }
    if (isInSubtree(challengeManagerId, employee.id)) {
      const challengeCreator = allEmployees.find((e: any) => e.id === challengeManagerId)
      if (challengeCreator) effectiveManager = challengeCreator
    }
  }

  const completedIds = new Set<string>(
    (completionsRaw as any[] ?? []).filter((c: any) => c.challenge_id === challengeId).map((c: any) => c.employee_id as string)
  )

  const isCreator = (challengeRaw as any).created_by === user.id

  return (
    <ManagerChallengeDetailWrapper
      challenge={challenge}
      manager={effectiveManager}
      levelConfigs={levelConfigs ?? []}
      allOrgEmployees={allEmployees}
      initialCompletedIds={completedIds}
      isCreator={isCreator}
    />
  )
}
