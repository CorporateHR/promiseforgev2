'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Super admin sets the total token budget for an org
export async function setOrgBudget(orgId: string, totalTokens: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch current total to compute delta for the transaction log
  const { data: existing } = await supabase
    .from('org_budgets')
    .select('total_tokens')
    .eq('organization_id', orgId)
    .single()
  const oldTotal = existing?.total_tokens ?? 0
  const delta = totalTokens - oldTotal

  const { error } = await supabase
    .from('org_budgets')
    .upsert(
      { organization_id: orgId, total_tokens: totalTokens, created_by: user.id },
      { onConflict: 'organization_id' }
    )

  if (error) return { error: error.message }

  // Log the transaction (skip if delta is somehow 0)
  if (delta !== 0) {
    await supabase.from('org_budget_transactions').insert({
      organization_id: orgId,
      amount: delta,
      new_total: totalTokens,
      created_by: user.id,
    })
  }

  return { success: true }
}

// Manager allocates tokens to one of their direct reports (capped at their own budget)
export async function allocateEmployeeBudget(
  orgId: string,
  managerId: string,
  employeeId: string,
  tokens: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Read current allocation to compute delta for the transaction log
  const { data: existing } = await supabase
    .from('employee_allocations')
    .select('tokens')
    .eq('manager_id', managerId)
    .eq('employee_id', employeeId)
    .single()
  const oldTokens = existing?.tokens ?? 0

  if (tokens <= 0) {
    const { error } = await supabase
      .from('employee_allocations')
      .delete()
      .eq('manager_id', managerId)
      .eq('employee_id', employeeId)
    if (error) return { error: error.message }
    if (oldTokens > 0) {
      await supabase.from('employee_budget_transactions').insert({
        organization_id: orgId,
        manager_id: managerId,
        employee_id: employeeId,
        amount: -oldTokens,
        new_total: 0,
        allocated_by: user.id,
      })
    }
    revalidatePath('/dashboard/manager')
    return { success: true }
  }

  const delta = tokens - oldTokens
  if (delta === 0) return { success: true }

  const { error } = await supabase
    .from('employee_allocations')
    .upsert(
      { organization_id: orgId, manager_id: managerId, employee_id: employeeId, tokens, allocated_by: user.id },
      { onConflict: 'manager_id,employee_id' },
    )
  if (error) return { error: error.message }

  await supabase.from('employee_budget_transactions').insert({
    organization_id: orgId,
    manager_id: managerId,
    employee_id: employeeId,
    amount: delta,
    new_total: tokens,
    allocated_by: user.id,
  })

  revalidatePath('/dashboard/manager')
  return { success: true }
}

// Tenant admin allocates tokens to a specific manager
export async function allocateManagerBudget(orgId: string, managerId: string, tokens: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Read current allocation to compute real delta for the transaction log
  const { data: existing } = await supabase
    .from('manager_budgets')
    .select('tokens')
    .eq('organization_id', orgId)
    .eq('manager_id', managerId)
    .single()
  const oldTokens = existing?.tokens ?? 0

  if (tokens <= 0) {
    const { error } = await supabase
      .from('manager_budgets')
      .delete()
      .eq('organization_id', orgId)
      .eq('manager_id', managerId)
    if (error) return { error: error.message }
    if (oldTokens > 0) {
      await supabase.from('manager_budget_transactions').insert({
        organization_id: orgId,
        manager_id: managerId,
        amount: -oldTokens,
        new_total: 0,
        allocated_by: user.id,
      })
    }
    revalidatePath('/dashboard/manager')
    revalidatePath('/dashboard/admin/budget')
    return { success: true }
  }

  const delta = tokens - oldTokens
  if (delta === 0) return { success: true }

  const { error } = await supabase
    .from('manager_budgets')
    .upsert(
      { organization_id: orgId, manager_id: managerId, tokens, allocated_by: user.id },
      { onConflict: 'organization_id,manager_id' }
    )
  if (error) return { error: error.message }

  await supabase.from('manager_budget_transactions').insert({
    organization_id: orgId,
    manager_id: managerId,
    amount: delta,
    new_total: tokens,
    allocated_by: user.id,
  })

  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/admin/manager')
  revalidatePath('/dashboard/admin/budget')
  return { success: true }
}
