'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createClassAction(formData: FormData) {
  await requireRole(['admin'])

  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const subject = formData.get('subject') as string
  const yearLevel = formData.get('yearLevel') ? Number(formData.get('yearLevel')) : null
  const maxStudents = formData.get('maxStudents') ? Number(formData.get('maxStudents')) : null
  const description = formData.get('description') as string
  const roomId = formData.get('roomId') as string || null
  const academicYearId = formData.get('academicYearId') as string
  const staffId = formData.get('staffId') as string || null

  if (!name || !code || !academicYearId) {
    return { error: 'Le nom, le code et l’année scolaire sont obligatoires.' }
  }

  let classId: string
  try {
    classId = await db.$transaction(async tx => {
      const cls = await tx.class.create({
        data: {
          name,
          code,
          subject: subject || null,
          yearLevel,
          maxStudents,
          description: description || null,
          roomId,
          academicYearId,
        },
      })

      if (staffId) {
        await tx.classTeacher.create({
          data: { classId: cls.id, staffId, isPrimary: true },
        })
      }
      return cls.id
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to create class'
    console.error('createClassAction error:', e)
    if (msg.includes('Unique constraint')) return { error: 'Ce code de classe existe déjà pour cette année.' }
    return { error: 'Impossible de créer la classe. Vérifiez les informations et réessayez.' }
  }

  revalidatePath('/classes')
  redirect(`/classes/${classId}`)
}

export async function updateClassAction(id: string, formData: FormData) {
  await requireRole(['admin'])

  const name = (formData.get('name') as string)?.trim()
  const code = (formData.get('code') as string)?.trim()
  const subject = formData.get('subject') as string
  const yearLevel = formData.get('yearLevel') ? Number(formData.get('yearLevel')) : null
  const maxStudents = formData.get('maxStudents') ? Number(formData.get('maxStudents')) : null
  const description = formData.get('description') as string
  const roomId = formData.get('roomId') as string || null
  const academicYearId = formData.get('academicYearId') as string
  const staffId = formData.get('staffId') as string || null

  if (!name || !code || !academicYearId) {
    return { error: 'Le nom, le code et l’année scolaire sont obligatoires.' }
  }

  try {
    await db.$transaction(async tx => {
      await tx.class.update({
        where: { id },
        data: {
          name,
          code,
          subject: subject || null,
          yearLevel,
          maxStudents,
          description: description || null,
          roomId,
          academicYearId,
        },
      })

      await tx.classTeacher.updateMany({
        where: { classId: id, isPrimary: true, ...(staffId ? { staffId: { not: staffId } } : {}) },
        data: { isPrimary: false },
      })

      if (staffId) {
        await tx.classTeacher.upsert({
          where: { classId_staffId: { classId: id, staffId } },
          create: { classId: id, staffId, isPrimary: true },
          update: { isPrimary: true },
        })
      }
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update class'
    console.error('updateClassAction error:', e)
    if (msg.includes('Unique constraint')) return { error: 'Ce code de classe existe déjà pour cette année.' }
    return { error: 'Impossible de mettre à jour la classe. Vérifiez les informations et réessayez.' }
  }

  revalidatePath('/classes')
  revalidatePath(`/classes/${id}`)
  redirect(`/classes/${id}`)
}

export async function enrollStudentAction(classId: string, studentId: string) {
  await requireRole(['admin'])

  try {
    await db.classEnrolment.create({
      data: { classId, studentId, status: 'active' },
    })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    console.error('enrollStudentAction error:', e)
    if (msg.includes('Unique constraint')) return { error: 'Cet élève est déjà inscrit dans cette classe.' }
    return { error: 'Impossible d’inscrire l’élève dans cette classe.' }
  }
}

export async function unenrolStudentAction(classId: string, studentId: string) {
  await requireRole(['admin'])

  try {
    await db.classEnrolment.delete({
      where: { classId_studentId: { classId, studentId } },
    })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    console.error('unenrolStudentAction error:', e)
    return { error: 'Impossible de retirer l’élève de cette classe.' }
  }
}

// ─── Waitlist ─────────────────────────────────────────────────────────────────

export async function addToWaitlistAction(
  classId: string,
  studentId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const existing = await db.waitlistEntry.findUnique({ where: { classId_studentId: { classId, studentId } } })
  if (existing) return { success: false, error: 'Cet élève figure déjà sur la liste d’attente.' }

  const enrolled = await db.classEnrolment.findUnique({ where: { classId_studentId: { classId, studentId } } })
  if (enrolled) return { success: false, error: 'Cet élève est déjà inscrit dans cette classe.' }

  const lastEntry = await db.waitlistEntry.findFirst({ where: { classId }, orderBy: { position: 'desc' } })
  const position = (lastEntry?.position ?? 0) + 1

  try {
    await db.waitlistEntry.create({ data: { classId, studentId, position, notes: notes || null } })
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (error) {
    console.error('addToWaitlistAction error:', error)
    return { success: false, error: 'Impossible d’ajouter l’élève à la liste d’attente.' }
  }
}

export async function removeFromWaitlistAction(
  entryId: string,
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  try {
    await db.waitlistEntry.delete({ where: { id: entryId } })
    // Re-number remaining entries
    const remaining = await db.waitlistEntry.findMany({ where: { classId }, orderBy: { position: 'asc' } })
    for (let i = 0; i < remaining.length; i++) {
      await db.waitlistEntry.update({ where: { id: remaining[i].id }, data: { position: i + 1 } })
    }
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (error) {
    console.error('removeFromWaitlistAction error:', error)
    return { success: false, error: 'Impossible de retirer l’entrée de la liste d’attente.' }
  }
}

export async function promoteFromWaitlistAction(
  entryId: string,
  classId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole(['admin'])

  const entry = await db.waitlistEntry.findUnique({ where: { id: entryId } })
  if (!entry) return { success: false, error: 'Entrée de liste d’attente introuvable.' }

  try {
    await db.$transaction([
      db.classEnrolment.create({ data: { classId, studentId: entry.studentId, status: 'active' } }),
      db.waitlistEntry.delete({ where: { id: entryId } }),
    ])
    // Re-number remaining
    const remaining = await db.waitlistEntry.findMany({ where: { classId }, orderBy: { position: 'asc' } })
    for (let i = 0; i < remaining.length; i++) {
      await db.waitlistEntry.update({ where: { id: remaining[i].id }, data: { position: i + 1 } })
    }
    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    console.error('promoteFromWaitlistAction error:', e)
    if (msg.includes('Unique constraint')) return { success: false, error: 'Cet élève est déjà inscrit.' }
    return { success: false, error: 'Impossible d’inscrire l’élève depuis la liste d’attente.' }
  }
}

// ─── Enrolment Requests ───────────────────────────────────────────────────────

export async function approveEnrolmentRequestAction(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const request = await db.enrolmentRequest.findUnique({ where: { id: requestId } })
  if (!request) return { success: false, error: 'Demande introuvable.' }
  if (request.status !== 'pending') return { success: false, error: 'Cette demande n’est plus en attente.' }

  try {
    await db.$transaction([
      db.classEnrolment.create({ data: { classId: request.classId, studentId: request.studentId, status: 'active' } }),
      db.enrolmentRequest.update({
        where: { id: requestId },
        data: { status: 'approved', reviewedById: session.id, reviewedAt: new Date() },
      }),
    ])
    revalidatePath(`/classes/${request.classId}`)
    revalidatePath('/enrollment-requests')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    console.error('approveEnrolmentRequestAction error:', e)
    if (msg.includes('Unique constraint')) return { success: false, error: 'Cet élève est déjà inscrit.' }
    return { success: false, error: 'Impossible d’approuver la demande d’inscription.' }
  }
}

export async function rejectEnrolmentRequestAction(
  requestId: string,
  reason: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin'])

  const request = await db.enrolmentRequest.findUnique({ where: { id: requestId } })
  if (!request) return { success: false, error: 'Demande introuvable.' }

  try {
    await db.enrolmentRequest.update({
      where: { id: requestId },
      data: { status: 'rejected', rejectionReason: reason || null, reviewedById: session.id, reviewedAt: new Date() },
    })
  } catch (error) {
    console.error('rejectEnrolmentRequestAction error:', error)
    return { success: false, error: 'Impossible de refuser la demande d’inscription.' }
  }
  revalidatePath(`/classes/${request.classId}`)
  revalidatePath('/enrollment-requests')
  return { success: true }
}

export async function assignTeacherAction(classId: string, staffId: string, isPrimary: boolean) {
  await requireRole(['admin'])

  try {
    if (isPrimary) {
      // Unset any existing primary teacher
      await db.classTeacher.updateMany({
        where: { classId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    await db.classTeacher.upsert({
      where: { classId_staffId: { classId, staffId } },
      create: { classId, staffId, isPrimary },
      update: { isPrimary },
    })

    revalidatePath(`/classes/${classId}`)
    return { success: true }
  } catch (e: unknown) {
    console.error('assignTeacherAction error:', e)
    return { error: 'Impossible d’attribuer l’enseignant à cette classe.' }
  }
}
