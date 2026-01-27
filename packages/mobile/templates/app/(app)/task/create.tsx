/**
 * Create Task Screen
 */

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useCreateTask } from '../../../src/entities/tasks/mutations'
import type { CreateTaskInput } from '../../../src/entities/tasks/types'

export default function CreateTaskScreen() {
  const createTask = useCreateTask()
  const [form, setForm] = useState<CreateTaskInput>({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
  })

  const handleSubmit = async () => {
    if (!form.title.trim()) return

    try {
      await createTask.mutateAsync(form)
      router.back()
    } catch (error) {
      console.error('Failed to create task:', error)
    }
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

      {/* Submit */}
      <Pressable
        style={[styles.submitButton, createTask.isPending && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={createTask.isPending || !form.title.trim()}
      >
        {createTask.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Create Task</Text>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  submitButton: {
    backgroundColor: '#171717',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
})
