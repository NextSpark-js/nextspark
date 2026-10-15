/**
 * A packaged plugin ships TypeScript source, so Next must compile it: its package has to be in the
 * project's `transpilePackages` (next.config.*), or `next build` fails with "Unknown module type".
 * `nextspark prepare` checks that before it generates anything. Local plugins (`plugins/`) are part
 * of the project and need nothing.
 *
 * next.config is read as text, like `readCacheComponents`: a literal array is read, anything else
 * (a spread, a variable, a config built elsewhere) is a warning that says what to check.
 *
 * @module core/scripts/build/registry/host/transpile
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const TRANSPILE_DIAGNOSTICS = Object.freeze({
  MISSING: 'NS_PLUGIN_TRANSPILE_MISSING',
  UNREADABLE: 'NS_PLUGIN_TRANSPILE_UNREADABLE',
  SEVERAL_CONFIGS: 'NS_PLUGIN_TRANSPILE_SEVERAL_CONFIGS',
})

// The order Next.js loads them in: with several present, the first one wins
const CONFIG_NAMES = ['next.config.js', 'next.config.mjs', 'next.config.ts']

/** The source without its comments; a `/*` or `//` inside a string literal stays. */
export function withoutComments(source) {
  let out = ''
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < source.length && source[j] !== c) j += source[j] === '\\' ? 2 : 1
      out += source.slice(i, j + 1)
      i = j
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 1
    } else if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      out += '\n'
    } else out += c
  }
  return out
}

/** `{ file, packages }` for a literal `transpilePackages: [...]`; `{ file, unreadable }` when it cannot be read; `{}` without a next.config. */
function readTranspilePackages(projectRoot) {
  const present = CONFIG_NAMES.filter(name => existsSync(join(projectRoot, name)))
  const file = present[0]
  if (!file) return {}
  const others = present.slice(1)
  const source = withoutComments(readFileSync(join(projectRoot, file), 'utf8'))
  const key = /\btranspilePackages\s*:\s*/.exec(source)
  if (!key) {
    if (/\btranspilePackages\b/.test(source)) return { file, others, unreadable: 'transpilePackages is not set as a literal property' }
    return /\.\.\.\s*[A-Za-z_$(]/.test(source) ? { file, others, unreadable: 'it spreads another config' } : { file, others, packages: [] }
  }
  const array = /^\[([^\]]*)\]/.exec(source.slice(key.index + key[0].length))
  if (!array) return { file, others, unreadable: 'transpilePackages is not a literal array' }
  const entries = array[1].split(',').map(entry => entry.trim()).filter(Boolean)
  const packages = entries.map(entry => /^(['"`])([^'"`$]*)\1$/.exec(entry)?.[2])
  if (packages.includes(undefined)) return { file, others, unreadable: 'transpilePackages holds more than string literals' }
  return { file, others, packages }
}

/**
 * @param {{ projectRoot: string, plugins: { kind?: string, packageName?: string }[] }} input
 * @returns {{ diagnostics: object[], notices: object[] }}
 */
export function packagedPluginTranspile({ projectRoot, plugins }) {
  const packaged = [...new Set(plugins.filter(plugin => plugin.kind === 'packaged' && plugin.packageName).map(plugin => plugin.packageName))]
  if (packaged.length === 0) return { diagnostics: [], notices: [] }
  const { file = 'next.config.mjs', others = [], packages, unreadable } = readTranspilePackages(projectRoot)
  const several = others.length === 0 ? [] : [{
    code: TRANSPILE_DIAGNOSTICS.SEVERAL_CONFIGS,
    message: `${[file, ...others].join(' and ')} both exist; Next.js loads ${file}, which is the one prepare checks. Remove the other.`,
  }]
  if (unreadable) {
    return {
      diagnostics: [],
      notices: [...several, {
        code: TRANSPILE_DIAGNOSTICS.UNREADABLE,
        message: `${file} cannot be read without running it (${unreadable}), so prepare could not check that transpilePackages lists ${packaged.map(name => `"${name}"`).join(', ')}. Packaged plugins ship TypeScript source: confirm they are in transpilePackages, or \`next build\` fails with "Unknown module type".`,
      }],
    }
  }
  const missing = packaged.filter(name => !(packages ?? []).includes(name))
  const line = `transpilePackages: [${[...(packages ?? []), ...missing].map(name => `'${name}'`).join(', ')}],`
  return {
    diagnostics: missing.map(name => ({
      code: TRANSPILE_DIAGNOSTICS.MISSING,
      message: `Packaged plugin "${name}" ships TypeScript source, and ${file} does not list it in transpilePackages (next build would fail with "Unknown module type"). Set this line in ${file}: ${line}`,
    })),
    notices: several,
  }
}
