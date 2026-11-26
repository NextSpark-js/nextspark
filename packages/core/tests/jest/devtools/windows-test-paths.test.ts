/**
 * #545: on Windows the paths of `GET /api/devtools/tests` and of the test files of a tag use `\`; both are compared with
 * `/` so the Tags page links the files that have a documentation page.
 */
import { describe, test, expect } from '@jest/globals'
import path from 'node:path'
import { posixRelative } from '@/core/lib/devtools/posix-path'
import { docPaths, testDocPath } from '@/core/components/devtools/tag-utils'

describe('Windows paths of the devtools tests tree', () => {
  test('posixRelative gives `/` for a Windows base and file', () => {
    const base = 'C:\\proj\\tests\\cypress\\e2e'
    expect(posixRelative(base, path.win32.join(base, 'auth', 'login.bdd.md'), path.win32)).toBe('auth/login.bdd.md')
  })

  test('posixRelative is unchanged on POSIX', () => {
    expect(posixRelative('/p/e2e', '/p/e2e/auth/login.bdd.md', path.posix)).toBe('auth/login.bdd.md')
  })

  test('a Windows tree and a Windows test file still match', () => {
    const docs = docPaths([{ path: 'auth\\login.bdd.md', type: 'file' }])
    expect(testDocPath('tests\\cypress\\e2e\\auth\\login.cy.ts', docs)).toBe('/devtools/tests/auth/login.bdd.md')
  })
})
