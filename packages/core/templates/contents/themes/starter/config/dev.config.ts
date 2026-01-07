/**
 * Starter Theme - Development Configuration
 *
 * This file contains development-only settings that should never affect production.
 * Settings like DevKeyring are only rendered in non-production environments.
 *
 * @see core/lib/config/types.ts for DevConfig interface
 */

import type { DevConfig } from '@nextsparkjs/core/lib/config/types'

export const DEV_CONFIG_OVERRIDES: DevConfig = {
  // =============================================================================
  // DEV KEYRING (Development/QA Only)
  // =============================================================================
  /**
   * DevKeyring - Quick login users for development and testing
   *
   * These users should match entries in your sample data migrations.
   * The component is only rendered in non-production environments.
   *
   * User structure:
   * - id: Unique identifier for the user button
   * - email: User's email address (must exist in database)
   * - name: Display name shown in the keyring
   * - password: Password for auto-fill
   * - teamRoles: Description of team memberships (for reference)
   */
  devKeyring: {
    enabled: true,
    users: [
      // ========================================
      // STARTER THEME - INITIAL USERS ONLY
      // These are the only users that exist after init.
      // Additional users are created via sample data migrations.
      // ========================================
      {
        id: 'superadmin',
        email: 'superadmin@nextspark.dev',
        name: 'Super Admin',
        password: 'Pandora1234',
        teamRoles: 'Initial Team (owner) - SUPERADMIN ROLE',
      },
      {
        id: 'developer',
        email: 'developer@nextspark.dev',
        name: 'Developer',
        password: 'Pandora1234',
        teamRoles: 'Initial Team (admin) - DEVELOPER ROLE',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
