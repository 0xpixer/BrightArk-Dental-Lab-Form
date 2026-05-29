interface ToggleChipProps {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ToggleChip({ id, label, checked, onChange }: ToggleChipProps) {
  return (
    <label
      htmlFor={id}
      className={`inline-flex cursor-pointer select-none items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-brand ease-in-out ${
        checked
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-surface text-text-muted hover:border-primary/50'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className={`h-3.5 w-3.5 rounded border transition-colors duration-brand ${
          checked ? 'border-primary bg-primary' : 'border-border bg-white'
        }`}
        aria-hidden
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-full w-full p-0.5 text-white">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        )}
      </span>
      {label}
    </label>
  )
}
