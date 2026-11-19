'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CirclePlus, Download, ExternalLink, FileDown, FileText, Link2, Pencil, PencilLine, Plus, Save, Search, Trash2, Upload, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { categoryLabel } from '@/lib/idesign/orders'
import { IDESIGN_APPROVE_BUTTON_CLASS, IDESIGN_VIEW_BUTTON_CLASS } from '@/components/idesign/IDesignTreatmentPlans'
import { computeFinanceTotal, FINANCE_CURRENCIES, type FinanceMonthSummary, type FinanceMoney, financeOrderHref, parseFinanceAmount, parseFinanceTab, resolveFinanceDueDate, type FinanceTab } from '@/lib/finance/calc'

interface FinanceRow {
  id: number
  patientName: string
  orderNo: string | null
  category: string
  purchasedProducts: string | null
  currency: string | null
  originalPrice: string | null
  discount: string | null
  totalAmount: number | null
  paymentStatus: string
  invoiceNo: string | null
  invoiceDate: string | null
  dueDate: string | null
  effectiveDueDate: string | null
  paymentDate: string | null
  overdue: boolean
  hasInvoice: boolean
  invoiceFileName: string | null
  invoiceFileUrl: string | null
  paymentLink: string | null
  caseId: number | null
  dentalOrderId: number | null
  doctorAccountId: number | null
  doctorName: string
}

interface DoctorOption { id: number; name: string; clinicName: string | null }

interface Draft {
  patientName: string
  orderNo: string
  category: string
  purchasedProducts: string
  originalCurrency: string
  originalPrice: string
  discount: string
  paymentStatus: string
  invoiceNo: string
  invoiceDate: string
  dueDate: string
  paymentDate: string
  invoiceFileUrl: string
  invoiceFileName: string
  paymentLink: string
  doctorAccountId: string
}

const NEW_ROW_ID = 0
const INPUT_CLASS = 'h-8 w-full min-w-0 rounded-card border border-border bg-surface px-2 text-xs text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10'
const STATUS_STYLES: Record<string, string> = {
  Paid: 'border-green-200 bg-green-100 text-green-800',
  Unpaid: 'border-amber-200 bg-amber-100 text-amber-800',
  Free: 'border-sky-200 bg-sky-100 text-sky-800',
  'Invoice not issue': 'border-border bg-bg text-text-muted',
}

type Area = 'admin' | 'portal'
const TAB_LABELS: Record<FinanceTab, string> = { aligners: 'Clear Aligners', dental: 'Dental Lab' }

export function FinanceTable({ area }: { area: Area }) {
  const showDoctor = area === 'admin'
  const [tab, setTab] = useState<FinanceTab>('aligners')
  // Tabs are kept in the URL (?tab=dental) so links and reloads land on the same tab.
  useEffect(() => { setTab(parseFinanceTab(new URLSearchParams(window.location.search).get('tab'))) }, [])
  const [rows, setRows] = useState<FinanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  // The overview's overdue banner links here with ?overdue=1.
  useEffect(() => { if (new URLSearchParams(window.location.search).get('overdue') === '1') setOverdueOnly(true) }, [])
  const [canManage, setCanManage] = useState(false)
  const [summary, setSummary] = useState<FinanceMonthSummary | null>(null)
  const [overdueDays, setOverdueDays] = useState(30)
  const [overdueInput, setOverdueInput] = useState('30')
  const [savingSettings, setSavingSettings] = useState(false)
  const [options, setOptions] = useState<{ categories: string[]; paymentStatuses: string[]; doctors: DoctorOption[] }>({ categories: [], paymentStatuses: [], doctors: [] })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(page), limit: '25' })
    if (search.trim()) params.set('search', search.trim())
    params.set('tab', tab)
    if (category) params.set('category', category)
    if (status) params.set('status', status)
    if (overdueOnly) params.set('overdue', '1')
    try {
      const response = await fetch(`/api/finance?${params}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not load finance records')
      setRows(payload.rows)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.totalPages)
      setCanManage(Boolean(payload.canManage))
      setOverdueDays(payload.overdueDays)
      setOverdueInput(String(payload.overdueDays))
      setOptions(payload.options)
      setSummary(payload.summary ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load finance records')
    } finally {
      setLoading(false)
    }
  }, [page, search, category, status, overdueOnly, tab])

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, search])

  function changeTab(value: FinanceTab) {
    if (value === tab) return
    cancelEdit()
    setTab(value)
    setCategory('')
    setPage(1)
    const url = new URL(window.location.href)
    if (value === 'dental') url.searchParams.set('tab', 'dental')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url)
  }

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setPage(1)
  }

  function startEdit(row: FinanceRow) {
    setNotice('')
    setError('')
    setEditingId(row.id)
    setDraft({
      patientName: row.patientName,
      orderNo: row.orderNo ?? '',
      category: row.category,
      purchasedProducts: row.purchasedProducts ?? '',
      originalCurrency: row.currency ?? '',
      originalPrice: row.originalPrice ? String(parseFinanceAmount(row.originalPrice) ?? '') : '',
      discount: row.discount ? String(parseFinanceAmount(row.discount) ?? '') : '',
      paymentStatus: row.paymentStatus,
      invoiceNo: row.invoiceNo ?? '',
      invoiceDate: row.invoiceDate ?? '',
      dueDate: row.dueDate ?? '',
      paymentDate: row.paymentDate ?? '',
      invoiceFileUrl: row.invoiceFileUrl ?? '',
      invoiceFileName: row.invoiceFileName ?? '',
      paymentLink: row.paymentLink ?? '',
      doctorAccountId: row.doctorAccountId ? String(row.doctorAccountId) : '',
    })
  }

  function startCreate() {
    setNotice('')
    setError('')
    setEditingId(NEW_ROW_ID)
    setDraft({
      patientName: '', orderNo: '', category: tab === 'dental' ? 'Dental Lab' : 'iAlign', purchasedProducts: '', originalCurrency: '', originalPrice: '', discount: '',
      paymentStatus: 'Invoice not issue', invoiceNo: '', invoiceDate: '', dueDate: '', paymentDate: '', invoiceFileUrl: '', invoiceFileName: '', paymentLink: '', doctorAccountId: '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
  }

  async function saveDraft() {
    if (!draft || editingId === null) return
    setSaving(true)
    setError('')
    try {
      const body = { ...draft, originalCurrency: draft.originalCurrency || null, doctorAccountId: draft.doctorAccountId ? Number(draft.doctorAccountId) : null }
      const response = await fetch(editingId === NEW_ROW_ID ? '/api/finance' : `/api/finance/${editingId}`, {
        method: editingId === NEW_ROW_ID ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the record')
      setNotice(editingId === NEW_ROW_ID ? 'Finance record created' : 'Finance record saved')
      cancelEdit()
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the record')
    } finally {
      setSaving(false)
    }
  }

  async function uploadInvoice(file: File) {
    setUploading(true)
    setError('')
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
      const blob = await upload(`finance-invoices/${safeName}`, file, { access: 'public', handleUploadUrl: '/api/upload' })
      setDraft((current) => current && { ...current, invoiceFileUrl: blob.url, invoiceFileName: file.name })
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Invoice upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function saveOverdueDays() {
    setSavingSettings(true)
    setError('')
    try {
      const response = await fetch('/api/finance/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overdueDays: Number(overdueInput) }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the overdue setting')
      setNotice(`Invoices now become overdue ${payload.overdueDays} days after the invoice date`)
      await load()
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : 'Could not save the overdue setting')
    } finally {
      setSavingSettings(false)
    }
  }

  const doctorColumn = showDoctor || canManage
  const columnCount = 11 + (doctorColumn ? 1 : 0) + (canManage ? 1 : 0)
  const displayRows = useMemo(() => editingId === NEW_ROW_ID ? [newRowPlaceholder(), ...rows] : rows, [editingId, rows])

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Finance</h1>
          <p className="mt-1 text-sm text-text-muted">{loading ? 'Loading records...' : `${total} records · invoices are overdue ${overdueDays} days after the invoice date unless a due date is set`}</p>
        </div>
        {canManage && <button type="button" onClick={startCreate} disabled={editingId !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />{tab === 'dental' ? 'Add Dental Lab record' : 'Add aligner record'}</button>}
      </header>

      <div role="tablist" aria-label="Finance categories" className="flex gap-1 border-b border-border">
        {(['aligners', 'dental'] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => changeTab(value)} className={`-mb-px h-10 border-b-2 px-4 text-sm font-semibold transition-colors ${tab === value ? 'border-primary text-text' : 'border-transparent text-text-muted hover:text-text'}`}>{TAB_LABELS[value]}</button>)}
      </div>

      <MonthCards summary={summary} loading={loading && !summary} status={status} onStatus={(value) => updateFilter(setStatus, value)} />

      <section className="rounded-card border border-border bg-surface p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <label className="relative">
            <span className="sr-only">Search finance records</span>
            <span className="pointer-events-none absolute left-3 top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span>
            <input type="search" value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search patient, order, invoice or product" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" />
          </label>
          <FilterSelect label="Categories" value={category} options={options.categories} format={categoryLabel} onChange={(value) => updateFilter(setCategory, value)} />
          <FilterSelect label="Payment statuses" value={status} options={options.paymentStatuses} onChange={(value) => updateFilter(setStatus, value)} />
          <label className="flex h-11 items-center gap-2 rounded-card border border-border bg-surface px-3 text-sm text-text md:h-10"><input type="checkbox" checked={overdueOnly} onChange={(event) => updateFilter(setOverdueOnly, event.target.checked)} className="h-4 w-4 accent-[#f97316]" />Overdue only</label>
        </div>
      </section>

      {canManage && <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-sm font-semibold text-text">Overdue rule</h2><p className="mt-1 text-xs text-text-muted">An Unpaid invoice becomes overdue this many days after its invoice date. A row&apos;s own due date overrides it.</p></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-text"><span className="sr-only">Overdue days</span><input type="number" min={0} max={3650} value={overdueInput} onChange={(event) => setOverdueInput(event.target.value)} className="h-10 w-24 rounded-card border border-border bg-surface px-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" />days</label>
          <button type="button" onClick={saveOverdueDays} disabled={savingSettings || overdueInput === String(overdueDays)} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-35"><MorphIcon icon={Save} className="h-4 w-4" />{savingSettings ? 'Saving...' : 'Save rule'}</button>
        </div>
      </section>}

      {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-card border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <section className="overflow-hidden rounded-card border border-border bg-surface">
        {editingId === null && <div className="divide-y divide-border md:hidden">
          {loading && rows.length === 0
            ? <p className="px-4 py-12 text-center text-sm text-text-muted">Loading finance records...</p>
            : rows.length === 0
              ? <p className="px-4 py-12 text-center text-sm text-text-muted">No matching records</p>
              : rows.map((row) => <FinanceCard key={row.id} row={row} area={area} doctorColumn={doctorColumn} canManage={canManage} onEdit={() => startEdit(row)} />)}
        </div>}
        {/* relative: keeps the table's sr-only labels inside this scroller, or they widen the page and scroll it sideways. */}
        <div className={`relative overflow-x-auto ${editingId === null ? 'hidden md:block' : ''}`}>
          <table className={`w-full ${canManage ? 'min-w-[1680px]' : 'min-w-[1240px]'}`}>
            <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-3 py-3">Patient</th>
                <th className="px-3 py-3">Order No.</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Purchased Products</th>
                <th className="px-3 py-3 text-right">Original Price</th>
                <th className="px-3 py-3 text-right">Discount</th>
                <th className="px-3 py-3 text-right">Total Amount</th>
                <th className="px-3 py-3">Payment Status</th>
                <th className="px-3 py-3">Overdue</th>
                <th className="px-3 py-3">Invoice</th>
                <th className="px-3 py-3">Payment Link</th>
                {doctorColumn && <th className="px-3 py-3">Doctor</th>}
                {canManage && <th className="px-3 py-3"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0
                ? <tr><td colSpan={columnCount} className="px-4 py-12 text-center text-sm text-text-muted">Loading finance records...</td></tr>
                : displayRows.length === 0
                  ? <tr><td colSpan={columnCount} className="px-4 py-12 text-center text-sm text-text-muted">No matching records</td></tr>
                  : displayRows.map((row) => editingId === row.id && draft
                    ? <EditRow key={row.id} draft={draft} setDraft={setDraft} isNew={row.id === NEW_ROW_ID} options={options} overdueDays={overdueDays} saving={saving} uploading={uploading} onSave={saveDraft} onCancel={cancelEdit} onUpload={uploadInvoice} />
                    : <ViewRow key={row.id} row={row} area={area} doctorColumn={doctorColumn} canManage={canManage} editDisabled={editingId !== null} onEdit={() => startEdit(row)} />)}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Previous page"><MorphIcon icon={ChevronLeft} hoverIcon={ChevronsLeft} className="h-4 w-4" /><span className="sr-only">Previous page</span></button>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Next page"><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4" /><span className="sr-only">Next page</span></button>
          </div>
        </footer>
      </section>
    </section>
  )
}

function ViewRow({ row, area, doctorColumn, canManage, editDisabled, onEdit }: { row: FinanceRow; area: Area; doctorColumn: boolean; canManage: boolean; editDisabled: boolean; onEdit: () => void }) {
  return (
    <tr className="border-b border-border align-top last:border-0 hover:bg-bg/60">
      <td className="px-3 py-3"><p className="text-sm font-medium text-text">{row.patientName}</p></td>
      <td className="px-3 py-3 text-sm text-text"><OrderLink row={row} area={area} /></td>
      <td className="px-3 py-3 text-sm text-text">{categoryLabel(row.category)}</td>
      <td className="max-w-56 px-3 py-3"><p className="truncate text-sm text-text" title={row.purchasedProducts ?? ''}>{row.purchasedProducts || <Muted>—</Muted>}</p></td>
      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-text">{formatMoney(parseFinanceAmount(row.originalPrice), row.currency)}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right text-sm text-text">{row.discount || <Muted>0%</Muted>}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right text-sm font-semibold text-text">{formatMoney(row.totalAmount, row.currency)}</td>
      <td className="px-3 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.paymentStatus] ?? 'border-border bg-bg text-text-muted'}`}>{row.paymentStatus}</span>{row.paymentDate && <p className="mt-1 text-xs text-text-muted">Paid {formatDate(row.paymentDate)}</p>}</td>
      <td className="px-3 py-3">{row.overdue
        ? <><span className="inline-flex whitespace-nowrap rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span><p className="mt-1 text-xs text-text-muted">Due {formatDate(row.effectiveDueDate)}</p></>
        : <><span className="text-sm text-text-muted">No</span>{row.paymentStatus === 'Unpaid' && row.effectiveDueDate && <p className="mt-1 text-xs text-text-muted">Due {formatDate(row.effectiveDueDate)}</p>}</>}
      </td>
      <td className="px-3 py-3">
        {row.hasInvoice
          ? <a href={`/api/finance/${row.id}/invoice`} target="_blank" rel="noreferrer" className={IDESIGN_VIEW_BUTTON_CLASS} title={row.invoiceFileName ?? 'Download invoice'}><MorphIcon icon={Download} hoverIcon={FileDown} className="h-3 w-3" />Invoice</a>
          : <Muted>Not uploaded</Muted>}
        {(row.invoiceNo || row.invoiceDate) && <p className="mt-1 whitespace-nowrap text-xs text-text-muted">{[row.invoiceNo, formatDate(row.invoiceDate)].filter(Boolean).join(' · ')}</p>}
      </td>
      <td className="px-3 py-3">{row.paymentLink
        ? <a href={row.paymentLink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"><MorphIcon icon={Link2} hoverIcon={ExternalLink} className="h-3.5 w-3.5" />Pay now</a>
        : <Muted>—</Muted>}</td>
      {doctorColumn && <td className="px-3 py-3 text-sm text-text">{row.doctorAccountId ? row.doctorName : <span className="text-text-muted">{row.doctorName} <span className="text-xs">(unlinked)</span></span>}</td>}
      {canManage && <td className="px-3 py-3 text-right"><button type="button" onClick={onEdit} disabled={editDisabled} className={`${IDESIGN_VIEW_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-35`}><MorphIcon icon={Pencil} hoverIcon={PencilLine} className="h-3 w-3" />Edit</button></td>}
    </tr>
  )
}

function FinanceCard({ row, area, doctorColumn, canManage, onEdit }: { row: FinanceRow; area: Area; doctorColumn: boolean; canManage: boolean; onEdit: () => void }) {
  return (
    <article className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{row.patientName}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted"><OrderLink row={row} area={area} />{row.category ? ` · ${categoryLabel(row.category)}` : ''}</p>
        </div>
        <p className="shrink-0 text-right text-base font-semibold text-text">{formatMoney(row.totalAmount, row.currency)}</p>
      </div>
      {row.purchasedProducts && <p className="line-clamp-2 text-sm text-text">{row.purchasedProducts}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.paymentStatus] ?? 'border-border bg-bg text-text-muted'}`}>{row.paymentStatus}</span>
        {row.overdue && <span className="inline-flex whitespace-nowrap rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Overdue</span>}
        {row.paymentDate && <span className="text-xs text-text-muted">Paid {formatDate(row.paymentDate)}</span>}
        {!row.paymentDate && row.effectiveDueDate && (row.overdue || row.paymentStatus === 'Unpaid') && <span className="text-xs text-text-muted">Due {formatDate(row.effectiveDueDate)}</span>}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-text-muted">Original price</dt><dd className="text-right text-text">{formatMoney(parseFinanceAmount(row.originalPrice), row.currency)}</dd>
        <dt className="text-text-muted">Discount</dt><dd className="text-right text-text">{row.discount || '0%'}</dd>
        {(row.invoiceNo || row.invoiceDate) && <><dt className="text-text-muted">Invoice</dt><dd className="text-right text-text">{[row.invoiceNo, formatDate(row.invoiceDate)].filter(Boolean).join(' · ')}</dd></>}
        {doctorColumn && <><dt className="text-text-muted">Doctor</dt><dd className="truncate text-right text-text">{row.doctorName}{!row.doctorAccountId && <span className="text-text-muted"> (unlinked)</span>}</dd></>}
      </dl>
      {(row.hasInvoice || row.paymentLink || canManage) && <div className="flex flex-wrap items-center gap-2">
        {row.hasInvoice && <a href={`/api/finance/${row.id}/invoice`} target="_blank" rel="noreferrer" className={IDESIGN_VIEW_BUTTON_CLASS} title={row.invoiceFileName ?? 'Download invoice'}><MorphIcon icon={Download} hoverIcon={FileDown} className="h-3 w-3" />Invoice</a>}
        {row.paymentLink && <a href={row.paymentLink} target="_blank" rel="noreferrer noopener" className={`${IDESIGN_APPROVE_BUTTON_CLASS} gap-1.5`}><MorphIcon icon={Link2} hoverIcon={ExternalLink} className="h-3 w-3" />Pay now</a>}
        {canManage && <button type="button" onClick={onEdit} className={`${IDESIGN_VIEW_BUTTON_CLASS} ml-auto`}><MorphIcon icon={Pencil} hoverIcon={PencilLine} className="h-3 w-3" />Edit</button>}
      </div>}
    </article>
  )
}

function EditRow({ draft, setDraft, isNew, options, overdueDays, saving, uploading, onSave, onCancel, onUpload }: {
  draft: Draft
  setDraft: (updater: (current: Draft | null) => Draft | null) => void
  isNew: boolean
  options: { categories: string[]; paymentStatuses: string[]; doctors: DoctorOption[] }
  overdueDays: number
  saving: boolean
  uploading: boolean
  onSave: () => void
  onCancel: () => void
  onUpload: (file: File) => void
}) {
  const set = (field: keyof Draft) => (event: { target: { value: string } }) => {
    const value = event.target.value
    setDraft((current) => current && { ...current, [field]: value })
  }
  const total = computeFinanceTotal(draft.originalPrice, draft.discount)
  const autoDue = resolveFinanceDueDate({ dueDate: null, invoiceDate: draft.invoiceDate || null }, overdueDays)

  return (
    <tr className="border-b border-border bg-orange-50/40 align-top">
      <td className="px-3 py-3"><input aria-label="Patient name" value={draft.patientName} onChange={set('patientName')} className={`${INPUT_CLASS} min-w-28`} placeholder="Patient" /></td>
      <td className="px-3 py-3"><input aria-label="Order number" value={draft.orderNo} onChange={set('orderNo')} className={`${INPUT_CLASS} min-w-28`} placeholder="Order No." /></td>
      <td className="px-3 py-3"><select aria-label="Category" value={draft.category} onChange={set('category')} className={`${INPUT_CLASS} min-w-28`}>{withCurrent(options.categories, draft.category).map((option) => <option key={option} value={option}>{categoryLabel(option)}</option>)}</select></td>
      <td className="px-3 py-3"><input aria-label="Purchased products" value={draft.purchasedProducts} onChange={set('purchasedProducts')} className={`${INPUT_CLASS} min-w-36`} placeholder="Products" /></td>
      <td className="px-3 py-3"><div className="flex min-w-36 gap-1"><select aria-label="Currency" value={draft.originalCurrency} onChange={set('originalCurrency')} className={`${INPUT_CLASS} w-16 shrink-0`}><option value="">—</option>{FINANCE_CURRENCIES.map((option) => <option key={option} value={option}>{option}</option>)}</select><input aria-label="Original price" inputMode="decimal" value={draft.originalPrice} onChange={set('originalPrice')} className={`${INPUT_CLASS} text-right`} placeholder="0" /></div></td>
      <td className="px-3 py-3"><div className="relative min-w-20"><input aria-label="Discount percent" inputMode="decimal" value={draft.discount} onChange={set('discount')} className={`${INPUT_CLASS} pr-6 text-right`} placeholder="0" /><span className="pointer-events-none absolute right-2 top-2 text-xs text-text-muted">%</span></div></td>
      <td className="whitespace-nowrap px-3 py-3 text-right"><p className="pt-1.5 text-sm font-semibold text-text">{formatMoney(total, draft.originalCurrency || null)}</p><p className="mt-0.5 text-[10px] text-text-muted">Auto: price × (1 − discount)</p></td>
      <td className="px-3 py-3"><div className="min-w-36 space-y-1"><select aria-label="Payment status" value={draft.paymentStatus} onChange={set('paymentStatus')} className={INPUT_CLASS}>{withCurrent(options.paymentStatuses, draft.paymentStatus).map((option) => <option key={option} value={option}>{option}</option>)}</select><DateField label="Paid on" value={draft.paymentDate} onChange={set('paymentDate')} /></div></td>
      <td className="px-3 py-3"><div className="min-w-36 space-y-1"><DateField label="Due date" value={draft.dueDate} onChange={set('dueDate')} /><p className="text-[10px] text-text-muted">{draft.dueDate ? 'Custom due date' : autoDue ? `Blank = ${formatDate(autoDue)}` : `Blank = invoice date + ${overdueDays} days`}</p></div></td>
      <td className="px-3 py-3"><div className="min-w-44 space-y-1">
        <input aria-label="Invoice number" value={draft.invoiceNo} onChange={set('invoiceNo')} className={INPUT_CLASS} placeholder="Invoice No." />
        <DateField label="Invoice date" value={draft.invoiceDate} onChange={set('invoiceDate')} />
        {draft.invoiceFileUrl
          ? <div className="flex items-center gap-1"><a href={draft.invoiceFileUrl} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1 text-xs text-text underline-offset-4 hover:underline"><MorphIcon icon={FileText} className="h-3 w-3 shrink-0" /><span className="truncate">{draft.invoiceFileName || 'Invoice'}</span></a><button type="button" onClick={() => setDraft((current) => current && { ...current, invoiceFileUrl: '', invoiceFileName: '' })} className="grid h-6 w-6 shrink-0 place-items-center rounded text-text-muted hover:bg-bg hover:text-red-600" title="Remove invoice file"><MorphIcon icon={Trash2} className="h-3 w-3" /><span className="sr-only">Remove invoice file</span></button></div>
          : <label className={`${IDESIGN_VIEW_BUTTON_CLASS} cursor-pointer ${uploading ? 'opacity-50' : ''}`}><MorphIcon icon={Upload} className="h-3 w-3" />{uploading ? 'Uploading...' : 'Upload invoice'}<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = '' }} /></label>}
      </div></td>
      <td className="px-3 py-3"><input aria-label="Payment link" type="url" value={draft.paymentLink} onChange={set('paymentLink')} className={`${INPUT_CLASS} min-w-40`} placeholder="https://" /></td>
      <td className="px-3 py-3"><select aria-label="Assigned doctor" value={draft.doctorAccountId} onChange={set('doctorAccountId')} className={`${INPUT_CLASS} min-w-40`}><option value="">{isNew ? 'Select doctor' : 'Not linked'}</option>{options.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}{doctor.clinicName ? ` · ${doctor.clinicName}` : ''}</option>)}</select></td>
      <td className="px-3 py-3"><div className="flex flex-col items-end gap-1.5">
        <button type="button" onClick={onSave} disabled={saving || uploading || !draft.patientName.trim() || (isNew && !draft.doctorAccountId)} className={`${IDESIGN_APPROVE_BUTTON_CLASS} gap-1.5`}><MorphIcon icon={Save} className="h-3 w-3" />{saving ? 'Saving...' : isNew ? 'Create' : 'Save'}</button>
        <button type="button" onClick={onCancel} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-card px-2 text-[11px] font-semibold text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={X} className="h-3 w-3" />Cancel</button>
      </div></td>
    </tr>
  )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (event: { target: { value: string } }) => void }) {
  return <label className="flex items-center gap-1"><span className="w-14 shrink-0 text-[10px] font-medium uppercase text-text-muted">{label}</span><input type="date" aria-label={label} value={value} onChange={onChange} className={INPUT_CLASS} /></label>
}

function formatMonthMoney({ currency, amount }: FinanceMoney) {
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: currency === 'IDR' ? 0 : 2 }).format(amount)
  return currency === '—' ? number : `${currency} ${number}`
}

/** This month's invoiced total, paid and unpaid. Paid and Unpaid double as status filters. */
function MonthCards({ summary, loading, status, onStatus }: { summary: FinanceMonthSummary | null; loading: boolean; status: string; onStatus: (value: string) => void }) {
  if (loading) return <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((key) => <div key={key} className="h-[104px] animate-pulse rounded-card border border-border bg-surface" />)}</div>
  if (!summary) return null
  const monthName = new Date(`${summary.month}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const cards = [
    { key: 'total', label: 'Due this month', hint: 'Invoiced this month', basis: 'by invoice date', amounts: summary.total, count: summary.counts.total, filter: null, accent: 'bg-text' },
    { key: 'paid', label: 'Paid this month', hint: 'Show paid', basis: 'by payment date', amounts: summary.paid, count: summary.counts.paid, filter: 'Paid', accent: 'bg-green-500' },
    { key: 'unpaid', label: 'Unpaid this month', hint: 'Show unpaid', basis: 'by invoice date', amounts: summary.unpaid, count: summary.counts.unpaid, filter: 'Unpaid', accent: 'bg-primary' },
  ] as const
  return <section aria-label={`${monthName} invoices`} className="grid gap-3 sm:grid-cols-3">
    {cards.map((card) => {
      const active = card.filter !== null && status === card.filter
      const body = <>
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted"><span className={`h-2 w-2 shrink-0 rounded-full ${card.accent}`} /><span className="truncate">{card.label}</span></span>
          <span className="shrink-0 whitespace-nowrap text-xs text-text-muted">{card.count} invoice{card.count === 1 ? '' : 's'}</span>
        </span>
        <span className="mt-2 block text-2xl font-semibold tabular-nums text-text">{card.amounts.length ? formatMonthMoney(card.amounts[0]) : '0'}</span>
        <span className="mt-1 block min-h-4 text-xs tabular-nums text-text-muted">{card.amounts.length > 1 ? card.amounts.slice(1).map(formatMonthMoney).join(' · ') : `${monthName} · ${card.basis}`}</span>
      </>
      const className = `block w-full rounded-card border bg-surface p-4 text-left transition-colors ${active ? 'border-text ring-2 ring-text/10' : 'border-border'}`
      return card.filter === null
        ? <div key={card.key} className={className}>{body}</div>
        : <button key={card.key} type="button" aria-pressed={active} title={active ? 'Show all statuses' : card.hint} onClick={() => onStatus(active ? '' : card.filter!)} className={`${className} hover:border-neutral-400`}>{body}</button>
    })}
  </section>
}

function FilterSelect({ label, value, options, format = (option) => option, onChange }: { label: string; value: string; options: string[]; format?: (option: string) => string; onChange: (value: string) => void }) {
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select></label>
}

function OrderLink({ row, area }: { row: FinanceRow; area: Area }) {
  const href = financeOrderHref(row, area)
  if (!row.orderNo && !href) return <Muted>—</Muted>
  if (!href) return <>{row.orderNo}</>
  return <a href={href} className="font-medium text-text underline decoration-border underline-offset-4 hover:decoration-text" title="Open order">{row.orderNo || 'Open order'}</a>
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-text-muted">{children}</span>
}

function withCurrent(options: string[], current: string) {
  return current && !options.includes(current) ? [current, ...options] : options
}

function newRowPlaceholder(): FinanceRow {
  return {
    id: NEW_ROW_ID, patientName: '', orderNo: null, category: 'Dental Lab', purchasedProducts: null, currency: null, originalPrice: null, discount: null, totalAmount: null,
    paymentStatus: 'Invoice not issue', invoiceNo: null, invoiceDate: null, dueDate: null, effectiveDueDate: null, paymentDate: null, overdue: false, hasInvoice: false,
    invoiceFileName: null, invoiceFileUrl: null, paymentLink: null, caseId: null, dentalOrderId: null, doctorAccountId: null, doctorName: '',
  }
}

function formatMoney(value: number | null, currency: string | null) {
  if (value === null || value === undefined) return '—'
  return `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}`
}

function formatDate(value: string | null) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
