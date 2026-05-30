import { useCallback } from 'react'
import type { UseFormRegister, UseFormWatch, UseFormSetValue } from 'react-hook-form'
import type { OrderFormValues, TreatmentCategory } from '../types/orderForm'
import { defaultFormValues, TREATMENT_CATEGORIES } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { YesNoToggle } from './ui/YesNoToggle'
import { inputClassName } from './ui/FormField'

interface Props {
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
}

const CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  orthodontics: 'Orthodontics',
  implant: 'Implant',
  fixed: 'Fixed Restoration',
  removable: 'Removable Restoration',
}

const CATEGORY_FIELDS: Record<TreatmentCategory, (keyof OrderFormValues)[]> = {
  orthodontics: ['orthodontics', 'nightGuardType', 'orthodonticsOther', 'allergies', 'looseTooth', 'toothDecay'],
  implant: ['implantBrand', 'implantSystem', 'implantSize', 'implantType', 'implantOther'],
  fixed: [
    'fixedType', 'fixedTypeOther', 'fixedMaterial', 'fixedMaterialOther',
    'marginDesign', 'marginMetalLingualMm', 'marginOther',
    'ponticDesign', 'interproximal', 'occlusalContact', 'insufficientRoom', 'insufficientRoomSub',
  ],
  removable: ['removableArch', 'removableType', 'customTrayHole', 'removableOther', 'removableMaterial', 'tissueShade'],
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

function OptionGroup({
  title,
  name,
  options,
  register,
  current,
}: {
  title: string
  name: keyof OrderFormValues
  options: { value: string; label: string }[]
  register: UseFormRegister<OrderFormValues>
  current: string
}) {
  return (
    <div className="border-t border-border pt-4">
      <h3 className="mb-2 text-xs font-semibold text-secondary">{title}</h3>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt.value} className="flex cursor-pointer items-start gap-2 text-xs">
            <input
              type="radio"
              value={opt.value}
              {...register(name)}
              checked={current === opt.value}
              className="mt-0.5 accent-secondary"
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const ORTHO_OPTIONS = [
  'Clear Aligner', 'Essix Retainer', 'Hawley Retainer', 'Space Maintainer',
  'Frankle', 'Palatal Expander', 'Sports Guard', 'Night Guard', 'Snore Guard', 'Others',
]

const IMPLANT_OPTIONS = [
  'Cement Retained', 'Cemented by Lab', 'Screw Retained', 'Custom Abutment',
  'Ti-base Overdenture', 'Framework', 'Others',
]

const FIXED_TYPES = ['Crown', 'Veneer', 'Inlay/Onlay', 'Post-core', 'Maryland Bridge', 'Others']
const FIXED_MATERIALS = [
  'PFM', 'Full Metal', 'Zirconia Full Contour', 'Zirconia with Layered',
  'E-max', 'E-max with Layered', 'Others',
]
const MARGIN_OPTIONS = [
  'Metal Lingual', '360° Metal', '3/4 Metal', 'Full Metal', '180° Porcelain', '360° Porcelain', 'Others',
]
const REMOVABLE_TYPES = [
  'Custom Tray', 'Bite Block', 'Framework', 'Teeth Set up Try in', 'Re-try', 'Finish', 'Others',
]

function categoryHasValues(values: OrderFormValues, category: TreatmentCategory): boolean {
  return CATEGORY_FIELDS[category].some((field) => {
    const val = values[field]
    if (typeof val === 'boolean') return val
    if (Array.isArray(val)) return val.length > 0
    return val !== '' && val !== undefined
  })
}

function clearCategoryFields(
  category: TreatmentCategory,
  setValue: UseFormSetValue<OrderFormValues>,
) {
  CATEGORY_FIELDS[category].forEach((field) => {
    setValue(field, defaultFormValues[field] as never)
  })
}

export function TreatmentTypeSection({ register, watch, setValue }: Props) {
  const category = watch('treatmentCategory') ?? ''
  const orthodontics = watch('orthodontics')
  const removableType = watch('removableType')
  const marginDesign = watch('marginDesign')
  const insufficientRoom = watch('insufficientRoom')

  const handleCategoryChange = useCallback(
    (next: TreatmentCategory) => {
      const current = category as TreatmentCategory | ''
      if (current && current !== next && categoryHasValues(watch(), current)) {
        if (!confirm('Switching treatment type will clear your current selections. Continue?')) return
        clearCategoryFields(current, setValue)
      }
      setValue('treatmentCategory', next)
    },
    [category, watch, setValue],
  )

  return (
    <SectionCard title="Treatment Type" id="treatment-type">
      <fieldset>
        <legend className="mb-2 text-xs font-medium text-text">Treatment Type</legend>
        <div className="flex flex-wrap gap-1 rounded-card border border-border bg-bg p-1">
          {TREATMENT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`rounded-[6px] px-3 py-2 text-xs font-medium transition-colors duration-brand ease-in-out ${
                category === cat
                  ? 'bg-secondary text-white shadow-sm'
                  : 'text-text-muted hover:bg-white hover:text-text'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 min-h-[60px]">
        {!category && (
          <p className="py-8 text-center text-sm text-text-muted">
            Select a treatment type to continue
          </p>
        )}

        {category === 'orthodontics' && (
          <div key="orthodontics" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <div className="space-y-1.5">
              {ORTHO_OPTIONS.map((opt) => (
                <RadioOption key={opt} name="orthodontics" value={opt} label={opt} register={register} current={orthodontics ?? ''} />
              ))}
            </div>
            {orthodontics === 'Night Guard' && (
              <div className="rounded border border-border bg-surface p-2">
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
              <input placeholder="Specify..." {...register('orthodonticsOther')} className={inputClassName()} />
            )}
            <div className="space-y-2 border-t border-border pt-3">
              <YesNoToggle name="allergies" label="Allergies?" value={watch('allergies') ?? ''} onChange={(v) => setValue('allergies', v)} />
              <YesNoToggle name="looseTooth" label="Loose Tooth?" value={watch('looseTooth') ?? ''} onChange={(v) => setValue('looseTooth', v)} />
              <YesNoToggle name="toothDecay" label="Tooth Decay?" value={watch('toothDecay') ?? ''} onChange={(v) => setValue('toothDecay', v)} />
            </div>
          </div>
        )}

        {category === 'implant' && (
          <div key="implant" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
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
            <div className="space-y-1.5">
              {IMPLANT_OPTIONS.map((opt) => (
                <RadioOption key={opt} name="implantType" value={opt} label={opt} register={register} current={watch('implantType') ?? ''} />
              ))}
            </div>
            {watch('implantType') === 'Others' && (
              <input placeholder="Specify..." {...register('implantOther')} className={inputClassName()} />
            )}
          </div>
        )}

        {category === 'fixed' && (
          <div key="fixed" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <p className="text-xs font-semibold text-secondary">Type</p>
            <div className="space-y-1">
              {FIXED_TYPES.map((opt) => (
                <RadioOption key={opt} name="fixedType" value={opt} label={opt} register={register} current={watch('fixedType') ?? ''} />
              ))}
            </div>
            {watch('fixedType') === 'Others' && (
              <input {...register('fixedTypeOther')} placeholder="Specify..." className={inputClassName()} />
            )}

            <p className="text-xs font-semibold text-secondary">Material</p>
            <div className="space-y-1">
              {FIXED_MATERIALS.map((opt) => (
                <RadioOption key={opt} name="fixedMaterial" value={opt} label={opt} register={register} current={watch('fixedMaterial') ?? ''} />
              ))}
            </div>
            {watch('fixedMaterial') === 'Others' && (
              <input {...register('fixedMaterialOther')} placeholder="Specify..." className={inputClassName()} />
            )}

            <p className="text-xs font-semibold text-secondary">Margin Design</p>
            <div className="space-y-1">
              {MARGIN_OPTIONS.map((opt) => (
                <RadioOption key={opt} name="marginDesign" value={opt} label={opt} register={register} current={marginDesign ?? ''} />
              ))}
            </div>
            {marginDesign === 'Metal Lingual' && (
              <div className="flex items-center gap-1">
                <input type="number" min={0} step={0.1} {...register('marginMetalLingualMm')} className={`w-16 ${inputClassName()}`} aria-label="Metal lingual mm" />
                <span className="text-xs text-text-muted">mm</span>
              </div>
            )}
            {marginDesign === 'Others' && (
              <input {...register('marginOther')} placeholder="Specify..." className={inputClassName()} />
            )}

            <OptionGroup
              title="Pontic Design"
              name="ponticDesign"
              current={watch('ponticDesign') ?? ''}
              register={register}
              options={[
                { value: 'Full Ridge', label: 'Full Ridge' },
                { value: 'Partial Ridge', label: 'Partial Ridge' },
                { value: 'Point Contact', label: 'Point Contact' },
                { value: 'No Contact', label: 'No Contact' },
              ]}
            />
            <OptionGroup
              title="Interproximal"
              name="interproximal"
              current={watch('interproximal') ?? ''}
              register={register}
              options={[
                { value: 'Light', label: 'Light' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Heavy', label: 'Heavy' },
              ]}
            />
            <OptionGroup
              title="Occlusal Contact"
              name="occlusalContact"
              current={watch('occlusalContact') ?? ''}
              register={register}
              options={[
                { value: 'Out (0.5mm)', label: 'Out (0.5mm)' },
                { value: 'Light (0.3mm)', label: 'Light (0.3mm)' },
                { value: 'Full (touch opp.)', label: 'Full (touch opp.)' },
              ]}
            />
            <div className="border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold text-secondary">If Insufficient Room</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  'Metal Island', 'Adjust Opposing & Mark', 'Adjust Prep & Mark Die',
                  'Metal Occlusal', 'Adjust Prep & Reduction Coping',
                ].map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-start gap-2 text-xs">
                    <input type="radio" value={opt} {...register('insufficientRoom')} checked={insufficientRoom === opt} className="mt-0.5 accent-secondary" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              {insufficientRoom === 'Adjust Prep & Reduction Coping' && (
                <div className="mt-3 flex gap-4 rounded border border-border bg-surface p-3">
                  <span className="text-xs text-text-muted">Sub-type:</span>
                  {(['resin', 'metal'] as const).map((sub) => (
                    <label key={sub} className="flex cursor-pointer items-center gap-1 text-xs capitalize">
                      <input type="radio" value={sub} {...register('insufficientRoomSub')} className="accent-secondary" />
                      {sub}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {category === 'removable' && (
          <div key="removable" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <div className="flex gap-2">
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
              <div className="flex gap-2">
                {(['with-hole', 'without-hole'] as const).map((h) => (
                  <label key={h} className="flex cursor-pointer items-center gap-1 text-xs">
                    <input type="radio" value={h} {...register('customTrayHole')} className="accent-secondary" />
                    {h === 'with-hole' ? 'With Hole' : 'Without Hole'}
                  </label>
                ))}
              </div>
            )}
            {removableType === 'Others' && (
              <input {...register('removableOther')} placeholder="Specify..." className={inputClassName()} />
            )}
            <p className="text-xs font-semibold text-secondary">Material</p>
            <div className="flex flex-wrap gap-2">
              {['Co.Cr', 'Vitallium 2000', 'Titanium', 'Valplast', 'Acrylic'].map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input type="radio" value={m} {...register('removableMaterial')} className="accent-secondary" />
                  {m}
                </label>
              ))}
            </div>
            <p className="text-xs font-semibold text-secondary">Tissue Shade</p>
            <div className="flex flex-wrap gap-2">
              {['Pink', 'Light Pink', 'Meharry', 'Medium Meharry'].map((s) => (
                <label key={s} className="flex cursor-pointer items-center gap-1 text-xs">
                  <input type="radio" value={s} {...register('tissueShade')} className="accent-secondary" />
                  {s}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}
