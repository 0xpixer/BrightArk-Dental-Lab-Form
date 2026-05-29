import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { SectionCard, TreatmentColumn } from './ui/SectionCard'
import { YesNoToggle } from './ui/YesNoToggle'
import { inputClassName } from './ui/FormField'

interface Props {
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
}

function RadioOption({
  name,
  value,
  label,
  register,
  current,
}: {
  name: keyof OrderFormValues
  value: string
  label: string
  register: UseFormRegister<OrderFormValues>
  current: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-xs leading-snug">
      <input
        type="radio"
        value={value}
        {...register(name)}
        checked={current === value}
        className="mt-0.5 accent-secondary"
      />
      <span>{label}</span>
    </label>
  )
}

const ORTHO_OPTIONS = [
  'Clear Aligner',
  'Essix Retainer',
  'Hawley Retainer',
  'Space Maintainer',
  'Frankle',
  'Palatal Expander',
  'Sports Guard',
  'Night Guard',
  'Snore Guard',
  'Others',
]

const IMPLANT_OPTIONS = [
  'Cement Retained',
  'Cemented by Lab',
  'Screw Retained',
  'Custom Abutment',
  'Ti-base Overdenture',
  'Framework',
  'Others',
]

const FIXED_TYPES = ['Crown', 'Veneer', 'Inlay/Onlay', 'Post-core', 'Maryland Bridge', 'Others']
const FIXED_MATERIALS = [
  'PFM',
  'Full Metal',
  'Zirconia Full Contour',
  'Zirconia with Layered',
  'E-max',
  'E-max with Layered',
  'Others',
]
const MARGIN_OPTIONS = [
  'Metal Lingual',
  '360° Metal',
  '3/4 Metal',
  'Full Metal',
  '180° Porcelain',
  '360° Porcelain',
  'Others',
]

const REMOVABLE_TYPES = [
  'Custom Tray',
  'Bite Block',
  'Framework',
  'Teeth Set up Try in',
  'Re-try',
  'Finish',
  'Others',
]

export function TreatmentTypeSection({ register, watch, setValue }: Props) {
  const orthodontics = watch('orthodontics')
  const removableType = watch('removableType')
  const marginDesign = watch('marginDesign')

  return (
    <SectionCard title="Treatment Type" id="treatment-type">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <TreatmentColumn title="Orthodontics">
          <div className="space-y-1.5">
            {ORTHO_OPTIONS.map((opt) => (
              <RadioOption
                key={opt}
                name="orthodontics"
                value={opt}
                label={opt}
                register={register}
                current={orthodontics ?? ''}
              />
            ))}
          </div>
          {orthodontics === 'Night Guard' && (
            <div className="mt-2 rounded border border-border bg-bg p-2">
              <p className="mb-1 text-xs font-medium text-text-muted">Night Guard Type</p>
              <div className="flex gap-3">
                {(['soft', 'hard'] as const).map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-1 text-xs capitalize">
                    <input type="radio" value={t} {...register('nightGuardType')} className="accent-secondary" />
                    {t}
                  </label>
                ))}
              </div>
            </div>
          )}
          {orthodontics === 'Others' && (
            <input
              placeholder="Specify..."
              {...register('orthodonticsOther')}
              className={`mt-1 ${inputClassName()}`}
            />
          )}
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <YesNoToggle name="allergies" label="Allergies?" value={watch('allergies') ?? ''} onChange={(v) => setValue('allergies', v)} />
            <YesNoToggle name="looseTooth" label="Loose Tooth?" value={watch('looseTooth') ?? ''} onChange={(v) => setValue('looseTooth', v)} />
            <YesNoToggle name="toothDecay" label="Tooth Decay?" value={watch('toothDecay') ?? ''} onChange={(v) => setValue('toothDecay', v)} />
          </div>
        </TreatmentColumn>

        <TreatmentColumn title="Implant">
          <div className="space-y-2">
            {(['implantBrand', 'implantSystem', 'implantSize'] as const).map((field) => (
              <label key={field} className="block">
                <span className="text-xs font-medium capitalize text-text-muted">
                  {field.replace('implant', '')}
                </span>
                <input {...register(field)} className={`mt-0.5 ${inputClassName()}`} />
              </label>
            ))}
          </div>
          <div className="mt-2 space-y-1.5">
            {IMPLANT_OPTIONS.map((opt) => (
              <RadioOption
                key={opt}
                name="implantType"
                value={opt}
                label={opt}
                register={register}
                current={watch('implantType') ?? ''}
              />
            ))}
          </div>
          {watch('implantType') === 'Others' && (
            <input placeholder="Specify..." {...register('implantOther')} className={`mt-1 ${inputClassName()}`} />
          )}
        </TreatmentColumn>

        <TreatmentColumn title="Fixed Restoration">
          <p className="text-xs font-semibold text-secondary">Type</p>
          <div className="mb-2 space-y-1">
            {FIXED_TYPES.map((opt) => (
              <RadioOption key={opt} name="fixedType" value={opt} label={opt} register={register} current={watch('fixedType') ?? ''} />
            ))}
          </div>
          {watch('fixedType') === 'Others' && (
            <input {...register('fixedTypeOther')} placeholder="Specify..." className={`mb-2 ${inputClassName()}`} />
          )}

          <p className="text-xs font-semibold text-secondary">Material</p>
          <div className="mb-2 space-y-1">
            {FIXED_MATERIALS.map((opt) => (
              <RadioOption key={opt} name="fixedMaterial" value={opt} label={opt} register={register} current={watch('fixedMaterial') ?? ''} />
            ))}
          </div>
          {watch('fixedMaterial') === 'Others' && (
            <input {...register('fixedMaterialOther')} placeholder="Specify..." className={`mb-2 ${inputClassName()}`} />
          )}

          <p className="text-xs font-semibold text-secondary">Margin Design</p>
          <div className="space-y-1">
            {MARGIN_OPTIONS.map((opt) => (
              <RadioOption key={opt} name="marginDesign" value={opt} label={opt} register={register} current={marginDesign ?? ''} />
            ))}
          </div>
          {marginDesign === 'Metal Lingual' && (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="number"
                min={0}
                step={0.1}
                {...register('marginMetalLingualMm')}
                className={`w-16 ${inputClassName()}`}
                aria-label="Metal lingual mm"
              />
              <span className="text-xs text-text-muted">mm</span>
            </div>
          )}
          {marginDesign === 'Others' && (
            <input {...register('marginOther')} placeholder="Specify..." className={`mt-1 ${inputClassName()}`} />
          )}
        </TreatmentColumn>

        <TreatmentColumn title="Removable Restoration">
          <div className="mb-2 flex gap-2">
            <span className="text-xs text-text-muted">Arch:</span>
            {(['upper', 'lower'] as const).map((arch) => (
              <label
                key={arch}
                className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-medium uppercase transition-colors duration-brand ${
                  watch('removableArch') === arch
                    ? 'border-secondary bg-secondary text-white'
                    : 'border-border text-text-muted'
                }`}
              >
                <input type="radio" value={arch} {...register('removableArch')} className="sr-only" />
                {arch === 'upper' ? 'U' : 'L'}
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            {REMOVABLE_TYPES.map((opt) => (
              <RadioOption key={opt} name="removableType" value={opt} label={opt} register={register} current={removableType ?? ''} />
            ))}
          </div>
          {removableType === 'Custom Tray' && (
            <div className="mt-2 flex gap-2">
              {(['with-hole', 'without-hole'] as const).map((h) => (
                <label key={h} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input type="radio" value={h} {...register('customTrayHole')} className="accent-secondary" />
                  {h === 'with-hole' ? 'With Hole' : 'Without Hole'}
                </label>
              ))}
            </div>
          )}
          {removableType === 'Others' && (
            <input {...register('removableOther')} placeholder="Specify..." className={`mt-1 ${inputClassName()}`} />
          )}

          <p className="mt-3 text-xs font-semibold text-secondary">Material</p>
          <div className="flex flex-wrap gap-1">
            {['Co.Cr', 'Vitallium 2000', 'Titanium', 'Valplast', 'Acrylic'].map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-1 text-xs">
                <input type="radio" value={m} {...register('removableMaterial')} className="accent-secondary" />
                {m}
              </label>
            ))}
          </div>

          <p className="mt-2 text-xs font-semibold text-secondary">Tissue Shade</p>
          <div className="flex flex-wrap gap-1">
            {['Pink', 'Light Pink', 'Meharry', 'Medium Meharry'].map((s) => (
              <label key={s} className="flex cursor-pointer items-center gap-1 text-xs">
                <input type="radio" value={s} {...register('tissueShade')} className="accent-secondary" />
                {s}
              </label>
            ))}
          </div>
        </TreatmentColumn>
      </div>
    </SectionCard>
  )
}
