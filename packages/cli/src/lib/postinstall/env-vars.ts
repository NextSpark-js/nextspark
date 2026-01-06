import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import chalk from 'chalk'

interface EnvVarConfig {
  key: string
  description: string
  required: boolean
  default?: string
}

export async function processEnvVars(envVars: EnvVarConfig[]): Promise<void> {
  const envExamplePath = join(process.cwd(), '.env.example')
  const envPath = join(process.cwd(), '.env')

  let added = 0

  // Read existing vars to avoid duplicates
  const existingVars = new Set<string>()
  if (existsSync(envExamplePath)) {
    const content = readFileSync(envExamplePath, 'utf-8')
    const matches = content.match(/^[A-Z_][A-Z0-9_]*=/gm)
    if (matches) {
      matches.forEach(m => existingVars.add(m.replace('=', '')))
    }
  }

  const newLines: string[] = []

  for (const envVar of envVars) {
    if (existingVars.has(envVar.key)) {
      continue
    }

    const value = envVar.default || ''
    const requiredMark = envVar.required ? ' (required)' : ''
    newLines.push(`# ${envVar.description}${requiredMark}`)
    newLines.push(`${envVar.key}=${value}`)
    newLines.push('')
    added++
  }

  if (newLines.length > 0) {
    const content = '\n' + newLines.join('\n')

    if (existsSync(envExamplePath)) {
      appendFileSync(envExamplePath, content)
    } else {
      writeFileSync(envExamplePath, content.trim() + '\n')
    }

    console.log(chalk.gray(`  Added ${added} env vars to .env.example`))
  }
}
