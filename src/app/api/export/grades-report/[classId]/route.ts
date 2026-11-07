import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import ExcelJS from 'exceljs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'teacher')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { classId } = await params

  const cls = await db.class.findUnique({
    where: { id: classId },
    include: {
      teachers: { include: { staff: { include: { user: { select: { id: true } } } } } },
      enrolments: {
        where: { status: 'active' },
        include: { student: { include: { user: { select: { name: true } } } } },
        orderBy: { student: { user: { name: 'asc' } } },
      },
      gradebooks: {
        include: {
          term: { select: { name: true } },
          grades: true,
        },
        orderBy: { dueDate: 'asc' },
      },
    },
  })

  if (!cls) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (session.role === 'teacher') {
    const isTeacher = cls.teachers.some((t) => t.staff.user.id === session.id)
    if (!isTeacher) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const wb = new ExcelJS.Workbook()

  // Sheet 1: Summary — rows = students, columns = assessments
  const summaryRows = cls.enrolments.map((e) => {
    const row: Record<string, string | number> = {
      'Student Name': e.student.user.name,
      'Student ID': e.student.studentId,
    }
    for (const gb of cls.gradebooks) {
      const grade = gb.grades.find((g) => g.studentId === e.student.id)
      row[`${gb.name} (${gb.term.name})`] = grade?.score ?? ''
      row[`${gb.name} %`] = grade?.score != null
        ? `${Math.round((grade.score / gb.maxScore) * 100)}%`
        : ''
    }
    return row
  })

  const wsSummary = wb.addWorksheet('Summary')
  wsSummary.columns = [
    { header: 'Student Name', key: 'Student Name', width: 25 },
    { header: 'Student ID', key: 'Student ID', width: 12 },
    ...cls.gradebooks.flatMap((gb) => [
      { header: `${gb.name} (${gb.term.name})`, key: `${gb.name} (${gb.term.name})`, width: 16 },
      { header: `${gb.name} %`, key: `${gb.name} %`, width: 8 },
    ]),
  ]
  wsSummary.addRows(summaryRows)
  wsSummary.getRow(1).font = { bold: true }

  // Sheet per gradebook
  for (const gb of cls.gradebooks) {
    const gradeMap = new Map(gb.grades.map((g) => [g.studentId, g]))
    const rows = cls.enrolments.map((e) => {
      const g = gradeMap.get(e.student.id)
      return {
        'Student Name': e.student.user.name,
        'Student ID': e.student.studentId,
        'Score': g?.score ?? '',
        'Max Score': gb.maxScore,
        'Percentage': g?.score != null ? `${Math.round((g.score / gb.maxScore) * 100)}%` : '',
        'Grade': g?.grade ?? '',
        'Comment': g?.comment ?? '',
        'Submitted': g?.submittedAt ? new Date(g.submittedAt).toLocaleDateString('en-NZ') : '',
      }
    })
    const sheetName = gb.name.slice(0, 31).replace(/[:\\/?\[\]*]/g, '') // Excel 31 char sheet name limit
    const ws = wb.addWorksheet(sheetName || `Gradebook ${gb.id.slice(0, 8)}`)
    ws.columns = [
      { header: 'Student Name', key: 'Student Name', width: 25 },
      { header: 'Student ID', key: 'Student ID', width: 12 },
      { header: 'Score', key: 'Score', width: 8 },
      { header: 'Max Score', key: 'Max Score', width: 10 },
      { header: 'Percentage', key: 'Percentage', width: 12 },
      { header: 'Grade', key: 'Grade', width: 8 },
      { header: 'Comment', key: 'Comment', width: 30 },
      { header: 'Submitted', key: 'Submitted', width: 14 },
    ]
    ws.addRows(rows)
    ws.getRow(1).font = { bold: true }
  }

  const buf = Buffer.from(await wb.xlsx.writeBuffer())
  const safeName = cls.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeName}_Grades_Report.xlsx"`,
    },
  })
}
