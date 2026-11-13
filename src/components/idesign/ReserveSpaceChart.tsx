'use client'

import { Fragment, useRef, useState } from 'react'
import { Plus, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { clampReserveSpaceMm, RESERVE_SPACE_MAX_MM, RESERVE_SPACE_MIN_MM, TOOTH_CHART_ROWS, type ReserveSpaceGap } from '@/lib/idesign/cases'

/**
 * Reserve space is entered between neighbouring teeth: hovering a tooth shows a +
 * on each side that has a neighbour; clicking it opens a 0.01–25 mm input.
 */
export function ReserveSpaceChart({ helper, value, onChange, readOnly = false, extractedTeeth = [], lockedTeeth = [] }: {
  helper?: string
  value: ReserveSpaceGap[]
  onChange: (gaps: ReserveSpaceGap[]) => void
  readOnly?: boolean
  extractedTeeth?: number[]
  lockedTeeth?: number[]
}) {
  const [hoveredTooth, setHoveredTooth] = useState<number | null>(null)
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null)
  // Key of the input that is open right now. Cleared synchronously so the blur that
  // fires when the input unmounts (after × or Enter) does not commit it a second time.
  const activeKey = useRef<string | null>(null)
  const gaps = new Map(value.map((gap) => [gap.teeth.join('-'), gap]))
  const extracted = new Set(extractedTeeth)
  const locked = new Set(lockedTeeth)

  const commit = () => {
    if (!editing || activeKey.current !== editing.key) return
    activeKey.current = null
    const [a, b] = editing.key.split('-').map(Number)
    const mm = clampReserveSpaceMm(editing.text.trim() === '' ? RESERVE_SPACE_MIN_MM : Number(editing.text))
    const next = value.filter((gap) => gap.teeth.join('-') !== editing.key)
    onChange([...next, { teeth: [a, b], mm }])
    setEditing(null)
  }
  const remove = (key: string) => {
    activeKey.current = null
    onChange(value.filter((gap) => gap.teeth.join('-') !== key))
    setEditing(null)
  }
  const open = (key: string) => {
    if (readOnly) return
    if (editing && editing.key !== key) commit()
    activeKey.current = key
    setEditing({ key, text: gaps.has(key) ? String(gaps.get(key)!.mm) : '' })
  }
  const onTextChange = (text: string) => {
    // Values above the maximum are shown as the maximum straight away.
    const number = Number(text)
    if (text.trim() !== '' && Number.isFinite(number) && number > RESERVE_SPACE_MAX_MM) text = String(RESERVE_SPACE_MAX_MM)
    if (/^\d*(?:\.\d{0,2})?$/.test(text)) setEditing((current) => current && { ...current, text })
  }

  const gapSlot = (left: number, right: number, midline = false) => {
    const key = `${left}-${right}`
    const gap = gaps.get(key)
    const isEditing = editing?.key === key
    const showPlus = !readOnly && !gap && !isEditing && (hoveredTooth === left || hoveredTooth === right)
    return <div key={key} className={`relative flex h-8 shrink-0 justify-center self-center ${midline ? 'w-5' : 'w-4'}`}>
      {midline && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" aria-hidden />}
      {(gap || isEditing) && <>
        <div className="absolute bottom-1/2 left-1/2 top-[-6px] w-0.5 -translate-x-1/2 bg-primary" aria-hidden />
        <div className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2">
          {isEditing ? <div className="relative">
            <input
              autoFocus
              inputMode="decimal"
              aria-label={`Reserve space between ${left} and ${right} (mm)`}
              value={editing.text}
              placeholder={String(RESERVE_SPACE_MIN_MM)}
              onChange={(event) => onTextChange(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') { event.preventDefault(); commit() }
                if (event.key === 'Escape') { event.preventDefault(); if (gap) { activeKey.current = null; setEditing(null) } else remove(key) }
              }}
              className="h-7 w-14 rounded border border-primary bg-surface px-1 text-center text-xs font-semibold text-text outline-none"
            />
            <button type="button" title="Remove reserve space" onMouseDown={(event) => event.preventDefault()} onClick={() => remove(key)} className="absolute -right-2 -top-2 grid h-4 w-4 place-items-center rounded-full bg-neutral-400 text-white hover:bg-neutral-500"><MorphIcon icon={X} className="h-3 w-3" /><span className="sr-only">Remove</span></button>
          </div> : <button type="button" disabled={readOnly} title={readOnly ? undefined : 'Edit reserve space'} onClick={() => open(key)} className="h-6 min-w-[2.5rem] whitespace-nowrap rounded border border-border bg-surface px-1 text-xs font-semibold text-text disabled:cursor-default enabled:hover:border-primary">{gap!.mm}</button>}
        </div>
      </>}
      {showPlus && <button type="button" title={`Add reserve space between ${left} and ${right}`} onClick={() => open(key)} className="absolute left-1/2 top-1/2 z-10 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-white shadow-sm hover:bg-orange-600"><MorphIcon icon={Plus} className="h-3.5 w-3.5" /><span className="sr-only">Add reserve space</span></button>}
    </div>
  }

  const tooth = (number: number) => <div key={number} className="relative shrink-0" onMouseEnter={() => setHoveredTooth(number)}>
    {!readOnly && hoveredTooth === number && locked.has(number) && <span className="pointer-events-none absolute -top-4 left-1/2 -translate-x-1/2 rounded bg-text px-1 text-[9px] font-semibold uppercase leading-[14px] text-white">Lock</span>}
    <div title={extracted.has(number) ? 'Extracted' : undefined} className={`grid h-8 w-8 place-items-center rounded border text-[11px] font-semibold ${extracted.has(number) ? 'border-neutral-300 bg-neutral-300 text-neutral-600' : 'border-border bg-surface text-text'}`}>{number}</div>
  </div>

  const sequence = (teeth: readonly number[]) => teeth.map((number, index) => <Fragment key={number}>
    {index > 0 && gapSlot(teeth[index - 1], number)}
    {tooth(number)}
  </Fragment>)

  return <fieldset className="py-1">
    <legend className="sr-only">Reserve space between teeth</legend>
    {helper && <p className="mb-3 text-xs text-text-muted">{helper}</p>}
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[760px] space-y-1" onMouseLeave={() => setHoveredTooth(null)}>
        {TOOTH_CHART_ROWS.map((row, rowIndex) => <div key={row.label} className={`grid grid-cols-[20px_1fr_auto_1fr_20px] items-center gap-0 pt-9 ${rowIndex === 2 ? 'border-t border-border' : ''}`}>
          <span className="text-center text-[10px] font-semibold text-text-muted">R</span>
          <div className="flex justify-end">{sequence(row.right)}</div>
          {gapSlot(row.right[row.right.length - 1], row.left[0], true)}
          <div className="flex">{sequence(row.left)}</div>
          <span className="text-center text-[10px] font-semibold text-text-muted">L</span>
        </div>)}
      </div>
    </div>
  </fieldset>
}
