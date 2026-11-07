'use server'

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!)
}

export async function requestPasswordResetAction(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  const normalised = email.trim().toLowerCase()
  if (!normalised) return { success: false, error: 'L’adresse e-mail est obligatoire.' }

  // Always return success to avoid user enumeration
  const user = await db.user.findUnique({ where: { email: normalised } })
  if (!user || !user.active) return { success: true }

  // Delete any existing token for this email
  await db.verificationToken.deleteMany({ where: { identifier: normalised } })

  const token = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await db.verificationToken.create({
    data: { identifier: normalised, token, expires },
  })

  const settings = await db.schoolSettings.findFirst()
  const schoolName = settings?.name ?? 'QSCHOOL'
  const safeName = escapeHtml(user.name)
  const safeSchoolName = escapeHtml(schoolName)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const safeResetUrl = escapeHtml(resetUrl)

  await sendEmail({
    to: normalised,
    subject: `Réinitialisation de votre mot de passe ${schoolName}`,
    html: `
      <p>Bonjour ${safeName},</p>
      <p>Vous avez demandé la réinitialisation du mot de passe de votre compte ${safeSchoolName}.</p>
      <p><a href="${safeResetUrl}" style="background:#0f172a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Réinitialiser mon mot de passe</a></p>
      <p>Ce lien expire dans une heure. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>
    `,
    text: `Réinitialisez votre mot de passe : ${resetUrl}\n\nCe lien expire dans une heure.`,
  })

  return { success: true }
}

export async function resetPasswordAction(
  token: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: 'Lien de réinitialisation invalide.' }
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' }
  }

  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record) return { success: false, error: 'Lien de réinitialisation invalide ou déjà utilisé.' }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { token } })
    return { success: false, error: 'Ce lien a expiré. Veuillez en demander un nouveau.' }
  }

  const user = await db.user.findUnique({ where: { email: record.identifier } })
  if (!user || !user.active) return { success: false, error: 'Compte introuvable.' }

  const passwordHash = await hashPassword(newPassword)
  await db.user.update({ where: { id: user.id }, data: { passwordHash } })
  await db.verificationToken.delete({ where: { token } })

  return { success: true }
}
