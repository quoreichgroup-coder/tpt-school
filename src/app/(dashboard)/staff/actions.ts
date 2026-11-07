'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendEmail, leaveDecisionEmailHtml } from '@/lib/email'

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function generateEmployeeId(): Promise<string> {
  const count = await db.staff.count()
  return `EMP-${String(count + 1).padStart(4, '0')}`
}

function generateTempPassword(): string {
  return randomBytes(9).toString('base64url').slice(0, 12)
}

// ─── Create Staff ─────────────────────────────────────────────────────────────

export async function createStaffAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string; tempPassword?: string }> {
  try {
    await requireRole(['admin'])

    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const accountRole = (formData.get('accountRole') as string) || 'teacher'
    const jobTitle = (formData.get('jobTitle') as string)?.trim() || null
    const department = (formData.get('department') as string)?.trim() || null
    const employmentType = (formData.get('employmentType') as string) || 'full-time'
    const dateHiredRaw = formData.get('dateHired') as string
    const bio = (formData.get('bio') as string)?.trim() || null
    const qualifications = (formData.get('qualifications') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'Le prénom, le nom et l’adresse e-mail sont obligatoires.' }
    }
    if (accountRole !== 'teacher' && accountRole !== 'accountant') {
      return { success: false, error: 'Sélectionnez un rôle de compte valide pour le personnel.' }
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return { success: false, error: 'Un compte utilise déjà cette adresse e-mail.' }
    }

    const tempPassword = generateTempPassword()
    const passwordHash = await hashPassword(tempPassword)
    const employeeId = await generateEmployeeId()
    const name = `${firstName} ${lastName}`

    const user = await db.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: accountRole,
        phone,
        active: true,
      },
    })

    const staff = await db.staff.create({
      data: {
        userId: user.id,
        employeeId,
        jobTitle,
        department,
        employmentType,
        dateHired: dateHiredRaw ? new Date(dateHiredRaw) : null,
        bio,
        qualifications,
      },
    })

    revalidatePath('/staff')
    return { success: true, id: staff.id, tempPassword }
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createStaffAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue. Veuillez réessayer.' }
  }
}

// ─── Update Staff ─────────────────────────────────────────────────────────────

export async function updateStaffAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(['admin'])

    const staff = await db.staff.findUnique({ where: { id }, include: { user: true } })
    if (!staff) return { success: false, error: 'Membre du personnel introuvable.' }

    const firstName = (formData.get('firstName') as string)?.trim()
    const lastName = (formData.get('lastName') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const phone = (formData.get('phone') as string)?.trim() || null
    const accountRole = (formData.get('accountRole') as string) || 'teacher'
    const jobTitle = (formData.get('jobTitle') as string)?.trim() || null
    const department = (formData.get('department') as string)?.trim() || null
    const employmentType = (formData.get('employmentType') as string) || 'full-time'
    const dateHiredRaw = formData.get('dateHired') as string
    const bio = (formData.get('bio') as string)?.trim() || null
    const qualifications = (formData.get('qualifications') as string)?.trim() || null

    if (!firstName || !lastName || !email) {
      return { success: false, error: 'Le prénom, le nom et l’adresse e-mail sont obligatoires.' }
    }
    if (accountRole !== 'teacher' && accountRole !== 'accountant') {
      return { success: false, error: 'Sélectionnez un rôle de compte valide pour le personnel.' }
    }

    if (email !== staff.user.email) {
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) return { success: false, error: 'Un compte utilise déjà cette adresse e-mail.' }
    }

    await db.user.update({
      where: { id: staff.userId },
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
        role: accountRole,
      },
    })

    await db.staff.update({
      where: { id },
      data: {
        jobTitle,
        department,
        employmentType,
        dateHired: dateHiredRaw ? new Date(dateHiredRaw) : null,
        bio,
        qualifications,
      },
    })

    revalidatePath('/staff')
    revalidatePath(`/staff/${id}`)
    redirect(`/staff/${id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('updateStaffAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue. Veuillez réessayer.' }
  }
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export async function createLeaveRequestAction(
  staffId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole(['admin', 'teacher'])
    const staff = await db.staff.findFirst({
      where: { id: staffId, ...(user.role === 'admin' ? {} : { userId: user.id }) },
      select: { id: true },
    })
    if (!staff) return { success: false, error: 'Profil du membre introuvable ou inaccessible.' }

    const type = (formData.get('type') as string)?.trim()
    const startDateRaw = formData.get('startDate') as string
    const endDateRaw = formData.get('endDate') as string
    const reason = (formData.get('reason') as string)?.trim() || null

    if (!type || !startDateRaw || !endDateRaw) {
      return { success: false, error: 'Le type de congé et les dates de début et de fin sont obligatoires.' }
    }

    if (!['annual', 'sick', 'personal', 'bereavement', 'unpaid', 'other'].includes(type)) {
      return { success: false, error: 'Sélectionnez un type de congé valide.' }
    }

    const startDate = new Date(`${startDateRaw}T00:00:00.000Z`)
    const endDate = new Date(`${endDateRaw}T00:00:00.000Z`)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDateRaw) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDateRaw) ||
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate.toISOString().slice(0, 10) !== startDateRaw ||
      endDate.toISOString().slice(0, 10) !== endDateRaw
    ) {
      return { success: false, error: 'Saisissez des dates de congé valides.' }
    }

    if (endDate < startDate) {
      return { success: false, error: 'La date de fin ne peut pas précéder la date de début.' }
    }

    await db.leaveRequest.create({
      data: {
        staffId,
        type,
        startDate,
        endDate,
        reason,
        status: 'pending',
      },
    })

    revalidatePath(`/staff/${staffId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('createLeaveRequestAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}

export async function updateLeaveStatusAction(
  leaveId: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const approver = await requireRole(['admin'])
    if (status !== 'approved' && status !== 'declined') {
      return { success: false, error: 'Sélectionnez un statut de congé approuvé.' }
    }

    const leave = await db.leaveRequest.findUnique({ where: { id: leaveId } })
    if (!leave) return { success: false, error: 'Demande de congé introuvable.' }

    await db.leaveRequest.update({
      where: { id: leaveId },
      data: { status, approvedBy: approver.name },
    })

    // Fire-and-forget notification to staff member
    if (status === 'approved' || status === 'declined') {
      db.staff.findUnique({
        where: { id: leave.staffId },
        include: { user: { select: { name: true, email: true } } },
      }).then(staff => {
        if (!staff?.user?.email) return
        db.schoolSettings.findFirst().then(settings => {
          sendEmail({
            to: staff.user!.email,
            subject: `Demande de congé ${status === 'approved' ? 'approuvée' : 'refusée'} — ${settings?.name ?? 'Établissement'}`,
            html: leaveDecisionEmailHtml(staff.user!.name, status, leave.type, leave.startDate, leave.endDate, settings?.name ?? 'School'),
          }).catch(() => {})
        }).catch(() => {})
      }).catch(() => {})
    }

    revalidatePath(`/staff/${leave.staffId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('updateLeaveStatusAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}
