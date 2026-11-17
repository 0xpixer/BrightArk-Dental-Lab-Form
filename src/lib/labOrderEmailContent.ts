import { ORDER_STATUS_LABELS } from '@/lib/orderStatus'

// Pure email content for Dental Lab orders (no database imports, unit tested).

export interface LabOrderEmailInput {
  id: number
  orderNo: string
  patientName: string
  clinic: string | null
  treatmentType: string | null
}

const STATUS_MESSAGES: Record<string, string> = {
  pending: 'The order is back in the queue and waiting to start.',
  lab_designing: 'The lab has started designing this case.',
  in_production: 'The case is now in production.',
  shipped: 'The case has been shipped and is on its way to the clinic.',
  delivered: 'The case has been delivered.',
  redo: 'The case has been marked for a re-do. The lab will follow up with details.',
  completed: 'The order is complete.',
  canceled: 'The order has been canceled.',
}

function details(order: LabOrderEmailInput) {
  return [
    `Order: ${order.orderNo}`,
    `Patient: ${order.patientName}`,
    order.clinic ? `Clinic: ${order.clinic}` : null,
    order.treatmentType ? `Treatment: ${order.treatmentType}` : null,
  ].filter(Boolean).join('\n')
}

export function labStatusEmail(order: LabOrderEmailInput, status: string, link: string | null) {
  const label = ORDER_STATUS_LABELS[status] ?? status
  return {
    subject: `Dental lab order ${order.orderNo} is now ${label}`,
    text: `${STATUS_MESSAGES[status] ?? `The order status changed to ${label}.`}\n\n${details(order)}${link ? `\n\nOpen order: ${link}` : ''}`,
  }
}

export function labNewOrderEmail(order: LabOrderEmailInput, doctorName: string | null, link: string | null) {
  return {
    subject: `New dental lab order — ${order.orderNo}`,
    text: `A new dental lab order was submitted${doctorName ? ` by ${doctorName}` : ''}.\n\n${details(order)}${link ? `\n\nOpen order: ${link}` : ''}`,
  }
}

/** Doctors and clinic staff open the portal; staff accounts open the dashboard. */
export function labOrderPath(role: string, orderId: number) {
  return role === 'doctor' || role === 'clinic_staff' ? `/portal/orders/${orderId}` : `/admin/submissions/${orderId}`
}
