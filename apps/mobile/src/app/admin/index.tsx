import { ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { router } from 'expo-router'
import { AdminError, AdminLoading, AdminScreen, adminStyles as styles } from '../../components/admin/AdminScreen'
import { useAdmin } from '../../components/admin/AdminProvider'

export default function AdminHomeScreen() {
  const { user, classes, loading, error, logout } = useAdmin()
  const studentCount = new Set(classes.flatMap(schoolClass => schoolClass.enrolments.map(({ student }) => student.id))).size

  return (
    <AdminScreen title="Vue d’ensemble">
      {loading ? <AdminLoading /> : error ? <AdminError /> : <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
          <Text style={styles.muted}>Voici la situation de votre établissement.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Classes</Text>
          <Text style={styles.text}>{classes.length}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Élèves inscrits dans les classes</Text>
          <Text style={styles.text}>{studentCount}</Text>
        </View>
        <Text style={styles.sectionTitle}>Accès rapide</Text>
        {[
          { title: 'Consulter les classes et leurs listes', route: '/admin/classes' as const },
          { title: 'Consulter les élèves', route: '/admin/students' as const },
          { title: 'Saisir les présences', route: '/admin/attendance' as const },
          { title: 'Saisir les notes', route: '/admin/grades' as const },
        ].map(item => <TouchableOpacity key={item.route} accessibilityRole="button" onPress={() => router.navigate(item.route)} style={styles.card}>
          <Text style={styles.cardTitle}>{item.title} →</Text>
        </TouchableOpacity>)}
        <View style={styles.card}>
          <Text style={styles.muted}>Pour les dossiers complets, inscriptions, finances, bulletins, rapports et paramètres, utilisez QSCHOOL sur le web.</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => void logout()} style={styles.primary}>
          <Text style={styles.primaryText}>Se déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>}
    </AdminScreen>
  )
}
