import { useMemo } from 'react'
import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { VITA_SHADES } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { FormField, inputClassName } from './ui/FormField'

interface Props {
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
}

const UPPER = Array.from({ length: 16 }, (_, i) => i + 1)
const LOWER = Array.from({ length: 16 }, (_, i) => i + 17)

function toothPath(cx: number, cy: number, w: number, h: number): string {
  return `M${cx - w / 2},${cy + h / 2} Q${cx},${cy - h / 2} ${cx + w / 2},${cy + h / 2} Q${cx},${cy + h / 2} ${cx - w / 2},${cy + h / 2} Z`
}

function DentalArch({
  selected,
  mode,
  onToggle,
}: {
  selected: number[]
  mode: 'single' | 'bridge'
  onToggle: (n: number) => void
}) {
  const upperPos = useMemo(() => {
    return UPPER.map((num, i) => {
      const t = i / 15
      const cx = 50 + i * (700 / 15)
      const cy = 80 + Math.sin(t * Math.PI) * 35
      return { num, cx, cy }
    })
  }, [])

  const lowerPos = useMemo(() => {
    return LOWER.map((num, i) => {
      const t = i / 15
      const cx = 50 + i * (700 / 15)
      const cy = 200 - Math.sin(t * Math.PI) * 35
      return { num, cx, cy }
    })
  }, [])

  const bridges = useMemo(() => {
    if (mode !== 'bridge' || selected.length < 2) return []
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    const all = [...upperPos, ...lowerPos]
    const sorted = [...selected].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      if (b - a !== 1) continue
      const pa = all.find((p) => p.num === a)
      const pb = all.find((p) => p.num === b)
      if (pa && pb) lines.push({ x1: pa.cx, y1: pa.cy, x2: pb.cx, y2: pb.cy })
    }
    return lines
  }, [mode, selected, upperPos, lowerPos])

  const renderTooth = (num: number, cx: number, cy: number) => {
    const isSelected = selected.includes(num)
    return (
      <g key={num}>
        <path
          d={toothPath(cx, cy, 28, 36)}
          fill={isSelected ? '#F47B20' : '#E8EBF2'}
          stroke={isSelected ? '#D96A10' : '#C5CAD8'}
          strokeWidth={1.5}
          className="cursor-pointer transition-[fill,stroke] duration-brand hover:opacity-90"
          onClick={() => onToggle(num)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onToggle(num)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`Tooth ${num}${isSelected ? ', selected' : ''}`}
          aria-pressed={isSelected}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="9"
          fill={isSelected ? '#fff' : '#6B7280'}
          className="pointer-events-none select-none"
        >
          {num}
        </text>
      </g>
    )
  }

  return (
    <svg
      viewBox="0 0 800 280"
      className="mx-auto w-full max-w-3xl"
      role="img"
      aria-label="Dental arch tooth selector, Universal Numbering System"
    >
      <ellipse cx="400" cy="140" rx="340" ry="100" fill="none" stroke="#E0E3ED" strokeWidth="1" strokeDasharray="4 4" />
      {bridges.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="#F47B20"
          strokeWidth="4"
          strokeLinecap="round"
          opacity={0.7}
        />
      ))}
      {upperPos.map(({ num, cx, cy }) => renderTooth(num, cx, cy))}
      {lowerPos.map(({ num, cx, cy }) => renderTooth(num, cx, cy))}
      <text x="400" y="20" textAnchor="middle" fontSize="11" fill="#6B7280">
        Upper (1–16)
      </text>
      <text x="400" y="270" textAnchor="middle" fontSize="11" fill="#6B7280">
        Lower (17–32)
      </text>
    </svg>
  )
}

export function ToothSelectorSection({ register, watch, setValue }: Props) {
  const selected = watch('selectedTeeth') ?? []
  const mode = watch('toothMode')

  const toggleTooth = (n: number) => {
    const next = selected.includes(n)
      ? selected.filter((t) => t !== n)
      : [...selected, n].sort((a, b) => a - b)
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

      <DentalArch selected={selected} mode={mode} onToggle={toggleTooth} />

      {selected.length > 0 && (
        <p className="mt-3 text-sm text-text">
          <span className="font-medium text-secondary">Selected: </span>
          {selected.join(', ')}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FormField label="Shade" htmlFor="shade">
          <input id="shade" list="vita-shades" {...register('shade')} className={inputClassName()} placeholder="e.g. A2" />
          <datalist id="vita-shades">
            {VITA_SHADES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Stump Shade" htmlFor="stumpShade">
          <input id="stumpShade" {...register('stumpShade')} className={inputClassName()} />
        </FormField>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-text">Occlusal Stain</legend>
          <div className="flex flex-wrap gap-2">
            {(['none', 'light', 'medium', 'heavy'] as const).map((s) => (
              <label
                key={s}
                className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors duration-brand ${
                  watch('occlusalStain') === s
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-text-muted'
                }`}
              >
                <input type="radio" value={s} {...register('occlusalStain')} className="sr-only" />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <FormField label="Rest on" htmlFor="restOn">
          <input id="restOn" {...register('restOn')} className={inputClassName()} />
        </FormField>
        <FormField label="Clasp on" htmlFor="claspOn" className="sm:col-span-2">
          <input id="claspOn" {...register('claspOn')} className={inputClassName()} />
        </FormField>
      </div>
    </SectionCard>
  )
}
