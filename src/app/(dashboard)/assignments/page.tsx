import { requireSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import AssignmentList from './assignment-list'

export default async function AssignmentsPage() {
  const user = await requireSession()
  if (user.role === 'accountant') redirect('/finance')

  // Teachers and admins see the workload page instead
  if (user.role === 'admin' || user.role === 'teacher') redirect('/workload')

  let studentId: string | null = null
  let childOptions: { id: string; name: string }[] = []

  if (user.role === 'student') {
    const student = await db.student.findUnique({ where: { userId: user.id } })
    if (!student) redirect('/portal')
    studentId = student.id
  } else if (user.role === 'parent') {
    const parent = await db.parent.findUnique({
      where: { userId: user.id },
      include: {
        students: {
          include: { student: { include: { user: { select: { name: true } } } } },
        },
      },
    })
    childOptions = (parent?.students ?? []).map((ps) => ({
      id: ps.student.id,
      name: ps.student.user.name,
    }))
    if (childOptions.length === 1) studentId = childOptions[0].id
  }

  const loadAssignments = async (sid: string) => {
    const enrolments = await db.classEnrolment.findMany({
      where: { studentId: sid, status: 'active' },
      include: {
        class: {
          include: {
            gradebooks: {
              include: {
                term: { select: { name: true } },
                grades: { where: { studentId: sid } },
              },
              orderBy: { dueDate: 'asc' },
            },
          },
        },
      },
    })

    return enrolments.flatMap((e) =>
      e.class.gradebooks.map((gb) => {
        const myGrade = gb.grades[0] ?? null
        return {
          id: gb.id,
          name: gb.name,
          description: gb.description,
          type: gb.type,
          maxScore: gb.maxScore,
          dueDate: gb.dueDate,
          documentUrl: gb.documentUrl,
          className: e.class.name,
          termName: gb.term.name,
          score: myGrade?.score ?? null,
          gradeLabel: myGrade?.grade ?? null,
          comment: myGrade?.comment ?? null,
          submittedAt: myGrade?.submittedAt ?? null,
          submissionUrl: myGrade?.submissionUrl ?? null,
          gradedAt: myGrade?.gradedAt ?? null,
        }
      }),
    )
  }

  const assignments = studentId ? await loadAssignments(studentId) : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Devoirs</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Consultez vos devoirs, remettez votre travail et vérifiez vos résultats.
          Vous pouvez joindre un lien Google Docs, OneDrive ou toute autre adresse web.
        </p>
      </div>

      <AssignmentList
        assignments={assignments}
        studentId={studentId}
        childOptions={childOptions}
        isParent={user.role === 'parent'}
      />
    </div>
  )
}
