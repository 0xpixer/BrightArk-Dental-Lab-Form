import { Clock3 } from 'lucide-react'
import { ORDER_STATUS_LABELS } from '@/lib/orderStatus'
import type { OrderActivityItem } from '@/lib/orderActivity'

export function OrderActivityHistory({ activities }: { activities: OrderActivityItem[] }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-secondary">Status & Notes History</h2>
      {activities.length === 0 ? (
        <p className="text-sm text-text-muted">No history recorded yet.</p>
      ) : (
        <ol className="space-y-3">
          {activities.map((activity) => (
            <li key={activity.id} className="grid grid-cols-[18px_1fr] gap-2 text-sm">
              <Clock3 className="mt-0.5 h-4 w-4 text-text-muted" aria-hidden />
              <div className="min-w-0">
                <p className="text-text">
                  <time className="font-medium tabular-nums">{formatActivityDate(activity.createdAt)}</time>
                  {' · '}
                  {activity.eventType === 'status' ? ORDER_STATUS_LABELS[activity.detail] ?? activity.detail : activity.detail}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{activity.eventType === 'status' ? 'Status updated' : 'Note added'} by {activity.actorName}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function formatActivityDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
