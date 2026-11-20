/**
 * #497: a devtools page does not widen itself past the content area with a `w-[calc(100%+Npx)]`: the area's
 * `main` clips what goes beyond it, so at 1920 px the Test Cases page lost its left and right edges.
 */
import { describe, test, expect } from '@jest/globals'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '../../../../src')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(name) ? [p] : []
  })
}

describe('devtools layout (#497)', () => {
  test('no devtools page or component sizes itself past its container', () => {
    const offenders = [join(SRC, 'routes/devtools'), join(SRC, 'components/devtools')]
      .flatMap(files)
      .filter((file) => /w-\[calc\(100%\+/.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
