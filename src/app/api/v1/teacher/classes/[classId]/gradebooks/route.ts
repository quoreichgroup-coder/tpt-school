import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getMobileUser } from '@/lib/mobile-auth'
import { db } from '@/lib/db'

type Context = { params: Promise<{ classId: string }> }

async function authorizedClass(classId: string, userId: string, role: string) {
  if (role === 'admin') return db.class.findUnique({ where: { id: classId }, select: { id: true } })
  if (role !== 'teacher') return null
  const staff = await db.staff.findUnique({ where: { userId }, select: { id: true } })
  if (!staff) return null
  return db.class.findFirst({ where: { id: classId, teachers: { some: { staffId: staff.id } } }, select: { id: true } })
}

export async function GET(request: Request, { params }: Context) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (user.role !== 'teacher' && user.role !== 'admin') return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })

  const { classId } = await params
  if (!await authorizedClass(classId, user.id, user.role)) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  const [students, gradebooks] = await Promise.all([
    db.classEnrolment.findMany({
      where: { classId, status: 'active' },
      select: { student: { select: { id: true, studentId: true, user: { select: { name: true } } } } },
      orderBy: { student: { user: { name: 'asc' } } },
    }),
    db.gradebook.findMany({
      where: { classId },
      select: {
        id: true, name: true, type: true, maxScore: true, weight: true, dueDate: true,
        exam: { select: { status: true } },
        term: { select: { id: true, name: true } },
        grades: { select: { studentId: true, score: true, grade: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { name: 'asc' }],
    }),
  ])

  return NextResponse.json({
    students: students.map(({ student }) => student),
    gradebooks: gradebooks
      .filter(gradebook => gradebook.exam?.status !== 'cancelled')
      .map(gradebook => ({
        id: gradebook.id,
        name: gradebook.name,
        type: gradebook.type,
        maxScore: gradebook.maxScore,
        weight: gradebook.weight,
        dueDate: gradebook.dueDate,
        term: gradebook.term,
        grades: gradebook.grades.filter(grade => students.some(enrolment => enrolment.student.id === grade.studentId)),
      })),
  })
}

const gradeSchema = z.object({
  gradebookId: z.string().min(1),
  records: z.array(z.object({
    studentId: z.string().min(1),
    score: z.number().finite().nonnegative(),
  })).min(1).max(100),
})

export async function POST(request: Request, { params }: Context) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (user.role !== 'teacher' && user.role !== 'admin') return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })

  const { classId } = await params
  if (!await authorizedClass(classId, user.id, user.role)) return NextResponse.json({ error: 'Class not found.' }, { status: 404 })

  let input: z.infer<typeof gradeSchema>
  try {
    input = gradeSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Provide 1 to 100 student scores greater than or equal to zero.' }, { status: 400 })
  }
  if (new Set(input.records.map(record => record.studentId)).size !== input.records.length) {
    return NextResponse.json({ error: 'Duplicate student records are not allowed.' }, { status: 400 })
  }

  const gradebook = await db.gradebook.findFirst({ where: { id: input.gradebookId, classId }, select: { id: true, maxScore: true, exam: { select: { status: true } } } })
  if (!gradebook) return NextResponse.json({ error: 'Gradebook not found for this class.' }, { status: 404 })
  if (gradebook.exam?.status === 'cancelled') return NextResponse.json({ error: 'This exam was cancelled; grades can no longer be entered.' }, { status: 409 })
  if (input.records.some(record => record.score > gradebook.maxScore)) {
    return NextResponse.json({ error: `Scores must not exceed ${gradebook.maxScore}.` }, { status: 400 })
  }

  const enrolled = await db.classEnrolment.findMany({
    where: { classId, status: 'active', studentId: { in: input.records.map(record => record.studentId) } },
    select: { studentId: true },
  })
  if (enrolled.length !== input.records.length) return NextResponse.json({ error: 'Scores include students outside this class.' }, { status: 400 })

  const gradedAt = new Date()
  await db.$transaction(input.records.map(record => db.grade.upsert({
    where: { gradebookId_studentId: { gradebookId: gradebook.id, studentId: record.studentId } },
    create: { gradebookId: gradebook.id, studentId: record.studentId, score: record.score, gradedAt, gradedById: user.id },
    update: { score: record.score, gradedAt, gradedById: user.id },
  })))

  return NextResponse.json({ saved: input.records.length })
}
