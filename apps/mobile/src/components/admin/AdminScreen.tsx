import type { ReactNode } from 'react'
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { colors } from '../../design-tokens'
import { useAdmin } from './AdminProvider'

export function AdminScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>QSCHOOL · ADMIN</Text>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    </SafeAreaView>
  )
}

export function AdminLoading() {
  return <View style={styles.state}><ActivityIndicator color={colors.blue} /><Text style={styles.muted}>Chargement...</Text></View>
}

export function AdminError() {
  const { error, refresh } = useAdmin()
  return (
    <View style={styles.state}>
      <Text accessibilityRole="alert" style={styles.error}>{error ?? 'Une erreur est survenue.'}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => void refresh()} style={styles.retry}>
        <Text style={styles.retryText}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  )
}

export const adminStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: 7, marginBottom: 10, padding: 14 },
  cardTitle: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 15 },
  muted: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 12 },
  text: { color: colors.text, fontFamily: 'Montserrat_400Regular', fontSize: 13 },
  sectionTitle: { color: colors.text, fontFamily: 'Montserrat_700Bold', fontSize: 16, marginBottom: 10, marginTop: 18 },
  primary: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 9, justifyContent: 'center', minHeight: 42, paddingHorizontal: 14 },
  primaryText: { color: '#fff', fontFamily: 'Montserrat_600SemiBold', fontSize: 12 },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 9, borderWidth: 1, color: colors.text, fontFamily: 'Montserrat_400Regular', minHeight: 44, paddingHorizontal: 12 },
  empty: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 13, paddingVertical: 22, textAlign: 'center' },
})

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.background, flex: 1 },
  container: { flex: 1, gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  brand: { color: colors.blue, fontFamily: 'Montserrat_700Bold', fontSize: 10, letterSpacing: 1.5 },
  title: { color: colors.text, fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 27, marginBottom: 8 },
  state: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', padding: 24 },
  muted: { color: colors.muted, fontFamily: 'Montserrat_400Regular', fontSize: 13 },
  error: { color: '#9B2C2C', fontFamily: 'Montserrat_400Regular', fontSize: 13, textAlign: 'center' },
  retry: { backgroundColor: colors.blue, borderRadius: 9, paddingHorizontal: 18, paddingVertical: 11 },
  retryText: { color: '#fff', fontFamily: 'Montserrat_600SemiBold' },
})
