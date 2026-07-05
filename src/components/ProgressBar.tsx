import { Check } from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Order Info' },
  { id: 2, label: 'Treatment' },
  { id: 3, label: 'Teeth & Shade' },
  { id: 4, label: 'Instructions' },
  { id: 5, label: 'Upload Files' },
] as const

interface ProgressBarProps {
  activeStep: number | null
}

export function ProgressBar({ activeStep }: ProgressBarProps) {
  return (
    <nav aria-label="Form progress" className="rounded-card bg-surface p-4 shadow-sm">
      <ol className="flex items-center justify-between gap-2">
        {STEPS.map((step, index) => {
          const isComplete = activeStep !== null && step.id < activeStep
          const isActive = step.id === activeStep
          return (
            <li key={step.id} className="flex flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-1 sm:flex-row sm:gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-brand ${
                    isComplete
                      ? 'bg-secondary text-white'
                      : isActive
                        ? 'bg-primary text-white'
                        : 'bg-border text-text-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isComplete ? <Check className="h-4 w-4" aria-hidden /> : step.id}
                </span>
                <span
                  className={`text-center text-[10px] font-medium sm:text-left sm:text-xs ${
                    isActive ? 'text-primary' : isComplete ? 'text-secondary' : 'text-text-muted'
                  }`}
                >
                  <span className="hidden md:inline">Step {step.id}: </span>
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`mx-1 hidden h-0.5 flex-1 sm:block ${
                    activeStep !== null && step.id < activeStep ? 'bg-secondary' : 'bg-border'
                  }`}
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
