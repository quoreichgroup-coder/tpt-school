import { requireRole } from '@/lib/auth'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import StudentForm from '../student-form'

export default async function NewStudentPage() {
  await requireRole(['admin'])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/students"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          Retour aux élèves
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Inscrire un nouvel élève</h1>
        <p className="text-sm text-slate-500 mt-1">
          Renseignez les informations de l’élève. Un mot de passe temporaire sera créé; l’élève devra le modifier lors de sa première connexion.
        </p>
      </div>

      <StudentForm />
    </div>
  )
}
