'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { generateSlots, type ProposedSlot } from './generator-algorithm'

export type { ProposedSlot }

export interface SlotData {
  classId: string
  staffId?: string | null
  roomId?: string | null
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  notes?: string | null
}

export async function createSlotAction(data: SlotData) {
  await requireRole(['admin'])

  try {
    await db.timetableSlot.create({
      data: {
        classId: data.classId,
        staffId: data.staffId || null,
        roomId: data.roomId || null,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    console.error('createSlotAction error:', e)
    return { error: 'Impossible de créer ce créneau. Vérifiez les conflits de classe, salle ou enseignant.' }
  }
}

export async function updateSlotAction(id: string, data: SlotData) {
  await requireRole(['admin'])

  try {
    await db.timetableSlot.update({
      where: { id },
      data: {
        classId: data.classId,
        staffId: data.staffId || null,
        roomId: data.roomId || null,
        dayOfWeek: data.dayOfWeek,
        period: data.period,
        startTime: data.startTime,
        endTime: data.endTime,
        notes: data.notes || null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    console.error('updateSlotAction error:', e)
    return { error: 'Impossible de modifier ce créneau. Vérifiez les conflits de classe, salle ou enseignant.' }
  }
}

export async function deleteSlotAction(id: string) {
  await requireRole(['admin'])

  try {
    await db.timetableSlot.delete({ where: { id } })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    console.error('deleteSlotAction error:', e)
    return { error: 'Impossible de supprimer ce créneau.' }
  }
}

export async function bulkCreateSlotsAction(
  slots: SlotData[],
): Promise<{ created: number; skipped: number; errors: string[] }> {
  await requireRole(['admin'])

  const DAY_LABEL = ['', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.']
  let created = 0
  let skipped = 0
  const errors: string[] = []

  for (const slot of slots) {
    const existing = await db.timetableSlot.findFirst({
      where: { classId: slot.classId, dayOfWeek: slot.dayOfWeek, period: slot.period },
    })
    if (existing) { skipped++; continue }

    if (slot.roomId) {
      const roomConflict = await db.timetableSlot.findFirst({
        where: { roomId: slot.roomId, dayOfWeek: slot.dayOfWeek, period: slot.period },
      })
      if (roomConflict) {
        const room = await db.room.findUnique({ where: { id: slot.roomId } })
        errors.push(`La salle ${room?.code ?? '?'} est déjà réservée ${DAY_LABEL[slot.dayOfWeek]} au créneau P${slot.period}.`)
        skipped++
        continue
      }
    }

    if (slot.staffId) {
      const teacherConflict = await db.timetableSlot.findFirst({
        where: { staffId: slot.staffId, dayOfWeek: slot.dayOfWeek, period: slot.period },
      })
      if (teacherConflict) {
        const s = await db.staff.findUnique({ where: { id: slot.staffId }, include: { user: true } })
        errors.push(`${s?.user.name ?? 'Enseignant'} a déjà un cours ${DAY_LABEL[slot.dayOfWeek]} au créneau P${slot.period}.`)
        skipped++
        continue
      }
    }

    try {
      await db.timetableSlot.create({
        data: {
          classId: slot.classId,
          staffId: slot.staffId ?? null,
          roomId: slot.roomId ?? null,
          dayOfWeek: slot.dayOfWeek,
          period: slot.period,
          startTime: slot.startTime,
          endTime: slot.endTime,
          notes: slot.notes ?? null,
        },
      })
      created++
    } catch (error) {
      console.error('bulkCreateSlotsAction slot error:', error)
      errors.push(`Impossible de créer le créneau ${DAY_LABEL[slot.dayOfWeek]} P${slot.period}.`)
      skipped++
    }
  }

  revalidatePath('/timetable')
  return { created, skipped, errors }
}

// ─── Schedule Generator Actions ───────────────────────────────────────────────

export interface RequirementData {
  classId: string
  staffId?: string | null
  preferredRoomId?: string | null
  periodsPerWeek: number
  label?: string | null
}

export async function createRequirementAction(data: RequirementData) {
  await requireRole(['admin'])

  try {
    await db.timetableRequirement.create({
      data: {
        classId: data.classId,
        staffId: data.staffId ?? null,
        preferredRoomId: data.preferredRoomId ?? null,
        periodsPerWeek: data.periodsPerWeek,
        label: data.label ?? null,
      },
    })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    console.error('createRequirementAction error:', e)
    if (msg.includes('Unique constraint')) return { error: 'Une exigence existe déjà pour cette classe et cet enseignant.' }
    return { error: 'Impossible d’enregistrer cette exigence de planning.' }
  }
}

export async function deleteRequirementAction(id: string) {
  await requireRole(['admin'])

  try {
    await db.timetableRequirement.delete({ where: { id } })
    revalidatePath('/timetable')
    return { success: true }
  } catch (e: unknown) {
    console.error('deleteRequirementAction error:', e)
    return { error: 'Impossible de supprimer cette exigence de planning.' }
  }
}

export async function generateScheduleAction(): Promise<{ slots: ProposedSlot[]; warnings: string[] }> {
  await requireRole(['admin'])

  const activeYear = await db.academicYear.findFirst({ where: { active: true } })
  if (!activeYear) return { slots: [], warnings: ['Aucune année scolaire active.'] }

  const [requirements, existingSlots] = await Promise.all([
    db.timetableRequirement.findMany({ where: { class: { academicYearId: activeYear.id } } }),
    db.timetableSlot.findMany({
      where: { class: { academicYearId: activeYear.id } },
      select: { classId: true, staffId: true, roomId: true, dayOfWeek: true, period: true },
    }),
  ])

  const slots = generateSlots(requirements, existingSlots)
  const warnings = slots.filter((s) => s.warning).map((s) => s.warning!)

  return { slots, warnings }
}

export async function applyGeneratedScheduleAction(
  slots: ProposedSlot[],
  clearExisting: boolean,
): Promise<{ created: number; errors: string[] }> {
  await requireRole(['admin'])

  try {
    if (typeof clearExisting !== 'boolean') {
      return { created: 0, errors: ['Option de remplacement du planning invalide.'] }
    }
    if (!Array.isArray(slots) || slots.length === 0 || slots.length > 500) {
      return { created: 0, errors: ['Le planning doit contenir entre 1 et 500 créneaux.'] }
    }

    const activeYear = await db.academicYear.findFirst({ where: { active: true } })
    if (!activeYear) return { created: 0, errors: ['Aucune année scolaire active.'] }

    const classIds = [...new Set(slots.map(slot => slot.classId))]
    const staffIds = [...new Set(slots.map(slot => slot.staffId).filter((id): id is string => Boolean(id)))]
    const roomIds = [...new Set(slots.map(slot => slot.roomId).filter((id): id is string => Boolean(id)))]
    const [classes, staff, rooms] = await Promise.all([
      db.class.findMany({ where: { id: { in: classIds }, academicYearId: activeYear.id }, select: { id: true } }),
      staffIds.length ? db.staff.findMany({ where: { id: { in: staffIds } }, select: { id: true } }) : [],
      roomIds.length ? db.room.findMany({ where: { id: { in: roomIds } }, select: { id: true } }) : [],
    ])
    if (classes.length !== classIds.length) {
      return { created: 0, errors: ['Un ou plusieurs créneaux utilisent une classe hors de l’année scolaire active.'] }
    }
    if (staff.length !== staffIds.length || rooms.length !== roomIds.length) {
      return { created: 0, errors: ['Un enseignant ou une salle sélectionnée est introuvable.'] }
    }

    const isValidTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
    for (const slot of slots) {
      if (
        !Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 1 || slot.dayOfWeek > 5 ||
        !Number.isInteger(slot.period) || slot.period < 1 || slot.period > 8 ||
        !isValidTime(slot.startTime) || !isValidTime(slot.endTime) || slot.startTime >= slot.endTime
      ) {
        return { created: 0, errors: ['Un créneau contient un jour, une période ou un horaire invalide.'] }
      }
    }

    const existingSlots = clearExisting ? [] : await db.timetableSlot.findMany({
      where: { class: { academicYearId: activeYear.id } },
      select: { classId: true, staffId: true, roomId: true, dayOfWeek: true, period: true },
    })
    const classBookings = new Set<string>()
    const staffBookings = new Set<string>()
    const roomBookings = new Set<string>()
    for (const slot of existingSlots) {
      classBookings.add(`${slot.classId}|${slot.dayOfWeek}|${slot.period}`)
      if (slot.staffId) staffBookings.add(`${slot.staffId}|${slot.dayOfWeek}|${slot.period}`)
      if (slot.roomId) roomBookings.add(`${slot.roomId}|${slot.dayOfWeek}|${slot.period}`)
    }

    for (const slot of slots) {
      const classKey = `${slot.classId}|${slot.dayOfWeek}|${slot.period}`
      const staffKey = slot.staffId ? `${slot.staffId}|${slot.dayOfWeek}|${slot.period}` : null
      const roomKey = slot.roomId ? `${slot.roomId}|${slot.dayOfWeek}|${slot.period}` : null
      if (classBookings.has(classKey)) return { created: 0, errors: ['Une classe a plusieurs cours au même créneau.'] }
      if (staffKey && staffBookings.has(staffKey)) return { created: 0, errors: ['Un enseignant est affecté à plusieurs classes au même créneau.'] }
      if (roomKey && roomBookings.has(roomKey)) return { created: 0, errors: ['Une salle est affectée à plusieurs classes au même créneau.'] }
      classBookings.add(classKey)
      if (staffKey) staffBookings.add(staffKey)
      if (roomKey) roomBookings.add(roomKey)
    }

    await db.$transaction(async tx => {
      if (clearExisting) {
        await tx.timetableSlot.deleteMany({ where: { class: { academicYearId: activeYear.id } } })
      }
      for (const slot of slots) {
        await tx.timetableSlot.create({
          data: {
            classId: slot.classId,
            staffId: slot.staffId ?? null,
            roomId: slot.roomId ?? null,
            dayOfWeek: slot.dayOfWeek,
            period: slot.period,
            startTime: slot.startTime,
            endTime: slot.endTime,
          },
        })
      }
    }, { isolationLevel: 'Serializable' })

    revalidatePath('/timetable')
    return { created: slots.length, errors: [] }
  } catch (e: unknown) {
    console.error('applyGeneratedScheduleAction error:', e)
    return { created: 0, errors: ['Aucun changement appliqué : le planning n’a pas pu être enregistré.'] }
  }
}
