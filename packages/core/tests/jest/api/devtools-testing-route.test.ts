/**
 * GET /api/v1/devtools/testing returns the feature and flow entries next to the summary: the Test Coverage Dashboard
 * lists the ones without tests from them (#498).
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: async () => ({ success: true, type: 'session', user: { id: 'u', role: 'developer' } }),
  createAuthFailureResponse: () => new Response(null, { status: 401 }),
}))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({
  TAGS_REGISTRY: { features: { '@feat-a': { tag: '@feat-a', testCount: 1, files: ['a.cy.ts'] } } },
  COVERAGE_SUMMARY: {
    theme: 't',
    generatedAt: 'now',
    tags: { testFiles: 1 },
    features: { total: 2, withTests: 1, withoutTests: 1 },
    flows: { total: 1, withTests: 0, withoutTests: 1 },
  },
  FEATURE_REGISTRY: {
    a: { key: 'a', name: 'A', testing: { hasTests: true, testCount: 1 } },
    b: { key: 'b', name: 'B', testing: { hasTests: false, testCount: 0 } },
  },
  FLOW_REGISTRY: { f: { key: 'f', name: 'F', criticalPath: true, testing: { hasTests: false, testCount: 0 } } },
}))

import { GET } from '@/app/api/v1/devtools/testing/route'

it('returns the feature and flow entries with their key, name and testing', async () => {
  const response = await (GET as unknown as (r: NextRequest) => Promise<Response>)(new NextRequest('http://localhost/api/v1/devtools/testing'))
  expect(response.status).toBe(200)
  const { data } = await response.json()

  expect(data.features).toEqual([
    { key: 'a', name: 'A', testing: { hasTests: true, testCount: 1 } },
    { key: 'b', name: 'B', testing: { hasTests: false, testCount: 0 } },
  ])
  expect(data.flows).toEqual([{ key: 'f', name: 'F', criticalPath: true, testing: { hasTests: false, testCount: 0 } }])
  expect(data.summary.features.withoutTests).toBe(1)
})
