import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const gradebook = await db.gradebook.findUnique({
    where: { id },
    include: {
      class: {
        include: {
          enrolments: {
            where: { status: 'active' },
            include: { student: { include: { user: { select: { name: true } } } } },
            orderBy: { student: { user: { name: 'asc' } } },
          },
          teachers: { include: { staff: { include: { user: { select: { id: true } } } } } },
        },
      },
      term: { include: { academicYear: true } },
      grades: true,
    },
  })

  if (!gradebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Teachers may only export their own class
  if (session.role === 'teacher') {
    const staff = await db.staff.findUnique({ where: { userId: session.id } })
    const isTeacher = gradebook.class.teachers.some((t) => t.staff.user.id === session.id)
    if (!staff || !isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const gradeMap = new Map(gradebook.grades.map((g) => [g.studentId, g]))

  const rows = gradebook.class.enrolments.map((e) => {
    const g = gradeMap.get(e.student.id)
    return {
      'Student Name': e.student.user.name,
      'Student ID': e.student.studentId,
      'Score': g?.score ?? '',
      'Max Score': gradebook.maxScore,
      'Percentage': g?.score != null ? `${Math.round((g.score / gradebook.maxScore) * 100)}%` : '',
      'Grade': g?.grade ?? '',
      'Comment': g?.comment ?? '',
      'Submitted At': g?.submittedAt ? new Date(g.submittedAt).toLocaleDateString('en-NZ') : '',
      'Submission URL': g?.submissionUrl ?? '',
      'Graded At': g?.gradedAt ? new Date(g.gradedAt).toLocaleDateString('en-NZ') : '',
    }
  })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Grades')
  const columns = [
    { header: 'Student Name', key: 'Student Name', width: 25 },
    { header: 'Student ID', key: 'Student ID', width: 12 },
    { header: 'Score', key: 'Score', width: 8 },
    { header: 'Max Score', key: 'Max Score', width: 10 },
    { header: 'Percentage', key: 'Percentage', width: 12 },
    { header: 'Grade', key: 'Grade', width: 8 },
    { header: 'Comment', key: 'Comment', width: 30 },
    { header: 'Submitted At', key: 'Submitted At', width: 14 },
    { header: 'Submission URL', key: 'Submission URL', width: 40 },
    { header: 'Graded At', key: 'Graded At', width: 14 },
  ]
  worksheet.columns = columns
  worksheet.addRows(rows)
  worksheet.getRow(1).font = { bold: true }
  const buf = Buffer.from(await workbook.xlsx.writeBuffer())
  const safeName = `${gradebook.class.name}_${gradebook.name}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}.xlsx"`,
    },
  })
}
