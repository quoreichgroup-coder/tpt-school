import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMobileUser } from '@/lib/mobile-auth'
import { db } from '@/lib/db'

type Context = { params: Promise<{ classId: string }> }

async function authorizedClass(classId: string, userId: string, role: string) {
  if (role === 'admin') return db.class.findUnique({ where: { id: classId }, select: { id: true, name: true } })
  if (role !== 'teacher') return null
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } })
  if (!staff) return null
  return db.class.findFirst({ where: { id: classId, teachers: { some: { staffId: staff.id } } }, select: { id: true, name: true } })
}

export async function GET(request: Request, { params }: Context) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { classId } = await params
  const schoolClass = await authorizedClass(classId, user.id, user.role)
  if (!schoolClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  const url = new URL(request.url)
  const dateValue = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue) {
    return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  }
  const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000)
  const enrolments = await db.classEnrolment.findMany({
    where: { classId, status: 'active' },
    select: { student: { select: { id: true, studentId: true, user: { select: { name: true } }, attendance: { where: { date: { gte: date, lt: nextDay } }, select: { status: true }, take: 1 } } } },
    orderBy: { student: { user: { name: 'asc' } } },
  })
  return NextResponse.json({ class: schoolClass, date: date.toISOString().slice(0, 10), students: enrolments.map(({ student }) => ({ id: student.id, studentId: student.studentId, name: student.user.name, status: student.attendance[0]?.status ?? null })) })
}

const markSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), records: z.array(z.object({ studentId: z.string().min(1), status: z.enum(['present', 'absent', 'late', 'excused']) })).min(1).max(100) })

export async function POST(request: Request, { params }: Context) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (user.role !== 'teacher' && user.role !== 'admin') return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
  const { classId } = await params
  const schoolClass = await authorizedClass(classId, user.id, user.role)
  if (!schoolClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  let input: z.infer<typeof markSchema>
  try { input = markSchema.parse(await request.json()) } catch { return NextResponse.json({ error: 'Provide a date and between 1 and 100 valid attendance records.' }, { status: 400 }) }
  const date = new Date(`${input.date}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) return NextResponse.json({ error: 'Invalid date.' }, { status: 400 })
  if (new Set(input.records.map(record => record.studentId)).size !== input.records.length) return NextResponse.json({ error: 'Duplicate student records are not allowed.' }, { status: 400 })

  const term = await db.term.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } }, orderBy: { startDate: 'desc' }, select: { id: true } })
  if (!term) return NextResponse.json({ error: 'No school term is configured for this date.' }, { status: 400 })
  const enrolledIds = await db.classEnrolment.findMany({ where: { classId, status: 'active', studentId: { in: input.records.map(record => record.studentId) } }, select: { studentId: true } })
  if (enrolledIds.length !== input.records.length) return NextResponse.json({ error: 'Records include students outside this class.' }, { status: 400 })

  await db.$transaction(input.records.map(record => db.attendance.upsert({
    where: { studentId_date: { studentId: record.studentId, date } },
    create: { studentId: record.studentId, termId: term.id, date, status: record.status, markedById: user.id },
    update: { termId: term.id, status: record.status, markedById: user.id, markedAt: new Date() },
  })))
  return NextResponse.json({ saved: input.records.length })
}
