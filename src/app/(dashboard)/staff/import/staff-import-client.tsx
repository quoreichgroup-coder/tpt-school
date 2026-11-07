'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CsvImportTable, { CsvRow } from '@/components/csv-import-table'
import { importStaffAction, ImportResult, ImportStaffRow } from './actions'
import { Upload } from 'lucide-react'

const COLUMNS = ['firstName', 'lastName', 'email', 'jobTitle', 'department', 'employmentType', 'dateHired']

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = values[i] ?? '' })
    return row
  })
}

function validateRows(raw: Record<string, string>[]): CsvRow[] {
  return raw.map((data, i) => {
    const errors: string[] = []
    const warnings: string[] = []

    if (!data.firstName) errors.push('Le champ firstName est obligatoire.')
    if (!data.lastName) errors.push('Le champ lastName est obligatoire.')
    if (!data.email) errors.push('Le champ email est obligatoire.')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.push('Format d’adresse e-mail invalide.')

    if (data.dateHired && isNaN(Date.parse(data.dateHired))) {
      errors.push('Date dateHired invalide (format attendu : AAAA-MM-JJ).')
    }

    const validEmploymentTypes = ['full-time', 'part-time', 'casual', 'contract']
    if (data.employmentType && !validEmploymentTypes.includes(data.employmentType.toLowerCase())) {
      warnings.push(`Type de contrat "${data.employmentType}" inconnu; le temps plein sera utilisé.`)
    }

    return { rowNum: i + 2, data, errors, warnings }
  })
}

export default function StaffImportClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<CsvRow[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setResult(null)
    setFileError(null)
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string
        const raw = parseCSV(text)
        if (raw.length === 0) {
          setFileError('Aucune ligne de données trouvée dans le fichier.')
          setRows([])
          return
        }
        setRows(validateRows(raw))
      } catch {
        setFileError('Impossible de lire le fichier CSV.')
      }
    }
    reader.readAsText(file)
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  function handleImport() {
    if (validRows.length === 0) return
    startTransition(async () => {
      const payload: ImportStaffRow[] = validRows.map(r => ({
        firstName: r.data.firstName,
        lastName: r.data.lastName,
        email: r.data.email,
        jobTitle: r.data.jobTitle || undefined,
        department: r.data.department || undefined,
        employmentType: r.data.employmentType || undefined,
        dateHired: r.data.dateHired || undefined,
      }))
      const res = await importStaffAction(payload)
      setResult(res)
      if (res.imported > 0) {
        setTimeout(() => router.push('/staff'), 2000)
      }
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="text-base">Format du fichier CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Le fichier CSV doit contenir une ligne d’en-tête avec ces colonnes (les champs obligatoires sont marqués d’un *) :
          </p>
          <div className="font-mono text-xs bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-slate-700 overflow-x-auto whitespace-nowrap">
            firstName*, lastName*, email*, jobTitle, department, employmentType, dateHired
          </div>
          <p className="text-xs text-slate-500">
            employmentType : full-time | part-time | casual | contract. Dates au format AAAA-MM-JJ. Les adresses e-mail déjà utilisées sont ignorées.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="text-base">Charger un fichier CSV</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg px-6 py-10 cursor-pointer hover:border-primary/40 hover:bg-slate-50 transition-colors">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-sm font-medium text-slate-700">Cliquez pour choisir un fichier CSV</span>
            <span className="text-xs text-slate-500 mt-1">ou déposez-le ici</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
          </label>
          {fileError && <p className="text-sm text-red-600 mt-3">{fileError}</p>}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aperçu ({rows.length} ligne{rows.length !== 1 ? 's' : ''})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CsvImportTable rows={rows} columns={COLUMNS} />

            {result ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 space-y-1">
                <p className="font-medium">Import terminé</p>
                <p>{result.imported} importé{result.imported !== 1 ? 's' : ''}, {result.skipped} ignoré{result.skipped !== 1 ? 's' : ''}</p>
                {result.errors.map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
                {result.credentials.length > 0 && (
                  <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <p className="font-semibold">Mots de passe temporaires — affichés une seule fois</p>
                    <p className="mb-2 text-xs">Transmettez ces accès individuellement et de façon sécurisée.</p>
                    <div className="space-y-2">
                      {result.credentials.map((credential) => (
                        <div key={credential.email} className="rounded bg-white p-2 text-xs">
                          <p>{credential.name} — {credential.email}</p>
                          <p className="select-all font-mono">{credential.tempPassword}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <Button className="mt-3" variant="outline" onClick={() => router.push('/staff')}>
                  Retour au personnel
                </Button>
              </div>
            ) : (
              <Button onClick={handleImport} disabled={isPending || validRows.length === 0}>
                {isPending ? 'Import en cours…' : `Importer ${validRows.length} ligne${validRows.length !== 1 ? 's' : ''} valide${validRows.length !== 1 ? 's' : ''}`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
