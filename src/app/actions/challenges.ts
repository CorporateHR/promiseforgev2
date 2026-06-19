'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TierDraft, ChallengeWithTiers } from '@/lib/types'
import { sendEmail, challengePublishedHtml, challengeCompleteHtml } from '@/lib/email'

function buildSubtreeIds(
  managerId: string,
  all: { id: string; manager_id: string | null }[],
): Set<string> {
  const result = new Set<string>()
  const queue = [managerId]
  const seen = new Set<string>()
  while (queue.length) {
    const id = queue.shift()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const e of all) {
      if (e.manager_id === id) { result.add(e.id); queue.push(e.id) }
    }
  }
  return result
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function getTenantProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'tenant_admin') return null
  return profile
}

// Returns the authenticated user's employee record (for manager actions).
async function getCallerEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const { data: employee } = await supabase
    .from('employees')
    .select('id, organization_id, email')
    .eq('email', user.email)
    .single()
  return employee ?? null
}

// Returns available tokens for org-wide challenges.
// available = org_budget − manager_allocations − org-wide challenge reservations (non-ended)
// Manager-scoped challenges are funded from manager_budgets, not counted here.
async function computeAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  excludeChallengeId?: string,
): Promise<number> {
  const [
    { data: orgBudget },
    { data: managerBudgets },
    { data: challengeBudgets },
  ] = await Promise.all([
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('manager_budgets').select('tokens').eq('organization_id', orgId),
    supabase.from('challenges')
      .select('id, token_budget')
      .eq('organization_id', orgId)
      .is('manager_id', null)
      .in('status', ['draft', 'active']),
  ])

  const total = orgBudget?.total_tokens ?? 0
  const managerUsed = (managerBudgets ?? []).reduce((s, b) => s + b.tokens, 0)
  const challengeUsed = (challengeBudgets ?? [])
    .filter(c => c.id !== excludeChallengeId)
    .reduce((s, c) => s + c.token_budget, 0)

  return Math.max(0, total - managerUsed - challengeUsed)
}

// Returns available tokens from a manager's budget for new manager-scoped challenges.
// available = manager_budget − existing manager-scoped challenge reservations (non-ended)
async function computeManagerAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  managerId: string,
  excludeChallengeId?: string,
): Promise<number> {
  const [
    { data: managerBudget },
    { data: challengeBudgets },
  ] = await Promise.all([
    supabase.from('manager_budgets').select('tokens').eq('organization_id', orgId).eq('manager_id', managerId).single(),
    supabase.from('challenges')
      .select('id, token_budget')
      .eq('organization_id', orgId)
      .eq('manager_id', managerId)
      .in('status', ['draft', 'active']),
  ])

  const total = managerBudget?.tokens ?? 0
  const challengeUsed = (challengeBudgets ?? [])
    .filter(c => c.id !== excludeChallengeId)
    .reduce((s, c) => s + c.token_budget, 0)

  return Math.max(0, total - challengeUsed)
}

function computeWorstCase(tiers: TierDraft[], totalEmployees: number): number {
  const base = tiers.find(t => t.is_individual)?.base_tokens ?? 0
  const groupBonus = tiers
    .filter(t => !t.is_individual && t.enabled)
    .reduce((s, t) => s + t.bonus_tokens, 0)
  return totalEmployees * (base + groupBonus)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function updateChallenge(
  challengeId: string,
  input: {
    title: string
    description: string
    start_date: string | null
    due_date: string | null
    tiers: TierDraft[]
  },
): Promise<{ success: true; token_budget: number } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, status, created_by, organization_id, manager_id')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.status !== 'draft') return { error: 'Only draft challenges can be edited' }
  if (challenge.created_by !== user.id) return { error: 'Only the challenge creator can edit it' }

  if (!input.title.trim()) return { error: 'Title is required' }
  if (!input.description.trim()) return { error: 'Description is required' }

  const orgId = challenge.organization_id

  // Compute employee count for worst-case
  let employeeCount: number
  if (challenge.manager_id) {
    const { data: allEmps } = await supabase
      .from('employees').select('id, manager_id').eq('organization_id', orgId)
    const all = allEmps ?? []
    const subtreeIds: string[] = []
    const queue = [challenge.manager_id]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const reports = all.filter(e => e.manager_id === id)
      subtreeIds.push(...reports.map(r => r.id))
      queue.push(...reports.map(r => r.id))
    }
    subtreeIds.push(challenge.manager_id)
    employeeCount = subtreeIds.length
  } else {
    const { count } = await supabase
      .from('employees').select('id', { count: 'exact', head: true }).eq('organization_id', orgId)
    employeeCount = count ?? 0
  }

  const worstCase = computeWorstCase(input.tiers, employeeCount)

  // Budget check excluding this challenge's existing reservation
  const available = challenge.manager_id
    ? await computeManagerAvailable(supabase, orgId, challenge.manager_id, challengeId)
    : await computeAvailable(supabase, orgId, challengeId)

  if (worstCase > available) {
    return { error: `Insufficient budget. Worst-case cost is ${worstCase.toLocaleString()} tokens but only ${available.toLocaleString()} are available.` }
  }

  // Update challenge
  const { error: updateErr } = await supabase
    .from('challenges')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      token_budget: worstCase,
    })
    .eq('id', challengeId)

  if (updateErr) return { error: updateErr.message }

  // Replace tiers
  await supabase.from('challenge_tiers').delete().eq('challenge_id', challengeId)
  const { error: tiersErr } = await supabase.from('challenge_tiers').insert(
    input.tiers.map(t => ({
      challenge_id: challengeId,
      level: t.level,
      label: t.label,
      is_individual: t.is_individual,
      enabled: t.enabled,
      threshold_pct: t.is_individual ? null : t.threshold_pct,
      base_tokens: t.base_tokens,
      bonus_tokens: t.bonus_tokens,
    }))
  )
  if (tiersErr) return { error: tiersErr.message }

  revalidatePath('/dashboard', 'layout')
  return { success: true, token_budget: worstCase }
}

export async function updatePublishedChallengeInfo(
  challengeId: string,
  input: { title: string; description: string; start_date: string | null; due_date: string | null },
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, status, created_by')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.status !== 'active' && challenge.status !== 'completed') return { error: 'Only active or completed challenges can be updated this way' }
  if (challenge.created_by !== user.id) return { error: 'Only the challenge creator can edit it' }

  if (!input.title.trim()) return { error: 'Title is required' }
  if (!input.description.trim()) return { error: 'Description is required' }

  const { error: updateErr } = await supabase
    .from('challenges')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      start_date: input.start_date || null,
      due_date: input.due_date || null,
    })
    .eq('id', challengeId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createChallenge(
  orgId: string,
  input: {
    title: string
    description: string
    start_date: string | null
    due_date: string | null
    tiers: TierDraft[]
  },
): Promise<{ success: true; challengeId: string } | { error: string }> {
  const supabase = await createClient()
  const profile = await getTenantProfile(supabase)
  if (!profile) return { error: 'Forbidden' }
  if (profile.organization_id !== orgId) return { error: 'Forbidden' }

  if (!input.title.trim()) return { error: 'Title is required' }
  if (!input.description.trim()) return { error: 'Description is required' }

  // Total employees in org
  const { count: totalEmployees } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)

  const worstCase = computeWorstCase(input.tiers, totalEmployees ?? 0)

  // Budget check
  const available = await computeAvailable(supabase, orgId)
  if (worstCase > available) {
    return { error: `Insufficient token budget. Worst-case cost is ${worstCase.toLocaleString()} tokens but only ${available.toLocaleString()} are available.` }
  }

  // Insert challenge
  const { data: challenge, error: challengeErr } = await supabase
    .from('challenges')
    .insert({
      organization_id: orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      status: 'draft',
      token_budget: worstCase,
      created_by: profile.id,
    })
    .select('id')
    .single()

  if (challengeErr || !challenge) return { error: challengeErr?.message ?? 'Failed to create challenge' }

  // Insert tiers
  const tierRows = input.tiers.map(t => ({
    challenge_id: challenge.id,
    level: t.level,
    label: t.label,
    is_individual: t.is_individual,
    enabled: t.enabled,
    threshold_pct: t.is_individual ? null : t.threshold_pct,
    base_tokens: t.base_tokens,
    bonus_tokens: t.bonus_tokens,
  }))

  const { error: tiersErr } = await supabase.from('challenge_tiers').insert(tierRows)
  if (tiersErr) {
    // Roll back the challenge if tiers fail
    await supabase.from('challenges').delete().eq('id', challenge.id)
    return { error: tiersErr.message }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, challengeId: challenge.id }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function createManagerChallenge(
  orgId: string,
  input: {
    title: string
    description: string
    start_date: string | null
    due_date: string | null
    tiers: TierDraft[]
  },
): Promise<{ success: true; challengeId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Forbidden' }
  const manager = await getCallerEmployee(supabase)
  if (!manager) return { error: 'Forbidden' }
  if (manager.organization_id !== orgId) return { error: 'Forbidden' }

  if (!input.title.trim()) return { error: 'Title is required' }
  if (!input.description.trim()) return { error: 'Description is required' }

  // Build subtree to get scoped employee count
  const { data: allEmployees } = await supabase
    .from('employees')
    .select('id, manager_id')
    .eq('organization_id', orgId)

  function buildSubtreeIds(managerId: string, all: { id: string; manager_id: string | null }[]): string[] {
    const result: string[] = []
    const queue = [managerId]
    const seen = new Set<string>()
    while (queue.length) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const reports = all.filter(e => e.manager_id === id)
      result.push(...reports.map(r => r.id))
      queue.push(...reports.map(r => r.id))
    }
    return result
  }

  const subtreeIds = buildSubtreeIds(manager.id, allEmployees ?? [])
  subtreeIds.push(manager.id)  // manager participates in their own challenge
  const subtreeCount = subtreeIds.length

  const worstCase = computeWorstCase(input.tiers, subtreeCount)

  // Budget check against manager's allocated budget
  const available = await computeManagerAvailable(supabase, orgId, manager.id)
  if (worstCase > available) {
    return { error: `Insufficient token budget. Worst-case cost is ${worstCase.toLocaleString()} tokens but only ${available.toLocaleString()} are available in your budget.` }
  }

  // Insert challenge with manager_id set
  const { data: challenge, error: challengeErr } = await supabase
    .from('challenges')
    .insert({
      organization_id: orgId,
      title: input.title.trim(),
      description: input.description.trim(),
      start_date: input.start_date || null,
      due_date: input.due_date || null,
      status: 'draft',
      token_budget: worstCase,
      created_by: user.id,
      manager_id: manager.id,
    })
    .select('id')
    .single()

  if (challengeErr || !challenge) return { error: challengeErr?.message ?? 'Failed to create challenge' }

  // Insert tiers
  const tierRows = input.tiers.map(t => ({
    challenge_id: challenge.id,
    level: t.level,
    label: t.label,
    is_individual: t.is_individual,
    enabled: t.enabled,
    threshold_pct: t.is_individual ? null : t.threshold_pct,
    base_tokens: t.base_tokens,
    bonus_tokens: t.bonus_tokens,
  }))

  const { error: tiersErr } = await supabase.from('challenge_tiers').insert(tierRows)
  if (tiersErr) {
    await supabase.from('challenges').delete().eq('id', challenge.id)
    return { error: tiersErr.message }
  }

  revalidatePath('/dashboard', 'layout')
  return { success: true, challengeId: challenge.id }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function publishChallenge(
  challengeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status, token_budget, manager_id, title, description, due_date')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.status !== 'draft') return { error: 'Only draft challenges can be published' }

  // Tenant admins can publish any challenge in their org
  const adminProfile = await getTenantProfile(supabase)
  if (adminProfile && adminProfile.organization_id === challenge.organization_id) {
    const budgetCheck = challenge.manager_id
      ? await computeManagerAvailable(supabase, challenge.organization_id, challenge.manager_id, challengeId)
      : await computeAvailable(supabase, challenge.organization_id, challengeId)
    if (challenge.token_budget > budgetCheck) {
      return { error: `Insufficient budget to publish. Need ${challenge.token_budget.toLocaleString()} tokens but only ${budgetCheck.toLocaleString()} available.` }
    }
  } else if (challenge.manager_id) {
    const caller = await getCallerEmployee(supabase)
    if (!caller || caller.id !== challenge.manager_id || caller.organization_id !== challenge.organization_id) return { error: 'Forbidden' }
    const available = await computeManagerAvailable(supabase, challenge.organization_id, caller.id, challengeId)
    if (challenge.token_budget > available) {
      return { error: `Insufficient budget to publish. Need ${challenge.token_budget.toLocaleString()} tokens but only ${available.toLocaleString()} available.` }
    }
  } else {
    return { error: 'Forbidden' }
  }

  const { error } = await supabase
    .from('challenges')
    .update({ status: 'active' })
    .eq('id', challengeId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')

  // Fire-and-forget: notify employees in scope about the new challenge
  ;(async () => {
    try {
      let employeesToNotify: { id: string; full_name: string | null; email: string | null; manager_id?: string | null }[]
      if (challenge.manager_id) {
        const { data: allEmps } = await supabase
          .from('employees')
          .select('id, full_name, email, manager_id')
          .eq('organization_id', challenge.organization_id)
        const subtree = buildSubtreeIds(challenge.manager_id, allEmps ?? [])
        employeesToNotify = (allEmps ?? []).filter(e => subtree.has(e.id) && e.email)
      } else {
        const { data: allEmps } = await supabase
          .from('employees')
          .select('id, full_name, email')
          .eq('organization_id', challenge.organization_id)
        employeesToNotify = (allEmps ?? []).filter(e => e.email)
      }
      await Promise.allSettled(
        employeesToNotify.map(emp =>
          sendEmail(
            emp.email!,
            emp.full_name ?? '',
            `New Challenge: "${challenge.title}"`,
            challengePublishedHtml(emp.full_name ?? '', challenge.title, challenge.description, challenge.due_date, challengeId),
          ).catch(err => console.error('[Challenge Published] Email failed:', err)),
        ),
      )
    } catch (err) {
      console.error('[Challenge Published] Notification error:', err)
    }
  })()

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function endChallenge(
  challengeId: string,
): Promise<{ success: true; newStatus: 'completed' | 'disabled' } | { error: string }> {
  const supabase = await createClient()

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status, manager_id')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.status !== 'active') return { error: 'Only active challenges can be ended' }

  // Tenant admins can end any challenge in their org
  const adminProfile = await getTenantProfile(supabase)
  if (!adminProfile || adminProfile.organization_id !== challenge.organization_id) {
    if (challenge.manager_id) {
      const caller = await getCallerEmployee(supabase)
      if (!caller || caller.id !== challenge.manager_id || caller.organization_id !== challenge.organization_id) return { error: 'Forbidden' }
    } else {
      return { error: 'Forbidden' }
    }
  }

  const { data: newStatus, error } = await supabase.rpc('end_challenge_with_status', { p_challenge_id: challengeId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true, newStatus: newStatus as 'completed' | 'disabled' }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function deleteChallenge(
  challengeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status, manager_id')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.status !== 'draft') return { error: 'Only draft challenges can be deleted' }

  // Tenant admins can delete any challenge in their org
  const adminProfile = await getTenantProfile(supabase)
  if (!adminProfile || adminProfile.organization_id !== challenge.organization_id) {
    if (challenge.manager_id) {
      const caller = await getCallerEmployee(supabase)
      if (!caller || caller.id !== challenge.manager_id || caller.organization_id !== challenge.organization_id) return { error: 'Forbidden' }
    } else {
      return { error: 'Forbidden' }
    }
  }

  const { error } = await supabase.from('challenges').delete().eq('id', challengeId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard', 'layout')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function recordCompletion(
  challengeId: string,
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Verify challenge is active
  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, status, organization_id, title, manager_id')
    .eq('id', challengeId)
    .single()

  if (!challenge || (challenge.status !== 'active' && challenge.status !== 'completed')) return { error: 'Challenge is not active' }

  // Verify employee belongs to same org and matches calling user
  const { data: employee } = await supabase
    .from('employees')
    .select('id, email, organization_id, full_name, manager_id')
    .eq('id', employeeId)
    .single()

  if (!employee) return { error: 'Employee not found' }
  if (employee.organization_id !== challenge.organization_id) return { error: 'Forbidden' }
  if (employee.email?.toLowerCase() !== user.email?.toLowerCase()) return { error: 'You can only mark your own completion' }

  const { error } = await supabase
    .from('challenge_completions')
    .upsert(
      { challenge_id: challengeId, employee_id: employeeId },
      { onConflict: 'challenge_id,employee_id', ignoreDuplicates: true },
    )

  if (error) return { error: error.message }

  // Fire-and-forget: notify manager or tenant admins about completion
  ;(async () => {
    try {
      const empName = employee.full_name ?? employee.email ?? 'An employee'
      if (challenge.manager_id) {
        const { data: manager } = await supabase
          .from('employees')
          .select('full_name, email')
          .eq('id', challenge.manager_id)
          .single()
        if (manager?.email) {
          await sendEmail(
            manager.email,
            manager.full_name ?? '',
            `${empName} completed "${challenge.title}"`,
            challengeCompleteHtml(manager.full_name ?? 'Manager', empName, challenge.title, challengeId, 'manager'),
          ).catch(err => console.error('[Completion] Manager email failed:', err))
        }
      } else {
        const { data: adminEmails } = await supabase
          .rpc('get_tenant_admin_emails', { p_org_id: challenge.organization_id })
        const adminEmailList: string[] = adminEmails ?? []
        await Promise.allSettled(
          adminEmailList.map(email =>
            sendEmail(
              email,
              'Admin',
              `${empName} completed "${challenge.title}"`,
              challengeCompleteHtml('Admin', empName, challenge.title, challengeId, 'admin'),
            ).catch(err => console.error('[Completion] Admin email failed:', err)),
          ),
        )
      }
    } catch (err) {
      console.error('[Completion] Notification error:', err)
    }
  })()

  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getLiveCompletions(
  challengeId: string,
): Promise<{ completedIds: string[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()
  if (!profile?.organization_id) return { error: 'No organization' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('organization_id')
    .eq('id', challengeId)
    .single()
  if (!challenge || challenge.organization_id !== profile.organization_id) return { error: 'Not found' }

  const { data } = await supabase
    .from('challenge_completions')
    .select('employee_id')
    .eq('challenge_id', challengeId)

  return { completedIds: (data ?? []).map((c: any) => c.employee_id) }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function getChallengesWithTiers(
  orgId: string,
): Promise<{ challenges: ChallengeWithTiers[] } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('challenges')
    .select('*, challenge_tiers(*)')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  const challenges: ChallengeWithTiers[] = (data ?? []).map((c: any) => ({
    ...c,
    tiers: (c.challenge_tiers ?? []) as any,
  }))

  return { challenges }
}
