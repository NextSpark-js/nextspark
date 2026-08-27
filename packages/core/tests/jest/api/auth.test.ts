/**
 * Unit Tests - validateScopesForUser / canCreateApiKeys
 *
 * Regression coverage for #94: these two functions previously checked a
 * hardcoded `scopesByRole` map keyed by the user's GLOBAL role (`users.role`),
 * referencing a nonexistent role (`colaborator`) and missing `owner`/`viewer`
 * entirely. They now resolve the caller's real TEAM role (for the team the
 * request targets) and check it against the registry-backed
 * `ScopeService.getRoleScopes()` — the same source of truth session auth's
 * implicit scopes and `checkPermission()` both use.
 */

const mockQueryOne = jest.fn();
jest.mock('@/core/lib/db', () => ({
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
}));

const mockGetRole = jest.fn();
const mockListByUser = jest.fn();
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: {
    getRole: (...args: unknown[]) => mockGetRole(...args),
    listByUser: (...args: unknown[]) => mockListByUser(...args),
  },
}));

const mockGetBaseScopes = jest.fn();
const mockGetRoleScopes = jest.fn();
jest.mock('@/core/lib/services/scope.service', () => ({
  ScopeService: {
    getBaseScopes: (...args: unknown[]) => mockGetBaseScopes(...args),
    getRoleScopes: (...args: unknown[]) => mockGetRoleScopes(...args),
  },
}));

import { validateScopesForUser, canCreateApiKeys } from '@/core/lib/api/auth';

describe('validateScopesForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBaseScopes.mockReturnValue([]);
  });

  it('grants everything to a superadmin regardless of team context', async () => {
    mockQueryOne.mockResolvedValue({ role: 'superadmin' });

    const result = await validateScopesForUser('user-1', null, ['pets:read', 'pets:delete']);

    expect(result).toEqual({
      valid: true,
      allowedScopes: ['pets:read', 'pets:delete'],
      deniedScopes: [],
    });
    expect(mockGetRole).not.toHaveBeenCalled();
  });

  it('denies a non-superadmin with no resolvable team context', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });

    const result = await validateScopesForUser('user-1', null, ['pets:read']);

    expect(result).toEqual({
      valid: false,
      allowedScopes: [],
      deniedScopes: ['pets:read'],
    });
    expect(mockGetRole).not.toHaveBeenCalled();
  });

  it('denies a non-superadmin who is not a member of the target team', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockGetRole.mockResolvedValue(null);

    const result = await validateScopesForUser('user-1', 'team-1', ['pets:read']);

    expect(result).toEqual({
      valid: false,
      allowedScopes: [],
      deniedScopes: ['pets:read'],
    });
    expect(mockGetRole).toHaveBeenCalledWith('team-1', 'user-1');
  });

  it('grants scopes covered by the caller real team role, denies the rest', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockGetRole.mockResolvedValue('member');
    mockGetRoleScopes.mockReturnValue(['pets:read']);

    const result = await validateScopesForUser('user-1', 'team-1', ['pets:read', 'pets:delete']);

    expect(result).toEqual({
      valid: false,
      allowedScopes: ['pets:read'],
      deniedScopes: ['pets:delete'],
    });
    expect(mockGetRoleScopes).toHaveBeenCalledWith('member');
  });

  it('grants everything to a team role whose scopes include the wildcard', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockGetRole.mockResolvedValue('owner');
    mockGetRoleScopes.mockReturnValue(['*']);

    const result = await validateScopesForUser('user-1', 'team-1', ['pets:read', 'pets:delete']);

    expect(result).toEqual({
      valid: true,
      allowedScopes: ['pets:read', 'pets:delete'],
      deniedScopes: [],
    });
  });

  it('includes base scopes in the allowed set for any real team role', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockGetRole.mockResolvedValue('viewer');
    mockGetBaseScopes.mockReturnValue(['tasks:read']);
    mockGetRoleScopes.mockReturnValue([]);

    const result = await validateScopesForUser('user-1', 'team-1', ['tasks:read']);

    expect(result.valid).toBe(true);
    expect(result.allowedScopes).toEqual(['tasks:read']);
  });

  it('denies for a nonexistent userId', async () => {
    mockQueryOne.mockResolvedValue(null);

    const result = await validateScopesForUser('ghost', 'team-1', ['pets:read']);

    expect(result).toEqual({
      valid: false,
      allowedScopes: [],
      deniedScopes: ['pets:read'],
    });
  });

  it('fails closed (denies) on an unexpected DB error', async () => {
    mockQueryOne.mockRejectedValue(new Error('connection lost'));

    const result = await validateScopesForUser('user-1', 'team-1', ['pets:read']);

    expect(result).toEqual({
      valid: false,
      allowedScopes: [],
      deniedScopes: ['pets:read'],
    });
  });
});

describe('canCreateApiKeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows a superadmin', async () => {
    mockQueryOne.mockResolvedValue({ role: 'superadmin' });

    await expect(canCreateApiKeys('user-1')).resolves.toBe(true);
    expect(mockListByUser).not.toHaveBeenCalled();
  });

  it('allows a non-superadmin whose team role scopes include admin:api-keys', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockListByUser.mockResolvedValue([{ role: 'admin' }]);
    mockGetRoleScopes.mockReturnValue(['admin:api-keys']);

    await expect(canCreateApiKeys('user-1')).resolves.toBe(true);
  });

  it('denies a non-superadmin with no qualifying team role', async () => {
    mockQueryOne.mockResolvedValue({ role: 'user' });
    mockListByUser.mockResolvedValue([{ role: 'member' }, { role: 'viewer' }]);
    mockGetRoleScopes.mockReturnValue(['pets:read']);

    await expect(canCreateApiKeys('user-1')).resolves.toBe(false);
  });

  it('denies for a nonexistent userId', async () => {
    mockQueryOne.mockResolvedValue(null);

    await expect(canCreateApiKeys('ghost')).resolves.toBe(false);
  });
});
