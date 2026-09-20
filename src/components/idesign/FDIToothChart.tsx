'use client'

const ROWS = [
  { label: 'Upper primary', right: [55, 54, 53, 52, 51], left: [61, 62, 63, 64, 65] },
  { label: 'Upper permanent', right: [18, 17, 16, 15, 14, 13, 12, 11], left: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: 'Lower permanent', right: [48, 47, 46, 45, 44, 43, 42, 41], left: [31, 32, 33, 34, 35, 36, 37, 38] },
  { label: 'Lower primary', right: [85, 84, 83, 82, 81], left: [71, 72, 73, 74, 75] },
]

export function FDIToothChart({ title, helper, value, onChange }: { title: string; helper?: string; value: number[]; onChange: (teeth: number[]) => void }) {
  const selected = new Set(value)
  const toggle = (tooth: number) => onChange(selected.has(tooth) ? value.filter((item) => item !== tooth) : [...value, tooth])

  return <fieldset className="border-t border-border py-5 first:border-t-0 first:pt-0">
    <legend className="mb-1 text-sm font-semibold text-text">{title}</legend>
    {helper && <p className="mb-3 text-xs text-text-muted">{helper}</p>}
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[610px] space-y-2" role="group" aria-label={`${title} tooth selection`}>
        {ROWS.map((row, rowIndex) => <div key={row.label} className={`grid grid-cols-[20px_1fr_1px_1fr_20px] items-center gap-2 ${rowIndex === 2 ? 'border-t border-border pt-2' : ''}`}>
          <span className="text-center text-[10px] font-semibold text-text-muted">R</span>
          <div className="flex justify-end gap-1">{row.right.map((tooth) => <ToothChip key={tooth} tooth={tooth} active={selected.has(tooth)} onClick={() => toggle(tooth)} />)}</div>
          <div className="h-8 bg-border" aria-hidden />
          <div className="flex gap-1">{row.left.map((tooth) => <ToothChip key={tooth} tooth={tooth} active={selected.has(tooth)} onClick={() => toggle(tooth)} />)}</div>
          <span className="text-center text-[10px] font-semibold text-text-muted">L</span>
        </div>)}
      </div>
    </div>
  </fieldset>
}

function ToothChip({ tooth, active, onClick }: { tooth: number; active: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`h-8 w-8 shrink-0 rounded border text-[11px] font-semibold transition-colors ${active ? 'border-text bg-text text-white' : 'border-border bg-surface text-text hover:border-neutral-400 hover:bg-bg'}`}>{tooth}</button>
}
