import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../design-tokens'

export type MobileExam = {
  id: string
  title: string
  startsAt: string
  endsAt: string
  className: string
  subject: string | null
  room: string | null
  termName: string
}

export function ExamList({ exams }: { exams: MobileExam[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Examens à venir</Text>
      {exams.length === 0 ? <Text style={styles.empty}>Aucun examen publié pour le moment.</Text> : exams.map(exam => (
        <View key={exam.id} style={styles.card}>
          <Text style={styles.title}>{exam.title}</Text>
          <Text style={styles.date}>{new Date(exam.startsAt).toLocaleString('fr-FR')}</Text>
          <Text style={styles.detail}>{exam.subject ?? exam.className} · {exam.termName}</Text>
          <Text style={styles.detail}>{exam.room ?? 'Salle à confirmer'}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 9, marginTop: 6 },
  heading: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 15, marginTop: 6 },
  card: { backgroundColor: '#FFF8F3', borderColor: '#F2DDCF', borderRadius: 10, borderWidth: 1, gap: 4, padding: 11 },
  title: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 13 },
  date: { color: colors.blue, fontFamily: 'Montserrat_600SemiBold', fontSize: 11 },
  detail: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 11 },
  empty: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 12, lineHeight: 18 },
})
