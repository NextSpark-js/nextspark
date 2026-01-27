/**
 * Edit Task Screen
 */

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Alert } from '@nextsparkjs/mobile'
import { useTask } from '../../../src/entities/tasks/queries'
import { useUpdateTask, useDeleteTask } from '../../../src/entities/tasks/mutations'
import type { UpdateTaskInput } from '../../../src/entities/tasks/types'

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { data: taskData, isLoading } = useTask(id!)
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [form, setForm] = useState<UpdateTaskInput>({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
  })

  useEffect(() => {
    if (taskData?.data) {
      setForm({
        title: taskData.data.title,
        description: taskData.data.description || '',
        status: taskData.data.status,
        priority: taskData.data.priority,
      })
    }
  }, [taskData])

  const handleSubmit = async () => {
    if (!form.title?.trim()) return

    try {
      await updateTask.mutateAsync({ id: id!, data: form })
      router.back()
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleDelete = async () => {
    const confirmed = await Alert.confirmDestructive(
      'Delete Task',
      'Are you sure you want to delete this task?',
      'Delete'
    )

    if (confirmed) {
      try {
        await deleteTask.mutateAsync(id!)
        router.back()
      } catch (error) {
        console.error('Failed to delete task:', error)
      }
    }
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title */}
      <View style={styles.field}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(text) => setForm({ ...form, title: text })}
          placeholder="Enter task title"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Description */}
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={form.description}
          onChangeText={(text) => setForm({ ...form, description: text })}
          placeholder="Enter task description"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Status */}
      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <View style={styles.options}>
          {(['pending', 'in_progress', 'completed'] as const).map((status) => (
            <Pressable
              key={status}
              style={[
                styles.option,
                form.status === status && styles.optionSelected,
              ]}
              onPress={() => setForm({ ...form, status })}
            >
              <Text
                style={[
                  styles.optionText,
                  form.status === status && styles.optionTextSelected,
                ]}
              >
                {status.replace('_', ' ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Priority */}
      <View style={styles.field}>
        <Text style={styles.label}>Priority</Text>
        <View style={styles.options}>
          {(['low', 'medium', 'high'] as const).map((priority) => (
            <Pressable
              key={priority}
              style={[
                styles.option,
                form.priority === priority && styles.optionSelected,
              ]}
              onPress={() => setForm({ ...form, priority })}
            >
              <Text
                style={[
                  styles.optionText,
                  form.priority === priority && styles.optionTextSelected,
                ]}
              >
                {priority}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          style={[styles.submitButton, updateTask.isPending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={updateTask.isPending || !form.title?.trim()}
        >
          {updateTask.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Save Changes</Text>
          )}
        </Pressable>

        <Pressable
          style={[styles.deleteButton, deleteTask.isPending && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={deleteTask.isPending}
        >
          {deleteTask.isPending ? (
            <ActivityIndicator color="#DC2626" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Task</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
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
  content: {
    padding: 16,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  options: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: '#171717',
    backgroundColor: '#171717',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textTransform: 'capitalize',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
  actions: {
    gap: 12,
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: '#171717',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonDisabled: {
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
})
