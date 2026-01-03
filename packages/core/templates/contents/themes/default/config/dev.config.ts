/**
 * Default Theme - Development Configuration
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
   * DevKeyring - Quick login for Default theme (multi-tenant mode)
   *
   * CORE USERS (from core/migrations/090_sample_data.sql):
   * - superadmin@nextspark.dev (superadmin role) - TMT team owner
   * - developer@nextspark.dev (developer role) - TMT team admin
   *
   * DEMO USERS (from theme/migrations/090_demo_users_teams.sql):
   * - Everpoint Labs (Technology) - Carlos (owner), James (admin), Diego & Emily (members)
   * - Ironvale Global (Consulting) - Ana (owner), Sofia (admin), Michael (member), Sarah (viewer)
   * - Riverstone Ventures (Investment) - Sofia (owner), Emily (admin), Carlos (member)
   */
  devKeyring: {
    enabled: true,
    users: [
      // ========================================
      // DEMO USERS (TMT.dev)
      // ========================================
      {
        id: 'carlos',
        email: 'carlos.mendoza@nextspark.dev',
        name: 'Carlos Mendoza',
        password: 'Test1234',
        teamRoles: 'Everpoint Labs (owner), Riverstone (member)',
      },
      {
        id: 'james',
        email: 'james.wilson@nextspark.dev',
        name: 'James Wilson',
        password: 'Test1234',
        teamRoles: 'Everpoint Labs (admin)',
      },
      {
        id: 'ana',
        email: 'ana.garcia@nextspark.dev',
        name: 'Ana García',
        password: 'Test1234',
        teamRoles: 'Ironvale Global (owner)',
      },
      {
        id: 'sofia',
        email: 'sofia.lopez@nextspark.dev',
        name: 'Sofia López',
        password: 'Test1234',
        teamRoles: 'Riverstone (owner), Ironvale (admin)',
      },
      {
        id: 'diego',
        email: 'diego.ramirez@nextspark.dev',
        name: 'Diego Ramírez',
        password: 'Test1234',
        teamRoles: 'Everpoint Labs (editor)',
      },
      {
        id: 'emily',
        email: 'emily.johnson@nextspark.dev',
        name: 'Emily Johnson',
        password: 'Test1234',
        teamRoles: 'Everpoint (member), Riverstone (admin)',
      },
      {
        id: 'sarah',
        email: 'sarah.davis@nextspark.dev',
        name: 'Sarah Davis',
        password: 'Test1234',
        teamRoles: 'Ironvale Global (viewer)',
      },
      // ========================================
      // CORE USERS (superadmin & developer)
      // ========================================
      {
        id: 'superadmin',
        email: 'superadmin@nextspark.dev',
        name: 'Super Admin',
        password: 'Pandora1234',
        teamRoles: 'TMT (owner) - SUPERADMIN ROLE',
      },
      {
        id: 'developer',
        email: 'developer@nextspark.dev',
        name: 'Developer',
        password: 'Pandora1234',
        teamRoles: 'TMT (admin) - DEVELOPER ROLE',
      },
    ],
  },
}

export default DEV_CONFIG_OVERRIDES
