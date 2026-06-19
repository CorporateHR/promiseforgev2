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

export type ChallengeStatus = 'draft' | 'active' | 'completed' | 'disabled'

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
  manager_id: string | null
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

export interface OrgBudgetTransaction {
  id: string
  organization_id: string
  amount: number
  new_total: number
  created_by: string | null
  created_at: string
}

export interface ManagerBudgetTransaction {
  id: string
  organization_id: string
  manager_id: string
  amount: number      // positive = allocated to manager, negative = returned to pool
  new_total: number
  allocated_by: string | null
  created_at: string
}

export interface EmployeeBudgetTransaction {
  id: string
  organization_id: string
  manager_id: string
  employee_id: string
  amount: number      // positive = allocated to employee, negative = returned to manager
  new_total: number
  allocated_by: string | null
  created_at: string
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

export interface MarketplaceItem {
  id: string
  org_id: string
  name: string
  description: string | null
  category: string | null
  token_price: number
  quantity_limit: number | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface MarketplaceRedemption {
  id: string
  org_id: string
  employee_id: string
  item_id: string
  tokens_spent: number
  status: 'pending' | 'approved' | 'rejected'
  admin_reason: string | null
  requested_at: string
  resolved_at: string | null
  resolved_by: string | null
  item?: MarketplaceItem
  employee?: { id: string; full_name: string; email: string | null }
}
