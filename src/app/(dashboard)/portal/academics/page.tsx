import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { ChevronLeft, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { weightedAveragePercent } from '@/lib/grade-calculation'

const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default async function PortalAcademicsPage() {
  const user = await requireRole(['parent', 'student'])
  const studentWhere = user.role === 'student'
    ? { userId: user.id }
    : { parents: { some: { parent: { userId: user.id } } } }

  const [students, activeYear] = await Promise.all([
    db.student.findMany({
      where: studentWhere,
      include: {
        user: { select: { name: true } },
        classEnrolments: {
          where: { status: 'active' },
          include: { class: { select: { id: true, name: true, subject: true } } },
        },
        grades: {
          orderBy: { gradedAt: 'desc' },
          include: { gradebook: { include: { term: { include: { academicYear: true } }, class: true } } },
        },
        reportCards: {
          where: { published: true, approvalStatus: 'approved' },
          orderBy: { issuedAt: 'desc' },
          take: 12,
        },
      },
      orderBy: { user: { name: 'asc' } },
    }),
    db.academicYear.findFirst({ where: { active: true }, select: { id: true } }),
  ])

  const classIds = [...new Set(students.flatMap(student => student.classEnrolments.map(enrolment => enrolment.class.id)))]
  const termIds = [...new Set(students.flatMap(student => student.reportCards.map(card => card.termId)))]
  const terms = termIds.length
    ? await db.term.findMany({ where: { id: { in: termIds } }, include: { academicYear: true } })
    : []
  const termLabels = new Map(terms.map(term => [term.id, `${term.academicYear.year} — ${term.name}`] as const))
  const slots = classIds.length && activeYear
    ? await db.timetableSlot.findMany({
      where: { classId: { in: classIds }, class: { academicYearId: activeYear.id }, dayOfWeek: { gte: 1, lte: 5 } },
      include: { class: { select: { id: true, name: true, subject: true } }, room: true, staff: { include: { user: { select: { name: true } } } } },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
    : []
  const upcomingExams = classIds.length
    ? await db.exam.findMany({
      where: { classId: { in: classIds }, status: 'published', startsAt: { gte: new Date() } },
      include: { schoolClass: { select: { id: true, name: true, subject: true } }, term: { include: { academicYear: true } }, room: true },
      orderBy: { startsAt: 'asc' },
      take: 50,
    })
    : []

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/portal" className="mb-4 inline-flex items-center text-sm text-slate-500 hover:text-slate-700">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Portal
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Academics</h1>
        <p className="mt-1 text-sm text-slate-500">Published report cards, term grades and the current timetable.</p>
      </div>

      {students.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-500">No student profiles are linked to your account.</CardContent></Card>
      ) : students.map(student => {
        const enrolledClassIds = new Set(student.classEnrolments.map(enrolment => enrolment.class.id))
        const studentSlots = slots.filter(slot => enrolledClassIds.has(slot.class.id))
        const studentExams = upcomingExams.filter(exam => enrolledClassIds.has(exam.schoolClass.id))
        const currentGrades = student.grades.filter(grade => grade.gradebook.term.academicYear.active)
        const currentGroups = new Map<string, { subject: string; termName: string; grades: typeof currentGrades }>()
        for (const grade of currentGrades) {
          const groupId = `${grade.gradebook.termId}:${grade.gradebook.class.id}`
          const subject = grade.gradebook.class.subject ?? grade.gradebook.class.name
          const group = currentGroups.get(groupId)
          currentGroups.set(groupId, { subject, termName: grade.gradebook.term.name, grades: [...(group?.grades ?? []), grade] })
        }

        return (
          <section key={student.id} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{student.user.name}</h2>
              {student.yearLevel != null && <p className="text-sm text-slate-500">Year {student.yearLevel}</p>}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Current academic-year grades</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {currentGroups.size === 0 ? (
                  <p className="text-sm text-slate-500">No current-term grades have been entered yet.</p>
                ) : [...currentGroups.entries()].map(([classId, group]) => {
                  const average = weightedAveragePercent(group.grades.map(grade => ({
                    score: grade.score,
                    maxScore: grade.gradebook.maxScore,
                    weight: grade.gradebook.weight,
                  })))
                  return <div key={classId} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                    <h3 className="font-semibold text-slate-800">{group.subject} · {group.termName}</h3>
                      {average !== null && <span className="font-semibold text-blue-700">{average.toFixed(1)}%</span>}
                    </div>
                    {group.grades.map(grade => <div key={grade.id} className="flex items-start justify-between gap-3 border-t border-slate-100 py-2 text-sm">
                      <div><p className="text-slate-700">{grade.gradebook.name}</p>{grade.comment && <p className="mt-0.5 text-xs text-slate-500">{grade.comment}</p>}</div>
                      <span className="shrink-0 font-medium text-slate-900">{grade.grade ?? (grade.score == null ? '—' : `${grade.score}/${grade.gradebook.maxScore}`)}</span>
                    </div>)}
                  </div>
                })}
                <p className="border-t border-slate-100 pt-3 text-xs text-slate-500">Live gradebook entries are shown here by term. Report cards and their PDFs appear after approval and publication.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Published report cards</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {student.reportCards.length === 0 ? (
                  <p className="text-sm text-slate-500">No report cards have been published yet.</p>
                ) : student.reportCards.map(card => {
                  const termGrades = student.grades.filter(grade => grade.gradebook.termId === card.termId)
                  const gradesBySubject = new Map<string, { subject: string; grades: typeof termGrades }>()
                  for (const grade of termGrades) {
                    const key = grade.gradebook.class.id
                    const subject = grade.gradebook.class.subject ?? grade.gradebook.class.name
                    const group = gradesBySubject.get(key)
                    gradesBySubject.set(key, { subject, grades: [...(group?.grades ?? []), grade] })
                  }
                  const subjectAverages = [...gradesBySubject.values()].map(({ subject, grades }) => ({
                    subject,
                    average: weightedAveragePercent(grades.map(grade => ({
                      score: grade.score,
                      maxScore: grade.gradebook.maxScore,
                      weight: grade.gradebook.weight,
                    }))),
                  })).filter(row => row.average !== null)
                  return (
                    <article key={card.id} className="rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-slate-900">{termLabels.get(card.termId) ?? `Report card — ${card.academicYear}`}</h3>
                          {card.issuedAt && <p className="text-xs text-slate-500">Published {card.issuedAt.toLocaleDateString()}</p>}
                        </div>
                        <a href={`/api/report-card/${student.id}?termId=${encodeURIComponent(card.termId)}`} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          <Download className="h-3.5 w-3.5" /> Download PDF
                        </a>
                      </div>
                      {subjectAverages.length > 0 && (
                        <div className="mt-3 rounded-md bg-slate-50 px-3 py-2">
                          <p className="mb-1 text-xs font-semibold text-slate-600">Weighted averages by subject</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            {subjectAverages.map(row => <span key={row.subject} className="text-slate-600">{row.subject}: <strong className="text-slate-900">{row.average!.toFixed(1)}%</strong></span>)}
                          </div>
                        </div>
                      )}
                      {termGrades.length > 0 && (
                        <div className="mt-3 divide-y divide-slate-100">
                          {termGrades.map(grade => (
                            <div key={grade.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                              <span className="text-slate-700">{grade.gradebook.class.subject ?? grade.gradebook.class.name} · {grade.gradebook.name}</span>
                              <span className="font-semibold text-slate-900">{grade.grade ?? (grade.score == null ? '—' : `${grade.score}/${grade.gradebook.maxScore}`)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {card.comments && <p className="mt-3 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{card.comments}</p>}
                      <Badge className="mt-3">Published</Badge>
                    </article>
                  )
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Current timetable</CardTitle></CardHeader>
              <CardContent>
                {studentSlots.length === 0 ? <p className="text-sm text-slate-500">No timetable available for the active academic year.</p> : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {days.slice(1).map((day, index) => {
                      const daySlots = studentSlots.filter(slot => slot.dayOfWeek === index + 1)
                      if (daySlots.length === 0) return null
                      return <div key={day} className="space-y-2">
                        <h3 className="text-sm font-semibold text-primary">{day}</h3>
                        {daySlots.map(slot => <div key={slot.id} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
                          <p className="font-medium text-slate-900">{slot.startTime}–{slot.endTime} · {slot.class.subject ?? slot.class.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{[slot.staff?.user.name, slot.room?.name].filter(Boolean).join(' · ') || `Period ${slot.period}`}</p>
                        </div>)}
                      </div>
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Upcoming exams</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {studentExams.length === 0 ? <p className="text-sm text-slate-500">No published exams are scheduled.</p> : studentExams.map(exam => (
                  <div key={exam.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 p-3">
                    <div>
                      <p className="font-medium text-slate-900">{exam.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{exam.schoolClass.subject ?? exam.schoolClass.name} · {exam.term.academicYear.year} — {exam.term.name}</p>
                    </div>
                    <div className="text-right text-xs text-slate-600">
                      <p>{exam.startsAt.toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</p>
                      <p>{exam.room?.name ?? 'Room to be confirmed'}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )
      })}
    </div>
  )
}
