'use client'

import { useEffect, useState } from 'react'

type Profile = { fullName: string; clinicName: string; email: string; phone: string | null; address: string | null }

export function DoctorProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editable, setEditable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => { fetch('/api/portal/profile').then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (response.ok) { setProfile(data.profile); setEditable(data.editable) } else setMessage(data.error) }).catch(() => setMessage('Unable to load profile')) }, [])
  if (!profile) return <p className="text-text-muted">{message ?? 'Loading profile...'}</p>
  const change = (key: keyof Profile, value: string) => setProfile((current) => current ? { ...current, [key]: value } : current)
  const save = async (event: React.FormEvent) => { event.preventDefault(); const response = await fetch('/api/portal/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) }); const data = await response.json(); setMessage(response.ok ? 'Profile saved. New orders will use these details.' : data.error ?? 'Unable to save profile') }
  return <div className="mx-auto max-w-xl"><h1 className="mb-1 text-xl font-semibold text-text">My Profile</h1><p className="mb-6 text-sm text-text-muted">These details prefill new order forms.</p><form onSubmit={save} className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-sm">{(['fullName', 'clinicName', 'email', 'phone', 'address'] as const).map((key) => <label key={key} className="block text-sm font-medium capitalize"><span className="mb-1 block">{key.replace(/([A-Z])/g, ' $1')}</span><input type={key === 'email' ? 'email' : 'text'} value={profile[key] ?? ''} onChange={(event) => change(key, event.target.value)} disabled={!editable} className="w-full rounded-card border border-border bg-grey-input px-3 py-2 text-sm disabled:opacity-60" /></label>)}{!editable && <p className="text-sm text-text-muted">Clinic staff use the linked doctor’s profile. Contact your doctor or lab administrator to update it.</p>}{message && <p className="text-sm text-primary">{message}</p>}{editable && <button type="submit" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]">Save Profile</button>}</form></div>
}
