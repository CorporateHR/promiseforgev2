import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Derive manager status for employee-role users
  let isManager = false
  if ((profile?.role === 'employee' || profile?.role === 'tenant_admin') && profile.organization_id && user.email) {
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('email', user.email)
      .single()
    if (emp) {
      const { count } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('manager_id', emp.id)
      isManager = (count ?? 0) > 0
    }
  }

  return (
    <DashboardShell profile={profile} userEmail={user.email ?? ''} isManager={isManager}>
      {children}
    </DashboardShell>
  )
}
