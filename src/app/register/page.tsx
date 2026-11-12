import Link from 'next/link'
import { BrightArkLogo } from '@/components/BrightArkLogo'
import { DoctorRegistration } from '@/components/auth/DoctorRegistration'

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto w-full max-w-lg rounded-card border border-border bg-surface p-6 md:p-8">
        <div className="mb-6 flex flex-col items-center"><BrightArkLogo /><h1 className="mt-4 text-xl font-semibold text-text">Create account</h1></div>
        <DoctorRegistration />
        <p className="mt-5 text-center text-sm text-text-muted">Already registered? <Link href="/admin/login?callbackUrl=/portal/overview" className="font-medium text-text hover:underline">Sign in</Link></p>
      </div>
    </main>
  )
}
