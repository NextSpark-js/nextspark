/**
 * What `mcpOAuthPlugins` hands the OAuth provider (#541): which list is accepted, which is published and issued,
 * and whether this process may bring the stored policy of the resource to its own list.
 */
const mcp = jest.fn((_options: Record<string, unknown>) => ({ id: 'mcp' }));
// Jest maps the four OAuth packages of Better Auth to one mock file (jest.config), so one factory answers for all
jest.mock('@better-auth/mcp', () => ({
  mcp: (options: Record<string, unknown>) => mcp(options),
  cimd: () => ({ id: 'cimd' }),
  fetchClientMetadataResource: jest.fn(),
  tryGetCurrentAuthEndpointContext: () => undefined,
}));
jest.mock('better-auth/plugins', () => ({ jwt: () => ({ id: 'jwt' }) }));
jest.mock('better-auth', () => ({ APIError: class APIError extends Error {} }));
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn() }));
jest.mock('@/core/lib/base-path', () => ({ withBasePath: (path: string) => path }));
jest.mock('@/core/lib/auth/suspension', () => ({ isSuspendedRole: () => false }));
jest.mock('@/core/lib/mcp/oauth/allowed-clients', () => ({ isClientAllowed: () => true }));
jest.mock('@/core/lib/mcp/oauth/consent-plugin', () => ({
  consentWithinRolePlugin: () => ({ id: 'consent-within-role' }),
  refuseConsentSkippingClient: jest.fn(),
  refuseUnlistedClient: jest.fn(),
}));
jest.mock('@/core/lib/mcp/oauth/purge', () => ({ purgeExpiredOAuthIfDue: jest.fn() }));
jest.mock('@/core/lib/mcp/oauth/team-selection', () => ({
  isAuthorizationKey: () => true,
  selectableTeams: jest.fn(),
  selectedTeam: jest.fn(),
  selectTeam: jest.fn(),
}));
jest.mock('@/core/lib/mcp/oauth/revocation', () => ({ latestRevocation: jest.fn() }));

const enabled = { current: true };
jest.mock('@/core/lib/mcp/oauth/config', () => ({
  allowedClientHosts: () => null,
  isMcpOAuthEnabled: () => enabled.current,
  mcpResourceUrl: () => 'https://app.example.com/api/mcp',
  OIDC_SCOPES: ['openid', 'profile', 'email', 'offline_access'],
  REVOCATION_CLAIM: 'rev',
  TEAM_CLAIM: 'team',
}));
jest.mock('@/core/lib/mcp/oauth/scopes', () => ({
  // `tasks:delete` was retired: a role can still hold it, no tool uses it
  mcpOAuthAcceptedScopes: () => ['tasks:delete', 'tasks:read', 'tasks:write'],
  mcpOAuthResourceScopes: () => ['tasks:read', 'tasks:write'],
}));
const known = { current: true };
jest.mock('@/core/lib/mcp/oauth/tool-scopes', () => ({ mcpToolScopesKnown: () => known.current }));

import { mcpOAuthPlugins } from '@/core/lib/mcp/oauth/plugins';

const IDENTITY = ['openid', 'profile', 'email', 'offline_access'];

function providerOptions(): Record<string, unknown> {
  mcp.mockClear();
  mcpOAuthPlugins();
  expect(mcp).toHaveBeenCalledTimes(1);
  return mcp.mock.calls[0][0];
}

describe('what the OAuth provider is configured with (#541)', () => {
  afterEach(() => {
    enabled.current = true;
    known.current = true;
  });

  it('is nothing at all while the feature is off', () => {
    enabled.current = false;
    mcp.mockClear();
    expect(mcpOAuthPlugins()).toEqual([]);
    expect(mcp).not.toHaveBeenCalled();
  });

  it('accepts every scope a role can hold, and publishes and issues only the active ones', () => {
    const options = providerOptions();
    expect(options.scopes).toEqual([...IDENTITY, 'tasks:delete', 'tasks:read', 'tasks:write']);
    expect(options.advertisedMetadata).toEqual({ scopes_supported: [...IDENTITY, 'tasks:read', 'tasks:write'] });
    expect(options.resources).toEqual([
      { identifier: 'https://app.example.com/api/mcp', name: 'MCP', allowedScopes: [...IDENTITY, 'tasks:read', 'tasks:write'] },
    ]);
  });

  it('brings the stored policy of the resource to its list when it starts', () => {
    expect(providerOptions().resourceSeedMode).toBe('merge');
  });

  it('leaves the stored policy alone from a process that could not read the registries', () => {
    known.current = false;
    // the provider's default: insert the row when it is missing, never write over one that is there
    expect(providerOptions().resourceSeedMode).toBe('insertOnly');
  });
});
