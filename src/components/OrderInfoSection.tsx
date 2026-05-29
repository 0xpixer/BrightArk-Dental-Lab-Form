import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { Controller, type Control, type FieldErrors, type UseFormRegister, type UseFormWatch, type UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { FormField, orderInputClassName } from './ui/FormField'
import { ToggleChip } from './ui/ToggleChip'
import { SectionCard } from './ui/SectionCard'

interface Props {
  register: UseFormRegister<OrderFormValues>
  control: Control<OrderFormValues>
  errors: FieldErrors<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
}

function parseDate(value: string): Date | null {
  if (!value) return null
  const [d, m, y] = value.split('/').map(Number)
  if (d && m && y) return new Date(y, m - 1, d)
  const iso = new Date(value)
  return isNaN(iso.getTime()) ? null : iso
}

function formatDate(date: Date | null): string {
  if (!date) return ''
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

export function OrderInfoSection({ register, control, errors, watch, setValue }: Props) {
  const redo = watch('redo')

  return (
    <SectionCard title="Order Information" id="order-info">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <FormField
            label="Order No"
            htmlFor="orderNo"
            required
            error={errors.orderNo?.message}
            className="lg:col-span-3"
          >
            <input
              id="orderNo"
              {...register('orderNo')}
              className={orderInputClassName(!!errors.orderNo)}
              autoComplete="off"
            />
          </FormField>

          <FormField label="Date Sent" htmlFor="dateSent" className="lg:col-span-3">
            <Controller
              name="dateSent"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dateSent"
                  selected={parseDate(field.value ?? '')}
                  onChange={(date: Date | null) => field.onChange(formatDate(date))}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="DD/MM/YYYY"
                  className={orderInputClassName()}
                  showPopperArrow={false}
                />
              )}
            />
          </FormField>

          <div className="flex flex-wrap gap-2 lg:col-span-6 lg:justify-end lg:pb-1">
            <ToggleChip
              id="repair"
              label="Repair"
              checked={watch('repair')}
              onChange={(v) => setValue('repair', v)}
            />
            <ToggleChip
              id="redo"
              label="Redo"
              checked={watch('redo')}
              onChange={(v) => setValue('redo', v)}
            />
            <ToggleChip
              id="urgent"
              label="Urgent Order"
              checked={watch('urgent')}
              onChange={(v) => setValue('urgent', v)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Dentist" htmlFor="dentist" required error={errors.dentist?.message}>
            <input id="dentist" {...register('dentist')} className={orderInputClassName(!!errors.dentist)} />
          </FormField>
          <FormField label="Patient" htmlFor="patient" required error={errors.patient?.message}>
            <input id="patient" {...register('patient')} className={orderInputClassName(!!errors.patient)} />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
          <FormField
            label="Clinic"
            htmlFor="clinic"
            required
            error={errors.clinic?.message}
            className="lg:col-span-4"
          >
            <input id="clinic" {...register('clinic')} className={orderInputClassName(!!errors.clinic)} />
          </FormField>

          <FormField label="Age" htmlFor="age" className="lg:col-span-2">
            <input
              id="age"
              type="number"
              min={0}
              max={150}
              {...register('age')}
              className={orderInputClassName()}
            />
          </FormField>

          <fieldset className="lg:col-span-2">
            <legend className="mb-1 text-xs font-medium text-text">Sex</legend>
            <div className="flex gap-4">
              {(['male', 'female'] as const).map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm capitalize">
                  <input
                    type="radio"
                    value={s}
                    {...register('sex')}
                    className="accent-secondary"
                  />
                  {s}
                </label>
              ))}
            </div>
          </fieldset>

          <FormField
            label="Date Required"
            htmlFor="dateRequired"
            required
            error={errors.dateRequired?.message}
            className="lg:col-span-4"
          >
            <Controller
              name="dateRequired"
              control={control}
              render={({ field }) => (
                <DatePicker
                  id="dateRequired"
                  selected={parseDate(field.value ?? '')}
                  onChange={(date: Date | null) => field.onChange(formatDate(date))}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="DD/MM/YYYY"
                  className={orderInputClassName(!!errors.dateRequired)}
                  showPopperArrow={false}
                />
              )}
            />
          </FormField>
        </div>

        {redo && (
          <FormField label="Old Order No" htmlFor="oldOrderNo" className="max-w-sm">
            <input id="oldOrderNo" {...register('oldOrderNo')} className={orderInputClassName()} />
          </FormField>
        )}
      </div>
    </SectionCard>
  )
}
