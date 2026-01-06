/**
 * Dashboard Configuration Prompts (Step 7)
 *
 * Collects dashboard UI preferences and layout options.
 */

import { checkbox, confirm } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, DashboardConfig, WizardMode } from '../types.js'

/**
 * Dashboard feature options
 */
const DASHBOARD_FEATURE_OPTIONS = [
  {
    name: 'Global Search',
    value: 'search',
    description: 'Search across your application from the dashboard',
    checked: false,
  },
  {
    name: 'Notifications',
    value: 'notifications',
    description: 'In-app notification system with bell icon',
    checked: false,
  },
  {
    name: 'Theme Toggle',
    value: 'themeToggle',
    description: 'Allow users to switch between light and dark themes',
    checked: true,
  },
  {
    name: 'Support/Help Menu',
    value: 'support',
    description: 'Help dropdown with documentation and support links',
    checked: true,
  },
  {
    name: 'Quick Create',
    value: 'quickCreate',
    description: 'Quick create button for creating new entities',
    checked: true,
  },
  {
    name: 'Superadmin Access',
    value: 'superadminAccess',
    description: 'Button to access superadmin area (only visible to superadmins)',
    checked: true,
  },
  {
    name: 'DevTools Access',
    value: 'devtoolsAccess',
    description: 'Button to access developer tools (only visible to developers)',
    checked: true,
  },
]

/**
 * Get default dashboard configuration
 */
export function getDefaultDashboardConfig(): DashboardConfig {
  return {
    search: false,
    notifications: false,
    themeToggle: true,
    support: true,
    quickCreate: true,
    superadminAccess: true,
    devtoolsAccess: true,
    sidebarCollapsed: false,
  }
}

/**
 * Run dashboard configuration prompts
 */
export async function promptDashboardConfig(
  mode: WizardMode = 'interactive',
  totalSteps: number = 8
): Promise<Pick<WizardConfig, 'dashboard'>> {
  showSection('Dashboard', 7, totalSteps)

  showInfo('Configure your dashboard user interface.')
  showInfo('These settings can be changed later in your theme config.')
  console.log('')

  // Select dashboard features
  const selectedFeatures = await checkbox({
    message: 'Which dashboard features do you want to enable?',
    choices: DASHBOARD_FEATURE_OPTIONS,
  })

  // In expert mode, ask about sidebar default state
  let sidebarCollapsed = false

  if (mode === 'expert') {
    console.log('')
    sidebarCollapsed = await confirm({
      message: 'Start with sidebar collapsed by default?',
      default: false,
    })
  }

  const dashboard: DashboardConfig = {
    search: selectedFeatures.includes('search'),
    notifications: selectedFeatures.includes('notifications'),
    themeToggle: selectedFeatures.includes('themeToggle'),
    support: selectedFeatures.includes('support'),
    quickCreate: selectedFeatures.includes('quickCreate'),
    superadminAccess: selectedFeatures.includes('superadminAccess'),
    devtoolsAccess: selectedFeatures.includes('devtoolsAccess'),
    sidebarCollapsed,
  }

  return { dashboard }
}
