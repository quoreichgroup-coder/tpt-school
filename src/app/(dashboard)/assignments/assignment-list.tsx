'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Upload,
  X,
  Loader2,
  Award,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getChildAssignmentsAction, submitAssignmentAction, unsubmitAssignmentAction } from './actions'

type Assignment = {
  id: string
  name: string
  description: string | null
  type: string
  maxScore: number
  dueDate: Date | null
  documentUrl: string | null
  className: string
  termName: string
  score: number | null
  gradeLabel: string | null
  comment: string | null
  submittedAt: Date | null
  submissionUrl: string | null
  gradedAt: Date | null
}

type Props = {
  assignments: Assignment[]
  studentId: string | null
  childOptions: { id: string; name: string }[]
  isParent: boolean
}

function statusOf(a: Assignment) {
  if (a.gradedAt) return 'graded'
  if (a.submittedAt) return 'submitted'
  if (a.dueDate && new Date(a.dueDate) < new Date()) return 'overdue'
  return 'pending'
}

const STATUS_CONFIG = {
  graded: { label: 'Corrigé', className: 'bg-green-50 text-green-700 border-green-200', icon: Award },
  submitted: { label: 'Remis', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  overdue: { label: 'En retard', className: 'bg-red-50 text-red-600 border-red-200', icon: Clock },
  pending: { label: 'À faire', className: 'bg-slate-100 text-slate-600 border-slate-200', icon: FileText },
}

const TYPE_LABELS: Record<string, string> = {
  assessment: 'Évaluation', exam: 'Examen', homework: 'Devoir', quiz: 'Interrogation',
}

function fmt(d: Date | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function AssignmentCard({ a, isParent }: { a: Assignment; isParent: boolean }) {
  const status = statusOf(a)
  const cfg = STATUS_CONFIG[status]

  const [showSubmit, setShowSubmit] = useState(false)
  const [url, setUrl] = useState(a.submissionUrl ?? '')
  const [isPending, startTransition] = useTransition()
  const [localStatus, setLocalStatus] = useState(status)
  const [localSubmittedAt, setLocalSubmittedAt] = useState(a.submittedAt)
  const [localUrl, setLocalUrl] = useState(a.submissionUrl)
  const [error, setError] = useState<string | null>(null)

  const currentCfg = STATUS_CONFIG[localStatus as keyof typeof STATUS_CONFIG] ?? cfg
  const CurrentIcon = currentCfg.icon

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitAssignmentAction(a.id, url || undefined)
      if (result.error) {
        setError(result.error)
      } else {
        setLocalStatus('submitted')
        setLocalSubmittedAt(new Date())
        setLocalUrl(url || null)
        setShowSubmit(false)
      }
    })
  }

  function handleUnsubmit() {
    setError(null)
    startTransition(async () => {
      const result = await unsubmitAssignmentAction(a.id)
      if (result.error) {
        setError(result.error)
      } else {
        setLocalStatus(a.dueDate && new Date(a.dueDate) < new Date() ? 'overdue' : 'pending')
        setLocalSubmittedAt(null)
        setLocalUrl(null)
        setUrl('')
      }
    })
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{a.name}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border',
                  currentCfg.className,
                )}
              >
                <CurrentIcon className="h-3 w-3" />
                {currentCfg.label}
              </span>
              <Badge variant="secondary" className="text-xs">{TYPE_LABELS[a.type] ?? a.type}</Badge>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-slate-500">
              <span>{a.className}</span>
              <span>·</span>
              <span>{a.termName}</span>
              {a.dueDate && (
                <>
                  <span>·</span>
                  <span className={cn(localStatus === 'overdue' && 'text-red-600 font-medium')}>
                    Échéance : {fmt(a.dueDate)}
                  </span>
                </>
              )}
              {a.documentUrl && (
                <a
                  href={a.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary flex items-center gap-0.5 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Voir le sujet
                </a>
              )}
            </div>

            {a.description && (
              <p className="text-xs text-slate-500 mt-1">{a.description}</p>
            )}

            {/* Submission info */}
            {localSubmittedAt && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-blue-600">
                  Remis le {fmt(localSubmittedAt)}
                </span>
                {localUrl && (
                  <a
                    href={localUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary flex items-center gap-0.5 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Mon devoir
                  </a>
                )}
              </div>
            )}

            {/* Grade result */}
            {a.gradedAt && (
              <div className="mt-2 inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-sm">
                <Award className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-green-700">
                  {a.score !== null ? `${a.score}/${a.maxScore}` : '—'}
                  {a.gradeLabel ? ` (${a.gradeLabel})` : ''}
                </span>
                {a.comment && (
                  <span className="text-green-600 text-xs">· {a.comment}</span>
                )}
              </div>
            )}
          </div>

          {/* Actions — students only */}
          {!isParent && (
            <div className="flex flex-col gap-2 shrink-0">
              {localStatus === 'pending' || localStatus === 'overdue' ? (
                <Button size="sm" onClick={() => setShowSubmit((s) => !s)}>
                  <Upload className="h-3.5 w-3.5" />
                  Remettre
                </Button>
              ) : localStatus === 'submitted' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleUnsubmit}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Retirer
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Submission form */}
        {showSubmit && !isParent && (
          <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">Lien du document (facultatif)</Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Collez un lien Google Docs, OneDrive ou autre…"
                className="text-sm"
              />
              <p className="text-xs text-slate-400">
                Collez un lien partageable vers votre travail. Laissez vide pour remettre sans document.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirmer la remise
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setShowSubmit(false); setUrl(a.submissionUrl ?? '') }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      </CardContent>
    </Card>
  )
}

export default function AssignmentList({ assignments, studentId, childOptions, isParent }: Props) {
  const [, startTransition] = useTransition()
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    childOptions.length === 1 ? childOptions[0].id : null,
  )
  const [visibleAssignments, setVisibleAssignments] = useState(assignments)
  const [isLoadingChild, setIsLoadingChild] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Group by status for display
  const sorted = [...visibleAssignments].sort((a, b) => {
    const order = { graded: 3, submitted: 1, overdue: 0, pending: 2 }
    return (order[statusOf(a) as keyof typeof order] ?? 2) - (order[statusOf(b) as keyof typeof order] ?? 2)
  })

  const pending = sorted.filter((a) => statusOf(a) === 'pending' || statusOf(a) === 'overdue')
  const submitted = sorted.filter((a) => statusOf(a) === 'submitted')
  const graded = sorted.filter((a) => statusOf(a) === 'graded')

  if (!studentId && childOptions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
        Aucun profil élève n’est associé à ce compte.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isParent && childOptions.length > 1 && (
        <div className="flex items-center gap-3">
          <label htmlFor="assignment-child" className="text-sm font-medium text-slate-700">Devoirs de :</label>
          <select
            id="assignment-child"
            className="h-9 rounded-lg border border-input bg-white px-3 text-sm shadow-sm"
            value={selectedChildId ?? ''}
            onChange={(e) => {
              const childId = e.target.value || null
              setSelectedChildId(childId)
              setVisibleAssignments([])
              setLoadError(null)
              if (!childId) return
              setIsLoadingChild(true)
              startTransition(async () => {
                try {
                  const result = await getChildAssignmentsAction(childId)
                  setVisibleAssignments(result.assignments)
                  setLoadError(result.error ?? null)
                } catch {
                  setLoadError('Impossible de charger les devoirs. Réessayez.')
                } finally {
                  setIsLoadingChild(false)
                }
              })
            }}
          >
            <option value="">Choisir un enfant…</option>
            {childOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
      {isLoadingChild ? (
        <p className="text-sm text-slate-500">Chargement des devoirs…</p>
      ) : isParent && childOptions.length > 1 && !selectedChildId ? (
        <p className="text-sm text-slate-500">Choisissez un enfant pour afficher ses devoirs.</p>
      ) : visibleAssignments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400 text-sm">
          Aucun devoir pour le moment. Les évaluations créées pour vos classes apparaîtront ici.
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                À faire ({pending.length})
              </h2>
              <div className="space-y-3">
                {pending.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}

          {submitted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                En attente de correction ({submitted.length})
              </h2>
              <div className="space-y-3">
                {submitted.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}

          {graded.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
                Corrigés ({graded.length})
              </h2>
              <div className="space-y-3">
                {graded.map((a) => <AssignmentCard key={a.id} a={a} isParent={isParent} />)}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
