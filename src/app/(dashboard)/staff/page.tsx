import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { UserPlus, Upload, Search } from 'lucide-react'

type SearchParams = Promise<{ q?: string }>

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  'full-time': 'Temps plein',
  'part-time': 'Temps partiel',
  casual: 'Occasionnel',
}

export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole(['admin'])

  const { q = '' } = await searchParams

  const staffList = await db.staff.findMany({
    where: q
      ? {
          OR: [
            { user: { name: { contains: q } } },
            { employeeId: { contains: q } },
          ],
        }
      : {},
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Personnel</h1>
          <p className="text-sm text-slate-500 mt-1">
            {staffList.length} membre{staffList.length !== 1 ? 's' : ''} du personnel trouvé{staffList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/staff/import" className={buttonVariants({ variant: 'outline' })}>
            <Upload className="w-4 h-4" />
            Importer un fichier CSV
          </Link>
          <Link href="/staff/new" className={buttonVariants()}>
            <UserPlus className="w-4 h-4" />
            Ajouter un membre
          </Link>
        </div>
      </div>

      {/* Search */}
      <form method="GET" className="flex gap-3 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Rechercher par nom…"
            className="pl-8 w-full"
          />
        </div>
        <Button type="submit" variant="outline">
          Rechercher
        </Button>
      </form>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="font-semibold text-slate-700">Matricule</TableHead>
              <TableHead className="font-semibold text-slate-700">Nom</TableHead>
              <TableHead className="font-semibold text-slate-700">Fonction</TableHead>
              <TableHead className="font-semibold text-slate-700">Service</TableHead>
              <TableHead className="font-semibold text-slate-700">Type de contrat</TableHead>
              <TableHead className="font-semibold text-slate-700">Statut</TableHead>
              <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                  Aucun membre du personnel trouvé. Modifiez votre recherche ou ajoutez un membre.
                </TableCell>
              </TableRow>
            ) : (
              staffList.map((staff) => {
                const isActive = !staff.dateLeft
                return (
                  <TableRow key={staff.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono text-sm text-slate-600">
                      {staff.employeeId}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-900">{staff.user.name}</div>
                      <div className="text-xs text-slate-400">{staff.user.email}</div>
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {staff.jobTitle ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="text-slate-700">
                      {staff.department ?? <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      {EMPLOYMENT_TYPE_LABELS[staff.employmentType] ?? staff.employmentType}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'En poste' : 'Parti'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/staff/${staff.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Consulter</Link>
                        <Link href={`/staff/${staff.id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>Modifier</Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
