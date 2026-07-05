import { useEffect } from 'react'
import type { FieldErrors, UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { FormField, inputClassName } from './ui/FormField'

interface Props {
  register: UseFormRegister<OrderFormValues>
  errors: FieldErrors<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
}

const FDI_QUADRANTS = [
  { label: 'Upper Right', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
  { label: 'Upper Left', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: 'Lower Right', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
  { label: 'Lower Left', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
] as const
const FDI_TEETH = FDI_QUADRANTS.flatMap((quadrant) => quadrant.teeth)

function isFdiTooth(tooth: number): boolean {
  return FDI_TEETH.includes(tooth as (typeof FDI_TEETH)[number])
}

function sortFdiTeeth(teeth: number[]): number[] {
  return [...teeth].sort((a, b) => FDI_TEETH.indexOf(a as (typeof FDI_TEETH)[number]) - FDI_TEETH.indexOf(b as (typeof FDI_TEETH)[number]))
}

function toothShapePath(tooth: number): string {
  const position = tooth % 10
  if (position <= 2) {
    return 'M18 7 C13 12 12 31 15 40 C17 47 21 51 24 51 C27 51 31 47 33 40 C36 31 35 12 30 7 C27 5 21 5 18 7Z'
  }
  if (position === 3) {
    return 'M24 5 C15 13 13 32 17 42 C20 49 23 53 24 53 C25 53 28 49 31 42 C35 32 33 13 24 5Z'
  }
  if (position <= 5) {
    return 'M14 10 C8 20 10 39 18 47 C21 50 27 50 30 47 C38 39 40 20 34 10 C30 5 18 5 14 10Z'
  }
  return 'M11 12 C6 22 8 40 18 48 C23 52 29 52 34 48 C44 40 46 22 39 12 C34 5 16 5 11 12Z'
}

function toothWidthClass(tooth: number): string {
  const position = tooth % 10
  if (position <= 2) return 'max-w-[42px]'
  if (position === 3) return 'max-w-[44px]'
  return 'max-w-[48px]'
}

function ToothButton({
  tooth,
  selected,
  onToggle,
}: {
  tooth: number
  selected: boolean
  onToggle: (n: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(tooth)}
      aria-label={`FDI tooth ${tooth}${selected ? ', selected' : ''}`}
      aria-pressed={selected}
      className={`group flex flex-col items-center justify-center gap-0.5 rounded-[6px] border px-1 py-1 transition-colors duration-brand focus:outline-none focus:ring-2 focus:ring-primary/30 ${
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-surface text-text-muted hover:border-primary hover:text-primary'
      }`}
      style={{ minHeight: 56, minWidth: 44 }}
    >
      <svg viewBox="0 0 48 56" className={`h-10 w-full ${toothWidthClass(tooth)}`} aria-hidden>
        <path
          d={toothShapePath(tooth)}
          fill={selected ? '#F47B20' : '#E8EBF2'}
          stroke={selected ? '#D96A10' : '#C5CAD8'}
          strokeWidth="1.6"
          className="transition-[fill,stroke] duration-brand"
        />
        <path
          d="M17 19 C21 16 27 16 31 19 M16 29 C21 32 27 32 32 29"
          fill="none"
          stroke={selected ? '#FFFFFF' : '#A8AFBF'}
          strokeLinecap="round"
          strokeWidth="1.2"
          opacity="0.75"
        />
      </svg>
      <span className="text-[11px] font-semibold leading-none">{tooth}</span>
    </button>
  )
}

function DentalChart({
  selected,
  onToggle,
}: {
  selected: number[]
  onToggle: (n: number) => void
}) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-bg p-3">
      <div
        className="grid grid-cols-2 rounded-card bg-surface shadow-sm"
        style={{ minWidth: 900 }}
        role="group"
        aria-label="FDI adult dental chart"
      >
        {FDI_QUADRANTS.map((quadrant, index) => {
          const isRightColumn = index % 2 === 1
          const isLowerRow = index >= 2
          return (
            <div
              key={quadrant.label}
              className={`p-3 ${
                isRightColumn ? '' : 'border-r-2 border-primary/30'
              } ${
                isLowerRow ? 'border-t-2 border-primary/30' : ''
              }`}
            >
              <p className="mb-2 text-center text-xs font-semibold text-text-muted">{quadrant.label}</p>
              <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(8, minmax(44px, 1fr))' }}>
                {quadrant.teeth.map((tooth) => (
                  <ToothButton
                    key={tooth}
                    tooth={tooth}
                    selected={selected.includes(tooth)}
                    onToggle={onToggle}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ToothSelectorSection({ register, errors, watch, setValue }: Props) {
  const selectedRaw = watch('selectedTeeth') ?? []
  const selected = sortFdiTeeth(selectedRaw.filter(isFdiTooth))
  const mode = watch('toothMode')

  useEffect(() => {
    if (selected.length !== selectedRaw.length) {
      setValue('selectedTeeth', selected)
    }
  }, [selected, selectedRaw.length, setValue])

  const toggleTooth = (n: number) => {
    const next = selected.includes(n)
      ? selected.filter((t) => t !== n)
      : sortFdiTeeth([...selected, n])
    setValue('selectedTeeth', next)
  }

  return (
    <SectionCard title="Tooth Selector & Shade" id="tooth-selector">
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <fieldset>
          <legend className="sr-only">Selection mode</legend>
          <div className="flex rounded-card border border-border p-0.5">
            {(['single', 'bridge'] as const).map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-[6px] px-3 py-1 text-xs font-medium capitalize transition-colors duration-brand ${
                  mode === m ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                <input
                  type="radio"
                  value={m}
                  {...register('toothMode')}
                  className="sr-only"
                />
                {m === 'single' ? 'Single tooth' : 'Bridge'}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="text-xs text-text-muted">Click teeth to select. Multi-select supported.</p>
      </div>

      <DentalChart selected={selected} onToggle={toggleTooth} />

      {selected.length > 0 && (
        <p className="mt-3 text-sm text-text">
          <span className="font-medium text-secondary">Selected: </span>
          {selected.join(', ')}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Shade" htmlFor="shade" required error={errors.shade?.message}>
          <input id="shade" {...register('shade')} className={inputClassName(!!errors.shade)} placeholder="e.g. VITA A2" />
        </FormField>
      </div>
    </SectionCard>
  )
}
