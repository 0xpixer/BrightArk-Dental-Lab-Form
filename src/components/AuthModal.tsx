'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { X } from 'lucide-react'
import { DoctorRegistration } from './auth/DoctorRegistration'

export function AuthModal({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: () => void }) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const signInDoctor = async (credentials = { email, password }) => {
    const username = credentials.email.trim()
    const result = await signIn('credentials', { username: username.includes('@') ? username.toLowerCase() : username, password: credentials.password, redirect: false })
    if (!result?.ok || result.error) {
      setError('Invalid email or password.')
      return
    }
    onSignedIn()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)
    try { await signInDoctor() }
    catch { setError('Unable to sign in. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-surface p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 id="account-modal-title" className="text-lg font-semibold text-text">{mode === 'signin' ? 'Sign in to submit your order' : 'Create your doctor account'}</h2><p className="mt-1 text-sm text-text-muted">Your completed order will stay here while you sign in.</p></div>
          <button type="button" onClick={onClose} className="rounded p-1 text-text-muted hover:bg-bg hover:text-text" aria-label="Close sign in"><X className="h-5 w-5" /></button>
        </div>
        {mode === 'register' ? <DoctorRegistration compact onVerified={async (credentials) => {
          setEmail(credentials.email)
          setPassword(credentials.password)
          setMode('signin')
          setLoading(true)
          try { await signInDoctor(credentials) }
          catch { setError('Email verified. Please sign in to continue.') }
          finally { setLoading(false) }
        }} /> : <form onSubmit={submit} className="space-y-4">
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required minLength={8} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60">{loading ? 'Please wait...' : 'Sign In and Continue'}</button>
        </form>}
        <button type="button" onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setError(null) }} className="mt-4 w-full text-center text-sm font-medium text-text hover:underline">{mode === 'signin' ? 'New doctor? Create an account' : 'Already registered? Sign in'}</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) {
  return <label className="block text-sm font-medium text-text"><span className="mb-1 block">{label}{required ? ' *' : ''}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} minLength={minLength} className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text" /></label>
}
