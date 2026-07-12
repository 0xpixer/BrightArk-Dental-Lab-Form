'use client'

import { useCallback, useEffect, useState } from 'react'
import OrderForm from '@/components/OrderForm'
import { defaultFormValues, type OrderFormValues } from '@/types/orderForm'

const categoryByLabel: Record<string, OrderFormValues['treatmentCategory']> = { Orthodontics: 'orthodontics', Implant: 'implant', 'Fixed Restoration': 'fixed', 'Lab Services': 'additional', 'Removable Restoration': 'removable' }

export function EditOrderForm({ orderId }: { orderId: string }) {
  const [data, setData] = useState<{ values: OrderFormValues; files: Record<string, string> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => { const response = await fetch(`/api/portal/orders/${orderId}`); const payload = await response.json(); if (!response.ok) { setError(payload.error ?? 'Unable to load order'); return }; const order = payload.order; setData({ values: { ...defaultFormValues, dentist: order.dentist, clinic: order.clinic, email: order.email, address: order.address ?? '', patient: order.patientName, patientAge: order.patientAge ?? '', sex: order.sex?.toLowerCase() === 'female' ? 'female' : order.sex?.toLowerCase() === 'male' ? 'male' : '', treatmentCategory: categoryByLabel[order.treatmentType] ?? 'fixed', ...(order.treatmentData ?? {}), ...(order.toothSelection ?? {}), instructions: order.instructions ?? '', cloudDriveLink: order.cloudDriveLink ?? '' }, files: order.fileUrls ?? {} }) }, [orderId])
  useEffect(() => { load() }, [load])
  if (!data) return <p className="p-6 text-text-muted">{error ?? 'Loading order...'}</p>
  return <OrderForm orderId={orderId} initialValues={data.values} initialFileUrls={data.files} />
}
