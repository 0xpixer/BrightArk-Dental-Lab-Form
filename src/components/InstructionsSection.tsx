import type { UseFormRegister, UseFormWatch } from 'react-hook-form'
import type { OrderFormValues } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'

interface Props {
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  onTitleClick?: () => void
  embedded?: boolean
}

const MAX_CHARS = 2000

export function InstructionsSection({ register, watch, onTitleClick, embedded }: Props) {
  const text = watch('instructions') ?? ''
  const count = text.length

  return (
    <SectionCard title="Instructions" id="instructions" onTitleClick={onTitleClick} embedded={embedded}>
      <div className="relative">
        <label htmlFor="instructions" className="sr-only">
          Special instructions
        </label>
        <textarea
          id="instructions"
          rows={4}
          maxLength={MAX_CHARS}
          placeholder="Add any special instructions, notes, or clinical details here..."
          {...register('instructions')}
          className="w-full resize-y rounded-card border border-border bg-grey-input px-3 py-2 text-sm text-text outline-none transition-[border-color,box-shadow] duration-brand ease-in-out focus:border-secondary focus:ring-2 focus:ring-secondary/20"
        />
        <span className="absolute bottom-2 right-3 text-xs text-text-muted" aria-live="polite">
          {count}/{MAX_CHARS}
        </span>
      </div>
    </SectionCard>
  )
}
