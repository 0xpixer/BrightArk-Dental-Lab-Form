import { ORDER_STATUS_LABELS, ORDER_STATUS_STYLES } from '@/lib/orderStatus'

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(' ', '_')
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_STYLES[key] ?? 'border-gray-200 bg-gray-100 text-gray-700'}`}
    >
      ● {ORDER_STATUS_LABELS[key] ?? status}
    </span>
  )
}
