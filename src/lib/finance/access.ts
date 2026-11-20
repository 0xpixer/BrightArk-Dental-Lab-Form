import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

/** Unlock tokens live in page memory only, so leaving Finance locks it again; this caps a forgotten open tab. */
export const FINANCE_UNLOCK_TTL_MS = 12 * 60 * 60 * 1000
export const FINANCE_RESET_TTL_MS = 30 * 60 * 1000
export const FINANCE_MAX_FAILED_ATTEMPTS = 5
export const FINANCE_LOCKOUT_MS = 15 * 60 * 1000
export const FINANCE_UNLOCK_HEADER = 'x-finance-unlock'

export const financePasswordSchema = z.string()
  .min(6, 'Use at least 6 characters')
  .max(72, 'Use at most 72 characters')
  .refine((value) => Buffer.byteLength(value) <= 72, 'Use at most 72 characters')

export const financeSettingsSchema = z.object({
  /** keep: leave the current password; none: no password; set: set or change it. */
  passwordMode: z.enum(['keep', 'none', 'set']),
  password: financePasswordSchema.optional(),
  staffVisible: z.boolean().optional(),
}).refine((value) => value.passwordMode !== 'set' || Boolean(value.password), { message: 'Enter a password', path: ['password'] })

export interface FinanceAccessRow {
  passwordHash: string | null
  passwordVersion: number
  staffVisible: boolean
  setupAt: Date | null
}

export interface FinanceGate {
  /** Clinic staff whose doctor keeps Finance to themself. */
  hidden: boolean
  /** First visit since the feature launched: the setup window must be answered. */
  needsSetup: boolean
  hasPassword: boolean
  /** The doctor's choice, only reported to the doctor. */
  staffVisible: boolean | null
}

export function resolveFinanceGate(role: string, own: FinanceAccessRow | null, doctor: FinanceAccessRow | null): FinanceGate {
  if (role === 'doctor') return { hidden: false, needsSetup: !own?.setupAt, hasPassword: Boolean(own?.passwordHash), staffVisible: own?.staffVisible ?? false }
  if (role === 'clinic_staff') {
    const hidden = !doctor?.staffVisible
    return { hidden, needsSetup: !hidden && !own?.setupAt, hasPassword: !hidden && Boolean(own?.passwordHash), staffVisible: null }
  }
  return { hidden: false, needsSetup: false, hasPassword: false, staffVisible: null }
}

function signature(secret: string, payload: string) {
  return createHmac('sha256', secret).update(`finance-unlock:${payload}`).digest('hex')
}

export function signUnlockToken(secret: string, userId: number, passwordVersion: number, now = Date.now()) {
  const payload = `${userId}.${now + FINANCE_UNLOCK_TTL_MS}.${passwordVersion}`
  return `${payload}.${signature(secret, payload)}`
}

export function verifyUnlockToken(secret: string, token: string | null | undefined, userId: number, passwordVersion: number, now = Date.now()) {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 4) return false
  const [uid, expires, version, sig] = parts
  if (Number(uid) !== userId || Number(version) !== passwordVersion || !(Number(expires) > now)) return false
  const expected = Buffer.from(signature(secret, `${uid}.${expires}.${version}`))
  const given = Buffer.from(sig)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export function hashResetToken(secret: string, token: string) {
  return createHash('sha256').update(`${secret}:finance-reset:${token}`).digest('hex')
}

/** j***@example.com, so the page can say where the reset link went without exposing the address. */
export function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!domain) return email
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 5)))}@${domain}`
}
