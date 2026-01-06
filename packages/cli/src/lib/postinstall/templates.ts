import { existsSync, cpSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import chalk from 'chalk'
import type { PostinstallContext } from '../../types/nextspark-package.js'

interface TemplateConfig {
  from: string
  to: string
  condition?: 'exists' | '!exists' | 'always' | 'prompt'
  description?: string
}

export async function processTemplates(
  templates: TemplateConfig[],
  sourcePath: string,
  context: PostinstallContext
): Promise<void> {
  for (const template of templates) {
    const from = join(sourcePath, template.from)
    const to = resolveVariables(template.to, context)

    if (!existsSync(from)) {
      console.log(chalk.yellow(`  Warning: Template source not found: ${template.from}`))
      continue
    }

    const targetExists = existsSync(to)
    const condition = template.condition || '!exists'
    const desc = template.description || template.to

    switch (condition) {
      case '!exists':
        if (targetExists) {
          console.log(chalk.gray(`  Skipping ${desc} (already exists)`))
          continue
        }
        break

      case 'exists':
        if (!targetExists) {
          console.log(chalk.gray(`  Skipping ${desc} (target doesn't exist)`))
          continue
        }
        break

      case 'prompt':
        if (targetExists) {
          // For now, skip if exists when prompting not implemented
          console.log(chalk.gray(`  Skipping ${desc} (already exists, use --force to overwrite)`))
          continue
        }
        break

      case 'always':
        break
    }

    const parentDir = dirname(to)
    if (!existsSync(parentDir)) {
      mkdirSync(parentDir, { recursive: true })
    }

    console.log(chalk.gray(`  Copying ${desc}...`))
    cpSync(from, to, { recursive: true })
  }
}

function resolveVariables(path: string, context: PostinstallContext): string {
  let resolved = path

  if (context.activeTheme) {
    resolved = resolved.replace(/\$\{activeTheme\}/g, context.activeTheme)
  }
  resolved = resolved.replace(/\$\{projectRoot\}/g, context.projectRoot)
  resolved = resolved.replace(/\$\{timestamp\}/g, context.timestamp.toString())
  resolved = resolved.replace(/\$\{coreVersion\}/g, context.coreVersion)

  if (context.pluginName) {
    resolved = resolved.replace(/\$\{pluginName\}/g, context.pluginName)
  }
  if (context.themeName) {
    resolved = resolved.replace(/\$\{themeName\}/g, context.themeName)
  }

  const unresolvedMatch = resolved.match(/\$\{([^}]+)\}/)
  if (unresolvedMatch) {
    throw new Error(`Unresolved template variable: ${unresolvedMatch[0]}`)
  }

  if (!resolved.startsWith('/')) {
    resolved = join(context.projectRoot, resolved)
  }

  return resolved
}
