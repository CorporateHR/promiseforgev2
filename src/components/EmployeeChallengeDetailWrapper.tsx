'use client'

import { useRouter } from 'next/navigation'
import EmployeeChallengeDetail from './EmployeeChallengeDetail'
import type { ChallengeWithTiers, Employee, OrgLevelConfig } from '@/lib/types'

interface Props {
  challenge: ChallengeWithTiers
  employee: Employee
  allEmployees: Employee[]
  allCompletions: { challenge_id: string; employee_id: string; completed_at: string }[]
  levelConfigs: Pick<OrgLevelConfig, 'level' | 'label'>[]
}

export default function EmployeeChallengeDetailWrapper({
  challenge,
  employee,
  allEmployees,
  allCompletions,
  levelConfigs,
}: Props) {
  const router = useRouter()

  const handleBack = () => {
    router.push('/dashboard/employee?tab=challenges')
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
      levelConfigs={levelConfigs}
      onBack={handleBack}
      onComplete={handleComplete}
    />
  )
}
