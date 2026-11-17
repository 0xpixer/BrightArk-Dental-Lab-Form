// Transactional email through Resend. Returns false (never throws) when email is not configured or fails,
// so callers can fire and forget without breaking the request that triggered the email.

export function appLink(path: string) {
  const appUrl = process.env.APP_URL?.replace(/\/$/, '')
  return appUrl ? `${appUrl}${path}` : null
}

export async function sendTransactionalEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return false
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch {
    return false
  }
}

/** Accounts may store the address in email or, for older accounts, in username. */
export function accountEmail(account: { email: string | null; username: string }) {
  return account.email || (account.username.includes('@') ? account.username : null)
}
