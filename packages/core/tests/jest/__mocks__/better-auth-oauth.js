/**
 * Mock for the OAuth packages of MCP browser sign-in (#541): @better-auth/mcp, @better-auth/cimd,
 * @better-auth/cimd/node, @better-auth/oauth-provider/client and @better-auth/core/context. They are ES modules; lib/auth.ts and
 * lib/auth-client.ts import them, so every suite that loads either needs them resolved.
 */
module.exports = {
  mcp: jest.fn(() => ({ id: 'oauth-provider' })),
  requireMcpAuth: jest.fn(),
  createMcpProtectedRequestHandler: jest.fn(),
  cimd: jest.fn(() => ({ id: 'cimd' })),
  fetchClientMetadataResource: jest.fn(),
  tryGetCurrentAuthEndpointContext: jest.fn(() => undefined),
  oauthProviderClient: jest.fn(() => ({ id: 'oauth-provider-client' })),
}
