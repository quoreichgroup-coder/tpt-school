'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function examDate(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(`${value}:00Z`)
  if (Number.isNaN(date.getTime())) return null
  const [day, clock] = value.split('T')
  return date.toISOString().startsWith(`${day}T${clock}:00.000Z`) ? date : null
}

async function hasExamConflict(input: {
  classId: string
  startsAt: Date
  endsAt: Date
  roomId?: string | null
  invigilatorId?: string | null
  ignoreId?: string
}) {
  const conflict = await db.exam.findFirst({
    where: {
      status: { not: 'cancelled' },
      startsAt: { lt: input.endsAt },
      endsAt: { gt: input.startsAt },
      ...(input.ignoreId ? { id: { not: input.ignoreId } } : {}),
      OR: [
        { classId: input.classId },
        ...(input.roomId ? [{ roomId: input.roomId }] : []),
        ...(input.invigilatorId ? [{ invigilatorId: input.invigilatorId }] : []),
      ],
    },
    select: { id: true },
  })
  return !!conflict
}

export async function createExamAction(formData: FormData) {
  const actor = await requireRole(['admin', 'teacher'])
  const title = String(formData.get('title') ?? '').trim().slice(0, 120)
  const classId = String(formData.get('classId') ?? '')
  const termId = String(formData.get('termId') ?? '')
  const roomId = String(formData.get('roomId') ?? '') || null
  const invigilatorId = String(formData.get('invigilatorId') ?? '') || null
  const startsAt = examDate(formData.get('startsAt'))
  const endsAt = examDate(formData.get('endsAt'))
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 1000) || null
  const maxScore = Number(formData.get('maxScore') ?? 100)

  if (!title || !classId || !termId || !startsAt || !endsAt || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 6 * 60 * 60 * 1000 || !Number.isFinite(maxScore) || maxScore <= 0 || maxScore > 1000) {
    redirect('/exams?error=invalid')
  }

  const schoolClass = await db.class.findUnique({
    where: { id: classId },
    select: { id: true, academicYearId: true, teachers: { select: { staffId: true } }, enrolments: { where: { status: 'active' }, select: { id: true } } },
  })
  const term = await db.term.findUnique({ where: { id: termId } })
  if (!schoolClass || !term || term.academicYearId !== schoolClass.academicYearId) redirect('/exams?error=invalid')
  if (actor.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: actor.id }, select: { id: true } })
    if (!staff || !schoolClass.teachers.some(teacher => teacher.staffId === staff.id)) redirect('/unauthorized')
  }

  const termEndExclusive = new Date(term.endDate.getTime() + 24 * 60 * 60 * 1000)
  if (startsAt < term.startDate || endsAt >= termEndExclusive) redirect('/exams?error=outside-term')

  if (roomId) {
    const room = await db.room.findUnique({ where: { id: roomId }, select: { capacity: true } })
    if (!room || (room.capacity != null && room.capacity < schoolClass.enrolments.length)) redirect('/exams?error=room-capacity')
  }
  if (invigilatorId && !await db.staff.findUnique({ where: { id: invigilatorId }, select: { id: true } })) redirect('/exams?error=invalid')

  if (await hasExamConflict({ classId, startsAt, endsAt, roomId, invigilatorId })) redirect('/exams?error=conflict')

  try {
    await db.$transaction(async tx => {
      const gradebook = await tx.gradebook.create({
        data: { classId, termId, name: title, type: 'exam', maxScore, weight: 1, dueDate: startsAt, description: notes },
        select: { id: true },
      })
      await tx.exam.create({
        data: { classId, termId, title, startsAt, endsAt, roomId, invigilatorId, notes, createdById: actor.id, gradebookId: gradebook.id },
      })
    })
  } catch (error) {
    console.error('createExamAction error:', error)
    redirect('/exams?error=save')
  }

  revalidatePath('/exams')
  revalidatePath('/grades')
  revalidatePath('/portal/academics')
  redirect('/exams?created=1')
}

export async function updateExamStatusAction(formData: FormData) {
  await requireRole(['admin'])
  const examId = String(formData.get('examId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!examId || !['published', 'cancelled'].includes(status)) redirect('/exams?error=invalid')

  const exam = await db.exam.findUnique({ where: { id: examId } })
  if (!exam) redirect('/exams?error=missing')
  if (exam.status === 'cancelled' && status === 'published') redirect('/exams?error=invalid')
  if (status === 'published' && await hasExamConflict({
    classId: exam.classId, startsAt: exam.startsAt, endsAt: exam.endsAt,
    roomId: exam.roomId, invigilatorId: exam.invigilatorId, ignoreId: exam.id,
  })) redirect('/exams?error=conflict')

  await db.exam.update({ where: { id: examId }, data: { status } })
  revalidatePath('/exams')
  revalidatePath('/grades')
  if (exam.gradebookId) revalidatePath(`/grades/${exam.gradebookId}`)
  revalidatePath('/portal/academics')
  redirect('/exams?updated=1')
}
