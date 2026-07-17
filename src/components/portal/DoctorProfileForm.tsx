'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

type Clinic = { id?: number; name: string; address: string }
type Profile = {
  fullName: string
  clinicName: string
  email: string
  phone: string | null
  address: string | null
  clinics: Clinic[]
}

export function DoctorProfileForm() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editable, setEditable] = useState(false)
  const [clinicEditable, setClinicEditable] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/profile')
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.ok) {
          setProfile(data.profile)
          setEditable(data.editable)
          setClinicEditable(data.clinicEditable)
        } else {
          setMessage(data.error)
        }
      })
      .catch(() => setMessage('Unable to load profile'))
  }, [])

  if (!profile) return <p className="text-text-muted">{message ?? 'Loading profile...'}</p>

  const change = (key: 'fullName' | 'email' | 'phone', value: string) => {
    setProfile((current) => current ? { ...current, [key]: value } : current)
  }

  const updateClinic = (index: number, key: 'name' | 'address', value: string) => {
    setProfile((current) => {
      if (!current) return current
      const clinics = current.clinics.map((clinic, clinicIndex) => clinicIndex === index ? { ...clinic, [key]: value } : clinic)
      return { ...current, clinics }
    })
  }

  const addClinic = () => setProfile((current) => current ? { ...current, clinics: [...current.clinics, { name: '', address: '' }] } : current)
  const removeClinic = (index: number) => setProfile((current) => current ? { ...current, clinics: current.clinics.filter((_, clinicIndex) => clinicIndex !== index) } : current)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const response = await fetch('/api/portal/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    const data = await response.json()
    if (response.ok) {
      setProfile(data.profile)
      setMessage('Profile saved. New orders will use these clinic details.')
    } else {
      setMessage(data.error ?? 'Unable to save profile')
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-xl font-semibold text-text">My Profile</h1>
      <p className="mb-6 text-sm text-text-muted">Contact details and saved clinic delivery addresses for new orders.</p>
      <form onSubmit={save} className="space-y-6 rounded-card border border-border bg-surface p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {(['fullName', 'email', 'phone'] as const).map((key) => (
            <label key={key} className="block text-sm font-medium">
              <span className="mb-1 block">{key.replace(/([A-Z])/g, ' ')}</span>
              <input
                type={key === 'email' ? 'email' : 'text'}
                value={profile[key] ?? ''}
                onChange={(event) => change(key, event.target.value)}
                disabled={!editable}
                className="w-full rounded-card border border-border bg-grey-input px-3 py-2 text-sm disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        <div className="border-t border-border pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-secondary">Clinics & Delivery Addresses</h2>
              {!editable && <p className="mt-1 text-xs text-text-muted">These clinics are shared with your linked doctor.</p>}
            </div>
            {clinicEditable && (
              <button type="button" onClick={addClinic} title="Add clinic" className="inline-flex h-8 w-8 items-center justify-center rounded-card border border-border text-primary hover:border-primary">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="space-y-4">
            {profile.clinics.map((clinic, index) => (
              <div key={clinic.id ?? `new-${index}`} className="grid gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] sm:items-end">
                <label className="block text-xs font-medium text-text">
                  <span className="mb-1 block">Clinic</span>
                  <input value={clinic.name} onChange={(event) => updateClinic(index, 'name', event.target.value)} disabled={!clinicEditable} className="w-full rounded-card border border-border bg-grey-input px-3 py-2 text-sm disabled:opacity-60" />
                </label>
                <label className="block text-xs font-medium text-text">
                  <span className="mb-1 block">Delivery address</span>
                  <input value={clinic.address} onChange={(event) => updateClinic(index, 'address', event.target.value)} disabled={!clinicEditable} className="w-full rounded-card border border-border bg-grey-input px-3 py-2 text-sm disabled:opacity-60" />
                </label>
                {clinicEditable && (
                  <button type="button" onClick={() => removeClinic(index)} disabled={profile.clinics.length === 1} title="Remove clinic" className="inline-flex h-9 w-9 items-center justify-center rounded-card border border-border text-text-muted hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {message && <p className="text-sm text-primary">{message}</p>}
        {(editable || clinicEditable) && <button type="submit" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]">Save Profile</button>}
      </form>
    </div>
  )
}
