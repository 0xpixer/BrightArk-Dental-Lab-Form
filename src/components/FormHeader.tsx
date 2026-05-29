import { BrightArkLogo } from './BrightArkLogo'

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
        <a
          href="mailto:cs@theBrightArk.com"
          className="shrink-0 text-xs font-medium text-secondary underline-offset-2 transition-colors duration-brand hover:text-primary hover:underline md:text-sm"
        >
          cs@theBrightArk.com
        </a>
      </div>
      <h1 className="border-t border-border px-4 py-2 text-center text-sm font-semibold text-secondary sm:hidden">
        Dental Lab Order Form
      </h1>
    </header>
  )
}
