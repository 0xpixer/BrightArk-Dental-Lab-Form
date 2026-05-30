const STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  complete: 'bg-green-100 text-green-800 border-green-200',
}

const LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  complete: 'Complete',
}

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(' ', '_')
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[key] ?? 'bg-gray-100 text-gray-700'}`}
    >
      ● {LABELS[key] ?? status}
    </span>
  )
}
