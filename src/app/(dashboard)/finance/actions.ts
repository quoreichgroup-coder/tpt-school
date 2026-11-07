'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sendEmail, invoiceEmailHtml } from '@/lib/email'
import { runFeeReminders } from '@/lib/fee-reminders'
import { MAX_MONEY_MINOR_UNITS, minorUnitsToAmount, parseMoneyToMinorUnits } from '@/lib/money'

const FINANCE_ROLES = ['admin', 'accountant']

// ─── Fee Types ────────────────────────────────────────────────────────────────

export async function createFeeTypeAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(FINANCE_ROLES)

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const amountRaw = formData.get('amount') as string
    const frequency = (formData.get('frequency') as string) || 'annual'
    const yearLevelRaw = formData.get('yearLevel') as string
    const active = formData.get('active') !== 'false'

    if (!name || !amountRaw) {
      return { success: false, error: 'Le nom et le montant sont obligatoires.' }
    }

    const amountMinorUnits = parseMoneyToMinorUnits(amountRaw)
    if (amountMinorUnits === null) {
      return { success: false, error: 'Saisissez un montant valide avec au maximum deux décimales.' }
    }
    const amount = minorUnitsToAmount(amountMinorUnits)

    await db.feeType.create({
      data: {
        name,
        description,
        amount,
        frequency,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        active,
      },
    })

    revalidatePath('/finance/fee-types')
    return { success: true }
  } catch (err: unknown) {
    console.error('createFeeTypeAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}

export async function updateFeeTypeAction(
  id: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireRole(FINANCE_ROLES)

    const name = (formData.get('name') as string)?.trim()
    const description = (formData.get('description') as string)?.trim() || null
    const amountRaw = formData.get('amount') as string
    const frequency = (formData.get('frequency') as string) || 'annual'
    const yearLevelRaw = formData.get('yearLevel') as string
    const active = formData.get('active') === 'true'

    if (!name || !amountRaw) {
      return { success: false, error: 'Le nom et le montant sont obligatoires.' }
    }

    const amountMinorUnits = parseMoneyToMinorUnits(amountRaw)
    if (amountMinorUnits === null) {
      return { success: false, error: 'Saisissez un montant valide avec au maximum deux décimales.' }
    }
    const amount = minorUnitsToAmount(amountMinorUnits)

    await db.feeType.update({
      where: { id },
      data: {
        name,
        description,
        amount,
        frequency,
        yearLevel: yearLevelRaw ? parseInt(yearLevelRaw, 10) : null,
        active,
      },
    })

    revalidatePath('/finance/fee-types')
    return { success: true }
  } catch (err: unknown) {
    console.error('updateFeeTypeAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function createInvoiceAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    await requireRole(FINANCE_ROLES)

    const studentId = formData.get('studentId') as string
    const dueDateRaw = formData.get('dueDate') as string
    const notes = (formData.get('notes') as string)?.trim() || null
    const itemDescriptions = formData.getAll('itemDescription') as string[]
    const itemAmounts = formData.getAll('itemAmount') as string[]
    const itemFeeTypeIds = formData.getAll('itemFeeTypeId') as string[]

    if (!studentId || !dueDateRaw) {
      return { success: false, error: 'L’élève et la date d’échéance sont obligatoires.' }
    }
    const dueDate = new Date(`${dueDateRaw}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) || Number.isNaN(dueDate.getTime()) || dueDate.toISOString().slice(0, 10) !== dueDateRaw) {
      return { success: false, error: 'Saisissez une date d’échéance valide.' }
    }

    if (itemDescriptions.length === 0) {
      return { success: false, error: 'La facture doit contenir au moins une ligne.' }
    }

    const items = itemDescriptions.map((desc, i) => ({
      description: desc.trim(),
      amountMinorUnits: parseMoneyToMinorUnits(itemAmounts[i]),
      feeTypeId: itemFeeTypeIds[i] || null,
    }))
    if (items.some(item => !item.description || item.amountMinorUnits === null || item.amountMinorUnits <= 0)) {
      return { success: false, error: 'Chaque ligne doit avoir une description et un montant positif avec au maximum deux décimales.' }
    }

    const totalMinorUnits = items.reduce((sum, item) => sum + (item.amountMinorUnits ?? 0), 0)
    if (!Number.isSafeInteger(totalMinorUnits) || totalMinorUnits > MAX_MONEY_MINOR_UNITS) {
      return { success: false, error: 'Le montant total de la facture est trop élevé.' }
    }
    const totalAmount = minorUnitsToAmount(totalMinorUnits)

    const invoice = await db.feeInvoice.create({
      data: {
        studentId,
        dueDate,
        issueDate: new Date(),
        status: 'unpaid',
        notes,
        totalAmount,
        paidAmount: 0,
        items: {
          create: items.map(item => ({
            description: item.description,
            amount: minorUnitsToAmount(item.amountMinorUnits ?? 0),
            feeTypeId: item.feeTypeId || undefined,
          })),
        },
      },
    })

    // Fire-and-forget invoice email to parents
    db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { name: true } },
        parents: { include: { parent: { include: { user: { select: { name: true, email: true } } } } } },
      },
    }).then(student => {
      if (!student) return
      const primaryParent = student.parents.find(sp => sp.isPrimary)?.parent ?? student.parents[0]?.parent
      if (!primaryParent?.user?.email) return
      db.schoolSettings.findFirst().then(settings => {
        const schoolName = settings?.name ?? 'School'
        const symbol = settings?.currencySymbol ?? '$'
        sendEmail({
          to: primaryParent.user!.email,
          subject: `Fee invoice — ${student.user.name}`,
          html: invoiceEmailHtml(primaryParent.user!.name, student.user.name, invoice.id, totalAmount, dueDate, symbol, schoolName),
        }).catch(() => {})
      }).catch(() => {})
    }).catch(() => {})

    revalidatePath('/finance')
    redirect(`/finance/invoices/${invoice.id}`)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err
    console.error('createInvoiceAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function recordPaymentAction(
  invoiceId: string,
  amount: string,
  method: string,
  reference: string,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireRole(FINANCE_ROLES)
    if (!['cash', 'bank_transfer', 'card', 'cheque', 'online'].includes(method)) {
      return { success: false, error: 'Sélectionnez un mode de paiement valide.' }
    }
    const amountMinorUnits = parseMoneyToMinorUnits(amount)
    if (amountMinorUnits === null || amountMinorUnits <= 0) {
      return { success: false, error: 'Le paiement doit être supérieur à zéro et comporter au maximum deux décimales.' }
    }

    const paymentResult = await db.$transaction(async tx => {
      const invoice = await tx.feeInvoice.findUnique({ where: { id: invoiceId } })
      if (!invoice) return { error: 'Facture introuvable.' }
      if (invoice.status === 'paid' || invoice.status === 'waived') return { error: 'Cette facture est déjà réglée.' }

      const totalMinorUnits = parseMoneyToMinorUnits(invoice.totalAmount.toString())
      const paidMinorUnits = parseMoneyToMinorUnits(invoice.paidAmount.toString())
      if (totalMinorUnits === null || paidMinorUnits === null) return { error: 'Le montant de la facture est invalide.' }
      const balanceMinorUnits = totalMinorUnits - paidMinorUnits
      if (balanceMinorUnits <= 0) return { error: 'Cette facture n’a plus de solde à payer.' }
      if (amountMinorUnits > balanceMinorUnits) return { error: 'Le paiement dépasse le solde restant.' }

      const newPaidAmount = minorUnitsToAmount(paidMinorUnits + amountMinorUnits)
      const newStatus = paidMinorUnits + amountMinorUnits === totalMinorUnits ? 'paid' : 'partial'
      const updated = await tx.feeInvoice.updateMany({
        where: { id: invoiceId, paidAmount: invoice.paidAmount },
        data: { paidAmount: newPaidAmount, status: newStatus },
      })
      if (updated.count !== 1) return { error: 'Un autre paiement a modifié cette facture. Rechargez la page et réessayez.' }

      await tx.feePayment.create({
        data: {
          invoiceId,
          amount: minorUnitsToAmount(amountMinorUnits),
          method,
          reference: reference || null,
          notes: notes || null,
          paidAt: new Date(),
          recordedBy: user.id,
        },
      })
      return { error: null }
    })
    if (paymentResult.error) return { success: false, error: paymentResult.error }

    revalidatePath('/finance')
    revalidatePath(`/finance/invoices/${invoiceId}`)
    return { success: true }
  } catch (err: unknown) {
    console.error('recordPaymentAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}

// ─── Fee Reminders ────────────────────────────────────────────────────────────

export async function triggerFeeRemindersAction(): Promise<{
  success: boolean
  sent?: number
  skipped?: number
  errors?: number
  error?: string
}> {
  try {
    await requireRole(FINANCE_ROLES)
    const result = await runFeeReminders()
    return { success: true, ...result }
  } catch (err: unknown) {
    console.error('triggerFeeRemindersAction error:', err)
    return { success: false, error: 'Une erreur inattendue est survenue.' }
  }
}
