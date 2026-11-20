'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { EyeOff, KeyRound, Lock, LockKeyhole, ShieldCheck, Users, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { FinanceTable } from '@/components/finance/FinanceTable'

interface AccessState {
  role: string
  hidden: boolean
  needsSetup: boolean
  hasPassword: boolean
  staffVisible: boolean | null
  email: string | null
}

const INPUT_CLASS = 'h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10'
const PRIMARY_BUTTON = 'inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY_BUTTON = 'inline-flex h-10 items-center justify-center rounded-card border border-border bg-surface px-4 text-sm font-semibold text-text hover:bg-bg disabled:opacity-50'

/**
 * Portal Finance: hides it from clinic staff unless the doctor shares it, asks every account to choose
 * a password on the first visit, and asks for that password on every visit. The unlock token lives in
 * this component's state only, so leaving the page locks Finance again.
 */
export function FinanceGate() {
  const [access, setAccess] = useState<AccessState | null>(null)
  const [loadError, setLoadError] = useState('')
  const [unlockToken, setUnlockToken] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const loadAccess = useCallback(async () => {
    setLoadError('')
    try {
      const response = await fetch('/api/finance/access', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load Finance')
      setAccess(payload)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load Finance')
    }
  }, [])
  useEffect(() => { loadAccess() }, [loadAccess])

  const onLocked = useCallback(() => {
    setUnlockToken(null)
    setSettingsOpen(false)
    loadAccess()
  }, [loadAccess])

  if (loadError) return <Centered><p className="text-sm text-red-600">{loadError}</p><button type="button" onClick={loadAccess} className={`${SECONDARY_BUTTON} mt-4`}>Try again</button></Centered>
  if (!access) return <Centered><p className="text-sm text-text-muted">Loading Finance...</p></Centered>

  if (access.hidden) return <Centered>
    <IconBadge icon={EyeOff} />
    <h1 className="mt-4 text-lg font-semibold text-text">Finance is private</h1>
    <p className="mt-2 max-w-sm text-sm text-text-muted">Your doctor keeps the Finance page to themself. Ask them to turn on clinic staff access in Finance Settings if you need it.</p>
  </Centered>

  const isDoctor = access.role === 'doctor'
  if (access.needsSetup) return <>
    <div aria-hidden className="pointer-events-none select-none blur-sm"><Centered><p className="text-sm text-text-muted">Finance</p></Centered></div>
    <SettingsDialog
      mode="setup"
      isDoctor={isDoctor}
      hasPassword={false}
      staffVisible={access.staffVisible ?? false}
      unlockToken={null}
      onSaved={(result) => { setUnlockToken(result.unlockToken); setAccess({ ...access, needsSetup: false, hasPassword: result.hasPassword, staffVisible: result.staffVisible ?? access.staffVisible }) }}
    />
  </>

  if (access.hasPassword && !unlockToken) return <UnlockScreen email={access.email} onUnlocked={setUnlockToken} />

  return <div className="mx-auto max-w-[1800px]">
    <FinanceTable area="portal" unlockToken={unlockToken} onLocked={onLocked} onSettings={() => setSettingsOpen(true)} />
    {settingsOpen && <SettingsDialog
      mode="settings"
      isDoctor={isDoctor}
      hasPassword={access.hasPassword}
      staffVisible={access.staffVisible ?? false}
      unlockToken={unlockToken}
      onClose={() => setSettingsOpen(false)}
      onLocked={onLocked}
      onSaved={(result) => { setUnlockToken(result.unlockToken); setAccess({ ...access, hasPassword: result.hasPassword, staffVisible: result.staffVisible ?? access.staffVisible }); setSettingsOpen(false) }}
    />}
  </div>
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">{children}</div>
}

function IconBadge({ icon }: { icon: typeof Lock }) {
  return <span className="grid h-12 w-12 place-items-center rounded-full bg-bg text-text"><MorphIcon icon={icon} className="h-5 w-5" /></span>
}

function UnlockScreen({ email, onUnlocked }: { email: string | null; onUnlocked: (token: string) => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetNotice, setResetNotice] = useState('')
  const [sending, setSending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/finance/access/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not unlock Finance')
      onUnlocked(payload.unlockToken)
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock Finance')
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    setSending(true)
    setError('')
    setResetNotice('')
    try {
      const response = await fetch('/api/finance/access/forgot', { method: 'POST' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not send the reset email')
      setResetNotice(`We sent a reset link to ${payload.email}. It expires in 30 minutes.`)
    } catch (forgotError) {
      setError(forgotError instanceof Error ? forgotError.message : 'Could not send the reset email')
    } finally {
      setSending(false)
    }
  }

  return <Centered>
    <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-border bg-surface p-6 text-left shadow-sm">
      <div className="flex flex-col items-center text-center">
        <IconBadge icon={LockKeyhole} />
        <h1 className="mt-4 text-lg font-semibold text-text">Finance is locked</h1>
        <p className="mt-1 text-sm text-text-muted">Enter your Finance password to view invoices and payments.</p>
      </div>
      <label className="mt-5 block">
        <span className="mb-1 block text-xs font-medium text-text-muted">Finance password</span>
        <input type="password" autoFocus autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT_CLASS} />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {resetNotice && <p role="status" className="mt-2 text-sm text-emerald-700">{resetNotice}</p>}
      <button type="submit" disabled={busy || !password} className={`${PRIMARY_BUTTON} mt-4 w-full`}><MorphIcon icon={Lock} hoverIcon={KeyRound} className="h-4 w-4" />{busy ? 'Checking...' : 'Unlock'}</button>
      <button type="button" onClick={forgot} disabled={sending} className="mt-3 w-full text-center text-sm font-medium text-text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-50">
        {sending ? 'Sending reset email...' : 'Forgot password?'}
      </button>
      {email && !resetNotice && <p className="mt-1 text-center text-xs text-text-muted">The reset link goes to {email}</p>}
    </form>
  </Centered>
}

type PasswordChoice = 'none' | 'set' | 'keep'

function SettingsDialog({ mode, isDoctor, hasPassword, staffVisible: initialStaffVisible, unlockToken, onSaved, onClose, onLocked }: {
  mode: 'setup' | 'settings'
  isDoctor: boolean
  hasPassword: boolean
  staffVisible: boolean
  unlockToken: string | null
  onSaved: (result: { hasPassword: boolean; unlockToken: string | null; staffVisible?: boolean }) => void
  onClose?: () => void
  onLocked?: () => void
}) {
  const [choice, setChoice] = useState<PasswordChoice | null>(mode === 'setup' ? null : hasPassword ? 'keep' : 'none')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  // Setup starts with Finance hidden from staff, the default the doctor confirms.
  const [staffVisible, setStaffVisible] = useState(initialStaffVisible)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!onClose) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!choice) { setError('Choose whether to protect Finance with a password'); return }
    if (choice === 'set') {
      if (password.length < 6) { setError('Use at least 6 characters for the password'); return }
      if (password !== confirm) { setError('The two passwords do not match'); return }
    }
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/finance/access', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(unlockToken ? { 'x-finance-unlock': unlockToken } : {}) },
        body: JSON.stringify({ passwordMode: choice, ...(choice === 'set' ? { password } : {}), ...(isDoctor ? { staffVisible } : {}) }),
      })
      const payload = await response.json()
      if (response.status === 401 && payload.code === 'finance_locked' && onLocked) { onLocked(); return }
      if (!response.ok) throw new Error(payload.error ?? 'Could not save Finance settings')
      onSaved({ hasPassword: payload.hasPassword, unlockToken: payload.unlockToken, staffVisible: isDoctor ? staffVisible : undefined })
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save Finance settings')
    } finally {
      setSaving(false)
    }
  }

  const options: Array<{ value: PasswordChoice; label: string; hint: string }> = mode === 'setup' || !hasPassword
    ? [
        { value: 'none', label: 'No password', hint: 'Finance opens like any other page.' },
        { value: 'set', label: 'Set a password', hint: 'Finance asks for it every time you open the page.' },
      ]
    : [
        { value: 'keep', label: 'Keep my current password', hint: 'Finance stays locked with the password you have.' },
        { value: 'set', label: 'Change password', hint: 'Replace it with a new one.' },
        { value: 'none', label: 'Remove password', hint: 'Finance opens without a password.' },
      ]

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="finance-settings-title">
    <form onSubmit={submit} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-card bg-surface p-5 shadow-xl sm:rounded-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="finance-settings-title" className="text-lg font-semibold text-text">{mode === 'setup' ? 'Protect your Finance page' : 'Finance settings'}</h2>
          <p className="mt-1 text-sm text-text-muted">{mode === 'setup'
            ? isDoctor ? 'Finance shows your invoices and payments. Choose how it is protected; you can change this later from Settings.' : 'Finance shows your clinic’s invoices and payments. You can add a password for this account; change it later from Settings.'
            : 'Change your Finance password' + (isDoctor ? ' and who in your clinic can see this page.' : '.')}</p>
        </div>
        {onClose && <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded text-text-muted hover:bg-bg hover:text-text" title="Close"><MorphIcon icon={X} className="h-4 w-4" /><span className="sr-only">Close</span></button>}
      </div>

      <fieldset className="mt-5">
        <legend className="flex items-center gap-2 text-sm font-semibold text-text"><MorphIcon icon={LockKeyhole} className="h-4 w-4" />Password</legend>
        <div className="mt-2 space-y-2">
          {options.map((option) => <label key={option.value} className={`flex cursor-pointer items-start gap-3 rounded-card border px-3 py-2.5 ${choice === option.value ? 'border-text bg-bg' : 'border-border hover:bg-bg'}`}>
            <input type="radio" name="finance-password" checked={choice === option.value} onChange={() => { setChoice(option.value); setError('') }} className="mt-0.5 h-4 w-4 accent-[#f97316]" />
            <span><span className="block text-sm font-medium text-text">{option.label}</span><span className="block text-xs text-text-muted">{option.hint}</span></span>
          </label>)}
        </div>
        {choice === 'set' && <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label><span className="mb-1 block text-xs font-medium text-text-muted">{hasPassword && mode === 'settings' ? 'New password' : 'Password'}</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className={INPUT_CLASS} /></label>
          <label><span className="mb-1 block text-xs font-medium text-text-muted">Confirm password</span><input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className={INPUT_CLASS} /></label>
          <p className="text-xs text-text-muted sm:col-span-2">At least 6 characters. This is separate from your portal login password.</p>
        </div>}
      </fieldset>

      {isDoctor && <fieldset className="mt-5">
        <legend className="flex items-center gap-2 text-sm font-semibold text-text"><MorphIcon icon={Users} className="h-4 w-4" />Clinic staff</legend>
        <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-card border border-border px-3 py-2.5 hover:bg-bg">
          <input type="checkbox" checked={!staffVisible} onChange={(event) => setStaffVisible(!event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#f97316]" />
          <span><span className="block text-sm font-medium text-text">Hide Finance from my clinic staff</span><span className="block text-xs text-text-muted">{staffVisible ? 'Your linked clinic staff can open Finance. Each of them is asked whether to set their own password.' : 'Only you can see Finance. Clinic staff will not see the page.'}</span></span>
        </label>
      </fieldset>}

      {error && <p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onClose && <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>Cancel</button>}
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}><MorphIcon icon={ShieldCheck} className="h-4 w-4" />{saving ? 'Saving...' : mode === 'setup' ? 'Save and open Finance' : 'Save settings'}</button>
      </div>
    </form>
  </div>
}
