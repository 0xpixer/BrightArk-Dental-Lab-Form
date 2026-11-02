'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Check, FileSpreadsheet, RefreshCcw, Upload, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

interface ImportPreview {
  summary: {
    totalRows: number
    newRows: number
    updatedRows: number
    unchangedRows: number
    staleRows: number
    errorRows: number
    conflictRows: number
  }
  changes: Array<{
    rowNumber: number
    action: 'create' | 'update'
    existingId: number | null
    caseId: string | null
    patientName: string
    doctorName: string
    changes: Array<{ field: string; label: string; from: string | null; to: string | null }>
  }>
  issues: Array<{ rowNumber: number; message: string; type: 'error' | 'conflict' | 'stale' }>
  canApply: boolean
  detailsTruncated: boolean
}

interface ImportResult {
  applied: number
  created: number
  updated: number
  unchanged: number
  stale: number
}

export function IDesignImportDialog({ open, onClose, onApplied }: { open: boolean; onClose: () => void; onApplied: (result: ImportResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const request = async (action: 'preview' | 'apply', selectedFile = file) => {
    if (!selectedFile) return
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.set('file', selectedFile)
      formData.set('action', action)
      const response = await fetch('/api/admin/idesign/orders/import', { method: 'POST', body: formData })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (payload.summary) setPreview(payload)
        throw new Error(payload.error ?? 'Unable to process the Excel workbook')
      }
      if (action === 'preview') setPreview(payload)
      else {
        onApplied(payload)
        close()
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to process the Excel workbook')
    } finally {
      setBusy(false)
    }
  }

  const selectFile = (selected: File | null) => {
    setFile(selected)
    setPreview(null)
    setError(null)
    if (selected) void request('preview', selected)
  }

  const close = () => {
    if (busy) return
    setFile(null)
    setPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
    onClose()
  }

  const pendingChanges = (preview?.summary.newRows ?? 0) + (preview?.summary.updatedRows ?? 0)

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="idesign-import-title">
    <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
        <div><h2 id="idesign-import-title" className="text-base font-semibold text-text">Import Updated Order Records</h2><p className="mt-1 text-xs text-text-muted">Upload the latest Lark export. Nothing changes until you review and confirm.</p></div>
        <button type="button" onClick={close} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-card border border-border text-text-muted hover:bg-bg hover:text-text disabled:opacity-40" title="Close"><MorphIcon icon={X} className="h-4 w-4" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="flex w-full items-center justify-between gap-4 rounded-card border border-dashed border-border bg-bg px-4 py-4 text-left hover:border-neutral-400 disabled:opacity-50">
          <span className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-card border border-border bg-surface"><MorphIcon icon={FileSpreadsheet} hoverIcon={Upload} className="h-5 w-5" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-text">{file?.name ?? 'Choose the latest Excel workbook'}</span><span className="mt-0.5 block text-xs text-text-muted">.xlsx only, maximum 4 MB, first worksheet will be used</span></span></span>
          <span className="shrink-0 text-xs font-semibold text-text">{busy ? 'Comparing...' : file ? 'Choose another' : 'Browse'}</span>
        </button>

        {error && <div role="alert" className="flex gap-2 rounded-card border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><MorphIcon icon={AlertTriangle} className="mt-0.5 h-4 w-4" />{error}</div>}

        {preview && <>
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-3 xl:grid-cols-7">
            <Metric label="Rows" value={preview.summary.totalRows} />
            <Metric label="New" value={preview.summary.newRows} tone="text-green-700" />
            <Metric label="Updated" value={preview.summary.updatedRows} tone="text-blue-700" />
            <Metric label="Unchanged" value={preview.summary.unchangedRows} />
            <Metric label="Older skipped" value={preview.summary.staleRows} tone="text-amber-700" />
            <Metric label="Errors" value={preview.summary.errorRows} tone="text-red-700" />
            <Metric label="Conflicts" value={preview.summary.conflictRows} tone="text-red-700" />
          </section>

          {preview.issues.length > 0 && <section className="overflow-hidden rounded-card border border-border"><div className="border-b border-border bg-bg px-3 py-2 text-xs font-semibold text-text">Workbook notices</div><div className="max-h-48 overflow-y-auto divide-y divide-border">{preview.issues.map((issue, index) => <div key={`${issue.rowNumber}-${index}`} className="flex gap-3 px-3 py-2 text-xs"><span className={`shrink-0 font-semibold ${issue.type === 'stale' ? 'text-amber-700' : 'text-red-700'}`}>Row {issue.rowNumber}</span><span className="text-text-muted">{issue.message}</span></div>)}</div></section>}

          <section className="overflow-hidden rounded-card border border-border">
            <div className="flex items-center justify-between border-b border-border bg-bg px-3 py-2"><h3 className="text-xs font-semibold text-text">Detected changes</h3><span className="text-[10px] text-text-muted">{pendingChanges} records will change</span></div>
            <div className="max-h-80 overflow-auto">
              {preview.changes.length === 0 ? <p className="px-4 py-10 text-center text-sm text-text-muted">No new or updated records found.</p> : <table className="w-full min-w-[760px] text-left"><thead className="sticky top-0 border-b border-border bg-surface text-[10px] font-semibold uppercase text-text-muted"><tr><th className="px-3 py-2">Action</th><th className="px-3 py-2">Patient / Case</th><th className="px-3 py-2">Doctor</th><th className="px-3 py-2">Changed fields</th></tr></thead><tbody>{preview.changes.map((change) => <tr key={`${change.rowNumber}-${change.caseId ?? change.patientName}`} className="border-b border-border last:border-0 align-top"><td className="px-3 py-2"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${change.action === 'create' ? 'border-green-200 bg-green-50 text-green-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{change.action === 'create' ? 'New' : 'Update'}</span><p className="mt-1 text-[10px] text-text-muted">Row {change.rowNumber}</p></td><td className="px-3 py-2"><p className="text-xs font-medium text-text">{change.patientName}</p><p className="text-[10px] text-text-muted">{change.caseId || 'No Case ID'}</p></td><td className="px-3 py-2 text-xs text-text-muted">{change.doctorName}</td><td className="px-3 py-2">{change.action === 'create' ? <span className="text-xs text-text-muted">Create complete record</span> : <div className="space-y-1">{change.changes.map((field) => <p key={field.field} className="text-xs text-text"><span className="font-medium">{field.label}:</span> <span className="text-text-muted">{displayValue(field.from)}</span> <span aria-hidden="true">→</span> {displayValue(field.to)}</p>)}</div>}</td></tr>)}</tbody></table>}
            </div>
          </section>
          {preview.detailsTruncated && <p className="text-xs text-text-muted">Only the first 100 changes or notices are shown. All validated rows will still be processed.</p>}
        </>}
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="text-xs text-text-muted">Account assignments, treatment plans and wear schedules are preserved.</p>
        <div className="flex gap-2"><button type="button" onClick={close} disabled={busy} className="h-10 rounded-card border border-border px-4 text-sm font-semibold text-text hover:bg-bg disabled:opacity-40">Cancel</button><button type="button" onClick={() => void request('apply')} disabled={busy || !preview?.canApply || pendingChanges === 0} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"><MorphIcon icon={busy ? RefreshCcw : Check} hoverIcon={Upload} className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Processing...' : `Apply ${pendingChanges} changes`}</button></div>
      </footer>
    </div>
  </div>
}

function Metric({ label, value, tone = 'text-text' }: { label: string; value: number; tone?: string }) {
  return <div className="bg-surface px-3 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p><p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p></div>
}

function displayValue(value: string | null) {
  return value || 'Blank'
}
