import { NextResponse } from 'next/server'
import { readSheet } from 'read-excel-file/node'
import type { BatchItem } from 'drizzle-orm/batch'
import { eq } from 'drizzle-orm'
import { requireSuperadmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { syncImportedIDesignCases } from '@/lib/idesign/importedCases'
import {
  buildIDesignImportPreview,
  importValuesForChange,
  parseIDesignImportSheet,
  sourceKeyForImport,
  type ImportPreview,
} from '@/lib/idesign/importOrders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_WORKBOOK_BYTES = 4 * 1024 * 1024

export async function POST(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  const action = formData?.get('action')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an Excel workbook' }, { status: 400 })
  if (action !== 'preview' && action !== 'apply') return NextResponse.json({ error: 'Invalid import action' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.xlsx')) return NextResponse.json({ error: 'Upload an .xlsx Excel workbook' }, { status: 400 })
  if (file.size === 0 || file.size > MAX_WORKBOOK_BYTES) {
    return NextResponse.json({ error: 'The Excel workbook must be smaller than 4 MB' }, { status: 400 })
  }

  let sheetRows: unknown[][]
  try {
    sheetRows = await readSheet(Buffer.from(await file.arrayBuffer())) as unknown[][]
  } catch (workbookError) {
    console.error('Unable to parse iDesign import workbook:', workbookError)
    return NextResponse.json({ error: 'This Excel workbook could not be read. Export the first worksheet as a standard .xlsx file and try again.' }, { status: 400 })
  }

  const parsed = parseIDesignImportSheet(sheetRows)
  const db = getDb()
  const existingRows = await db.select().from(idesignOrders)
  const preview = buildIDesignImportPreview(parsed.rows, existingRows, parsed.issues)
  if (action === 'preview') return NextResponse.json(publicPreview(preview))
  if (!preview.canApply) {
    return NextResponse.json({ error: 'Resolve the workbook errors and conflicts before importing', ...publicPreview(preview) }, { status: 409 })
  }

  const rowsByNumber = new Map(parsed.rows.map((row) => [row.rowNumber, row]))
  const mutations: BatchItem<'pg'>[] = []
  for (const change of preview.changes) {
    const row = rowsByNumber.get(change.rowNumber)
    if (!row) continue
    if (change.action === 'create') {
      mutations.push(db.insert(idesignOrders).values({
        ...row.data,
        sourceKey: sourceKeyForImport(row),
        createdBy: Number(session!.user.id),
      }).returning({ id: idesignOrders.id }))
    } else if (change.existingId) {
      const values = importValuesForChange(row, change)
      mutations.push(db.update(idesignOrders).set({
        ...values,
        updatedAt: new Date(),
      }).where(eq(idesignOrders.id, change.existingId)).returning({ id: idesignOrders.id }))
    }
  }

  let appliedIds: number[] = []
  if (mutations.length > 0) {
    const results = await db.batch(mutations as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]) as Array<Array<{ id: number }>>
    appliedIds = results.flatMap((result) => result.map((row) => row.id))
    await syncImportedIDesignCases(appliedIds)
  }

  return NextResponse.json({
    success: true,
    applied: appliedIds.length,
    created: preview.summary.newRows,
    updated: preview.summary.updatedRows,
    unchanged: preview.summary.unchangedRows,
    stale: preview.summary.staleRows,
  })
}

function publicPreview(preview: ImportPreview) {
  return {
    summary: preview.summary,
    changes: preview.changes.slice(0, 100),
    issues: preview.issues.slice(0, 100),
    canApply: preview.canApply,
    detailsTruncated: preview.detailsTruncated,
  }
}
