'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'

export async function submitAttendanceCodeAction(code: string): Promise<{ success?: true; error?: string }> {
  const session = await requireRole(['student'])
  if (!/^\d{6}$/.test(code)) return { error: 'Enter a valid six-digit attendance code.' }

  const student = await db.student.findFirst({
    where: { userId: session.id },
  })
  if (!student) return { error: 'Student record not found' }

  const now = new Date()

  try {
    return await db.$transaction(async (tx) => {
      const attendanceCode = await tx.attendanceCode.findUnique({
        where: { code },
      })

      if (!attendanceCode) return { error: 'Invalid code' }
      if (attendanceCode.expiresAt < now) return { error: 'This code has expired' }

      const [term, schoolClass] = await Promise.all([
        tx.term.findUnique({
          where: { id: attendanceCode.termId },
          select: { academicYearId: true, startDate: true, endDate: true },
        }),
        tx.class.findUnique({ where: { id: attendanceCode.classId }, select: { academicYearId: true } }),
      ])
      if (!term || !schoolClass || term.academicYearId !== schoolClass.academicYearId) {
        return { error: 'This attendance code is no longer valid.' }
      }

      const date = new Date(attendanceCode.date)
      date.setHours(0, 0, 0, 0)
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const termStart = new Date(term.startDate)
      termStart.setHours(0, 0, 0, 0)
      const termEnd = new Date(term.endDate)
      termEnd.setHours(0, 0, 0, 0)
      if (date.getTime() !== today.getTime() || date < termStart || date > termEnd) {
        return { error: 'This attendance code is not valid for today.' }
      }

      const enrolment = await tx.classEnrolment.findUnique({
        where: { classId_studentId: { classId: attendanceCode.classId, studentId: student.id } },
        select: { status: true },
      })
      if (!enrolment || enrolment.status !== 'active') {
        return { error: 'You are not actively enrolled in this class.' }
      }

      const existing = await tx.attendanceCodeUsage.findUnique({
        where: { codeId_studentId: { codeId: attendanceCode.id, studentId: student.id } },
      })
      if (existing) return { error: 'You have already used this code' }

      await tx.attendanceCodeUsage.create({
        data: { codeId: attendanceCode.id, studentId: student.id },
      })

      await tx.attendance.upsert({
        where: { studentId_date: { studentId: student.id, date } },
        create: {
          studentId: student.id,
          termId: attendanceCode.termId,
          date,
          status: 'present',
          markedById: session.id,
          markedAt: now,
        },
        update: {
          status: 'present',
          markedById: session.id,
          markedAt: now,
        },
      })

      return { success: true as const }
    })
  } catch {
    return { error: 'Failed to record attendance. Please try again.' }
  }
}
