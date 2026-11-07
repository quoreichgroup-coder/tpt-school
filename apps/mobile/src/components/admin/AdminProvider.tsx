import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { apiFetch, revokeMobileCredentials } from '../../lib/api'
import { API_URL } from '../../lib/config'

export type AdminClass = {
  id: string
  name: string
  code: string
  subject: string | null
  yearLevel: number | null
  enrolments: { student: { id: string; studentId: string; yearLevel: number | null; user: { name: string } } }[]
}

type AdminUser = { name: string; email: string; role: string }
type AdminState = {
  user: AdminUser | null
  classes: AdminClass[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AdminContext = createContext<AdminState | null>(null)

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [classes, setClasses] = useState<AdminClass[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const meResponse = await apiFetch(API_URL, '/api/v1/auth/me')
      if (meResponse.status === 401) {
        router.replace('/')
        return
      }
      if (!meResponse.ok) throw new Error('Impossible de vérifier la session admin.')
      const me: { user: AdminUser } = await meResponse.json()
      if (me.user.role !== 'admin') {
        router.replace('/')
        return
      }

      const classesResponse = await apiFetch(API_URL, '/api/v1/teacher/classes')
      if (!classesResponse.ok) throw new Error('Chargement des classes impossible.')
      const result: { classes: AdminClass[] } = await classesResponse.json()
      setUser(me.user)
      setClasses(result.classes)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Connexion au serveur impossible.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void Promise.resolve().then(() => refresh()) }, [refresh])

  const logout = useCallback(async () => {
    await revokeMobileCredentials(API_URL)
    setUser(null)
    setClasses([])
    router.replace('/')
  }, [])

  const value = useMemo(() => ({ user, classes, loading, error, refresh, logout }), [user, classes, loading, error, refresh, logout])
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const context = useContext(AdminContext)
  if (!context) throw new Error('useAdmin must be used inside AdminProvider.')
  return context
}
