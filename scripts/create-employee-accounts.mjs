/**
 * create-employee-accounts.mjs
 *
 * Creates Supabase auth accounts for every employee in the DB who has an email
 * but no existing auth account. Sets a default password and marks their profile
 * as role='employee'.
 *
 * Usage:
 *   # Dev (uses .env.local keys automatically):
 *   node --env-file=.env.local scripts/create-employee-accounts.mjs
 *   node --env-file=.env.local scripts/create-employee-accounts.mjs --org "Ishaan Corp"
 *   node --env-file=.env.local scripts/create-employee-accounts.mjs --password "MyPass@123"
 *
 *   # Production (pass keys explicitly):
 *   SUPABASE_URL=https://ryxvkfbhopclyvarctvz.supabase.co SUPABASE_SERVICE_ROLE_KEY=<prod-key> node scripts/create-employee-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js'

// ── Config ────────────────────────────────────────────────────────────────────

// Override with SUPABASE_URL env var to target dev:
//   SUPABASE_URL=https://zdcoiucknxmzuhgspfvk.supabase.co SUPABASE_SERVICE_ROLE_KEY=<dev-key> node scripts/create-employee-accounts.mjs
// Production (default — no env var needed):
//   SUPABASE_SERVICE_ROLE_KEY=<prod-key> node scripts/create-employee-accounts.mjs
const SUPABASE_URL     = process.env.SUPABASE_URL ?? 'https://ryxvkfbhopclyvarctvz.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eHZrZmJob3BjbHl2YXJjdHZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA5NzIxNCwiZXhwIjoyMDkzNjczMjE0fQ.mQKvTNOigvTwQqaRxtDaUiaPov3qVlF3pOerqldk6UE'

// Parse --password flag, fallback to default
const passwordFlagIdx = process.argv.indexOf('--password')
const DEFAULT_PASSWORD = passwordFlagIdx !== -1
  ? process.argv[passwordFlagIdx + 1]
  : 'Manager@gmail.com'

// Parse --org flag (filter by org name, case-insensitive exact match)
const orgFlagIdx = process.argv.indexOf('--org')
const ORG_FILTER = orgFlagIdx !== -1 ? process.argv[orgFlagIdx + 1] : null

// Parse --org-id flag (use org UUID directly, skips name lookup)
const orgIdFlagIdx = process.argv.indexOf('--org-id')
const ORG_ID_DIRECT = orgIdFlagIdx !== -1 ? process.argv[orgIdFlagIdx + 1] : null

// ── Validation ────────────────────────────────────────────────────────────────


// ── Main ──────────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log(`\n🔧  Promiseforge — Bulk Employee Account Creator`)
  console.log(`    Password : ${DEFAULT_PASSWORD}`)
  if (ORG_FILTER) console.log(`    Org filter : "${ORG_FILTER}"`)
  if (ORG_ID_DIRECT) console.log(`    Org ID     : ${ORG_ID_DIRECT}`)
  console.log()

  // 1. Resolve org ID if --org or --org-id flag provided
  let orgId = ORG_ID_DIRECT ?? null
  if (ORG_ID_DIRECT) {
    const { data: org, error: orgErr } = await supabase
      .from('organizations').select('id, name').eq('id', ORG_ID_DIRECT).single()
    if (orgErr || !org) { console.error(`❌  No organization found with id "${ORG_ID_DIRECT}"`); process.exit(1) }
    console.log(`🏢  Targeting org: ${org.name} (${org.id})\n`)
  } else if (ORG_FILTER) {
    const { data: orgs, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('name', ORG_FILTER)
    if (orgErr) { console.error('❌  Failed to look up org:', orgErr.message); process.exit(1) }
    if (!orgs?.length) { console.error(`❌  No organization found with name "${ORG_FILTER}"`); process.exit(1) }
    if (orgs.length > 1) {
      console.log(`⚠️   Multiple orgs matched "${ORG_FILTER}":`)
      orgs.forEach(o => console.log(`    • ${o.name} (${o.id})`))
      console.error('    Use --org-id <uuid> to target one specifically.')
      process.exit(1)
    }
    orgId = orgs[0].id
    console.log(`🏢  Targeting org: ${orgs[0].name} (${orgId})\n`)
  }

  // 2. Fetch employees with an email (paginate — Supabase caps at 1000/request)
  const employees = []
  const PAGE = 1000
  let from = 0
  while (true) {
    let query = supabase
      .from('employees')
      .select('id, employee_id, first_name, last_name, email, organization_id')
      .not('email', 'is', null)
    if (orgId) query = query.eq('organization_id', orgId)
    const { data, error: empErr } = await query.range(from, from + PAGE - 1)
    if (empErr) { console.error('❌  Failed to fetch employees:', empErr.message); process.exit(1) }
    if (!data?.length) break
    employees.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  if (!employees.length) { console.log('ℹ️   No employees with emails found.'); return }
  console.log(`📋  Found ${employees.length} employee(s) with emails.\n`)

  // 3. Fetch ALL existing auth users (paginate through pages)
  const existingEmails = new Set()
  let page = 1
  while (true) {
    const { data: { users, nextPage }, error: usersErr } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (usersErr) { console.error('❌  Failed to list existing users:', usersErr.message); process.exit(1) }
    users.forEach(u => u.email && existingEmails.add(u.email.toLowerCase()))
    if (!nextPage) break
    page = nextPage
  }

  // 4. Process each employee
  let created = 0, skipped = 0, failed = 0
  const failures = []

  for (const emp of employees) {
    const email = emp.email.toLowerCase().trim()
    const name  = `${emp.first_name} ${emp.last_name}`

    if (existingEmails.has(email)) {
      console.log(`  ⏭   ${name} (${email}) — already has an account, skipping`)
      skipped++
      continue
    }

    // Create auth user (email_confirm: true skips the confirmation email)
    const { data: authData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: 'employee',
      },
    })

    if (createErr) {
      // "already registered" means it exists in auth but wasn't in our listUsers snapshot — treat as skip
      if (createErr.message.includes('already been registered') || createErr.message.includes('already registered')) {
        console.log(`  ⏭   ${name} (${email}) — already registered (missed in snapshot), skipping`)
        existingEmails.add(email) // prevent duplicate attempts if email appears twice
        skipped++
        continue
      }
      console.error(`  ❌  ${name} (${email}) — ${createErr.message}`)
      failures.push({ email, name, error: createErr.message })
      failed++
      continue
    }

    // Upsert profile with role='employee'
    const { error: profileErr } = await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: name,
      role: 'employee',
      organization_id: emp.organization_id,
    }, { onConflict: 'id' })

    if (profileErr) {
      console.warn(`  ⚠️   ${name} — auth created but profile upsert failed: ${profileErr.message}`)
    }

    console.log(`  ✅  ${name} (${email}) — created`)
    created++
  }

  // 5. Summary
  console.log('\n─────────────────────────────────────────')
  console.log(`  ✅  Created : ${created}`)
  console.log(`  ⏭   Skipped : ${skipped}  (already existed)`)
  console.log(`  ❌  Failed  : ${failed}`)
  console.log('─────────────────────────────────────────\n')

  if (failures.length) {
    console.log('Failed rows:')
    failures.forEach(f => console.log(`  • ${f.name} <${f.email}> — ${f.error}`))
    console.log()
  }
}

main().catch(err => { console.error('Unexpected error:', err); process.exit(1) })
