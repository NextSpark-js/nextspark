/**
 * Email Discovery
 *
 * Discovers email template files from core defaults and the active theme.
 * Theme files override core defaults at the same slug; new theme slugs are
 * additive (themes can ship templates that core doesn't know about).
 *
 * @module core/scripts/build/registry/discovery/emails
 */

import { readdir } from 'fs/promises'
import { join } from 'path'

import { CONFIG as DEFAULT_CONFIG } from '../config.mjs'
import { log, verbose } from '../../../utils/index.mjs'

/**
 * @typedef {Object} DiscoveredEmail
 * @property {string} slug             - Filename without extension (e.g. 'verify-email')
 * @property {'core' | 'theme'} source - Where the file lives
 * @property {string} importPath       - Module specifier the generator will emit
 * @property {string} importName       - Sanitized identifier safe to use in generated TS
 */

/**
 * Convert a file slug to a JavaScript identifier safe for use as an import name.
 * - "verify-email"  → "verifyEmail"
 * - "team-invite"   → "teamInvite"
 * - "purchase.v2"   → "purchaseV2"
 *
 * Keeps existing camelCase intact (e.g. "verifyEmail" → "verifyEmail").
 *
 * @param {string} slug
 * @returns {string}
 */
function slugToIdentifier(slug) {
  return slug
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^([0-9])/, '_$1')
}

/**
 * Walk a directory and return its email entries (one per template file at the
 * top level — emails are not nested).
 *
 * Source files are `.ts`/`.tsx` (monorepo mode + theme overrides). Compiled
 * npm distributions ship `.js` + `.d.ts` only — the `.d.ts` carries the
 * canonical slug list (one per template, paired with the `.js` runtime),
 * so we accept `.d.ts` files as slug markers when `acceptCompiled` is true.
 * The generator's import path stays the same (`@nextsparkjs/core/emails/<slug>`)
 * and the bundler resolves to the `.js` runtime at build time.
 *
 * @param {string} dir
 * @param {{ acceptCompiled?: boolean }} [options]
 * @returns {Promise<Array<{ slug: string, fileName: string }>>}
 */
async function listEmailFiles(dir, options = {}) {
  const { acceptCompiled = false } = options
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    // Directory doesn't exist — that's fine, no emails here.
    return []
  }

  const seen = new Set()
  const out = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    // Skip barrel files and underscore-prefixed (README/notes)
    if (entry.name.startsWith('_')) continue
    if (entry.name === 'index.ts' || entry.name === 'index.tsx') continue
    if (entry.name === 'index.js' || entry.name === 'index.d.ts') continue
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.test.tsx')) continue
    if (entry.name.endsWith('.d.ts.map')) continue

    let slug = null
    if (entry.name.endsWith('.tsx')) {
      slug = entry.name.slice(0, -4)
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      slug = entry.name.slice(0, -3)
    } else if (acceptCompiled && entry.name.endsWith('.d.ts')) {
      // Compiled dist directory — the .d.ts is the slug marker for the
      // matching .js runtime that the bundler will resolve via the package
      // exports field at consumer build time.
      slug = entry.name.slice(0, -5)
    }
    if (!slug || seen.has(slug)) continue
    seen.add(slug)
    out.push({ slug, fileName: entry.name })
  }
  return out
}

/**
 * Discover all email templates: core defaults first, then active theme overrides
 * and additions. Theme entries take precedence per slug.
 *
 * @param {object} config - Configuration object from getConfig() (defaults to DEFAULT_CONFIG)
 * @returns {Promise<DiscoveredEmail[]>}
 */
export async function discoverEmails(config = DEFAULT_CONFIG) {
  log('Discovering email templates...', 'info')

  // Resolve core default emails dir.
  // - Monorepo mode: packages/core/src/emails/    (uncompiled .ts)
  // - NPM mode: node_modules/@nextsparkjs/core/dist/emails/ (compiled .js)
  // The build-time import alias is the same shape in both cases — Next.js
  // resolves '@nextsparkjs/core/emails/<slug>' via the package's exports field
  // in npm mode, and '@/core/emails/<slug>' via tsconfig paths in monorepo mode.
  const coreEmailsDir = config.isNpmMode
    ? join(config.coreDir, 'dist', 'emails')
    : join(config.coreDir, 'src', 'emails')

  const coreImportBase = config.isNpmMode
    ? '@nextsparkjs/core/emails'
    : '@/core/emails'

  /** @type {Map<string, DiscoveredEmail>} */
  const merged = new Map()

  // Core defaults — in npm mode the package ships `.d.ts` + `.js` only, so
  // accept `.d.ts` as slug markers there. Monorepo mode keeps the original
  // `.ts`-only contract since the source tree has the uncompiled files.
  const coreFiles = await listEmailFiles(coreEmailsDir, {
    acceptCompiled: !!config.isNpmMode,
  })
  if (coreFiles.length > 0) {
    verbose(`Found ${coreFiles.length} core email template(s) in: ${coreEmailsDir}`)
    for (const { slug } of coreFiles) {
      merged.set(slug, {
        slug,
        source: 'core',
        importPath: `${coreImportBase}/${slug}`,
        importName: `${slugToIdentifier(slug)}_core`,
      })
    }
  } else {
    verbose(`No core email templates found in: ${coreEmailsDir}`)
  }

  // Theme overrides + additions.
  if (config.activeTheme && config.themesDir) {
    const themeEmailsDir = join(config.themesDir, config.activeTheme, 'emails')
    const themeFiles = await listEmailFiles(themeEmailsDir)

    if (themeFiles.length > 0) {
      verbose(`Found ${themeFiles.length} theme email override(s) in: ${themeEmailsDir}`)
      for (const { slug } of themeFiles) {
        merged.set(slug, {
          slug,
          source: 'theme',
          importPath: `@/contents/themes/${config.activeTheme}/emails/${slug}`,
          importName: `${slugToIdentifier(slug)}_theme`,
        })
      }
    }
  } else if (!config.activeTheme) {
    verbose('No active theme — only core email templates will be registered.')
  }

  const result = Array.from(merged.values()).sort((a, b) => a.slug.localeCompare(b.slug))

  log(
    `Discovered ${result.length} email template(s): ` +
      result.map(e => `${e.slug}(${e.source})`).join(', '),
    'info',
  )

  return result
}
