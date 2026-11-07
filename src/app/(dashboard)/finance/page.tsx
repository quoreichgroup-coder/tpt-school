import { requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import FeeReminderButton from './fee-reminder-button'
import { minorUnitsToAmount, parseMoneyToMinorUnits } from '@/lib/money'

const STATUS_STYLES: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  waived: 'bg-slate-100 text-slate-500',
}

const STATUS_LABELS: Record<string, string> = {
  unpaid: 'Impayée', partial: 'Partiellement payée', paid: 'Payée', overdue: 'En retard', waived: 'Annulée',
}

const FREQUENCY_LABELS: Record<string, string> = {
  annual: 'Annuelle', term: 'Par trimestre', 'once-off': 'Ponctuelle',
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-500'}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

function formatCurrency(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`
}

export default async function FinancePage() {
  await requireRole(['admin', 'accountant'])

  const settings = await db.schoolSettings.findFirst()
  const currencySymbol = settings?.currencySymbol ?? '$'

  // Overview stats
  const [unpaidInvoices, overdueInvoices, allInvoices] = await Promise.all([
    db.feeInvoice.findMany({ where: { status: { in: ['unpaid', 'partial'] } }, select: { totalAmount: true, paidAmount: true } }),
    db.feeInvoice.count({ where: { status: 'overdue' } }),
    db.feeInvoice.findMany({
      include: {
        student: { include: { user: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const totalOutstandingMinorUnits = unpaidInvoices.reduce((sum, inv) => {
    const total = parseMoneyToMinorUnits(inv.totalAmount.toString()) ?? 0
    const paid = parseMoneyToMinorUnits(inv.paidAmount.toString()) ?? 0
    return sum + total - paid
  }, 0)
  const totalOutstanding = minorUnitsToAmount(totalOutstandingMinorUnits)

  // Paid this term (approximate: current month for simplicity)
  const termStart = new Date()
  termStart.setDate(1)
  const paidThisTerm = await db.feePayment.aggregate({
    where: { paidAt: { gte: termStart } },
    _sum: { amount: true },
  })

  const feeTypes = await db.feeType.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Finances</h1>
          <p className="text-sm text-slate-500 mt-0.5">Factures, paiements et gestion des frais</p>
        </div>
        <div className="flex items-start gap-3 flex-wrap justify-end">
          <FeeReminderButton />
          <Link href="/finance/invoices/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle facture
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total restant dû</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(totalOutstanding, currencySymbol)}</div>
            <p className="text-xs text-slate-500 mt-1">Factures impayées ou partiellement payées</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Encaissé ce mois-ci</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(Number(paidThisTerm._sum.amount ?? 0), currencySymbol)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total des paiements reçus</p>
          </CardContent>
        </Card>

        <Card className="border-slate-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Factures en retard</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{overdueInvoices}</div>
            <p className="text-xs text-slate-500 mt-1">À traiter</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Factures</TabsTrigger>
          <TabsTrigger value="fee-types">Types de frais</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {allInvoices.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Aucune facture pour le moment.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Élève</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Date d’émission</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Échéance</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Payé</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {inv.student.user.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {format(new Date(inv.issueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {format(new Date(inv.dueDate), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(Number(inv.totalAmount), currencySymbol)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {formatCurrency(Number(inv.paidAmount ?? 0), currencySymbol)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/finance/invoices/${inv.id}`}
                          className="text-primary text-xs font-medium hover:underline"
                        >
                          Voir
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* Fee Types Tab */}
        <TabsContent value="fee-types" className="mt-4">
          <div className="flex justify-end mb-3">
            <Link href="/finance/fee-types">
              <Button variant="outline" size="sm">
                Gérer les types de frais
              </Button>
            </Link>
          </div>
          {feeTypes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Aucun type de frais défini.</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Nom</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Montant</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Fréquence</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Niveau</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {feeTypes.map(ft => (
                    <tr key={ft.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{ft.name}</td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {formatCurrency(Number(ft.amount), currencySymbol)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{FREQUENCY_LABELS[ft.frequency] ?? ft.frequency}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {ft.yearLevel != null ? `Niveau ${ft.yearLevel}` : 'Tous les niveaux'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            ft.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {ft.active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
