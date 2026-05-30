'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'

interface Account {
  id: number
  username: string
  role: string
  isActive: boolean
  createdBy: number | null
  createdAt: string
  lastLoginAt: string | null
}

export function AccountsTable({ currentUserId }: { currentUserId: number }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [resetModal, setResetModal] = useState<{ id: number; username: string } | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [tempPassword, setTempPassword] = useState<string | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/accounts')
    const data = await res.json()
    setAccounts(data.accounts ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const toggleActive = async (id: number, isActive: boolean) => {
    await fetch(`/api/admin/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !isActive }),
    })
    fetchAccounts()
  }

  const resetPassword = async () => {
    if (!resetModal || !newPassword) return
    const res = await fetch(`/api/admin/accounts/${resetModal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPassword }),
    })
    const data = await res.json()
    if (res.ok) {
      setTempPassword(data.temporaryPassword ?? newPassword)
      setNewPassword('')
    }
  }

  const formatRelative = (d: string | null) => {
    if (!d) return 'Never'
    const diff = Date.now() - new Date(d).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'Just now'
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    const days = Math.floor(hours / 24)
    return `${days} day${days > 1 ? 's' : ''} ago`
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text">Accounts</h1>
        <Link
          href="/admin/accounts/new"
          className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]"
        >
          + Create Account
        </Link>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border bg-bg">
            <tr>
              {['Username', 'Role', 'Status', 'Created By', 'Last Login', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">
                  Loading…
                </td>
              </tr>
            ) : (
              accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                  <td className="px-4 py-3 text-sm font-medium">{acc.username}</td>
                  <td className="px-4 py-3 text-sm capitalize">{acc.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        acc.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      ● {acc.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">
                    {acc.createdBy ? `#${acc.createdBy}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-muted">{formatRelative(acc.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    {acc.id !== currentUserId && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(acc.id, acc.isActive)}
                          className="rounded border border-border px-2 py-1 text-xs hover:border-primary"
                        >
                          {acc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetModal({ id: acc.id, username: acc.username })}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-secondary"
                        >
                          <KeyRound className="h-3 w-3" />
                          Reset
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Reset Password — {resetModal.username}</h2>
            {tempPassword ? (
              <div>
                <p className="mb-2 text-sm text-text-muted">Temporary password (copy now):</p>
                <div className="rounded-card border border-border bg-bg p-3 font-mono text-sm">{tempPassword}</div>
                <button
                  type="button"
                  onClick={() => {
                    setResetModal(null)
                    setTempPassword(null)
                  }}
                  className="mt-4 w-full rounded-card bg-primary py-2 text-sm font-semibold text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New temporary password"
                  className="mb-4 w-full rounded-card border border-border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setResetModal(null)}
                    className="flex-1 rounded-card border border-border py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="flex-1 rounded-card bg-primary py-2 text-sm font-semibold text-white"
                  >
                    Reset
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
