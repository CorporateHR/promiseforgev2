'use client'

import { useRouter } from 'next/navigation'
import EmployeeChallengeDetail from './EmployeeChallengeDetail'
import type { ChallengeWithTiers, Employee } from '@/lib/types'

interface Props {
  challenge: ChallengeWithTiers
  employee: Employee
  allEmployees: Employee[]
  allCompletions: { challenge_id: string; employee_id: string; completed_at: string }[]
}

export default function EmployeeChallengeDetailWrapper({
  challenge,
  employee,
  allEmployees,
  allCompletions,
}: Props) {
  const router = useRouter()

  const handleBack = () => {
    router.push('/dashboard/employee')
  }

  const handleComplete = () => {
    router.refresh()
  }

  return (
    <EmployeeChallengeDetail
      challenge={challenge}
      employee={employee}
      allEmployees={allEmployees}
      allCompletions={allCompletions}
      onBack={handleBack}
      onComplete={handleComplete}
    />
  )
}
