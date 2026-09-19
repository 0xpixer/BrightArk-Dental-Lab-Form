'use client'

import { useState } from 'react'
import { Turnstile } from './Turnstile'

export function DoctorRegistration({ compact = false, onVerified }: {
  compact?: boolean
  onVerified: (credentials: { email: string; password: string }) => void | Promise<void>
}) {
  const [form, setForm] = useState({ fullName: '', clinicName: '', email: '', phone: '', address: '', password: '', confirmPassword: '' })
  const [registrationId, setRegistrationId] = useState('')
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const sendCode = async () => {
    setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (!token) { setError('Please complete the security check.'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, turnstileToken: token }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok || !data?.registrationId) throw new Error(data?.error ?? 'Unable to send a code. Please try again.')
      setRegistrationId(data.registrationId)
      setCode('')
      setNotice('Code sent. Check your inbox and spam folder. It expires in 15 minutes.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.') }
    finally { setToken(''); setChallenge((value) => value + 1); setBusy(false) }
  }

  const verify = async () => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/register/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, code }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error ?? 'Unable to verify. Please try again.')
      await onVerified({ email: form.email.trim().toLowerCase(), password: form.password })
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.') }
    finally { setBusy(false) }
  }

  return <form onSubmit={(event) => { event.preventDefault(); if (!busy) void (registrationId ? verify() : sendCode()) }} className="space-y-4">
    <fieldset disabled={busy} className="min-w-0 space-y-4">
    {!registrationId ? <>
      <Field label="Doctor name" value={form.fullName} onChange={(value) => update('fullName', value)} required maxLength={150} autoComplete="name" />
      <Field label="Clinic" value={form.clinicName} onChange={(value) => update('clinicName', value)} required maxLength={200} autoComplete="organization" />
      <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required maxLength={254} autoComplete="email" />
      {!compact && <>
        <Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} maxLength={50} autoComplete="tel" />
        <Field label="Address" value={form.address} onChange={(value) => update('address', value)} maxLength={1000} autoComplete="street-address" />
      </>}
      <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} required minLength={8} maxLength={72} autoComplete="new-password" />
      <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update('confirmPassword', value)} required minLength={8} maxLength={72} autoComplete="new-password" />
    </> : <>
      <p className="break-words text-sm text-text">Verify <strong>{form.email}</strong></p>
      <label className="block text-sm font-medium text-text">Email code
        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus className="mt-1 w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm" />
      </label>
      {notice && <p role="status" className="text-sm text-text-muted">{notice}</p>}
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!registrationId && <Turnstile key={challenge} onToken={setToken} />}
    <button type="submit" disabled={busy || (!registrationId && !token)} className="w-full rounded-card bg-primary px-3 py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60">{busy ? 'Please wait...' : registrationId ? 'Verify email and continue' : 'Send verification code'}</button>
    {registrationId && <div className="space-y-3 border-t border-border pt-4">
      <Turnstile key={challenge} onToken={setToken} />
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" disabled={busy || !token} onClick={() => void sendCode()} className="font-medium text-text underline disabled:opacity-50">Send a new code</button>
        <button type="button" disabled={busy} onClick={() => { setRegistrationId(''); setCode(''); setError(''); setNotice('') }} className="text-text-muted underline">Change details</button>
      </div>
    </div>}
    </fieldset>
  </form>
}

function Field({ label, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-text"><span className="mb-1 block">{label}{props.required ? ' *' : ''}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" /></label>
}
