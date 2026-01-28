/**
 * Mock for @/api/client module
 */

export class ApiError extends Error {
  status: number
  data: unknown
  name = 'ApiError'
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

export const mockApiClient = {
  init: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockReturnValue(null),
  getStoredUser: jest.fn().mockReturnValue(null),
  getTeamId: jest.fn().mockReturnValue(null),
  setToken: jest.fn().mockResolvedValue(undefined),
  setTeamId: jest.fn().mockResolvedValue(undefined),
  setUser: jest.fn().mockResolvedValue(undefined),
  clearAuth: jest.fn().mockResolvedValue(undefined),
}

export const apiClient = mockApiClient
