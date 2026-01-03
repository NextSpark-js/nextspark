/**
 * Unit tests for roles-merge.ts
 *
 * Tests the extensible roles system including:
 * - Core roles protection
 * - Theme extension capabilities
 * - Validation and warnings
 * - Type safety helpers
 * - Backwards compatibility
 */

import {
  mergeRolesConfig,
  type CoreRolesConfig,
  type ThemeRolesConfig,
  type MergedRolesConfig,
} from '@/core/lib/config/roles-merge'
import { isCoreRole, isThemeRole } from '@/core/types/user.types'

// =============================================================================
// TEST FIXTURES
// =============================================================================

/**
 * Sample core config that matches DEFAULT_APP_CONFIG structure
 */
const mockCoreConfig: CoreRolesConfig = {
  coreRoles: ['member', 'superadmin', 'developer'] as const,
  availableRoles: ['member', 'superadmin', 'developer'] as const,
  defaultRole: 'member',
  hierarchy: {
    member: 1,
    superadmin: 99,
    developer: 100,
  },
  displayNames: {
    member: 'common.userRoles.member',
    superadmin: 'common.userRoles.superadmin',
    developer: 'common.userRoles.developer',
  },
  descriptions: {
    member: 'Regular user with basic access',
    superadmin: 'Full system access and configuration',
    developer: 'Platform developer with ultimate access',
  },
}

// =============================================================================
// DESCRIBE: Core Roles Protection (AC1-4)
// =============================================================================

describe('Core Roles Protection', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // AC1: Core roles always present
  it('should always include core roles in availableRoles', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'moderator'],
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.availableRoles).toContain('member')
    expect(result.availableRoles).toContain('superadmin')
    expect(result.availableRoles).toContain('developer')
  })

  // AC2: Cannot remove core roles
  it('should not allow removing core roles via theme config', () => {
    // Try to add a core role via additionalRoles (should be ignored)
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['superadmin', 'editor'], // superadmin is core, should be ignored
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    // Core roles still present
    expect(result.availableRoles).toContain('member')
    expect(result.availableRoles).toContain('superadmin')
    expect(result.availableRoles).toContain('developer')

    // Editor added correctly
    expect(result.availableRoles).toContain('editor')

    // Warning was triggered
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to add core role "superadmin"')
    )
  })

  // AC3: Developer hierarchy always 100
  it('should force developer hierarchy to always be 100', () => {
    const themeConfig: ThemeRolesConfig = {
      hierarchy: {
        developer: 50, // Try to lower developer
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.developer).toBe(100)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to set developer hierarchy to 50')
    )
  })

  // AC4: Cap non-developer roles at 99
  it('should cap non-developer roles at 99 if set >= 100', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['admin'],
      hierarchy: {
        admin: 100, // Try to set >= 100
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.admin).toBe(99)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to set "admin" hierarchy to 100')
    )
  })

  it('should also cap when hierarchy > 100', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['owner'],
      hierarchy: {
        owner: 150,
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.owner).toBe(99)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Non-developer roles cannot have hierarchy >= 100')
    )
  })
})

// =============================================================================
// DESCRIBE: Theme Extension (AC5-10)
// =============================================================================

describe('Theme Extension', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // AC5: Theme can add custom roles
  it('should append additionalRoles to core roles', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'moderator'],
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.availableRoles).toContain('editor')
    expect(result.availableRoles).toContain('moderator')
    expect(result.availableRoles.length).toBe(5) // 3 core + 2 theme
  })

  // AC6: Theme roles appended in order
  it('should append theme additionalRoles after core roles', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'moderator'],
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    const roles = [...result.availableRoles]
    expect(roles.indexOf('member')).toBeLessThan(roles.indexOf('editor'))
    expect(roles.indexOf('superadmin')).toBeLessThan(roles.indexOf('moderator'))
  })

  // AC7: Theme can override displayNames
  it('should merge displayNames from theme', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      displayNames: {
        member: 'custom.member', // Override core
        editor: 'custom.editor', // New theme role
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.displayNames.member).toBe('custom.member')
    expect(result.displayNames.editor).toBe('custom.editor')
    expect(result.displayNames.superadmin).toBe('common.userRoles.superadmin') // Unchanged
  })

  // AC8: Theme can override descriptions
  it('should merge descriptions from theme', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      descriptions: {
        superadmin: 'Custom superadmin description', // Override core
        editor: 'Content editor role', // New theme role
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.descriptions.superadmin).toBe('Custom superadmin description')
    expect(result.descriptions.editor).toBe('Content editor role')
    expect(result.descriptions.member).toBe('Regular user with basic access') // Unchanged
  })

  // AC9: Theme can override hierarchy (except developer)
  it('should merge hierarchy values from theme', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      hierarchy: {
        member: 5, // Override core member
        superadmin: 90, // Override core superadmin
        editor: 25, // New theme role
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.member).toBe(5)
    expect(result.hierarchy.superadmin).toBe(90)
    expect(result.hierarchy.editor).toBe(25)
    expect(result.hierarchy.developer).toBe(100) // Never changes
  })

  // AC10: Theme can set defaultRole
  it('should allow overriding defaultRole', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      defaultRole: 'editor',
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.defaultRole).toBe('editor')
  })

  it('should allow theme defaultRole to be any valid role', () => {
    // Test with core role
    const themeConfigCore: ThemeRolesConfig = {
      defaultRole: 'superadmin',
    }

    const resultCore = mergeRolesConfig(mockCoreConfig, themeConfigCore)
    expect(resultCore.defaultRole).toBe('superadmin')

    // Test with theme role
    const themeConfigCustom: ThemeRolesConfig = {
      additionalRoles: ['moderator'],
      defaultRole: 'moderator',
    }

    const resultCustom = mergeRolesConfig(mockCoreConfig, themeConfigCustom)
    expect(resultCustom.defaultRole).toBe('moderator')
  })
})

// =============================================================================
// DESCRIBE: Validation & Warnings (AC11-14)
// =============================================================================

describe('Validation & Warnings', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // AC11: Role collision warning
  it('should warn and ignore when additionalRoles contains core role name', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'member', 'moderator'], // 'member' is core
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    // Only non-core roles added
    expect(result.availableRoles).toContain('editor')
    expect(result.availableRoles).toContain('moderator')
    expect(result.availableRoles.length).toBe(5) // 3 core + 2 theme (not 6)

    // Warning was triggered
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to add core role "member"')
    )
  })

  // AC12: Hierarchy >= 100 warning
  it('should warn when capping hierarchy >= 100 to 99', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['admin'],
      hierarchy: {
        admin: 100,
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.admin).toBe(99)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Non-developer roles cannot have hierarchy >= 100')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Capping to 99')
    )
  })

  // AC13: Missing hierarchy warning
  it('should warn and default to 1 when role missing hierarchy', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'moderator'],
      hierarchy: {
        // Only define editor, moderator missing
        editor: 25,
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.hierarchy.moderator).toBe(1)
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Role "moderator" is missing hierarchy value')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Defaulting to 1')
    )
  })

  // AC14: Invalid defaultRole warning
  it('should warn and fallback to member when defaultRole invalid', () => {
    const themeConfig: ThemeRolesConfig = {
      defaultRole: 'nonexistent', // Role doesn't exist
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.defaultRole).toBe('member')
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme defaultRole "nonexistent" does not exist')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Falling back to "member"')
    )
  })
})

// =============================================================================
// DESCRIBE: Type Helpers (AC15-18)
// =============================================================================

describe('Type Helpers', () => {
  // Note: We need to mock USER_ROLES_CONFIG since type helpers depend on it
  // For this test, we'll test the helpers with a real merged config

  // AC17: isCoreRole identifies core roles
  it('isCoreRole should return true for core roles', () => {
    // TypeScript will enforce that these are valid UserRole values
    // but at runtime we can test the function behavior
    expect(isCoreRole('member' as any)).toBe(true)
    expect(isCoreRole('superadmin' as any)).toBe(true)
    expect(isCoreRole('developer' as any)).toBe(true)
  })

  // AC17: isCoreRole identifies non-core roles
  it('isCoreRole should return false for theme roles', () => {
    // These would be theme roles if they existed
    expect(isCoreRole('editor' as any)).toBe(false)
    expect(isCoreRole('moderator' as any)).toBe(false)
    expect(isCoreRole('admin' as any)).toBe(false)
  })

  // AC18: isThemeRole identifies theme roles
  it('isThemeRole should return true for theme roles', () => {
    expect(isThemeRole('editor' as any)).toBe(true)
    expect(isThemeRole('moderator' as any)).toBe(true)
    expect(isThemeRole('admin' as any)).toBe(true)
  })

  // AC18: isThemeRole identifies core roles
  it('isThemeRole should return false for core roles', () => {
    expect(isThemeRole('member' as any)).toBe(false)
    expect(isThemeRole('superadmin' as any)).toBe(false)
    expect(isThemeRole('developer' as any)).toBe(false)
  })
})

// =============================================================================
// DESCRIBE: Backwards Compatibility (AC19-21)
// =============================================================================

describe('Backwards Compatibility', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  // AC19: Works without theme config
  it('should work when theme has no userRoles override', () => {
    const result = mergeRolesConfig(mockCoreConfig, undefined)

    expect(result.availableRoles).toEqual(['member', 'superadmin', 'developer'])
    expect(result.defaultRole).toBe('member')
    expect(result.hierarchy).toEqual({
      member: 1,
      superadmin: 99,
      developer: 100,
    })
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  // AC19: Works with empty theme config
  it('should work when theme provides empty userRoles object', () => {
    const emptyThemeConfig: ThemeRolesConfig = {}

    const result = mergeRolesConfig(mockCoreConfig, emptyThemeConfig)

    expect(result.availableRoles).toEqual(['member', 'superadmin', 'developer'])
    expect(result.defaultRole).toBe('member')
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  // AC20 & AC21: Preserve core role properties
  it('should preserve all core role properties when no theme override', () => {
    const result = mergeRolesConfig(mockCoreConfig)

    // All core properties intact
    expect(result.coreRoles).toEqual(['member', 'superadmin', 'developer'])
    expect(result.availableRoles).toEqual(['member', 'superadmin', 'developer'])
    expect(result.defaultRole).toBe('member')

    expect(result.hierarchy).toEqual({
      member: 1,
      superadmin: 99,
      developer: 100,
    })

    expect(result.displayNames).toEqual({
      member: 'common.userRoles.member',
      superadmin: 'common.userRoles.superadmin',
      developer: 'common.userRoles.developer',
    })

    expect(result.descriptions).toEqual({
      member: 'Regular user with basic access',
      superadmin: 'Full system access and configuration',
      developer: 'Platform developer with ultimate access',
    })
  })

  // AC20 & AC21: Core properties remain even with theme additions
  it('should preserve core role properties when theme adds new roles', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      hierarchy: { editor: 25 },
      displayNames: { editor: 'custom.editor' },
      descriptions: { editor: 'Content editor' },
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    // Core roles unchanged
    expect(result.hierarchy.member).toBe(1)
    expect(result.hierarchy.superadmin).toBe(99)
    expect(result.hierarchy.developer).toBe(100)

    expect(result.displayNames.member).toBe('common.userRoles.member')
    expect(result.descriptions.developer).toBe('Platform developer with ultimate access')

    // Theme role added
    expect(result.availableRoles).toContain('editor')
    expect(result.hierarchy.editor).toBe(25)
  })
})

// =============================================================================
// DESCRIBE: Edge Cases & Integration Tests
// =============================================================================

describe('Edge Cases & Integration', () => {
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  it('should handle complex theme config with multiple features', () => {
    const complexThemeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'moderator', 'contributor'],
      defaultRole: 'contributor',
      hierarchy: {
        member: 5, // Override core
        editor: 30,
        moderator: 50,
        contributor: 10,
      },
      displayNames: {
        member: 'custom.member',
        editor: 'custom.editor',
        moderator: 'custom.moderator',
        contributor: 'custom.contributor',
      },
      descriptions: {
        editor: 'Can edit content',
        moderator: 'Can moderate content',
        contributor: 'Can contribute content',
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, complexThemeConfig)

    // All roles present
    expect(result.availableRoles).toEqual([
      'member',
      'superadmin',
      'developer',
      'editor',
      'moderator',
      'contributor',
    ])

    // DefaultRole overridden
    expect(result.defaultRole).toBe('contributor')

    // Hierarchy merged correctly
    expect(result.hierarchy.member).toBe(5)
    expect(result.hierarchy.developer).toBe(100)
    expect(result.hierarchy.editor).toBe(30)

    // DisplayNames merged
    expect(result.displayNames.member).toBe('custom.member')
    expect(result.displayNames.editor).toBe('custom.editor')

    // Descriptions merged
    expect(result.descriptions.moderator).toBe('Can moderate content')

    // No warnings (valid config)
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should handle empty additionalRoles array', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: [],
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    expect(result.availableRoles).toEqual(['member', 'superadmin', 'developer'])
    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('should handle multiple validation issues at once', () => {
    const problematicConfig: ThemeRolesConfig = {
      additionalRoles: ['editor', 'member'], // 'member' is core (collision)
      defaultRole: 'nonexistent', // Invalid defaultRole
      hierarchy: {
        editor: 100, // Should be capped to 99
        developer: 50, // Should be forced to 100
        // 'member' missing hierarchy (should default to 1... but it's core so already has it)
      },
    }

    const result = mergeRolesConfig(mockCoreConfig, problematicConfig)

    // Validations applied
    expect(result.availableRoles).toContain('editor')
    expect(result.availableRoles).not.toContain('nonexistent')
    expect(result.defaultRole).toBe('member') // Fallback
    expect(result.hierarchy.editor).toBe(99) // Capped
    expect(result.hierarchy.developer).toBe(100) // Forced

    // Multiple warnings triggered
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to add core role "member"')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to set developer hierarchy to 50')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme attempted to set "editor" hierarchy to 100')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Theme defaultRole "nonexistent" does not exist')
    )
  })

  it('should preserve coreRoles array immutability', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
    }

    const result = mergeRolesConfig(mockCoreConfig, themeConfig)

    // coreRoles should be the same reference (immutable)
    expect(result.coreRoles).toBe(mockCoreConfig.coreRoles)

    // availableRoles should be a new array
    expect(result.availableRoles).not.toBe(mockCoreConfig.availableRoles)
  })

  it('should not mutate input configs', () => {
    const themeConfig: ThemeRolesConfig = {
      additionalRoles: ['editor'],
      hierarchy: { editor: 25 },
    }

    const themeConfigCopy = JSON.parse(JSON.stringify(themeConfig))
    const coreConfigCopy = JSON.parse(JSON.stringify(mockCoreConfig))

    mergeRolesConfig(mockCoreConfig, themeConfig)

    // Inputs unchanged
    expect(mockCoreConfig).toEqual(coreConfigCopy)
    expect(themeConfig).toEqual(themeConfigCopy)
  })
})
