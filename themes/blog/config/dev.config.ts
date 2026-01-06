/**
 * Blog Theme - Development Configuration
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
   * DevKeyring - Quick login for Blog theme (multi-author mode)
   * 3 sample authors with different niches
   */
  devKeyring: {
    enabled: true,
    users: [
      {
        id: 'marcos',
        email: 'blog_author_marcos@nextspark.dev',
        name: 'Marcos Tech',
        password: 'Test1234',
        teamRoles: 'Marcos Tech Blog (owner)',
      },
      {
        id: 'lucia',
        email: 'blog_author_lucia@nextspark.dev',
        name: 'Lucia Lifestyle',
        password: 'Test1234',
        teamRoles: 'Lucia Lifestyle Blog (owner)',
      },
      {
        id: 'carlos',
        email: 'blog_author_carlos@nextspark.dev',
        name: 'Carlos Finance',
        password: 'Test1234',
        teamRoles: 'Carlos Finance Blog (owner)',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
