'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { BrightArkLogo } from '@/components/BrightArkLogo'

export function VerifyRegistration({ registrationId, token }: { registrationId: string; token: string }) {
  const router = useRouter()
  const started = useRef(false)
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')

  useEffect(() => {
    if (started.current) return
    started.current = true
    window.history.replaceState(null, '', '/register/verify')

    void signIn('credentials', {
      registrationId,
      verificationToken: token,
      redirect: false,
    }).then((result) => {
      if (!result?.ok || result.error) {
        setStatus('error')
        return
      }
      router.replace('/portal/overview')
      router.refresh()
    }).catch(() => setStatus('error'))
  }, [registrationId, router, token])

  return <main className="flex min-h-screen items-center justify-center bg-bg p-4">
    <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 text-center">
      <div className="mb-6 flex justify-center"><BrightArkLogo /></div>
      {status === 'verifying' ? <>
        <h1 className="text-xl font-semibold text-text">Verifying your email</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">Please wait while we securely activate your BrightArk Order Portal account.</p>
        <div className="mx-auto mt-6 h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" aria-label="Verifying" />
      </> : <>
        <h1 className="text-xl font-semibold text-text">This link is no longer valid</h1>
        <p className="mt-2 text-sm leading-6 text-text-muted">The verification link may have expired or already been used. If you already verified, sign in with your email and password.</p>
        <div className="mt-6 grid gap-3">
          <Link href="/admin/login?callbackUrl=/portal/overview" className="rounded-card bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-[#e06d15]">Sign in</Link>
          <Link href="/register" className="rounded-card border border-border px-4 py-3 text-sm font-semibold text-text hover:bg-bg">Request a new link</Link>
        </div>
      </>}
    </div>
  </main>
}
