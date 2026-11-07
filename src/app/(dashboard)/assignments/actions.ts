'use server'

import { db } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export async function getChildAssignmentsAction(childId: string) {
  const session = await requireSession()
  if (session.role !== 'parent') return { error: 'Accès non autorisé.', assignments: [] }

  const parent = await db.parent.findUnique({
    where: { userId: session.id },
    select: { students: { where: { studentId: childId }, select: { studentId: true } } },
  })
  if (!parent?.students.length) return { error: 'Cet élève n’est pas associé à votre compte.', assignments: [] }

  const enrolments = await db.classEnrolment.findMany({
    where: { studentId: childId, status: 'active' },
    include: {
      class: {
        include: {
          gradebooks: {
            include: { term: { select: { name: true } }, grades: { where: { studentId: childId } } },
            orderBy: { dueDate: 'asc' },
          },
        },
      },
    },
  })

  const assignments = enrolments.flatMap((enrolment) => enrolment.class.gradebooks.map((gb) => {
    const grade = gb.grades[0] ?? null
    return {
      id: gb.id, name: gb.name, description: gb.description, type: gb.type,
      maxScore: gb.maxScore, dueDate: gb.dueDate, documentUrl: gb.documentUrl,
      className: enrolment.class.name, termName: gb.term.name,
      score: grade?.score ?? null, gradeLabel: grade?.grade ?? null,
      comment: grade?.comment ?? null, submittedAt: grade?.submittedAt ?? null,
      submissionUrl: grade?.submissionUrl ?? null, gradedAt: grade?.gradedAt ?? null,
    }
  }))
  return { assignments }
}

export async function submitAssignmentAction(
  gradebookId: string,
  submissionUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student') {
    return { success: false, error: 'Seuls les élèves peuvent remettre un devoir.' }
  }

  const student = await db.student.findUnique({ where: { userId: session.id } })
  if (!student) return { success: false, error: 'Profil élève introuvable.' }

  const gradebook = await db.gradebook.findUnique({ where: { id: gradebookId } })
  if (!gradebook) return { success: false, error: 'Devoir introuvable.' }

  // Verify student is enrolled in the class
  const enrolment = await db.classEnrolment.findUnique({
    where: { classId_studentId: { classId: gradebook.classId, studentId: student.id } },
  })
  if (!enrolment || enrolment.status !== 'active') {
    return { success: false, error: 'Vous n’êtes pas inscrit dans cette classe.' }
  }

  await db.grade.upsert({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
    create: {
      gradebookId,
      studentId: student.id,
      submittedAt: new Date(),
      submissionUrl: submissionUrl?.trim() || null,
    },
    update: {
      submittedAt: new Date(),
      submissionUrl: submissionUrl?.trim() || null,
    },
  })

  revalidatePath('/assignments')
  return { success: true }
}

export async function unsubmitAssignmentAction(
  gradebookId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession()
  if (session.role !== 'student') return { success: false, error: 'Accès non autorisé.' }

  const student = await db.student.findUnique({ where: { userId: session.id } })
  if (!student) return { success: false, error: 'Profil élève introuvable.' }

  const grade = await db.grade.findUnique({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
  })
  if (!grade) return { success: true } // nothing to un-submit

  // Can't unsubmit if already graded
  if (grade.gradedAt) return { success: false, error: 'Ce devoir a déjà été corrigé et ne peut plus être retiré.' }

  await db.grade.update({
    where: { gradebookId_studentId: { gradebookId, studentId: student.id } },
    data: { submittedAt: null, submissionUrl: null },
  })

  revalidatePath('/assignments')
  return { success: true }
}
