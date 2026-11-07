'use client'

import { useState, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { resetPasswordAction } from '../forgot-password/actions'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isPending, startTransition] = useTransition()
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!token) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-8 text-center space-y-2">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm font-medium text-slate-800">Lien de réinitialisation invalide</p>
        <p className="text-sm text-slate-500">Veuillez en demander un nouveau.</p>
        <Link href="/forgot-password" className="text-sm text-slate-700 font-medium hover:underline block pt-1">
          Demander un nouveau lien
        </Link>
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    startTransition(async () => {
      const result = await resetPasswordAction(token, password)
      if (!result.success) {
        setError(result.error ?? 'Une erreur est survenue.')
      } else {
        setSuccess(true)
      }
    })
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center space-y-3">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
        <p className="text-sm font-medium text-slate-800">Mot de passe mis à jour</p>
        <p className="text-sm text-slate-500">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
        <Link href="/login" className="text-sm text-slate-700 font-medium hover:underline block pt-1">
          Se connecter
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 caractères minimum"
          minLength={8}
          required
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirmer le mot de passe</Label>
        <Input
          id="confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Saisissez-le à nouveau"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Définir le mot de passe
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Définir un nouveau mot de passe</h1>
          <p className="text-sm text-slate-500">Choisissez un mot de passe robuste pour votre compte.</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-slate-400">Chargement…</div>}>
          <ResetPasswordForm />
        </Suspense>
        <p className="text-center text-sm text-slate-500">
          <Link href="/login" className="text-slate-700 font-medium hover:underline">Retour à la connexion</Link>
        </p>
      </div>
    </div>
  )
}
