import chalk from 'chalk'
import type { NextSparkPackageJson, PostinstallContext } from '../../types/nextspark-package.js'
import { processTemplates } from './templates.js'
import { processEnvVars } from './env-vars.js'
import { registerMigrations } from './migrations.js'
import { runCustomScript } from './script-runner.js'
import { existsSync } from 'fs'
import { join } from 'path'

export async function runPostinstall(
  packageJson: NextSparkPackageJson,
  installedPath: string,
  context: PostinstallContext
): Promise<void> {
  const postinstall = packageJson.nextspark?.postinstall
  if (!postinstall) {
    return
  }

  console.log(chalk.blue('\n  Running postinstall hooks...'))

  // 1. Instalar plugins requeridos (con tracking para evitar loops)
  if (postinstall.requiredPlugins?.length) {
    for (const plugin of postinstall.requiredPlugins) {
      // Evitar recursion infinita
      if (context.installingPlugins.has(plugin)) {
        console.log(chalk.yellow(`  Skipping ${plugin} (already being installed)`))
        continue
      }

      const pluginExists = await checkPluginExists(plugin)
      if (!pluginExists) {
        console.log(`  Installing required plugin: ${plugin}`)
        context.installingPlugins.add(plugin)

        // Importar dinamicamente para evitar dependencia circular
        const { addPlugin } = await import('../../commands/add-plugin.js')
        await addPlugin(plugin, { installingPlugins: context.installingPlugins })
      }
    }
  }

  // 2. Procesar templates
  if (postinstall.templates?.length) {
    const needsTheme = postinstall.templates.some(t =>
      t.to.includes('${activeTheme}')
    )

    if (needsTheme && !context.activeTheme) {
      console.log(chalk.yellow('\n  Warning: Templates require an active theme but none detected.'))
      console.log(chalk.gray('  Set NEXT_PUBLIC_ACTIVE_THEME or install a theme first.'))
      console.log(chalk.gray('  Skipping template installation.\n'))
    } else {
      await processTemplates(postinstall.templates, installedPath, context)
    }
  }

  // 3. Variables de entorno
  if (postinstall.envVars?.length) {
    await processEnvVars(postinstall.envVars)
  }

  // 4. Migrations
  if (postinstall.migrations?.length) {
    await registerMigrations(postinstall.migrations, installedPath)
  }

  // 5. Script custom (CON CONFIRMACION)
  if (postinstall.script) {
    await runCustomScript(postinstall.script, installedPath, context)
  }

  // 6. Mensajes finales
  if (postinstall.messages) {
    console.log('')
    if (postinstall.messages.success) {
      console.log(chalk.green(`  ${postinstall.messages.success}`))
    }
    if (postinstall.messages.docs) {
      console.log(chalk.gray(`  Docs: ${postinstall.messages.docs}`))
    }
    if (postinstall.messages.nextSteps?.length) {
      console.log(chalk.blue('\n  Next steps:'))
      postinstall.messages.nextSteps.forEach((step, i) => {
        console.log(chalk.gray(`    ${i + 1}. ${step}`))
      })
    }
  }
}

async function checkPluginExists(pluginName: string): Promise<boolean> {
  const name = pluginName
    .replace(/^@[^/]+\//, '')
    .replace(/^nextspark-plugin-/, '')
    .replace(/^plugin-/, '')

  return existsSync(join(process.cwd(), 'contents', 'plugins', name))
}

export { PostinstallContext }
