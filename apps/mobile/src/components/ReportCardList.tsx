import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../design-tokens'

export type MobileReportCard = {
  id: string
  academicYear: number
  comments: string | null
  issuedAt: string | null
  termName: string
  averages: { subject: string; average: number }[]
  grades: { subject: string; assessment: string; score: number | null; maxScore: number; grade: string | null }[]
}

export function ReportCardList({ cards }: { cards: MobileReportCard[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Bulletins publiés</Text>
      {cards.length === 0 ? (
        <Text style={styles.empty}>Aucun bulletin publié pour le moment.</Text>
      ) : cards.map(card => (
        <View key={card.id} style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>{card.termName}</Text>
            <Text style={styles.year}>{card.academicYear}</Text>
          </View>
          {card.issuedAt ? (
            <Text style={styles.date}>Publié le {new Date(card.issuedAt).toLocaleDateString('fr-FR')}</Text>
          ) : null}
          {card.averages.map(row => (
            <View key={row.subject} style={styles.averageRow}>
              <Text style={styles.subject}>{row.subject} · moyenne pondérée</Text>
              <Text style={styles.score}>{row.average.toFixed(1)}%</Text>
            </View>
          ))}
          {card.grades.map((grade, index) => (
            <View key={`${grade.assessment}-${index}`} style={styles.gradeRow}>
              <Text style={styles.subject}>{grade.subject} · {grade.assessment}</Text>
              <Text style={styles.score}>{grade.grade ?? (grade.score === null ? '—' : `${grade.score}/${grade.maxScore}`)}</Text>
            </View>
          ))}
          {card.comments ? <Text style={styles.comment}>{card.comments}</Text> : (
            <Text style={styles.empty}>Aucun commentaire ajouté.</Text>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 6 },
  heading: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 15, marginTop: 6 },
  card: { backgroundColor: '#F8FAFF', borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, gap: 6 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.text, flexShrink: 1, fontFamily: 'Montserrat_600SemiBold', fontSize: 14 },
  year: { color: colors.blue, fontFamily: 'Montserrat_700Bold', fontSize: 12 },
  date: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 11 },
  averageRow: { alignItems: 'center', backgroundColor: '#EAF0FF', borderRadius: 7, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 7 },
  gradeRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6 },
  subject: { color: colors.text, flex: 1, fontFamily: 'Montserrat_400Regular', fontSize: 12 },
  score: { color: colors.blue, fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },
  comment: { color: colors.text, fontFamily: 'Montserrat_400Regular', fontSize: 13, lineHeight: 20 },
  empty: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 12, lineHeight: 18 },
})
