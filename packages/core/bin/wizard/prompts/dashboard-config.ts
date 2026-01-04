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
    checked: true,
  },
  {
    name: 'Notifications',
    value: 'notifications',
    description: 'In-app notification system with bell icon',
    checked: true,
  },
  {
    name: 'Theme Toggle',
    value: 'themeToggle',
    description: 'Allow users to switch between light and dark themes',
    checked: true,
  },
]

/**
 * Get default dashboard configuration
 */
export function getDefaultDashboardConfig(): DashboardConfig {
  return {
    search: true,
    notifications: true,
    themeToggle: true,
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
    sidebarCollapsed,
  }

  // Show info about more options
  console.log('')
  showInfo('More options available in dashboard.config.ts: support, superadmin access, devtools, quick create')

  return { dashboard }
}
