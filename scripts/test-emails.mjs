// Run with: node --env-file=.env.local scripts/test-emails.mjs

const API_KEY = process.env.BREVO_API_KEY
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL ?? 'admin@promiseforge.com'
const SENDER_NAME = process.env.BREVO_SENDER_NAME ?? 'Promise Forge'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

const TEST_RECIPIENTS = [
  { email: 'yogesh.ai.ux@gmail.com', name: 'Yogesh' },
  { email: 'gi2084@gmail.com', name: 'Test User' },
]

// ─── Brevo send ───────────────────────────────────────────────────────────────

async function sendEmail(to, toName, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo ${res.status}: ${body}`)
  }
  return res.json()
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function shell(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Promise Forge</title>
</head>
<body style="margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f0f12;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:#18181b;border-radius:12px 12px 0 0;padding:28px 40px;border-bottom:1px solid #27272a;">
              <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Promise<span style="color:#6366f1;">Forge</span></span>
            </td>
          </tr>
          <tr>
            <td style="background:#18181b;padding:36px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background:#18181b;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #27272a;">
              <p style="margin:0;font-size:12px;color:#52525b;text-align:center;">
                This email was sent by Promise Forge. If you have questions, contact your administrator.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

const btn = (text, href) =>
  `<a href="${href}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${text}</a>`

const pill = (text, color = '#6366f1') =>
  `<span style="display:inline-block;padding:4px 10px;border-radius:99px;background:${color}1a;color:${color};font-size:12px;font-weight:600;">${text}</span>`

const h1 = text =>
  `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#f4f4f5;letter-spacing:-0.4px;">${text}</h1>`

const p = text =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#a1a1aa;">${text}</p>`

const hr = () => `<hr style="border:none;border-top:1px solid #27272a;margin:24px 0;">`

const metaRow = (label, value) =>
  `<tr><td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;vertical-align:top;">${label}</td><td style="padding:8px 0;font-size:13px;color:#e4e4e7;font-weight:500;">${value}</td></tr>`

const metaTable = rows =>
  `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0;border-radius:8px;background:#0f0f12;padding:4px 16px;">${rows}</table>`

// ─── Templates ────────────────────────────────────────────────────────────────

function nudgeHtml(name) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Action Required', '#f59e0b')}</div>
    ${h1("Don't forget to complete your challenge")}
    ${p(`Hi ${name}, this is a friendly reminder that the challenge below is still waiting for your completion.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Challenge', 'Q2 Sales Performance Goal')}
      ${metaRow('Due date', 'June 30, 2026')}
    `)}
    ${hr()}
    ${p('Log in to your dashboard to mark the challenge complete and earn your tokens.')}
    ${btn('Go to Dashboard', APP_URL)}
  `)
}

function challengePublishedHtml(name) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('New Challenge', '#22c55e')}</div>
    ${h1('A new challenge is now live')}
    ${p(`Hi ${name}, a new challenge has been published and you're invited to participate.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Challenge', 'Q2 Sales Performance Goal')}
      ${metaRow('About', 'Hit your quarterly sales target to earn tokens and boost team morale.')}
      ${metaRow('Due date', 'June 30, 2026')}
    `)}
    ${hr()}
    ${p('Complete the challenge before the deadline to earn tokens you can spend in the marketplace.')}
    ${btn('View Challenge', APP_URL)}
  `)
}

function challengeCompleteHtml(recipientName, employeeName) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Completion', '#22c55e')}</div>
    ${h1(`${employeeName} completed a challenge`)}
    ${p(`Hi ${recipientName}, one of your team members has just marked a challenge as complete.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Employee', employeeName)}
      ${metaRow('Challenge', 'Q2 Sales Performance Goal')}
      ${metaRow('Completed at', 'June 19, 2026 at 10:30 AM')}
    `)}
    ${hr()}
    ${p('You can view the full completion status and manage this challenge from your dashboard.')}
    ${btn('View Dashboard', APP_URL)}
  `)
}

function redemptionRequestedHtml(adminName, employeeName) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Pending Approval', '#f59e0b')}</div>
    ${h1('Marketplace redemption request')}
    ${p(`Hi ${adminName}, an employee has requested to redeem an item from the marketplace and needs your approval.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Employee', employeeName)}
      ${metaRow('Item', 'Amazon Gift Card — $50')}
      ${metaRow('Token cost', '500 tokens')}
      ${metaRow('Status', 'Pending approval')}
    `)}
    ${hr()}
    ${p('Review and approve or reject this request from the Marketplace section of your admin dashboard.')}
    ${btn('Review Request', `${APP_URL}/dashboard/admin/marketplace`)}
  `)
}

function redemptionApprovedHtml(name) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Approved', '#22c55e')}</div>
    ${h1('Your redemption was approved')}
    ${p(`Hi ${name}, great news — your redemption request has been approved by your administrator.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Item', 'Amazon Gift Card — $50')}
      ${metaRow('Status', 'Approved')}
    `)}
    ${hr()}
    ${p('Your administrator will follow up with fulfillment details. You can view your redemption history in your employee dashboard.')}
    ${btn('View My Redemptions', APP_URL)}
  `)
}

function redemptionRejectedHtml(name) {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Not Approved', '#ef4444')}</div>
    ${h1('Your redemption was not approved')}
    ${p(`Hi ${name}, unfortunately your redemption request for <strong style="color:#e4e4e7;">Amazon Gift Card — $50</strong> was not approved at this time.`)}
    ${hr()}
    ${metaTable(`
      ${metaRow('Item', 'Amazon Gift Card — $50')}
      ${metaRow('Status', 'Rejected')}
      ${metaRow('Reason', 'Item currently reserved for Q3 distribution only.')}
    `)}
    ${hr()}
    ${p('Your tokens have been returned to your balance. If you have questions, please reach out to your administrator.')}
    ${btn('Go to Dashboard', APP_URL)}
  `)
}

// ─── Test suite ───────────────────────────────────────────────────────────────

const EMAILS = [
  {
    key: 'nudge',
    subject: '[TEST] Reminder: Complete "Q2 Sales Performance Goal"',
    html: r => nudgeHtml(r.name),
  },
  {
    key: 'challenge_published',
    subject: '[TEST] New Challenge: "Q2 Sales Performance Goal"',
    html: r => challengePublishedHtml(r.name),
  },
  {
    key: 'challenge_complete',
    subject: '[TEST] Sarah completed "Q2 Sales Performance Goal"',
    html: r => challengeCompleteHtml(r.name, 'Sarah Johnson'),
  },
  {
    key: 'redemption_requested',
    subject: '[TEST] Redemption request: Amazon Gift Card — $50',
    html: r => redemptionRequestedHtml(r.name, 'Alex Chen'),
  },
  {
    key: 'redemption_approved',
    subject: '[TEST] Your redemption for "Amazon Gift Card — $50" was approved',
    html: r => redemptionApprovedHtml(r.name),
  },
  {
    key: 'redemption_rejected',
    subject: '[TEST] Your redemption for "Amazon Gift Card — $50" was not approved',
    html: r => redemptionRejectedHtml(r.name),
  },
]

async function run() {
  if (!API_KEY) {
    console.error('❌  BREVO_API_KEY is not set. Run with: node --env-file=.env.local scripts/test-emails.mjs')
    process.exit(1)
  }

  // Build full task list
  const tasks = []
  for (const template of EMAILS) {
    for (const recipient of TEST_RECIPIENTS) {
      tasks.push({ template, recipient, done: false })
    }
  }

  const MAX_ATTEMPTS = 10
  let attempt = 0

  while (tasks.some(t => !t.done) && attempt < MAX_ATTEMPTS) {
    attempt++
    const pending = tasks.filter(t => !t.done)
    if (attempt === 1) {
      console.log(`\n📧  Sending ${tasks.length} emails (will retry failures up to ${MAX_ATTEMPTS}x)...\n`)
    } else {
      console.log(`\n🔄  Retry attempt ${attempt} — ${pending.length} remaining...\n`)
      await new Promise(r => setTimeout(r, 1500))
    }

    for (const task of pending) {
      const { template, recipient } = task
      const label = `${template.key} → ${recipient.email}`
      try {
        await sendEmail(recipient.email, recipient.name, template.subject, template.html(recipient))
        console.log(`  ✓  ${label}`)
        task.done = true
      } catch (err) {
        console.log(`  ✗  ${label}`)
      }
      await new Promise(r => setTimeout(r, 300))
    }
  }

  const sent = tasks.filter(t => t.done).length
  const failed = tasks.filter(t => !t.done).length
  console.log(`\n${failed === 0 ? '✅' : '⚠️ '}  Done — ${sent} sent, ${failed} failed\n`)
  if (failed > 0) {
    console.log('Still failing — Brevo IP restriction may still be active. Check app.brevo.com/security/authorised_ips\n')
  }
}

run()
