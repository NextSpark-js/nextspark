/**
 * Git Configuration Prompts
 *
 * Collects Git initialization and commit preferences.
 */

import { confirm, input } from '@inquirer/prompts'
import { showSection } from '../banner.js'

/**
 * Git setup answers from user prompts
 */
export interface GitSetupAnswers {
  initGit: boolean
  createCommit: boolean
  commitMessage?: string
}

/**
 * Validate commit message
 */
function validateCommitMessage(message: string): string | true {
  if (!message || message.trim().length === 0) {
    return 'Commit message is required'
  }
  if (message.trim().length < 5) {
    return 'Commit message must be at least 5 characters'
  }
  if (message.trim().length > 100) {
    return 'Commit message must be less than 100 characters'
  }
  return true
}

/**
 * Get default git setup answers (for quick mode)
 */
export function getDefaultGitSetupAnswers(): GitSetupAnswers {
  return {
    initGit: true,
    createCommit: true,
    commitMessage: 'Initial commit: NextSpark project setup',
  }
}

/**
 * Run git configuration prompts
 */
export async function promptGitSetup(): Promise<GitSetupAnswers> {
  showSection('Git Configuration', 9, 9)

  // Ask if user wants to initialize git
  const initGit = await confirm({
    message: 'Initialize a Git repository?',
    default: true,
  })

  if (!initGit) {
    return {
      initGit: false,
      createCommit: false,
    }
  }

  // Ask if user wants to create initial commit
  const createCommit = await confirm({
    message: 'Create an initial commit?',
    default: true,
  })

  if (!createCommit) {
    return {
      initGit: true,
      createCommit: false,
    }
  }

  // Get commit message
  const commitMessage = await input({
    message: 'Commit message:',
    default: 'Initial commit: NextSpark project setup',
    validate: validateCommitMessage,
  })

  return {
    initGit,
    createCommit,
    commitMessage,
  }
}
