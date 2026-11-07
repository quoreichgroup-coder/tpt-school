'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword, requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

export type ImportStaffRow = {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  department?: string
  employmentType?: string
  dateHired?: string
}

export type ImportResult = {
  success: boolean
  imported: number
  skipped: number
  errors: string[]
  credentials: { name: string; email: string; tempPassword: string }[]
}

export async function importStaffAction(rows: ImportStaffRow[]): Promise<ImportResult> {
  await requireRole(['admin'])

  let imported = 0
  let skipped = 0
  const errors: string[] = []
  const credentials: ImportResult['credentials'] = []

  for (const [index, row] of rows.entries()) {
    try {
      const email = row.email.trim().toLowerCase()
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) {
        skipped++
        continue
      }

      const name = `${row.firstName.trim()} ${row.lastName.trim()}`
      const tempPassword = randomBytes(9).toString('base64url').slice(0, 12)
      const passwordHash = await hashPassword(tempPassword)

      await db.$transaction(async tx => {
        let sequence = (await tx.staff.count()) + 1
        let employeeId = `EMP-${String(sequence).padStart(4, '0')}`
        while (await tx.staff.findUnique({ where: { employeeId }, select: { id: true } })) {
          sequence++
          employeeId = `EMP-${String(sequence).padStart(4, '0')}`
        }

        const user = await tx.user.create({
          data: { email, passwordHash, name, role: 'teacher', active: true },
        })

        await tx.staff.create({
          data: {
            userId: user.id,
            employeeId,
            jobTitle: row.jobTitle || null,
            department: row.department || null,
            employmentType: row.employmentType || 'full-time',
            dateHired: row.dateHired ? new Date(row.dateHired) : null,
          },
        })
      })

      imported++
      credentials.push({ name, email, tempPassword })
    } catch (err) {
      console.error(`importStaffAction row ${index + 2} failed:`, err)
      errors.push(`Ligne ${index + 2} (${row.email}) : impossible de créer ce compte.`)
    }
  }

  revalidatePath('/staff')
  return { success: true, imported, skipped, errors, credentials }
}
