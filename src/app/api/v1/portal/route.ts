import { NextResponse } from 'next/server'
import { getMobileUser } from '@/lib/mobile-auth'
import { db } from '@/lib/db'
import { weightedAveragePercent } from '@/lib/grade-calculation'

export async function GET(request: Request) {
  const user = await getMobileUser(request.headers.get('authorization'))
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  if (user.role !== 'student' && user.role !== 'parent') {
    return NextResponse.json({ error: 'This portal is for student and parent accounts.' }, { status: 403 })
  }

  const studentWhere = user.role === 'student'
    ? { userId: user.id }
    : { parents: { some: { parent: { userId: user.id } } } }

  const students = await db.student.findMany({
    where: studentWhere,
    select: {
      id: true, studentId: true, yearLevel: true,
      user: { select: { name: true } },
      classEnrolments: {
        where: { status: 'active' },
        select: { class: { select: { id: true, name: true, subject: true } } },
      },
      attendance: {
        orderBy: { date: 'desc' }, take: 10,
        select: { date: true, status: true },
      },
      grades: {
        where: { gradebook: { term: { startDate: { lte: new Date() }, endDate: { gte: new Date() } } } },
        orderBy: { gradedAt: 'desc' },
        select: { score: true, grade: true, comment: true, gradebook: { select: { name: true, maxScore: true, weight: true, class: { select: { id: true, name: true, subject: true } } } } },
      },
      reportCards: {
        where: { published: true, approvalStatus: 'approved' },
        orderBy: { issuedAt: 'desc' },
        take: 5,
        select: { id: true, termId: true, academicYear: true, comments: true, issuedAt: true },
      },
    },
  })

  const termIds = [...new Set(students.flatMap(student => student.reportCards.map(card => card.termId)))]
  const terms = termIds.length
    ? await db.term.findMany({ where: { id: { in: termIds } }, select: { id: true, name: true } })
    : []
  const termNames = new Map(terms.map(term => [term.id, term.name]))
  const reportCardGrades = termIds.length && students.length
    ? await db.grade.findMany({
      where: { studentId: { in: students.map(student => student.id) }, gradebook: { termId: { in: termIds } } },
      select: {
        studentId: true, score: true, grade: true,
        gradebook: { select: { termId: true, name: true, maxScore: true, weight: true, class: { select: { id: true, subject: true, name: true } } } },
      },
    })
    : []
  const classIds = [...new Set(students.flatMap(student => student.classEnrolments.map(enrolment => enrolment.class.id)))]
  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true } })
  const timetableSlots = classIds.length
    ? await db.timetableSlot.findMany({
      where: {
        classId: { in: classIds },
        class: { academicYearId: activeYear?.id ?? '__no_active_year__' },
        dayOfWeek: { gte: 1, lte: 5 },
      },
      include: {
        class: { select: { id: true, name: true, subject: true } },
        room: { select: { name: true } },
        staff: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
    })
    : []
  const upcomingExams = classIds.length
    ? await db.exam.findMany({
      where: { classId: { in: classIds }, status: 'published', startsAt: { gte: new Date() } },
      include: { schoolClass: { select: { id: true, name: true, subject: true } }, term: { select: { name: true, academicYear: { select: { year: true } } } }, room: { select: { name: true } } },
      orderBy: { startsAt: 'asc' },
      take: 20,
    })
    : []
  const studentsWithReportCards = students.map(student => {
    const currentGroups = new Map<string, { subject: string; grades: typeof student.grades }>()
    for (const grade of student.grades) {
      const classId = grade.gradebook.class.id
      const subject = grade.gradebook.class.subject ?? grade.gradebook.class.name
      const group = currentGroups.get(classId)
      currentGroups.set(classId, { subject, grades: [...(group?.grades ?? []), grade] })
    }
    return {
      ...student,
      currentAverages: [...currentGroups.values()].map(({ subject, grades }) => ({
        subject,
        average: weightedAveragePercent(grades.map(grade => ({
          score: grade.score, maxScore: grade.gradebook.maxScore, weight: grade.gradebook.weight,
        }))),
      })).filter(row => row.average !== null),
      timetable: timetableSlots
        .filter(slot => student.classEnrolments.some(enrolment => enrolment.class.id === slot.class.id))
        .map(slot => ({
          id: slot.id, dayOfWeek: slot.dayOfWeek, period: slot.period, startTime: slot.startTime, endTime: slot.endTime,
          className: slot.class.name, subject: slot.class.subject, room: slot.room?.name ?? null,
          teacher: slot.staff?.user.name ?? null,
        })),
      exams: upcomingExams
        .filter(exam => student.classEnrolments.some(enrolment => enrolment.class.id === exam.schoolClass.id))
        .map(exam => ({
          id: exam.id, title: exam.title, startsAt: exam.startsAt, endsAt: exam.endsAt,
          className: exam.schoolClass.name, subject: exam.schoolClass.subject, room: exam.room?.name ?? null,
          termName: `${exam.term.academicYear.year} — ${exam.term.name}`,
        })),
      reportCards: student.reportCards.map(({ termId, ...card }) => {
        const grades = reportCardGrades.filter(grade => grade.studentId === student.id && grade.gradebook.termId === termId)
        const subjects = new Map<string, { subject: string; grades: typeof grades }>()
        for (const grade of grades) {
          const subject = grade.gradebook.class.subject ?? grade.gradebook.class.name
          const key = grade.gradebook.class.id
          const group = subjects.get(key)
          subjects.set(key, { subject, grades: [...(group?.grades ?? []), grade] })
        }
        return {
          ...card,
          termName: termNames.get(termId) ?? 'Bulletin',
          averages: [...subjects.values()].map(({ subject, grades: subjectGrades }) => ({
            subject,
            average: weightedAveragePercent(subjectGrades.map(grade => ({
              score: grade.score, maxScore: grade.gradebook.maxScore, weight: grade.gradebook.weight,
            }))),
          })).filter(row => row.average !== null),
          grades: grades.map(grade => ({ subject: grade.gradebook.class.subject ?? grade.gradebook.name, assessment: grade.gradebook.name, score: grade.score, maxScore: grade.gradebook.maxScore, grade: grade.grade })),
        }
      }),
    }
  })

  const now = new Date()
  const roleTarget = user.role
  const notices = await db.notice.findMany({
    where: {
      publishedAt: { not: null, lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      AND: [{ OR: [{ targetRoles: 'all' }, { targetRoles: { contains: roleTarget } }] }],
    },
    select: { id: true, title: true, body: true, category: true, pinned: true, publishedAt: true, targetYears: true },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    take: 30,
  })

  const studentYears = new Set(students.map(student => student.yearLevel).filter((year): year is number => year !== null))
  const visibleNotices = notices.filter(notice => {
    if (!notice.targetYears || notice.targetYears === 'all') return true
    try {
      const years = JSON.parse(notice.targetYears) as number[]
      return students.length > 0 && years.some(year => studentYears.has(year))
    } catch { return false }
  }).map(({ targetYears, ...notice }) => {
    void targetYears
    return notice
  })

  return NextResponse.json({ students: studentsWithReportCards, notices: visibleNotices })
}
