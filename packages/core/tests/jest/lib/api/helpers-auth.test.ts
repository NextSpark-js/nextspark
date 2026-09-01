/**
 * Regression coverage for #112: `validateAndAuthenticateRequest()` tried a
 * session lookup and, on failure, fell back to API-key validation — which
 * THREW (`Invalid API key`) when no key was present either. Any route that
 * called the helper inside a generic try/catch (the common pattern for a
 * stable JSON error shape) therefore answered an anonymous request with a
 * 500 instead of the 401 its own `!auth` branch would have produced.
 *
 * The helper now resolves to `{ auth: null }` for unauthenticated requests,
 * matching its own session-lookup failure behaviour, so routes' existing 401
 * branches work as written. The API-key-only variant
 * (`validateAndAuthenticateApiRequest`) keeps its strict throwing contract.
 */

const mockValidateApiKey = jest.fn();
jest.mock('@/core/lib/api/auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
}));

const mockGetSession = jest.fn();
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}));

const mockCheckRateLimit = jest.fn();
jest.mock('@/core/lib/api/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  addRateLimitHeaders: jest.fn(),
}));

jest.mock('@/core/lib/db', () => ({
  mutateWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
}));
jest.mock('@/core/lib/config', () => ({
  getApplicationConfig: jest.fn(),
}));
jest.mock('@/core/lib/services/meta.service', () => ({
  MetaService: {},
}));
jest.mock('@/core/lib/services/scope.service', () => ({
  ScopeService: {
    getBaseScopes: () => ['tasks:read'],
    getRoleScopes: (role: string) => (role === 'superadmin' ? ['*'] : []),
    getFlagScopes: () => [],
    getRestrictionRules: () => ({}),
    getAllowedFilters: () => [],
  },
}));
jest.mock('@/core/lib/entities/registry', () => ({
  getEntityConfig: jest.fn(),
}));
jest.mock('@/core/lib/entities/queries', () => ({
  getChildEntities: jest.fn(),
  getEntity: jest.fn(),
}));

import { NextRequest, NextResponse } from 'next/server';
import {
  validateAndAuthenticateRequest,
  validateAndAuthenticateApiRequest,
} from '@/core/lib/api/helpers';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new (NextRequest as unknown as {
    new (url: string, init?: { headers?: Record<string, string> }): NextRequest;
  })('http://localhost/api/v1/protected', { headers });
}

const VALID_KEY_AUTH = { userId: 'user-1', keyId: 'key-1', scopes: ['tasks:read'] };

describe('validateAndAuthenticateRequest (#112)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    mockCheckRateLimit.mockReturnValue({ allowed: true, limit: 100, remaining: 99, resetTime: Date.now() + 60_000 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves to a null auth (instead of throwing) when the request carries neither a session nor an API key', async () => {
    mockValidateApiKey.mockResolvedValue(null);

    await expect(validateAndAuthenticateRequest(makeRequest())).resolves.toEqual({ auth: null });
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it('resolves to a null auth when a cookie is present but no session backs it and no API key is sent', async () => {
    mockGetSession.mockResolvedValue(null);
    mockValidateApiKey.mockResolvedValue(null);

    await expect(
      validateAndAuthenticateRequest(makeRequest({ cookie: 'better-auth.session_token=stale' })),
    ).resolves.toEqual({ auth: null });
  });

  it('resolves to a null auth when the session lookup itself throws and no API key is sent', async () => {
    mockGetSession.mockRejectedValue(new Error('session store unavailable'));
    mockValidateApiKey.mockResolvedValue(null);

    await expect(
      validateAndAuthenticateRequest(makeRequest({ cookie: 'better-auth.session_token=broken' })),
    ).resolves.toEqual({ auth: null });
  });

  it('resolves to a null auth when an API key is sent but is invalid', async () => {
    mockValidateApiKey.mockResolvedValue(null);

    await expect(
      validateAndAuthenticateRequest(makeRequest({ authorization: 'Bearer testkey_bogus' })),
    ).resolves.toEqual({ auth: null });
  });

  it('still resolves an API-key auth (with rate limiting applied) for a valid key', async () => {
    mockValidateApiKey.mockResolvedValue(VALID_KEY_AUTH);

    const result = await validateAndAuthenticateRequest(makeRequest({ 'x-api-key': 'testkey_valid' }));

    expect(result.auth).toEqual(VALID_KEY_AUTH);
    expect(result.rateLimitResponse).toBeUndefined();
    expect(mockCheckRateLimit).toHaveBeenCalledWith('key-1');
  });

  it('still returns the 429 rate-limit response alongside the auth for a throttled valid key', async () => {
    mockValidateApiKey.mockResolvedValue(VALID_KEY_AUTH);
    mockCheckRateLimit.mockReturnValue({ allowed: false, limit: 100, remaining: 0, resetTime: Date.now() + 30_000 });

    const result = await validateAndAuthenticateRequest(makeRequest({ 'x-api-key': 'testkey_valid' }));

    expect(result.auth).toEqual(VALID_KEY_AUTH);
    expect(result.rateLimitResponse?.status).toBe(429);
  });

  it('still resolves a session auth for a valid session without consulting the API-key path', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user-9', role: 'superadmin' } });

    const result = await validateAndAuthenticateRequest(makeRequest({ cookie: 'better-auth.session_token=ok' }));

    expect(result.auth).toMatchObject({ userId: 'user-9', isSession: true, scopes: ['tasks:read', '*'] });
    expect(mockValidateApiKey).not.toHaveBeenCalled();
  });

  it('lets a route that wraps the helper in a generic try/catch answer an anonymous request with 401, not 500', async () => {
    mockValidateApiKey.mockResolvedValue(null);

    // The exact shape the issue describes: a stable JSON error envelope via
    // try/catch, with the route's own 401 branch right after the call.
    async function route(request: NextRequest): Promise<NextResponse> {
      try {
        const { auth } = await validateAndAuthenticateRequest(request);
        if (!auth?.userId) {
          return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
      }
    }

    const response = await route(makeRequest());

    expect(response.status).toBe(401);
  });
});

describe('validateAndAuthenticateApiRequest (API-key-only, strict)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, limit: 100, remaining: 99, resetTime: Date.now() + 60_000 });
  });

  it('keeps throwing when no valid API key is present (its documented strict contract)', async () => {
    mockValidateApiKey.mockResolvedValue(null);

    await expect(validateAndAuthenticateApiRequest(makeRequest())).rejects.toThrow('Invalid API key');
  });

  it('resolves the auth for a valid key', async () => {
    mockValidateApiKey.mockResolvedValue(VALID_KEY_AUTH);

    await expect(validateAndAuthenticateApiRequest(makeRequest({ 'x-api-key': 'testkey_valid' }))).resolves.toEqual({
      auth: VALID_KEY_AUTH,
    });
  });
});
