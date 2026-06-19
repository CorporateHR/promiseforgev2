'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { MarketplaceItem, MarketplaceRedemption } from '@/lib/types'
import {
  sendEmail,
  redemptionRequestedHtml,
  redemptionApprovedHtml,
  redemptionRejectedHtml,
} from '@/lib/email'

// ─── Admin: manage items ──────────────────────────────────────────────────────

export async function getMarketplaceItems(orgId: string): Promise<MarketplaceItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
  return (data ?? []) as MarketplaceItem[]
}

export async function createMarketplaceItem(data: {
  orgId: string
  name: string
  description?: string
  category?: string
  token_price: number
  quantity_limit?: number | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase.from('marketplace_items').insert({
    org_id: data.orgId,
    name: data.name.trim(),
    description: data.description?.trim() || null,
    category: data.category?.trim() || null,
    token_price: data.token_price,
    quantity_limit: data.quantity_limit ?? null,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/marketplace')
  return { success: true }
}

export async function updateMarketplaceItem(
  id: string,
  updates: Partial<Pick<MarketplaceItem, 'name' | 'description' | 'category' | 'token_price' | 'quantity_limit' | 'is_active'>>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('marketplace_items')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/marketplace')
  revalidatePath('/dashboard/employee')
  return { success: true }
}

export async function deleteMarketplaceItem(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('marketplace_items')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/marketplace')
  return { success: true }
}

// ─── Employee: browse & redeem ────────────────────────────────────────────────

export async function getActiveMarketplaceItems(orgId: string): Promise<MarketplaceItem[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  return (data ?? []) as MarketplaceItem[]
}

export async function redeemItem(
  employeeId: string,
  itemId: string,
  earnedTokens: number,
  orgId: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch item
  const { data: item } = await supabase
    .from('marketplace_items')
    .select('*')
    .eq('id', itemId)
    .eq('is_active', true)
    .single()
  if (!item) return { error: 'Item not found or inactive' }

  // Sum tokens already locked (pending + approved redemptions for this employee)
  const { data: existingRedemptions } = await supabase
    .from('marketplace_redemptions')
    .select('tokens_spent, status')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])

  const locked = (existingRedemptions ?? []).reduce((s: number, r: any) => s + r.tokens_spent, 0)
  const available = earnedTokens - locked

  if (available < item.token_price) {
    return { error: `Insufficient tokens. You have ${available} available but this item costs ${item.token_price}.` }
  }

  // Check stock
  if (item.quantity_limit !== null) {
    const { count } = await supabase
      .from('marketplace_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('item_id', itemId)
      .in('status', ['pending', 'approved'])
    if ((count ?? 0) >= item.quantity_limit) {
      return { error: 'This item is out of stock.' }
    }
  }

  // Check not already pending for this employee + item
  const { count: alreadyPending } = await supabase
    .from('marketplace_redemptions')
    .select('*', { count: 'exact', head: true })
    .eq('employee_id', employeeId)
    .eq('item_id', itemId)
    .eq('status', 'pending')
  if ((alreadyPending ?? 0) > 0) {
    return { error: 'You already have a pending request for this item.' }
  }

  const { error } = await supabase.from('marketplace_redemptions').insert({
    org_id: orgId,
    employee_id: employeeId,
    item_id: itemId,
    tokens_spent: item.token_price,
    status: 'pending',
  })

  if (error) return { error: error.message }
  revalidatePath('/dashboard/employee')

  // Fire-and-forget: notify tenant admins of new redemption request
  ;(async () => {
    try {
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('id', employeeId)
        .single()
      const { data: adminEmails } = await supabase
        .rpc('get_tenant_admin_emails', { p_org_id: orgId })
      const adminEmailList: string[] = adminEmails ?? []
      await Promise.allSettled(
        adminEmailList.map(email =>
          sendEmail(
            email,
            'Admin',
            `Redemption request: ${item.name}`,
            redemptionRequestedHtml(
              'Admin',
              emp?.full_name ?? emp?.email ?? 'An employee',
              item.name,
              item.token_price,
            ),
          ).catch(err => console.error('[Redemption Request] Admin email failed:', err)),
        ),
      )
    } catch (err) {
      console.error('[Redemption Request] Notification error:', err)
    }
  })()

  return { success: true }
}

export async function getMyRedemptions(employeeId: string): Promise<MarketplaceRedemption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketplace_redemptions')
    .select('*, item:marketplace_items(*)')
    .eq('employee_id', employeeId)
    .order('requested_at', { ascending: false })
  return (data ?? []) as any[]
}

// ─── Admin: manage redemption requests ───────────────────────────────────────

export async function getAllRedemptions(orgId: string): Promise<MarketplaceRedemption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('marketplace_redemptions')
    .select('*, item:marketplace_items(*), employee:employees(id, full_name, email)')
    .eq('org_id', orgId)
    .order('requested_at', { ascending: false })
  return (data ?? []) as any[]
}

export async function resolveRedemption(
  id: string,
  status: 'approved' | 'rejected',
  reason?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Fetch redemption details before update so we can notify the employee
  const { data: redemption } = await supabase
    .from('marketplace_redemptions')
    .select('employee:employees(full_name, email), item:marketplace_items(name)')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('marketplace_redemptions')
    .update({
      status,
      admin_reason: reason?.trim() || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard/admin/marketplace')
  revalidatePath('/dashboard/employee')

  // Fire-and-forget: notify employee of outcome
  if (redemption) {
    const emp = redemption.employee as { full_name?: string | null; email?: string | null } | null
    const item = redemption.item as { name?: string | null } | null
    if (emp?.email && item?.name) {
      const empName = emp.full_name ?? emp.email
      const subject = status === 'approved'
        ? `Your redemption for "${item.name}" was approved`
        : `Your redemption for "${item.name}" was not approved`
      const html = status === 'approved'
        ? redemptionApprovedHtml(empName, item.name)
        : redemptionRejectedHtml(empName, item.name, reason)
      sendEmail(emp.email, emp.full_name ?? '', subject, html)
        .catch(err => console.error('[Resolve Redemption] Email failed:', err))
    }
  }

  return { success: true }
}
