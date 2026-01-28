/**
 * Mock for @/api/core module
 */

export const mockAuthApi = {
  getSession: jest.fn().mockResolvedValue(null),
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
}

export const mockTeamsApi = {
  getTeams: jest.fn().mockResolvedValue({ data: [] }),
  switchTeam: jest.fn().mockResolvedValue(undefined),
}

export const authApi = mockAuthApi
export const teamsApi = mockTeamsApi
