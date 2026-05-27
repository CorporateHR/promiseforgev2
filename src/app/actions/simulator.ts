'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Shared subtree util (server-side) ───────────────────────────────────────
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

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getTenantAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
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

// ─── Admin: mark one employee as complete ─────────────────────────────────────
export async function adminMarkCompletion(
  challengeId: string,
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  // Verify challenge belongs to admin's org and is active
  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Verify employee belongs to same org
  const { data: employee } = await supabase
    .from('employees')
    .select('id, organization_id')
    .eq('id', employeeId)
    .single()

  if (!employee || employee.organization_id !== admin.organization_id) return { error: 'Employee not found' }

  const { error } = await supabase
    .from('challenge_completions')
    .upsert(
      { challenge_id: challengeId, employee_id: employeeId },
      { onConflict: 'challenge_id,employee_id', ignoreDuplicates: true },
    )

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true }
}

// ─── Admin: mark ALL employees as complete ────────────────────────────────────
export async function adminMarkAllCompletion(
  challengeId: string,
): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Get all employees in org
  const { data: employees } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', admin.organization_id)

  if (!employees || employees.length === 0) return { success: true, count: 0 }

  // Get already-completed employee IDs
  const { data: existing } = await supabase
    .from('challenge_completions')
    .select('employee_id')
    .eq('challenge_id', challengeId)

  const doneSet = new Set((existing ?? []).map(c => c.employee_id))
  const toInsert = employees
    .filter(e => !doneSet.has(e.id))
    .map(e => ({ challenge_id: challengeId, employee_id: e.id }))

  if (toInsert.length === 0) return { success: true, count: 0 }

  const { error } = await supabase
    .from('challenge_completions')
    .upsert(toInsert, { onConflict: 'challenge_id,employee_id', ignoreDuplicates: true })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, count: toInsert.length }
}

// ─── Admin: mark a specific GROUP of employees as complete ───────────────────
export async function adminMarkGroupCompletion(
  challengeId: string,
  employeeIds: string[],
): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  if (employeeIds.length === 0) return { success: true, count: 0 }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, organization_id, status')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Verify all employees belong to admin's org
  const { data: validEmployees } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', admin.organization_id)
    .in('id', employeeIds)

  const validIds = (validEmployees ?? []).map(e => e.id)
  if (validIds.length === 0) return { success: true, count: 0 }

  const toInsert = validIds.map(id => ({ challenge_id: challengeId, employee_id: id }))

  const { error } = await supabase
    .from('challenge_completions')
    .upsert(toInsert, { onConflict: 'challenge_id,employee_id', ignoreDuplicates: true })

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { success: true, count: validIds.length }
}

// ─── Admin: nudge a specific group of employees ──────────────────────────────
export async function nudgeGroup(
  challengeId: string,
  employeeIds: string[],
): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  if (employeeIds.length === 0) return { success: true, count: 0 }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, title, organization_id, status, due_date')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Fetch employees with email, filtered to the provided IDs
  const { data: emps } = await supabase
    .from('employees')
    .select('id, full_name, email')
    .eq('organization_id', admin.organization_id)
    .in('id', employeeIds)

  // Get completions so we only nudge incomplete ones
  const { data: completions } = await supabase
    .from('challenge_completions')
    .select('employee_id')
    .eq('challenge_id', challengeId)
    .in('employee_id', employeeIds)

  const doneSet = new Set((completions ?? []).map(c => c.employee_id))
  const toNudge = (emps ?? []).filter(e => !doneSet.has(e.id) && e.email)

  for (const emp of toNudge) {
    console.log(`[Simulator] Nudge Group → ${emp.email} | Challenge: ${challenge.title}`)
  }

  return { success: true, count: toNudge.length }
}

// ─── Admin: nudge one employee ────────────────────────────────────────────────
// Sends an email reminder to the employee to complete the challenge.
// Wire up your email provider here (Resend, SendGrid, etc.).
export async function nudgeEmployee(
  challengeId: string,
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  // Fetch challenge + employee in parallel
  const [{ data: challenge }, { data: employee }] = await Promise.all([
    supabase
      .from('challenges')
      .select('id, title, organization_id, status, due_date')
      .eq('id', challengeId)
      .single(),
    supabase
      .from('employees')
      .select('id, full_name, email, organization_id')
      .eq('id', employeeId)
      .single(),
  ])

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }
  if (!employee || employee.organization_id !== admin.organization_id) return { error: 'Employee not found' }
  if (!employee.email) return { error: 'Employee has no email address' }

  // ── Send email ───────────────────────────────────────────────────────────────
  // TODO: Replace with your email provider (e.g. Resend).
  // Example with Resend:
  //   const resend = new Resend(process.env.RESEND_API_KEY)
  //   await resend.emails.send({
  //     from: 'noreply@yourdomain.com',
  //     to: employee.email,
  //     subject: `Reminder: Complete "${challenge.title}"`,
  //     html: nudgeEmailHtml(employee.full_name, challenge.title, challenge.due_date),
  //   })
  //
  // For now we log so the action is fully wired and ready to activate:
  console.log(
    `[Simulator] Nudge → ${employee.email} | Challenge: ${challenge.title} | Due: ${challenge.due_date ?? 'no date'}`,
  )

  return { success: true }
}

// ─── Admin: nudge ALL incomplete employees ────────────────────────────────────
export async function nudgeAll(
  challengeId: string,
): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const admin = await getTenantAdmin(supabase)
  if (!admin) return { error: 'Forbidden' }

  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, title, organization_id, status, due_date')
    .eq('id', challengeId)
    .single()

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== admin.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  // Employees who haven't completed yet
  const [{ data: allEmployees }, { data: completions }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, full_name, email')
      .eq('organization_id', admin.organization_id),
    supabase
      .from('challenge_completions')
      .select('employee_id')
      .eq('challenge_id', challengeId),
  ])

  const doneSet = new Set((completions ?? []).map(c => c.employee_id))
  const incomplete = (allEmployees ?? []).filter(e => !doneSet.has(e.id) && e.email)

  // ── Send nudge emails ────────────────────────────────────────────────────────
  // TODO: Replace the loop below with a batch send via your email provider.
  for (const emp of incomplete) {
    console.log(
      `[Simulator] Nudge All → ${emp.email} | Challenge: ${challenge.title}`,
    )
  }

  return { success: true, count: incomplete.length }
}

// ─── Manager auth helper ──────────────────────────────────────────────────────
async function getManagerEmployee(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'employee') return null
  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('email', user.email!)
    .single()
  if (!employee) return null
  const { count } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('manager_id', employee.id)
  if (!count || count === 0) return null
  return { profile, employee }
}

// ─── Manager: nudge one employee in subtree ───────────────────────────────────
export async function nudgeEmployeeAsManager(
  challengeId: string,
  employeeId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient()
  const mgr = await getManagerEmployee(supabase)
  if (!mgr) return { error: 'Forbidden' }

  const [{ data: challenge }, { data: allOrgEmployees }, { data: target }] = await Promise.all([
    supabase.from('challenges').select('id, title, organization_id, status, due_date').eq('id', challengeId).single(),
    supabase.from('employees').select('id, manager_id').eq('organization_id', mgr.profile.organization_id),
    supabase.from('employees').select('id, full_name, email, organization_id').eq('id', employeeId).single(),
  ])

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== mgr.profile.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }
  if (!target || target.organization_id !== mgr.profile.organization_id) return { error: 'Employee not found' }

  const subtree = buildSubtreeIds(mgr.employee.id, allOrgEmployees ?? [])
  if (!subtree.has(employeeId)) return { error: 'Employee is not in your team' }
  if (!target.email) return { error: 'Employee has no email address' }

  // TODO: Replace with your email provider (e.g. Resend)
  console.log(`[Manager Nudge] → ${target.email} | Challenge: ${challenge.title} | Mgr: ${mgr.employee.full_name}`)

  return { success: true }
}

// ─── Manager: nudge all incomplete in subtree ─────────────────────────────────
export async function nudgeAllIncompleteAsManager(
  challengeId: string,
): Promise<{ success: true; count: number } | { error: string }> {
  const supabase = await createClient()
  const mgr = await getManagerEmployee(supabase)
  if (!mgr) return { error: 'Forbidden' }

  const [{ data: challenge }, { data: allOrgEmployees }, { data: completions }] = await Promise.all([
    supabase.from('challenges').select('id, title, organization_id, status, due_date').eq('id', challengeId).single(),
    supabase.from('employees').select('id, full_name, email, manager_id').eq('organization_id', mgr.profile.organization_id),
    supabase.from('challenge_completions').select('employee_id').eq('challenge_id', challengeId),
  ])

  if (!challenge) return { error: 'Challenge not found' }
  if (challenge.organization_id !== mgr.profile.organization_id) return { error: 'Forbidden' }
  if (challenge.status !== 'active') return { error: 'Challenge is not active' }

  const subtree = buildSubtreeIds(mgr.employee.id, allOrgEmployees ?? [])
  const doneSet = new Set((completions ?? []).map((c: any) => c.employee_id))
  const toNudge = (allOrgEmployees ?? []).filter(e => subtree.has(e.id) && !doneSet.has(e.id) && e.email)

  for (const emp of toNudge) {
    // TODO: Replace with your email provider (e.g. Resend)
    console.log(`[Manager Nudge All] → ${emp.email} | Challenge: ${challenge.title} | Mgr: ${mgr.employee.full_name}`)
  }

  return { success: true, count: toNudge.length }
}
