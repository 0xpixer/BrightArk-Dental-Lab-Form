interface YesNoToggleProps {
  name: string
  label: string
  value: 'yes' | 'no' | ''
  onChange: (value: 'yes' | 'no') => void
}

export function YesNoToggle({ name, label, value, onChange }: YesNoToggleProps) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">{label}</legend>
      <span className="text-xs text-text-muted">{label}</span>
      {(['yes', 'no'] as const).map((opt) => (
        <label
          key={opt}
          className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize transition-all duration-brand ${
            value === opt
              ? 'border-secondary bg-secondary/10 text-secondary'
              : 'border-border text-text-muted hover:border-secondary/40'
          }`}
        >
          <input
            type="radio"
            name={name}
            value={opt}
            className="sr-only"
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt === 'yes' ? 'Yes' : 'No'}
        </label>
      ))}
    </fieldset>
  )
}
