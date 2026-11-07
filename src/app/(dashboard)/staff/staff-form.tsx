'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createStaffAction, updateStaffAction } from './actions'
import { Loader2, AlertCircle } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StaffData = {
  id: string
  employeeId: string
  jobTitle: string | null
  department: string | null
  employmentType: string
  dateHired: Date | null
  bio: string | null
  qualifications: string | null
  user: {
    name: string
    email: string
    phone: string | null
    role: string
  }
}

type Props = {
  staff?: StaffData
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateInput(date: Date | null | undefined): string {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(' ')
  const firstName = parts[0] ?? ''
  const lastName = parts.slice(1).join(' ')
  return { firstName, lastName }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StaffForm({ staff }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [createdPassword, setCreatedPassword] = useState<{ id: string; password: string } | null>(null)

  const isEdit = !!staff
  const { firstName: initialFirst, lastName: initialLast } = staff
    ? splitName(staff.user.name)
    : { firstName: '', lastName: '' }

  const [firstName, setFirstName] = useState(initialFirst)
  const [lastName, setLastName] = useState(initialLast)
  const [email, setEmail] = useState(staff?.user.email ?? '')
  const [phone, setPhone] = useState(staff?.user.phone ?? '')
  const [accountRole, setAccountRole] = useState(staff?.user.role === 'accountant' ? 'accountant' : 'teacher')
  const [jobTitle, setJobTitle] = useState(staff?.jobTitle ?? '')
  const [department, setDepartment] = useState(staff?.department ?? '')
  const [employmentType, setEmploymentType] = useState(staff?.employmentType ?? 'full-time')
  const [dateHired, setDateHired] = useState(formatDateInput(staff?.dateHired))
  const [bio, setBio] = useState(staff?.bio ?? '')
  const [qualifications, setQualifications] = useState(staff?.qualifications ?? '')

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData()
    fd.set('firstName', firstName)
    fd.set('lastName', lastName)
    fd.set('email', email)
    fd.set('phone', phone)
    fd.set('accountRole', accountRole)
    fd.set('jobTitle', jobTitle)
    fd.set('department', department)
    fd.set('employmentType', employmentType)
    fd.set('dateHired', dateHired)
    fd.set('bio', bio)
    fd.set('qualifications', qualifications)

    startTransition(async () => {
      const result = isEdit
        ? await updateStaffAction(staff.id, fd)
        : await createStaffAction(fd)

      if (result && !result.success) {
        setError(result.error ?? 'Une erreur est survenue.')
      } else if (result && result.success && !isEdit && 'tempPassword' in result && result.tempPassword && 'id' in result && result.id) {
        setCreatedPassword({ id: result.id as string, password: result.tempPassword as string })
      } else if (result && result.success && isEdit) {
        router.push(`/staff/${staff.id}`)
      }
    })
  }

  if (createdPassword) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Card className="border-emerald-200 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-slate-800">Membre du personnel créé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Le compte du membre a été créé. Communiquez-lui le mot de passe temporaire, affiché une seule fois.
            </p>
            <div className="rounded-md bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-xs text-slate-500 mb-1">Mot de passe temporaire</p>
              <p className="font-mono text-lg font-bold tracking-wider text-slate-800 select-all">
                {createdPassword.password}
              </p>
            </div>
            <p className="text-xs text-amber-600 font-medium">
              Le mot de passe devra être modifié lors de la première connexion.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push(`/staff/${createdPassword.id}`)}
            >
              Ouvrir le dossier du membre
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Personal Details */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Informations personnelles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstName">Prénom <span className="text-destructive">*</span></Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex. : Aïssatou"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lastName">Nom <span className="text-destructive">*</span></Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ex. : Diallo"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse e-mail <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="personnel@ecole.org"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex. : +224 600 00 00 00"
            />
          </div>
        </CardContent>
      </Card>

      {/* Employment Details */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base text-slate-800">Informations professionnelles</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Fonction</Label>
            <Input
              id="jobTitle"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Ex. : Enseignant principal"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="department">Service</Label>
            <Input
              id="department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex. : Mathématiques"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="employmentType">Type de contrat</Label>
            <Select value={employmentType} onValueChange={(v) => { if (v !== null) setEmploymentType(v) }}>
              <SelectTrigger id="employmentType" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Temps plein</SelectItem>
                <SelectItem value="part-time">Temps partiel</SelectItem>
                <SelectItem value="casual">Occasionnel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accountRole">Rôle du compte</Label>
            <Select value={accountRole} onValueChange={(value) => { if (value !== null) setAccountRole(value) }}>
              <SelectTrigger id="accountRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teacher">Enseignant</SelectItem>
                <SelectItem value="accountant">Comptable — finances uniquement</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">Le comptable gère les factures, paiements et types de frais, sans accès à l’administration de l’établissement.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dateHired">Date d’embauche</Label>
            <Input
              id="dateHired"
              type="date"
              value={dateHired}
              onChange={(e) => setDateHired(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="qualifications">Diplômes et qualifications</Label>
            <Textarea
              id="qualifications"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="Ex. : Licence en sciences de l’éducation…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="bio">Présentation</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Courte présentation du membre du personnel…"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isPending} size="lg">
          {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {isEdit ? 'Enregistrer les modifications' : 'Ajouter le membre'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Annuler
        </Button>
      </div>
    </form>
  )
}
