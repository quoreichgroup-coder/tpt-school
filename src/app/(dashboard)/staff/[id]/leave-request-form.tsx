'use client'

import { useState, useTransition } from 'react'
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
import { createLeaveRequestAction } from '../actions'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

type Props = {
  staffId: string
}

export default function LeaveRequestForm({ staffId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [type, setType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    const fd = new FormData()
    fd.set('type', type)
    fd.set('startDate', startDate)
    fd.set('endDate', endDate)
    fd.set('reason', reason)

    startTransition(async () => {
      const result = await createLeaveRequestAction(staffId, fd)
      if (result.success) {
        setSuccess(true)
        setType('')
        setStartDate('')
        setEndDate('')
        setReason('')
      } else {
        setError(result.error ?? 'Une erreur est survenue.')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Demande de congé envoyée avec succès.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="leaveType">Type de congé <span className="text-destructive">*</span></Label>
          <Select value={type} onValueChange={(v) => { if (v !== null) setType(v) }} required>
            <SelectTrigger id="leaveType" className="w-full">
              <SelectValue placeholder="Sélectionner un type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="annual">Congé annuel</SelectItem>
              <SelectItem value="sick">Congé maladie</SelectItem>
              <SelectItem value="personal">Congé pour motif personnel</SelectItem>
              <SelectItem value="bereavement">Congé pour décès d’un proche</SelectItem>
              <SelectItem value="unpaid">Congé sans solde</SelectItem>
              <SelectItem value="other">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="startDate">Date de début <span className="text-destructive">*</span></Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endDate">Date de fin <span className="text-destructive">*</span></Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Motif</Label>
        <Textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Facultatif : précisez le motif de la demande…"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Envoyer la demande
      </Button>
    </form>
  )
}
