import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import ReportCardEditor from './report-card-editor'

type PageProps = {
  params: Promise<{ studentId: string }>
  searchParams: Promise<{ termId?: string }>
}

export default async function ReportCardEditorPage({ params, searchParams }: PageProps) {
  const actor = await requireRole(['admin', 'teacher'])

  const { studentId } = await params
  const sp = await searchParams
  const termId = sp.termId

  const [student, terms, settings] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { name: true, email: true } } },
    }),
    db.term.findMany({
      include: { academicYear: true },
      orderBy: [{ academicYear: { year: 'desc' } }, { termNumber: 'asc' }],
    }),
    db.schoolSettings.findFirst({ select: { aiProvider: true, aiReportMode: true } }),
  ])

  if (!student) {
    return <div className="p-8 text-slate-500">Student not found.</div>
  }

  if (actor.role === 'teacher') {
    const selectedTerm = termId ? terms.find(term => term.id === termId) : null
    const assignedClass = await db.classEnrolment.findFirst({
      where: {
        studentId,
        status: 'active',
        class: {
          ...(selectedTerm ? { academicYearId: selectedTerm.academicYearId } : {}),
          teachers: { some: { staff: { userId: actor.id } } },
        },
      },
      select: { id: true },
    })
    if (!assignedClass) redirect('/unauthorized')
  }

  const existingCard = termId
    ? await db.reportCard.findUnique({
      where: { studentId_termId: { studentId, termId } },
      include: {
        reviewer: { select: { name: true } },
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { actor: { select: { name: true } } },
        },
      },
    })
    : null

  const aiEnabled = !!settings?.aiProvider && settings.aiProvider !== 'none'

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/reports/report-cards"
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Report Cards
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{student.user.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">Edit report card comments</p>
      </div>

      <ReportCardEditor
        studentId={studentId}
        studentName={student.user.name}
        terms={terms.map(t => ({ id: t.id, label: `${t.academicYear.year} — ${t.name}` }))}
        selectedTermId={termId ?? null}
        initialComments={existingCard?.comments ?? ''}
        initialTeacherNotes={existingCard?.teacherNotes ?? ''}
        initialPrincipalNotes={actor.role === 'admin' ? existingCard?.principalNotes ?? '' : ''}
        isAdmin={actor.role === 'admin'}
        approvalStatus={existingCard?.approvalStatus ?? 'draft'}
        reviewedBy={existingCard?.reviewer?.name ?? null}
        rejectionReason={existingCard?.rejectionReason ?? null}
        revisions={existingCard?.revisions.map(revision => ({
          id: revision.id,
          action: revision.action,
          actorName: revision.actor.name,
          createdAt: revision.createdAt.toISOString(),
          approvalStatus: revision.approvalStatus,
          comments: revision.comments,
          rejectionReason: revision.rejectionReason,
        })) ?? []}
        aiEnabled={aiEnabled}
      />
    </div>
  )
}
