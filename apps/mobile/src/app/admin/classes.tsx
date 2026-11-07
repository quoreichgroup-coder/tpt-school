import { FlatList, Text, View } from 'react-native'
import { AdminError, AdminLoading, AdminScreen, adminStyles as styles } from '../../components/admin/AdminScreen'
import { useAdmin } from '../../components/admin/AdminProvider'

export default function AdminClassesScreen() {
  const { classes, loading, error } = useAdmin()
  return <AdminScreen title="Classes">
    {loading ? <AdminLoading /> : error ? <AdminError /> : classes.length === 0
      ? <Text style={styles.empty}>Aucune classe n’est configurée.</Text>
      : <FlatList
          data={classes}
          keyExtractor={schoolClass => schoolClass.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item: schoolClass }) => <View style={styles.card}>
            <Text style={styles.cardTitle}>{schoolClass.name} · {schoolClass.code}</Text>
            <Text style={styles.muted}>{schoolClass.subject ?? 'Classe'}{schoolClass.yearLevel ? ` · Niveau ${schoolClass.yearLevel}` : ''}</Text>
            <Text style={styles.text}>{schoolClass.enrolments.length} élèves</Text>
            {schoolClass.enrolments.slice(0, 5).map(({ student }) => <Text key={student.id} style={styles.muted}>{student.user.name} · {student.studentId}</Text>)}
            {schoolClass.enrolments.length > 5 && <Text style={styles.muted}>et {schoolClass.enrolments.length - 5} autres élèves</Text>}
          </View>}
          ListEmptyComponent={<Text style={styles.empty}>Aucune classe n’est configurée.</Text>}
        />}
  </AdminScreen>
}
