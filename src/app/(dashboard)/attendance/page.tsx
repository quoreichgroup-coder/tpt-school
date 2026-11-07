import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, Users, CheckCircle2, XCircle, Clock, BookOpen } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700',
  excused: 'bg-blue-100 text-blue-700',
}
const STATUS_LABELS: Record<string, string> = {
  present: 'Présent', absent: 'Absent', late: 'En retard', excused: 'Excusé',
}

export default async function AttendancePage() {
  const user = await requireRole(['admin', 'teacher'])
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)
  const todayDisplay = format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })
  const activeYear = await db.academicYear.findFirst({ where: { active: true }, select: { id: true } })

  if (user.role === 'admin') {
    // Admin: show today's attendance summary
    const [present, absent, late, excused, totalActive, allClasses] = await Promise.all([
      db.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: 'present' } }),
      db.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: 'absent' } }),
      db.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: 'late' } }),
      db.attendance.count({ where: { date: { gte: today, lte: todayEnd }, status: 'excused' } }),
      db.student.count({ where: { enrollmentStatus: 'active' } }),
      db.class.findMany({
        where: { academicYearId: activeYear?.id ?? '__no_active_year__' },
        include: {
          room: true,
          _count: { select: { enrolments: { where: { status: 'active' } } } },
        },
        orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
      }),
    ])

    const totalMarked = present + absent + late + excused

    // Recent attendance records
    const recentRecords = await db.attendance.findMany({
      where: { date: { gte: today, lte: todayEnd } },
      include: { student: { include: { user: true } }, term: true },
      orderBy: { markedAt: 'desc' },
      take: 20,
    })

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Présences</h1>
            <p className="text-sm text-slate-500 mt-1">{todayDisplay}</p>
          </div>
          <Link href="/attendance/report" className={buttonVariants({ variant: 'outline' })}>
            Voir le rapport
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-100">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Présents</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{present}</div>
              <p className="text-xs text-slate-500 mt-1">Aujourd’hui</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Absents</CardTitle>
              <XCircle className="w-4 h-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600">{absent}</div>
              <p className="text-xs text-slate-500 mt-1">Aujourd’hui</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">En retard</CardTitle>
              <Clock className="w-4 h-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-600">{late}</div>
              <p className="text-xs text-slate-500 mt-1">Aujourd’hui</p>
            </CardContent>
          </Card>
          <Card className="border-slate-100">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-slate-600">Suivi</CardTitle>
              <Users className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{totalMarked}</div>
              <p className="text-xs text-slate-500 mt-1">sur {totalActive} élèves actifs</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent records */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Saisies du jour</h2>
          </div>
          {recentRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Aucune présence saisie aujourd’hui</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentRecords.map((rec) => (
                <div key={rec.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="font-medium text-slate-800">{rec.student.user.name}</p>
                    <p className="text-xs text-slate-400">{rec.term.name}</p>
                  </div>
                  <Badge className={STATUS_COLORS[rec.status] + ' border-0 capitalize'}>
                    {STATUS_LABELS[rec.status] ?? rec.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Take Roll — all classes */}
        <div>
          <h2 className="font-semibold text-slate-800 mb-3">Faire l’appel</h2>
          {allClasses.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200 shadow-sm">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Aucune classe pour l’année scolaire active</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allClasses.map((cls) => (
                <div key={cls.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                      <p className="text-xs text-slate-500 font-mono">{cls.code}</p>
                    </div>
                    {cls.yearLevel && (
                      <Badge variant="secondary">Niveau {cls.yearLevel}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mb-4">
                    <span>{cls._count.enrolments} élèves</span>
                    {cls.room && <span> · {cls.room.code}</span>}
                  </div>
                  <Link href={`/attendance/roll/${cls.id}`} className={cn(buttonVariants(), 'w-full')}>
                    <ClipboardCheck className="w-4 h-4 mr-2" />
                    Faire l’appel
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Teacher view: show their classes with Take Roll button
  const staffRecord = await db.staff.findUnique({ where: { userId: user.id } })

  if (!staffRecord) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>Aucune fiche personnel n’est associée à votre compte.</p>
      </div>
    )
  }

  const myClasses = await db.class.findMany({
    where: {
      academicYearId: activeYear?.id ?? '__no_active_year__',
      teachers: { some: { staffId: staffRecord.id } },
    },
    include: {
      academicYear: true,
      room: true,
      _count: { select: { enrolments: { where: { status: 'active' } } } },
    },
    orderBy: [{ yearLevel: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Présences</h1>
        <p className="text-sm text-slate-500 mt-1">{todayDisplay}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {myClasses.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-400">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Aucune classe ne vous est attribuée pour l’année active</p>
          </div>
        ) : (
          myClasses.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-slate-800">{cls.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">{cls.code}</p>
                </div>
                {cls.yearLevel && (
                  <Badge variant="secondary">Niveau {cls.yearLevel}</Badge>
                )}
              </div>
              <div className="text-sm text-slate-500 mb-4">
                <span>{cls._count.enrolments} élèves</span>
                {cls.room && <span> · {cls.room.code}</span>}
              </div>
              <Link href={`/attendance/roll/${cls.id}`} className={cn(buttonVariants(), 'w-full')}>
                <ClipboardCheck className="w-4 h-4 mr-2" />
                Faire l’appel
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
