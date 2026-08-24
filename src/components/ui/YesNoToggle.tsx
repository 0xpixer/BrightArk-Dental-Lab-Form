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
              ? 'border-text bg-text text-white'
              : 'border-border text-text-muted hover:border-neutral-400 hover:text-text'
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
