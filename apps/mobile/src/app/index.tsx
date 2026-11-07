import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { useFonts } from 'expo-font'
import { colors } from '../design-tokens'
import { MobileReportCard, ReportCardList } from '../components/ReportCardList'
import { MobileTimetableSlot, ScheduleList } from '../components/ScheduleList'
import { TeacherGradebook } from '../components/TeacherGradebook'
import { ExamList, MobileExam } from '../components/ExamList'
import { apiFetch, clearMobileCredentials, revokeMobileCredentials, storeMobileCredentials } from '../lib/api'
import { API_URL } from '../lib/config'

type User = { name: string; email: string; role: string }
type Portal = { students: { id: string; studentId: string; yearLevel: number | null; user: { name: string }; attendance: { date: string; status: string }[]; grades: { grade: string | null; score: number | null; comment: string | null; gradebook: { name: string; maxScore: number; class: { name: string } } }[]; currentAverages: { subject: string; average: number }[]; reportCards: MobileReportCard[]; timetable: MobileTimetableSlot[]; exams: MobileExam[] }[]; notices: { id: string; title: string; body: string; category: string }[] }
type TeacherClasses = { classes: { id: string; name: string; code: string; subject: string | null; enrolments: { student: { id: string; user: { name: string }; studentId: string } }[] }[] }
type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
type AttendanceState = Record<string, Record<string, AttendanceStatus>>
const attendanceOptions: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Présent' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Retard' },
  { value: 'excused', label: 'Excusé' },
]

function localDateToday() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function App() {
  // Expo's static font assets use literal require() paths.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular: require('../../assets/fonts/Montserrat_400Regular.ttf'),
    Montserrat_600SemiBold: require('../../assets/fonts/Montserrat_600SemiBold.ttf'),
    Montserrat_700Bold: require('../../assets/fonts/Montserrat_700Bold.ttf'),
    PlayfairDisplay_600SemiBold: require('../../assets/fonts/PlayfairDisplay_600SemiBold.ttf'),
  })
  /* eslint-enable @typescript-eslint/no-require-imports */
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [portal, setPortal] = useState<Portal | null>(null)
  const [portalIssue, setPortalIssue] = useState<string | null>(null)
  const [refreshingPortal, setRefreshingPortal] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState<TeacherClasses | null>(null)
  const [attendance, setAttendance] = useState<AttendanceState>({})
  const [savingClassId, setSavingClassId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  async function loadPortal() {
    setPortalIssue(null)
    try {
      const response = await apiFetch(API_URL, '/api/v1/portal')
      if (response.status === 401) {
        await clearMobileCredentials()
        setUser(null)
        setPortal(null)
        setTeacherClasses(null)
        setPortalIssue(null)
        setAuthMessage('Votre session a expiré. Connectez-vous à nouveau.')
        return
      }
      if (response.status === 403) {
        const classesResponse = await apiFetch(API_URL, '/api/v1/teacher/classes')
        if (classesResponse.status === 401) {
          await clearMobileCredentials()
          setUser(null)
          setPortal(null)
          setTeacherClasses(null)
          setPortalIssue(null)
          setAuthMessage('Votre session a expiré. Connectez-vous à nouveau.')
          return
        }
        if (!classesResponse.ok) throw new Error('Chargement des classes impossible.')
        const result: TeacherClasses = await classesResponse.json()
        setTeacherClasses(result)
        const attendanceByClass = await Promise.all(result.classes.map(async (schoolClass) => {
          const dailyResponse = await apiFetch(API_URL, `/api/v1/teacher/classes/${encodeURIComponent(schoolClass.id)}/attendance?date=${localDateToday()}`)
          if (!dailyResponse.ok) return [schoolClass.id, {}] as const
          const daily: { students: { id: string; status: AttendanceStatus | null }[] } = await dailyResponse.json()
          return [schoolClass.id, Object.fromEntries(daily.students.filter(student => student.status).map(student => [student.id, student.status as AttendanceStatus]))] as const
        }))
        setAttendance(Object.fromEntries(attendanceByClass))
        return
      }
      if (!response.ok) throw new Error(`Serveur indisponible (${response.status}).`)
      setPortal(await response.json())
      setTeacherClasses(null)
    } catch {
      setPortalIssue('Connexion au serveur impossible. Vérifiez le réseau puis réessayez.')
    }
  }

  async function refreshPortal() {
    const token = await SecureStore.getItemAsync('qschool.accessToken')
    if (!token) return
    setRefreshingPortal(true)
    try { await loadPortal() }
    finally { setRefreshingPortal(false) }
  }

  useEffect(() => {
    let cancelled = false
    SecureStore.getItemAsync('qschool.accessToken').then(async (token) => {
      if (!token) return
      const response = await apiFetch(API_URL, '/api/v1/auth/me')
      if (response.status === 401) {
        await clearMobileCredentials()
        if (!cancelled) setAuthMessage('Votre session a expiré. Connectez-vous à nouveau.')
        return
      }
      if (!response.ok) throw new Error('Serveur temporairement indisponible.')
      const result = await response.json()
      if (!cancelled) setUser(result.user)
      if (!cancelled && result.user.role === 'admin') {
        router.replace('/admin')
        return
      }
      if (!cancelled) await loadPortal()
    }).catch(() => {
      if (!cancelled) setAuthMessage('Connexion au serveur impossible. Vérifiez le réseau puis réessayez.')
    })
    return () => { cancelled = true }
  }, [])

  async function login() {
    setBusy(true)
    setAuthMessage(null)
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Connexion impossible.')
      await storeMobileCredentials(result.accessToken, result.refreshToken)
      setUser(result.user)
      if (result.user.role === 'admin') {
        router.replace('/admin')
        return
      }
      await loadPortal()
      setPassword('')
    } catch (error) {
      Alert.alert('Connexion impossible', error instanceof Error ? error.message : 'Vérifiez votre connexion.')
    } finally { setBusy(false) }
  }

  async function logout() {
    await revokeMobileCredentials(API_URL)
    setUser(null)
    setPortal(null)
    setTeacherClasses(null)
    setAttendance({})
    setPortalIssue(null)
    setAuthMessage(null)
  }

  async function saveAttendance(classId: string) {
    const records = Object.entries(attendance[classId] ?? {}).map(([studentId, status]) => ({ studentId, status }))
    if (records.length === 0) {
      Alert.alert('Présences non enregistrées', 'Sélectionnez un statut pour au moins un élève.')
      return
    }
    setSavingClassId(classId)
    try {
      const response = await apiFetch(API_URL, `/api/v1/teacher/classes/${encodeURIComponent(classId)}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: localDateToday(), records }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      Alert.alert('Présences enregistrées', `${result.saved} élève(s) mis à jour.`)
    } catch (error) {
      Alert.alert('Enregistrement impossible', error instanceof Error ? error.message : 'Vérifiez votre connexion.')
    } finally { setSavingClassId(null) }
  }

  if (!fontsLoaded) return <View style={styles.loading}><ActivityIndicator color="#0062DB" /></View>

  const tabs = user
    ? ['parent', 'student'].includes(user.role)
      ? [
          { id: 'overview', label: 'Accueil' },
          { id: 'academics', label: 'Bulletins' },
          { id: 'planning', label: 'Planning' },
          { id: 'notices', label: 'Infos' },
        ]
      : [
          { id: 'attendance', label: 'Présences' },
          { id: 'grades', label: 'Notes' },
        ]
    : []
  const currentTab = tabs.some(tab => tab.id === activeTab) ? activeTab : tabs[0]?.id

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.brandMark}><Text style={styles.brandInitial}>Q</Text></View>
        <Text style={styles.eyebrow}>QSCHOOL</Text>
        <Text style={styles.title}>{user ? `Bonjour, ${user.name.split(' ')[0]}` : 'Bienvenue'}</Text>
        <Text style={styles.subtitle}>{user ? 'Votre espace scolaire, partout avec vous.' : 'Connectez-vous à votre espace scolaire.'}</Text>
        <View style={styles.card}>
          {user ? (
            <>
              <Text style={styles.cardHeading}>Mon espace</Text>
              <Text style={styles.body}>{user.email}</Text>
              <Text style={styles.role}>{user.role}</Text>
              {portalIssue && (
                <View style={styles.connectionIssue}>
                  <Text style={styles.issueText}>{portalIssue}</Text>
                  <TouchableOpacity accessibilityRole="button" disabled={refreshingPortal} style={styles.retryButton} onPress={refreshPortal}>
                    <Text style={styles.retryLabel}>{refreshingPortal ? 'Connexion...' : 'Réessayer'}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {portal?.students.length === 0 && <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Aucun élève n’est associé à ce compte.</Text>
                <Text style={styles.body}>Demandez à l’administration de vérifier le rattachement du profil parent ou élève.</Text>
              </View>}
              {teacherClasses?.classes.length === 0 && <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Aucune classe attribuée.</Text>
                <Text style={styles.body}>Demandez à l’administration de vérifier vos affectations.</Text>
              </View>}
              {portal?.students.map(student => (
                <View key={student.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>{student.user.name}{student.yearLevel ? ` · Niveau ${student.yearLevel}` : ''}</Text>
                  {currentTab === 'overview' && <>
                    <Text style={styles.body}>{student.attendance.length} présences récentes · {student.grades.length} notes</Text>
                    {student.currentAverages.map(row => <Text key={row.subject} style={styles.averageText}>{row.subject} · moyenne pondérée : {row.average.toFixed(1)}%</Text>)}
                    {student.grades.slice(0, 3).map((grade, index) => (
                      <View key={`${grade.gradebook.name}-${index}`}>
                        <Text style={styles.body}>{grade.gradebook.name}: {grade.grade ?? (grade.score === null ? '—' : `${grade.score}/${grade.gradebook.maxScore}`)}</Text>
                        {grade.comment && <Text style={styles.gradeComment}>{grade.comment}</Text>}
                      </View>
                    ))}
                  </>}
                  {currentTab === 'academics' && <ReportCardList cards={student.reportCards} />}
                  {currentTab === 'planning' && <>
                    <ScheduleList slots={student.timetable} />
                    <ExamList exams={student.exams} />
                  </>}
                </View>
              ))}
              {teacherClasses?.classes.map(schoolClass => (
                <View key={schoolClass.id} style={styles.section}>
                  <Text style={styles.sectionTitle}>{schoolClass.name} · {schoolClass.code}</Text>
                  <Text style={styles.body}>{schoolClass.subject ?? 'Classe'} · {schoolClass.enrolments.length} élèves · {localDateToday()}</Text>
                  {currentTab === 'attendance' && <>
                    {schoolClass.enrolments.map(({ student }) => (
                      <View key={student.id} style={styles.studentRow}>
                        <Text style={styles.studentName}>{student.user.name}</Text>
                        <View style={styles.statusRow}>
                          {attendanceOptions.map(option => {
                            const selected = attendance[schoolClass.id]?.[student.id] === option.value
                            return <TouchableOpacity key={option.value} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${student.user.name} : ${option.label}`} style={[styles.statusButton, selected && styles.statusButtonSelected]} onPress={() => setAttendance(current => ({ ...current, [schoolClass.id]: { ...current[schoolClass.id], [student.id]: option.value } }))}>
                              <Text style={[styles.statusLabel, selected && styles.statusLabelSelected]}>{option.label}</Text>
                            </TouchableOpacity>
                          })}
                        </View>
                      </View>
                    ))}
                    <TouchableOpacity accessibilityRole="button" disabled={savingClassId === schoolClass.id} style={[styles.primaryButton, savingClassId === schoolClass.id && styles.disabled]} onPress={() => saveAttendance(schoolClass.id)}>
                      {savingClassId === schoolClass.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Enregistrer les présences</Text>}
                    </TouchableOpacity>
                  </>}
                  {currentTab === 'grades' && <TeacherGradebook classId={schoolClass.id} apiUrl={API_URL} />}
                </View>
              ))}
              {portal && currentTab === 'notices' && <>
                <Text style={styles.sectionTitle}>Annonces</Text>
                {portal.notices.length === 0 && <Text style={styles.body}>Aucune annonce pour le moment.</Text>}
                {portal.notices.slice(0, 5).map(notice => <View key={notice.id} style={styles.notice}><Text style={styles.noticeTitle}>{notice.title}</Text><Text style={styles.body}>{notice.body}</Text></View>)}
              </>}
              <TouchableOpacity accessibilityRole="button" style={styles.secondaryButton} onPress={logout}><Text style={styles.secondaryLabel}>Se déconnecter</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardHeading}>Connexion</Text>
              {authMessage && <Text accessibilityRole="alert" style={styles.issueText}>{authMessage}</Text>}
              <Text style={styles.label}>Adresse e-mail</Text>
              <TextInput accessibilityLabel="Adresse e-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" style={styles.input} value={email} onChangeText={setEmail} placeholder="nom@ecole.org" placeholderTextColor="#77849A" />
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput accessibilityLabel="Mot de passe" autoComplete="current-password" secureTextEntry style={styles.input} value={password} onChangeText={setPassword} onSubmitEditing={login} placeholder="Votre mot de passe" placeholderTextColor="#77849A" />
              <TouchableOpacity accessibilityRole="button" disabled={busy || !email || !password} style={[styles.primaryButton, (busy || !email || !password) && styles.disabled]} onPress={login}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Se connecter</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
        <Text style={styles.footer}>Intelligence Beyond Boundaries</Text>
      </ScrollView>
      {user && tabs.length > 0 && <View accessibilityRole="tablist" style={styles.tabBar}>
        {tabs.map(tab => <TouchableOpacity key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: currentTab === tab.id }} style={styles.tabButton} onPress={() => setActiveTab(tab.id)}>
          <Text style={[styles.tabLabel, currentTab === tab.id && styles.tabLabelSelected]}>{tab.label}</Text>
        </TouchableOpacity>)}
      </View>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 560, width: '100%', alignSelf: 'center' },
  brandMark: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }, brandInitial: { fontFamily: 'PlayfairDisplay_600SemiBold', color: '#fff', fontSize: 30 },
  eyebrow: { color: colors.blue, letterSpacing: 2, fontFamily: 'Montserrat_700Bold', fontSize: 12, marginBottom: 8 }, title: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 34 }, subtitle: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 15, lineHeight: 24, marginTop: 8, marginBottom: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 22 }, cardHeading: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 19, marginBottom: 18 }, label: { color: '#344054', fontFamily: 'Montserrat_600SemiBold', fontSize: 13, marginBottom: 8, marginTop: 14 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14, color: '#172033', fontFamily: 'Montserrat_400Regular', fontSize: 15 }, primaryButton: { minHeight: 50, backgroundColor: '#0062DB', borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, primaryLabel: { color: '#fff', fontFamily: 'Montserrat_700Bold', fontSize: 15 }, disabled: { opacity: 0.5 },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderColor: colors.blue, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, secondaryLabel: { color: colors.blue, fontFamily: 'Montserrat_600SemiBold' }, body: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 15 }, gradeComment: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 12, marginTop: 2 }, averageText: { color: colors.blue, fontFamily: 'Montserrat_600SemiBold', fontSize: 13 }, role: { alignSelf: 'flex-start', color: '#004AA6', backgroundColor: '#EAF2FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden', fontFamily: 'Montserrat_600SemiBold', marginTop: 16 }, section: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 16, gap: 8 }, sectionTitle: { fontFamily: 'Montserrat_700Bold', color: colors.text, fontSize: 16, marginTop: 18 }, notice: { borderLeftWidth: 3, borderLeftColor: colors.orange, backgroundColor: '#FFF8F3', padding: 12, marginTop: 10, gap: 6 }, noticeTitle: { color: colors.text, fontFamily: 'Montserrat_600SemiBold' }, footer: { textAlign: 'center', color: '#77849A', fontFamily: 'Montserrat_400Regular', fontSize: 12, marginTop: 32 },
  connectionIssue: { backgroundColor: '#FFF8F3', borderColor: '#F3D4C3', borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 14, gap: 8 }, issueText: { color: '#8A3F1E', fontFamily: 'Montserrat_400Regular', fontSize: 13, lineHeight: 19 }, retryButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.blue, borderRadius: 8 }, retryLabel: { color: '#fff', fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },
  studentRow: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, marginTop: 8, gap: 8 }, studentName: { fontFamily: 'Montserrat_600SemiBold', color: colors.text, fontSize: 14 }, statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, statusButton: { borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 8, paddingVertical: 7 }, statusButtonSelected: { backgroundColor: colors.blue, borderColor: colors.blue }, statusLabel: { color: colors.muted, fontFamily: 'Montserrat_600SemiBold', fontSize: 11 }, statusLabelSelected: { color: '#fff' },
  tabBar: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8, paddingHorizontal: 6, paddingTop: 8 }, tabButton: { alignItems: 'center', flex: 1, minHeight: 42, justifyContent: 'center' }, tabLabel: { color: colors.muted, fontFamily: 'Montserrat_600SemiBold', fontSize: 11 }, tabLabelSelected: { color: colors.blue },
  emptyState: { backgroundColor: '#F8FAFF', borderColor: colors.border, borderWidth: 1, borderRadius: 12, gap: 6, marginTop: 14, padding: 14 }, emptyTitle: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 13 },
})
