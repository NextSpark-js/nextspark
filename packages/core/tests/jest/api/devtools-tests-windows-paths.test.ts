/**
 * #545: `GET /api/devtools/tests` answers `/`-separated paths when the platform joins with `\` (Windows), so the Tags
 * page can match them against the test files of the tags.
 */
import { describe, test, expect, jest } from '@jest/globals'

// the route runs against `path.win32`: its base path and its `join` use `\`
jest.mock('path', () => jest.requireActual<typeof import('path')>('path').win32)
jest.mock('@/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ user: { id: 'u', role: 'developer' } }),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({ withRateLimitTier: (h: unknown) => h }))

const dirent = (name: string, dir: boolean) => ({ name, isDirectory: () => dir, isFile: () => !dir })
const tree: Record<string, ReturnType<typeof dirent>[]> = {
  e2e: [dirent('auth', true), dirent('top.bdd.md', false)],
  auth: [dirent('login.bdd.md', false), dirent('login.cy.ts', false)],
}
jest.mock('fs/promises', () => ({
  stat: jest.fn(async () => ({})),
  readdir: jest.fn(async (dir: string) => tree[dir.split('\\').pop() as string]),
}))

import { GET } from '@/app/api/devtools/tests/route'

describe('GET /api/devtools/tests with Windows separators', () => {
  test('every path of the tree uses /', async () => {
    const res = await (GET as unknown as (r: Request) => Promise<Response>)(new Request('http://x/api/devtools/tests'))
    const { data } = await res.json()
    expect(data.tree.map((n: { path: string }) => n.path)).toEqual(['auth', 'top.bdd.md'])
    expect(data.tree[0].children.map((n: { path: string }) => n.path)).toEqual(['auth/login.bdd.md'])
  })
})
