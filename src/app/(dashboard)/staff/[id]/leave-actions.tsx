'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { updateLeaveStatusAction } from '../actions'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

type Props = {
  leaveId: string
}

export function LeaveApproveButton({ leaveId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Approuvée
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        setError(null)
        startTransition(async () => {
          const result = await updateLeaveStatusAction(leaveId, 'approved')
          if (result.success) setDone(true)
          else setError(result.error ?? 'Impossible d’approuver la demande.')
        })
      }}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
      Approuver
    </Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function LeaveDeclineButton({ leaveId }: Props) {
  const [isPending, startTransition] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
        <XCircle className="w-3.5 h-3.5" />
        Refusée
      </span>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
    <Button
      size="sm"
      variant="destructive"
      disabled={isPending}
      onClick={() => {
        setError(null)
        startTransition(async () => {
          const result = await updateLeaveStatusAction(leaveId, 'declined')
          if (result.success) setDone(true)
          else setError(result.error ?? 'Impossible de refuser la demande.')
        })
      }}
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
      Refuser
    </Button>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
