/**
 * Tests for entities/tasks/queries.ts
 * TanStack Query hooks for fetching tasks
 */

import React from 'react'
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Task } from '@/entities/tasks/types'
import type { PaginatedResponse, SingleResponse } from '@/api/client.types'

// Import the mock from our __mocks__ folder
import { mockTasksApi } from '../../__mocks__/entities-tasks-api'

// Mock the module with the imported mock
jest.mock('@/entities/tasks/api', () => require('../../__mocks__/entities-tasks-api'))

// Import after mocks
import { useTasks, useTask, TASKS_QUERY_KEY } from '@/entities/tasks/queries'

// Test data
const testTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Task 1',
    description: 'Description 1',
    status: 'todo',
    priority: 'high',
    teamId: 'team-1',
    userId: 'user-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Task 2',
    description: 'Description 2',
    status: 'in-progress',
    priority: 'medium',
    teamId: 'team-1',
    userId: 'user-1',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
]

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

describe('Task queries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('TASKS_QUERY_KEY', () => {
    it('should be correct value', () => {
      expect(TASKS_QUERY_KEY).toEqual(['tasks'])
    })
  })

  describe('useTasks', () => {
    it('should fetch tasks list', async () => {
      const response: PaginatedResponse<Task> = {
        data: testTasks,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      }
      mockTasksApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useTasks(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockTasksApi.list).toHaveBeenCalled()
      expect(result.current.data?.data).toHaveLength(2)
    })

    it('should pass filter parameters', async () => {
      const response: PaginatedResponse<Task> = {
        data: [testTasks[0]],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }
      mockTasksApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(
        () => useTasks({ page: 2, limit: 10, status: 'todo', priority: 'high' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockTasksApi.list).toHaveBeenCalledWith({
        page: 2,
        limit: 10,
        status: 'todo',
        priority: 'high',
        search: undefined,
      })
    })

    it('should pass search parameter', async () => {
      const response: PaginatedResponse<Task> = {
        data: testTasks,
        meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
      }
      mockTasksApi.list.mockResolvedValueOnce(response)

      const { result } = renderHook(
        () => useTasks({ search: 'test query' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockTasksApi.list).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test query' })
      )
    })

    it('should not fetch when disabled', async () => {
      renderHook(
        () => useTasks({ enabled: false }),
        { wrapper: createWrapper() }
      )

      // Give it time to potentially fetch (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockTasksApi.list).not.toHaveBeenCalled()
    })

    it('should handle error state', async () => {
      const error = new Error('Failed to fetch')
      mockTasksApi.list.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useTasks(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })

  describe('useTask', () => {
    it('should fetch single task by id', async () => {
      const response: SingleResponse<Task> = { data: testTasks[0] }
      mockTasksApi.get.mockResolvedValueOnce(response)

      const { result } = renderHook(() => useTask('task-1'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockTasksApi.get).toHaveBeenCalledWith('task-1')
      expect(result.current.data?.data.id).toBe('task-1')
    })

    it('should not fetch if id is undefined', async () => {
      renderHook(() => useTask(undefined), {
        wrapper: createWrapper(),
      })

      // Give it time to potentially fetch (it shouldn't)
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockTasksApi.get).not.toHaveBeenCalled()
    })

    it('should handle error for single task', async () => {
      const error = new Error('Task not found')
      mockTasksApi.get.mockRejectedValueOnce(error)

      const { result } = renderHook(() => useTask('non-existent'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toEqual(error)
    })
  })
})
