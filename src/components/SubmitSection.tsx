import { Loader2 } from 'lucide-react'

interface SubmitSectionProps {
  isSubmitting: boolean
  onSaveDraft: () => void
  draftSaved?: boolean
}

export function SubmitSection({ isSubmitting, onSaveDraft, draftSaved }: SubmitSectionProps) {
  return (
    <div className="space-y-3 md:static">
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:relative md:border-0 md:bg-transparent md:p-0 md:shadow-none">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-card bg-primary py-3.5 text-sm font-semibold text-white transition-colors duration-brand hover:bg-[#e06d15] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {isSubmitting ? 'Submitting…' : 'Submit Order'}
        </button>
      </div>

      <button
        type="button"
        onClick={onSaveDraft}
        className="hidden w-full rounded-card border-2 border-secondary py-2.5 text-sm font-semibold text-secondary transition-colors duration-brand hover:bg-secondary/5 md:block"
      >
        {draftSaved ? 'Draft Saved ✓' : 'Save Draft'}
      </button>

      <button
        type="button"
        onClick={onSaveDraft}
        className="w-full rounded-card border-2 border-secondary py-2.5 text-sm font-semibold text-secondary transition-colors duration-brand hover:bg-secondary/5 md:hidden"
      >
        {draftSaved ? 'Draft Saved ✓' : 'Save Draft'}
      </button>
    </div>
  )
}
