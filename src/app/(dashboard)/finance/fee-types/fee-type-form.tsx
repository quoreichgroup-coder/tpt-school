'use client'

import { useState, useTransition } from 'react'
import { createFeeTypeAction, updateFeeTypeAction } from '../actions'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type FeeType = {
  id: string
  name: string
  description: string | null
  amount: number
  frequency: string
  yearLevel: number | null
  active: boolean
}

type Props = {
  feeType?: FeeType
  onSuccess?: () => void
  currencySymbol: string
}

const YEAR_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

export default function FeeTypeForm({ feeType, onSuccess, currencySymbol }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [frequency, setFrequency] = useState(feeType?.frequency ?? 'annual')
  const [yearLevel, setYearLevel] = useState(feeType?.yearLevel?.toString() ?? '')
  const [active, setActive] = useState(feeType?.active ?? true)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    const formData = new FormData(e.currentTarget)
    formData.set('active', active ? 'true' : 'false')
    if (yearLevel) formData.set('yearLevel', yearLevel)
    else formData.delete('yearLevel')

    startTransition(async () => {
      const result = feeType
        ? await updateFeeTypeAction(feeType.id, formData)
        : await createFeeTypeAction(formData)

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        onSuccess?.()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{feeType ? 'Modifier le type de frais' : 'Ajouter un type de frais'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Type de frais {feeType ? 'mis à jour' : 'créé'} avec succès.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                name="name"
                defaultValue={feeType?.name}
                placeholder="Ex. : Frais de scolarité"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="amount">Montant ({currencySymbol}) *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={feeType?.amount}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={feeType?.description ?? ''}
              rows={2}
              placeholder="Description facultative…"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Fréquence *</Label>
              <Select value={frequency} onValueChange={(v) => { if (v !== null) setFrequency(v) }} name="frequency">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annuelle</SelectItem>
                  <SelectItem value="term">Par trimestre</SelectItem>
                  <SelectItem value="once-off">Ponctuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Niveau (facultatif)</Label>
              <Select value={yearLevel} onValueChange={(v) => setYearLevel(v ?? '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les niveaux</SelectItem>
                  {YEAR_LEVELS.map(y => (
                    <SelectItem key={y} value={String(y)}>
                      Niveau {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={active}
              onChange={e => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label htmlFor="active" className="cursor-pointer">Actif</Label>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Enregistrement…' : feeType ? 'Mettre à jour' : 'Ajouter le type de frais'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
