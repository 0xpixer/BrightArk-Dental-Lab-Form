'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewAccountPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ username: string; password: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username must be alphanumeric with underscores only')
      return
    }

    setLoading(true)
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to create account')
      return
    }

    setSuccess({ username, password })
    setTimeout(() => router.push('/admin/accounts'), 3000)
  }

  return (
    <div className="mx-auto max-w-md">
      <Link href="/admin/accounts" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← Back to Accounts
      </Link>

      <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-text">Create Account</h1>

        {success ? (
          <div className="rounded-card border border-green-200 bg-green-50 p-4">
            <p className="mb-2 text-sm font-medium text-green-800">
              Account created. Share these credentials with the user.
            </p>
            <div className="rounded border border-green-200 bg-white p-3 font-mono text-sm">
              <p>Username: {success.username}</p>
              <p>Password: {success.password}</p>
            </div>
            <p className="mt-2 text-xs text-green-700">Redirecting to accounts…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mb-1 block text-xs font-medium">Username</label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-card border border-border px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs font-medium">Temporary Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-card border border-border px-3 py-2 pr-10 text-sm"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1 block text-xs font-medium">Confirm Password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-card border border-border px-3 py-2 text-sm"
                required
              />
            </div>
            <p className="text-xs text-text-muted">Role: Admin (superadmin cannot be created via UI)</p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
