'use client'

import { useEffect, useState } from 'react'
import { Toast } from '@/components/admin/Toast'
import { formatAdminRole } from '@/lib/admin/roles'

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ username: string; role: string } | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) {
          setProfile({ username: data.user.username, role: data.user.role })
        }
      })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/admin/profile/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? 'Failed to update password')
      return
    }

    setToast('Password updated successfully')
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold text-text">My Profile</h1>

      <div className="mb-6 rounded-card border border-border bg-surface p-6 shadow-sm">
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-text-muted">Username</dt>
            <dd className="font-medium">{profile?.username ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Role</dt>
            <dd>
              <span className="rounded bg-secondary/10 px-2 py-0.5 text-xs font-semibold capitalize text-secondary">
                {profile ? formatAdminRole(profile.role) : '—'}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-card border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-secondary">Change Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-card border border-border px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-card border border-border px-3 py-2 text-sm"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-card border border-border px-3 py-2 text-sm"
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
