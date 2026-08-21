export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'lab_designing', label: 'Lab Designing' },
  { value: 'in_production', label: 'In Production' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'redo', label: 'Re-Do' },
  { value: 'completed', label: 'Completed' },
] as const

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value']

export const ORDER_STATUS_VALUES = new Set<string>(ORDER_STATUS_OPTIONS.map((option) => option.value))
export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

export const ORDER_STATUS_DUE_MS = 3 * 24 * 60 * 60 * 1000

export function isOrderStatusOverdue(status: string, statusUpdatedAt: string | Date, now = new Date()): boolean {
  if (status === 'completed') return false
  const updatedAt = new Date(statusUpdatedAt)
  if (Number.isNaN(updatedAt.getTime())) return false
  return now.getTime() - updatedAt.getTime() >= ORDER_STATUS_DUE_MS
}
