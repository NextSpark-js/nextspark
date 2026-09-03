/**
 * Coverage for #93: API-key scopes were validated on creation, stored and
 * returned — but nothing in the request path required a route to check them.
 * `authenticateRequest()` handed back a populated `scopes` array nobody was
 * obliged to look at, so a key minted as `tasks:read` authenticated on every
 * route that only gated on the key owner's role, with that owner's full
 * permissions. The default was permissive and the omission invisible.
 *
 * The API-key path now fails closed at the shared entry point:
 *   - a route declares the scope(s) it needs via `{ requiredScope }`;
 *   - a route that genuinely accepts any valid key says so via
 *     `{ allowAnyScope: true }`;
 *   - a route that declares nothing rejects API keys (403 SCOPE_NOT_DECLARED)
 *     and logs the route, so forgetting is visible instead of over-privileged.
 * Session auth has no scopes and is unaffected.
 *
 * These tests drive the real `authenticateRequest` with only the I/O edges
 * mocked (key validation, user lookup, session lookup).
 */

const mockValidateApiKey = jest.fn();
jest.mock('@/core/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

const mockGetSession = jest.fn();
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

const mockQueryOne = jest.fn();
jest.mock('@/core/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: { isMember: jest.fn() },
}));
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: { getById: jest.fn() },
}));

import { NextRequest } from 'next/server';
import {
  authenticateRequest,
  hasRequiredScope,
  createAuthFailureResponse,
  type DualAuthResult,
} from '@/core/lib/api/auth/dual-auth';

function makeRequest(headers: Record<string, string> = {}, path = '/api/v1/teams'): NextRequest {
  const url = `http://localhost${path}`;
  const req = new (NextRequest as unknown as {
    new (url: string, init?: { headers?: Record<string, string> }): NextRequest;
  })(url, { headers });
  (req as unknown as { nextUrl: URL }).nextUrl = new URL(url);
  return req;
}

const KEY_HEADERS = { authorization: 'Bearer testkey_limited' };

/** A key minted with a single narrow scope, owned by a superadmin. */
function primeLimitedKey(scopes: string[] = ['tasks:read']) {
  mockValidateApiKey.mockResolvedValue({ userId: 'user-sa', keyId: 'key-1', scopes });
  // dual-auth looks up the owner, then their default team.
  mockQueryOne
    .mockResolvedValueOnce({ email: 'sa@test.dev', role: 'superadmin', name: 'SA' })
    .mockResolvedValueOnce({ teamId: 'team-1' });
}

describe('authenticateRequest — API-key scope enforcement fails closed (#93)', () => {
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects an API key when the route declared no scope, instead of silently accepting it', async () => {
    primeLimitedKey(['tasks:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS));

    expect(result.success).toBe(false);
    // #128: the key is real and identified even though the request is denied —
    // `user`/`keyId` are carried over (not nulled) so a denial like this one
    // can still be attributed in the audit log, instead of looking anonymous.
    expect(result.user?.id).toBe('user-sa');
    expect(result.keyId).toBe('key-1');
    expect(result.type).toBe('api-key');
    expect(result.error).toMatchObject({ code: 'SCOPE_NOT_DECLARED', status: 403 });
  });

  it('names the offending route in the log when a declaration is missing, so the omission is visible', async () => {
    primeLimitedKey(['tasks:read']);

    await authenticateRequest(makeRequest(KEY_HEADERS, '/api/v1/teams'));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/teams'));
  });

  it('does not fall back to session auth for a key it rejected on scope', async () => {
    primeLimitedKey(['tasks:read']);

    await authenticateRequest(makeRequest({ ...KEY_HEADERS, cookie: 'better-auth.session_token=x' }));

    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('accepts an API key that holds the declared scope', async () => {
    primeLimitedKey(['tasks:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), { requiredScope: 'tasks:read' });

    expect(result.success).toBe(true);
    expect(result.type).toBe('api-key');
    expect(result.user?.id).toBe('user-sa');
    expect(result.scopes).toEqual(['tasks:read']);
    expect(result.error).toBeUndefined();
  });

  it('rejects an API key that lacks the declared scope with 403 INSUFFICIENT_SCOPE, whatever the owner role', async () => {
    primeLimitedKey(['tasks:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), { requiredScope: 'teams:write' });

    expect(result.success).toBe(false);
    // #128: identity is preserved on a scope denial (see previous test).
    expect(result.user?.id).toBe('user-sa');
    expect(result.error).toMatchObject({ code: 'INSUFFICIENT_SCOPE', status: 403 });
    expect(result.error?.message).toContain('teams:write');
  });

  it('treats an array of required scopes as any-of', async () => {
    primeLimitedKey(['media:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), {
      requiredScope: ['media:read', 'media:write'],
    });

    expect(result.success).toBe(true);
  });

  it('treats an empty required-scope list as no declaration at all (fails closed)', async () => {
    primeLimitedKey(['media:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), { requiredScope: [] });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SCOPE_NOT_DECLARED');
  });

  it('lets the wildcard key through any declared scope', async () => {
    primeLimitedKey(['*']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), { requiredScope: 'admin:api-keys' });

    expect(result.success).toBe(true);
  });

  it('accepts any valid key when the route explicitly opts out with allowAnyScope', async () => {
    primeLimitedKey(['tasks:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), { allowAnyScope: true });

    expect(result.success).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('still enforces a declared scope even when allowAnyScope is also (contradictorily) set', async () => {
    primeLimitedKey(['tasks:read']);

    const result = await authenticateRequest(makeRequest(KEY_HEADERS), {
      requiredScope: 'teams:write',
      allowAnyScope: true,
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INSUFFICIENT_SCOPE');
  });

  it('leaves session auth untouched: no declaration needed', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-s', email: 's@test.dev', role: 'member', name: 'S' } });
    mockQueryOne.mockResolvedValueOnce({ teamId: 'team-1' });

    const result = await authenticateRequest(makeRequest({ cookie: 'better-auth.session_token=ok' }));

    expect(result.success).toBe(true);
    expect(result.type).toBe('session');
  });

  it('leaves session auth untouched: a declared scope is not applied to sessions', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-s', email: 's@test.dev', role: 'member', name: 'S' } });
    mockQueryOne.mockResolvedValueOnce({ teamId: 'team-1' });

    const result = await authenticateRequest(makeRequest({ cookie: 'better-auth.session_token=ok' }), {
      requiredScope: 'admin:api-keys',
    });

    expect(result.success).toBe(true);
  });

  it('reports a plain unauthenticated request as a 401 AUTHENTICATION_FAILED failure', async () => {
    mockGetSession.mockResolvedValue(null);

    const result = await authenticateRequest(makeRequest(), { requiredScope: 'tasks:read' });

    expect(result.success).toBe(false);
    expect(result.type).toBe('none');
    expect(result.error).toMatchObject({ code: 'AUTHENTICATION_FAILED', status: 401 });
  });
});

describe('hasRequiredScope', () => {
  const apiKey = (scopes: string[]): DualAuthResult => ({
    success: true,
    type: 'api-key',
    user: { id: 'u', email: 'u@test.dev', role: 'member' },
    scopes,
  });

  it('accepts an array of scopes as any-of', () => {
    expect(hasRequiredScope(apiKey(['media:write']), ['media:read', 'media:write'])).toBe(true);
    expect(hasRequiredScope(apiKey(['tasks:read']), ['media:read', 'media:write'])).toBe(false);
  });

  it('never matches an empty list', () => {
    expect(hasRequiredScope(apiKey(['*']), [])).toBe(false);
  });
});

describe('createAuthFailureResponse', () => {
  it('turns a scope failure into a 403 carrying the failure code', async () => {
    const result: DualAuthResult = {
      success: false,
      type: 'api-key',
      user: null,
      error: { code: 'INSUFFICIENT_SCOPE', status: 403, message: "API key lacks required scope 'teams:write'" },
    };

    const response = createAuthFailureResponse(result);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'INSUFFICIENT_SCOPE' });
  });

  it('turns a plain authentication failure into a 401', async () => {
    const response = createAuthFailureResponse({ success: false, type: 'none', user: null });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ success: false, code: 'AUTHENTICATION_FAILED' });
  });
});
