'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BrightArkLogo } from '@/components/BrightArkLogo'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ fullName: '', clinicName: '', email: '', phone: '', address: '', password: '', confirmPassword: '' })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await response.json()
    setLoading(false)
    if (!response.ok) {
      setError(data.error ?? 'Unable to create your account')
      return
    }
    router.push('/admin/login?callbackUrl=/portal/orders')
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-card border border-border bg-surface p-6 shadow-sm md:p-8">
        <div className="mb-6 flex flex-col items-center"><BrightArkLogo /><h1 className="mt-4 text-xl font-semibold text-text">Create doctor account</h1></div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Doctor name" value={form.fullName} onChange={(value) => update('fullName', value)} required />
          <Field label="Clinic" value={form.clinicName} onChange={(value) => update('clinicName', value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => update('email', value)} required />
          <Field label="Phone" value={form.phone} onChange={(value) => update('phone', value)} />
          <Field label="Address" value={form.address} onChange={(value) => update('address', value)} />
          <Field label="Password" type="password" value={form.password} onChange={(value) => update('password', value)} required minLength={8} />
          <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => update('confirmPassword', value)} required minLength={8} />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-text-muted">Already registered? <Link href="/admin/login?callbackUrl=/portal/orders" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </div>
    </main>
  )
}

function Field({ label, value, onChange, type = 'text', required, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) {
  return <label className="block text-sm font-medium text-text"><span className="mb-1 block">{label}{required ? ' *' : ''}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} minLength={minLength} className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-primary" /></label>
}
