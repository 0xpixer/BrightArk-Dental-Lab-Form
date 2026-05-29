import type { ReactNode } from 'react'

interface FormFieldProps {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-text">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export const inputClassName = (hasError?: boolean) =>
  `w-full rounded-card border px-3 py-2 text-sm text-text outline-none transition-[border-color,box-shadow] duration-brand ease-in-out focus:ring-2 ${
    hasError
      ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-200'
      : 'border-border bg-grey-input focus:border-secondary focus:ring-secondary/20'
  }`

export const orderInputClassName = (hasError?: boolean) =>
  `${inputClassName(hasError)} !bg-[#e8f5e9]`
