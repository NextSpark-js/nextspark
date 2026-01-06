/**
 * Content Features Configuration Prompts (Step 6)
 *
 * Collects optional content features: Pages with Page Builder and Blog.
 */

import { checkbox } from '@inquirer/prompts'
import { showSection, showInfo } from '../banner.js'
import type { WizardConfig, ContentFeaturesConfig, WizardMode } from '../types.js'

/**
 * Content feature options with descriptions
 */
const CONTENT_FEATURE_OPTIONS = [
  {
    name: 'Pages with Page Builder',
    value: 'pages',
    description: "Adds the 'page' entity with full page builder support. Build custom pages using blocks.",
    checked: false,
  },
  {
    name: 'Blog',
    value: 'blog',
    description: "Adds the 'post' entity for blog articles with the Post Content block for rich editorial content.",
    checked: false,
  },
]

/**
 * Get default content features configuration
 */
export function getDefaultContentFeaturesConfig(): ContentFeaturesConfig {
  return {
    pages: false,
    blog: false,
  }
}

/**
 * Run content features configuration prompts
 */
export async function promptContentFeaturesConfig(
  mode: WizardMode = 'interactive',
  totalSteps: number = 9
): Promise<Pick<WizardConfig, 'contentFeatures'>> {
  showSection('Content Features', 6, totalSteps)

  showInfo('Enable optional content features for your project.')
  showInfo('These features add entities and blocks for building pages and blog posts.')
  console.log('')

  // Select content features
  const selectedFeatures = await checkbox({
    message: 'Which content features do you want to enable?',
    choices: CONTENT_FEATURE_OPTIONS,
  })

  console.log('')
  showInfo('You can add more blocks later in contents/themes/[your-theme]/blocks/')

  // Convert to content features config object
  const contentFeatures: ContentFeaturesConfig = {
    pages: selectedFeatures.includes('pages'),
    blog: selectedFeatures.includes('blog'),
  }

  return {
    contentFeatures,
  }
}
