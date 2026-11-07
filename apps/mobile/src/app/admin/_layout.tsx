import { Tabs } from 'expo-router'
import { AdminProvider } from '../../components/admin/AdminProvider'
import { colors } from '../../design-tokens'

export default function AdminLayout() {
  return (
    <AdminProvider>
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: 'Montserrat_600SemiBold', fontSize: 10 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, minHeight: 58, paddingBottom: 5, paddingTop: 5 },
      }}>
        <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarAccessibilityLabel: 'Accueil admin' }} />
        <Tabs.Screen name="classes" options={{ title: 'Classes', tabBarAccessibilityLabel: 'Classes' }} />
        <Tabs.Screen name="students" options={{ title: 'Élèves', tabBarAccessibilityLabel: 'Élèves' }} />
        <Tabs.Screen name="attendance" options={{ title: 'Présences', tabBarAccessibilityLabel: 'Présences' }} />
        <Tabs.Screen name="grades" options={{ title: 'Notes', tabBarAccessibilityLabel: 'Notes' }} />
      </Tabs>
    </AdminProvider>
  )
}
