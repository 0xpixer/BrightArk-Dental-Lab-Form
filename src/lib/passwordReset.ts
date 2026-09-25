import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { SignupError } from '@/lib/signup/security'

const passwordSchema = z.string()
  .min(8)
  .max(72)
  .refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes')

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  turnstileToken: z.string().min(1).max(2048),
})

export const passwordResetConfirmSchema = z.object({
  resetId: z.string().regex(/^[a-f0-9]{64}$/),
  code: z.string().trim().regex(/^\d{6}$/),
  password: passwordSchema,
})

export function savePasswordResetQuery(id: string, userId: number, codeHash: string) {
  return sql`INSERT INTO pending_password_resets (id, user_id, code_hash, expires_at)
    VALUES (${id}, ${userId}, ${codeHash}, now() + interval '15 minutes')
    ON CONFLICT (user_id) DO UPDATE SET
      id = excluded.id,
      code_hash = excluded.code_hash,
      attempts = 0,
      expires_at = excluded.expires_at`
}

export function passwordResetAttemptQuery(id: string) {
  return sql`UPDATE pending_password_resets SET attempts = attempts + 1
    WHERE id = ${id} AND expires_at > now() AND attempts < 5 RETURNING id`
}

export function completePasswordResetQuery(id: string, codeHash: string, passwordHash: string) {
  return sql`WITH verified AS (
    DELETE FROM pending_password_resets
    WHERE id = ${id} AND code_hash = ${codeHash} AND expires_at > now() AND attempts <= 5
    RETURNING user_id
  )
  UPDATE admin_users SET password_hash = ${passwordHash}, password_changed_at = now()
  FROM verified
  WHERE admin_users.id = verified.user_id AND admin_users.is_active = true
  RETURNING admin_users.id, admin_users.username`
}

export function cleanupPasswordResetsQuery() {
  return sql`DELETE FROM pending_password_resets WHERE id IN (
    SELECT id FROM pending_password_resets WHERE expires_at < now() ORDER BY expires_at LIMIT 100
  )`
}

export async function sendPasswordResetEmail(
  email: string,
  code: string,
  id: string,
  config: { apiKey: string; from: string },
  fetcher = fetch,
) {
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `password-reset/${id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [email],
        subject: 'Reset your BrightArk password',
        text: `Your BrightArk password reset code is: ${code}\n\nEnter this code on the login page. It expires in 15 minutes.\n\nIf you did not request a password reset, ignore this email. Your password has not changed.`,
      }),
      signal: AbortSignal.timeout(10000),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || typeof result?.id !== 'string') throw new Error('Email rejected')
  } catch {
    throw new SignupError('Unable to send the reset email. Please try again in a minute.', 503)
  }
}
