'use client'

import { useState } from 'react'
import { Turnstile } from './Turnstile'

export function PasswordResetForm({ initialEmail, onCancel, onComplete }: {
  initialEmail: string
  onCancel: () => void
  onComplete: (email: string) => void
}) {
  const [email, setEmail] = useState(initialEmail.includes('@') ? initialEmail : '')
  const [resetId, setResetId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [token, setToken] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const requestCode = async () => {
    setError('')
    if (!token) { setError('Please complete the security check.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: token }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.resetId) throw new Error(data?.error ?? 'Unable to send a reset code.')
      setResetId(data.resetId)
      setNotice(data.message ?? 'If an account matches that email, a reset code has been sent.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      setToken('')
      setChallenge((value) => value + 1)
      setBusy(false)
    }
  }

  const resetPassword = async () => {
    setError('')
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetId, code, password }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? 'Unable to reset the password.')
      onComplete(email.trim().toLowerCase())
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={(event) => { event.preventDefault(); if (!busy) void (resetId ? resetPassword() : requestCode()) }} className="space-y-4">
    <div>
      <h2 className="text-lg font-semibold text-text">Reset password</h2>
      <p className="mt-1 text-sm text-text-muted">We will send a six-digit code to the email on your account.</p>
    </div>
    <fieldset disabled={busy} className="min-w-0 space-y-4">
      {!resetId ? <>
        <label className="block text-xs font-medium text-text">Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={254} className="mt-1 w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" />
        </label>
        <Turnstile key={challenge} action="password-reset" onToken={setToken} />
      </> : <>
        <p className="break-words text-sm text-text">Resetting the account for <strong>{email}</strong></p>
        <label className="block text-xs font-medium text-text">Email code
          <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus className="mt-1 w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" />
        </label>
        <label className="block text-xs font-medium text-text">New password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required className="mt-1 w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" />
        </label>
        <label className="block text-xs font-medium text-text">Confirm new password
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} maxLength={72} required className="mt-1 w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" />
        </label>
      </>}
      {notice && <p role="status" className="text-sm text-text-muted">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || (!resetId && !token)} className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e06d15] disabled:opacity-60">
        {busy ? 'Please wait...' : resetId ? 'Set new password' : 'Send reset code'}
      </button>
      <button type="button" onClick={onCancel} className="w-full text-sm font-medium text-text-muted hover:text-text">Back to sign in</button>
    </fieldset>
  </form>
}
