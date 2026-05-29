import { useCallback } from 'react'
import type { OrderFormValues } from '../types/orderForm'
import { DRAFT_STORAGE_KEY } from '../types/orderForm'

export function useFormDraft() {
  const saveDraft = useCallback((values: OrderFormValues) => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values))
      return true
    } catch {
      return false
    }
  }, [])

  const loadDraft = useCallback((): OrderFormValues | null => {
    try {
      const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as OrderFormValues
    } catch {
      return null
    }
  }, [])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY)
  }, [])

  return { saveDraft, loadDraft, clearDraft }
}
