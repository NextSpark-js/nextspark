/**
 * Granular Protected Paths Configuration
 *
 * Three-level protection system for fine-grained theme override control:
 * - PROTECTED_ALL: Blocks both component and metadata overrides (maximum security)
 * - PROTECTED_RENDER: Allows metadata overrides, blocks component overrides (logic protection)
 * - PROTECTED_METADATA: Allows component overrides, blocks metadata overrides (brand consistency)
 *
 * SECURITY ARCHITECTURE:
 * - Authentication layouts use PROTECTED_RENDER (allow branding, protect auth logic)
 * - Core security boundaries use PROTECTED_ALL (complete protection)
 * - Brand-critical layouts use PROTECTED_METADATA (consistent messaging)
 */

export const ProtectionLevel = {
  NONE: 'none',                           // No protection - fully overrideable
  PROTECTED_METADATA: 'protected_metadata',  // Component overrideable, metadata protected
  PROTECTED_RENDER: 'protected_render',      // Metadata overrideable, component protected
  PROTECTED_ALL: 'protected_all'             // Nothing overrideable - full protection
} as const

export type ProtectionLevel = typeof ProtectionLevel[keyof typeof ProtectionLevel]

export const PROTECTED_PATHS = {
  // Root layout - Allow theme metadata (branding), protect render logic (auth/providers)
  'app/layout.tsx': ProtectionLevel.PROTECTED_RENDER,

  // Dashboard auth boundary - Complete protection for security
  'app/dashboard/layout.tsx': ProtectionLevel.PROTECTED_ALL,

  // Future examples for different protection levels:
  // 'app/(admin)/layout.tsx': ProtectionLevel.PROTECTED_ALL,        // Admin layouts fully protected
  // 'app/(public)/layout.tsx': ProtectionLevel.PROTECTED_METADATA,  // Allow UI changes, keep branding
  // 'app/api/auth/': ProtectionLevel.PROTECTED_ALL,                 // API routes (directory pattern)
} as const

export type ProtectedPath = keyof typeof PROTECTED_PATHS

/**
 * Get protection level for a specific path
 * @param appPath - The app path to check
 * @returns Protection level or NONE if not protected
 */
export function getProtectionLevel(appPath: string): ProtectionLevel {
  // Direct path match
  if (appPath in PROTECTED_PATHS) {
    return PROTECTED_PATHS[appPath as ProtectedPath]
  }

  // Directory pattern matching (for API routes ending with '/')
  for (const [protectedPath, level] of Object.entries(PROTECTED_PATHS)) {
    if (protectedPath.endsWith('/') && appPath.startsWith(protectedPath)) {
      return level as ProtectionLevel
    }
  }

  return ProtectionLevel.NONE
}

/**
 * Check if a template path is protected from ANY override
 * @param appPath - The app path that would be overridden
 * @returns True if the path has any protection level
 */
export function isProtectedPath(appPath: string): boolean {
  return getProtectionLevel(appPath) !== ProtectionLevel.NONE
}

/**
 * Check if component override is allowed
 * @param appPath - The app path to check
 * @returns True if component can be overridden
 */
export function canOverrideComponent(appPath: string): boolean {
  const level = getProtectionLevel(appPath)
  return level === ProtectionLevel.NONE || level === ProtectionLevel.PROTECTED_METADATA
}

/**
 * Check if metadata override is allowed
 * @param appPath - The app path to check
 * @returns True if metadata can be overridden
 */
export function canOverrideMetadata(appPath: string): boolean {
  const level = getProtectionLevel(appPath)
  return level === ProtectionLevel.NONE || level === ProtectionLevel.PROTECTED_RENDER
}

/**
 * Get human-readable protection description
 * @param appPath - The app path to describe
 * @returns Description of protection level
 */
export function getProtectionDescription(appPath: string): string {
  const level = getProtectionLevel(appPath)

  switch (level) {
    case ProtectionLevel.NONE:
      return 'No protection - fully overrideable'
    case ProtectionLevel.PROTECTED_METADATA:
      return 'Component overrideable, metadata protected'
    case ProtectionLevel.PROTECTED_RENDER:
      return 'Metadata overrideable, component protected'
    case ProtectionLevel.PROTECTED_ALL:
      return 'Fully protected - no overrides allowed'
    default:
      return 'Unknown protection level'
  }
}

/**
 * Get all protected paths with their levels
 */
export function getAllProtectedPaths(): Record<string, ProtectionLevel> {
  return { ...PROTECTED_PATHS }
}

/**
 * Legacy compatibility - returns paths with ANY protection level
 */
export function getProtectedPathsList(): string[] {
  return Object.keys(PROTECTED_PATHS)
}