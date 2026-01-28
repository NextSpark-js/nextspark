/**
 * Tests for entities/tasks/mutations.ts
 * TanStack Query mutation hooks for tasks
 */

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/entities/tasks/types'
import type { SingleResponse } from '@/api/client.types'

// Import the mock from our __mocks__ folder
import { mockTasksApi } from '../../__mocks__/entities-tasks-api'

// Mock the module with the imported mock
jest.mock('@/entities/tasks/api', () => require('../../__mocks__/entities-tasks-api'))

// Import after mocks
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useUpdateTaskStatus,
} from '@/entities/tasks/mutations'

// Test data matching actual Task type
const testTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'Test description',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  teamId: 'team-1',
  userId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const createInput: CreateTaskInput = {
  title: 'New Task',
  description: 'New description',
  status: 'todo',
  priority: 'high',
}

const updateInput: UpdateTaskInput = {
  title: 'Updated Task',
}

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

describe('Task mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useCreateTask', () => {
    it('should call tasksApi.create with data', async () => {
      const response: SingleResponse<Task> = { data: { ...testTask, ...createInput } }
      mockTasksApi.create.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync(createInput)
      })

      expect(mockTasksApi.create).toHaveBeenCalledWith(createInput)
    })

    it('should return created task on success', async () => {
      const createdTask: Task = { ...testTask, id: 'task-new', title: 'New Task' }
      const response: SingleResponse<Task> = { data: createdTask }
      mockTasksApi.create.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      })

      let mutationResult: SingleResponse<Task> | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync(createInput)
      })

      expect(mutationResult?.data.title).toBe('New Task')
    })

    it('should handle error correctly', async () => {
      const error = new Error('Create failed')
      mockTasksApi.create.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync(createInput)
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('useUpdateTask', () => {
    it('should call tasksApi.update with id and data', async () => {
      const updatedTask: Task = { ...testTask, ...updateInput }
      const response: SingleResponse<Task> = { data: updatedTask }
      mockTasksApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'task-1', data: updateInput })
      })

      expect(mockTasksApi.update).toHaveBeenCalledWith('task-1', updateInput)
    })

    it('should return updated task on success', async () => {
      const updatedTask: Task = { ...testTask, title: 'Updated Task' }
      const response: SingleResponse<Task> = { data: updatedTask }
      mockTasksApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      })

      let mutationResult: SingleResponse<Task> | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync({ id: 'task-1', data: updateInput })
      })

      expect(mutationResult?.data.title).toBe('Updated Task')
    })
  })

  describe('useDeleteTask', () => {
    it('should call tasksApi.delete with id', async () => {
      mockTasksApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('task-1')
      })

      expect(mockTasksApi.delete).toHaveBeenCalledWith('task-1')
    })

    it('should handle delete success', async () => {
      mockTasksApi.delete.mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useDeleteTask(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync('task-1')
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
    })
  })

  describe('useUpdateTaskStatus (optimistic)', () => {
    it('should call tasksApi.update with id and status', async () => {
      const updatedTask: Task = { ...testTask, status: 'done' }
      const response: SingleResponse<Task> = { data: updatedTask }
      mockTasksApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateTaskStatus(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'task-1', status: 'done' })
      })

      expect(mockTasksApi.update).toHaveBeenCalledWith('task-1', { status: 'done' })
    })

    it('should handle optimistic update', async () => {
      const updatedTask: Task = { ...testTask, status: 'in-progress' }
      const response: SingleResponse<Task> = { data: updatedTask }
      mockTasksApi.update.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useUpdateTaskStatus(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate({ id: 'task-1', status: 'in-progress' })
      })

      // The mutation should be pending or successful
      await waitFor(() => {
        expect(
          result.current.isPending || result.current.isSuccess
        ).toBe(true)
      })
    })

    it('should handle status update error', async () => {
      const error = new Error('Update failed')
      mockTasksApi.update.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useUpdateTaskStatus(), {
        wrapper: createWrapper(),
      })

      await expect(
        act(async () => {
          await result.current.mutateAsync({ id: 'task-1', status: 'done' })
        })
      ).rejects.toThrow('Update failed')
    })
  })
})
