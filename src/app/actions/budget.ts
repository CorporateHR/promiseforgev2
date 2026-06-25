'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, orgBudgetSetHtml, managerBudgetSetHtml, employeeBudgetSetHtml } from '@/lib/email'

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

    // Notify tenant admins of this org — fire-and-forget, doesn't block the response.
    // Uses the admin client because `profiles` RLS only allows reading your own row.
    ;(async () => {
      try {
        const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
        const admin = createAdminClient()
        const { data: admins } = await admin
          .from('profiles')
          .select('full_name, email')
          .eq('organization_id', orgId)
          .eq('role', 'tenant_admin')
        const orgName = org?.name ?? 'your organization'
        await Promise.allSettled(
          (admins ?? []).filter(a => a.email).map(a =>
            sendEmail(
              a.email!,
              a.full_name ?? '',
              `${orgName}'s token budget was updated`,
              orgBudgetSetHtml(a.full_name ?? '', orgName, delta, totalTokens),
            ).catch(err => console.error('[Org Budget Set] Email failed:', err)),
          ),
        )
      } catch (err) {
        console.error('[Org Budget Set] Notification error:', err)
      }
    })()
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

  // Notify the employee — fire-and-forget, doesn't block the response.
  ;(async () => {
    try {
      const { data: employee } = await supabase.from('employees').select('full_name, email').eq('id', employeeId).single()
      const { data: manager } = await supabase.from('employees').select('full_name').eq('id', managerId).single()
      if (employee?.email) {
        await sendEmail(
          employee.email,
          employee.full_name ?? '',
          'Your token budget was updated',
          employeeBudgetSetHtml(employee.full_name ?? '', manager?.full_name ?? 'your manager', delta, tokens),
        )
      }
    } catch (err) {
      console.error('[Employee Budget Set] Email failed:', err)
    }
  })()

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

  // Notify the manager — fire-and-forget, doesn't block the response.
  ;(async () => {
    try {
      const { data: manager } = await supabase.from('employees').select('full_name, email').eq('id', managerId).single()
      const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
      if (manager?.email) {
        await sendEmail(
          manager.email,
          manager.full_name ?? '',
          'Your token budget was updated',
          managerBudgetSetHtml(manager.full_name ?? '', org?.name ?? 'your organization', delta, tokens),
        )
      }
    } catch (err) {
      console.error('[Manager Budget Set] Email failed:', err)
    }
  })()

  revalidatePath('/dashboard/manager')
  revalidatePath('/dashboard/admin/manager')
  revalidatePath('/dashboard/admin/budget')
  return { success: true }
}
