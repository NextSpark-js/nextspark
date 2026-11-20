/**
 * Every literal `sel('...')` path used by the devtools components exists in the core selectors (#504):
 * an undeclared path gets no data-cy and logs "Invalid selector path" in the browser.
 */
import { describe, test, expect } from '@jest/globals'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { CORE_SELECTORS, getNestedValue } from '@/core/lib/selectors'

const ROOT = join(__dirname, '../../../../src/components/devtools')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(name) ? [p] : []
  })
}

describe('devtools selector paths (#504)', () => {
  test('every sel() path used by a devtools component is declared', () => {
    const missing: string[] = []
    for (const file of files(ROOT)) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/\bsel\(\s*(['"`])([^'"`]+)\1/g)) {
        if (typeof getNestedValue(CORE_SELECTORS as unknown as Record<string, unknown>, m[2]) !== 'string') {
          missing.push(`${file.slice(ROOT.length + 1)}: ${m[2]}`)
        }
      }
    }
    expect(missing).toEqual([])
  })
})
