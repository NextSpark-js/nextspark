import { existsSync, mkdirSync, cpSync } from 'fs'
import { join, basename } from 'path'
import chalk from 'chalk'

export async function registerMigrations(
  migrations: string[],
  installedPath: string
): Promise<void> {
  const migrationsDir = join(process.cwd(), 'migrations')

  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true })
  }

  let copied = 0

  for (const migration of migrations) {
    const sourcePath = join(installedPath, migration)

    if (!existsSync(sourcePath)) {
      console.log(chalk.yellow(`  Warning: Migration not found: ${migration}`))
      continue
    }

    const fileName = basename(migration)
    const targetPath = join(migrationsDir, fileName)

    if (existsSync(targetPath)) {
      console.log(chalk.gray(`  Migration ${fileName} already exists, skipping`))
      continue
    }

    cpSync(sourcePath, targetPath)
    copied++
  }

  if (copied > 0) {
    console.log(chalk.gray(`  Copied ${copied} migration(s) to /migrations`))
  }
}
