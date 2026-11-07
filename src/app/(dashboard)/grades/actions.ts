'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createGradebookAction(formData: FormData) {
  const user = await requireRole(['admin', 'teacher'])

  const name = String(formData.get('name') ?? '').trim().slice(0, 120)
  const classId = String(formData.get('classId') ?? '')
  const termId = String(formData.get('termId') ?? '')
  const type = String(formData.get('type') ?? 'assessment')
  const maxScore = formData.get('maxScore') ? Number(formData.get('maxScore')) : 100
  const weight = formData.get('weight') ? Number(formData.get('weight')) : 1
  const dueDateStr = String(formData.get('dueDate') ?? '')
  const description = String(formData.get('description') ?? '').trim().slice(0, 2000)
  const documentUrlValue = String(formData.get('documentUrl') ?? '').trim()
  let documentUrl: string | null = null
  try {
    if (documentUrlValue) {
      const parsed = new URL(documentUrlValue)
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Invalid URL')
      documentUrl = parsed.toString()
    }
  } catch {
    return { error: 'Enter a valid HTTP or HTTPS document URL.' }
  }

  if (!name || !classId || !termId || !['assessment', 'exam', 'assignment', 'project'].includes(type)) {
    return { error: 'Name, class, term, and a valid assessment type are required.' }
  }
  if (!Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000 || !Number.isFinite(weight) || weight < 0.1 || weight > 100) {
    return { error: 'Maximum score must be positive and the coefficient must be between 0.1 and 100.' }
  }
  const dueDate = dueDateStr ? new Date(`${dueDateStr}T00:00:00.000Z`) : null
  if (dueDate && (Number.isNaN(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== dueDateStr)) {
    return { error: 'Enter a valid due date.' }
  }

  const [schoolClass, term] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { academicYearId: true } }),
    db.term.findUnique({ where: { id: termId }, select: { academicYearId: true } }),
  ])
  if (!schoolClass || !term || schoolClass.academicYearId !== term.academicYearId) {
    return { error: 'The selected class and term must belong to the same academic year.' }
  }

  // Teachers can only create gradebooks for their own classes
  if (user.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: user.id } })
    if (!staff) return { error: 'Staff profile not found' }
    const isTeacher = await db.classTeacher.findFirst({ where: { classId, staffId: staff.id } })
    if (!isTeacher) return { error: 'You are not a teacher of this class' }
  }

  let gradebookId: string
  try {
    const gb = await db.gradebook.create({
      data: {
        name,
        classId,
        termId,
        type: type || 'assessment',
        maxScore,
        weight,
        dueDate,
        description: description || null,
        documentUrl,
      },
    })

    gradebookId = gb.id
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create gradebook'
    return { error: msg }
  }

  revalidatePath('/grades')
  redirect(`/grades/${gradebookId}`)
}

export interface GradeEntry {
  studentId: string
  score?: number | null
  grade?: string | null
  comment?: string | null
}

export async function saveGradesAction(gradebookId: string, grades: GradeEntry[]) {
  const user = await requireRole(['admin', 'teacher'])

  try {
    if (!Array.isArray(grades) || grades.length > 100) return { error: 'Submit at most 100 grade entries at a time.' }
    const gradebook = await db.gradebook.findUnique({
      where: { id: gradebookId },
      select: { id: true, maxScore: true, classId: true, exam: { select: { status: true } } },
    })
    if (!gradebook) return { error: 'Gradebook not found.' }
    if (gradebook.exam?.status === 'cancelled') return { error: 'This exam was cancelled; its grades are read-only.' }
    if (user.role === 'teacher') {
      const staff = await db.staff.findUnique({ where: { userId: user.id }, select: { id: true } })
      const assigned = staff && await db.classTeacher.findFirst({ where: { classId: gradebook.classId, staffId: staff.id }, select: { classId: true } })
      if (!assigned) return { error: 'You are not a teacher of this class.' }
    }
    if (new Set(grades.map(entry => entry.studentId)).size !== grades.length) return { error: 'Duplicate students are not allowed.' }
    if (grades.some(entry => !entry.studentId || (entry.score != null && (!Number.isFinite(entry.score) || entry.score < 0 || entry.score > gradebook.maxScore)))) {
      return { error: `Scores must be between 0 and ${gradebook.maxScore}.` }
    }
    const enrolled = await db.classEnrolment.findMany({
      where: { classId: gradebook.classId, status: 'active', studentId: { in: grades.map(entry => entry.studentId) } },
      select: { studentId: true },
    })
    if (enrolled.length !== grades.length) return { error: 'One or more students are not actively enrolled in this class.' }

    await db.$transaction(
      grades.map((entry) =>
        db.grade.upsert({
          where: { gradebookId_studentId: { gradebookId, studentId: entry.studentId } },
          create: {
            gradebookId,
            studentId: entry.studentId,
            score: entry.score ?? null,
            grade: entry.grade || null,
            comment: entry.comment || null,
            gradedAt: entry.score != null ? new Date() : null,
            gradedById: entry.score != null ? user.id : null,
          },
          update: {
            score: entry.score ?? null,
            grade: entry.grade || null,
            comment: entry.comment || null,
            gradedAt: entry.score != null ? new Date() : null,
            gradedById: entry.score != null ? user.id : null,
          },
        })
      )
    )

    revalidatePath(`/grades/${gradebookId}`)
    revalidatePath('/reports/grades')
    revalidatePath('/portal/academics')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save grades'
    return { error: msg }
  }
}

export async function updateGradeAction(
  gradeId: string,
  data: { score?: number | null; grade?: string | null; comment?: string | null }
) {
  const user = await requireRole(['admin', 'teacher'])

  try {
    const existing = await db.grade.findUnique({
      where: { id: gradeId },
      select: { gradebook: { select: { classId: true, maxScore: true, exam: { select: { status: true } } } }, studentId: true },
    })
    if (!existing) return { error: 'Grade not found.' }
    if (existing.gradebook.exam?.status === 'cancelled') return { error: 'This exam was cancelled; its grades are read-only.' }
    if (user.role === 'teacher') {
      const staff = await db.staff.findUnique({ where: { userId: user.id }, select: { id: true } })
      const assigned = staff && await db.classTeacher.findFirst({ where: { classId: existing.gradebook.classId, staffId: staff.id }, select: { classId: true } })
      if (!assigned) return { error: 'You are not a teacher of this class.' }
    }
    if (data.score != null && (!Number.isFinite(data.score) || data.score < 0 || data.score > existing.gradebook.maxScore)) {
      return { error: `Score must be between 0 and ${existing.gradebook.maxScore}.` }
    }
    await db.grade.update({
      where: { id: gradeId },
      data: {
        score: data.score ?? null,
        grade: data.grade || null,
        comment: data.comment || null,
        gradedAt: data.score != null ? new Date() : null,
        gradedById: data.score != null ? user.id : null,
      },
    })

    const grade = await db.grade.findUnique({ where: { id: gradeId } })
    if (grade) {
      revalidatePath(`/grades/${grade.gradebookId}`)
      revalidatePath('/reports/grades')
      revalidatePath('/portal/academics')
    }
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update grade'
    return { error: msg }
  }
}
