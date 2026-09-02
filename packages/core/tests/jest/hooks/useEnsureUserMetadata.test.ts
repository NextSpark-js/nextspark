/**
 * useEnsureUserMetadata — per-block default seeding (#119)
 *
 * The old guard (`!meta || Object.keys(meta).length === 0`) only fired when
 * meta was completely empty, so any early write (onboarding, tours, active
 * team) silently disabled seeding. Each preference block must be checked
 * independently and only the missing ones sent, so existing data is never
 * overwritten.
 */
import { describe, test, expect, jest } from '@jest/globals'

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}))
jest.mock('../../../src/lib/auth-client', () => ({
  authClient: { useSession: jest.fn() },
}))
jest.mock('../../../src/hooks/useUserSettings', () => ({
  USER_PROFILE_WITH_META_QUERY_KEY: (id?: string) => ['user-profile-with-meta', id],
}))

import { getMissingMetadataDefaults } from '../../../src/hooks/useEnsureUserMetadata'

const ALL_BLOCKS = ['uiPreferences', 'securityPreferences', 'notificationsPreferences']

describe('getMissingMetadataDefaults', () => {
  test('returns every block when meta is missing or empty', () => {
    expect(Object.keys(getMissingMetadataDefaults(undefined)).sort()).toEqual([...ALL_BLOCKS].sort())
    expect(Object.keys(getMissingMetadataDefaults(null)).sort()).toEqual([...ALL_BLOCKS].sort())
    expect(Object.keys(getMissingMetadataDefaults({})).sort()).toEqual([...ALL_BLOCKS].sort())
  })

  test('still seeds all preference blocks when unrelated keys were written first', () => {
    const meta = { onboardingProgress: { step: 3 }, activeTeamId: 'team-1' } as Record<string, unknown>
    const missing = getMissingMetadataDefaults(meta)

    expect(Object.keys(missing).sort()).toEqual([...ALL_BLOCKS].sort())
    // Never touches the keys other flows own
    expect(missing).not.toHaveProperty('onboardingProgress')
    expect(missing).not.toHaveProperty('activeTeamId')
  })

  test('only returns the blocks that are actually missing', () => {
    const missing = getMissingMetadataDefaults({
      uiPreferences: { theme: 'dark', sidebarCollapsed: true },
      notificationsPreferences: { pushEnabled: false },
    })

    expect(Object.keys(missing)).toEqual(['securityPreferences'])
    expect(missing.securityPreferences).toEqual({ loginAlertsEnabled: true })
  })

  test('returns nothing when every block already exists (even if partially filled)', () => {
    const missing = getMissingMetadataDefaults({
      uiPreferences: {},
      securityPreferences: {},
      notificationsPreferences: {},
    })

    expect(missing).toEqual({})
  })
})
