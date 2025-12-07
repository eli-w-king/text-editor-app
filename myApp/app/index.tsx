import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotes, Note } from '@/hooks/useNotes';
import { useAppContext } from '@/context/AppContext';
import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen() {
  const router = useRouter();
  const { notes, loading } = useNotes();
  const { theme } = useAppContext();

  const renderItem = ({ item }: { item: Note }) => (
    <TouchableOpacity 
      style={[styles.noteItem, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#FFFFFF' }]}
      onPress={() => router.push(`/note/${item.id}`)}
    >
      <Text style={[styles.noteTitle, { color: Colors[theme].text }]} numberOfLines={1}>
        {item.title || 'Untitled Note'}
      </Text>
      <Text style={[styles.notePreview, { color: theme === 'dark' ? '#8E8E93' : '#666' }]} numberOfLines={2}>
        {item.content}
      </Text>
      <Text style={[styles.noteDate, { color: theme === 'dark' ? '#636366' : '#999' }]}>
        {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: Colors[theme].text }]}>Notes</Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <Text style={{ color: Colors[theme].text }}>Loading...</Text>
          </View>
        ) : (
          <FlatList
            data={notes}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: Colors[theme].text, marginTop: 50 }}>No notes yet.</Text>
              </View>
            }
          />
        )}

        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: theme === 'dark' ? '#FFF' : '#000' }]}
          onPress={() => router.push('/note/new')}
        >
          <Ionicons name="add" size={30} color={theme === 'dark' ? '#000' : '#FFF'} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for FAB and Menu
  },
  noteItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  notePreview: {
    fontSize: 14,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 120, // Above the FloatingMenu
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  }
});
