/**
 * Tasks List Screen
 */

import { View, Text, FlatList, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useTasks } from '../../src/entities/tasks/queries'
import type { Task } from '../../src/entities/tasks/types'

function TaskItem({ task }: { task: Task }) {
  return (
    <Pressable
      style={styles.taskItem}
      onPress={() => router.push(`/(app)/task/${task.id}`)}
    >
      <View style={styles.taskContent}>
        <Text style={styles.taskTitle}>{task.title}</Text>
        {task.description && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {task.description}
          </Text>
        )}
        <View style={styles.taskMeta}>
          <View style={[styles.statusBadge, styles[`status_${task.status}`]]}>
            <Text style={styles.statusText}>{task.status}</Text>
          </View>
          <View style={[styles.priorityBadge, styles[`priority_${task.priority}`]]}>
            <Text style={styles.priorityText}>{task.priority}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  )
}

export default function TasksScreen() {
  const { data, isLoading, error, refetch } = useTasks()

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load tasks</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <FlatList
        data={data?.data || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskItem task={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks yet</Text>
            <Pressable
              style={styles.createButton}
              onPress={() => router.push('/(app)/task/create')}
            >
              <Text style={styles.createButtonText}>Create your first task</Text>
            </Pressable>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(app)/task/create')}
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  taskContent: {
    gap: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  taskDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  status_pending: {
    backgroundColor: '#FEF3C7',
  },
  status_in_progress: {
    backgroundColor: '#DBEAFE',
  },
  status_completed: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priority_low: {
    backgroundColor: '#E5E7EB',
  },
  priority_medium: {
    backgroundColor: '#FED7AA',
  },
  priority_high: {
    backgroundColor: '#FECACA',
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: '#171717',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#171717',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#171717',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
})
