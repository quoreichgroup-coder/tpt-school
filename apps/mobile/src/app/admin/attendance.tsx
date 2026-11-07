import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { AdminError, AdminLoading, AdminScreen, adminStyles as styles } from '../../components/admin/AdminScreen'
import { useAdmin } from '../../components/admin/AdminProvider'
import { colors } from '../../design-tokens'
import { apiFetch } from '../../lib/api'
import { API_URL } from '../../lib/config'

type Status = 'present' | 'absent' | 'late' | 'excused'
const options: { value: Status; label: string }[] = [
  { value: 'present', label: 'Présent' }, { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Retard' }, { value: 'excused', label: 'Excusé' },
]

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function AdminAttendanceScreen() {
  const { classes, loading, error, refresh } = useAdmin()
  const [classId, setClassId] = useState('')
  const [attendance, setAttendance] = useState<Record<string, Status>>({})
  const [loadingDay, setLoadingDay] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dayError, setDayError] = useState<string | null>(null)
  const selectedClass = classes.find(schoolClass => schoolClass.id === classId) ?? classes[0]
  const selectedClassId = selectedClass?.id

  function selectClass(nextClassId: string) {
    if (nextClassId === selectedClassId) return
    setClassId(nextClassId)
    setAttendance({})
  }

  useEffect(() => {
    if (!selectedClassId) return
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      setLoadingDay(true)
      setDayError(null)
      return apiFetch(API_URL, `/api/v1/teacher/classes/${encodeURIComponent(selectedClassId)}/attendance?date=${today()}`)
        .then(async response => {
          const result = await response.json()
          if (!response.ok) throw new Error(result.error ?? 'Chargement des présences impossible.')
          if (active) setAttendance(Object.fromEntries(result.students.filter((student: { status: Status | null }) => student.status).map((student: { id: string; status: Status }) => [student.id, student.status])))
        })
        .catch(loadError => { if (active) setDayError(loadError instanceof Error ? loadError.message : 'Chargement impossible.') })
        .finally(() => { if (active) setLoadingDay(false) })
    })
    return () => { active = false }
  }, [selectedClassId])

  async function save() {
    if (!selectedClass) return
    const records = Object.entries(attendance).map(([studentId, status]) => ({ studentId, status }))
    if (!records.length) { Alert.alert('Aucune présence', 'Choisissez un statut pour au moins un élève.'); return }
    setSaving(true)
    try {
      const response = await apiFetch(API_URL, `/api/v1/teacher/classes/${encodeURIComponent(selectedClass.id)}/attendance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today(), records }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      Alert.alert('Présences enregistrées', `${result.saved} élève(s) mis à jour.`)
    } catch (saveError) {
      Alert.alert('Enregistrement impossible', saveError instanceof Error ? saveError.message : 'Vérifiez la connexion.')
    } finally { setSaving(false) }
  }

  return <AdminScreen title="Présences">
    {loading ? <AdminLoading /> : error ? <AdminError /> : classes.length === 0
      ? <Text style={styles.empty}>Aucune classe disponible.</Text>
      : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 44 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {classes.map(schoolClass => <TouchableOpacity key={schoolClass.id} accessibilityRole="button" accessibilityState={{ selected: selectedClass?.id === schoolClass.id }} onPress={() => selectClass(schoolClass.id)} style={[styles.primary, selectedClass?.id !== schoolClass.id && { backgroundColor: colors.muted }]}><Text style={styles.primaryText}>{schoolClass.name}</Text></TouchableOpacity>)}
          </View>
        </ScrollView>
        {dayError ? <View style={styles.card}><Text accessibilityRole="alert" style={{ color: '#9B2C2C' }}>{dayError}</Text><TouchableOpacity onPress={() => void refresh()}><Text style={{ color: colors.blue }}>Réessayer</Text></TouchableOpacity></View> : null}
        {loadingDay ? <ActivityIndicator color={colors.blue} /> : selectedClass?.enrolments.map(({ student }) => <View key={student.id} style={styles.card}>
          <Text style={styles.cardTitle}>{student.user.name}</Text><Text style={styles.muted}>N° {student.studentId}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {options.map(option => <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected: attendance[student.id] === option.value }} onPress={() => setAttendance(current => ({ ...current, [student.id]: option.value }))} style={[{ borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 }, attendance[student.id] === option.value && { backgroundColor: colors.blue, borderColor: colors.blue }]}><Text style={{ color: attendance[student.id] === option.value ? '#fff' : colors.muted, fontSize: 11 }}>{option.label}</Text></TouchableOpacity>)}
          </View>
        </View>)}
        <TouchableOpacity accessibilityRole="button" disabled={saving || loadingDay} onPress={() => void save()} style={[styles.primary, { marginVertical: 8, opacity: saving || loadingDay ? 0.6 : 1 }]}><Text style={styles.primaryText}>{saving ? 'Enregistrement…' : 'Enregistrer les présences'}</Text></TouchableOpacity>
      </>}
  </AdminScreen>
}
