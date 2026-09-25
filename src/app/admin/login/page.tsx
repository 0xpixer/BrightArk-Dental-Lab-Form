'use client'

import { useState, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { getSafeLoginCallback } from '@/lib/siteRouting'
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loginFailed, setLoginFailed] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setLoading(true)

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError('Invalid username or password.')
      setLoginFailed(true)
      return
    }

    const callbackUrl = getSafeLoginCallback(searchParams.get('callbackUrl'), window.location.host)
    router.replace(callbackUrl)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8">
        <div className="mb-6 flex flex-col items-center">
          <Image src="/Logo-SVG.svg" alt="BrightArk" width={160} height={48} className="mb-4 h-12 w-auto" />
          <h1 className="text-xl font-semibold text-text">BrightArk Portal</h1>
        </div>

        {resetOpen ? <PasswordResetForm
          initialEmail={username}
          onCancel={() => setResetOpen(false)}
          onComplete={(email) => {
            setUsername(email)
            setPassword('')
            setError(null)
            setLoginFailed(false)
            setResetOpen(false)
            setNotice('Password updated. Sign in with your new password.')
          }}
        /> : <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-xs font-medium text-text">
              Email or Username
            </label>
            <input
              id="username"
              type="text"
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-text">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-card border border-border bg-grey-input px-3 py-2.5 pr-10 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-card bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e06d15] disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
          {loginFailed && <button type="button" onClick={() => setResetOpen(true)} className="w-full text-sm font-medium text-text underline underline-offset-2">Forgot your password?</button>}
        </form>}

        {!resetOpen && <p className="mt-4 text-center text-xs text-text-muted">
          Doctors can <Link href="/register" className="font-medium text-text hover:underline">create an account</Link> to submit and manage orders.
        </p>}
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-bg">Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}
