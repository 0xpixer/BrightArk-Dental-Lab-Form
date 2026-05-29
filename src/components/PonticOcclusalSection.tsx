import type { UseFormRegister, UseFormWatch } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'

interface Props {
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
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
    <div>
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

export function PonticOcclusalSection({ register, watch }: Props) {
  const insufficientRoom = watch('insufficientRoom')

  return (
    <SectionCard title="Pontic, Interproximal & Occlusal" id="pontic-occlusal">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
      </div>

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="mb-2 text-xs font-semibold text-secondary">If Insufficient Room</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            'Metal Island',
            'Adjust Opposing & Mark',
            'Adjust Prep & Mark Die',
            'Metal Occlusal',
            'Adjust Prep & Reduction Coping',
          ].map((opt) => (
            <label key={opt} className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="radio"
                value={opt}
                {...register('insufficientRoom')}
                checked={insufficientRoom === opt}
                className="mt-0.5 accent-secondary"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {insufficientRoom === 'Adjust Prep & Reduction Coping' && (
          <div className="mt-3 flex gap-4 rounded border border-border bg-bg p-3">
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
    </SectionCard>
  )
}
