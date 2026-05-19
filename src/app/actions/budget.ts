'use server'

import { createClient } from '@/lib/supabase/server'

// Super admin sets the total token budget for an org
export async function setOrgBudget(orgId: string, totalTokens: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('org_budgets')
    .upsert(
      { organization_id: orgId, total_tokens: totalTokens, created_by: user.id },
      { onConflict: 'organization_id' }
    )

  if (error) return { error: error.message }
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

  if (tokens <= 0) {
    const { error } = await supabase
      .from('employee_allocations')
      .delete()
      .eq('manager_id', managerId)
      .eq('employee_id', employeeId)
    if (error) return { error: error.message }
    return { success: true }
  }

  const { error } = await supabase
    .from('employee_allocations')
    .upsert(
      { organization_id: orgId, manager_id: managerId, employee_id: employeeId, tokens, allocated_by: user.id },
      { onConflict: 'manager_id,employee_id' },
    )

  if (error) return { error: error.message }
  return { success: true }
}

// Tenant admin allocates tokens to a specific manager
export async function allocateManagerBudget(orgId: string, managerId: string, tokens: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (tokens <= 0) {
    const { error } = await supabase
      .from('manager_budgets')
      .delete()
      .eq('organization_id', orgId)
      .eq('manager_id', managerId)
    if (error) return { error: error.message }
    return { success: true }
  }

  const { error } = await supabase
    .from('manager_budgets')
    .upsert(
      { organization_id: orgId, manager_id: managerId, tokens, allocated_by: user.id },
      { onConflict: 'organization_id,manager_id' }
    )

  if (error) return { error: error.message }
  return { success: true }
}
