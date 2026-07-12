'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { X } from 'lucide-react'

export function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const signInDoctor = async () => {
    const result = await signIn('credentials', { username: email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password.')
      return
    }
    onSignedIn()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
      setLoading(true)
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, clinicName, email, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        setLoading(false)
        setError(data.error ?? 'Unable to create your account.')
        return
      }
      await signInDoctor()
      setLoading(false)
      return
    }

    setLoading(true)
    await signInDoctor()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 id="account-modal-title" className="text-lg font-semibold text-text">{mode === 'signin' ? 'Sign in to submit your order' : 'Create your doctor account'}</h2><p className="mt-1 text-sm text-text-muted">Your completed order will stay here while you sign in.</p></div>
          <button type="button" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-bg hover:text-text" aria-label="Close sign in"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {mode === 'register' && <><Field label="Doctor name" value={fullName} onChange={setFullName} required /><Field label="Clinic" value={clinicName} onChange={setClinicName} required /></>}
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
          {mode === 'register' && <Field label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} required minLength={8} />}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60">{loading ? 'Please wait...' : mode === 'signin' ? 'Sign In and Continue' : 'Create Account and Continue'}</button>
        </form>
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(null) }} className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline">{mode === 'signin' ? 'New doctor? Create an account' : 'Already registered? Sign in'}</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) {
  return <label className="block text-sm font-medium text-text"><span className="mb-1 block">{label}{required ? ' *' : ''}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} minLength={minLength} className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>
}
