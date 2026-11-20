'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { KeyRound, ShieldCheck } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

/** Sets a new Finance password from the emailed link. The portal layout already requires sign-in. */
export function FinancePasswordReset({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password.length < 6) { setError('Use at least 6 characters for the password'); return }
    if (password !== confirm) { setError('The two passwords do not match'); return }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/finance/access/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not reset the password')
      setDone(true)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not reset the password')
    } finally {
      setSaving(false)
    }
  }

  return <div className="flex min-h-[60vh] items-center justify-center px-4">
    {done
      ? <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><MorphIcon icon={ShieldCheck} className="h-5 w-5" /></span>
          <h1 className="mt-4 text-lg font-semibold text-text">Finance password updated</h1>
          <p className="mt-1 text-sm text-text-muted">Use the new password the next time you open Finance.</p>
          <Link href="/portal/finance" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600">Open Finance</Link>
        </div>
      : <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-bg text-text"><MorphIcon icon={KeyRound} className="h-5 w-5" /></span>
            <h1 className="mt-4 text-lg font-semibold text-text">Set a new Finance password</h1>
            <p className="mt-1 text-sm text-text-muted">This only changes the password for the Finance page, not your portal login.</p>
          </div>
          {!token && <p role="alert" className="mt-4 text-sm text-red-600">This reset link is incomplete. Open the link from the email again.</p>}
          <label className="mt-5 block"><span className="mb-1 block text-xs font-medium text-text-muted">New password</span><input type="password" autoFocus autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label>
          <label className="mt-3 block"><span className="mb-1 block text-xs font-medium text-text-muted">Confirm password</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label>
          {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving || !token} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"><MorphIcon icon={ShieldCheck} className="h-4 w-4" />{saving ? 'Saving...' : 'Save new password'}</button>
        </form>}
  </div>
}
