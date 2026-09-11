/**
 * Icon Discovery
 *
 * Collects every lucide-react icon name the app can ask for by string at
 * runtime, so the generated icon registry can import exactly those and let
 * the bundler drop the rest of the icon set.
 *
 * Sources are exactly what resolveIcon can be handed, and all of them are
 * source files (never the database):
 * - entity configs (`icon: Users` — an identifier imported from lucide-react)
 * - a theme's app.config (`customSidebarSections[].icon` — a string)
 * - block configs (`icon: 'Grid'` — the block's own icon in the editor)
 *
 * What a block RENDERS is not here: page content names those icons in the page
 * builder, so they live in the database. Those blocks keep resolving through
 * the lucide namespace — deliberately, see themes' features-grid component.
 *
 * @module core/scripts/build/registry/discovery/icons
 */

import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'

import { verbose, log } from '../../../utils/index.mjs'

/**
 * Icons the resolver falls back to when a name doesn't resolve. They are
 * referenced from core components, not from any config, so nothing would
 * discover them.
 */
const FALLBACK_ICONS = ['Box', 'Circle', 'Folder', 'LayoutGrid']

/**
 * Names lucide-react actually exports, read from its own barrel.
 * A name that isn't there would become a broken named import in the
 * generated registry, so unknown names are dropped with a warning instead.
 * @param {object} config
 * @returns {Set<string>|null} null when lucide-react can't be resolved
 */
async function readLucideExportNames(config) {
  try {
    const requireFromProject = createRequire(join(config.projectRoot, 'package.json'))
    const pkgPath = requireFromProject.resolve('lucide-react/package.json')
    const barrelPath = join(dirname(pkgPath), 'dist/esm/lucide-react.js')

    if (!existsSync(barrelPath)) {
      return null
    }

    const barrel = await readFile(barrelPath, 'utf8')
    const names = new Set()
    for (const match of barrel.matchAll(/default as ([A-Za-z_$][\w$]*)/g)) {
      names.add(match[1])
    }
    return names.size > 0 ? names : null
  } catch {
    return null
  }
}

/**
 * Which config files hold icons resolveIcon can be handed. Exported for tests.
 *
 * Separators are normalised first: the generator also runs on Windows, where
 * join() produces '\\' and a '/'-shaped match would silently find nothing —
 * leaving a registry with only its fallbacks, and every entity icon rendering
 * as a Box.
 */
export function isIconSourcePath(filePath) {
  const normalised = filePath.replace(/\\/g, '/')
  return (
    (normalised.includes('/entities/') && normalised.endsWith('.config.ts')) ||
    (normalised.includes('/blocks/') && normalised.endsWith('/config.ts')) ||
    normalised.endsWith('/config/app.config.ts')
  )
}

/**
 * Map of local name -> exported lucide name for a file's lucide imports.
 * `import { Home as HouseIcon }` means the config's `icon: HouseIcon` is
 * lucide's `Home`.
 */
function parseLucideImports(content) {
  const imports = new Map()

  for (const match of content.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g)) {
    for (const specifier of match[1].split(',')) {
      const parts = specifier.trim().replace(/^type\s+/, '').split(/\s+as\s+/)
      const exported = parts[0]?.trim()
      const local = (parts[1] || parts[0])?.trim()
      if (exported && local) {
        imports.set(local, exported)
      }
    }
  }

  return imports
}

/**
 * Icon names referenced by a single config file. Exported for tests.
 */
export function extractIconNames(content) {
  const lucideImports = parseLucideImports(content)
  const names = []

  // `icon: Users` or `'icon': Users` — only counts when the identifier came
  // from lucide-react
  for (const match of content.matchAll(/(?:\bicon|['"]icon['"])\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    const exported = lucideImports.get(match[1])
    if (exported) {
      names.push(exported)
    }
  }

  // `icon: 'Users'` or `icon: 'pie-chart'` — a theme's sidebar sections and
  // block configs use both spellings; the caller folds kebab-case into the
  // lucide export name and validates the result against lucide's export list.
  for (const match of content.matchAll(/(?:\bicon|['"]icon['"])\s*:\s*['"]([A-Za-z][\w$-]*)['"]/g)) {
    names.push(match[1])
  }

  return names
}

async function collectConfigFiles(dir, matcher, found = []) {
  if (!existsSync(dir)) {
    return found
  }

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      await collectConfigFiles(entryPath, matcher, found)
    } else if (matcher(entryPath)) {
      found.push(entryPath)
    }
  }

  return found
}

function coreEntitiesDir(config) {
  if (config.isNpmMode) {
    return join(config.projectRoot, 'node_modules/@nextsparkjs/core/src/entities')
  }
  if (config.isMonorepoMode && config.monorepoRoot) {
    return join(config.monorepoRoot, 'packages/core/src/entities')
  }
  return join(config.projectRoot, 'packages/core/src/entities')
}

/**
 * Discover every icon name the runtime can look up by string.
 * @param {Array} blocks - Blocks from block discovery (each with an `icon` name)
 * @param {object} config - Configuration object from getConfig()
 * @returns {Promise<string[]>} Sorted, de-duplicated, validated icon names
 */
export async function discoverIcons(blocks, config) {
  const candidates = new Set(FALLBACK_ICONS)

  // Only the configs whose icons reach resolveIcon. Widening this would put
  // icons in the dashboard bundle that nothing can ask for.
  const iconSources = [
    ...(await collectConfigFiles(coreEntitiesDir(config), isIconSourcePath)),
    ...(await collectConfigFiles(config.themesDir, isIconSourcePath)),
    ...(await collectConfigFiles(config.pluginsDir, isIconSourcePath))
  ]

  for (const configPath of iconSources) {
    try {
      const content = await readFile(configPath, 'utf8')
      for (const name of extractIconNames(content)) {
        candidates.add(name)
      }
    } catch {
      verbose(`[icons] Could not read ${configPath}`)
    }
  }

  for (const block of blocks || []) {
    if (block.icon) {
      candidates.add(block.icon)
    }
  }

  const known = await readLucideExportNames(config)
  if (!known) {
    // Every name becomes a named import, so a kebab-case one would emit
    // `import { pie-chart }` and break the build. Without lucide's list there
    // is nothing to fold them against, so they are dropped instead.
    const importable = [...candidates].filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
    log('Could not read lucide-react exports; icon registry will include every importable name found', 'warning')
    return importable.sort()
  }

  // Configs spell icons both ways: `CheckSquare` in entity configs, `pie-chart`
  // in a theme's sidebar and block configs. The registry is keyed by the export
  // name, so kebab-case names are folded into it rather than dropped.
  const toPascalCase = name =>
    name
      .split(/[-_\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

  const valid = []
  const unknown = []
  for (const name of candidates) {
    if (known.has(name)) {
      valid.push(name)
      continue
    }
    const pascalCased = toPascalCase(name)
    if (known.has(pascalCased)) {
      valid.push(pascalCased)
      continue
    }
    unknown.push(name)
  }

  if (unknown.length > 0) {
    log(`Icons not exported by lucide-react, skipped: ${[...new Set(unknown)].sort().join(', ')}`, 'warning')
  }

  verbose(`[icons] ${valid.length} icon(s) referenced by name`)
  return [...new Set(valid)].sort()
}
