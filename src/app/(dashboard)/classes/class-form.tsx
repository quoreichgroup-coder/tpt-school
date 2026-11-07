'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClassAction, updateClassAction } from './actions'

type Room = { id: string; name: string; code: string }
type AcademicYear = { id: string; year: number; active: boolean }
type Staff = { id: string; user: { name: string } }

type ClassData = {
  id: string
  name: string
  code: string
  subject: string | null
  yearLevel: number | null
  maxStudents: number | null
  description: string | null
  roomId: string | null
  academicYearId: string
  teachers: { staffId: string; isPrimary: boolean }[]
}

interface ClassFormProps {
  rooms: Room[]
  academicYears: AcademicYear[]
  staff: Staff[]
  classData?: ClassData
}

export default function ClassForm({ rooms, academicYears, staff, classData }: ClassFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const primaryTeacher = classData?.teachers.find((t) => t.isPrimary)

  const [roomId, setRoomId] = useState<string>(classData?.roomId ?? '')
  const [academicYearId, setAcademicYearId] = useState<string>(
    classData?.academicYearId ?? academicYears.find((y) => y.active)?.id ?? ''
  )
  const [yearLevel, setYearLevel] = useState<string>(classData?.yearLevel?.toString() ?? '')
  const [staffId, setStaffId] = useState<string>(primaryTeacher?.staffId ?? '')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = e.currentTarget
    const formData = new FormData(form)
    if (roomId) formData.set('roomId', roomId)
    if (academicYearId) formData.set('academicYearId', academicYearId)
    if (yearLevel) formData.set('yearLevel', yearLevel)
    if (staffId) formData.set('staffId', staffId)

    try {
      let result: { error?: string } | undefined
      if (classData) {
        result = await updateClassAction(classData.id, formData) as { error?: string } | undefined
      } else {
        result = await createClassAction(formData) as { error?: string } | undefined
      }
      if (result?.error) {
        setError(result.error)
      }
    } catch {
      // redirect was called — navigation handled
    } finally {
      setLoading(false)
    }
  }

  const yearLevels = Array.from({ length: 13 }, (_, i) => i + 1)

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Nom de la classe *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={classData?.name}
            placeholder="Ex. : Mathématiques 10A"
            required
          />
        </div>

        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="code">Code de la classe *</Label>
          <Input
            id="code"
            name="code"
            defaultValue={classData?.code}
            placeholder="Ex. : MATH10A"
            required
          />
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Matière</Label>
          <Input
            id="subject"
            name="subject"
            defaultValue={classData?.subject ?? ''}
            placeholder="Ex. : Mathématiques"
          />
        </div>

        {/* Year Level */}
        <div className="space-y-2">
          <Label>Niveau scolaire</Label>
          <Select value={yearLevel} onValueChange={(v) => { if (v !== null) setYearLevel(v) }}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un niveau" />
            </SelectTrigger>
            <SelectContent>
              {yearLevels.map((yl) => (
                <SelectItem key={yl} value={String(yl)}>Niveau {yl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Max Students */}
        <div className="space-y-2">
          <Label htmlFor="maxStudents">Effectif maximal</Label>
          <Input
            id="maxStudents"
            name="maxStudents"
            type="number"
            min={1}
            defaultValue={classData?.maxStudents ?? ''}
            placeholder="e.g. 30"
          />
        </div>

        {/* Academic Year */}
        <div className="space-y-2">
          <Label>Année scolaire *</Label>
          <Select value={academicYearId} onValueChange={(v) => { if (v !== null) setAcademicYearId(v) }} required>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une année scolaire" />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((ay) => (
                <SelectItem key={ay.id} value={ay.id}>
                  {ay.year}{ay.active ? ' (En cours)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Room */}
        <div className="space-y-2">
          <Label>Salle</Label>
          <Select value={roomId} onValueChange={(v) => setRoomId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une salle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucune salle attribuée</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Primary Teacher */}
        <div className="space-y-2">
          <Label>Enseignant principal</Label>
          <Select value={staffId} onValueChange={(v) => setStaffId(v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner un enseignant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucun enseignant attribué</SelectItem>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={classData?.description ?? ''}
          placeholder="Description facultative de la classe…"
          rows={3}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'Enregistrement…' : classData ? 'Mettre à jour la classe' : 'Créer la classe'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={loading}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
