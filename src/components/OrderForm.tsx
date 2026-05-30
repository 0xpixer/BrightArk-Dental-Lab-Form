'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormHeader } from '@/components/FormHeader'
import { ProgressBar } from '@/components/ProgressBar'
import { OrderInfoSection } from '@/components/OrderInfoSection'
import { TreatmentTypeSection } from '@/components/TreatmentTypeSection'
import { ToothSelectorSection } from '@/components/ToothSelectorSection'
import { InstructionsSection } from '@/components/InstructionsSection'
import { FileUploadSection, type FilesState } from '@/components/FileUploadSection'
import { SubmitSection } from '@/components/SubmitSection'
import { SuccessCard } from '@/components/SuccessCard'
import { FormFooter } from '@/components/FormFooter'
import { useFormDraft } from '@/hooks/useFormDraft'
import { orderFormSchema, defaultFormValues, generateOrderNo, type OrderFormValues } from '@/types/orderForm'

export default function OrderForm() {
  const [sessionOrderNo] = useState(() => generateOrderNo())
  const [files, setFiles] = useState<FilesState>({})
  const [fileErrors, setFileErrors] = useState<{ upperModel?: string; lowerModel?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedOrderNo, setSubmittedOrderNo] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)

  const { saveDraft, loadDraft, clearDraft } = useFormDraft()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultFormValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    const draft = loadDraft()
    if (draft) reset(draft)
  }, [loadDraft, reset])

  useEffect(() => {
    const sections = [
      { id: 'order-info', step: 1 as const },
      { id: 'treatment-type', step: 2 as const },
      { id: 'tooth-selector', step: 2 as const },
      { id: 'instructions', step: 2 as const },
      { id: 'file-upload', step: 3 as const },
    ]

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0))
        if (visible[0]) {
          const match = sections.find((s) => s.id === visible[0].target.id)
          if (match) setActiveStep(match.step)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0.1 },
    )

    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  const validateFiles = useCallback(() => {
    const next: typeof fileErrors = {}
    const upper = files['upper-model']
    const lower = files['lower-model']
    if (!upper || upper.status !== 'success' || !upper.blobUrl) {
      next.upperModel = 'Upper Model is required'
    }
    if (!lower || lower.status !== 'success' || !lower.blobUrl) {
      next.lowerModel = 'Lower Model is required'
    }
    setFileErrors(next)
    return !next.upperModel && !next.lowerModel
  }, [files])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    const filesValid = validateFiles()
    if (!filesValid) {
      document.getElementById('file-upload')?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    const file_urls = Object.fromEntries(
      Object.entries(files)
        .filter(([, data]) => data?.blobUrl)
        .map(([slotId, data]) => [slotId, data!.blobUrl!]),
    )

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          orderNo: sessionOrderNo,
          file_urls,
        }),
      })

      const data = (await res.json()) as { success: boolean; orderNo?: string; error?: string }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to submit order')
      }

      setSubmittedOrderNo(data.orderNo ?? sessionOrderNo)
      setSubmitted(true)
      clearDraft()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit order')
    } finally {
      setIsSubmitting(false)
    }
  })

  const handleSaveDraft = useCallback(() => {
    const values = watch()
    saveDraft(values)
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2500)
  }, [watch, saveDraft])

  const handleReset = useCallback(() => {
    if (!confirm('Reset the entire form? This cannot be undone.')) return
    reset(defaultFormValues)
    setFiles({})
    setFileErrors({})
    setSubmitted(false)
    setSubmitError(null)
    clearDraft()
  }, [reset, clearDraft])

  const formProps = useMemo(
    () => ({ register, control, errors, watch, setValue }),
    [register, control, errors, watch, setValue],
  )

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg">
        <FormHeader />
        <main className="mx-auto max-w-form px-4 py-8 md:px-6">
          <SuccessCard orderNo={submittedOrderNo} />
          <button
            type="button"
            onClick={() => {
              setSubmitted(false)
              reset(defaultFormValues)
              setFiles({})
              setSubmitError(null)
            }}
            className="mt-6 w-full rounded-card border border-border py-2 text-sm text-text-muted transition-colors hover:text-text"
          >
            Submit another order
          </button>
        </main>
        <FormFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <FormHeader />

      <main className="mx-auto max-w-form space-y-4 px-4 py-6 md:space-y-6 md:px-6 md:py-8">
        <ProgressBar activeStep={activeStep} />

        <p className="text-xs text-text-muted">
          <span className="text-red-500">*</span> Required fields
        </p>

        {submitError && (
          <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        <form onSubmit={onSubmit} noValidate className="space-y-4 md:space-y-6">
          <OrderInfoSection {...formProps} />
          <TreatmentTypeSection register={register} watch={watch} setValue={setValue} />
          <ToothSelectorSection register={register} watch={watch} setValue={setValue} />
          <InstructionsSection register={register} watch={watch} />
          <FileUploadSection
            orderNo={sessionOrderNo}
            files={files}
            onFilesChange={setFiles}
            fileErrors={fileErrors}
          />

          <SubmitSection
            isSubmitting={isSubmitting}
            onSaveDraft={handleSaveDraft}
            draftSaved={draftSaved}
          />

          <button
            type="button"
            onClick={handleReset}
            className="block w-full py-2 text-center text-xs text-text-muted underline-offset-2 transition-colors hover:text-text hover:underline"
          >
            Reset Form
          </button>
        </form>
      </main>

      <FormFooter />
    </div>
  )
}
