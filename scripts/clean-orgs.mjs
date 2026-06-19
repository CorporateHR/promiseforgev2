/**
 * clean-orgs.mjs
 *
 * Wipes one or all organizations and every row that belongs to them, then
 * deletes the matching Supabase Auth accounts. Profiles / auth users that
 * have no organization_id (super_admin seats) are always preserved.
 *
 * Usage:
 *   # Dev (uses .env.local keys automatically):
 *   node --env-file=.env.local scripts/clean-orgs.mjs --org "Acme Corp"
 *   node --env-file=.env.local scripts/clean-orgs.mjs --org-id <uuid>
 *   node --env-file=.env.local scripts/clean-orgs.mjs --all --confirm
 *   node --env-file=.env.local scripts/clean-orgs.mjs --all --dry-run
 *
 *   # Production (pass keys explicitly):
 *   SUPABASE_URL=https://ryxvkfbhopclyvarctvz.supabase.co SUPABASE_SERVICE_ROLE_KEY=<prod-key> node scripts/clean-orgs.mjs --org "Acme Corp"
 *
 * Tables purged (in FK-safe order):
 *   challenge_completions → challenge_tiers → employee_allocations
 *   → manager_budgets → org_budgets → challenges → employees
 *   → org_level_configs → profiles (org-scoped) → auth users → organizations
 *
 * RETAINED: profiles + auth users where organization_id IS NULL (super_admin)
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

// Override with SUPABASE_URL env var to target dev:
//   SUPABASE_URL=https://zdcoiucknxmzuhgspfvk.supabase.co SUPABASE_SERVICE_ROLE_KEY=<dev-key> node scripts/clean-orgs.mjs --all --confirm
// Production (default — no env var needed):
//   SUPABASE_SERVICE_ROLE_KEY=<prod-key> node scripts/clean-orgs.mjs --org "Acme"
const SUPABASE_URL     = process.env.SUPABASE_URL ?? 'https://ryxvkfbhopclyvarctvz.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eHZrZmJob3BjbHl2YXJjdHZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NzIxNCwiZXhwIjoyMDkzNjczMjE0fQ.mQKvTNOigvTwQqaRxtDaUiaPov3qVlF3pOerqldk6UE'

// ── CLI flags ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)

const flag = (name) => {
  const idx = args.indexOf(name)
  return idx !== -1 ? args[idx + 1] ?? true : null
}

const has = (name) => args.includes(name)

const ORG_NAME   = flag('--org')    // exact name match
const ORG_ID     = flag('--org-id') // UUID
const ALL_ORGS   = has('--all')
const DRY_RUN    = has('--dry-run')
const CONFIRMED  = has('--confirm')

// ── Validation ────────────────────────────────────────────────────────────────

if (!ORG_NAME && !ORG_ID && !ALL_ORGS) {
  console.error('❌  You must pass --org <name>, --org-id <uuid>, or --all')
  console.error('    Add --dry-run to preview without deleting.')
  process.exit(1)
}

if (ALL_ORGS && !CONFIRMED && !DRY_RUN) {
  console.error('❌  --all requires --confirm (or --dry-run to preview).')
  console.error('    This will delete EVERY organization and all related data.')
  process.exit(1)
}

// ── Client ────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const BOLD  = '\x1b[1m'
const RED   = '\x1b[31m'
const GREEN = '\x1b[32m'
const CYAN  = '\x1b[36m'
const DIM   = '\x1b[2m'
const RESET = '\x1b[0m'

function section(label) {
  console.log(`\n${CYAN}── ${label}${RESET}`)
}

async function deleteRows(table, column, ids, label) {
  if (!ids.length) { console.log(`  ${DIM}${label}: nothing to delete${RESET}`); return 0 }
  if (DRY_RUN)     { console.log(`  ${DIM}[dry-run] would delete from ${table} where ${column} in (${ids.length} id(s))${RESET}`); return ids.length }

  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .in(column, ids)

  if (error) throw new Error(`Failed deleting ${table}: ${error.message}`)
  console.log(`  ${GREEN}✓${RESET}  ${label}: deleted ${count ?? '?'} row(s)`)
  return count ?? 0
}

// Paginate through a select query and collect all IDs (bypasses 1000-row cap)
async function collectAllIds(table, selectCol, filterCol, filterIds) {
  const PAGE = 1000
  let from = 0
  const collected = []
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(selectCol)
      .in(filterCol, filterIds)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`Failed collecting IDs from ${table}: ${error.message}`)
    if (!data?.length) break
    collected.push(...data.map(r => r[selectCol]))
    if (data.length < PAGE) break
    from += PAGE
  }
  return collected
}

// ── Resolve target org IDs ────────────────────────────────────────────────────

async function resolveOrgIds() {
  if (ALL_ORGS) {
    const { data, error } = await supabase.from('organizations').select('id, name')
    if (error) throw new Error(`Failed to list orgs: ${error.message}`)
    return data ?? []
  }

  if (ORG_ID) {
    const { data, error } = await supabase
      .from('organizations').select('id, name').eq('id', ORG_ID).single()
    if (error || !data) throw new Error(`No organization found with id "${ORG_ID}"`)
    return [data]
  }

  // --org name lookup (case-insensitive)
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .ilike('name', ORG_NAME)

  if (error) throw new Error(`Org lookup failed: ${error.message}`)
  if (!data?.length) throw new Error(`No organization found with name "${ORG_NAME}"`)
  if (data.length > 1) {
    console.error(`❌  Multiple orgs matched "${ORG_NAME}":`)
    data.forEach(o => console.error(`    • ${o.name}  (${o.id})`))
    console.error('    Use --org-id <uuid> to target one specifically.')
    process.exit(1)
  }
  return [data[0]]
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${BOLD}Promiseforge — Org Cleanup${RESET}${DRY_RUN ? `  ${RED}[DRY RUN — no changes will be made]${RESET}` : ''}`)

  // 1. Resolve target orgs
  const targetOrgs = await resolveOrgIds()
  const orgIds = targetOrgs.map(o => o.id)

  section('Target organizations')
  targetOrgs.forEach(o => console.log(`  • ${o.name}  ${DIM}(${o.id})${RESET}`))

  if (!orgIds.length) { console.log('\nNothing to delete.'); return }

  // 2. Collect child IDs we'll need for cascading deletes (paginated — avoids 1000-row cap)
  section('Collecting dependent IDs')

  const employeeIds = await collectAllIds('employees', 'id', 'organization_id', orgIds)
  console.log(`  Found ${employeeIds.length} employee(s)`)

  const challengeIds = await collectAllIds('challenges', 'id', 'organization_id', orgIds)
  console.log(`  Found ${challengeIds.length} challenge(s)`)

  // profiles: collect ALL org-scoped IDs (needed for auth user deletion)
  const orgProfileIds = await collectAllIds('profiles', 'id', 'organization_id', orgIds)
  console.log(`  Found ${orgProfileIds.length} org-scoped profile(s)  ${DIM}(super_admin profiles will NOT be deleted)${RESET}`)

  // 3. Delete in FK-safe order
  section('Deleting data')

  // challenge_completions — delete by challenge_id (small set, avoids huge IN clause)
  if (challengeIds.length) {
    const completionIds = await collectAllIds('challenge_completions', 'id', 'challenge_id', challengeIds)
    await deleteRows('challenge_completions', 'id', completionIds, 'Challenge completions')
  } else {
    console.log(`  ${DIM}challenge_completions: nothing to delete${RESET}`)
  }

  // challenge_tiers → challenges
  await deleteRows('challenge_tiers', 'challenge_id', challengeIds, 'Challenge tiers')

  // employee_allocations → org
  await deleteRows('employee_allocations', 'organization_id', orgIds, 'Employee allocations')

  // manager_budgets → org
  await deleteRows('manager_budgets', 'organization_id', orgIds, 'Manager budgets')

  // org_budgets → org
  await deleteRows('org_budgets', 'organization_id', orgIds, 'Org budgets')

  // challenges → org
  await deleteRows('challenges', 'organization_id', orgIds, 'Challenges')

  // employees — nullify self-referential manager_id first to avoid FK cycle
  if (employeeIds.length && !DRY_RUN) {
    const { error } = await supabase
      .from('employees')
      .update({ manager_id: null })
      .in('organization_id', orgIds)
    if (error) throw new Error(`Failed nullifying manager_id: ${error.message}`)
    console.log(`  ${GREEN}✓${RESET}  Nullified self-referential manager_id on ${employeeIds.length} employee(s)`)
  } else if (employeeIds.length) {
    console.log(`  ${DIM}[dry-run] would nullify manager_id on ${employeeIds.length} employee(s)${RESET}`)
  }
  await deleteRows('employees', 'organization_id', orgIds, 'Employees')

  // org_level_configs → org
  await deleteRows('org_level_configs', 'organization_id', orgIds, 'Org level configs')

  // org-scoped profiles — delete by organization_id directly (super_admin rows have NULL org_id so are untouched)
  await deleteRows('profiles', 'organization_id', orgIds, 'Profiles (org-scoped)')

  // 4. Delete auth users for org-scoped profiles
  section('Deleting auth users')
  if (!orgProfileIds.length) {
    console.log(`  ${DIM}No auth users to delete${RESET}`)
  } else if (DRY_RUN) {
    console.log(`  ${DIM}[dry-run] would delete ${orgProfileIds.length} auth user(s)${RESET}`)
  } else {
    let authDeleted = 0, authFailed = 0
    const BATCH = 25  // concurrent requests per wave
    for (let i = 0; i < orgProfileIds.length; i += BATCH) {
      const chunk = orgProfileIds.slice(i, i + BATCH)
      const results = await Promise.all(
        chunk.map(uid => supabase.auth.admin.deleteUser(uid))
      )
      for (const { error } of results) {
        if (error) {
          if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
            authFailed++
          }
        } else {
          authDeleted++
        }
      }
      process.stdout.write(`\r  Deleting auth users... ${i + chunk.length}/${orgProfileIds.length}`)
    }
    console.log(`\r  ${GREEN}✓${RESET}  Auth users deleted: ${authDeleted}  ${authFailed ? `(${authFailed} not found / already gone)` : ''}                `)
  }

  // 5. Delete orgs last
  section('Deleting organizations')
  await deleteRows('organizations', 'id', orgIds, 'Organizations')

  // 6. Summary
  console.log(`\n${'─'.repeat(44)}`)
  if (DRY_RUN) {
    console.log(`  ${RED}DRY RUN complete — no rows were modified.${RESET}`)
    console.log(`  Re-run without --dry-run (and with --confirm for --all) to apply.`)
  } else {
    console.log(`  ${GREEN}${BOLD}Done.${RESET}  Cleaned ${targetOrgs.length} org(s).`)
    console.log(`  Super-admin profiles (no organization_id) were preserved.`)
  }
  console.log(`${'─'.repeat(44)}\n`)
}

main().catch(err => {
  console.error(`\n${RED}❌  Fatal:${RESET}`, err.message)
  process.exit(1)
})
