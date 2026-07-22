'use client'

import { useCallback, useEffect, useState } from 'react'
import OrderForm from '@/components/OrderForm'
import { defaultFormValues, type OrderFormValues } from '@/types/orderForm'

export function EditDraftForm({ draftId }: { draftId: string }) {
  const [data, setData] = useState<{ values: OrderFormValues; files: Record<string, string> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch(`/api/portal/drafts/${draftId}`)
    const payload = await response.json()
    if (!response.ok) {
      setError(payload.error ?? 'Unable to load draft')
      return
    }

    setData({
      values: { ...defaultFormValues, ...(payload.draft.formData ?? {}) },
      files: payload.draft.fileUrls ?? {},
    })
  }, [draftId])

  useEffect(() => { load() }, [load])

  if (!data) return <p className="p-6 text-text-muted">{error ?? 'Loading draft...'}</p>
  return <OrderForm draftId={draftId} initialValues={data.values} initialFileUrls={data.files} />
}
