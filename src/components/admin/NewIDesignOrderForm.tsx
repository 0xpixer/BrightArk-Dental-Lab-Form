'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BadgeCheck, Check, MoveLeft, MoveRight, Plus, Save, Send, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FDIToothChart } from '@/components/idesign/FDIToothChart'
import { IDesignCaseUploads, type IDesignUploadState } from '@/components/idesign/IDesignCaseUploads'
import { CHIEF_COMPLAINT_GROUPS, DENTITION_STAGES, IDESIGN_GENDERS, IDESIGN_REQUIRED_FILE_SLOTS, RELATIONSHIP_OPTIONS } from '@/lib/idesign/cases'

type StepOneErrors = Partial<Record<'patientName' | 'gender' | 'dateOfBirth' | string, string>>
type ToothField = 'extractionTeeth' | 'lockedTeeth' | 'attachmentRestrictedTeeth' | 'iprRestrictedTeeth' | 'reserveSpaceTeeth'
type StoredFile = { url: string; name: string; size?: number; type?: string }

export interface IDesignCaseInformationData {
  patientName: string
  gender: string | null
  dateOfBirth: string | null
  fileUrls: Record<string, StoredFile[]> | null
  dentitionStage: string | null
  chiefComplaints: string[]
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

export function IDesignCaseInformationEditor({ caseId, value, onSaved, downloadUrl, hideHeader = false }: { caseId: number; value: IDesignCaseInformationData; onSaved: () => Promise<void>; downloadUrl?: string; hideHeader?: boolean }) {
  return <IDesignCaseForm mode="edit" caseId={caseId} initialData={value} onSaved={onSaved} downloadUrl={downloadUrl} hideHeader={hideHeader} />
}

export function IDesignCaseInformationViewer({ caseId, value, downloadUrl, hideHeader = false }: { caseId: number; value: IDesignCaseInformationData; downloadUrl?: string; hideHeader?: boolean }) {
  return <IDesignCaseForm mode="view" caseId={caseId} initialData={value} downloadUrl={downloadUrl} hideHeader={hideHeader} />
}

function IDesignCaseForm({ mode, caseId, initialData, onSaved, downloadUrl, hideHeader = false }: { mode: 'create' | 'edit' | 'view'; caseId?: number; initialData?: IDesignCaseInformationData; onSaved?: () => Promise<void>; downloadUrl?: string; hideHeader?: boolean }) {
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
  const [chiefComplaints, setChiefComplaints] = useState(initialData?.chiefComplaints ?? [])
  const [complaintDialogOpen, setComplaintDialogOpen] = useState(false)
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
      patientName, gender: gender || null, dateOfBirth: dateOfBirth || null, fileUrls, dentitionStage: dentitionStage || null, chiefComplaints, ...teeth,
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
    {!hideHeader && <header className="flex items-center gap-3">
      {mode === 'create' && <Link href={listHref} title="Back to iDesign orders" className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" /><span className="sr-only">Back to iDesign orders</span></Link>}
      <div><h1 className={`${mode === 'create' ? 'text-xl' : 'text-base'} font-semibold text-text`}>{mode === 'create' ? 'New Clear Aligner Order' : 'Case Information'}</h1><p className="mt-1 text-sm text-text-muted">{mode === 'create' ? 'Enter the patient records and clinical design preferences.' : mode === 'edit' ? 'Update patient records, case files and clinical design preferences.' : 'Patient records, case files and clinical design preferences.'}</p></div>
    </header>}

    <StepIndicator step={step} />
    {submitError && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
    {saved && <div role="status" className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Case information saved.</div>}

    <form onSubmit={submit} className="overflow-hidden rounded-card border border-border bg-surface">
      {step === 1 ? <div className="divide-y divide-border">
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.1" title="Basic Information" />
          <div className="grid gap-4 rounded-card bg-bg p-4 sm:grid-cols-3">
            <Field label="Name" required={mode === 'create'} error={stepOneErrors.patientName}><input disabled={readOnly} value={patientName} onChange={(event) => { setPatientName(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.patientName))} /></Field>
            <Field label="Gender" required={mode === 'create'} error={stepOneErrors.gender}><select disabled={readOnly} value={gender} onChange={(event) => { setGender(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.gender))}><option value="">Select gender</option>{IDESIGN_GENDERS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Date of birth" required={mode === 'create'} error={stepOneErrors.dateOfBirth}><input disabled={readOnly} type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => { setDateOfBirth(event.target.value); setSaved(false) }} className={inputClass(Boolean(stepOneErrors.dateOfBirth))} /></Field>
          </div>
        </section>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.2" title="Case Data" />
          <IDesignCaseUploads uploadId={uploadId} value={files} onChange={setFiles} errors={stepOneErrors} enforceRequired={mode === 'create'} readOnly={readOnly} downloadUrl={downloadUrl} />
        </section>
        <div className="flex justify-end p-4 sm:p-6"><button type="button" onClick={goNext} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600">Next <MorphIcon icon={ArrowRight} hoverIcon={MoveRight} className="h-4 w-4" /></button></div>
      </div> : <div>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.3" title="Clinical Info" />
          <div className="min-w-0 space-y-7">
            <p className="rounded-card bg-bg px-3 py-2 text-xs text-text-muted">For reference during design; does not constitute a treatment plan.</p>
            <ClinicalSection title="Dentition Stage" first><div className="rounded-card bg-bg p-4"><RadioChoices name="dentition-stage" options={DENTITION_STAGES} value={dentitionStage} onChange={setDentitionStage} readOnly={readOnly} columns="md:grid-cols-3" /></div></ClinicalSection>
            <ClinicalSection title="Chief Complaint"><ChiefComplaintTags value={chiefComplaints} readOnly={readOnly} onAdd={() => setComplaintDialogOpen(true)} onRemove={(complaint) => setChiefComplaints((current) => current.filter((item) => item !== complaint))} /></ClinicalSection>
            <ClinicalSection title="Extraction"><ToothChartPanel value={teeth.extractionTeeth} onChange={(value) => setToothField('extractionTeeth', value)} readOnly={readOnly} /></ClinicalSection>
            <ClinicalSection title="Lock"><ToothChartPanel value={teeth.lockedTeeth} onChange={(value) => setToothField('lockedTeeth', value)} readOnly={readOnly} /></ClinicalSection>
            <ClinicalSection title="Teeth restricted from attachment bonding"><ToothChartPanel value={teeth.attachmentRestrictedTeeth} onChange={(value) => setToothField('attachmentRestrictedTeeth', value)} readOnly={readOnly} /></ClinicalSection>
            <ClinicalSection title="Teeth restricted from IPR"><ToothChartPanel value={teeth.iprRestrictedTeeth} onChange={(value) => setToothField('iprRestrictedTeeth', value)} readOnly={readOnly} /></ClinicalSection>
            <ClinicalSection title="Reserve space"><ToothChartPanel helper="Minimum Scale Division: 0.01mm" value={teeth.reserveSpaceTeeth} onChange={(value) => setToothField('reserveSpaceTeeth', value)} readOnly={readOnly} /></ClinicalSection>
            <ClinicalSection title="Midline target position"><RadioPanel readOnly={readOnly} rows={[
              { title: 'Maxillary', name: 'maxillary-midline', options: [...MIDLINE_OPTIONS, 'Match upper midline to lower midline'], value: maxillaryMidline, onChange: setMaxillaryMidline },
              { title: 'Mandibular', name: 'mandibular-midline', options: [...MIDLINE_OPTIONS, 'Match lower midline to upper midline'], value: mandibularMidline, onChange: setMandibularMidline },
            ]} /></ClinicalSection>
            <ClinicalSection title="Canine and Molar Relationship"><RadioPanel readOnly={readOnly} rows={[
              { title: 'Left', name: 'left-relationship', options: RELATIONSHIP_OPTIONS, value: leftRelationship, onChange: setLeftRelationship },
              { title: 'Right', name: 'right-relationship', options: RELATIONSHIP_OPTIONS, value: rightRelationship, onChange: setRightRelationship },
            ]} /></ClinicalSection>
            <ClinicalSection title="Collision Resolution">
              <FlagGroup title="Posterior Arch Expansion" rows={[[["maxillary", 'Maxillary']], [["mandibular", 'Mandibular']]]} value={posteriorExpansion} onChange={setPosteriorExpansion} readOnly={readOnly} />
              <FlagGroup title="IPR" rows={[
                [["upperAnterior", 'Upper anterior teeth'], ["upperLeftPosterior", 'Upper left posterior teeth'], ["upperRightPosterior", 'Upper right posterior teeth']],
                [["lowerAnterior", 'Lower anterior teeth'], ["lowerLeftPosterior", 'Lower left posterior teeth'], ["lowerRightPosterior", 'Lower right posterior teeth']],
              ]} value={ipr} onChange={setIpr} readOnly={readOnly} />
              <FlagGroup title="Molar Distalization" rows={[
                [["upperLeft", 'Upper Left side'], ["upperRight", 'Upper Right side']],
                [["lowerLeft", 'Lower Left side'], ["lowerRight", 'Lower Right side']],
              ]} value={distalization} onChange={setDistalization} readOnly={readOnly} />
            </ClinicalSection>
            <ClinicalSection title="Other remarks and design instructions"><textarea disabled={readOnly} value={remarks} maxLength={500} onChange={(event) => setRemarks(event.target.value)} placeholder="Please Enter Notes" rows={5} className={`${inputClass(false)} h-auto resize-y py-2.5`} /><p className="mt-1 text-right text-xs text-text-muted">{remarks.length} / 500</p></ClinicalSection>
          </div>
        </section>
        <div className="border-t border-border p-4 sm:p-6">
          {mode === 'create' && <p className="mb-3 text-right text-xs leading-5 text-text-muted">Submitting sends this case to BrightArk for design. Case information will become read-only for doctor accounts.</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(1)} className="inline-flex h-10 items-center justify-center gap-2 rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" />Previous</button>
            {!readOnly && <div className="flex gap-2">{mode === 'create' && <Link href={listHref} className="inline-flex h-10 items-center rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg">Cancel</Link>}<button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"><MorphIcon icon={mode === 'create' ? Send : Save} hoverIcon={BadgeCheck} className="h-4 w-4" />{saving ? mode === 'create' ? 'Submitting...' : 'Saving...' : mode === 'create' ? 'Submit Order' : 'Save Changes'}</button></div>}
          </div>
        </div>
      </div>}
    </form>
    {complaintDialogOpen && <ChiefComplaintDialog value={chiefComplaints} onCancel={() => setComplaintDialogOpen(false)} onConfirm={(value) => { setChiefComplaints(value); setComplaintDialogOpen(false); setSaved(false) }} />}
  </div>
}

function ToothChartPanel({ helper, value, onChange, readOnly }: { helper?: string; value: number[]; onChange: (value: number[]) => void; readOnly: boolean }) {
  return <div className="rounded-card bg-bg px-4 py-5"><FDIToothChart helper={helper} value={value} onChange={onChange} readOnly={readOnly} /></div>
}

function ChiefComplaintTags({ value, readOnly, onAdd, onRemove }: { value: string[]; readOnly: boolean; onAdd: () => void; onRemove: (value: string) => void }) {
  return <div className="rounded-card bg-bg p-4">
    <div className="flex flex-wrap gap-2">
      {value.map((complaint) => <span key={complaint} className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text">{complaint}{!readOnly && <button type="button" onClick={() => onRemove(complaint)} title={`Remove ${complaint}`} className="text-text-muted hover:text-text"><MorphIcon icon={X} className="h-3.5 w-3.5" /><span className="sr-only">Remove {complaint}</span></button>}</span>)}
      {!readOnly && <button type="button" onClick={onAdd} className="inline-flex h-8 items-center gap-1 rounded-card border border-dashed border-neutral-400 bg-surface px-3 text-xs font-semibold text-text hover:border-primary hover:text-primary"><MorphIcon icon={Plus} className="h-3.5 w-3.5" />Add</button>}
    </div>
    {value.length === 0 && readOnly && <p className="text-sm text-text-muted">Not specified</p>}
  </div>
}

function ChiefComplaintDialog({ value, onCancel, onConfirm }: { value: string[]; onCancel: () => void; onConfirm: (value: string[]) => void }) {
  const standardOptions: string[] = CHIEF_COMPLAINT_GROUPS.flatMap((group) => [...group.options]).filter((option) => option !== 'Other')
  const [selected, setSelected] = useState(() => new Set(value.filter((item) => standardOptions.includes(item))))
  const existingOther = value.find((item) => item.startsWith('Other: '))
  const [includeOther, setIncludeOther] = useState(Boolean(existingOther))
  const [otherText, setOtherText] = useState(existingOther?.slice(7) ?? '')

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  const toggle = (option: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(option)) next.delete(option)
    else next.add(option)
    return next
  })
  const confirm = () => {
    const next: string[] = standardOptions.filter((option) => selected.has(option))
    if (includeOther && otherText.trim()) next.push(`Other: ${otherText.trim()}`)
    onConfirm(next)
  }

  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="chief-complaint-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 id="chief-complaint-title" className="text-lg font-semibold text-text">Chief Complaint</h2><button type="button" onClick={onCancel} title="Close" className="grid h-8 w-8 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={X} className="h-5 w-5" /><span className="sr-only">Close</span></button></div>
      <div className="space-y-6 overflow-y-auto px-5 py-5">
        {CHIEF_COMPLAINT_GROUPS.map((group) => <fieldset key={group.title}><legend className="mb-3 text-sm font-semibold text-text">{group.title}</legend><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{group.options.map((option) => option === 'Other' ? <label key={option} className="col-span-full flex items-start gap-2 rounded-card bg-bg px-3 py-2.5 text-sm text-text"><input type="checkbox" checked={includeOther} onChange={(event) => setIncludeOther(event.target.checked)} className="mt-0.5 accent-neutral-900" /><span>Other (requires text description)</span></label> : <label key={option} className="flex items-start gap-2 rounded-card bg-bg px-3 py-2.5 text-sm text-text"><input type="checkbox" checked={selected.has(option)} onChange={() => toggle(option)} className="mt-0.5 accent-neutral-900" /><span>{option}</span></label>)}</div>{group.title === 'Other issues' && includeOther && <input autoFocus value={otherText} onChange={(event) => setOtherText(event.target.value)} maxLength={193} placeholder="Describe the other issue" className={`${inputClass(false)} mt-3`} />}</fieldset>)}
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-4"><button type="button" onClick={onCancel} className="h-9 rounded-card border border-border px-4 text-sm font-semibold text-text hover:bg-bg">Cancel</button><button type="button" onClick={confirm} disabled={includeOther && !otherText.trim()} className="h-9 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">Confirm</button></div>
    </div>
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
  if (/\.ply$/i.test(name)) return 'model/ply'
  if (/\.png$/i.test(name)) return 'image/png'
  if (/\.webp$/i.test(name)) return 'image/webp'
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg'
  return 'application/octet-stream'
}

function StepIndicator({ step }: { step: 1 | 2 }) { return <ol className="grid grid-cols-[1fr_auto_1fr] items-center rounded-card border border-border bg-surface px-4 py-3"><StepItem active={step === 1} complete={step > 1} number="1" label="Information Entry" /><div className="mx-3 h-px w-8 bg-border sm:w-20" /><StepItem active={step === 2} complete={false} number="2" label="Plan Design" /></ol> }
function StepItem({ active, complete, number, label }: { active: boolean; complete: boolean; number: string; label: string }) { return <li className={`flex min-w-0 items-center gap-2 ${active ? 'text-text' : 'text-text-muted'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${active || complete ? 'border-text bg-text text-white' : 'border-border bg-surface'}`}>{complete ? <MorphIcon icon={Check} className="h-3.5 w-3.5" /> : number}</span><span className="truncate text-xs font-semibold sm:text-sm">{number}. {label}</span></li> }
function SectionHeading({ number, title }: { number: string; title: string }) { return <div><span className="text-xs font-semibold text-text-muted">{number}</span><div className="mt-1 flex items-center gap-2"><span className="h-5 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h2 className="text-base font-semibold text-text">{title}</h2></div></div> }
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-xs font-medium text-text-muted">{label}{required && <span className="text-red-500"> *</span>}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label> }
function inputClass(error: boolean) { return `h-10 w-full rounded-card border bg-bg px-3 text-sm text-text outline-none focus:ring-2 focus:ring-text/10 disabled:cursor-default disabled:text-text disabled:opacity-100 ${error ? 'border-red-400' : 'border-border focus:border-text'}` }
function ClinicalSection({ title, children, first = false }: { title: string; children: React.ReactNode; first?: boolean }) { return <section className={first ? '' : 'border-t border-border pt-6'}><div className="mb-4 flex items-center gap-2"><span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h3 className="text-sm font-semibold text-text">{title}</h3></div>{children}</section> }

function RadioChoices({ name, options, value, onChange, readOnly = false, columns = 'sm:grid-cols-2' }: { name: string; options: readonly string[]; value: string; onChange: (value: string) => void; readOnly?: boolean; columns?: string }) {
  if (readOnly) return <p className="text-sm font-medium text-text">{value || 'Not specified'}</p>
  return <div className={`grid gap-2 ${columns}`}>{options.map((option) => <label key={option} className={`flex min-h-10 cursor-pointer items-start gap-2 rounded-card border bg-surface px-3 py-2.5 text-xs transition-colors ${value === option ? 'border-text text-text' : 'border-border text-text-muted hover:border-neutral-400'}`}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="mt-0.5 accent-neutral-900" /><span>{option}</span></label>)}</div>
}

function RadioPanel({ rows, readOnly }: { rows: Array<{ title: string; name: string; options: readonly string[]; value: string; onChange: (value: string) => void }>; readOnly: boolean }) {
  return <div className="divide-y divide-border overflow-hidden rounded-card bg-bg">{rows.map((row) => <fieldset key={row.name} className="grid gap-3 px-4 py-4 lg:grid-cols-[160px_minmax(0,1fr)]"><legend className="sr-only">{row.title}</legend><p className="text-sm font-semibold text-text">{row.title}</p><RadioChoices name={row.name} options={row.options} value={row.value} onChange={row.onChange} readOnly={readOnly} /></fieldset>)}</div>
}

function FlagGroup<T extends Record<string, boolean>>({ title, rows, value, onChange, readOnly = false }: { title: string; rows: Array<Array<[keyof T, string]>>; value: T; onChange: (value: T) => void; readOnly?: boolean }) {
  return <fieldset className="border-b border-border py-5 first:pt-0 last:border-b-0 last:pb-0"><legend className="mb-3 text-sm font-semibold text-text">{title}</legend><div className="divide-y divide-border overflow-hidden rounded-card bg-bg">{rows.map((row, rowIndex) => <div key={rowIndex} className={`grid gap-2 p-4 ${row.length >= 3 ? 'md:grid-cols-2 xl:grid-cols-3' : row.length === 2 ? 'md:grid-cols-2' : 'grid-cols-1'}`}>{row.map(([key, label]) => readOnly ? <div key={String(key)} className="flex min-h-10 items-center justify-between gap-4 px-1 text-sm"><span className="text-text">{label}</span><span className="shrink-0 font-medium text-text-muted">{value[key] ? 'Not allowed' : 'Allowed'}</span></div> : <label key={String(key)} className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-card border border-border bg-surface px-3 py-2.5 text-xs text-text transition-colors hover:border-neutral-400"><span>{label}</span><span className="flex shrink-0 items-center gap-1.5 text-text-muted"><input type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} className="accent-neutral-900" />Not allowed</span></label>)}</div>)}</div></fieldset>
}
