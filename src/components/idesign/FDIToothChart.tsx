'use client'

import { TOOTH_CHART_ROWS as ROWS } from '@/lib/idesign/cases'

/**
 * `value` holds the teeth the user picked in this chart. `lockedTeeth` are shown
 * as selected but greyed out and cannot be toggled here (e.g. teeth selected under
 * Extraction); they are not added to or removed from `value`.
 */
export function FDIToothChart({ title, helper, value, onChange, readOnly = false, lockedTeeth = [], lockedReason }: { title?: string; helper?: string; value: number[]; onChange: (teeth: number[]) => void; readOnly?: boolean; lockedTeeth?: number[]; lockedReason?: string }) {
  const selected = new Set(value)
  const locked = new Set(lockedTeeth)
  const toggle = (tooth: number) => {
    if (locked.has(tooth)) return
    onChange(selected.has(tooth) ? value.filter((item) => item !== tooth) : [...value, tooth])
  }
  const chip = (tooth: number) => <ToothChip key={tooth} tooth={tooth} active={selected.has(tooth)} locked={locked.has(tooth)} lockedReason={lockedReason} readOnly={readOnly} onClick={() => toggle(tooth)} />

  return <fieldset className="border-t border-border py-5 first:border-t-0 first:pt-0">
    {title ? <legend className="mb-1 text-sm font-semibold text-text">{title}</legend> : <legend className="sr-only">FDI tooth selection</legend>}
    {helper && <p className="mb-3 text-xs text-text-muted">{helper}</p>}
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[610px] space-y-2" role="group" aria-label={`${title ?? 'FDI'} tooth selection`}>
        {ROWS.map((row, rowIndex) => <div key={row.label} className={`grid grid-cols-[20px_1fr_1px_1fr_20px] items-center gap-2 ${rowIndex === 2 ? 'border-t border-border pt-2' : ''}`}>
          <span className="text-center text-[10px] font-semibold text-text-muted">R</span>
          <div className="flex justify-end gap-1">{row.right.map(chip)}</div>
          <div className="h-8 bg-border" aria-hidden />
          <div className="flex gap-1">{row.left.map(chip)}</div>
          <span className="text-center text-[10px] font-semibold text-text-muted">L</span>
        </div>)}
      </div>
    </div>
  </fieldset>
}

function ToothChip({ tooth, active, locked, lockedReason, onClick, readOnly }: { tooth: number; active: boolean; locked: boolean; lockedReason?: string; onClick: () => void; readOnly: boolean }) {
  if (locked) return <button type="button" aria-pressed aria-disabled disabled title={lockedReason} className="h-8 w-8 shrink-0 cursor-not-allowed rounded border border-neutral-300 bg-neutral-300 text-[11px] font-semibold text-neutral-600 disabled:opacity-100">{tooth}</button>
  return <button type="button" aria-pressed={active} disabled={readOnly} onClick={onClick} className={`h-8 w-8 shrink-0 rounded border text-[11px] font-semibold transition-colors disabled:cursor-default disabled:opacity-100 ${active ? 'border-text bg-text text-white' : `border-border bg-surface text-text ${readOnly ? '' : 'hover:border-neutral-400 hover:bg-bg'}`}`}>{tooth}</button>
}
