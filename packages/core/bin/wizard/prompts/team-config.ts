/**
 * Team Configuration Prompts (Step 2)
 *
 * Collects team mode and role configuration.
 */

import { select, checkbox } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, TeamMode } from '../types.js'
import { DEFAULT_ROLES } from '../types.js'

/**
 * Team mode options with descriptions
 */
const TEAM_MODE_OPTIONS = [
  {
    name: 'Multi-tenant (Multiple teams, team switching)',
    value: 'multi-tenant' as TeamMode,
    description: 'Users can create and join multiple teams. Perfect for CRM, project management, or collaboration tools.',
  },
  {
    name: 'Single-tenant (One organization, no switching)',
    value: 'single-tenant' as TeamMode,
    description: 'All users belong to one organization. Ideal for internal tools or company-specific applications.',
  },
  {
    name: 'Single-user (Personal app, no teams)',
    value: 'single-user' as TeamMode,
    description: 'Individual user accounts without team features. Perfect for personal dashboards or blogs.',
  },
]

/**
 * Role options with descriptions
 */
const ROLE_OPTIONS = [
  { name: 'Owner (Full control, can delete team)', value: 'owner', checked: true },
  { name: 'Admin (Can manage members and settings)', value: 'admin', checked: true },
  { name: 'Member (Standard access)', value: 'member', checked: true },
  { name: 'Viewer (Read-only access)', value: 'viewer', checked: true },
]

/**
 * Run team configuration prompts
 */
export async function promptTeamConfig(): Promise<Pick<WizardConfig, 'teamMode' | 'teamRoles'>> {
  showSection('Team Configuration', 2, 5)

  // Select team mode
  const teamMode = await select({
    message: 'What team mode do you need?',
    choices: TEAM_MODE_OPTIONS,
    default: 'multi-tenant',
  })

  // Show info about selected mode
  const selectedOption = TEAM_MODE_OPTIONS.find(o => o.value === teamMode)
  if (selectedOption) {
    showInfo(selectedOption.description)
  }

  // Only ask for roles if not single-user mode
  let teamRoles: string[] = DEFAULT_ROLES

  if (teamMode !== 'single-user') {
    console.log('')
    teamRoles = await checkbox({
      message: 'Which roles do you want to include?',
      choices: ROLE_OPTIONS,
      required: true,
    })

    // Ensure owner is always included
    if (!teamRoles.includes('owner')) {
      teamRoles = ['owner', ...teamRoles]
      showInfo('Owner role is required and has been added automatically.')
    }
  }

  return {
    teamMode,
    teamRoles,
  }
}
