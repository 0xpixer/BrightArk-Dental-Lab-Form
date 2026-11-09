import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { canDownloadIDesignCaseFiles } from '@/lib/idesign/access'
import { buildIDesignCaseFilesZip, type IDesignStoredFiles } from '@/lib/idesign/buildCaseFilesZip'
import { getAccessibleIDesignCase } from '@/lib/idesign/workflow'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canDownloadIDesignCaseFiles(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const caseId = Number(params.id)
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return NextResponse.json({ error: 'Invalid case' }, { status: 400 })
  }

  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const zipBuffer = await buildIDesignCaseFilesZip((caseRow.fileUrls as IDesignStoredFiles | null) ?? {})
  if (!zipBuffer) return NextResponse.json({ error: 'No case files are available' }, { status: 404 })

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${caseRow.orderNo}_case_files.zip"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
