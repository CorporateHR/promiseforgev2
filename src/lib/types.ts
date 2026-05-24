export interface Organization {
  id: string
  name: string
  slug: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  organization_id: string | null
  avatar_url: string | null
}

export interface OrgLevelConfig {
  id: string
  organization_id: string
  level: number
  label: string
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  organization_id: string
  employee_id: string | null
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  team_name: string | null
  level: number
  manager_id: string | null
  created_at: string
  updated_at: string
}

// Employee with resolved children (built client-side from flat list)
export interface EmployeeNode extends Employee {
  children: EmployeeNode[]
}

export interface OrgBudget {
  id: string
  organization_id: string
  total_tokens: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ManagerBudget {
  id: string
  organization_id: string
  manager_id: string
  tokens: number
  allocated_by: string | null
  created_at: string
  updated_at: string
}

export type ChallengeStatus = 'draft' | 'active' | 'ended'

export interface Challenge {
  id: string
  organization_id: string
  title: string
  description: string
  start_date: string | null
  due_date: string | null
  status: ChallengeStatus
  token_budget: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ChallengeTier {
  id: string
  challenge_id: string
  level: number
  label: string
  is_individual: boolean
  enabled: boolean
  threshold_pct: number | null
  base_tokens: number
  bonus_tokens: number
  created_at: string
  updated_at: string
}

export interface ChallengeCompletion {
  id: string
  challenge_id: string
  employee_id: string
  completed_at: string
}

export interface ChallengeWithTiers extends Challenge {
  tiers: ChallengeTier[]
}

export interface TierDraft {
  level: number
  label: string
  is_individual: boolean
  enabled: boolean
  threshold_pct: number
  base_tokens: number
  bonus_tokens: number
}

export interface EmployeeAllocation {
  id: string
  organization_id: string
  manager_id: string
  employee_id: string
  tokens: number
  allocated_by: string | null
  created_at: string
  updated_at: string
}
