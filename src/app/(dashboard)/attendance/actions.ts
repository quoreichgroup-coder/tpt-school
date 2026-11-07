'use server'

import { randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { checkTruancyAction } from '@/app/(dashboard)/behaviour/actions'

export interface AttendanceRecord {
  studentId: string
  status: string
  notes?: string
}

export async function saveAttendanceAction(
  classId: string,
  records: AttendanceRecord[]
) {
  const session = await requireRole(['admin', 'teacher'])

  const validStatuses = ['present', 'absent', 'late', 'excused']
  if (!classId || !Array.isArray(records) || records.length === 0 || records.length > 200) {
    return { error: 'Saisissez entre 1 et 200 présences pour une classe.' }
  }
  if (new Set(records.map(record => record.studentId)).size !== records.length || records.some(record =>
    typeof record.studentId !== 'string' || !record.studentId || !validStatuses.includes(record.status) ||
    (record.notes != null && (typeof record.notes !== 'string' || record.notes.length > 1000))
  )) return { error: 'Les présences contiennent des entrées invalides ou en double.' }

  // Find the current term
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const term = await db.term.findFirst({
    where: {
      startDate: { lte: new Date() },
      endDate: { gte: new Date() },
    },
    orderBy: { startDate: 'desc' },
  })

  if (!term) {
    return { error: 'Aucun trimestre actif aujourd’hui.' }
  }

  const schoolClass = await db.class.findUnique({ where: { id: classId }, select: { academicYearId: true } })
  if (!schoolClass) return { error: 'Classe introuvable.' }
  const termYear = await db.term.findUnique({ where: { id: term.id }, select: { academicYearId: true } })
  if (!termYear || schoolClass.academicYearId !== termYear.academicYearId) return { error: 'Cette classe n’a pas de trimestre actif aujourd’hui.' }
  if (session.role === 'teacher') {
    const assigned = await db.classTeacher.findFirst({
      where: { classId, staff: { userId: session.id } },
      select: { classId: true },
    })
    if (!assigned) return { error: 'Vous n’êtes pas enseignant de cette classe.' }
  }

  const enrolled = await db.classEnrolment.findMany({
    where: { classId, status: 'active', studentId: { in: records.map(record => record.studentId) } },
    select: { studentId: true },
  })
  if (enrolled.length !== records.length) return { error: 'Un ou plusieurs élèves ne sont pas inscrits activement dans cette classe.' }

  try {
    // Upsert each attendance record
    await db.$transaction(
      records.map((record) =>
        db.attendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date: today } },
          create: {
            studentId: record.studentId,
            termId: term.id,
            date: today,
            status: record.status,
            notes: record.notes || null,
            markedById: session.id,
            markedAt: new Date(),
          },
          update: {
            status: record.status,
            notes: record.notes || null,
            markedById: session.id,
            markedAt: new Date(),
          },
        })
      )
    )

    // Run truancy checks for all students in the roll (fire-and-forget, don't block save)
    const absentStudents = records.filter(r => r.status === 'absent').map(r => r.studentId)
    if (absentStudents.length > 0) {
      await Promise.all(absentStudents.map(sid => checkTruancyAction(sid, term.id)))
    }

    revalidatePath(`/attendance/roll/${classId}`)
    revalidatePath('/attendance')
    revalidatePath('/behaviour')
    return { success: true }
  } catch (e: unknown) {
    console.error('saveAttendanceAction error:', e)
    return { error: 'Impossible d’enregistrer les présences. Réessayez.' }
  }
}

export async function generateAttendanceCodeAction(
  classId: string,
  termId: string,
  windowMins = 5,
): Promise<{ code: string; expiresAt: string } | { error: string }> {
  const session = await requireRole(['admin', 'teacher'])

  if (!Number.isInteger(windowMins) || windowMins < 1 || windowMins > 60) {
    return { error: 'La durée du code de présence doit être comprise entre 1 et 60 minutes.' }
  }
  const [schoolClass, term] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { academicYearId: true } }),
    db.term.findUnique({ where: { id: termId }, select: { academicYearId: true, startDate: true, endDate: true } }),
  ])
  if (!schoolClass || !term || schoolClass.academicYearId !== term.academicYearId) {
    return { error: 'Choisissez une classe et un trimestre valides.' }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const termStart = new Date(term.startDate)
  termStart.setHours(0, 0, 0, 0)
  const termEnd = new Date(term.endDate)
  termEnd.setHours(23, 59, 59, 999)
  if (today < termStart || today > termEnd) return { error: 'Le trimestre choisi n’est pas actif aujourd’hui.' }
  if (session.role === 'teacher') {
    const assigned = await db.classTeacher.findFirst({
      where: { classId, staff: { userId: session.id } },
      select: { classId: true },
    })
    if (!assigned) return { error: 'Vous n’êtes pas enseignant de cette classe.' }
  }

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const now = new Date()
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  const expiresAt = new Date(now.getTime() + windowMins * 60 * 1000)

  const record = await db.attendanceCode.create({
    data: { code, classId, date, termId, createdById: session.id, windowMins, expiresAt },
  })

  return { code: record.code, expiresAt: record.expiresAt.toISOString() }
}

export interface AttendanceFilters {
  studentId?: string
  classId?: string
  startDate?: string
  endDate?: string
}

export async function getAttendanceReport(filters: AttendanceFilters) {
  await requireRole(['admin'])

  const startDate = filters.startDate ? new Date(filters.startDate) : undefined
  const endDate = filters.endDate ? new Date(filters.endDate) : undefined
  if (endDate) endDate.setHours(23, 59, 59, 999)

  // If filtering by classId, get enrolled student IDs
  let studentIds: string[] | undefined
  if (filters.classId) {
    const enrolments = await db.classEnrolment.findMany({
      where: { classId: filters.classId, status: 'active' },
      select: { studentId: true },
    })
    studentIds = enrolments.map((e: { studentId: string }) => e.studentId)
  }

  const records = await db.attendance.findMany({
    where: {
      ...(filters.studentId ? { studentId: filters.studentId } : {}),
      ...(studentIds ? { studentId: { in: studentIds } } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            },
          }
        : {}),
    },
    include: {
      student: { include: { user: true } },
      term: true,
    },
    orderBy: [{ date: 'desc' }, { student: { user: { name: 'asc' } } }],
  })

  return records
}
