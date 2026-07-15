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
import { AuthModal } from '@/components/AuthModal'
import { SectionCard } from '@/components/ui/SectionCard'
import { useFormDraft } from '@/hooks/useFormDraft'
import { orderFormSchema, defaultFormValues, generateUploadFolderId, type OrderFormValues } from '@/types/orderForm'

const FORM_STEPS = [
  { id: 'case-details', label: 'Case Details', step: 1, fields: ['dentist', 'clinic', 'email', 'patient'] },
  {
    id: 'tooth-selector',
    label: 'Tooth Selector & Shade',
    step: 2,
    fields: ['shade', 'stumpShadeIncisal', 'stumpShadeMiddle', 'stumpShadeCervical'],
  },
  { id: 'file-upload', label: 'Upload Files', step: 3, fields: ['cloudDriveLink'] },
] as const

interface OrderFormProps {
  orderId?: string
  initialValues?: OrderFormValues
  initialFileUrls?: Record<string, string>
}

export default function OrderForm({ orderId, initialValues, initialFileUrls = {} }: OrderFormProps) {
  const [uploadFolderId] = useState(() => generateUploadFolderId())
  const [files, setFiles] = useState<FilesState>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedOrderNo, setSubmittedOrderNo] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(1)
  const [authModalOpen, setAuthModalOpen] = useState(false)

  const { saveDraft, loadDraft, clearDraft } = useFormDraft()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors },
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: defaultFormValues,
    mode: 'onSubmit',
  })

  useEffect(() => {
    if (initialValues) {
      reset({ ...defaultFormValues, ...initialValues })
      return
    }
    const draft = loadDraft()
    if (draft) {
      const treatmentCategory =
        draft.treatmentCategory === 'removable'
          ? defaultFormValues.treatmentCategory
          : draft.treatmentCategory || defaultFormValues.treatmentCategory
      reset({
        ...defaultFormValues,
        ...draft,
        treatmentCategory,
      })
    }
  }, [initialValues, loadDraft, reset])

  useEffect(() => {
    if (initialValues) return
    if (loadDraft()) return
    fetch('/api/portal/profile')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.profile) return
        setValue('dentist', data.profile.fullName ?? '')
        setValue('clinic', data.profile.clinicName ?? '')
        setValue('email', data.profile.email ?? '')
        setValue('address', data.profile.address ?? '')
      })
      .catch(() => undefined)
  }, [initialValues, loadDraft, setValue])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)

    const file_urls = Object.fromEntries(
      Object.entries(files)
        .filter(([, data]) => data?.blobUrl)
        .map(([slotId, data]) => [slotId, data!.blobUrl!]),
    )

    setIsSubmitting(true)

    try {
      const res = await fetch(orderId ? `/api/portal/orders/${orderId}` : '/api/orders', {
        method: orderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          file_urls: { ...initialFileUrls, ...file_urls },
        }),
      })

      const data = (await res.json()) as { success: boolean; orderNo?: string; error?: string }

      if (res.status === 401 && !orderId) {
        saveDraft(values)
        setAuthModalOpen(true)
        return
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to submit order')
      }

      setSubmittedOrderNo(data.orderNo ?? '')
      setSubmitted(true)
      if (!orderId) clearDraft()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit order')
    } finally {
      setIsSubmitting(false)
    }
  }, (formErrors) => {
    const invalidStep = FORM_STEPS.find((step) =>
      step.fields.some((field) => Boolean(formErrors[field as keyof typeof formErrors])),
    )?.step ?? 1
    setActiveStep(invalidStep)
    setSubmitError('Please complete all required fields before submitting your order.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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
    setActiveStep(1)
    setSubmitted(false)
    setSubmitError(null)
    clearDraft()
  }, [reset, clearDraft])

  const currentStep = activeStep ? FORM_STEPS[activeStep - 1] : null
  const isFirstStep = activeStep === 1
  const isLastStep = activeStep === FORM_STEPS.length

  const goToStep = useCallback((step: number) => {
    setActiveStep(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const foldActiveStep = useCallback(() => {
    setActiveStep(null)
  }, [])

  const handleNext = useCallback(async () => {
    if (!activeStep || !currentStep) return
    const fields = [...currentStep.fields] as (keyof OrderFormValues)[]
    const valid = fields.length === 0 ? true : await trigger(fields)
    if (!valid) return
    goToStep(Math.min(activeStep + 1, FORM_STEPS.length))
  }, [activeStep, currentStep, goToStep, trigger])

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
              setActiveStep(1)
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

      {authModalOpen && (
        <AuthModal
          onClose={() => setAuthModalOpen(false)}
          onSignedIn={() => setAuthModalOpen(false)}
        />
      )}

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
          <div className="space-y-3">
            {FORM_STEPS.map((step) => (
              step.step === activeStep ? (
                <div key={step.id}>
                  {step.id === 'case-details' && (
                    <SectionCard title="Case Details" id="case-details" onTitleClick={foldActiveStep}>
                      <div className="space-y-6">
                        <OrderInfoSection {...formProps} embedded />
                        <TreatmentTypeSection register={register} watch={watch} setValue={setValue} embedded />
                        <InstructionsSection register={register} watch={watch} embedded />
                      </div>
                    </SectionCard>
                  )}
                  {step.id === 'tooth-selector' && <ToothSelectorSection register={register} errors={errors} watch={watch} setValue={setValue} onTitleClick={foldActiveStep} />}
                  {step.id === 'file-upload' && (
                    <FileUploadSection
                      orderNo={uploadFolderId}
                      files={files}
                      onFilesChange={setFiles}
                      register={register}
                      error={errors.cloudDriveLink?.message}
                      onTitleClick={foldActiveStep}
                    />
                  )}
                </div>
              ) : (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => goToStep(step.step)}
                  className="flex w-full items-center justify-between rounded-card border border-border bg-surface px-4 py-3 text-left text-sm font-semibold text-text-muted shadow-sm transition-colors hover:border-primary hover:text-primary"
                  aria-expanded={false}
                  aria-controls={step.id}
                >
                  <span>{step.label}</span>
                  <span className="text-xs">Step {step.step}</span>
                </button>
              )
            ))}
          </div>

          {currentStep ? (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => goToStep(Math.max((activeStep ?? 1) - 1, 1))}
                disabled={isFirstStep}
                className="rounded-card border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-center text-xs font-medium text-text-muted">
                Step {activeStep} of {FORM_STEPS.length}: {currentStep.label}
              </p>
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#e06d15]"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="rounded-card border border-border px-4 py-2 text-sm font-semibold text-text-muted transition-colors hover:border-primary hover:text-primary"
                >
                  Back to Start
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-card border border-border bg-surface p-3 text-center text-xs font-medium text-text-muted shadow-sm">
              Select a folded section above to continue.
            </div>
          )}

          {isLastStep && currentStep && (
            <SubmitSection
              isSubmitting={isSubmitting}
              onSaveDraft={handleSaveDraft}
              draftSaved={draftSaved}
              submitLabel={orderId ? 'Save Order Changes' : 'Submit Order'}
            />
          )}

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
