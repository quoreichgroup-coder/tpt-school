'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { approveReportCardsAction, prepareReportCardsAction, rejectReportCardsAction } from './actions'
import { Check, RotateCcw, Sparkles, Send } from 'lucide-react'

type Props = {
  termId: string
  aiEnabled: boolean
  aiMode: string
  pendingCount: number
}

export default function PublishReportCards({ termId, aiEnabled, aiMode, pendingCount }: Props) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [reason, setReason] = useState('')

  function handlePrepare() {
    setResult(null)
    setError(null)
    startTransition(async () => {
      const res = await prepareReportCardsAction(termId)
      if (res.success) {
        const aiNote = res.generated > 0 ? ` AI generated ${res.generated} comment(s).` : ''
        setResult(`Report cards prepared for approval.${aiNote}`)
      } else {
        setError(res.error ?? 'Publish failed.')
      }
    })
  }

  function handleReview(action: 'approve' | 'reject') {
    setResult(null)
    setError(null)
    startTransition(async () => {
      if (action === 'approve') {
        const res = await approveReportCardsAction(termId)
        if (res.success) setResult(`${res.approved} report card(s) published and parents notified.`)
        else setError(res.error ?? 'Review failed.')
      } else {
        const res = await rejectReportCardsAction(termId, reason)
        if (res.success) setResult(`${res.rejected} report card(s) returned for revision.`)
        else setError(res.error ?? 'Review failed.')
      }
      setReason('')
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-slate-800">Report card approval</p>
        <p className="text-xs text-slate-500 mt-0.5">
          Prepare the term’s report cards, then approve them before families can see them.
          {aiEnabled && aiMode === 'auto' && ' AI will generate comments for students with none.'}
        </p>
        <p className="text-xs text-slate-600 mt-1">{pendingCount} awaiting approval</p>
        {result && <p className="text-xs text-emerald-600 mt-1 font-medium">{result}</p>}
        {error && <p className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 shrink-0">
        <Button onClick={handlePrepare} disabled={isPending} variant="outline" className="gap-1.5">
          {aiEnabled && aiMode === 'auto' ? <Sparkles className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {isPending ? 'Working...' : 'Prepare for review'}
        </Button>
        {pendingCount > 0 && <>
          <Button onClick={() => handleReview('approve')} disabled={isPending} className="gap-1.5">
            <Check className="w-4 h-4" /> Approve & publish
          </Button>
          <div className="flex basis-full justify-end gap-2">
            <input value={reason} onChange={event => setReason(event.target.value)} maxLength={500}
              placeholder="Reason for revision" aria-label="Reason for rejecting report cards"
              className="w-48 rounded-md border border-slate-200 px-2 py-1 text-xs" />
            <Button onClick={() => handleReview('reject')} disabled={isPending || !reason.trim()} variant="outline" className="gap-1.5">
              <RotateCcw className="w-4 h-4" /> Return for revision
            </Button>
          </div>
        </>}
      </div>
    </div>
  )
}
