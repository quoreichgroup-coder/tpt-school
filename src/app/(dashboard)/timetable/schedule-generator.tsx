'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Wand2, Trash2, AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createRequirementAction,
  deleteRequirementAction,
  generateScheduleAction,
  applyGeneratedScheduleAction,
  type ProposedSlot,
} from './actions'

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

type ClassOption = { id: string; name: string; code: string }
type RoomOption = { id: string; name: string; code: string }
type StaffOption = { id: string; user: { name: string } }

type Requirement = {
  id: string
  classId: string
  staffId: string | null
  preferredRoomId: string | null
  periodsPerWeek: number
  label: string | null
  class: { name: string; code: string }
  staff: { user: { name: string } } | null
  preferredRoom: { code: string } | null
}

type Props = {
  requirements: Requirement[]
  classes: ClassOption[]
  rooms: RoomOption[]
  staff: StaffOption[]
}

export default function ScheduleGenerator({ requirements: initialRequirements, classes, rooms, staff }: Props) {
  const [requirements, setRequirements] = useState(initialRequirements)
  const [proposedSlots, setProposedSlots] = useState<ProposedSlot[] | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [clearExisting, setClearExisting] = useState(false)
  const [applyResult, setApplyResult] = useState<{ created: number; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Add-form state
  const [addClassId, setAddClassId] = useState('')
  const [addStaffId, setAddStaffId] = useState('')
  const [addRoomId, setAddRoomId] = useState('')
  const [addPeriods, setAddPeriods] = useState('5')
  const [addLabel, setAddLabel] = useState('')

  const [isPending, startTransition] = useTransition()

  function handleAddRequirement() {
    if (!addClassId || !addPeriods) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await createRequirementAction({
          classId: addClassId,
          staffId: addStaffId || null,
          preferredRoomId: addRoomId || null,
          periodsPerWeek: parseInt(addPeriods, 10),
          label: addLabel || null,
        })
        if ('error' in result) {
          setError(result.error ?? null)
          return
        }
      // Optimistic update with fetched data lookup
      const cls = classes.find((c) => c.id === addClassId)
      const staffMember = staff.find((s) => s.id === addStaffId) ?? null
      const room = rooms.find((r) => r.id === addRoomId) ?? null
      setRequirements((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          classId: addClassId,
          staffId: addStaffId || null,
          preferredRoomId: addRoomId || null,
          periodsPerWeek: parseInt(addPeriods, 10),
          label: addLabel || null,
          class: cls ?? { name: '', code: '' },
          staff: staffMember ? { user: staffMember.user } : null,
          preferredRoom: room ? { code: room.code } : null,
        },
      ])
      setAddClassId('')
      setAddStaffId('')
      setAddRoomId('')
      setAddPeriods('5')
      setAddLabel('')
      setProposedSlots(null)
      } catch {
        setError('Impossible d’ajouter cette exigence de planning.')
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const result = await deleteRequirementAction(id)
        if ('error' in result) { setError(result.error ?? null); return }
        setRequirements((prev) => prev.filter((r) => r.id !== id))
        setProposedSlots(null)
      } catch {
        setError('Impossible de supprimer cette exigence de planning.')
      }
    })
  }

  function handleGenerate() {
    setError(null)
    setApplyResult(null)
    startTransition(async () => {
      try {
        const result = await generateScheduleAction()
        setProposedSlots(result.slots)
        setWarnings(result.warnings)
      } catch {
        setError('Impossible de générer le planning.')
      }
    })
  }

  function handleApply() {
    if (!proposedSlots) return
    setError(null)
    startTransition(async () => {
      try {
        const result = await applyGeneratedScheduleAction(proposedSlots, clearExisting)
        setApplyResult(result)
        if (result.errors.length === 0) setProposedSlots(null)
      } catch {
        setError('Impossible d’appliquer le planning généré.')
      }
    })
  }

  const classOptions = classes.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))
  const staffOptions = [
    { value: '', label: 'Aucun enseignant attribué' },
    ...staff.map((s) => ({ value: s.id, label: s.user.name })),
  ]
  const roomOptions = [
    { value: '', label: 'Aucune salle préférée' },
    ...rooms.map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` })),
  ]

  return (
    <div className="space-y-6">
      {/* Requirements table */}
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-sm">Exigences de planification</h3>
          <span className="text-xs text-muted-foreground">{requirements.length} exigence{requirements.length !== 1 ? 's' : ''}</span>
        </div>

        {requirements.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucune exigence. Ajoutez-en une ci-dessous pour commencer.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">Classe</th>
                <th className="px-4 py-2 text-left font-medium">Enseignant</th>
                <th className="px-4 py-2 text-left font-medium">Salle préférée</th>
                <th className="px-4 py-2 text-left font-medium">Créneaux/semaine</th>
                <th className="px-4 py-2 text-left font-medium">Libellé</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {requirements.map((req) => (
                <tr key={req.id} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-medium">{req.class.code}</span>
                    <span className="ml-1 text-muted-foreground">{req.class.name}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{req.staff?.user.name ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{req.preferredRoom?.code ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant="secondary">{req.periodsPerWeek}</Badge>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{req.label ?? '—'}</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => handleDelete(req.id)}
                      disabled={isPending}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add row form */}
        <div className="border-t bg-slate-50/60 px-4 py-3">
          <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Ajouter une exigence</p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-col gap-1 min-w-[200px]">
              <Label className="text-xs">Classe *</Label>
              <Combobox
                options={classOptions}
                value={addClassId}
                onValueChange={(v) => setAddClassId(v ?? '')}
                placeholder="Sélectionner une classe"
                searchPlaceholder="Rechercher une classe…"
                emptyText="Aucune classe trouvée"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[160px]">
              <Label className="text-xs">Enseignant</Label>
              <Combobox
                options={staffOptions}
                value={addStaffId}
                onValueChange={(v) => setAddStaffId(v ?? '')}
                placeholder="Aucun enseignant"
                searchPlaceholder="Rechercher un enseignant…"
                emptyText="Aucun enseignant trouvé"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs">Salle préférée</Label>
              <Combobox
                options={roomOptions}
                value={addRoomId}
                onValueChange={(v) => setAddRoomId(v ?? '')}
                placeholder="Aucune salle"
                searchPlaceholder="Rechercher une salle…"
                emptyText="Aucune salle trouvée"
              />
            </div>
            <div className="flex flex-col gap-1 w-24">
              <Label className="text-xs">Créneaux/semaine *</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={addPeriods}
                onChange={(e) => setAddPeriods(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 min-w-[140px]">
              <Label className="text-xs">Libellé (facultatif)</Label>
              <Input
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                placeholder="Ex. : Mathématiques niveau 10"
                className="h-8"
              />
            </div>
            <Button
              onClick={handleAddRequirement}
              disabled={!addClassId || !addPeriods || isPending}
              size="sm"
              className="h-8"
            >
              <Plus className="size-4 mr-1" />
              Ajouter
            </Button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="size-4" /> {error}
            </p>
          )}
        </div>
      </div>

      {/* Generate button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleGenerate}
          disabled={requirements.length === 0 || isPending}
        >
          <Wand2 className="size-4 mr-2" />
          Générer le planning
        </Button>
        {proposedSlots && (
          <span className="text-sm text-muted-foreground">
            {proposedSlots.length} créneau{proposedSlots.length !== 1 ? 'x' : ''} proposé{proposedSlots.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
            <p className="text-sm font-medium text-amber-800 flex items-center gap-1">
            <AlertCircle className="size-4" /> {warnings.length} avertissement{warnings.length !== 1 ? 's' : ''}
          </p>
          {warnings.map((w, i) => (
            <p key={i} className="text-xs text-amber-700 pl-5">{w}</p>
          ))}
        </div>
      )}

      {/* Preview table */}
      {proposedSlots && proposedSlots.length > 0 && (
        <div className="rounded-lg border bg-white">
          <div className="border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Aperçu du planning proposé</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Vérifiez le résultat avant de l’appliquer. Il s’agit d’un aperçu; rien n’a encore été enregistré.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Jour</th>
                  <th className="px-4 py-2 text-left font-medium">Créneau</th>
                  <th className="px-4 py-2 text-left font-medium">Horaire</th>
                  <th className="px-4 py-2 text-left font-medium">Classe</th>
                  <th className="px-4 py-2 text-left font-medium">Enseignant</th>
                  <th className="px-4 py-2 text-left font-medium">Salle</th>
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...proposedSlots]
                  .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period)
                  .map((slot, i) => {
                    const cls = classes.find((c) => c.id === slot.classId)
                    const staffMember = slot.staffId ? staff.find((s) => s.id === slot.staffId) : null
                    const room = slot.roomId ? rooms.find((r) => r.id === slot.roomId) : null
                    return (
                      <tr key={i} className={cn('border-b last:border-0', slot.warning && 'bg-amber-50/50')}>
                        <td className="px-4 py-2 font-medium">{DAY_NAMES[slot.dayOfWeek]}</td>
                        <td className="px-4 py-2">P{slot.period}</td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{slot.startTime}–{slot.endTime}</td>
                        <td className="px-4 py-2">
                          {cls ? <><span className="font-medium">{cls.code}</span> <span className="text-muted-foreground">{cls.name}</span></> : slot.classId}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{staffMember?.user.name ?? '—'}</td>
                        <td className="px-4 py-2 text-muted-foreground">{room?.code ?? '—'}</td>
                        <td className="px-4 py-2">
                          {slot.warning && (
                            <span className="text-xs text-amber-700 flex items-center gap-1">
                              <AlertCircle className="size-3" /> {slot.warning}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>

          {/* Apply section */}
          <div className="border-t px-4 py-3 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                className="rounded"
              />
              Effacer d’abord les créneaux existants
            </label>
            <Button onClick={handleApply} disabled={isPending}>
              Appliquer le planning
            </Button>
          </div>
        </div>
      )}

      {proposedSlots && proposedSlots.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun créneau généré. Vérifiez que les exigences ne provoquent pas trop de conflits.</p>
      )}

      {/* Apply result */}
      {applyResult && (
        <div className={cn(
          'rounded-lg border p-4 space-y-1',
          applyResult.errors.length === 0 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50',
        )}>
          <p className={cn('text-sm font-medium flex items-center gap-1', applyResult.errors.length === 0 ? 'text-green-800' : 'text-amber-800')}>
            {applyResult.errors.length === 0 ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
            {applyResult.created} créneau{applyResult.created !== 1 ? 'x' : ''} appliqué{applyResult.created !== 1 ? 's' : ''} avec succès
            {applyResult.errors.length > 0 && `, ${applyResult.errors.length} erreur${applyResult.errors.length !== 1 ? 's' : ''}`}
          </p>
          {applyResult.errors.map((e, i) => (
            <p key={i} className="text-xs text-amber-700 pl-5">{e}</p>
          ))}
        </div>
      )}
    </div>
  )
}
