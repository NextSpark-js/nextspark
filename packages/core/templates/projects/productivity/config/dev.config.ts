/**
 * Productivity Theme - Development Configuration
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
   * DevKeyring - Quick login for Productivity theme (multi-tenant mode)
   * Test different roles across multiple teams
   */
  devKeyring: {
    enabled: true,
    users: [
      {
        id: 'patricia',
        email: 'prod_owner_patricia@nextspark.dev',
        name: 'Patricia Torres',
        password: 'Test1234',
        teamRoles: 'Product Team (owner), Marketing Hub (owner)',
      },
      {
        id: 'lucas',
        email: 'prod_admin_member_lucas@nextspark.dev',
        name: 'Lucas Luna',
        password: 'Test1234',
        teamRoles: 'Product Team (admin), Marketing Hub (member)',
      },
      {
        id: 'diana',
        email: 'prod_member_diana@nextspark.dev',
        name: 'Diana Rios',
        password: 'Test1234',
        teamRoles: 'Product Team (member)',
      },
      {
        id: 'marcos',
        email: 'prod_member_marcos@nextspark.dev',
        name: 'Marcos Silva',
        password: 'Test1234',
        teamRoles: 'Marketing Hub (member)',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
