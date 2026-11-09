'use client'

import { COUNTRY_OPTIONS, OTHER_COUNTRIES, PRIORITY_COUNTRIES, majorCitiesForCountry } from '@/lib/accountLocations'

type SharedProps = {
  value: string
  disabled?: boolean
  required?: boolean
  className: string
  id?: string
  'aria-label'?: string
}

type CountrySelectProps = SharedProps & {
  onChange: (value: string) => void
}

type CityInputProps = SharedProps & {
  country: string
  onChange: (value: string) => void
  listId: string
}

export function CountrySelect({ value, onChange, disabled, required, className, id, 'aria-label': ariaLabel }: CountrySelectProps) {
  const hasLegacyValue = Boolean(value) && !COUNTRY_OPTIONS.includes(value)

  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      autoComplete="country-name"
      aria-label={ariaLabel}
      className={className}
    >
      <option value="">Select country</option>
      {hasLegacyValue && <option value={value}>{value}</option>}
      <optgroup label="Priority markets">
        {PRIORITY_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
      </optgroup>
      <optgroup label="Other countries">
        {OTHER_COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
      </optgroup>
    </select>
  )
}

export function CityInput({ value, country, onChange, listId, disabled, required, className, id, 'aria-label': ariaLabel }: CityInputProps) {
  const cities = majorCitiesForCountry(country)

  return (
    <>
      <input
        id={id}
        value={value}
        list={cities.length > 0 ? listId : undefined}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required={required}
        maxLength={120}
        autoComplete="address-level2"
        placeholder={country ? 'Select or enter city' : 'Select country first'}
        aria-label={ariaLabel}
        className={className}
      />
      {cities.length > 0 && (
        <datalist id={listId}>
          {cities.map((city) => <option key={city} value={city} />)}
        </datalist>
      )}
    </>
  )
}
