/**
 * Project Info Prompts (Step 1)
 *
 * Collects basic project information: name, slug, and description.
 */

import { input } from '@inquirer/prompts'
import { showSection } from '../banner.js'
import type { WizardConfig } from '../types.js'

/**
 * Convert a string to a URL-safe slug
 */
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Validate project name
 */
function validateProjectName(name: string): string | true {
  if (!name || name.trim().length === 0) {
    return 'Project name is required'
  }
  if (name.trim().length < 2) {
    return 'Project name must be at least 2 characters'
  }
  if (name.trim().length > 50) {
    return 'Project name must be less than 50 characters'
  }
  return true
}

/**
 * Validate slug format
 */
function validateSlug(slug: string): string | true {
  if (!slug || slug.trim().length === 0) {
    return 'Slug is required'
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slug)) {
    return 'Slug must start with a letter and contain only lowercase letters, numbers, and hyphens'
  }
  if (slug.length < 2) {
    return 'Slug must be at least 2 characters'
  }
  if (slug.length > 30) {
    return 'Slug must be less than 30 characters'
  }
  return true
}

/**
 * Run project info prompts
 */
export async function promptProjectInfo(): Promise<Pick<WizardConfig, 'projectName' | 'projectSlug' | 'projectDescription'>> {
  showSection('Project Information', 1, 10)

  // Get project name
  const projectName = await input({
    message: 'What is your project name?',
    default: 'My SaaS App',
    validate: validateProjectName,
  })

  // Get project slug (with auto-generated default)
  const suggestedSlug = toSlug(projectName)
  const projectSlug = await input({
    message: 'Project slug (used for theme folder and URLs):',
    default: suggestedSlug,
    validate: validateSlug,
  })

  // Get project description
  const projectDescription = await input({
    message: 'Short description of your project:',
    default: 'A modern SaaS application built with NextSpark',
  })

  return {
    projectName,
    projectSlug,
    projectDescription,
  }
}
