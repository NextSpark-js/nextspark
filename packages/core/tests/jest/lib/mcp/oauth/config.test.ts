import { isMcpEnabled, isMcpOAuthEnabled } from '@/core/lib/mcp/oauth/config';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('MCP browser sign-in switch (#541)', () => {
  it('is off unless MCP_OAUTH_ENABLED is exactly "true"', () => {
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: '1' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'TRUE' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'true' }))).toBe(true);
  });

  it('never counts while the MCP endpoint is off', () => {
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'true', MCP_ENABLED: 'false' }))).toBe(false);
    // production: MCP itself is off unless MCP_ENABLED=true
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production', MCP_OAUTH_ENABLED: 'true' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production', MCP_OAUTH_ENABLED: 'true', MCP_ENABLED: 'true' }))).toBe(true);
  });

  it('keeps the MCP kill switch as it was', () => {
    expect(isMcpEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(isMcpEnabled(env({ NODE_ENV: 'development', MCP_ENABLED: 'false' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production', MCP_ENABLED: 'true' }))).toBe(true);
  });
});
