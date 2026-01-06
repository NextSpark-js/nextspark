import path from 'node:path'
import prompts from 'prompts'
import type { ProjectOptions } from '../create.js'

export async function getProjectOptions(
  projectName: string | undefined,
  skipPrompts: boolean
): Promise<ProjectOptions> {
  // If --yes flag is used with a project name, skip prompts
  if (skipPrompts && projectName) {
    return {
      projectName,
      projectPath: path.resolve(process.cwd(), projectName),
    }
  }

  // If no project name provided, prompt for it
  if (!projectName) {
    const response = await prompts(
      {
        type: 'text',
        name: 'projectName',
        message: 'What is your project named?',
        initial: 'my-nextspark-app',
        validate: (value: string) => {
          if (!value) return 'Project name is required'
          if (!/^[a-z0-9-]+$/.test(value)) {
            return 'Project name can only contain lowercase letters, numbers, and hyphens'
          }
          return true
        },
      },
      {
        onCancel: () => {
          throw new Error('PROMPT_CANCELLED')
        },
      }
    )

    projectName = response.projectName as string
  }

  return {
    projectName,
    projectPath: path.resolve(process.cwd(), projectName),
  }
}
