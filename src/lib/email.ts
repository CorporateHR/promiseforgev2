// ─── Brevo email sender ───────────────────────────────────────────────────────

export async function sendEmail(
  to: string,
  toName: string,
  subject: string,
  html: string,
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME ?? 'Promise Forge'

  if (!apiKey || !senderEmail) {
    console.warn('[Email] BREVO_API_KEY or BREVO_SENDER_EMAIL not set — skipping send')
    return
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo API error ${res.status}: ${body}`)
  }
}

// ─── Shared shell ─────────────────────────────────────────────────────────────

function shell(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Promise Forge</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#ffffff;border-radius:12px 12px 0 0;padding:28px 40px;border-bottom:1px solid #e4e4e7;">
              <span style="font-size:18px;font-weight:700;color:#18181b;letter-spacing:-0.3px;">Promise<span style="color:#6366f1;">Forge</span></span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:36px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:20px 40px;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">
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

function btn(text: string, href: string): string {
  return `<a href="${href.replace(/&/g, '&amp;')}" style="display:inline-block;margin-top:24px;padding:12px 24px;background:#6366f1;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.1px;">${text}</a>`
}

function pill(text: string, color = '#6366f1'): string {
  return `<span style="display:inline-block;padding:4px 10px;border-radius:99px;background:${color}1a;color:${color};font-size:12px;font-weight:600;letter-spacing:0.2px;">${text}</span>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;letter-spacing:-0.4px;">${text}</h1>`
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#52525b;">${text}</p>`
}

function meta(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#71717a;width:120px;vertical-align:top;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#18181b;font-weight:500;vertical-align:top;">${value}</td>
  </tr>`
}

function metaTable(rows: string): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:20px 0;border-radius:8px;background:#f4f4f5;padding:4px 16px;">${rows}</table>`
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">`
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function nudgeEmailHtml(
  employeeName: string,
  challengeTitle: string,
  dueDate: string | null | undefined,
  challengeId: string,
): string {
  const due = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return shell(`
    <div style="margin-bottom:20px;">${pill('Action Required', '#f59e0b')}</div>
    ${h1(`Don't forget to complete your challenge`)}
    ${p(`Hi ${employeeName}, this is a friendly reminder that the challenge below is still waiting for your completion.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Challenge', challengeTitle)}
      ${due ? meta('Due date', due) : ''}
    `)}
    ${divider()}
    ${p('Log in to your dashboard to mark the challenge complete and earn your tokens.')}
    ${btn('Go to Dashboard', `${appUrl}/dashboard/employee/challenges/${challengeId}`)}
  `)
}

export function challengePublishedHtml(
  employeeName: string,
  challengeTitle: string,
  description: string | null | undefined,
  dueDate: string | null | undefined,
  challengeId: string,
): string {
  const due = dueDate ? new Date(dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return shell(`
    <div style="margin-bottom:20px;">${pill('New Challenge', '#22c55e')}</div>
    ${h1('A new challenge is now live')}
    ${p(`Hi ${employeeName}, a new challenge has been published and you're invited to participate.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Challenge', challengeTitle)}
      ${description ? meta('About', description) : ''}
      ${due ? meta('Due date', due) : ''}
    `)}
    ${divider()}
    ${p('Complete the challenge before the deadline to earn tokens you can spend in the marketplace.')}
    ${btn('View Challenge', `${appUrl}/dashboard/employee/challenges/${challengeId}`)}
  `)
}

export function challengeCompleteHtml(
  recipientName: string,
  employeeName: string,
  challengeTitle: string,
  challengeId: string,
  recipientRole: 'manager' | 'admin',
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const dashPath = recipientRole === 'admin'
    ? `${appUrl}/dashboard/admin/challenges/${challengeId}`
    : `${appUrl}/dashboard/manager/challenges/${challengeId}`
  return shell(`
    <div style="margin-bottom:20px;">${pill('Completion', '#22c55e')}</div>
    ${h1(`${employeeName} completed a challenge`)}
    ${p(`Hi ${recipientName}, one of your team members has just marked a challenge as complete.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Employee', employeeName)}
      ${meta('Challenge', challengeTitle)}
      ${meta('Completed at', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}
    `)}
    ${divider()}
    ${p('You can view the full completion status and manage this challenge from your dashboard.')}
    ${btn('View Dashboard', dashPath)}
  `)
}

export function orgBudgetSetHtml(
  adminName: string,
  orgName: string,
  amount: number,
  newTotal: number,
): string {
  const increased = amount >= 0
  return shell(`
    <div style="margin-bottom:20px;">${pill(increased ? 'Budget Increased' : 'Budget Decreased', increased ? '#22c55e' : '#ef4444')}</div>
    ${h1(`${orgName}'s token budget was updated`)}
    ${p(`Hi ${adminName}, a super admin has just ${increased ? 'added tokens to' : 'reduced'} your organization's token budget.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Organization', orgName)}
      ${meta('Change', `${increased ? '+' : ''}${amount.toLocaleString()} tokens`)}
      ${meta('New total', newTotal.toLocaleString() + ' tokens')}
    `)}
    ${divider()}
    ${p('You can allocate this budget to managers from your admin dashboard.')}
    ${btn('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/admin/budget`)}
  `)
}

export function managerBudgetSetHtml(
  managerName: string,
  orgName: string,
  amount: number,
  newTotal: number,
): string {
  const increased = amount >= 0
  return shell(`
    <div style="margin-bottom:20px;">${pill(increased ? 'Budget Increased' : 'Budget Decreased', increased ? '#22c55e' : '#ef4444')}</div>
    ${h1(`Your token budget was updated`)}
    ${p(`Hi ${managerName}, your tenant admin at ${orgName} has just ${increased ? 'added tokens to' : 'reduced'} your token budget.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Organization', orgName)}
      ${meta('Change', `${increased ? '+' : ''}${amount.toLocaleString()} tokens`)}
      ${meta('New total', newTotal.toLocaleString() + ' tokens')}
    `)}
    ${divider()}
    ${p('You can allocate this budget to your direct reports from your manager dashboard.')}
    ${btn('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/manager`)}
  `)
}

export function employeeBudgetSetHtml(
  employeeName: string,
  managerName: string,
  amount: number,
  newTotal: number,
): string {
  const increased = amount >= 0
  return shell(`
    <div style="margin-bottom:20px;">${pill(increased ? 'Budget Increased' : 'Budget Decreased', increased ? '#22c55e' : '#ef4444')}</div>
    ${h1(`Your token budget was updated`)}
    ${p(`Hi ${employeeName}, your manager ${managerName} has just ${increased ? 'added tokens to' : 'reduced'} your token budget.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Manager', managerName)}
      ${meta('Change', `${increased ? '+' : ''}${amount.toLocaleString()} tokens`)}
      ${meta('New total', newTotal.toLocaleString() + ' tokens')}
    `)}
    ${divider()}
    ${p('You can spend these tokens in the marketplace from your employee dashboard.')}
    ${btn('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/employee`)}
  `)
}

export function tenantAdminAssignedHtml(
  employeeName: string,
  orgName: string,
): string {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Role Updated', '#6366f1')}</div>
    ${h1(`You're now a Tenant Admin of ${orgName}`)}
    ${p(`Hi ${employeeName}, a super admin has just made you a Tenant Admin for ${orgName}. You now have access to manage challenges, budgets, employees, and the marketplace for your organization.`)}
    ${divider()}
    ${p('Log in to your dashboard to get started.')}
    ${btn('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard`)}
  `)
}

export function redemptionRequestedHtml(
  adminName: string,
  employeeName: string,
  itemName: string,
  tokenCost: number,
): string {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Pending Approval', '#f59e0b')}</div>
    ${h1('Marketplace redemption request')}
    ${p(`Hi ${adminName}, an employee has requested to redeem an item from the marketplace and needs your approval.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Employee', employeeName)}
      ${meta('Item', itemName)}
      ${meta('Token cost', tokenCost.toLocaleString() + ' tokens')}
      ${meta('Status', 'Pending approval')}
    `)}
    ${divider()}
    ${p('Review and approve or reject this request from the Marketplace section of your admin dashboard.')}
    ${btn('Review Request', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/admin/marketplace`)}
  `)
}

export function redemptionApprovedHtml(
  employeeName: string,
  itemName: string,
): string {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Approved', '#22c55e')}</div>
    ${h1('Your redemption was approved')}
    ${p(`Hi ${employeeName}, great news — your redemption request has been approved by your administrator.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Item', itemName)}
      ${meta('Status', 'Approved')}
    `)}
    ${divider()}
    ${p('Your administrator will follow up with fulfillment details. You can view your redemption history in your employee dashboard.')}
    ${btn('View My Redemptions', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/employee`)}
  `)
}

export function employeeInviteHtml(
  employeeName: string,
  orgName: string,
  activationLink: string,
): string {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Welcome', '#6366f1')}</div>
    ${h1(`You've been invited to join ${orgName}`)}
    ${p(`Hi ${employeeName}, your organization has set up a Promise Forge account for you. Activate it and choose a password to get started.`)}
    ${divider()}
    ${p('This link is unique to you and expires after first use — set a password and you\'re in.')}
    ${btn('Activate My Account', activationLink)}
  `)
}

export function redemptionRejectedHtml(
  employeeName: string,
  itemName: string,
  reason?: string | null,
): string {
  return shell(`
    <div style="margin-bottom:20px;">${pill('Not Approved', '#ef4444')}</div>
    ${h1('Your redemption was not approved')}
    ${p(`Hi ${employeeName}, unfortunately your redemption request for <strong style="color:#18181b;">${itemName}</strong> was not approved at this time.`)}
    ${divider()}
    ${metaTable(`
      ${meta('Item', itemName)}
      ${meta('Status', 'Rejected')}
      ${reason ? meta('Reason', reason) : ''}
    `)}
    ${divider()}
    ${p('Your tokens have been returned to your balance. If you have questions, please reach out to your administrator.')}
    ${btn('Go to Dashboard', `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard/employee`)}
  `)
}
