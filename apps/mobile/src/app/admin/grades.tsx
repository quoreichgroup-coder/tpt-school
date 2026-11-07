import { useState } from 'react'
import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { AdminError, AdminLoading, AdminScreen, adminStyles as styles } from '../../components/admin/AdminScreen'
import { useAdmin } from '../../components/admin/AdminProvider'
import { TeacherGradebook } from '../../components/TeacherGradebook'
import { colors } from '../../design-tokens'
import { API_URL } from '../../lib/config'

export default function AdminGradesScreen() {
  const { classes, loading, error } = useAdmin()
  const [classId, setClassId] = useState('')
  const selectedClass = classes.find(schoolClass => schoolClass.id === classId) ?? classes[0]
  return <AdminScreen title="Notes">
    {loading ? <AdminLoading /> : error ? <AdminError /> : classes.length === 0
      ? <Text style={styles.empty}>Aucune classe disponible.</Text>
      : <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 44 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {classes.map(schoolClass => <TouchableOpacity key={schoolClass.id} accessibilityRole="button" accessibilityState={{ selected: selectedClass?.id === schoolClass.id }} onPress={() => setClassId(schoolClass.id)} style={[styles.primary, selectedClass?.id !== schoolClass.id && { backgroundColor: colors.muted }]}><Text style={styles.primaryText}>{schoolClass.name}</Text></TouchableOpacity>)}
          </View>
        </ScrollView>
        {selectedClass && <TeacherGradebook classId={selectedClass.id} apiUrl={API_URL} />}
      </>}
  </AdminScreen>
}
