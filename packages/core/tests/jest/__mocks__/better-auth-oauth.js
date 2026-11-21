/**
 * Mock for the OAuth packages of MCP browser sign-in (#541): @better-auth/mcp, @better-auth/cimd,
 * @better-auth/cimd/node and @better-auth/oauth-provider/client. They are ES modules; lib/auth.ts and
 * lib/auth-client.ts import them, so every suite that loads either needs them resolved.
 */
module.exports = {
  mcp: jest.fn(() => ({ id: 'oauth-provider' })),
  requireMcpAuth: jest.fn(),
  createMcpProtectedRequestHandler: jest.fn(),
  cimd: jest.fn(() => ({ id: 'cimd' })),
  fetchClientMetadataResource: jest.fn(),
  oauthProviderClient: jest.fn(() => ({ id: 'oauth-provider-client' })),
}
