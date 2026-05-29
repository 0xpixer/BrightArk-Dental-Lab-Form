import { CheckCircle2 } from 'lucide-react'

interface SuccessCardProps {
  orderNo: string
}

export function SuccessCard({ orderNo }: SuccessCardProps) {
  return (
    <div
      role="status"
      className="rounded-card border border-green-200 bg-green-50 p-6 text-center shadow-sm"
    >
      <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-600" aria-hidden />
      <h2 className="text-lg font-semibold text-green-800">Order submitted successfully!</h2>
      <p className="mt-2 text-sm text-green-700">
        BrightArk will review and confirm your order shortly.
        <br />
        <span className="font-medium">Reference: {orderNo}</span>
      </p>
    </div>
  )
}
