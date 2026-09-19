import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { secretHash, SignupError } from './security'

export function rateLimitQuery(key: string, limit: number, seconds: number) {
  return sql`
    INSERT INTO signup_rate_limits (key, count, expires_at)
    VALUES (${key}, 1, now() + ${seconds} * interval '1 second')
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN signup_rate_limits.expires_at <= now() THEN 1 ELSE signup_rate_limits.count + 1 END,
      expires_at = CASE WHEN signup_rate_limits.expires_at <= now() THEN now() + ${seconds} * interval '1 second' ELSE signup_rate_limits.expires_at END
    WHERE signup_rate_limits.expires_at <= now() OR signup_rate_limits.count < ${limit}
    RETURNING count`
}

export async function limitSignup(secret: string, scope: string, identity: string, limit: number, seconds = 3600) {
  const result = await getDb().execute(rateLimitQuery(secretHash(secret, scope, identity), limit, seconds))
  if (!result.rows.length) throw new SignupError('Too many attempts. Please try again later.', 429, seconds)
}

export function verificationAttemptQuery(id: string) {
  return sql`UPDATE pending_registrations SET attempts = attempts + 1
    WHERE id = ${id} AND expires_at > now() AND attempts < 5 RETURNING id`
}

export function completeRegistrationQuery(id: string, codeHash: string) {
  // Consuming the challenge, creating the account, and adding its clinic are atomic.
  return sql`WITH verified AS (
    DELETE FROM pending_registrations
    WHERE id = ${id} AND code_hash = ${codeHash} AND expires_at > now() AND attempts <= 5
    RETURNING *
  ), created AS (
    INSERT INTO admin_users (username, email, password_hash, full_name, clinic_name, address, phone, role, is_active, email_verified_at)
    SELECT email, email, password_hash, full_name, clinic_name, address, nullif(phone, ''), 'doctor', true, now() FROM verified
    ON CONFLICT DO NOTHING
    RETURNING id, clinic_name, address
  ), clinic AS (
    INSERT INTO doctor_clinics (doctor_id, name, address)
    SELECT id, clinic_name, address FROM created RETURNING id
  ) SELECT id FROM created`
}

export async function cleanupSignupData() {
  // Small indexed batches; no extra scheduler or full-table scan.
  await getDb().execute(sql`DELETE FROM pending_registrations WHERE id IN (
    SELECT id FROM pending_registrations WHERE expires_at < now() ORDER BY expires_at LIMIT 100
  )`)
  await getDb().execute(sql`DELETE FROM signup_rate_limits WHERE key IN (
    SELECT key FROM signup_rate_limits WHERE expires_at < now() ORDER BY expires_at LIMIT 100
  )`)
}
