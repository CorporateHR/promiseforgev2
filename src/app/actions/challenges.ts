'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TierDraft, ChallengeWithTiers } from '@/lib/types'

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

// Returns available tokens for challenges in an org.
// available = org_budget − manager_allocations − existing challenge reservations (non-ended)
async function computeAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  excludeChallengeId?: string,   // exclude self when re-checking at publish
): Promise<number> {
  const [
    { data: orgBudget },
    { data: managerBudgets },
    { data: challengeBudgets },
  ] = await Promise.all([
    supabase.from('org_budgets').select('total_tokens').eq('organization_id', orgId).single(),
    supabase.from('manager_budgets').select('tokens').eq('organization_id', orgId),
    supabase.from('challenges').select('id, token_budget').eq('organization_id', orgId).neq('status', 'ended'),
  ])

  const total = orgBudget?.total_tokens ?? 0
  const managerUsed = (managerBudgets ?? []).reduce((s, b) => s + b.tokens, 0)
  const challengeUsed = (challengeBudgets ?? [])
    .filter(c => c.id !== excludeChallengeId)
    .reduce((s, c) => s + c.token_budget, 0)

  return Math.max(0, total - managerUsed - challengeUsed)
}

function computeWorstCase(tiers: TierDraft[], totalEmployees: number): number {
  const base = tiers.find(t => t.is_individual)?.base_tokens ?? 0
  const groupBonus = tiers
    .filter(t => !t.is_individual && t.enabled)
    .reduce((s, t) => s + t.bonus_tokens, 0)
  return totalEmployees * (base + groupBonus)
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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

  revalidatePath('/dashboard')
  return { success: true, challengeId: challenge.id }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function publishChallenge(
  challengeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const profile = await getTenantProfile(supabase)
  if (!profile) return { error: 'Forbidden' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status, token_budget')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== profile.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'draft') return { error: 'Only draft challenges can be published' }

  // Re-check budget (exclude self from current reservations)
  const available = await computeAvailable(supabase, challenge.organization_id, challengeId)
  if (challenge.token_budget > available) {
    return { error: `Insufficient budget to publish. Need ${challenge.token_budget.toLocaleString()} tokens but only ${available.toLocaleString()} available.` }
  }

  const { error } = await supabase
    .from('challenges')
    .update({ status: 'active' })
    .eq('id', challengeId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function endChallenge(
  challengeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const profile = await getTenantProfile(supabase)
  if (!profile) return { error: 'Forbidden' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== profile.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Only active challenges can be ended' }

  const { error } = await supabase
    .from('challenges')
    .update({ status: 'ended' })
    .eq('id', challengeId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function deleteChallenge(
  challengeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const profile = await getTenantProfile(supabase)
  if (!profile) return { error: 'Forbidden' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== profile.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'draft') return { error: 'Only draft challenges can be deleted' }

  const { error } = await supabase.from('challenges').delete().eq('id', challengeId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
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
    .select('id, status, organization_id')
    .eq('id', challengeId)
    .single()

  if (!challenge || challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Verify employee belongs to same org and matches calling user
  const { data: employee } = await supabase
    .from('employees')
    .select('id, email, organization_id')
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
  return { success: true }
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
