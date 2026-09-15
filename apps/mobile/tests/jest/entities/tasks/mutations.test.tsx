/**
 * Tests for entities/tasks/mutations.ts
 * TanStack Query mutation hooks for tasks
 */

import React from 'react'
import { renderHook, waitFor, act } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/entities/tasks/types'

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
import { TASKS_QUERY_KEY } from '@/entities/tasks/queries'

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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

// Helper to create wrapper with QueryClient
function createWrapper(queryClient = createQueryClient()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )
  }
}

// tasksApi comes from createEntityApi, which resolves create/update with the
// entity itself (it unwraps the API's { data } envelope).
describe('Task mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useCreateTask', () => {
    it('should call tasksApi.create with data', async () => {
      mockTasksApi.create.mockResolvedValueOnce({ ...testTask, ...createInput })

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
      mockTasksApi.create.mockResolvedValueOnce(createdTask)

      const { result } = renderHook(() => useCreateTask(), {
        wrapper: createWrapper(),
      })

      let mutationResult: Task | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync(createInput)
      })

      expect(mutationResult?.title).toBe('New Task')
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
      mockTasksApi.update.mockResolvedValueOnce({ ...testTask, ...updateInput })

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
      mockTasksApi.update.mockResolvedValueOnce(updatedTask)

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(),
      })

      let mutationResult: Task | undefined
      await act(async () => {
        mutationResult = await result.current.mutateAsync({ id: 'task-1', data: updateInput })
      })

      expect(mutationResult?.title).toBe('Updated Task')
    })

    it('should cache the updated task under its id', async () => {
      const updatedTask: Task = { ...testTask, ...updateInput }
      mockTasksApi.update.mockResolvedValueOnce(updatedTask)
      const queryClient = createQueryClient()

      const { result } = renderHook(() => useUpdateTask(), {
        wrapper: createWrapper(queryClient),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'task-1', data: updateInput })
      })

      expect(queryClient.getQueryData([...TASKS_QUERY_KEY, 'task-1'])).toEqual(updatedTask)
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
      mockTasksApi.update.mockResolvedValueOnce({ ...testTask, status: 'done' })

      const { result } = renderHook(() => useUpdateTaskStatus(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        await result.current.mutateAsync({ id: 'task-1', status: 'done' })
      })

      expect(mockTasksApi.update).toHaveBeenCalledWith('task-1', { status: 'done' })
    })

    it('should handle optimistic update', async () => {
      mockTasksApi.update.mockResolvedValueOnce({ ...testTask, status: 'in-progress' })

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
