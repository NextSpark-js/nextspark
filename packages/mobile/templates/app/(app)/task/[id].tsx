/**
 * Edit Task Screen
 */

import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { TaskForm } from '@/src/components/entities/tasks'
import { useTask, useUpdateTask, useDeleteTask, type UpdateTaskInput } from '@/src/entities/tasks'

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data, isLoading, error } = useTask(id)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const handleSubmit = async (formData: UpdateTaskInput) => {
    if (!id) return
    await updateTask.mutateAsync({ id, data: formData })
    router.back()
  }

  const handleDelete = async () => {
    if (!id) return
    await deleteTask.mutateAsync(id)
    router.back()
  }

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  if (error || !data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          {error instanceof Error ? error.message : 'Task not found'}
        </Text>
      </View>
    )
  }

  return (
    <TaskForm
      mode="edit"
      initialData={data.data}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      isLoading={updateTask.isPending || deleteTask.isPending}
    />
  )
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
})
