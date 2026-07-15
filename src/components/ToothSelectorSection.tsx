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
  onTitleClick?: () => void
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

const TOOTH_POSITIONS: Record<number, { left: number; top: number }> = {
  18: { left: 31, top: 40 }, 17: { left: 30, top: 34 }, 16: { left: 30, top: 28 }, 15: { left: 31, top: 23 },
  14: { left: 33, top: 18 }, 13: { left: 36, top: 13 }, 12: { left: 40, top: 9 }, 11: { left: 45, top: 6 },
  21: { left: 50, top: 6 }, 22: { left: 55, top: 6 }, 23: { left: 60, top: 9 }, 24: { left: 64, top: 13 },
  25: { left: 67, top: 18 }, 26: { left: 69, top: 23 }, 27: { left: 70, top: 28 }, 28: { left: 70, top: 34 },
  48: { left: 31, top: 58 }, 47: { left: 30, top: 64 }, 46: { left: 30, top: 69 }, 45: { left: 31, top: 74 },
  44: { left: 33, top: 80 }, 43: { left: 37, top: 85 }, 42: { left: 41, top: 89 }, 41: { left: 46, top: 92 },
  31: { left: 51, top: 92 }, 32: { left: 57, top: 89 }, 33: { left: 62, top: 85 }, 34: { left: 67, top: 80 },
  35: { left: 69, top: 74 }, 36: { left: 70, top: 69 }, 37: { left: 70, top: 64 }, 38: { left: 69, top: 58 },
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
  const position = TOOTH_POSITIONS[tooth]

  return (
    <button
      type="button"
      onClick={() => onToggle(tooth)}
      aria-label={`FDI tooth ${tooth}${selected ? ', selected' : ''}`}
      aria-pressed={selected}
      className={`absolute z-10 flex aspect-square w-[7%] min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-colors duration-brand focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black ${
        selected ? 'bg-primary/80 text-white ring-2 ring-primary' : 'text-black/70 hover:bg-primary/25 hover:text-primary'
      }`}
      style={{ left: `${position.left}%`, top: `${position.top}%` }}
    >
      <span className="text-[9px] font-bold leading-none sm:text-[10px]">{tooth}</span>
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
    <div className="mx-auto w-full max-w-[500px] overflow-hidden rounded-card border border-border bg-black shadow-sm">
      <div className="relative aspect-square" role="group" aria-label="FDI adult dental chart">
        <img src="/tooth-chart.png" alt="Upper and lower dental arches" className="pointer-events-none h-full w-full select-none object-contain" />
        {FDI_TEETH.map((tooth) => (
          <ToothButton key={tooth} tooth={tooth} selected={selected.includes(tooth)} onToggle={onToggle} />
        ))}
      </div>
    </div>
  )
}

export function ToothSelectorSection({ register, errors, watch, setValue, onTitleClick }: Props) {
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
    <SectionCard title="Tooth Selector & Shade" id="tooth-selector" onTitleClick={onTitleClick}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:items-start">
        <div>
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
                    <input type="radio" value={m} {...register('toothMode')} className="sr-only" />
                    {m === 'single' ? 'Single tooth' : 'Bridge'}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-text-muted">Select teeth on the FDI chart. Multi-select supported.</p>
          </div>
          <DentalChart selected={selected} onToggle={toggleTooth} />
          {selected.length > 0 && (
            <p className="mt-3 text-sm text-text">
              <span className="font-medium text-secondary">Selected: </span>
              {selected.join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-card border border-border bg-bg p-4">
          <p className="mb-1 text-sm font-semibold text-secondary">Shade or Stump Shade</p>
          <p className="mb-4 text-xs text-text-muted">Enter a regular shade, or complete all three stump shade values.</p>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_150px] sm:items-center lg:grid-cols-1 xl:grid-cols-[minmax(0,1fr)_150px]">
            <div className="grid gap-3">
              <FormField label="Shade" htmlFor="shade" error={errors.shade?.message}>
                <input id="shade" {...register('shade')} className={inputClassName(!!errors.shade)} placeholder="e.g. VITA A2" />
              </FormField>
              <FormField label="Incisal" htmlFor="stumpShadeIncisal" error={errors.stumpShadeIncisal?.message}>
                <input id="stumpShadeIncisal" {...register('stumpShadeIncisal')} className={inputClassName(!!errors.stumpShadeIncisal)} placeholder="e.g. ND1" />
              </FormField>
              <FormField label="Middle" htmlFor="stumpShadeMiddle" error={errors.stumpShadeMiddle?.message}>
                <input id="stumpShadeMiddle" {...register('stumpShadeMiddle')} className={inputClassName(!!errors.stumpShadeMiddle)} placeholder="e.g. ND2" />
              </FormField>
              <FormField label="Cervical" htmlFor="stumpShadeCervical" error={errors.stumpShadeCervical?.message}>
                <input id="stumpShadeCervical" {...register('stumpShadeCervical')} className={inputClassName(!!errors.stumpShadeCervical)} placeholder="e.g. ND3" />
              </FormField>
            </div>
            <figure className="mx-auto w-full max-w-[150px]">
              <img src="/stump-shade.png" alt="Stump shade guide showing incisal, middle, and cervical zones" className="h-auto w-full" />
            </figure>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
