import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import SetupWizard from './setup-wizard'

export const metadata = { title: 'Configuration initiale — QSCHOOL' }

export default async function SetupPage() {
  await connection()
  const settings = await db.schoolSettings.findFirst()
  if (settings?.setupComplete) redirect('/dashboard')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-4 shadow-lg">
            Q
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Bienvenue sur QSCHOOL</h1>
          <p className="mt-2 text-slate-500">
            Configurons votre établissement. Cela ne prendra que quelques minutes.
          </p>
        </div>
        <SetupWizard />
      </div>
    </div>
  )
}
