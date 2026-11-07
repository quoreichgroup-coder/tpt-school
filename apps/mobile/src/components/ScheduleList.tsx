import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../design-tokens'

export type MobileTimetableSlot = {
  id: string
  dayOfWeek: number
  period: number
  startTime: string
  endTime: string
  className: string
  subject: string | null
  room: string | null
  teacher: string | null
}

const days = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export function ScheduleList({ slots }: { slots: MobileTimetableSlot[] }) {
  const grouped = days.slice(1).map((name, index) => ({
    name,
    lessons: slots.filter(slot => slot.dayOfWeek === index + 1),
  })).filter(day => day.lessons.length > 0)

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Emploi du temps</Text>
      {grouped.length === 0 ? <Text style={styles.empty}>Aucun cours planifié.</Text> : grouped.map(day => (
        <View key={day.name} style={styles.day}>
          <Text style={styles.dayName}>{day.name}</Text>
          {day.lessons.map(lesson => (
            <View key={lesson.id} style={styles.lesson}>
              <Text style={styles.time}>{lesson.startTime}–{lesson.endTime}</Text>
              <Text style={styles.subject}>{lesson.subject ?? lesson.className}</Text>
              <Text style={styles.detail}>
                {[lesson.teacher, lesson.room].filter(Boolean).join(' · ') || `Période ${lesson.period}`}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 6 },
  heading: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 15, marginTop: 6 },
  day: { gap: 7 },
  dayName: { color: colors.blue, fontFamily: 'Montserrat_600SemiBold', fontSize: 13, marginTop: 5 },
  lesson: { backgroundColor: '#F8FAFF', borderColor: colors.border, borderRadius: 10, borderWidth: 1, gap: 3, padding: 11 },
  time: { color: colors.muted, fontFamily: 'Montserrat_600SemiBold', fontSize: 11 },
  subject: { color: colors.text, fontFamily: 'Montserrat_600SemiBold', fontSize: 13 },
  detail: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 11 },
  empty: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 12, lineHeight: 18 },
})
