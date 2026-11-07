import Link from 'next/link'
import { ShieldX } from 'lucide-react'

export const metadata = { title: 'Accès refusé — QSCHOOL' }

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-red-100 text-red-500 mb-6">
          <ShieldX className="w-10 h-10" />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">Accès refusé</h1>
        <p className="text-slate-500 mb-8">
          Vous n’avez pas l’autorisation d’accéder à cette page. Contactez l’administration
          de votre établissement si vous pensez qu’il s’agit d’une erreur.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg border border-border bg-background text-sm font-medium hover:bg-muted transition-colors"
          >
            Retour au tableau de bord
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-8 px-4 rounded-lg text-sm font-medium text-slate-500 hover:bg-muted hover:text-slate-900 transition-colors"
          >
            Se connecter avec un autre compte
          </Link>
        </div>
      </div>
    </div>
  )
}
