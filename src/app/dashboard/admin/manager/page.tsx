import { redirect } from 'next/navigation'

export default async function AdminManagerViewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  redirect(tab ? `/dashboard/manager?tab=${tab}` : '/dashboard/manager')
}
