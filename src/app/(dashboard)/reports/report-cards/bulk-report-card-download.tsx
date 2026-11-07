'use client'

import JSZip from 'jszip'
import { useEffect, useState } from 'react'

type StudentFile = { id: string; studentId: string; name: string }

export default function BulkReportCardDownload({ students, termId }: { students: StudentFile[]; termId: string }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [archiveUrl, setArchiveUrl] = useState<string | null>(null)

  useEffect(() => () => {
    if (archiveUrl) URL.revokeObjectURL(archiveUrl)
  }, [archiveUrl])

  async function prepareArchive() {
    setBusy(true)
    setError(null)
    setArchiveUrl(null)
    const zip = new JSZip()

    try {
      for (let index = 0; index < students.length; index++) {
        const student = students[index]
        setProgress(`Preparing ${index + 1} of ${students.length}…`)
        const response = await fetch(`/api/report-card/${encodeURIComponent(student.id)}?termId=${encodeURIComponent(termId)}`, {
          credentials: 'same-origin',
          cache: 'no-store',
        })
        if (!response.ok) throw new Error(`Could not generate the report card for ${student.name} (${response.status}).`)

        const safeName = student.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '')
        const safeId = student.studentId.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-')
        zip.file(`${safeId || student.id}-${safeName || 'student'}.pdf`, await response.arrayBuffer())
      }

      setProgress('Compressing PDFs…')
      const archive = await zip.generateAsync({ type: 'blob', compression: 'STORE' })
      setArchiveUrl(URL.createObjectURL(archive))
      setProgress(`${students.length} approved report card(s) ready.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the report-card archive.')
      setProgress('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <button
        type="button"
        onClick={prepareArchive}
        disabled={busy || students.length === 0}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Preparing ZIP…' : 'Prepare approved PDFs (.zip)'}
      </button>
      {archiveUrl && <a href={archiveUrl} download={`QSCHOOL-report-cards-${termId}.zip`} className="text-sm font-medium text-blue-700 underline">Download ZIP</a>}
      {progress && <span role="status" className="text-xs text-slate-500">{progress}</span>}
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </div>
  )
}
