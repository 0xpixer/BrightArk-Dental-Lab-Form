'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrightArkLogo } from '@/components/BrightArkLogo'
import { DoctorRegistration } from '@/components/auth/DoctorRegistration'

export default function RegisterPage() {
  const [verified, setVerified] = useState(false)

  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-card border border-border bg-surface p-6 md:p-8">
        <div className="mb-6 flex flex-col items-center"><BrightArkLogo /><h1 className="mt-4 text-xl font-semibold text-text">Create doctor account</h1></div>
        {verified ? <p role="status" className="text-center text-sm text-text">Email verified. Your account is ready. Sign in to continue.</p> : <DoctorRegistration onVerified={() => setVerified(true)} />}
        <p className="mt-5 text-center text-sm text-text-muted">Already registered? <Link href="/admin/login?callbackUrl=/portal/orders" className="font-medium text-text hover:underline">Sign in</Link></p>
      </div>
    </main>
  )
}
