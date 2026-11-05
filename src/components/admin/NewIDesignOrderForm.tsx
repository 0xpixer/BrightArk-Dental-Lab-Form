'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, MoveLeft, MoveRight, Save } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FDIToothChart } from '@/components/idesign/FDIToothChart'
import { IDesignCaseUploads, type IDesignUploadState } from '@/components/idesign/IDesignCaseUploads'
import { DENTITION_STAGES, IDESIGN_GENDERS, IDESIGN_REQUIRED_FILE_SLOTS, RELATIONSHIP_OPTIONS } from '@/lib/idesign/cases'

type StepOneErrors = Partial<Record<'patientName' | 'gender' | 'dateOfBirth' | string, string>>
type ToothField = 'extractionTeeth' | 'lockedTeeth' | 'attachmentRestrictedTeeth' | 'iprRestrictedTeeth' | 'reserveSpaceTeeth'
type StoredFile = { url: string; name: string; size?: number; type?: string }

export interface IDesignCaseInformationData {
  patientName: string
  gender: string | null
  dateOfBirth: string | null
  fileUrls: Record<string, StoredFile[]> | null
  dentitionStage: string | null
  extractionTeeth: number[]
  lockedTeeth: number[]
  attachmentRestrictedTeeth: number[]
  iprRestrictedTeeth: number[]
  reserveSpaceTeeth: number[]
  maxillaryMidline: string | null
  mandibularMidline: string | null
  leftRelationship: string | null
  rightRelationship: string | null
  posteriorExpansionNotAllowed: Record<string, boolean> | null
  iprNotAllowed: Record<string, boolean> | null
  molarDistalizationNotAllowed: Record<string, boolean> | null
  remarks: string | null
}

const MIDLINE_OPTIONS = ['Auto', 'Move left', 'Move right', 'Maintain']

export function NewIDesignOrderForm() {
  return <IDesignCaseForm mode="create" />
}

export function IDesignCaseInformationEditor({ caseId, value, onSaved }: { caseId: number; value: IDesignCaseInformationData; onSaved: () => Promise<void> }) {
  return <IDesignCaseForm mode="edit" caseId={caseId} initialData={value} onSaved={onSaved} />
}

export function IDesignCaseInformationViewer({ caseId, value }: { caseId: number; value: IDesignCaseInformationData }) {
  return <IDesignCaseForm mode="view" caseId={caseId} initialData={value} />
}

function IDesignCaseForm({ mode, caseId, initialData, onSaved }: { mode: 'create' | 'edit' | 'view'; caseId?: number; initialData?: IDesignCaseInformationData; onSaved?: () => Promise<void> }) {
  const router = useRouter()
  const pathname = usePathname()
  const listHref = pathname.startsWith('/portal') ? '/portal/idesign/orders' : '/admin/idesign/orders'
  const [step, setStep] = useState<1 | 2>(1)
  const [patientName, setPatientName] = useState(initialData?.patientName ?? '')
  const [gender, setGender] = useState(initialData?.gender ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(initialData?.dateOfBirth ?? '')
  const [files, setFiles] = useState<IDesignUploadState>(() => storedFilesToUploadState(initialData?.fileUrls))
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({})
  const [dentitionStage, setDentitionStage] = useState(initialData?.dentitionStage ?? 'Permanent Dentition')
  const [teeth, setTeeth] = useState<Record<ToothField, number[]>>(() => ({
    extractionTeeth: initialData?.extractionTeeth ?? [], lockedTeeth: initialData?.lockedTeeth ?? [], attachmentRestrictedTeeth: initialData?.attachmentRestrictedTeeth ?? [], iprRestrictedTeeth: initialData?.iprRestrictedTeeth ?? [], reserveSpaceTeeth: initialData?.reserveSpaceTeeth ?? [],
  }))
  const [maxillaryMidline, setMaxillaryMidline] = useState(initialData?.maxillaryMidline ?? 'Auto')
  const [mandibularMidline, setMandibularMidline] = useState(initialData?.mandibularMidline ?? 'Auto')
  const [leftRelationship, setLeftRelationship] = useState(initialData?.leftRelationship ?? 'Auto')
  const [rightRelationship, setRightRelationship] = useState(initialData?.rightRelationship ?? 'Auto')
  const [posteriorExpansion, setPosteriorExpansion] = useState(() => ({ maxillary: Boolean(initialData?.posteriorExpansionNotAllowed?.maxillary), mandibular: Boolean(initialData?.posteriorExpansionNotAllowed?.mandibular) }))
  const [ipr, setIpr] = useState(() => ({ upperAnterior: Boolean(initialData?.iprNotAllowed?.upperAnterior), upperLeftPosterior: Boolean(initialData?.iprNotAllowed?.upperLeftPosterior), upperRightPosterior: Boolean(initialData?.iprNotAllowed?.upperRightPosterior), lowerAnterior: Boolean(initialData?.iprNotAllowed?.lowerAnterior), lowerLeftPosterior: Boolean(initialData?.iprNotAllowed?.lowerLeftPosterior), lowerRightPosterior: Boolean(initialData?.iprNotAllowed?.lowerRightPosterior) }))
  const [distalization, setDistalization] = useState(() => ({ upperLeft: Boolean(initialData?.molarDistalizationNotAllowed?.upperLeft), upperRight: Boolean(initialData?.molarDistalizationNotAllowed?.upperRight), lowerLeft: Boolean(initialData?.molarDistalizationNotAllowed?.lowerLeft), lowerRight: Boolean(initialData?.molarDistalizationNotAllowed?.lowerRight) }))
  const [remarks, setRemarks] = useState(initialData?.remarks ?? '')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const readOnly = mode === 'view'
  const uploadId = useMemo(() => mode === 'create' ? `draft-${Date.now()}-${crypto.randomUUID().slice(0, 8)}` : `case-${caseId}`, [caseId, mode])

  const validateStepOne = () => {
    if (readOnly) return true
    const errors: StepOneErrors = {}
    if (!patientName.trim()) errors.patientName = 'Name is required'
    if (mode === 'create') {
      if (!gender) errors.gender = 'Gender is required'
      if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
      for (const slot of IDESIGN_REQUIRED_FILE_SLOTS) {
        const item = files[slot]?.[0]
        if (!item || item.status !== 'success' || !item.blobUrl) errors[slot] = item?.status === 'uploading' ? 'Wait for this upload to finish' : 'This file is required'
      }
    }
    setStepOneErrors(errors)
    return Object.keys(errors).length === 0
  }

  const goNext = () => {
    if (!validateStepOne()) return
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (readOnly) return
    if (!validateStepOne()) { setStep(1); return }
    setSaving(true)
    setSubmitError(null)
    const fileUrls = Object.fromEntries(Object.entries(files).map(([slot, items]) => [slot, (items ?? []).filter((item) => item.status === 'success' && item.blobUrl).map((item) => ({ url: item.blobUrl!, name: item.file.name, size: item.storedSize ?? item.file.size, type: item.storedType ?? item.file.type }))]))
    const caseInformation = {
      patientName, gender: gender || null, dateOfBirth: dateOfBirth || null, fileUrls, dentitionStage: dentitionStage || null, ...teeth,
      maxillaryMidline: maxillaryMidline || null, mandibularMidline: mandibularMidline || null,
      leftRelationship: leftRelationship || null, rightRelationship: rightRelationship || null,
      posteriorExpansionNotAllowed: posteriorExpansion, iprNotAllowed: ipr, molarDistalizationNotAllowed: distalization, remarks,
    }
    try {
      const response = await fetch(mode === 'create' ? '/api/idesign/cases' : `/api/idesign/cases/${caseId}`, { method: mode === 'create' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mode === 'create' ? caseInformation : { action: 'update_case_information', data: caseInformation }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to save the order')
      if (mode === 'create') {
        router.push(listHref)
        router.refresh()
      } else {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 3000)
        await onSaved?.()
        setSaving(false)
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the order')
      setSaving(false)
    }
  }

  const setToothField = (field: ToothField, value: number[]) => setTeeth((current) => ({ ...current, [field]: value }))

  return <div className={`${mode === 'create' ? 'mx-auto max-w-6xl' : ''} space-y-4`}>
    <header className="flex items-center gap-3">
      {mode === 'create' && <Link href={listHref} title="Back to iDesign orders" className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" /><span className="sr-only">Back to iDesign orders</span></Link>}
      <div><h1 className={`${mode === 'create' ? 'text-xl' : 'text-base'} font-semibold text-text`}>{mode === 'create' ? 'New Clear Aligner Order' : 'Case Information'}</h1><p className="mt-1 text-sm text-text-muted">{mode === 'create' ? 'Enter the patient records and clinical design preferences.' : mode === 'edit' ? 'Update patient records, case files and clinical design preferences.' : 'Patient records, case files and clinical design preferences.'}</p></div>
    </header>

    <StepIndicator step={step} />
    {submitError && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
    {saved && <div role="status" className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Case information saved.</div>}

    <form onSubmit={submit} className="overflow-hidden rounded-card border border-border bg-surface">
      {step === 1 ? <div className="divide-y divide-border">
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.1" title="Basic Information" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" required={mode === 'create'} error={stepOneErrors.patientName}><input disabled={readOnly} value={patientName} onChange={(event) => { setPatientName(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.patientName))} /></Field>
            <Field label="Gender" required={mode === 'create'} error={stepOneErrors.gender}><select disabled={readOnly} value={gender} onChange={(event) => { setGender(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.gender))}><option value="">Select gender</option>{IDESIGN_GENDERS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Date of birth" required={mode === 'create'} error={stepOneErrors.dateOfBirth}><input disabled={readOnly} type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.dateOfBirth))} /></Field>
          </div>
        </section>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.2" title="Case Data" />
          <IDesignCaseUploads uploadId={uploadId} value={files} onChange={setFiles} errors={stepOneErrors} enforceRequired={mode === 'create'} readOnly={readOnly} />
        </section>
        <div className="flex justify-end p-4 sm:p-6"><button type="button" onClick={goNext} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600">Next <MorphIcon icon={ArrowRight} hoverIcon={MoveRight} className="h-4 w-4" /></button></div>
      </div> : <div>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.3" title="Clinical Info" />
          <div className="min-w-0 space-y-7">
            <p className="rounded-card bg-bg px-3 py-2 text-xs text-text-muted">For reference during design; does not constitute a treatment plan.</p>
            <RadioGroup title="Dentition Stage" name="dentition-stage" options={DENTITION_STAGES} value={dentitionStage} onChange={setDentitionStage} readOnly={readOnly} />
            <div><h3 className="mb-3 text-sm font-semibold text-text">Chief Complaint</h3>
              <FDIToothChart title="Extraction" value={teeth.extractionTeeth} onChange={(value) => setToothField('extractionTeeth', value)} readOnly={readOnly} />
              <FDIToothChart title="Lock" value={teeth.lockedTeeth} onChange={(value) => setToothField('lockedTeeth', value)} readOnly={readOnly} />
              <FDIToothChart title="Teeth restricted from attachment bonding" value={teeth.attachmentRestrictedTeeth} onChange={(value) => setToothField('attachmentRestrictedTeeth', value)} readOnly={readOnly} />
              <FDIToothChart title="Teeth restricted from IPR" value={teeth.iprRestrictedTeeth} onChange={(value) => setToothField('iprRestrictedTeeth', value)} readOnly={readOnly} />
              <FDIToothChart title="Reserve space" helper="Minimum Scale Division: 0.01mm" value={teeth.reserveSpaceTeeth} onChange={(value) => setToothField('reserveSpaceTeeth', value)} readOnly={readOnly} />
            </div>
            <ClinicalSection title="Midline target position"><div className="grid gap-5 xl:grid-cols-2"><RadioGroup title="Maxillary" name="maxillary-midline" options={[...MIDLINE_OPTIONS, 'Match upper midline to lower midline']} value={maxillaryMidline} onChange={setMaxillaryMidline} readOnly={readOnly} /><RadioGroup title="Mandibular" name="mandibular-midline" options={[...MIDLINE_OPTIONS, 'Match lower midline to upper midline']} value={mandibularMidline} onChange={setMandibularMidline} readOnly={readOnly} /></div></ClinicalSection>
            <ClinicalSection title="Canine and Molar Relationship"><div className="grid gap-5 xl:grid-cols-2"><RadioGroup title="Left" name="left-relationship" options={RELATIONSHIP_OPTIONS} value={leftRelationship} onChange={setLeftRelationship} readOnly={readOnly} /><RadioGroup title="Right" name="right-relationship" options={RELATIONSHIP_OPTIONS} value={rightRelationship} onChange={setRightRelationship} readOnly={readOnly} /></div></ClinicalSection>
            <ClinicalSection title="Collision Resolution">
              <FlagGroup title="Posterior Arch Expansion" items={[["maxillary", 'Maxillary'], ["mandibular", 'Mandibular']]} value={posteriorExpansion} onChange={setPosteriorExpansion} readOnly={readOnly} />
              <FlagGroup title="IPR" items={[["upperAnterior", 'Upper anterior teeth'], ["upperLeftPosterior", 'Upper left posterior teeth'], ["upperRightPosterior", 'Upper right posterior teeth'], ["lowerAnterior", 'Lower anterior teeth'], ["lowerLeftPosterior", 'Lower left posterior teeth'], ["lowerRightPosterior", 'Lower right posterior teeth']]} value={ipr} onChange={setIpr} readOnly={readOnly} />
              <FlagGroup title="Molar Distalization" items={[["upperLeft", 'Upper Left side'], ["upperRight", 'Upper Right side'], ["lowerLeft", 'Lower Left side'], ["lowerRight", 'Lower Right side']]} value={distalization} onChange={setDistalization} readOnly={readOnly} />
            </ClinicalSection>
            <ClinicalSection title="Other remarks and design instructions"><textarea disabled={readOnly} value={remarks} maxLength={500} onChange={(event) => setRemarks(event.target.value)} placeholder="Please Enter Notes" rows={5} className={`${inputClass(false)} h-auto resize-y py-2.5`} /><p className="mt-1 text-right text-xs text-text-muted">{remarks.length} / 500</p></ClinicalSection>
          </div>
        </section>
        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-between sm:p-6"><button type="button" onClick={() => setStep(1)} className="inline-flex h-10 items-center justify-center gap-2 rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" />Previous</button>{!readOnly && <div className="flex gap-2">{mode === 'create' && <Link href={listHref} className="inline-flex h-10 items-center rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg">Cancel</Link>}<button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"><MorphIcon icon={Save} hoverIcon={BadgeCheck} className="h-4 w-4" />{saving ? 'Saving...' : mode === 'create' ? 'Save' : 'Save Changes'}</button></div>}</div>
      </div>}
    </form>
  </div>
}

function storedFilesToUploadState(fileUrls: IDesignCaseInformationData['fileUrls'] | undefined): IDesignUploadState {
  if (!fileUrls) return {}
  return Object.fromEntries(Object.entries(fileUrls).map(([slot, entries]) => {
    const files = entries.map((entry, index) => ({
      id: `stored-${slot}-${index}`,
      file: { name: entry.name, size: entry.size ?? 0, type: entry.type ?? inferFileType(entry.name) } as File,
      previewUrl: /\.(?:jpe?g|png|webp)$/i.test(entry.name) ? entry.url : undefined,
      blobUrl: entry.url,
      progress: 100,
      status: 'success' as const,
      storedSize: entry.size ?? 0,
      storedType: entry.type ?? inferFileType(entry.name),
    }))
    return [slot, files]
  })) as IDesignUploadState
}

function inferFileType(name: string) {
  if (/\.stl$/i.test(name)) return 'model/stl'
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.webp$/i.test(name)) return 'image/webp'
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  return 'application/octet-stream'
}

function StepIndicator({ step }: { step: 1 | 2 }) { return <ol className="grid grid-cols-[1fr_auto_1fr] items-center rounded-card border border-border bg-surface px-4 py-3"><StepItem active={step === 1} complete={step > 1} number="1" label="Information Entry" /><div className="mx-3 h-px w-8 bg-border sm:w-20" /><StepItem active={step === 2} complete={false} number="2" label="Plan Design" /></ol> }
function StepItem({ active, complete, number, label }: { active: boolean; complete: boolean; number: string; label: string }) { return <li className={`flex min-w-0 items-center gap-2 ${active ? 'text-text' : 'text-text-muted'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${active || complete ? 'border-text bg-text text-white' : 'border-border bg-surface'}`}>{complete ? <MorphIcon icon={Check} className="h-3.5 w-3.5" /> : number}</span><span className="truncate text-xs font-semibold sm:text-sm">{number}. {label}</span></li> }
function SectionHeading({ number, title }: { number: string; title: string }) { return <div><span className="text-xs font-semibold text-text-muted">{number}</span><h2 className="mt-1 text-base font-semibold text-text">{title}</h2></div> }
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-xs font-medium text-text-muted">{label}{required && <span className="text-red-500"> *</span>}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label> }
function inputClass(error: boolean) { return `h-10 w-full rounded-card border bg-surface px-3 text-sm text-text outline-none focus:ring-2 focus:ring-text/10 disabled:cursor-default disabled:bg-bg disabled:text-text disabled:opacity-100 ${error ? 'border-red-400' : 'border-border focus:border-text'}` }
function ClinicalSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-t border-border pt-6"><h3 className="mb-4 text-sm font-semibold text-text">{title}</h3>{children}</section> }
function RadioGroup({ title, name, options, value, onChange, readOnly = false }: { title: string; name: string; options: readonly string[]; value: string; onChange: (value: string) => void; readOnly?: boolean }) { return <fieldset><legend className="mb-2 text-xs font-semibold text-text-muted">{title}</legend><div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option} className={`flex items-start gap-2 rounded-card border px-3 py-2.5 text-xs ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${value === option ? 'border-text bg-bg text-text' : `border-border text-text-muted ${readOnly ? '' : 'hover:border-neutral-400'}`}`}><input disabled={readOnly} type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="mt-0.5 accent-neutral-900 disabled:opacity-100" /><span>{option}</span></label>)}</div></fieldset> }
function FlagGroup<T extends Record<string, boolean>>({ title, items, value, onChange, readOnly = false }: { title: string; items: Array<[keyof T, string]>; value: T; onChange: (value: T) => void; readOnly?: boolean }) { return <fieldset className="border-b border-border py-4 last:border-b-0"><legend className="mb-2 text-xs font-semibold text-text-muted">{title}</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(([key, label]) => <label key={String(key)} className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2.5 text-xs text-text"><span>{label}</span><span className="flex shrink-0 items-center gap-1.5 text-text-muted"><input disabled={readOnly} type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} className="accent-neutral-900 disabled:opacity-100" />Not allowed</span></label>)}</div></fieldset> }
