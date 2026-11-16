import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

export async function updateTsConfig(name: string, type: 'plugin' | 'theme'): Promise<void> {
  const tsconfigPath = join(process.cwd(), 'tsconfig.json')

  if (!existsSync(tsconfigPath)) {
    console.log('  Warning: tsconfig.json not found, skipping path update')
    return
  }

  const pathKey = '@/plugins/*'
  const edit = `add "${pathKey}": ["./plugins/*"] to compilerOptions.paths in tsconfig.json`
  try {
    const content = readFileSync(tsconfigPath, 'utf-8')
    // The tsconfig.json core ships has comments, which JSON.parse rejects, and already maps the plugins
    if (type === 'plugin' && content.includes(`"${pathKey}"`)) return
    const tsconfig = JSON.parse(content)

    if (!tsconfig.compilerOptions) {
      tsconfig.compilerOptions = {}
    }
    if (!tsconfig.compilerOptions.paths) {
      tsconfig.compilerOptions.paths = {}
    }

    if (type === 'theme') return
    const pathValue = ['./plugins/*']

    // Solo añadir si no existe
    if (!tsconfig.compilerOptions.paths[pathKey]) {
      tsconfig.compilerOptions.paths[pathKey] = pathValue
      writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + '\n')
      console.log(`  Updated tsconfig.json with ${pathKey} path`)
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.log(`  Warning: Could not update tsconfig.json (${reason}). For imports from @/plugins/ to resolve, ${edit}.`)
  }
}

export async function registerInPackageJson(
  npmName: string,
  version: string,
  type: 'plugin' | 'theme'
): Promise<void> {
  const pkgPath = join(process.cwd(), 'package.json')

  if (!existsSync(pkgPath)) {
    console.log('  Warning: package.json not found, skipping registration')
    return
  }

  try {
    const content = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)

    if (!pkg.nextspark) {
      pkg.nextspark = {}
    }

    const key = type === 'plugin' ? 'plugins' : 'themes'
    if (!pkg.nextspark[key]) {
      pkg.nextspark[key] = []
    }

    // Registrar nombre y versión
    const entry = { name: npmName, version }
    const existingIndex = pkg.nextspark[key].findIndex(
      (e: { name: string }) => e.name === npmName
    )

    if (existingIndex >= 0) {
      pkg.nextspark[key][existingIndex] = entry
    } else {
      pkg.nextspark[key].push(entry)
    }

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`  Registered ${type} in package.json`)
  } catch (error) {
    console.log('  Warning: Could not update package.json')
  }
}
