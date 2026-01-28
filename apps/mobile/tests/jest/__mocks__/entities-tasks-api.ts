/**
 * Mock for @/entities/tasks/api module
 */

export const mockTasksApi = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  get: jest.fn(),
}

export const tasksApi = mockTasksApi
