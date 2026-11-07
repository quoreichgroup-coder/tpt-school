import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors } from '../design-tokens'
import { apiFetch } from '../lib/api'

type Student = { id: string; studentId: string; user: { name: string } }
type Gradebook = {
  id: string
  name: string
  type: string
  maxScore: number
  weight: number
  term: { id: string; name: string }
  grades: { studentId: string; score: number | null; grade: string | null }[]
}
type GradebooksResponse = { students: Student[]; gradebooks: Gradebook[] }

export function TeacherGradebook({ classId, apiUrl }: { classId: string; apiUrl: string }) {
  const [data, setData] = useState<GradebooksResponse | null>(null)
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const response = await apiFetch(apiUrl, `/api/v1/teacher/classes/${encodeURIComponent(classId)}/gradebooks`)
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Chargement des évaluations impossible.')
        if (!active) return
        const parsed = result as GradebooksResponse
        setData(parsed)
        setScores(Object.fromEntries(parsed.gradebooks.map(gradebook => [
          gradebook.id,
          Object.fromEntries(gradebook.grades.map(grade => [grade.studentId, grade.score == null ? '' : String(grade.score)])),
        ])))
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Chargement des évaluations impossible.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [apiUrl, classId])

  async function save(gradebook: Gradebook) {
    const entered = data?.students.flatMap(student => {
      const rawScore = scores[gradebook.id]?.[student.id]?.trim()
      if (!rawScore) return []
      const score = Number(rawScore.replace(',', '.'))
      return [{ studentId: student.id, score, valid: Number.isFinite(score) && score >= 0 && score <= gradebook.maxScore }]
    }) ?? []
    if (entered.some(record => !record.valid)) {
      Alert.alert('Note invalide', `Saisissez des notes comprises entre 0 et ${gradebook.maxScore}.`)
      return
    }
    const records = entered.map(({ studentId, score }) => ({ studentId, score }))
    if (records.length === 0) {
      Alert.alert('Aucune note à enregistrer', 'Saisissez une note comprise dans le barème.')
      return
    }

    setSavingId(gradebook.id)
    try {
      const response = await apiFetch(apiUrl, `/api/v1/teacher/classes/${encodeURIComponent(classId)}/gradebooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradebookId: gradebook.id, records }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      Alert.alert('Notes enregistrées', `${result.saved} note(s) mises à jour.`)
    } catch (saveError) {
      Alert.alert('Enregistrement impossible', saveError instanceof Error ? saveError.message : 'Vérifiez votre connexion.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Saisie des notes</Text>
      {loading ? <ActivityIndicator color={colors.blue} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {data?.gradebooks.length === 0 && <Text style={styles.muted}>Aucune évaluation configurée pour cette classe.</Text>}
      {data?.gradebooks.map(gradebook => (
        <View key={gradebook.id} style={styles.gradebook}>
          <Text style={styles.gradebookTitle}>{gradebook.name}</Text>
          <Text style={styles.muted}>{gradebook.term.name} · sur {gradebook.maxScore} · coefficient {gradebook.weight}</Text>
          {data.students.map(student => (
            <View key={student.id} style={styles.studentRow}>
              <Text numberOfLines={1} style={styles.studentName}>{student.user.name}</Text>
              <TextInput
                accessibilityLabel={`Note de ${student.user.name} pour ${gradebook.name}`}
                keyboardType="decimal-pad"
                value={scores[gradebook.id]?.[student.id] ?? ''}
                onChangeText={value => setScores(current => ({
                  ...current,
                  [gradebook.id]: { ...current[gradebook.id], [student.id]: value },
                }))}
                placeholder="—"
                placeholderTextColor="#77849A"
                style={styles.scoreInput}
              />
            </View>
          ))}
          <TouchableOpacity
            accessibilityRole="button"
            disabled={savingId === gradebook.id}
            style={[styles.saveButton, savingId === gradebook.id && styles.disabled]}
            onPress={() => save(gradebook)}
          >
            {savingId === gradebook.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveLabel}>Enregistrer les notes</Text>}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { borderTopColor: colors.border, borderTopWidth: 1, gap: 10, marginTop: 18, paddingTop: 14 },
  heading: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 15 },
  gradebook: { backgroundColor: '#F8FAFF', borderColor: colors.border, borderRadius: 12, borderWidth: 1, gap: 7, marginTop: 5, padding: 12 },
  gradebookTitle: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 14 },
  muted: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 11 },
  studentRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 7 },
  studentName: { color: colors.text, flex: 1, fontFamily: 'Montserrat_400Regular', fontSize: 12 },
  scoreInput: { backgroundColor: '#fff', borderColor: colors.border, borderRadius: 7, borderWidth: 1, color: colors.text, fontFamily: 'Montserrat_600SemiBold', minWidth: 64, paddingHorizontal: 8, paddingVertical: 7, textAlign: 'center' },
  saveButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 9, justifyContent: 'center', marginTop: 6, minHeight: 42 },
  saveLabel: { color: '#fff', fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },
  disabled: { opacity: 0.5 },
  error: { color: '#B42318', fontFamily: 'Montserrat_400Regular', fontSize: 12 },
})
