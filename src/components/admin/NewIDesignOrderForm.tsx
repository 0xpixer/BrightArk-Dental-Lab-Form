'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Save } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { FDIToothChart } from '@/components/idesign/FDIToothChart'
import { IDesignCaseUploads, type IDesignUploadState } from '@/components/idesign/IDesignCaseUploads'
import { DENTITION_STAGES, IDESIGN_GENDERS, IDESIGN_REQUIRED_FILE_SLOTS, RELATIONSHIP_OPTIONS } from '@/lib/idesign/cases'

type StepOneErrors = Partial<Record<'patientName' | 'gender' | 'dateOfBirth' | string, string>>
type ToothField = 'extractionTeeth' | 'lockedTeeth' | 'attachmentRestrictedTeeth' | 'iprRestrictedTeeth' | 'reserveSpaceTeeth'

const EMPTY_TEETH: Record<ToothField, number[]> = {
  extractionTeeth: [], lockedTeeth: [], attachmentRestrictedTeeth: [], iprRestrictedTeeth: [], reserveSpaceTeeth: [],
}
const MIDLINE_OPTIONS = ['Auto', 'Move left', 'Move right', 'Maintain']

export function NewIDesignOrderForm() {
  const router = useRouter()
  const pathname = usePathname()
  const listHref = pathname.startsWith('/portal') ? '/portal/idesign/orders' : '/admin/idesign/orders'
  const [step, setStep] = useState<1 | 2>(1)
  const [patientName, setPatientName] = useState('')
  const [gender, setGender] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [files, setFiles] = useState<IDesignUploadState>({})
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({})
  const [dentitionStage, setDentitionStage] = useState('Permanent Dentition')
  const [teeth, setTeeth] = useState(EMPTY_TEETH)
  const [maxillaryMidline, setMaxillaryMidline] = useState('Auto')
  const [mandibularMidline, setMandibularMidline] = useState('Auto')
  const [leftRelationship, setLeftRelationship] = useState('Auto')
  const [rightRelationship, setRightRelationship] = useState('Auto')
  const [posteriorExpansion, setPosteriorExpansion] = useState({ maxillary: false, mandibular: false })
  const [ipr, setIpr] = useState({ upperAnterior: false, upperLeftPosterior: false, upperRightPosterior: false, lowerAnterior: false, lowerLeftPosterior: false, lowerRightPosterior: false })
  const [distalization, setDistalization] = useState({ upperLeft: false, upperRight: false, lowerLeft: false, lowerRight: false })
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const uploadId = useMemo(() => `draft-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, [])

  const validateStepOne = () => {
    const errors: StepOneErrors = {}
    if (!patientName.trim()) errors.patientName = 'Name is required'
    if (!gender) errors.gender = 'Gender is required'
    if (!dateOfBirth) errors.dateOfBirth = 'Date of birth is required'
    for (const slot of IDESIGN_REQUIRED_FILE_SLOTS) {
      const item = files[slot]?.[0]
      if (!item || item.status !== 'success' || !item.blobUrl) errors[slot] = item?.status === 'uploading' ? 'Wait for this upload to finish' : 'This file is required'
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
    if (!validateStepOne()) { setStep(1); return }
    setSaving(true)
    setSubmitError(null)
    const fileUrls = Object.fromEntries(Object.entries(files).map(([slot, items]) => [slot, (items ?? []).filter((item) => item.status === 'success' && item.blobUrl).map((item) => ({ url: item.blobUrl!, name: item.file.name, size: item.file.size, type: item.file.type }))]))
    try {
      const response = await fetch('/api/idesign/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        patientName, gender, dateOfBirth, fileUrls, dentitionStage: dentitionStage || null, ...teeth,
        maxillaryMidline: maxillaryMidline || null, mandibularMidline: mandibularMidline || null,
        leftRelationship: leftRelationship || null, rightRelationship: rightRelationship || null,
        posteriorExpansionNotAllowed: posteriorExpansion, iprNotAllowed: ipr, molarDistalizationNotAllowed: distalization, remarks,
      }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to save the order')
      router.push(listHref)
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save the order')
      setSaving(false)
    }
  }

  const setToothField = (field: ToothField, value: number[]) => setTeeth((current) => ({ ...current, [field]: value }))

  return <div className="mx-auto max-w-6xl space-y-4">
    <header className="flex items-center gap-3">
      <Link href={listHref} title="Back to iDesign orders" className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back to iDesign orders</span></Link>
      <div><h1 className="text-xl font-semibold text-text">New Clear Aligner Order</h1><p className="mt-1 text-sm text-text-muted">Enter the patient records and clinical design preferences.</p></div>
    </header>

    <StepIndicator step={step} />
    {submitError && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}

    <form onSubmit={submit} className="overflow-hidden rounded-card border border-border bg-surface">
      {step === 1 ? <div className="divide-y divide-border">
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.1" title="Basic Information" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" required error={stepOneErrors.patientName}><input value={patientName} onChange={(event) => setPatientName(event.target.value)} className={inputClass(Boolean(stepOneErrors.patientName))} /></Field>
            <Field label="Gender" required error={stepOneErrors.gender}><select value={gender} onChange={(event) => setGender(event.target.value)} className={inputClass(Boolean(stepOneErrors.gender))}><option value="">Select gender</option>{IDESIGN_GENDERS.map((option) => <option key={option}>{option}</option>)}</select></Field>
            <Field label="Date of birth" required error={stepOneErrors.dateOfBirth}><input type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={inputClass(Boolean(stepOneErrors.dateOfBirth))} /></Field>
          </div>
        </section>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.2" title="Case Data" />
          <IDesignCaseUploads uploadId={uploadId} value={files} onChange={setFiles} errors={stepOneErrors} />
        </section>
        <div className="flex justify-end p-4 sm:p-6"><button type="button" onClick={goNext} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600">Next <ArrowRight className="h-4 w-4" /></button></div>
      </div> : <div>
        <section className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[180px_1fr]">
          <SectionHeading number="1.3" title="Clinical Info" />
          <div className="min-w-0 space-y-7">
            <p className="rounded-card bg-bg px-3 py-2 text-xs text-text-muted">For reference during design; does not constitute a treatment plan.</p>
            <RadioGroup title="Dentition Stage" name="dentition-stage" options={DENTITION_STAGES} value={dentitionStage} onChange={setDentitionStage} />
            <div><h3 className="mb-3 text-sm font-semibold text-text">Chief Complaint</h3>
              <FDIToothChart title="Extraction" value={teeth.extractionTeeth} onChange={(value) => setToothField('extractionTeeth', value)} />
              <FDIToothChart title="Lock" value={teeth.lockedTeeth} onChange={(value) => setToothField('lockedTeeth', value)} />
              <FDIToothChart title="Teeth restricted from attachment bonding" value={teeth.attachmentRestrictedTeeth} onChange={(value) => setToothField('attachmentRestrictedTeeth', value)} />
              <FDIToothChart title="Teeth restricted from IPR" value={teeth.iprRestrictedTeeth} onChange={(value) => setToothField('iprRestrictedTeeth', value)} />
              <FDIToothChart title="Reserve space" helper="Minimum Scale Division: 0.01mm" value={teeth.reserveSpaceTeeth} onChange={(value) => setToothField('reserveSpaceTeeth', value)} />
            </div>
            <ClinicalSection title="Midline target position"><div className="grid gap-5 xl:grid-cols-2"><RadioGroup title="Maxillary" name="maxillary-midline" options={[...MIDLINE_OPTIONS, 'Match upper midline to lower midline']} value={maxillaryMidline} onChange={setMaxillaryMidline} /><RadioGroup title="Mandibular" name="mandibular-midline" options={[...MIDLINE_OPTIONS, 'Match lower midline to upper midline']} value={mandibularMidline} onChange={setMandibularMidline} /></div></ClinicalSection>
            <ClinicalSection title="Canine and Molar Relationship"><div className="grid gap-5 xl:grid-cols-2"><RadioGroup title="Left" name="left-relationship" options={RELATIONSHIP_OPTIONS} value={leftRelationship} onChange={setLeftRelationship} /><RadioGroup title="Right" name="right-relationship" options={RELATIONSHIP_OPTIONS} value={rightRelationship} onChange={setRightRelationship} /></div></ClinicalSection>
            <ClinicalSection title="Collision Resolution">
              <FlagGroup title="Posterior Arch Expansion" items={[["maxillary", 'Maxillary'], ["mandibular", 'Mandibular']]} value={posteriorExpansion} onChange={setPosteriorExpansion} />
              <FlagGroup title="IPR" items={[["upperAnterior", 'Upper anterior teeth'], ["upperLeftPosterior", 'Upper left posterior teeth'], ["upperRightPosterior", 'Upper right posterior teeth'], ["lowerAnterior", 'Lower anterior teeth'], ["lowerLeftPosterior", 'Lower left posterior teeth'], ["lowerRightPosterior", 'Lower right posterior teeth']]} value={ipr} onChange={setIpr} />
              <FlagGroup title="Molar Distalization" items={[["upperLeft", 'Upper Left side'], ["upperRight", 'Upper Right side'], ["lowerLeft", 'Lower Left side'], ["lowerRight", 'Lower Right side']]} value={distalization} onChange={setDistalization} />
            </ClinicalSection>
            <ClinicalSection title="Other remarks and design instructions"><textarea value={remarks} maxLength={500} onChange={(event) => setRemarks(event.target.value)} placeholder="Please Enter Notes" rows={5} className={`${inputClass(false)} h-auto resize-y py-2.5`} /><p className="mt-1 text-right text-xs text-text-muted">{remarks.length} / 500</p></ClinicalSection>
          </div>
        </section>
        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-between sm:p-6"><button type="button" onClick={() => setStep(1)} className="inline-flex h-10 items-center justify-center gap-2 rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg"><ArrowLeft className="h-4 w-4" />Previous</button><div className="flex gap-2"><Link href={listHref} className="inline-flex h-10 items-center rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg">Cancel</Link><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save'}</button></div></div>
      </div>}
    </form>
  </div>
}

function StepIndicator({ step }: { step: 1 | 2 }) { return <ol className="grid grid-cols-[1fr_auto_1fr] items-center rounded-card border border-border bg-surface px-4 py-3"><StepItem active={step === 1} complete={step > 1} number="1" label="Information Entry" /><div className="mx-3 h-px w-8 bg-border sm:w-20" /><StepItem active={step === 2} complete={false} number="2" label="Plan Design" /></ol> }
function StepItem({ active, complete, number, label }: { active: boolean; complete: boolean; number: string; label: string }) { return <li className={`flex min-w-0 items-center gap-2 ${active ? 'text-text' : 'text-text-muted'}`}><span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${active || complete ? 'border-text bg-text text-white' : 'border-border bg-surface'}`}>{complete ? <Check className="h-3.5 w-3.5" /> : number}</span><span className="truncate text-xs font-semibold sm:text-sm">{number}. {label}</span></li> }
function SectionHeading({ number, title }: { number: string; title: string }) { return <div><span className="text-xs font-semibold text-text-muted">{number}</span><h2 className="mt-1 text-base font-semibold text-text">{title}</h2></div> }
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) { return <label><span className="mb-1.5 block text-xs font-medium text-text-muted">{label}{required && <span className="text-red-500"> *</span>}</span>{children}{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label> }
function inputClass(error: boolean) { return `h-10 w-full rounded-card border bg-surface px-3 text-sm text-text outline-none focus:ring-2 focus:ring-text/10 ${error ? 'border-red-400' : 'border-border focus:border-text'}` }
function ClinicalSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="border-t border-border pt-6"><h3 className="mb-4 text-sm font-semibold text-text">{title}</h3>{children}</section> }
function RadioGroup({ title, name, options, value, onChange }: { title: string; name: string; options: readonly string[]; value: string; onChange: (value: string) => void }) { return <fieldset><legend className="mb-2 text-xs font-semibold text-text-muted">{title}</legend><div className="grid gap-2 sm:grid-cols-2">{options.map((option) => <label key={option} className={`flex cursor-pointer items-start gap-2 rounded-card border px-3 py-2.5 text-xs ${value === option ? 'border-text bg-bg text-text' : 'border-border text-text-muted hover:border-neutral-400'}`}><input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} className="mt-0.5 accent-neutral-900" /><span>{option}</span></label>)}</div></fieldset> }
function FlagGroup<T extends Record<string, boolean>>({ title, items, value, onChange }: { title: string; items: Array<[keyof T, string]>; value: T; onChange: (value: T) => void }) { return <fieldset className="border-b border-border py-4 last:border-b-0"><legend className="mb-2 text-xs font-semibold text-text-muted">{title}</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{items.map(([key, label]) => <label key={String(key)} className="flex items-center justify-between gap-3 rounded-card border border-border px-3 py-2.5 text-xs text-text"><span>{label}</span><span className="flex shrink-0 items-center gap-1.5 text-text-muted"><input type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} className="accent-neutral-900" />Not allowed</span></label>)}</div></fieldset> }
