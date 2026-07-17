import type { Control, FieldErrors, UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { FormField, orderInputClassName } from './ui/FormField'
import { SectionCard } from './ui/SectionCard'

export interface ClinicOption {
  id: number
  name: string
  address: string
}

interface Props {
  register: UseFormRegister<OrderFormValues>
  control: Control<OrderFormValues>
  errors: FieldErrors<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
  onTitleClick?: () => void
  embedded?: boolean
  clinics?: ClinicOption[]
}

export function OrderInfoSection({ register, errors, watch, setValue, onTitleClick, embedded, clinics = [] }: Props) {
  const deliveryAddress = watch('address') ?? ''
  const billAddressSameAsDelivery = watch('billAddressSameAsDelivery')

  const selectClinic = (clinicName: string) => {
    const selectedClinic = clinics.find((clinic) => clinic.name === clinicName)
    if (!selectedClinic) return

    setValue('address', selectedClinic.address, { shouldDirty: true })
    if (billAddressSameAsDelivery) {
      setValue('billAddress', selectedClinic.address, { shouldDirty: true })
    }
  }

  return (
    <SectionCard title="Order Information" id="order-info" onTitleClick={onTitleClick} embedded={embedded}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <FormField label="Dentist" htmlFor="dentist" required error={errors.dentist?.message}>
            <input id="dentist" {...register('dentist')} className={orderInputClassName(!!errors.dentist)} />
          </FormField>
          <FormField label="Clinic" htmlFor="clinic" required error={errors.clinic?.message}>
            {clinics.length > 0 ? (
              <select
                id="clinic"
                {...register('clinic', { onChange: (event) => selectClinic(event.target.value) })}
                className={orderInputClassName(!!errors.clinic)}
              >
                <option value="">Select clinic</option>
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.name}>{clinic.name}</option>
                ))}
              </select>
            ) : (
              <input id="clinic" {...register('clinic')} className={orderInputClassName(!!errors.clinic)} />
            )}
          </FormField>
          <FormField label="Email" htmlFor="email" required error={errors.email?.message}>
            <input type="email" id="email" {...register('email')} className={orderInputClassName(!!errors.email)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-end">
          <FormField label="Delivery address" htmlFor="address" error={errors.address?.message}>
            <input
              id="address"
              {...register('address', {
                onChange: (event) => {
                  if (billAddressSameAsDelivery) {
                    setValue('billAddress', event.target.value, { shouldDirty: true })
                  }
                },
              })}
              className={orderInputClassName(!!errors.address)}
            />
          </FormField>
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-text lg:mb-2">
            <input
              type="checkbox"
              checked={billAddressSameAsDelivery}
              onChange={(event) => {
                setValue('billAddressSameAsDelivery', event.target.checked, { shouldDirty: true })
                if (event.target.checked) {
                  setValue('billAddress', deliveryAddress, { shouldDirty: true })
                }
              }}
              className="h-4 w-4 accent-secondary"
            />
            Same as delivery address
          </label>
          <FormField label="Bill address" htmlFor="billAddress" error={errors.billAddress?.message}>
            <input
              id="billAddress"
              {...register('billAddress')}
              disabled={billAddressSameAsDelivery}
              className={orderInputClassName(!!errors.billAddress)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <FormField label="Patient Name" htmlFor="patient" required error={errors.patient?.message} className="lg:col-span-5">
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
