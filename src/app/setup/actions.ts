'use server'

import { z } from 'zod'
import { db } from '@/lib/db'
import { createSession, hashPassword, setSessionCookie } from '@/lib/auth'

type SchoolInfo = {
  name: string
  shortName: string
  address: string
  phone: string
  email: string
  schoolType: string
  currentYear: string
}

type AdminInfo = {
  name: string
  email: string
  password: string
  confirmPassword: string
}

const schoolInfoSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de l’établissement est obligatoire.').max(200),
  shortName: z.string().trim().max(80),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(40),
  email: z.string().trim().max(254).refine(
    value => value === '' || z.email().safeParse(value).success,
    'Saisissez une adresse e-mail valide pour l’établissement.'
  ),
  schoolType: z.enum(['primary', 'secondary', 'both']),
  currentYear: z.string().trim().regex(/^\d{4}$/).refine(
    value => Number(value) >= 2000 && Number(value) <= 2100,
    'Saisissez une année scolaire comprise entre 2000 et 2100.'
  ),
})

const adminInfoSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de l’administrateur est obligatoire.').max(120),
  email: z.string().trim().email('Saisissez une adresse e-mail valide pour l’administrateur.').max(254),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères.'),
  confirmPassword: z.string(),
}).refine(value => value.password === value.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Les mots de passe ne correspondent pas.',
})

class SetupError extends Error {}

function hasPrismaCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export async function completeSetupAction(
  schoolInfo: SchoolInfo,
  adminInfo: AdminInfo
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsedSchool = schoolInfoSchema.safeParse(schoolInfo)
    if (!parsedSchool.success) {
      return { success: false, error: parsedSchool.error.issues[0]?.message ?? 'Vérifiez les informations de l’établissement.' }
    }
    const parsedAdmin = adminInfoSchema.safeParse(adminInfo)
    if (!parsedAdmin.success) {
      return { success: false, error: parsedAdmin.error.issues[0]?.message ?? 'Vérifiez les informations de l’administrateur.' }
    }

    const school = parsedSchool.data
    const adminInput = parsedAdmin.data
    if (new TextEncoder().encode(adminInput.password).byteLength > 72) {
      return { success: false, error: 'Le mot de passe doit faire au maximum 72 octets UTF-8.' }
    }

    const currentSettings = await db.schoolSettings.findFirst({ select: { setupComplete: true } })
    if (currentSettings?.setupComplete) {
      return { success: false, error: 'La configuration a déjà été terminée.' }
    }
    const currentAdmin = await db.user.findUnique({
      where: { email: adminInput.email.toLowerCase() },
      select: { id: true },
    })
    if (currentAdmin) {
      return { success: false, error: 'Un compte avec cette adresse e-mail existe déjà.' }
    }

    const passwordHash = await hashPassword(adminInput.password)

    const admin = await db.$transaction(async tx => {
      // Keep the one-time setup check inside a serializable transaction so
      // simultaneous submissions cannot create multiple initial admins.
      const existing = await tx.schoolSettings.findFirst()
      if (existing?.setupComplete) throw new SetupError('La configuration a déjà été terminée.')

      const existingUser = await tx.user.findUnique({
        where: { email: adminInput.email.toLowerCase() },
        select: { id: true },
      })
      if (existingUser) throw new SetupError('Un compte avec cette adresse e-mail existe déjà.')

      // Create or update SchoolSettings
      if (existing) {
        await tx.schoolSettings.update({
          where: { id: existing.id },
          data: {
            name: school.name,
            shortName: school.shortName || null,
            address: school.address || null,
            phone: school.phone || null,
            email: school.email ? school.email.toLowerCase() : null,
            schoolType: school.schoolType,
            currentYear: Number(school.currentYear),
            setupComplete: true,
          },
        })
      } else {
        await tx.schoolSettings.create({
          data: {
            name: school.name,
            shortName: school.shortName || null,
            address: school.address || null,
            phone: school.phone || null,
            email: school.email ? school.email.toLowerCase() : null,
            schoolType: school.schoolType,
            currentYear: Number(school.currentYear),
            setupComplete: true,
          },
        })
      }

      // Create admin user
      return tx.user.create({
        data: {
          name: adminInput.name,
          email: adminInput.email.toLowerCase(),
          passwordHash,
          role: 'admin',
          active: true,
        },
      })
    }, { isolationLevel: 'Serializable' })

    const token = await createSession(admin.id)
    await setSessionCookie(token)
    return { success: true }
  } catch (err) {
    if (err instanceof SetupError) return { success: false, error: err.message }
    if (hasPrismaCode(err, 'P2034')) {
      return { success: false, error: 'Une autre configuration vient d’être terminée. Actualisez la page et connectez-vous.' }
    }
    if (hasPrismaCode(err, 'P2002')) {
      return { success: false, error: 'Un compte avec cette adresse e-mail existe déjà.' }
    }
    console.error('Setup error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue. Veuillez réessayer.' }
  }
}
