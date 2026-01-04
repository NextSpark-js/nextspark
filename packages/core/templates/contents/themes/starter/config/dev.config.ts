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
      // STARTER THEME TEST USERS
      // ========================================
      {
        id: 'superadmin',
        email: 'superadmin@starter.dev',
        name: 'Super Admin',
        password: 'Test1234',
        teamRoles: 'Starter Team (owner) - SUPERADMIN ROLE',
      },
      {
        id: 'developer',
        email: 'developer@starter.dev',
        name: 'Developer',
        password: 'Test1234',
        teamRoles: 'Starter Team (admin) - DEVELOPER ROLE',
      },
      {
        id: 'owner',
        email: 'owner@starter.dev',
        name: 'Team Owner',
        password: 'Test1234',
        teamRoles: 'Starter Team (owner)',
      },
      {
        id: 'admin',
        email: 'admin@starter.dev',
        name: 'Team Admin',
        password: 'Test1234',
        teamRoles: 'Starter Team (admin)',
      },
      {
        id: 'member',
        email: 'member@starter.dev',
        name: 'Team Member',
        password: 'Test1234',
        teamRoles: 'Starter Team (member)',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
