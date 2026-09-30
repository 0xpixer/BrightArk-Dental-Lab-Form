import { BadgeCheck } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

interface SuccessCardProps {
  orderNo: string
}

export function SuccessCard({ orderNo }: SuccessCardProps) {
  return (
    <div
      role="status"
      className="rounded-card border border-green-200 bg-green-50 p-6 text-center"
    >
      <MorphIcon icon={BadgeCheck} wrapperClassName="mx-auto mb-3" className="h-12 w-12 text-green-600" />
      <h2 className="text-lg font-semibold text-green-800">Order submitted successfully!</h2>
      <p className="mt-2 text-sm text-green-700">
        BrightArk will review and confirm your order shortly.
        <br />
        <span className="font-medium">Reference: {orderNo}</span>
      </p>
    </div>
  )
}
