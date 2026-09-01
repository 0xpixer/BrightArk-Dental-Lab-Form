'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  IDESIGN_CATEGORIES,
  IDESIGN_COUNTRIES,
  IDESIGN_CURRENCIES,
  IDESIGN_PAYMENT_STATUSES,
  IDESIGN_PROGRESS_OPTIONS,
  IDESIGN_SALES_COUNTRY,
} from '@/lib/idesign/orders'

type FieldErrors = Record<string, string[] | undefined>

export function NewIDesignOrderForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [names, setNames] = useState<{ salespeople: string[]; doctors: string[]; products: string[] }>({ salespeople: [], doctors: [], products: [] })
  const [country, setCountry] = useState('Indonesia')
  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    fetch('/api/admin/idesign/orders?limit=1', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => payload?.options && setNames(payload.options))
      .catch(() => undefined)
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setFieldErrors({})
    const data = Object.fromEntries(new FormData(event.currentTarget))
    for (const [key, value] of Object.entries(data)) {
      if (value === '') data[key] = null as unknown as FormDataEntryValue
    }

    try {
      const response = await fetch('/api/admin/idesign/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const payload = await response.json()
      if (!response.ok) {
        setFieldErrors(payload.details ?? {})
        throw new Error(payload.error ?? 'Unable to add record')
      }
      router.push('/admin/idesign/orders')
      router.refresh()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to add record')
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex items-center gap-3">
        <Link href="/admin/idesign/orders" title="Back to iDesign orders" className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text"><ArrowLeft className="h-4 w-4" /><span className="sr-only">Back to iDesign orders</span></Link>
        <div><h1 className="text-xl font-semibold text-text">Add iDesign Record</h1><p className="mt-1 text-sm text-text-muted">Record a new aligner, scanner, dental lab, or other order.</p></div>
      </header>

      {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={submit} className="space-y-4">
        <FormSection title="Order Details">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <TextField name="salespersonName" label="Salesperson" required list="salespeople" error={fieldErrors.salespersonName?.[0]} onChange={(event) => { const nextCountry = IDESIGN_SALES_COUNTRY[event.target.value]; if (nextCountry) setCountry(nextCountry) }} />
            <SelectField name="country" label="Country" options={IDESIGN_COUNTRIES} value={country} onChange={setCountry} error={fieldErrors.country?.[0]} />
            <TextField name="doctorName" label="Doctor" required list="doctors" error={fieldErrors.doctorName?.[0]} />
            <TextField name="patientName" label="Patient Name" required error={fieldErrors.patientName?.[0]} />
            <TextField name="caseId" label="Case ID" error={fieldErrors.caseId?.[0]} />
            <SelectField name="category" label="Category" options={IDESIGN_CATEGORIES} defaultValue="iAlign" error={fieldErrors.category?.[0]} />
            <SelectField name="latestProgress" label="Latest Progress" options={IDESIGN_PROGRESS_OPTIONS} defaultValue="Entering Info" error={fieldErrors.latestProgress?.[0]} />
            <TextField name="sourceCreatedOn" label="Creation Date" type="date" defaultValue={today} error={fieldErrors.sourceCreatedOn?.[0]} />
            <TextField name="sourceUpdatedOn" label="Update Date" type="date" defaultValue={today} error={fieldErrors.sourceUpdatedOn?.[0]} />
            <TextField name="purchasedProducts" label="Purchased Products" className="lg:col-span-2" list="products" error={fieldErrors.purchasedProducts?.[0]} />
            <TextField name="totalSteps" label="Total Steps" error={fieldErrors.totalSteps?.[0]} />
            <TextField name="producedSteps" label="Produced Steps" error={fieldErrors.producedSteps?.[0]} />
          </div>
        </FormSection>

        <FormSection title="Pricing & Payment">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField name="originalCurrency" label="Original Currency" options={IDESIGN_CURRENCIES} optional />
            <TextField name="originalPrice" label="Original Price" inputMode="decimal" />
            <TextField name="discount" label="Discount" placeholder="e.g. 30%" />
            <TextField name="totalAmount" label="Total Amount" inputMode="decimal" />
            <SelectField name="paymentStatus" label="Payment Status" options={IDESIGN_PAYMENT_STATUSES} defaultValue="Invoice not issue" />
            <SelectField name="paymentCurrency" label="Payment Currency" options={IDESIGN_CURRENCIES} optional />
            <TextField name="actualPayment" label="Actual Payment" inputMode="decimal" />
            <TextField name="paymentDate" label="Payment Date" type="date" />
            <TextField name="invoiceNo" label="Invoice No." />
            <TextField name="invoiceDate" label="Invoice Date" type="date" />
          </div>
        </FormSection>

        <FormSection title="Shipping & Commission">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField name="shippedDate" label="Shipped Date" type="date" />
            <TextField name="trackingNo" label="Tracking No." />
            <TextField name="deliveredDate" label="Delivered Date" type="date" />
            <TextField name="salesCommissionRate" label="Commission Rate" placeholder="e.g. 5%" />
            <TextField name="attributedMonth" label="Attribute to Month" placeholder="e.g. August" />
            <TextField name="salesCommission" label="Sales Commission" inputMode="decimal" />
          </div>
        </FormSection>

        <datalist id="salespeople">{names.salespeople.map((name) => <option key={name} value={name} />)}</datalist>
        <datalist id="doctors">{names.doctors.map((name) => <option key={name} value={name} />)}</datalist>
        <datalist id="products">{names.products.map((name) => <option key={name} value={name} />)}</datalist>

        <div className="flex justify-end gap-2">
          <Link href="/admin/idesign/orders" className="inline-flex h-10 items-center rounded-card border border-border bg-surface px-4 text-sm font-medium text-text hover:bg-bg">Cancel</Link>
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Record'}</button>
        </div>
      </form>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-card border border-border bg-surface p-4 sm:p-5"><h2 className="mb-4 text-sm font-semibold text-text">{title}</h2>{children}</section>
}

function TextField({ name, label, error, className = '', ...inputProps }: { name: string; label: string; error?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <label className={className}><span className="mb-1.5 block text-xs font-medium text-text-muted">{label}{inputProps.required && <span className="text-red-500"> *</span>}</span><input name={name} {...inputProps} className={`h-10 w-full rounded-card border bg-surface px-3 text-sm text-text outline-none focus:ring-2 focus:ring-text/10 ${error ? 'border-red-400' : 'border-border focus:border-text'}`} />{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>
}

function SelectField({ name, label, options, defaultValue, optional = false, error, value, onChange }: { name: string; label: string; options: readonly string[]; defaultValue?: string; optional?: boolean; error?: string; value?: string; onChange?: (value: string) => void }) {
  return <label><span className="mb-1.5 block text-xs font-medium text-text-muted">{label}</span><select name={name} {...(value !== undefined ? { value, onChange: (event) => onChange?.(event.target.value) } : { defaultValue: defaultValue ?? '' })} className={`h-10 w-full rounded-card border bg-surface px-3 text-sm text-text outline-none focus:ring-2 focus:ring-text/10 ${error ? 'border-red-400' : 'border-border focus:border-text'}`}>{optional && <option value="">Not set</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{error && <span className="mt-1 block text-xs text-red-600">{error}</span>}</label>
}
