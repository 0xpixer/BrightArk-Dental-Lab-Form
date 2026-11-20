'use client'

import { useContext, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ExternalLink, FileText, FileUp, Trash2, Upload } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDESIGN_APPROVE_BUTTON_CLASS, IDESIGN_VIEW_BUTTON_CLASS } from '@/components/idesign/IDesignTreatmentPlans'
import { crmNeedsContract } from '@/lib/crm/crm'
import { CrmApiBase } from './CrmCells'
import { formatCrmDate } from './crmTypes'

const ACCEPT = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function uploadCrmContract(file: File, doctorName: string) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Contract must be under 20 MB')
  const slug = doctorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'doctor'
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf'
  const result = await upload(`crm-contracts/${slug}-contract.${extension}`, file, { access: 'public', handleUploadUrl: '/api/upload' })
  return { url: result.url, fileName: file.name.slice(0, 300) }
}

export interface ContractState { id: number | null; fullName: string; accountType: string | null; hasContract: boolean; contractFileName: string | null; contractUploadedAt: string | null }

/**
 * Contract entry for KA / OEM / Distributor doctors. `cell` = compact table cell, `block` = sheet/form section.
 * `onChange` receives the uploaded file (or null to remove); the parent saves it.
 */
export function ContractControl({ record, variant, onChange, onError, pendingFileName }: {
  record: ContractState
  variant: 'cell' | 'block'
  onChange: (contract: { url: string; fileName: string } | null) => Promise<void> | void
  onError: (message: string) => void
  /** Add-doctor form: a contract uploaded but not saved yet. */
  pendingFileName?: string | null
}) {
  const apiBase = useContext(CrmApiBase)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  if (!crmNeedsContract(record.accountType)) {
    if (variant === 'block') return null
    return <span className="text-xs text-text-muted">{record.accountType === 'Non-KA' ? 'Not required' : '—'}</span>
  }

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      await onChange(await uploadCrmContract(file, record.fullName))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Contract upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const fileInput = <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
  const hasFile = Boolean(pendingFileName) || record.hasContract
  const fileName = pendingFileName ?? record.contractFileName ?? 'Contract'
  const viewLink = record.id && record.hasContract && !pendingFileName
    ? <a href={`${apiBase}/${record.id}/contract`} target="_blank" rel="noreferrer" className={IDESIGN_VIEW_BUTTON_CLASS} title={fileName}><MorphIcon icon={FileText} hoverIcon={ExternalLink} className="h-3 w-3" />View contract</a>
    : null
  const uploadButton = <button type="button" onClick={() => input.current?.click()} disabled={busy} className={hasFile ? 'inline-flex h-8 items-center gap-1 rounded-card px-2 text-[11px] font-medium text-text-muted underline-offset-4 hover:text-text hover:underline disabled:opacity-40 max-md:h-11' : `${IDESIGN_APPROVE_BUTTON_CLASS} gap-1.5`}>
    <MorphIcon icon={hasFile ? FileUp : Upload} className="h-3 w-3" />{busy ? 'Uploading…' : hasFile ? 'Replace' : 'Upload contract'}
  </button>

  if (variant === 'cell') {
    return <div className="flex flex-wrap items-center gap-1">{viewLink}{uploadButton}{fileInput}</div>
  }

  return (
    <section className="space-y-2 rounded-card border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">Contract</h3>
        <span className="text-[11px] text-text-muted">Required for {record.accountType}</span>
      </div>
      {hasFile
        ? <p className="truncate text-xs text-text" title={fileName}>{fileName}{record.contractUploadedAt && !pendingFileName ? <span className="text-text-muted"> · uploaded {formatCrmDate(record.contractUploadedAt)}</span> : null}</p>
        : <p className="text-xs text-amber-700">No contract on file yet</p>}
      <div className="flex flex-wrap items-center gap-2">
        {viewLink}
        {uploadButton}
        {hasFile && !busy && <button type="button" onClick={() => void onChange(null)} className="inline-flex h-8 items-center gap-1 rounded-card px-2 text-[11px] font-medium text-red-700 hover:bg-red-50 max-md:h-11"><MorphIcon icon={Trash2} className="h-3 w-3" />Remove</button>}
      </div>
      {fileInput}
    </section>
  )
}
