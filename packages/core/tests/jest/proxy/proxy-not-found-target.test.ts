/**
 * The proxy's not-found rewrite goes where `nextspark prepare` says (#480): `NOT_FOUND_REWRITE.path` of root-files.ts,
 * which is `/_not-found` in a Cache Components host with a dynamic route of two or more segments at the root (that
 * route would answer `/_ns/not-found` with a 200).
 */
import { describe, expect, jest, test } from '@jest/globals'

jest.mock('@nextsparkjs/core/lib/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}))

jest.mock('@nextsparkjs/core/lib/middleware', () => ({
  hasProjectMiddleware: () => false,
  executeProjectMiddleware: jest.fn(),
  getProjectAppConfig: () => undefined,
}))

jest.mock('@nextsparkjs/registries/root-files', () => ({
  ROOT_FILES: [],
  NOT_FOUND_REWRITE: { path: '/_not-found' },
}))

import { NextRequest } from 'next/server'
import { proxy } from '@nextsparkjs/core/proxy'

describe('proxy not-found rewrite destination (#480)', () => {
  test('a missing docs page is rewritten to the destination prepare wrote', async () => {
    const response = (await proxy(new NextRequest('http://localhost:3000/docs/getting-started/does-not-exist'))) as unknown as {
      type?: string
      rewriteUrl?: string
    }

    expect(response.type).toBe('rewrite')
    expect(new URL(response.rewriteUrl as string).pathname).toBe('/_not-found')
  })
})
