import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'

export const dynamic = 'force-dynamic'
import { ReportCardDocument } from './pdf-document'
import { weightedAveragePercent } from '@/lib/grade-calculation'

type RouteContext = { params: Promise<{ studentId: string }> }

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession()
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { studentId } = await params
  let termId = req.nextUrl.searchParams.get('termId') ?? undefined
  const isStaff = ['admin', 'teacher'].includes(session.role)
  const isFamily = ['student', 'parent'].includes(session.role)
  if (!isStaff && !isFamily) return new NextResponse('Forbidden', { status: 403 })

  if (session.role === 'teacher') {
    if (!termId) return new NextResponse('A term is required for teacher access.', { status: 400 })
    const term = await db.term.findUnique({ where: { id: termId }, select: { academicYearId: true } })
    const assignment = term && await db.classEnrolment.findFirst({
      where: {
        studentId,
        status: 'active',
        class: {
          academicYearId: term.academicYearId,
          teachers: { some: { staff: { userId: session.id } } },
        },
      },
      select: { id: true },
    })
    if (!assignment) return new NextResponse('Student not found', { status: 404 })
  }

  if (isFamily) {
    const allowedStudent = await db.student.findFirst({
      where: session.role === 'student'
        ? { id: studentId, userId: session.id }
        : { id: studentId, parents: { some: { parent: { userId: session.id } } } },
      select: { id: true },
    })
    if (!allowedStudent) return new NextResponse('Student not found', { status: 404 })
  }

  const reportCard = isFamily
    ? await db.reportCard.findFirst({
      where: {
        studentId,
        published: true,
        approvalStatus: 'approved',
        ...(termId ? { termId } : {}),
      },
      orderBy: { issuedAt: 'desc' },
    })
    : termId
      ? await db.reportCard.findUnique({ where: { studentId_termId: { studentId, termId } } })
      : null

  if (isFamily && !reportCard) return new NextResponse('Published report card not found', { status: 404 })
  if (reportCard) termId = reportCard.termId

  const reportTerm = reportCard
    ? await db.term.findUnique({ where: { id: reportCard.termId }, include: { academicYear: true } })
    : null

  const [student, school] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        classEnrolments: {
          where: termId ? {
            OR: [
              { status: 'active' },
              { class: { gradebooks: { some: { termId, grades: { some: { studentId } } } } } },
            ],
          } : { status: 'active' },
          include: {
            class: {
              include: {
                teachers: {
                  where: { isPrimary: true },
                  include: { staff: { include: { user: { select: { name: true } } } } },
                },
                gradebooks: {
                  where: termId ? { termId } : {},
                  include: {
                    term: true,
                    grades: {
                      where: { studentId },
                    },
                  },
                },
              },
            },
          },
        },
        attendance: {
          where: termId
            ? { termId }
            : {},
          orderBy: { date: 'desc' },
        },
      },
    }),
    db.schoolSettings.findFirst(),
  ])

  if (!student) {
    return new NextResponse('Student not found', { status: 404 })
  }

  // Compute attendance stats
  const totalAtt = student.attendance.length
  const presentCount = student.attendance.filter(a => a.status === 'present').length
  const absentCount = student.attendance.filter(a => a.status === 'absent').length
  const lateCount = student.attendance.filter(a => a.status === 'late').length
  const attRate = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null

  // Build grades by class
  const classSummaries = student.classEnrolments.map(enr => {
    const cls = enr.class
    const primaryTeacher = cls.teachers[0]?.staff.user.name ?? null
    const gradebooks = cls.gradebooks.map(gb => {
      const grade = gb.grades[0]
      return {
        name: gb.name,
        type: gb.type,
        maxScore: gb.maxScore,
        score: grade?.score ?? null,
        letterGrade: grade?.grade ?? null,
        comment: grade?.comment ?? null,
      }
    })
    const average = weightedAveragePercent(cls.gradebooks.map(gradebook => ({
      score: gradebook.grades[0]?.score ?? null,
      maxScore: gradebook.maxScore,
      weight: gradebook.weight,
    })))
    const avg = average === null ? null : Math.round(average * 10) / 10
    return {
      className: cls.name,
      classCode: cls.code,
      subject: cls.subject,
      teacher: primaryTeacher,
      gradebooks,
      avg,
    }
  })

  const docElement = createElement(ReportCardDocument, {
    period: reportTerm ? `${reportTerm.academicYear.year} — ${reportTerm.name}` : undefined,
    comments: reportCard?.comments,
    student: {
      name: student.user.name,
      studentId: student.studentId,
      yearLevel: student.yearLevel,
      email: student.user.email,
    },
    school: {
      name: school?.name ?? 'QSCHOOL',
      shortName: school?.shortName ?? undefined,
      address: school?.address ?? undefined,
      phone: school?.phone ?? undefined,
    },
    attendance: { total: totalAtt, present: presentCount, absent: absentCount, late: lateCount, rate: attRate },
    classSummaries,
    generatedAt: new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }),
  })

  const buffer = await renderToBuffer(docElement as unknown as Parameters<typeof renderToBuffer>[0])

  const safeName = student.user.name.replace(/[^a-z0-9]/gi, '_')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="report-card-${safeName}.pdf"`,
    },
  })
}
