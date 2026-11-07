'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { requestPasswordResetAction } from './actions'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isPending, startTransition] = useTransition()
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await requestPasswordResetAction(email)
      if (!result.success) {
        setError(result.error ?? 'Une erreur est survenue.')
      } else {
        setSubmitted(true)
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Mot de passe oublié ?</h1>
          <p className="text-sm text-slate-500">Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.</p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-slate-800">Vérifiez votre boîte de réception</p>
            <p className="text-sm text-slate-500">
              Si un compte associé à <strong>{email}</strong> existe, vous recevrez bientôt un lien de réinitialisation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Adresse e-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer le lien
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-700 font-medium hover:underline">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
