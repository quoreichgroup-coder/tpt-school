import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ClassForm from '../../class-form'

type Params = Promise<{ id: string }>

export default async function EditClassPage({ params }: { params: Params }) {
  await requireRole(['admin'])
  const { id } = await params

  const [classData, rooms, academicYears, staff] = await Promise.all([
    db.class.findUnique({
      where: { id },
      include: { teachers: { select: { staffId: true, isPrimary: true } } },
    }),
    db.room.findMany({ orderBy: { name: 'asc' } }),
    db.academicYear.findMany({ orderBy: { year: 'desc' } }),
    db.staff.findMany({ include: { user: true }, orderBy: { user: { name: 'asc' } } }),
  ])

  if (!classData) notFound()

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/classes/${id}`}
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Retour au dossier de la classe
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Modifier la classe</h1>
        <p className="text-sm text-slate-500 mt-1">Mettez à jour les informations de {classData.name}.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <ClassForm
          rooms={rooms}
          academicYears={academicYears}
          staff={staff}
          classData={classData}
        />
      </div>
    </div>
  )
}
