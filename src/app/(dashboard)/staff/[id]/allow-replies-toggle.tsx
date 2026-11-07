'use client'

import { useState } from 'react'
import { updateStaffAllowRepliesAction } from './actions'

export default function AllowRepliesToggle({ staffId, value }: { staffId: string; value: boolean }) {
  const [enabled, setEnabled] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setSaving(true)
    const next = !enabled
    setError(null)
    setEnabled(next)
    try {
      await updateStaffAllowRepliesAction(staffId, next)
    } catch {
      setEnabled(!next)
      setError('Impossible d’enregistrer ce paramètre. Réessayez.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-700">Autoriser les réponses des parents et des élèves</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Une fois activés, les parents et les élèves peuvent répondre aux messages de ce membre du personnel.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          enabled ? 'bg-primary' : 'bg-slate-200'
        } ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {error && <p role="alert" className="ml-3 text-xs text-destructive">{error}</p>}
    </div>
  )
}
