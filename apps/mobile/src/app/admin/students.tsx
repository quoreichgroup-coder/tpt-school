import { useMemo, useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { AdminError, AdminLoading, AdminScreen, adminStyles as styles } from '../../components/admin/AdminScreen'
import { useAdmin } from '../../components/admin/AdminProvider'

export default function AdminStudentsScreen() {
  const { classes, loading, error } = useAdmin()
  const [search, setSearch] = useState('')
  const students = useMemo(() => {
    const unique = new Map<string, { id: string; name: string; studentId: string; classes: string[] }>()
    for (const schoolClass of classes) for (const { student } of schoolClass.enrolments) {
      const current = unique.get(student.id) ?? { id: student.id, name: student.user.name, studentId: student.studentId, classes: [] }
      current.classes.push(schoolClass.name)
      unique.set(student.id, current)
    }
    const query = search.trim().toLocaleLowerCase()
    return [...unique.values()].filter(student => !query || `${student.name} ${student.studentId} ${student.classes.join(' ')}`.toLocaleLowerCase().includes(query))
  }, [classes, search])

  return <AdminScreen title="Élèves">
    {loading ? <AdminLoading /> : error ? <AdminError /> : <>
      <TextInput accessibilityLabel="Rechercher un élève" placeholder="Nom, numéro ou classe" placeholderTextColor="#77849A" value={search} onChangeText={setSearch} style={styles.input} />
      <FlatList
        data={students}
        keyExtractor={student => student.id}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={<Text style={styles.empty}>{classes.length ? 'Aucun élève ne correspond à cette recherche.' : 'Aucun élève inscrit dans une classe.'}</Text>}
        renderItem={({ item }) => <View style={styles.card}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.muted}>N° {item.studentId}</Text>
          <Text style={styles.text}>Classe{item.classes.length > 1 ? 's' : ''} : {item.classes.join(', ')}</Text>
        </View>}
      />
    </>}
  </AdminScreen>
}
