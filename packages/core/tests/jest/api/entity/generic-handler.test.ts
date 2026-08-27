/**
 * Regression coverage for #95: API-key authenticated requests to the generic
 * entity routes (`/api/v1/[entity]`) previously skipped three authorization
 * layers session-authenticated requests always went through —
 * `checkSessionPermission` (now `checkAuthPermission`), `resolveOwnershipFilter`,
 * and `fieldGuards` — because each was gated on `authResult.type === 'session'`.
 * These tests drive real requests through the exported handlers
 * (`handleGenericList`/`handleGenericUpdate`/`handleGenericDelete`) rather
 * than re-implementing the gate logic locally, so they exercise the actual
 * fix, not a model of it.
 */

const mockResolveEntityFromUrl = jest.fn();
const mockValidateEntityOperation = jest.fn();
jest.mock('@/core/lib/api/entity/resolver', () => ({
  resolveEntityFromUrl: (...args: unknown[]) => mockResolveEntityFromUrl(...args),
  validateEntityOperation: (...args: unknown[]) => mockValidateEntityOperation(...args),
}));

// Full mock (not a partial jest.requireActual) — the real dual-auth.ts
// transitively loads lib/auth.ts (Better Auth + DB connection setup), which
// isn't available in this package-level test context. hasRequiredScope below
// mirrors the real, already-separately-tested post-#94 implementation
// (dual-auth.ts:271-283) exactly, so callers here see real behavior.
const mockAuthenticateRequest = jest.fn();
const mockCanBypassTeamContext = jest.fn();
jest.mock('@/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuthenticateRequest(...args),
  canBypassTeamContext: (...args: unknown[]) => mockCanBypassTeamContext(...args),
  hasRequiredScope: (authResult: { type: string; scopes?: string[] }, requiredScope: string) => {
    if (authResult.type === 'session') return true;
    if (authResult.type === 'api-key' && authResult.scopes) {
      return authResult.scopes.includes(requiredScope) || authResult.scopes.includes('*');
    }
    return false;
  },
}));

const mockCheckPermission = jest.fn();
jest.mock('@/core/lib/permissions/check', () => ({
  checkPermission: (...args: unknown[]) => mockCheckPermission(...args),
}));

const mockQueryWithRLS = jest.fn();
const mockQueryOneWithRLS = jest.fn();
const mockMutateWithRLS = jest.fn();
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args),
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}));

const mockGenerateEntitySchemas = jest.fn();
jest.mock('@/core/lib/entities/schema-generator', () => ({
  generateEntitySchemas: (...args: unknown[]) => mockGenerateEntitySchemas(...args),
}));

jest.mock('@/core/lib/entities/entity-hooks', () => ({
  afterEntityCreate: jest.fn(),
  afterEntityUpdate: jest.fn(),
  afterEntityDelete: jest.fn(),
}));

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: { actionMappings: { limits: {} } },
}));

jest.mock('@/core/lib/services/pattern-usage.service', () => ({
  PatternUsageService: { track: jest.fn(), untrack: jest.fn() },
}));
jest.mock('@/core/lib/services/subscription.service', () => ({
  SubscriptionService: { getActive: jest.fn() },
}));
jest.mock('@/core/lib/services/usage.service', () => ({
  UsageService: { track: jest.fn(), checkLimit: jest.fn() },
}));

// Full mock (not a partial jest.requireActual) — helpers.ts imports `../auth`
// (Better Auth + DB bootstrapping), same problem as dual-auth.ts above. These
// mirror the real (pure, config-free) implementations closely enough for the
// LIST/UPDATE/DELETE paths under test — none of these test requests set
// `metas`/`child`/pagination query params, so the "not requested" branches
// are what's exercised, matching the real functions' behavior in that case.
jest.mock('@/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown, meta?: Record<string, unknown>, status = 200) => ({
    status,
    body: { success: true, data, info: { timestamp: new Date().toISOString(), ...meta } },
    async json() { return this.body; },
  }),
  createApiError: (message: string, status = 400, details?: unknown, code?: string) => ({
    status,
    body: { success: false, error: message, code: code || `HTTP_${status}`, details },
    async json() { return this.body; },
  }),
  addCorsHeaders: async (response: unknown) => response,
  handleCorsPreflightRequest: async () => ({ status: 200 }),
  parsePaginationParams: (request: { url: string }) => {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    return { page, limit, offset: (page - 1) * limit };
  },
  createPaginationMeta: (page: number, limit: number, total: number) => ({
    page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total,
  }),
  parseMetaParams: () => ({ includeMetadata: false, includeAll: false }),
  parseChildParams: () => ({ includeChildren: false, includeAll: false }),
  includeEntityMetadata: async (_entityType: string, entities: unknown[]) => entities,
  includeEntityChildren: async (_entityName: string, entities: unknown[]) => entities,
  handleEntityMetadataInResponse: async (_entityType: string, entity: unknown) => entity,
  processEntityMetadata: async () => ({ success: true, errors: [] }),
}));

import {
  handleGenericList,
  handleGenericCreate,
  handleGenericUpdate,
  handleGenericDelete,
} from '@/core/lib/api/entity/generic-handler';
import type { EntityConfig } from '@/core/lib/entities/types';

function makeRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
}) {
  const headerMap = new Map(Object.entries(options.headers ?? {}));
  const url = options.url ?? 'http://localhost/api/v1/pets';
  return {
    method: options.method ?? 'GET',
    url,
    nextUrl: new URL(url),
    headers: { get: (key: string) => headerMap.get(key) ?? null },
    cookies: { get: () => undefined },
    json: async () => options.body ?? {},
  } as unknown as import('next/server').NextRequest;
}

const API_KEY_AUTH = (scopes: string[], userRole = 'user') => ({
  success: true,
  type: 'api-key' as const,
  user: { id: 'key-owner-1', email: 'owner@test.com', role: userRole },
  scopes,
});

const SESSION_AUTH = (userId = 'session-user-1', userRole = 'user') => ({
  success: true,
  type: 'session' as const,
  user: { id: userId, email: 'user@test.com', role: userRole },
});

// Ownership-filtered entity: a `member` team role only sees rows whose
// `ownerId` matches their own userId (direct-field ownership, no linkedBy).
const PETS_ENTITY: EntityConfig = {
  slug: 'pets',
  tableName: 'pets',
  fields: [
    { name: 'name', type: 'text' } as never,
    { name: 'ownerId', type: 'text' } as never,
    { name: 'notes', type: 'text' } as never,
  ],
  access: {
    api: true,
    ownershipFilter: {
      roles: ['member'],
      field: 'ownerId',
      fieldGuards: [
        { roles: ['member'], denyFields: ['notes'] },
      ],
    },
  },
} as unknown as EntityConfig;

function routeQueryOneWithRLS(teamRole: string | null, memberExists = true) {
  mockQueryOneWithRLS.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM "team_members"')) {
      return memberExists ? { id: 'membership-1' } : null;
    }
    if (sql.includes('SELECT role FROM "team_members"')) {
      return teamRole ? { role: teamRole } : null;
    }
    return null;
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveEntityFromUrl.mockResolvedValue({
    isValidEntity: true,
    entityConfig: PETS_ENTITY,
    entityName: 'pets',
    hasCustomOverride: false,
  });
  mockValidateEntityOperation.mockReturnValue(true);
  mockQueryWithRLS.mockResolvedValue([]);
  mockCanBypassTeamContext.mockResolvedValue(false);
});

describe('handleGenericList — #95 authz gates now apply to API-key auth', () => {
  it('denies an API-key request whose team role lacks entity.list permission (checkAuthPermission)', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(false); // this team role can't list pets

    const request = makeRequest({ headers: { 'x-team-id': 'team-1' } });
    const response = await handleGenericList(request);

    expect((response as { status: number }).status).toBe(403);
    expect(mockCheckPermission).toHaveBeenCalledWith('key-owner-1', 'team-1', 'pets.list');
    // The query must never run once permission is denied.
    expect(mockQueryWithRLS).not.toHaveBeenCalled();
  });

  it('allows an API-key request whose team role has entity.list permission', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(true);

    const request = makeRequest({ headers: { 'x-team-id': 'team-1' } });
    const response = await handleGenericList(request);

    expect((response as { status: number }).status).toBe(200);
    expect(mockQueryWithRLS).toHaveBeenCalled();
  });

  it('applies the ownership filter to an API-key request from a restricted team role (previously bypassed unconditionally)', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(true);

    const request = makeRequest({ headers: { 'x-team-id': 'team-1' } });
    await handleGenericList(request);

    const listCall = mockQueryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"'));
    expect(listCall).toBeDefined();
    const [sql, params] = listCall as [string, unknown[]];
    expect(sql).toContain('t."ownerId" = $');
    expect(params).toContain('key-owner-1'); // the API key OWNER's id, not a session id
  });

  it('does NOT apply the ownership filter for a role not listed in ownershipFilter.roles', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:read']));
    routeQueryOneWithRLS('owner'); // 'owner' is not in ownershipFilter.roles: ['member']
    mockCheckPermission.mockResolvedValue(true);

    const request = makeRequest({ headers: { 'x-team-id': 'team-1' } });
    await handleGenericList(request);

    const listCall = mockQueryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"'));
    const [sql] = listCall as [string, unknown[]];
    // "ownerId" still appears as a selected column — only the WHERE-clause
    // filter condition should be absent for an unrestricted role.
    expect(sql).not.toContain('t."ownerId" = $');
  });

  it('regression: session auth behavior is unchanged by the fix', async () => {
    mockAuthenticateRequest.mockResolvedValue(SESSION_AUTH('session-user-1', 'user'));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(true);

    const request = makeRequest({ headers: { 'x-team-id': 'team-1' } });
    const response = await handleGenericList(request);

    expect((response as { status: number }).status).toBe(200);
    const listCall = mockQueryWithRLS.mock.calls.find(([sql]: [string]) => sql.includes('FROM "pets"'));
    const [sql, params] = listCall as [string, unknown[]];
    expect(sql).toContain('t."ownerId" = $');
    expect(params).toContain('session-user-1');
  });
});

describe('handleGenericUpdate — fieldGuards now apply to API-key auth', () => {
  beforeEach(() => {
    mockGenerateEntitySchemas.mockReturnValue({
      update: { safeParse: (data: unknown) => ({ success: true, data }) },
    });
  });

  it('denies an API-key PATCH that touches a field the caller role is guarded from (previously bypassed unconditionally)', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(true);

    const request = makeRequest({
      method: 'PATCH',
      url: 'http://localhost/api/v1/pets/pet-1',
      headers: { 'x-team-id': 'team-1' },
      body: { notes: 'trying to sneak this in' },
    });
    const response = await handleGenericUpdate(request, { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) });

    expect((response as { status: number }).status).toBe(403);
    expect(mockMutateWithRLS).not.toHaveBeenCalled();
  });

  it('allows an API-key PATCH that does not touch a guarded field', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']));
    routeQueryOneWithRLS('member');
    mockCheckPermission.mockResolvedValue(true);
    mockQueryOneWithRLS.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM "team_members"')) return { role: 'member' };
      return { id: 'pet-1', name: 'Rex' };
    });
    mockMutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1', name: 'Rex Updated' }] });

    const request = makeRequest({
      method: 'PATCH',
      url: 'http://localhost/api/v1/pets/pet-1',
      headers: { 'x-team-id': 'team-1' },
      body: { name: 'Rex Updated' },
    });
    const response = await handleGenericUpdate(request, { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) });

    expect((response as { status: number }).status).not.toBe(403);
  });
});

describe('handleGenericCreate & handleGenericUpdate — a :write scope does not imply create AND update independently', () => {
  // scope-registry.mjs mints ':write' to any team role with EITHER 'create' OR
  // 'update' permission (see computeRoleScopes) — a role holding only 'update'
  // can legitimately end up with a working ':write'-scoped key. That's only
  // safe because checkAuthPermission re-checks the SPECIFIC action
  // ('<slug>.create' vs '<slug>.update') independently of the scope that got
  // the request past the coarse gate above it. These two tests fail if that
  // per-action recheck is ever weakened back into a scope-only gate.
  beforeEach(() => {
    mockGenerateEntitySchemas.mockReturnValue({
      create: { safeParse: (data: unknown) => ({ success: true, data }) },
      update: { safeParse: (data: unknown) => ({ success: true, data }) },
    });
  });

  it('denies create for a :write-scoped key whose team role can update but not create', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']));
    routeQueryOneWithRLS('member');
    // This role has every permission EXCEPT 'pets.create' — modeling a role
    // whose only write capability is 'update', which is enough to mint ':write'.
    mockCheckPermission.mockImplementation(async (_userId: string, _teamId: string, permission: string) =>
      permission !== 'pets.create'
    );

    const request = makeRequest({
      method: 'POST',
      url: 'http://localhost/api/v1/pets',
      headers: { 'x-team-id': 'team-1' },
      body: { name: 'Rex' },
    });
    const response = await handleGenericCreate(request);

    expect((response as { status: number }).status).toBe(403);
    expect(mockCheckPermission).toHaveBeenCalledWith('key-owner-1', 'team-1', 'pets.create');
    expect(mockMutateWithRLS).not.toHaveBeenCalled();
  });

  it('allows update for the SAME :write-scoped key, since that role does hold update permission', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']));
    mockCheckPermission.mockImplementation(async (_userId: string, _teamId: string, permission: string) =>
      permission !== 'pets.create'
    );
    mockQueryOneWithRLS.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM "team_members"')) return { role: 'member' };
      return { id: 'pet-1', name: 'Rex' };
    });
    mockMutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1', name: 'Rex Updated' }] });

    const request = makeRequest({
      method: 'PATCH',
      url: 'http://localhost/api/v1/pets/pet-1',
      headers: { 'x-team-id': 'team-1' },
      body: { name: 'Rex Updated' },
    });
    const response = await handleGenericUpdate(request, { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) });

    expect((response as { status: number }).status).not.toBe(403);
    expect(mockCheckPermission).toHaveBeenCalledWith('key-owner-1', 'team-1', 'pets.update');
  });
});

describe('handleGenericDelete — #94 satellite fix: checks :delete scope, not :write', () => {
  it('denies a key holding only the :write scope', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:write']));

    const request = makeRequest({
      method: 'DELETE',
      url: 'http://localhost/api/v1/pets/pet-1',
      headers: { 'x-team-id': 'team-1' },
    });
    const response = await handleGenericDelete(request, { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) });

    expect((response as { status: number }).status).toBe(403);
  });

  it('allows a key holding the :delete scope through the scope gate', async () => {
    mockAuthenticateRequest.mockResolvedValue(API_KEY_AUTH(['pets:delete']));
    routeQueryOneWithRLS('owner');
    mockCheckPermission.mockResolvedValue(true);
    mockQueryOneWithRLS.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT role FROM "team_members"')) return { role: 'owner' };
      if (sql.includes('SELECT id FROM "team_members"')) return { id: 'membership-1' };
      return { id: 'pet-1' };
    });
    mockMutateWithRLS.mockResolvedValue({ rows: [{ id: 'pet-1' }] });

    const request = makeRequest({
      method: 'DELETE',
      url: 'http://localhost/api/v1/pets/pet-1',
      headers: { 'x-team-id': 'team-1' },
    });
    const response = await handleGenericDelete(request, { params: Promise.resolve({ entity: 'pets', id: 'pet-1' }) });

    // Must not be rejected at the scope gate — later stages may still 404
    // depending on how much of the delete flow this fixture models, but a
    // 403 here specifically would mean the scope check regressed.
    expect((response as { status: number }).status).not.toBe(403);
  });
});
