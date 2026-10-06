import { usersApi } from '../../../src/api/core/users'
import { apiClient } from '../../../src/api/client'

jest.mock('../../../src/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn(),
    setUser: jest.fn(),
    getStoredUser: jest.fn(),
  },
}))

const mockGet = apiClient.get as jest.Mock
const mockPatch = apiClient.patch as jest.Mock
const mockStoredUser = apiClient.getStoredUser as jest.Mock

describe('usersApi (#209: every route it calls exists in core)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStoredUser.mockReturnValue({ id: 'user-1', email: 'ada@example.com' })
  })

  it('getCurrentUser reads GET /api/v1/users/me', async () => {
    mockGet.mockResolvedValue({ data: { id: 'user-1' } })
    await expect(usersApi.getCurrentUser()).resolves.toEqual({ id: 'user-1' })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/users/me')
  })

  it('updateProfile sends PATCH /api/v1/users/me and stores the answer', async () => {
    const user = { id: 'user-1', email: 'ada@example.com' }
    mockPatch.mockResolvedValue({ data: user })
    await usersApi.updateProfile({ firstName: 'Ada' })
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/users/me', { firstName: 'Ada' })
    expect(apiClient.setUser).toHaveBeenCalledWith(user)
  })

  it('getPreferences reads the preferences metadata of the user, {} when unset', async () => {
    mockGet.mockResolvedValueOnce({ data: { key: 'preferences', value: { theme: 'dark' } } })
    await expect(usersApi.getPreferences()).resolves.toEqual({ theme: 'dark' })
    expect(mockGet).toHaveBeenCalledWith('/api/v1/users/user-1/meta/preferences')
    mockGet.mockResolvedValueOnce({ data: { key: 'preferences', value: null } })
    await expect(usersApi.getPreferences()).resolves.toEqual({})
  })

  it('updatePreferences merges into the stored preferences', async () => {
    mockGet.mockResolvedValue({ data: { key: 'preferences', value: { theme: 'dark', language: 'es' } } })
    mockPatch.mockResolvedValue({ data: {} })
    await expect(usersApi.updatePreferences({ theme: 'light' })).resolves.toEqual({ theme: 'light', language: 'es' })
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/users/user-1/meta/preferences', { value: { theme: 'light', language: 'es' } })
  })

  it('takes the user id from /users/me when none is stored', async () => {
    mockStoredUser.mockReturnValue(null)
    mockGet.mockResolvedValueOnce({ data: { id: 'user-2' } }).mockResolvedValueOnce({ data: { value: null } })
    await usersApi.getPreferences()
    expect(mockGet).toHaveBeenLastCalledWith('/api/v1/users/user-2/meta/preferences')
  })

  it('serializes preference updates, so quick successive calls all land', async () => {
    let stored: Record<string, unknown> = {}
    mockGet.mockImplementation(async () => {
      await Promise.resolve()
      return { data: { value: { ...stored } } }
    })
    mockPatch.mockImplementation(async (_url: string, body: { value: Record<string, unknown> }) => {
      await Promise.resolve()
      stored = body.value
      return { data: {} }
    })
    await Promise.all([usersApi.updatePreferences({ theme: 'dark' }), usersApi.updatePreferences({ language: 'es' })])
    expect(stored).toEqual({ theme: 'dark', language: 'es' })
  })

  it('a failed preference update does not block the next one', async () => {
    mockGet.mockResolvedValue({ data: { value: null } })
    mockPatch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: {} })
    await expect(usersApi.updatePreferences({ theme: 'dark' })).rejects.toThrow('offline')
    await expect(usersApi.updatePreferences({ theme: 'light' })).resolves.toEqual({ theme: 'light' })
  })
})
