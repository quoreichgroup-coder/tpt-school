import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import LoginForm from './login-form'

export const metadata = { title: 'Connexion — QSCHOOL' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/dashboard')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            Q
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">QSCHOOL</h1>
          <p className="mt-1 text-slate-500 text-sm">Connectez-vous à votre compte</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <LoginForm />
        </div>

        <p className="text-center mt-6 text-xs text-slate-400">
          &copy; {new Date().getFullYear()} QSCHOOL. Tous droits réservés.
        </p>
      </div>
    </div>
  )
}
