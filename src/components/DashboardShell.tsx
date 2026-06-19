'use client'

import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'
import { LayoutDashboard, User, Users } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface Props {
  profile: Profile | null
  userEmail: string
  isManager?: boolean
  children: React.ReactNode
}

// Separate component so useSearchParams is inside a Suspense boundary
function ViewSwitcher({ profile, isManager, currentPath }: { profile: Profile | null; isManager: boolean; currentPath: string }) {
  const router = useRouter()

  const role = profile?.role

  // Which tabs to show
  const showAdmin   = role === 'tenant_admin'
  const showManager = isManager
  const showEmployee = true

  // Only render switcher if there's more than one tab
  const tabCount = (showAdmin ? 1 : 0) + (showManager ? 1 : 0) + (showEmployee ? 1 : 0)
  if (tabCount <= 1) return null

  // Derive active tab based on current path
  const active =
    currentPath.includes('/admin/employee') ? 'employee'
    : currentPath.includes('/admin/manager') ? 'manager'
    : currentPath.includes('/admin') ? 'admin'
    : currentPath.includes('/manager') ? 'manager'
    : currentPath.includes('/employee') ? 'employee'
    : role === 'tenant_admin' ? 'admin'
    : isManager ? 'manager'
    : 'employee'

  const pill = (label: string, icon: React.ReactNode, target: string, key: string) => (
    <button
      key={key}
      onClick={() => router.push(target)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
        active === key ? 'bg-white text-[#1e3a5f] shadow' : 'text-white/60 hover:text-white'
      }`}
    >
      {icon} {label}
    </button>
  )

  // Determine base path for navigation
  const isTenantAdmin = role === 'tenant_admin'
  const adminPath = isTenantAdmin ? '/dashboard/admin' : '/dashboard'
  const managerPath = '/dashboard/manager'
  const employeePath = isTenantAdmin ? '/dashboard/admin/employee' : '/dashboard/employee'

  return (
    <div className="flex items-center bg-white/10 border border-white/15 rounded-lg p-0.5 gap-0.5">
      {showAdmin    && pill('Admin',    <LayoutDashboard size={12} />, adminPath,    'admin')}
      {showManager  && pill('Manager',  <Users size={12} />,           managerPath,  'manager')}
      {showEmployee && pill('Employee', <User size={12} />,            employeePath, 'employee')}
    </div>
  )
}

export default function DashboardShell({ profile, userEmail, isManager = false, children }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = (profile?.full_name ?? userEmail)
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-14 bg-[#1e3a5f] flex items-center px-5 gap-4 flex-shrink-0 shadow-md z-40 sticky top-0">
        <div className="flex items-center gap-2 text-yellow-300 font-extrabold text-base tracking-tight">
          ⚡ Promiseforge
        </div>
        <div className="w-px h-6 bg-white/20" />
        <span className="text-white/70 text-sm font-medium">
          {profile?.role === 'super_admin' ? 'Super Admin' : 'Organization'}
        </span>

        {/* Role switcher */}
        <Suspense fallback={null}>
          <ViewSwitcher profile={profile} isManager={isManager} currentPath={pathname} />
        </Suspense>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-lg px-3 py-1.5">
            <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="text-right">
              <div className="text-white text-xs font-semibold leading-tight">
                {profile?.full_name ?? userEmail}
              </div>
              <div className="text-white/40 text-[10px] capitalize">
                {profile?.role === 'super_admin' ? 'Super Admin'
                  : profile?.role === 'employee' ? (isManager ? 'Manager' : 'Employee')
                  : 'Tenant Admin'}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
