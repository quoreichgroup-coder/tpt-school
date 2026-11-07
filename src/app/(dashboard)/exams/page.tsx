import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { CalendarDays, Clock3, MapPin, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createExamAction, updateExamStatusAction } from './actions'

type Props = { searchParams: Promise<{ error?: string; created?: string; updated?: string }> }

const errors: Record<string, string> = {
  invalid: 'Vérifiez les informations de l’examen, la classe, le trimestre, la salle et la note maximale.',
  'outside-term': 'Les dates de l’examen doivent se situer dans le trimestre choisi.',
  'room-capacity': 'La salle choisie ne peut pas accueillir tous les élèves inscrits dans cette classe.',
  conflict: 'La classe, la salle ou le surveillant a déjà un examen à cet horaire.',
  save: 'Impossible d’enregistrer l’examen. Réessayez.',
  missing: 'Examen introuvable.',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon', published: 'Publié', cancelled: 'Annulé',
}

function formatDate(date: Date) {
  return `${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(date)} UTC`
}

export default async function ExamsPage({ searchParams }: Props) {
  const user = await requireRole(['admin', 'teacher'])
  const params = await searchParams
  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true } })
  const classWhere = {
    academicYearId: activeYear?.id ?? '__no_active_year__',
    ...(user.role === 'teacher' ? { teachers: { some: { staff: { userId: user.id } } } } : {}),
  }

  const [classes, terms, rooms, staff, exams] = await Promise.all([
    db.class.findMany({ where: classWhere, orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }], select: { id: true, name: true, code: true, subject: true, academicYearId: true } }),
    db.term.findMany({ where: activeYear ? { academicYearId: activeYear.id } : { academicYearId: '__no_active_year__' }, include: { academicYear: true }, orderBy: { termNumber: 'asc' } }),
    db.room.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    db.staff.findMany({ include: { user: { select: { name: true } } }, orderBy: { user: { name: 'asc' } } }),
    db.exam.findMany({
      where: user.role === 'teacher' ? { schoolClass: classWhere } : {},
      include: {
        schoolClass: { select: { name: true, code: true, subject: true } },
        term: { include: { academicYear: true } },
        room: { select: { name: true, code: true } },
        invigilator: { include: { user: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ startsAt: 'desc' }],
      take: 100,
    }),
  ])
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Planification des examens</h1>
        <p className="mt-1 text-sm text-slate-500">Planifiez les examens, évitez les conflits de salle et de surveillance, puis publiez le calendrier. Les horaires sont en UTC.</p>
      </div>

      {params.error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errors[params.error] ?? 'Impossible de terminer cette opération.'}</div>}
      {params.created && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Examen enregistré en brouillon. Un carnet de notes a été créé pour la saisie des résultats.</div>}
      {params.updated && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Le calendrier des examens a été mis à jour.</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Planifier un examen</CardTitle></CardHeader>
        <CardContent>
          {classes.length === 0 || terms.length === 0 ? <p className="text-sm text-slate-500">Une année scolaire active, un trimestre et une classe attribuée sont nécessaires pour planifier un examen.</p> : (
            <form action={createExamAction} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Intitulé de l’examen
                <input name="title" required maxLength={120} placeholder="Examen de mathématiques du deuxième trimestre" className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Classe
                <select name="classId" required className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal">
                  {classes.map(schoolClass => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name} · {schoolClass.code}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Trimestre
                <select name="termId" required className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal">
                  {terms.map(term => <option key={term.id} value={term.id}>{term.academicYear.year} — {term.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Début (UTC)
                <input type="datetime-local" name="startsAt" required className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Fin (UTC)
                <input type="datetime-local" name="endsAt" required className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Note maximale
                <input type="number" name="maxScore" required min="1" max="1000" step="0.5" defaultValue="100" className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Salle (facultatif)
                <select name="roomId" defaultValue="" className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal">
                  <option value="">Aucune salle</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name} · {room.code}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700">
                Surveillant (facultatif)
                <select name="invigilatorId" defaultValue="" className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal">
                  <option value="">Aucun surveillant</option>{staff.map(member => <option key={member.id} value={member.id}>{member.user.name}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
                Notes (facultatif)
                <textarea name="notes" maxLength={1000} rows={2} placeholder="Consignes ou matériel à apporter" className="w-full rounded-md border border-slate-200 px-3 py-2 font-normal" />
              </label>
              <div className="md:col-span-2 xl:col-span-3"><Button type="submit">Enregistrer le brouillon</Button></div>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Examens planifiés</h2>
        {exams.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-slate-500">Aucun examen n’a encore été planifié.</CardContent></Card> : exams.map(exam => (
          <Card key={exam.id}>
            <CardContent className="flex flex-col justify-between gap-4 py-4 md:flex-row md:items-center">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{exam.title}</h3><Badge variant={exam.status === 'published' ? 'default' : exam.status === 'cancelled' ? 'destructive' : 'outline'}>{STATUS_LABELS[exam.status] ?? exam.status}</Badge></div>
                <p className="text-sm text-slate-600">{exam.schoolClass.name} · {exam.term.academicYear.year} — {exam.term.name}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatDate(exam.startsAt)}–{new Intl.DateTimeFormat('fr-FR', { timeStyle: 'short', timeZone: 'UTC' }).format(exam.endsAt)} UTC</span>
                  {exam.room && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{exam.room.name}</span>}
                  {exam.invigilator && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{exam.invigilator.user.name}</span>}
                </div>
                {exam.notes && <p className="max-w-2xl text-xs text-slate-500">{exam.notes}</p>}
                <p className="text-[11px] text-slate-400">Créé par {exam.createdBy.name}</p>
              </div>
              {user.role === 'admin' && exam.status !== 'cancelled' && (
                <div className="flex gap-2">
                  {exam.status === 'draft' && <form action={updateExamStatusAction}><input type="hidden" name="examId" value={exam.id} /><input type="hidden" name="status" value="published" /><Button size="sm" type="submit" className="gap-1"><CalendarDays className="h-3.5 w-3.5" />Publier</Button></form>}
                  <form action={updateExamStatusAction}><input type="hidden" name="examId" value={exam.id} /><input type="hidden" name="status" value="cancelled" /><Button size="sm" type="submit" variant="outline">Annuler</Button></form>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
