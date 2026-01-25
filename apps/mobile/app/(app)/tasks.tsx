/**
 * Tasks List Screen
 */

import { useCallback, useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { router } from 'expo-router'
import { useTasks } from '@/src/hooks/useTasks'
import { TaskCard } from '@/src/components/TaskCard'
import { Colors } from '@/src/constants/colors'
import type { Task } from '@/src/types'

export default function TasksScreen() {
  const { data, isLoading, error, refetch } = useTasks()
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleTaskPress = (task: Task) => {
    router.push(`/(app)/task/${task.id}`)
  }

  const renderTask = ({ item }: { item: Task }) => (
    <TaskCard task={item} onPress={() => handleTaskPress(item)} />
  )

  const renderEmpty = () => {
    if (isLoading) return null

    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>☑</Text>
        <Text style={styles.emptyTitle}>Sin tareas</Text>
        <Text style={styles.emptyText}>
          Toca el botón Crear para agregar tu primera tarea
        </Text>
      </View>
    )
  }

  const renderError = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Algo salió mal</Text>
      <Text style={styles.errorText}>
        {error instanceof Error ? error.message : 'Error al cargar tareas'}
      </Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
        <Text style={styles.retryButtonText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={styles.container}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Tareas</Text>
        <Text style={styles.pageSubtitle}>
          Gestiona y organiza tus tareas pendientes
        </Text>
      </View>

      {/* Error State */}
      {error && renderError()}

      {/* Tasks List */}
      {!error && (
        <FlatList
          data={data?.data || []}
          renderItem={renderTask}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: Colors.foregroundSecondary,
  },
  listContent: {
    paddingBottom: 12,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.foreground,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.destructive,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: Colors.primaryForeground,
    fontSize: 14,
    fontWeight: '600',
  },
})
