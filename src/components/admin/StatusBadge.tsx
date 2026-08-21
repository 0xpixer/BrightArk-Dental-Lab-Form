import { ORDER_STATUS_LABELS } from '@/lib/orderStatus'

const STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  lab_designing: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  in_production: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-violet-100 text-violet-800 border-violet-200',
  delivered: 'bg-teal-100 text-teal-800 border-teal-200',
  redo: 'bg-pink-100 text-pink-800 border-pink-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(' ', '_')
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[key] ?? 'bg-gray-100 text-gray-700'}`}
    >
      ● {ORDER_STATUS_LABELS[key] ?? status}
    </span>
  )
}
