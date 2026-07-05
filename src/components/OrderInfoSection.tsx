import type { Control, FieldErrors, UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { FormField, orderInputClassName } from './ui/FormField'
import { SectionCard } from './ui/SectionCard'

interface Props {
  register: UseFormRegister<OrderFormValues>
  control: Control<OrderFormValues>
  errors: FieldErrors<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
  onTitleClick?: () => void
}

export function OrderInfoSection({ register, errors, onTitleClick }: Props) {
  return (
    <SectionCard title="Order Information" id="order-info" onTitleClick={onTitleClick}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Dentist" htmlFor="dentist" required error={errors.dentist?.message}>
            <input id="dentist" {...register('dentist')} className={orderInputClassName(!!errors.dentist)} />
          </FormField>
          <FormField label="Clinic" htmlFor="clinic" required error={errors.clinic?.message}>
            <input id="clinic" {...register('clinic')} className={orderInputClassName(!!errors.clinic)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <input type="email" id="email" {...register('email')} className={orderInputClassName(!!errors.email)} />
          </FormField>
          <FormField label="Address" htmlFor="address" error={errors.address?.message}>
            <input id="address" {...register('address')} className={orderInputClassName(!!errors.address)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <FormField
            label="Patient Name"
            htmlFor="patient"
            required
            error={errors.patient?.message}
            className="lg:col-span-5"
          >
            <input id="patient" {...register('patient')} className={orderInputClassName(!!errors.patient)} />
          </FormField>

          <FormField label="Patient Age" htmlFor="patientAge" error={errors.patientAge?.message} className="lg:col-span-4">
            <input
              id="patientAge"
              {...register('patientAge')}
              inputMode="numeric"
              placeholder="Optional"
              className={orderInputClassName(!!errors.patientAge)}
            />
          </FormField>

          <fieldset className="lg:col-span-3">
            <legend className="mb-1 text-xs font-medium text-text">Sex</legend>
            <div className="flex gap-4">
              {(['male', 'female'] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm capitalize">
                  <input type="radio" value={s} {...register('sex')} className="accent-secondary" />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </div>
    </SectionCard>
  )
}
