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
  onTitleClick?: () => void
  embedded?: boolean
}

const CATEGORY_LABELS: Record<TreatmentCategory, string> = {
  orthodontics: 'Orthodontics',
  implant: 'Implant',
  fixed: 'Fixed Restoration',
  additional: 'Lab Services',
  removable: 'Removable Restoration',
}

const VISIBLE_TREATMENT_CATEGORIES: TreatmentCategory[] = [
  'fixed',
  ...TREATMENT_CATEGORIES.filter((cat) => cat !== 'fixed'),
]

const CATEGORY_FIELDS: Record<TreatmentCategory, (keyof OrderFormValues)[]> = {
  orthodontics: ['orthodontics', 'nightGuardType', 'orthodonticsOther', 'allergies', 'looseTooth', 'toothDecay'],
  implant: ['implantSeries', 'implantBrand', 'implantSystem', 'implantSize', 'implantType', 'implantOther'],
  fixed: [
    'fixedType', 'fixedSubDetail',
    'marginDesign', 'marginMetalLingualMm', 'marginOther',
    'ponticDesign', 'interproximal', 'occlusalContact', 'insufficientRoom', 'insufficientRoomSub',
  ],
  additional: ['additionalGroup', 'additionalProduct', 'additionalOther'],
  removable: ['removableArch', 'removableType', 'removableProduct', 'customTrayHole', 'removableOther', 'removableMaterial', 'tissueShade'],
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
  const selected = current === value

  return (
    <label
      className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-[6px] border px-2.5 py-2 text-xs leading-snug transition-colors duration-brand ${
        selected
          ? 'border-secondary bg-secondary/10 text-secondary'
          : 'border-border bg-surface text-text hover:border-primary/60'
      }`}
    >
      <input
        type="radio"
        value={value}
        {...register(name)}
        checked={selected}
        className="mt-0.5 accent-secondary"
      />
      <span>{label}</span>
    </label>
  )
}

function RadioGrid({
  name,
  options,
  register,
  current,
  columns = 'grid-cols-2 lg:grid-cols-3',
}: {
  name: keyof OrderFormValues
  options: string[]
  register: UseFormRegister<OrderFormValues>
  current: string
  columns?: string
}) {
  return (
    <div className={`grid gap-2 ${columns}`}>
      {options.map((opt) => (
        <RadioOption
          key={opt}
          name={name}
          value={opt}
          label={opt}
          register={register}
          current={current}
        />
      ))}
    </div>
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
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-[6px] border px-2.5 py-2 text-xs leading-snug transition-colors duration-brand ${
              current === opt.value
                ? 'border-secondary bg-secondary/10 text-secondary'
                : 'border-border bg-surface text-text hover:border-primary/60'
            }`}
          >
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
  'Hawley Retainer',
  'Snoring Guard(shark)',
  'Space Maintainer(Unilateral)',
  'Space Maintainer(Bilateral)',
  'Soft Night Guard',
  'Hard Night Guard',
  'Combo Night Guard(Soft inside/Hard outside)',
  'ImPak Soft Night Guard',
  'Nance retainer (exlude band)',
  'Lingual arch Fixed Maintainer',
  'Sport Guard (standard)',
  'Bleaching Tray',
  'Essix Retainer',
  'NTI',
  'Others',
]

const IMPLANT_OPTIONS = [
  'Cement Retained', 'Cemented by Lab', 'Screw Retained', 'Custom Abutment',
  'Ti-base Overdenture', 'Framework', 'Others',
]

const MARGIN_OPTIONS = [
  'Metal Lingual', '360° Metal', '3/4 Metal', 'Full Metal', '180° Porcelain', '360° Porcelain', 'Others',
]
const REMOVABLE_PRODUCT_GROUPS: Record<string, string[]> = {
  Frameworks: [
    'Cast CoCr Partial Framework',
    'Cast Vitallium Partial Framework',
    'Titanium Framework',
    'Cast CoCr Partial Framework Complete directly',
    'Cast Vitallium Partial Framework Complete directly',
    'Draw framework design',
  ],
  'Flexible Dentures': [
    'Valplast Partial Denture Complete directly(per arch)',
    'Valplast Full Denture Complete (per arch)',
    'Valplast Partial Only Finish',
    'Valplast Denture Only Finish',
    'Add Valplast Clasp',
    'Add Teeth to Valplast Partial/Denture',
    'Mixed color Acrylic Partial, Extra cost',
  ],
  'Acrylic Dentures': [
    'Acrylic Partial Denture Complete directly **',
    'Acrylic Full Denture Complete directly **',
    'Acrylic Partial Denture Only Finish',
    'Acrylic Full Denture Only Finish',
    'Add Teeth to Acrylic Partial ./Denture Finish',
    '1-4 Teeth Set up Try-in',
    '5-9 Teeth Set up Try-in',
    '10-14 Teeth Set up Try-in',
  ],
  'Removable Accessories': [
    'Individual Tray',
    'Bite Rim + Base Plate',
    'Add Wire Clasp',
    'Add Ball Clasp',
    'Add Cast Clasp',
    'Add Flexible / transparent clasp',
    'Add Metal Rest on Valplast Partial',
    'Add Metal rest for Denture',
    'Change denture teeth color',
    'Re-Base',
    'Soft reline',
    'Add Product Metal Mesh',
    'ID For Denture',
    'Premium Denture Teeth',
  ],
}

const ADDITIONAL_PRODUCT_GROUPS: Record<string, string[]> = {
  'Digital Design & Models': [
    'CAD/CAM Design for Crown',
    'CAD/CAM Design for Bridge',
    '3D Printing Digital Model(partial arch upper and lower)',
    '3D Printing Digital Model(full arch upper and lower)',
    'PMMA Temporary',
  ],
  'Fixed Restoration Services': [
    'Ivoclar- Composite Crown',
    'Ivoclar-Composite Inlay or Onlay',
    'Ivoclar-Composite fused to copping',
    'Change Shade PFM',
    'Change Shade Metal Free Crown',
    'Porcelain Butt Margin',
    'Gum Porcelain',
    'Metal Occlusal',
    'Metal Lingual',
    'Metal Reduction Coping',
    'Resin Reduction Coping',
    'Duralay Coping',
    'Opaque on Metal Post',
    'Opaque on Framework',
    'Solder Only',
    'Matrix',
  ],
  'General Lab Services': [
    "Dr's teeth-hand fee",
    'Crown & Bridge fit to partial',
    'Others',
  ],
}

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

export function TreatmentTypeSection({ register, watch, setValue, onTitleClick, embedded }: Props) {
  const category = watch('treatmentCategory') ?? ''
  const orthodontics = watch('orthodontics')
  const removableType = watch('removableType')
  const removableProduct = watch('removableProduct') ?? ''
  const removableArch = watch('removableArch') ?? ''
  const marginDesign = watch('marginDesign')
  const insufficientRoom = watch('insufficientRoom')
  const fixedType = watch('fixedType')
  const additionalGroup = watch('additionalGroup') ?? ''
  const additionalProduct = watch('additionalProduct') ?? ''

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

  const toggleRemovableArch = (arch: 'upper' | 'lower') => {
    const hasUpper = removableArch === 'upper' || removableArch === 'both'
    const hasLower = removableArch === 'lower' || removableArch === 'both'
    const nextUpper = arch === 'upper' ? !hasUpper : hasUpper
    const nextLower = arch === 'lower' ? !hasLower : hasLower

    setValue('removableArch', nextUpper && nextLower ? 'both' : nextUpper ? 'upper' : nextLower ? 'lower' : '')
  }

  return (
    <SectionCard title="Treatment Type" id="treatment-type" onTitleClick={onTitleClick} embedded={embedded}>
      <p className="mb-3 text-xs text-text-muted">
        Digital dental impressions only. Physical impressions are not accepted.
      </p>
      <div className="flex flex-wrap gap-1 rounded-card border border-border bg-bg p-1">
        {VISIBLE_TREATMENT_CATEGORIES.map((cat) => (
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

      <div className="mt-4 min-h-[60px]">
        {!category && (
          <p className="py-8 text-center text-sm text-text-muted">
            Select a treatment type to continue
          </p>
        )}

        {category === 'orthodontics' && (
          <div key="orthodontics" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <RadioGrid
              name="orthodontics"
              options={ORTHO_OPTIONS}
              register={register}
              current={orthodontics ?? ''}
            />
            {orthodontics === 'Night Guard' && (
              <div className="rounded border border-border bg-surface p-2">
                <p className="mb-1 text-xs font-medium text-text-muted">Night Guard Type</p>
                <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                  {(['soft', 'hard'] as const).map((t) => (
                    <label key={t} className="flex cursor-pointer items-center gap-1 rounded-[6px] border border-border px-2.5 py-2 text-xs capitalize">
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
            <label className="block">
              <span className="text-xs font-semibold text-secondary">Implant Series</span>
              <select
                {...register('implantSeries')}
                className={`mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary`}
              >
                <option value="">-- Select Implant Series --</option>
                <optgroup label="Implant Crowns & Dentures">
                  {[
                    'Layered Zirconia Crown over Implant (Ti-base+100$/unit)',
                    'Full Coutour Zirconia Crown over Implant (Ti-base+100$/unit)',
                    'PFM Non-precious Crown over Implant',
                    'PFM Noble&High Noble Crown over Implant *',
                    'All-on-4 Zirconia Denture(tibase 25/unit)',
                    'PFM Non-precious Crown over Implant Metal Try-in',
                    'PFM Noble&High Noble Crown over Implant Metal Try-in *',
                    'PFM Non-precious Crown over Implant Porcelain Finish',
                    'PFM Noble&High Noble Crown over Implant Porcelain Finish',
                  ].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </optgroup>
                <optgroup label="Abutments & Components">
                  {[
                    'Analog',
                    'Casted Plastic Sleeve Abutment(including screw)',
                    'CAD/CAM Pure Titanium Custom Abutment(including screw)',
                    'CAD/CAM Zirconia Custom Abutment(including screw) zirconia abutment on ti base',
                    'ERA Attachment',
                    'Attached (parts enclosed, technician fee)',
                    'Locator (parts enclosed, technician fee)',
                    'Locator Cap',
                    'Locator Abutment',
                    'locator Analog',
                    'Cast Implant Abutment Technician Fee',
                    'Surgical Stent',
                    'Implant Technician Fee',
                  ].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </optgroup>
                <optgroup label="Bars & Attachments">
                  {[
                    'Custom Implant Bar (Titanium / N.P.) 1--6 Abutments',
                    'Custom Implant Bar (Titanium / N.P.) 7--14 Abutments',
                    'Titanium Implant Bar ^^',
                    'Chrome Cobalt Implant Bar ^^',
                    'COCR IMPLANT BAR 3-6 elements',
                    'Extra Element for COCR IMPLANT BAR',
                    'Telescopic Crown-Co-Cr(inner&outer crown+composite)',
                    'Key & Key Way',
                    'Artificial Gum Fee',
                  ].map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </optgroup>
              </select>
            </label>

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
            <RadioGrid
              name="implantType"
              options={IMPLANT_OPTIONS}
              register={register}
              current={watch('implantType') ?? ''}
            />
            {watch('implantType') === 'Others' && (
              <input placeholder="Specify..." {...register('implantOther')} className={inputClassName()} />
            )}
          </div>
        )}

        {category === 'fixed' && (
          <div key="fixed" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <label className="block">
              <span className="text-xs font-semibold text-secondary">Type</span>
              <select
                {...register('fixedType')}
                className={`mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary`}
                onChange={(e) => {
                  setValue('fixedType', e.target.value)
                  setValue('fixedSubDetail', '') // reset child selection
                }}
              >
                <option value="">-- Select Type --</option>
                <option value="All Ceramic">All Ceramic</option>
                <option value="PFM">PFM</option>
                <option value="Full Metal">Full Metal</option>
              </select>
            </label>

            {fixedType === 'All Ceramic' && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">All Ceramic Sub-Detail</span>
                  <select
                    {...register('fixedSubDetail')}
                    className={`mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary`}
                  >
                    <option value="">-- Select Sub-Detail --</option>
                    {[
                      'Full/Solid E.max crown',
                      'Layered Zirconia Crown/Bridge',
                      'Full Coutour / Solid Zirconia Crown',
                      'Emax Press Porcelain Crown',
                      'Emax Veneer/Inlay/Onlay',
                      'E.max Wing',
                      'E.max post&core',
                      'Over 6-unit Zirconia Bridge',
                      'Full Coutour Zirconia/Solid Crown(self-designed)',
                      'Full Coutour Emax/Solid Crown(self-designed)',
                      'Noritake Katana UTML Zirconia Crown (<3 units)',
                      'Ivoclar EmaxCAD',
                      'Modelless Full Contour Zirconia',
                      'Porcelain Build-up Only',
                      'Zirconia-Coping Only',
                      'Zirconia Wing',
                      'Zirconia Post Core',
                    ].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {fixedType === 'PFM' && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">PFM Sub-Detail</span>
                  <select
                    {...register('fixedSubDetail')}
                    className={`mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary`}
                  >
                    <option value="">-- Select Sub-Detail --</option>
                    {[
                      'PFM Non-precious (Argen Cr. Co)',
                      'PFM Semi-precious(Argen) *',
                      'Porcelain to White Precious-40% *',
                      'Porcelain to Yellow Precious-74% *',
                      'Maryland Bridge Non-precious',
                      'Maryland Bridge Noble&High Noble *',
                      'Additional Non-precious Wing',
                      'PFM Non-precious&Post Core one piece',
                      'Noble PFM&Post Core one piece *',
                      'PFM Non-precious Metal Try-in (apply porcelain later)',
                      'PFM Semi-precious Metal Try-in (Argen) *',
                      'PFM Noble&High Noble Metal Try-in(Argen) *',
                      'Apply Porcelain Only (metal coping made by factory)',
                      'Apply Porcelain Only (NO metal coping)',
                    ].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs italic text-primary/80 mt-1">
                  *Porcelain Alloy Additional: Weight+15%
                </p>
              </div>
            )}

            {fixedType === 'Full Metal' && (
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-text-muted">Full Metal Sub-Detail</span>
                  <select
                    {...register('fixedSubDetail')}
                    className={`mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary`}
                  >
                    <option value="">-- Select Sub-Detail --</option>
                    {[
                      'Full Cast Non-precious (Argen Cr. Co)',
                      'Full Cast Semi-precious(Argen) *',
                      'Full Yellow Gold Crown/Inlay/Onlay-Y+ *',
                      'Full Yellow Gold Crown/Inlay/Onlay-20% *',
                      'Full Yellow Gold Crown/Inlay/Onlay-52% *',
                      'NP Inlay/Onlay/Post',
                      'Noble&High Noble Inlay/Onlay/Post *',
                      'Titanium post',
                      'Metal Post & Core with key',
                      'Gold plated',
                      'Metal Rest',
                      'NPG(No gold) Crown/Inlay/Onlay',
                      'NPG+2 (2% AU) Crown/Inlay/Onlay',
                    ].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <p className="text-xs italic text-primary/80 mt-1">
                  *Metal Alloy Additional: Weight+15%. Alloy charged by per gram, cost per crown depends on the weight
                </p>
              </div>
            )}

            {fixedType === 'PFM' && (
              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold text-secondary">Margin Design</p>
                <div className="mt-2">
                  <RadioGrid
                    name="marginDesign"
                    options={MARGIN_OPTIONS}
                    register={register}
                    current={marginDesign ?? ''}
                  />
                </div>
                {marginDesign === 'Metal Lingual' && (
                  <div className="mt-2 flex items-center gap-1">
                    <input type="number" min={0} step={0.1} {...register('marginMetalLingualMm')} className={`w-16 ${inputClassName()}`} aria-label="Metal lingual mm" />
                    <span className="text-xs text-text-muted">mm</span>
                  </div>
                )}
                {marginDesign === 'Others' && (
                  <input {...register('marginOther')} placeholder="Specify..." className={`mt-2 ${inputClassName()}`} />
                )}
              </div>
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
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {[
                  'Metal Island', 'Adjust Opposing & Mark', 'Adjust Prep & Mark Die',
                  'Metal Occlusal', 'Adjust Prep & Reduction Coping',
                ].map((opt) => (
                  <label
                    key={opt}
                    className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-[6px] border px-2.5 py-2 text-xs leading-snug transition-colors duration-brand ${
                      insufficientRoom === opt
                        ? 'border-secondary bg-secondary/10 text-secondary'
                        : 'border-border bg-surface text-text hover:border-primary/60'
                    }`}
                  >
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

        {category === 'additional' && (
          <div key="additional" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <label className="block">
              <span className="text-xs font-semibold text-secondary">Product Group</span>
              <select
                {...register('additionalGroup')}
                className="mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                onChange={(e) => {
                  setValue('additionalGroup', e.target.value)
                  setValue('additionalProduct', '')
                  setValue('additionalOther', '')
                }}
              >
                <option value="">-- Select Product Group --</option>
                {Object.keys(ADDITIONAL_PRODUCT_GROUPS).map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>

            {additionalGroup && (
              <label className="block">
                <span className="text-xs font-medium text-text-muted">Product</span>
                <select
                  {...register('additionalProduct')}
                  className="mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">-- Select Product --</option>
                  {ADDITIONAL_PRODUCT_GROUPS[additionalGroup]?.map((product) => (
                    <option key={product} value={product}>{product}</option>
                  ))}
                </select>
              </label>
            )}

            {additionalProduct === 'Others' && (
              <input
                placeholder="Specify product..."
                {...register('additionalOther')}
                className={inputClassName()}
              />
            )}

            <p className="text-xs text-text-muted">
              Use this section for digital design, fixed-restoration services, and general lab work.
            </p>
          </div>
        )}

        {category === 'removable' && (
          <div key="removable" className="panel-fade-in space-y-3 rounded-card border border-border bg-bg p-4">
            <label className="block">
              <span className="text-xs font-semibold text-secondary">Product Group</span>
              <select
                {...register('removableType')}
                className="mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                onChange={(e) => {
                  setValue('removableType', e.target.value)
                  setValue('removableProduct', '')
                  setValue('removableOther', '')
                }}
              >
                <option value="">-- Select Product Group --</option>
                {Object.keys(REMOVABLE_PRODUCT_GROUPS).map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
            </label>
            {removableType && (
              <label className="block">
                <span className="text-xs font-medium text-text-muted">Product</span>
                <select {...register('removableProduct')} className="mt-1 w-full rounded border border-border px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="">-- Select Product --</option>
                  {REMOVABLE_PRODUCT_GROUPS[removableType]?.map((product) => (
                    <option key={product} value={product}>{product}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex gap-2">
              <span className="text-xs text-text-muted">Arch:</span>
              {(['upper', 'lower'] as const).map((arch) => {
                const checked = arch === 'upper'
                  ? removableArch === 'upper' || removableArch === 'both'
                  : removableArch === 'lower' || removableArch === 'both'
                return (
                <label key={arch} className={`cursor-pointer rounded border px-2 py-0.5 text-xs font-medium uppercase transition-colors duration-brand ${checked ? 'border-secondary bg-secondary text-white' : 'border-border text-text-muted'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleRemovableArch(arch)} className="sr-only" />
                  {arch === 'upper' ? 'U' : 'L'}
                </label>
                )
              })}
            </div>
            {removableProduct === 'Others' && (
              <input {...register('removableOther')} placeholder="Specify..." className={inputClassName()} />
            )}
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
