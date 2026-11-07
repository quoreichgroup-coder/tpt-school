'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { triggerFeeRemindersAction } from './actions'
import { Bell } from 'lucide-react'

export default function FeeReminderButton() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setResult(null)
    const res = await triggerFeeRemindersAction()
    if (res.success) {
      setResult(
        res.sent === 0
          ? 'Aucun rappel à envoyer : les factures récentes ont déjà fait l’objet d’un rappel au cours des 7 derniers jours.'
          : `${res.sent} rappel${res.sent !== 1 ? 's' : ''} envoyé${res.sent !== 1 ? 's' : ''}${res.skipped ? `, ${res.skipped} ignoré${res.skipped !== 1 ? 's' : ''}` : ''}.`,
      )
    } else {
      setResult(res.error ?? 'Échec de l’envoi des rappels.')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" onClick={handleClick} disabled={loading}>
        <Bell className="w-4 h-4 mr-2" />
        {loading ? 'Envoi…' : 'Envoyer les rappels de paiement'}
      </Button>
      {result && (
        <p className="text-xs text-slate-500 max-w-xs text-right">{result}</p>
      )}
    </div>
  )
}
