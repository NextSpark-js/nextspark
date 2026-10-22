/**
 * Generic Entity Handler — the language of the validation errors (#358)
 *
 * With `api.validationLocale` unset the create/update routes answer in English as always; with a locale (or
 * `'accept-language'`) they answer with the core catalog of that locale. The schema generator is the real one.
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { NextResponse } from 'next/server'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'

const mockGetApplicationConfig = jest.fn<() => Promise<unknown>>()
// lib/locale.ts (loaded only for 'accept-language') imports the auth stack, which has no place in this suite
jest.mock('@nextsparkjs/core/lib/auth', () => ({ auth: {} }))
jest.mock('@nextsparkjs/core/lib/auth/session-hint', () => ({ hasSessionCookie: jest.fn() }))
jest.mock('next/headers', () => ({ cookies: jest.fn(), headers: jest.fn() }))
jest.mock('@nextsparkjs/core/lib/config', () => ({
  getApplicationConfig: () => mockGetApplicationConfig(),
  I18N_CONFIG: { supportedLocales: ['en', 'es', 'fr'], defaultLocale: 'en' },
}))

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn(),
  hasRequiredScope: jest.fn(),
  canBypassTeamContext: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/api/entity/resolver', () => ({
  resolveEntityFromUrl: jest.fn(),
  validateEntityOperation: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  queryOneWithRLS: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  readJsonObject: async (request: { json: () => Promise<unknown> }) => ({ data: await request.json() }),
  createApiResponse: jest.fn(),
  createApiError: jest.fn(),
  parsePaginationParams: jest.fn(),
  createPaginationMeta: jest.fn(),
  parseMetaParams: jest.fn(),
  parseChildParams: jest.fn(),
  includeEntityMetadata: jest.fn(),
  includeEntityChildren: jest.fn(),
  processEntityMetadata: jest.fn(),
  handleEntityMetadataInResponse: jest.fn(),
  addCorsHeaders: jest.fn(),
  handleCorsPreflightRequest: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({
  checkPermission: jest.fn(),
  publishPermissionFor: () => null,
  declaredPublishPermission: () => null,
}))
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
const mockCheckPermission = checkPermission as jest.Mock

jest.mock('@nextsparkjs/core/lib/blocks/pattern-resolver', () => ({
  extractPatternIds: jest.fn(),
}))

jest.mock('@nextsparkjs/core/types/pattern-reference', () => ({
  isPatternReference: jest.fn(),
}))

jest.mock('@nextsparkjs/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { getExistingPatternIds: jest.fn() },
}))

jest.mock('@nextsparkjs/core/lib/services/subscription.service', () => ({
  SubscriptionService: { canPerformAction: jest.fn() },
}))

jest.mock('@nextsparkjs/core/lib/services/usage.service', () => ({
  UsageService: { track: jest.fn() },
}))

// entity-hooks.ts registers pattern/block-usage tracking as a side effect
// of being imported (`initPatternUsageHooks()` at module scope), which
// pulls in the entity registry and the scheduled-actions system — neither
// relevant here and neither safe to load outside a generated project. It
// only wires ACTION hooks ('entity.created' etc.), so neutralizing it does
// not touch the before_create FILTER hook under test.
jest.mock('@nextsparkjs/core/lib/entities/pattern-usage-hooks', () => ({
  initPatternUsageHooks: jest.fn(),
}))

import { handleGenericCreate, handleGenericUpdate } from '@nextsparkjs/core/lib/api/entity/generic-handler'
import { authenticateRequest, hasRequiredScope, canBypassTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { resolveEntityFromUrl, validateEntityOperation } from '@nextsparkjs/core/lib/api/entity/resolver'
import { createApiError, addCorsHeaders } from '@nextsparkjs/core/lib/api/helpers'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { queryOneWithRLS } from '@nextsparkjs/core/lib/db'

const entityConfig = {
  slug: 'items',
  enabled: true,
  names: { singular: 'item', plural: 'Items' },
  fields: [{ name: 'title', type: 'text', required: true, api: { readOnly: false }, display: { label: 'Title', showInForm: true } }],
  access: { public: false, api: true, metadata: false, shared: false },
} as unknown as EntityConfig

const request = (headers: Record<string, string> = {}) =>
  ({
    url: 'http://localhost/api/v1/items',
    nextUrl: { pathname: '/api/v1/items', origin: 'http://localhost' },
    headers: new Headers({ 'x-team-id': 'team-1', ...headers }),
    json: async () => ({}),
  }) as any

async function createMessage(config: Record<string, unknown>, headers: Record<string, string> = {}) {
  mockGetApplicationConfig.mockResolvedValue({ api: config })
  const response = await handleGenericCreate(request(headers))
  expect(response.status).toBe(400)
  return (await response.json()).details[0].message as string
}

describe('generic routes - validation locale', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(resolveEntityFromUrl as jest.Mock).mockResolvedValue({ entityName: 'items', entityConfig, isValidEntity: true })
    ;(validateEntityOperation as jest.Mock).mockReturnValue(true)
    ;(authenticateRequest as jest.Mock).mockResolvedValue({ success: true, type: 'api-key', user: { id: 'user-1', role: 'member' }, scopes: ['items:write'] })
    ;(hasRequiredScope as jest.Mock).mockReturnValue(true)
    ;(canBypassTeamContext as jest.Mock).mockResolvedValue(true)
    ;(checkPermission as jest.Mock).mockResolvedValue(true)
    ;(queryOneWithRLS as jest.Mock).mockResolvedValue({ id: 'item-1' })
    ;(createApiError as jest.Mock).mockImplementation(((message: string, status = 400, details?: unknown, code?: string) =>
      NextResponse.json({ success: false, error: message, code, details }, { status })) as any)
    ;(addCorsHeaders as jest.Mock).mockImplementation((async (response: unknown) => response) as any)
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  test('unset: English, as always', async () => {
    expect(await createMessage({})).toBe('Title is required')
  })

  test('a fixed locale answers in it', async () => {
    expect(await createMessage({ validationLocale: 'es' })).toBe('Title es obligatorio')
  })

  test('accept-language answers per request, English when the header names no supported locale', async () => {
    expect(await createMessage({ validationLocale: 'accept-language' }, { 'accept-language': 'fr-CA,fr;q=0.9,en;q=0.5' })).toBe('Title est obligatoire')
    expect(await createMessage({ validationLocale: 'accept-language' }, { 'accept-language': 'ja' })).toBe('Title is required')
    expect(await createMessage({ validationLocale: 'accept-language' })).toBe('Title is required')
  })

  test('a locale with no catalog answers in English', async () => {
    expect(await createMessage({ validationLocale: 'xx' })).toBe('Title is required')
  })

  test('update answers in the locale too', async () => {
    mockGetApplicationConfig.mockResolvedValue({ api: { validationLocale: 'es' } })
    const body = { title: '' }
    const response = await handleGenericUpdate({ ...request(), json: async () => body, method: 'PATCH' }, { params: Promise.resolve({ entity: 'items', id: 'item-1' }) })
    const json = await response.json()
    expect(response.status).toBe(400)
    expect(json.details[0].message).toBe('Title es obligatorio')
  })
})
