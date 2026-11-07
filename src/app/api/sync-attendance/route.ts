import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { checkTruancyAction } from '@/app/(dashboard)/behaviour/actions'

type QueuedRecord = {
  id: string
  studentId: string
  classId: string
  termId: string
  date: string
  status: string
  notes?: string
  markedById: string
}

const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused'])

function parseAttendanceDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value)) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !['admin', 'teacher'].includes(session.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let records: QueuedRecord[]
  try {
    records = await req.json()
    if (!Array.isArray(records) || records.length === 0 || records.length > 200) throw new Error('Expected 1 to 200 records')
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const validRecords = records.filter((record): record is QueuedRecord => !!record &&
    typeof record.id === 'string' && record.id.length > 0 &&
    typeof record.studentId === 'string' && record.studentId.length > 0 &&
    typeof record.classId === 'string' && record.classId.length > 0 &&
    typeof record.termId === 'string' && record.termId.length > 0 &&
    ATTENDANCE_STATUSES.has(record.status) &&
    (record.notes == null || (typeof record.notes === 'string' && record.notes.length <= 1000)) &&
    parseAttendanceDate(record.date) !== null,
  )
  if (validRecords.length !== records.length) {
    return NextResponse.json({ error: 'Attendance records contain invalid values.' }, { status: 400 })
  }
  records = validRecords

  const classIds = [...new Set(records.map(record => record.classId))]
  const termIds = [...new Set(records.map(record => record.termId))]
  const uniqueAttendanceKeys = new Set(records.map(record => `${record.studentId}:${parseAttendanceDate(record.date)!.toISOString()}`))
  if (classIds.length !== 1 || termIds.length !== 1 || uniqueAttendanceKeys.size !== records.length) {
    return NextResponse.json({ error: 'Sync one class and term at a time without duplicate student dates.' }, { status: 400 })
  }

  const classId = classIds[0]
  const termId = termIds[0]
  const [schoolClass, term] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, select: { academicYearId: true } }),
    db.term.findUnique({ where: { id: termId }, select: { academicYearId: true, startDate: true, endDate: true } }),
  ])
  if (!schoolClass || !term || schoolClass.academicYearId !== term.academicYearId) {
    return NextResponse.json({ error: 'Class and term do not match.' }, { status: 400 })
  }

  if (session.role === 'teacher') {
    const assigned = await db.classTeacher.findFirst({
      where: { classId, staff: { userId: session.id } },
      select: { classId: true },
    })
    if (!assigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const studentIds = [...new Set(records.map(record => record.studentId))]
  const enrolments = await db.classEnrolment.findMany({
    where: { classId, status: 'active', studentId: { in: studentIds } },
    select: { studentId: true },
  })
  if (enrolments.length !== studentIds.length) {
    return NextResponse.json({ error: 'One or more students are not enrolled in this class.' }, { status: 400 })
  }
  if (records.some(record => {
    const date = parseAttendanceDate(record.date)!
    const termStart = new Date(term.startDate)
    const termEnd = new Date(term.endDate)
    termStart.setHours(0, 0, 0, 0)
    termEnd.setHours(0, 0, 0, 0)
    return date < termStart || date > termEnd
  })) return NextResponse.json({ error: 'Attendance date is outside the selected term.' }, { status: 400 })

  const results = await Promise.allSettled(
    records.map(async (record) => {
      const date = parseAttendanceDate(record.date)!
      await db.attendance.upsert({
        where: { studentId_date: { studentId: record.studentId, date } },
        create: {
          studentId: record.studentId,
          termId: record.termId,
          date,
          status: record.status,
          notes: record.notes ?? null,
          markedById: session.id,
          markedAt: new Date(),
        },
        update: {
          status: record.status,
          notes: record.notes ?? null,
          markedById: session.id,
          markedAt: new Date(),
        },
      })
      return record.id
    }),
  )

  const saved = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<string>).value)
  const failed = results.filter(r => r.status === 'rejected').length

  // Fire truancy checks for absent students (fire-and-forget)
  const absentStudentIds = records
    .filter(r => r.status === 'absent')
    .map(r => r.studentId)
  if (absentStudentIds.length > 0) {
    const uniqueTermIds = [...new Set(records.map(r => r.termId))]
    Promise.all(
      absentStudentIds.flatMap(sid =>
        uniqueTermIds.map(tid => checkTruancyAction(sid, tid)),
      ),
    ).catch(() => {})
  }

  return NextResponse.json({ saved: saved.length, failed, savedIds: saved })
}
