/**
 * The template jest config of a generated app maps @nextsparkjs/mobile (#381): the package exports only an
 * `import` condition, which Jest's `require` resolution cannot use. Every subpath the package exports has to map
 * to the file its `import` condition names.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const root = join(__dirname, '..', '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, { import: string }>
}
const config = createRequire(__filename)(join(root, 'templates', 'jest.config.js')) as {
  moduleNameMapper: Record<string, string>
}

/** What the config's mapper turns a specifier into, or null when no pattern matches. */
function mapped(specifier: string): string | null {
  for (const [pattern, target] of Object.entries(config.moduleNameMapper)) {
    const match = new RegExp(pattern).exec(specifier)
    if (match) return target.replace(/\$(\d)/g, (_, n) => match[Number(n)])
  }
  return null
}

describe('template jest config', () => {
  it.each(Object.entries(pkg.exports))('maps %s to the file its import condition names', (subpath, condition) => {
    const specifier = subpath === '.' ? '@nextsparkjs/mobile' : `@nextsparkjs/mobile/${subpath.slice(2)}`
    expect(mapped(specifier)).toBe(`<rootDir>/node_modules/@nextsparkjs/mobile/${condition.import.slice(2)}`)
  })
})
