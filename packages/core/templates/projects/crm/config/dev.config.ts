/**
 * CRM Theme - Development Configuration
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
   * DevKeyring - Quick login for CRM theme (single-tenant mode)
   * Test different department roles in one organization
   */
  devKeyring: {
    enabled: true,
    users: [
      {
        id: 'roberto',
        email: 'crm_owner_roberto@nextspark.dev',
        name: 'Roberto Martinez',
        password: 'Test1234',
        teamRoles: 'Ventas Pro S.A. (owner) - CEO',
      },
      {
        id: 'sofia',
        email: 'crm_admin_sofia@nextspark.dev',
        name: 'Sofia Gomez',
        password: 'Test1234',
        teamRoles: 'Ventas Pro S.A. (admin) - Sales Manager',
      },
      {
        id: 'miguel',
        email: 'crm_member_miguel@nextspark.dev',
        name: 'Miguel Castro',
        password: 'Test1234',
        teamRoles: 'Ventas Pro S.A. (member) - Sales Rep',
      },
      {
        id: 'laura',
        email: 'crm_member_laura@nextspark.dev',
        name: 'Laura Vega',
        password: 'Test1234',
        teamRoles: 'Ventas Pro S.A. (member) - Marketing',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
