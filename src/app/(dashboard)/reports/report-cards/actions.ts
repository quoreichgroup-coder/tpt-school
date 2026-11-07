'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { generateReportComment, ReportCardContext } from '@/lib/ai'
import { sendEmail, reportCardEmailHtml } from '@/lib/email'
import { weightedAveragePercent } from '@/lib/grade-calculation'

// ─── Build AI context for a student ──────────────────────────────────────────

async function buildReportCardContext(studentId: string, termId?: string): Promise<ReportCardContext> {
  const selectedTerm = termId
    ? await db.term.findUnique({ where: { id: termId }, select: { name: true, startDate: true, endDate: true } })
    : null
  const termEndExclusive = selectedTerm
    ? new Date(selectedTerm.endDate.getTime() + 24 * 60 * 60 * 1000)
    : null

  const student = await db.student.findUniqueOrThrow({
    where: { id: studentId },
    include: {
      user: { select: { name: true } },
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
                select: {
                  maxScore: true,
                  weight: true,
                  grades: { where: { studentId }, select: { score: true, grade: true, gradedAt: true } },
                },
              },
            },
          },
        },
      },
      attendance: {
        where: termId ? { termId } : {},
      },
      behaviourIncidents: {
        where: !termId
          ? {}
          : selectedTerm && termEndExclusive
            ? { date: { gte: selectedTerm.startDate, lt: termEndExclusive } }
            : { date: { equals: new Date(0) } },
      },
    },
  })

  const totalAtt = student.attendance.length
  const presentCount = student.attendance.filter(a => a.status === 'present').length
  const absenceCount = student.attendance.filter(a => a.status === 'absent').length
  const attRate = totalAtt > 0 ? (presentCount / totalAtt) * 100 : 100

  const classes = student.classEnrolments.map(enr => {
    const cls = enr.class
    const teacher = cls.teachers[0]?.staff.user.name ?? 'Staff'
    const avg = weightedAveragePercent(cls.gradebooks.flatMap(gradebook =>
      gradebook.grades.map(grade => ({ score: grade.score, maxScore: gradebook.maxScore, weight: gradebook.weight })),
    ))
    const letterGrade = cls.gradebooks.flatMap(gb => gb.grades)
      .sort((a, b) => (b.gradedAt?.getTime() ?? 0) - (a.gradedAt?.getTime() ?? 0))
      .find(grade => grade.grade)?.grade ?? null
    return { name: cls.name, teacher, letterGrade, averageScore: avg }
  })

  const termName = selectedTerm?.name ?? 'Current Term'

  const behaviourSeverities = student.behaviourIncidents.map(i => i.severity)

  return {
    studentName: student.user.name.split(' ')[0] ?? student.user.name,
    yearLevel: student.yearLevel,
    termName,
    classes,
    attendanceRate: attRate,
    absenceCount,
    behaviourIncidentCount: student.behaviourIncidents.length,
    behaviourSeverities,
  }
}

async function teacherHasStudentInTerm(userId: string, studentId: string, termId: string): Promise<boolean> {
  const term = await db.term.findUnique({ where: { id: termId }, select: { academicYearId: true } })
  if (!term) return false
  const enrolment = await db.classEnrolment.findFirst({
    where: {
      studentId,
      status: 'active',
      class: {
        academicYearId: term.academicYearId,
        teachers: { some: { staff: { userId } } },
      },
    },
    select: { id: true },
  })
  return !!enrolment
}

// ─── Generate comment for one student (assist mode) ──────────────────────────

export async function generateReportCommentAction(
  studentId: string,
  termId?: string,
): Promise<{ success: boolean; comment?: string; error?: string }> {
  try {
    const actor = await requireRole(['admin', 'teacher'])
    if (actor.role === 'teacher' && (!termId || !await teacherHasStudentInTerm(actor.id, studentId, termId))) {
      return { success: false, error: 'You are not assigned to this student for the selected term.' }
    }
    const context = await buildReportCardContext(studentId, termId)
    const comment = await generateReportComment(context)
    return { success: true, comment }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to generate comment.' }
  }
}

// ─── Save report card comments ────────────────────────────────────────────────

export async function saveReportCardAction(
  studentId: string,
  termId: string,
  data: { comments?: string; teacherNotes?: string; principalNotes?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireRole(['admin', 'teacher'])

    const term = await db.term.findUnique({ where: { id: termId }, include: { academicYear: true } })
    if (!term) return { success: false, error: 'Term not found.' }
    if (actor.role === 'teacher' && !await teacherHasStudentInTerm(actor.id, studentId, termId)) {
      return { success: false, error: 'You are not assigned to this student for the selected term.' }
    }

    const comments = typeof data.comments === 'string' ? data.comments.trim().slice(0, 5000) : null
    const teacherNotes = typeof data.teacherNotes === 'string' ? data.teacherNotes.trim().slice(0, 5000) : null
    const principalNotes = actor.role === 'admin' && typeof data.principalNotes === 'string'
      ? data.principalNotes.trim().slice(0, 5000)
      : undefined

    await db.$transaction(async tx => {
      const card = await tx.reportCard.upsert({
        where: { studentId_termId: { studentId, termId } },
        create: {
          studentId,
          termId,
          academicYear: term.academicYear.year,
          comments,
          teacherNotes,
          principalNotes: principalNotes ?? null,
        },
        update: {
          comments,
          teacherNotes,
          ...(principalNotes !== undefined ? { principalNotes } : {}),
          approvalStatus: 'draft',
          published: false,
          issuedAt: null,
          reviewedAt: null,
          reviewedById: null,
          rejectionReason: null,
        },
      })
      await tx.reportCardRevision.create({
        data: {
          reportCardId: card.id, actorId: actor.id, action: 'edited', academicYear: card.academicYear,
          comments: card.comments, teacherNotes: card.teacherNotes, principalNotes: card.principalNotes,
          approvalStatus: card.approvalStatus, rejectionReason: card.rejectionReason,
        },
      })
    })

    revalidatePath('/reports/report-cards')
    return { success: true }
  } catch (err) {
    console.error('saveReportCardAction error:', err)
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ─── Prepare report cards for approval (auto AI mode) ────────────────────────

export async function prepareReportCardsAction(
  termId: string,
): Promise<{ success: boolean; generated: number; error?: string }> {
  try {
    const actor = await requireRole(['admin'])

    const settings = await db.schoolSettings.findFirst()
    const aiEnabled = settings?.aiProvider && settings.aiProvider !== 'none' && settings.aiReportMode === 'auto'

    const term = await db.term.findUnique({ where: { id: termId }, include: { academicYear: true } })
    if (!term) return { success: false, generated: 0, error: 'Term not found.' }

    const students = await db.student.findMany({
      where: { enrollmentStatus: 'active' },
      include: { user: { select: { name: true } } },
    })

    let generated = 0

    for (const student of students) {
      const existing = await db.reportCard.findUnique({
        where: { studentId_termId: { studentId: student.id, termId } },
      })

      let comments = existing?.comments ?? null

      if (aiEnabled && !comments) {
        try {
          const context = await buildReportCardContext(student.id, termId)
          comments = await generateReportComment(context)
          generated++
        } catch {
          // Skip if AI fails for one student
        }
      }

      await db.$transaction(async tx => {
        const card = await tx.reportCard.upsert({
          where: { studentId_termId: { studentId: student.id, termId } },
          create: {
            studentId: student.id,
            termId,
            academicYear: term.academicYear.year,
            comments,
            published: false,
            approvalStatus: 'pending_approval',
          },
          update: {
            ...(existing?.approvalStatus === 'approved' ? {} : {
              published: false,
              approvalStatus: 'pending_approval',
              reviewedAt: null,
              reviewedById: null,
              rejectionReason: null,
            }),
            ...(comments && existing?.approvalStatus !== 'approved' ? { comments } : {}),
          },
        })
        if (card.approvalStatus === 'pending_approval') {
          await tx.reportCardRevision.create({
            data: {
              reportCardId: card.id, actorId: actor.id, action: 'submitted_for_approval',
              academicYear: card.academicYear, comments: card.comments, teacherNotes: card.teacherNotes,
              principalNotes: card.principalNotes, approvalStatus: card.approvalStatus,
            },
          })
        }
      })
    }

    revalidatePath('/reports/report-cards')
    return { success: true, generated }
  } catch (err) {
    console.error('prepareReportCardsAction error:', err)
    return { success: false, generated: 0, error: 'An unexpected error occurred.' }
  }
}

// ─── Approve and publish all pending report cards for a term ──────────────────

export async function approveReportCardsAction(
  termId: string,
): Promise<{ success: boolean; approved: number; error?: string }> {
  try {
    const actor = await requireRole(['admin'])

    const term = await db.term.findUnique({ where: { id: termId } })
    if (!term) return { success: false, approved: 0, error: 'Term not found.' }

    const pending = await db.reportCard.findMany({
      where: { termId, approvalStatus: 'pending_approval' },
      include: {
        student: {
          include: {
            user: { select: { name: true } },
            parents: { include: { parent: { include: { user: { select: { name: true, email: true } } } } } },
          },
        },
      },
    })
    const reviewedAt = new Date()

    await db.$transaction(async tx => {
      for (const card of pending) {
        const approved = await tx.reportCard.update({
          where: { id: card.id },
          data: { approvalStatus: 'approved', published: true, issuedAt: reviewedAt, reviewedAt, reviewedById: actor.id, rejectionReason: null },
        })
        await tx.reportCardRevision.create({
          data: {
            reportCardId: approved.id, actorId: actor.id, action: 'approved', academicYear: approved.academicYear,
            comments: approved.comments, teacherNotes: approved.teacherNotes, principalNotes: approved.principalNotes,
            approvalStatus: approved.approvalStatus,
          },
        })
      }
    })

    const settings = await db.schoolSettings.findFirst({ select: { name: true } })
    Promise.all(pending.map(card => {
      const parents = card.student.parents
      const primaryParent = parents.find(sp => sp.isPrimary)?.parent ?? parents[0]?.parent
      if (!primaryParent?.user?.email) return Promise.resolve()
      return sendEmail({
        to: primaryParent.user.email,
        subject: `Report card published — ${card.student.user.name}`,
        html: reportCardEmailHtml(primaryParent.user.name, card.student.user.name, term.name, settings?.name ?? 'School'),
      })
    })).catch(() => {})

    revalidatePath('/reports/report-cards')
    return { success: true, approved: pending.length }
  } catch (err) {
    console.error('approveReportCardsAction error:', err)
    return { success: false, approved: 0, error: 'An unexpected error occurred.' }
  }
}

export async function rejectReportCardsAction(
  termId: string,
  reason: string,
): Promise<{ success: boolean; rejected: number; error?: string }> {
  try {
    const actor = await requireRole(['admin'])
    const cleanedReason = reason.trim().slice(0, 500)
    if (!cleanedReason) return { success: false, rejected: 0, error: 'A rejection reason is required.' }
    const pending = await db.reportCard.findMany({ where: { termId, approvalStatus: 'pending_approval' } })
    await db.$transaction(async tx => {
      for (const card of pending) {
        const rejected = await tx.reportCard.update({
          where: { id: card.id },
          data: { approvalStatus: 'rejected', published: false, reviewedAt: new Date(), reviewedById: actor.id, rejectionReason: cleanedReason },
        })
        await tx.reportCardRevision.create({
          data: {
            reportCardId: rejected.id, actorId: actor.id, action: 'returned_for_revision',
            academicYear: rejected.academicYear, comments: rejected.comments, teacherNotes: rejected.teacherNotes,
            principalNotes: rejected.principalNotes, approvalStatus: rejected.approvalStatus, rejectionReason: cleanedReason,
          },
        })
      }
    })
    revalidatePath('/reports/report-cards')
    return { success: true, rejected: pending.length }
  } catch (err) {
    console.error('rejectReportCardsAction error:', err)
    return { success: false, rejected: 0, error: 'An unexpected error occurred.' }
  }
}
