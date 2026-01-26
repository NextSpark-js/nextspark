/**
 * Create Task Screen
 */

import { router } from 'expo-router'
import { TaskForm } from '@/src/components/entities/tasks'
import { useCreateTask, type CreateTaskInput } from '@/src/entities/tasks'

export default function CreateTaskScreen() {
  const createTask = useCreateTask()

  const handleSubmit = async (data: CreateTaskInput) => {
    await createTask.mutateAsync(data)
    router.back()
  }

  return (
    <TaskForm
      mode="create"
      onSubmit={handleSubmit}
      isLoading={createTask.isPending}
    />
  )
}
