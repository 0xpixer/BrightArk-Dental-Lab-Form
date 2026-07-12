import { BrightArkLogo } from './BrightArkLogo'
import Link from 'next/link'

export function FormHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface shadow-sm">
      <div className="mx-auto flex max-w-form items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="shrink-0">
          <BrightArkLogo />
        </div>
        <h1 className="hidden flex-1 text-center text-sm font-semibold text-secondary sm:block md:text-base">
          Dental Lab Order Form
        </h1>
        <div className="flex shrink-0 items-center gap-3 text-xs font-medium md:text-sm">
          <Link href="/portal/orders" className="text-secondary hover:text-primary">My Orders</Link>
          <Link href="/admin/login?callbackUrl=/portal/orders" className="text-secondary hover:text-primary">Sign In</Link>
          <Link href="/register" className="text-primary hover:underline">Register</Link>
        </div>
      </div>
      <h1 className="border-t border-border px-4 py-2 text-center text-sm font-semibold text-secondary sm:hidden">
        Dental Lab Order Form
      </h1>
    </header>
  )
}
