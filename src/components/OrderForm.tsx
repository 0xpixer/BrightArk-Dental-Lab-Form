'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, type UseFormSetValue } from 'react-hook-form'
import type { Dispatch, SetStateAction } from 'react'
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
import type { ClinicOption } from '@/components/OrderInfoSection'
import { useFormDraft } from '@/hooks/useFormDraft'
import { orderFormSchema, defaultFormValues, generateUploadFolderId, type OrderFormValues } from '@/types/orderForm'

const FORM_STEPS = [
  { id: 'case-details', label: 'Case Details', step: 1, fields: ['email'] },
  {
    id: 'tooth-selector',
    label: 'Tooth Selector & Shade',
    step: 2,
    fields: [],
  },
  { id: 'file-upload', label: 'Upload Files', step: 3, fields: ['cloudDriveLink'] },
] as const

interface OrderFormProps {
  orderId?: string
  draftId?: string
  initialValues?: OrderFormValues
  initialFileUrls?: Record<string, string>
}

export default function OrderForm({ orderId, draftId, initialValues, initialFileUrls = {} }: OrderFormProps) {
  const [uploadFolderId] = useState(() => generateUploadFolderId())
  const [files, setFiles] = useState<FilesState>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submittedOrderNo, setSubmittedOrderNo] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [draftSaved, setDraftSaved] = useState(false)
  const [activeStep, setActiveStep] = useState<number | null>(1)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [clinics, setClinics] = useState<ClinicOption[]>([])
  const [serverDraftId, setServerDraftId] = useState<number | null>(() => {
    const id = Number(draftId)
    return Number.isInteger(id) && id > 0 ? id : null
  })
  const [canAutosaveToDashboard, setCanAutosaveToDashboard] = useState(false)
  const [hasAutosaveContent, setHasAutosaveContent] = useState(false)
  const [isAutoSaving, setIsAutoSaving] = useState(false)
  const [autosaveWake, setAutosaveWake] = useState(0)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedPayload = useRef<string | null>(null)
  const autosaveInProgress = useRef(false)
  const serverDraftIdRef = useRef<number | null>(serverDraftId)

  useEffect(() => {
    serverDraftIdRef.current = serverDraftId
  }, [serverDraftId])

  const { saveDraft, loadDraft, clearDraft } = useFormDraft()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    trigger,
    formState: { errors, isDirty },
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
      setHasAutosaveContent(true)
    }
  }, [initialValues, loadDraft, reset])

  useEffect(() => {
    const hasDraft = Boolean(loadDraft())
    fetch('/api/portal/profile')
      .then(async (response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!data?.profile) {
          setCanAutosaveToDashboard(false)
          return
        }
        setCanAutosaveToDashboard(true)
        const profileClinics = (data.profile.clinics ?? []) as ClinicOption[]
        const defaultClinic = profileClinics.find((clinic) => clinic.name === data.profile.clinicName) ?? profileClinics[0]
        setClinics(profileClinics)
        if (initialValues || hasDraft) return
        setValue('dentist', data.profile.fullName ?? '')
        setValue('clinic', defaultClinic?.name ?? data.profile.clinicName ?? '')
        setValue('email', data.profile.email ?? '')
        setValue('address', defaultClinic?.address ?? data.profile.address ?? '')
        setValue('billAddress', defaultClinic?.address ?? data.profile.address ?? '')
      })
      .catch(() => setCanAutosaveToDashboard(false))
  }, [initialValues, loadDraft, setValue])

  const setFormValue = useCallback<UseFormSetValue<OrderFormValues>>((name, value, options) => {
    setValue(name, value, { ...options, shouldDirty: options?.shouldDirty ?? true })
    setHasAutosaveContent(true)
  }, [setValue])

  const handleFilesChange = useCallback<Dispatch<SetStateAction<FilesState>>>((nextFiles) => {
    setFiles(nextFiles)
    setHasAutosaveContent(true)
  }, [])

  const watchedValues = watch()
  const uploadedFileUrls = useMemo(
    () => Object.fromEntries(
      Object.entries(files)
        .filter(([, data]) => data?.blobUrl)
        .map(([slotId, data]) => [slotId, data!.blobUrl!]),
    ),
    [files],
  )
  const autosavePayload = useMemo(
    () => JSON.stringify({ values: watchedValues, fileUrls: { ...initialFileUrls, ...uploadedFileUrls } }),
    [initialFileUrls, uploadedFileUrls, watchedValues],
  )

  useEffect(() => {
    if (orderId || submitted || (!isDirty && !hasAutosaveContent && Object.keys(files).length === 0)) return
    if (autosavePayload === lastSavedPayload.current) return

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      const payload = JSON.parse(autosavePayload) as { values: OrderFormValues; fileUrls: Record<string, string> }
      saveDraft(payload.values)

      if (!canAutosaveToDashboard) return
      if (autosaveInProgress.current) return

      autosaveInProgress.current = true
      setIsAutoSaving(true)
      try {
        const response = await fetch('/api/portal/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: serverDraftIdRef.current ?? undefined, ...payload }),
        })
        if (response.status === 401) {
          setCanAutosaveToDashboard(false)
          return
        }
        if (!response.ok) return

        const result = await response.json() as { draft?: { id: number } }
        if (result.draft?.id) setServerDraftId(result.draft.id)
        lastSavedPayload.current = autosavePayload
      } catch {
        // The local draft remains available when the network is unavailable.
      } finally {
        autosaveInProgress.current = false
        setIsAutoSaving(false)
        setAutosaveWake((value) => value + 1)
      }
    }, 850)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [autosavePayload, autosaveWake, canAutosaveToDashboard, files, hasAutosaveContent, isDirty, orderId, saveDraft, submitted])

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)

    setIsSubmitting(true)

    try {
      const res = await fetch(orderId ? `/api/portal/orders/${orderId}` : '/api/orders', {
        method: orderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          file_urls: { ...initialFileUrls, ...uploadedFileUrls },
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
      if (!orderId) {
        clearDraft()
        if (serverDraftIdRef.current) {
          fetch(`/api/portal/drafts/${serverDraftIdRef.current}`, { method: 'DELETE' }).catch(() => undefined)
        }
      }
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
    setSubmitError('Please correct the highlighted fields before submitting your order.')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })

  const handleSaveDraft = useCallback(() => {
    const values = watch()
    saveDraft(values)
    setHasAutosaveContent(true)
    lastSavedPayload.current = null
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2500)
  }, [watch, saveDraft])

  const handleReset = useCallback(() => {
    if (!confirm('Reset the entire form? This cannot be undone.')) return
    const currentDraftId = serverDraftIdRef.current
    reset(defaultFormValues)
    setFiles({})
    setActiveStep(1)
    setSubmitted(false)
    setSubmitError(null)
    setHasAutosaveContent(false)
    setServerDraftId(null)
    lastSavedPayload.current = null
    clearDraft()
    if (currentDraftId) {
      fetch(`/api/portal/drafts/${currentDraftId}`, { method: 'DELETE' }).catch(() => undefined)
    }
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
    () => ({ register, control, errors, watch, setValue: setFormValue }),
    [register, control, errors, watch, setFormValue],
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
          onSignedIn={() => {
            setCanAutosaveToDashboard(true)
            lastSavedPayload.current = null
            setAuthModalOpen(false)
          }}
        />
      )}

      {isAutoSaving && (
        <div role="status" className="fixed right-4 top-4 z-50 rounded-full bg-pink-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          Auto saving
        </div>
      )}

      <main className="mx-auto max-w-form space-y-4 px-4 py-6 md:space-y-6 md:px-6 md:py-8">
        <ProgressBar activeStep={activeStep} />

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
                        <OrderInfoSection {...formProps} clinics={clinics} embedded />
                        <TreatmentTypeSection register={register} watch={watch} setValue={setFormValue} embedded />
                        <InstructionsSection register={register} watch={watch} embedded />
                      </div>
                    </SectionCard>
                  )}
                  {step.id === 'tooth-selector' && <ToothSelectorSection register={register} errors={errors} watch={watch} setValue={setFormValue} onTitleClick={foldActiveStep} />}
                  {step.id === 'file-upload' && (
                    <FileUploadSection
                      orderNo={uploadFolderId}
                      files={files}
                      onFilesChange={handleFilesChange}
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
