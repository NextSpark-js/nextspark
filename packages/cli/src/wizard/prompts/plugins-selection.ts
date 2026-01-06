/**
 * Plugins Selection Prompt
 *
 * Asks the user which additional plugins they want to install.
 * Some plugins may be required by the selected theme and will be pre-selected.
 */

import { checkbox } from '@inquirer/prompts'
import chalk from 'chalk'
import type { ThemeChoice } from './theme-selection.js'

export type PluginChoice = 'ai' | 'langchain' | 'social-media-publisher'

/**
 * Plugins required by each theme
 * These will be pre-selected and marked as required
 */
const THEME_REQUIRED_PLUGINS: Record<string, PluginChoice[]> = {
  'default': ['langchain'],
  'blog': [],
  'crm': [],
  'productivity': [],
}

/**
 * Prompt the user to select additional plugins
 *
 * @param selectedTheme - The theme selected by the user (to show required plugins)
 * @returns Array of selected plugin choices
 */
export async function promptPluginsSelection(
  selectedTheme: ThemeChoice
): Promise<PluginChoice[]> {
  const requiredPlugins = selectedTheme
    ? THEME_REQUIRED_PLUGINS[selectedTheme] || []
    : []

  console.log('')
  console.log(chalk.cyan('  Plugin Selection'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))

  if (requiredPlugins.length > 0) {
    console.log('')
    console.log(chalk.gray(`  Note: ${requiredPlugins.join(', ')} will be installed (required by theme)`))
  }
  console.log('')

  const plugins = await checkbox<PluginChoice>({
    message: 'Select plugins to install (Enter to skip, Space to select):',
    choices: [
      {
        name: 'AI',
        value: 'ai',
        description: 'AI SDK with OpenAI, Anthropic, Ollama support',
        checked: false,
      },
      {
        name: 'LangChain',
        value: 'langchain',
        description: 'AI agents, chains, and advanced AI features',
        checked: requiredPlugins.includes('langchain'),
        disabled: requiredPlugins.includes('langchain') ? '(required by theme)' : false,
      },
      {
        name: 'Social Media Publisher',
        value: 'social-media-publisher',
        description: 'Multi-platform social media publishing',
        checked: false,
      },
    ],
  })

  // Merge with required plugins (ensure no duplicates)
  const allPlugins = [...new Set([...requiredPlugins, ...plugins])]
  return allPlugins
}

/**
 * Get the list of required plugins for a theme
 */
export function getRequiredPlugins(theme: ThemeChoice): PluginChoice[] {
  if (!theme) return []
  return THEME_REQUIRED_PLUGINS[theme] || []
}
