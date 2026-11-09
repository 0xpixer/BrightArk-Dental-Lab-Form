'use client'

import { useState } from 'react'
import { Turnstile } from './Turnstile'
import { REGISTRATION_LINK_TTL_LABEL } from '@/lib/signup/constants'
import { CityInput, CountrySelect } from '@/components/ui/LocationInputs'

export function DoctorRegistration({ compact = false }: {
  compact?: boolean
}) {
  const [form, setForm] = useState({ fullName: '', clinicName: '', country: '', city: '', email: '', phone: '', address: '', password: '', confirmPassword: '' })
  const [emailSent, setEmailSent] = useState(false)
  const [token, setToken] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const sendLink = async () => {
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
      if (!response.ok || !data?.registrationId) throw new Error(data?.error ?? 'Unable to send the verification link. Please try again.')
      setEmailSent(true)
      setNotice(`We sent a secure verification link to ${form.email.trim().toLowerCase()}. Check your inbox and spam folder.`)
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Please try again.') }
    finally { setToken(''); setChallenge((value) => value + 1); setBusy(false) }
  }

  return <form onSubmit={(event) => { event.preventDefault(); if (!busy && !emailSent) void sendLink() }} className="space-y-4">
    <fieldset disabled={busy} className="min-w-0 space-y-4">
    {!emailSent ? <>
      <Field label="Doctor name" value={form.fullName} onChange={(value) => update('fullName', value)} required maxLength={150} autoComplete="name" />
      <Field label="Clinic" value={form.clinicName} onChange={(value) => update('clinicName', value)} required maxLength={200} autoComplete="organization" />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-text">
          <span className="mb-1 block">Country *</span>
          <CountrySelect
            value={form.country}
            onChange={(value) => setForm((current) => ({ ...current, country: value, city: '' }))}
            required
            className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text"
          />
        </label>
        <label className="block text-sm font-medium text-text">
          <span className="mb-1 block">City *</span>
          <CityInput
            value={form.city}
            country={form.country}
            onChange={(value) => update('city', value)}
            listId="doctor-registration-city-options"
            required
            className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text"
          />
        </label>
      </div>
      <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required maxLength={254} autoComplete="email" />
      {!compact && <>
        <Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} maxLength={50} autoComplete="tel" />
        <Field label="Address" value={form.address} onChange={(value) => update('address', value)} maxLength={1000} autoComplete="street-address" />
      </>}
      <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} required minLength={8} maxLength={72} autoComplete="new-password" />
      <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update('confirmPassword', value)} required minLength={8} maxLength={72} autoComplete="new-password" />
    </> : <>
      <div className="rounded-card border border-border bg-bg p-4">
        <h3 className="text-sm font-semibold text-text">Check your email</h3>
        {notice && <p role="status" className="mt-1 break-words text-sm leading-6 text-text-muted">{notice}</p>}
        <p className="mt-2 text-xs leading-5 text-text-muted">Open the link within {REGISTRATION_LINK_TTL_LABEL} to verify your email and sign in automatically.</p>
      </div>
    </>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {!emailSent && <Turnstile key={challenge} onToken={setToken} />}
    {!emailSent && <button type="submit" disabled={busy || !token} className="w-full rounded-card bg-primary px-3 py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60">{busy ? 'Please wait...' : 'Create account'}</button>}
    {emailSent && <div className="space-y-3 border-t border-border pt-4">
      <Turnstile key={challenge} onToken={setToken} />
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <button type="button" disabled={busy || !token} onClick={() => void sendLink()} className="font-medium text-text underline disabled:opacity-50">Send another link</button>
        <button type="button" disabled={busy} onClick={() => { setEmailSent(false); setError(''); setNotice('') }} className="text-text-muted underline">Change details</button>
      </div>
    </div>}
    </fieldset>
  </form>
}

function Field({ label, onChange, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { label: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-text"><span className="mb-1 block">{label}{props.required ? ' *' : ''}</span><input {...props} onChange={(event) => onChange(event.target.value)} className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" /></label>
}
