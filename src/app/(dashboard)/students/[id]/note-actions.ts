'use server'

import { db } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

async function teacherCanAccessStudent(userId: string, studentId: string): Promise<boolean> {
  const enrolment = await db.classEnrolment.findFirst({
    where: {
      studentId,
      status: 'active',
      class: { teachers: { some: { staff: { userId } } } },
    },
    select: { id: true },
  })
  return !!enrolment
}

const NOTE_TYPES = new Set(['general', 'academic', 'medical', 'behaviour', 'pastoral'])

export async function createNoteAction(
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const content = (formData.get('content') as string)?.trim()
  const type = (formData.get('type') as string) || 'general'
  const isPrivate = formData.get('private') === 'true' && session.role === 'admin'

  if (!content || content.length > 5000) return { success: false, error: 'Note content must be between 1 and 5000 characters.' }
  if (!NOTE_TYPES.has(type)) return { success: false, error: 'Select a valid note type.' }
  if (session.role === 'teacher' && !await teacherCanAccessStudent(session.id, studentId)) {
    return { success: false, error: 'You are not assigned to this student.' }
  }

  await db.studentNote.create({
    data: { studentId, authorId: session.id, content, type, private: isPrivate },
  })

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

export async function updateNoteAction(
  noteId: string,
  studentId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const note = await db.studentNote.findUnique({ where: { id: noteId } })
  if (!note) return { success: false, error: 'Note not found.' }
  if (note.studentId !== studentId) return { success: false, error: 'Note does not belong to this student.' }
  if (note.authorId !== session.id && session.role !== 'admin') {
    return { success: false, error: 'You can only edit your own notes.' }
  }
  if (session.role === 'teacher' && !await teacherCanAccessStudent(session.id, note.studentId)) {
    return { success: false, error: 'You are not assigned to this student.' }
  }

  const content = (formData.get('content') as string)?.trim()
  const type = (formData.get('type') as string) || note.type
  const isPrivate = session.role === 'admin' ? formData.get('private') === 'true' : note.private

  if (!content || content.length > 5000) return { success: false, error: 'Note content must be between 1 and 5000 characters.' }
  if (!NOTE_TYPES.has(type)) return { success: false, error: 'Select a valid note type.' }

  await db.studentNote.update({
    where: { id: noteId },
    data: { content, type, private: isPrivate },
  })

  revalidatePath(`/students/${studentId}`)
  return { success: true }
}

export async function deleteNoteAction(
  noteId: string,
  studentId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireRole(['admin', 'teacher'])
  const note = await db.studentNote.findUnique({ where: { id: noteId } })
  if (!note) return { success: false, error: 'Note not found.' }
  if (note.studentId !== studentId) return { success: false, error: 'Note does not belong to this student.' }
  if (note.authorId !== session.id && session.role !== 'admin') {
    return { success: false, error: 'You can only delete your own notes.' }
  }
  if (session.role === 'teacher' && !await teacherCanAccessStudent(session.id, note.studentId)) {
    return { success: false, error: 'You are not assigned to this student.' }
  }

  await db.studentNote.delete({ where: { id: noteId } })
  revalidatePath(`/students/${studentId}`)
  return { success: true }
}
