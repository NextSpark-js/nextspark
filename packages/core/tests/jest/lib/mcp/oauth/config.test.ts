let built = true;
jest.mock('@nextsparkjs/registries/features', () => ({
  get FEATURES() {
    return { billing: true, superadmin: true, mcpOAuth: built };
  },
}));

import { isMcpEnabled, isMcpOAuthBuilt, isMcpOAuthEnabled } from '@/core/lib/mcp/oauth/config';

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe('MCP browser sign-in switch (#541)', () => {
  afterEach(() => { built = true; });

  it('is off in a project that did not set features.mcpOAuth, whatever the environment says', () => {
    built = false;
    expect(isMcpOAuthBuilt()).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'true' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production', MCP_OAUTH_ENABLED: 'true', MCP_ENABLED: 'true' }))).toBe(false);
  });

  it('is on in a project that set it, unless MCP_OAUTH_ENABLED=false switches it off', () => {
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'true' }))).toBe(true);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_OAUTH_ENABLED: 'false' }))).toBe(false);
  });

  it('never counts while the MCP endpoint is off', () => {
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'development', MCP_ENABLED: 'false' }))).toBe(false);
    // production: MCP itself is off unless MCP_ENABLED=true
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production', MCP_ENABLED: 'true' }))).toBe(true);
  });

  it('keeps the MCP kill switch as it was', () => {
    expect(isMcpEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(isMcpEnabled(env({ NODE_ENV: 'development', MCP_ENABLED: 'false' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production', MCP_ENABLED: 'true' }))).toBe(true);
  });
});

describe('discovery under a Next.js basePath (#541)', () => {
  const saved = { base: process.env.__NEXT_ROUTER_BASEPATH, url: process.env.BETTER_AUTH_URL };
  afterEach(() => {
    process.env.__NEXT_ROUTER_BASEPATH = saved.base;
    process.env.BETTER_AUTH_URL = saved.url;
    jest.resetModules();
  });
  const load = (basePath: string) => {
    jest.resetModules();
    if (basePath) process.env.__NEXT_ROUTER_BASEPATH = basePath;
    else delete process.env.__NEXT_ROUTER_BASEPATH;
    process.env.BETTER_AUTH_URL = 'https://app.example';
    return require('@/core/lib/mcp/oauth/config') as typeof import('@/core/lib/mcp/oauth/config');
  };

  it('without one, the documents are at the RFC locations', () => {
    const config = load('');
    expect(config.mcpResourceUrl()).toBe('https://app.example/api/mcp');
    expect(config.mcpResourceMetadataUrl()).toBe('https://app.example/.well-known/oauth-protected-resource/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource/api/mcp')).toBe('/.well-known/oauth-protected-resource/api/mcp');
  });

  it('with one, the resource, the issuer and the metadata are inside it, and Better Auth is asked at the RFC location', () => {
    const config = load('/base');
    expect(config.mcpResourceUrl()).toBe('https://app.example/base/api/mcp');
    expect(config.mcpOAuthIssuer()).toBe('https://app.example/base/api/auth');
    expect(config.mcpResourceMetadataUrl()).toBe('https://app.example/base/.well-known/oauth-protected-resource/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource/api/mcp')).toBe('/.well-known/oauth-protected-resource/base/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-authorization-server/api/auth')).toBe('/.well-known/oauth-authorization-server/base/api/auth');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource')).toBe('/.well-known/oauth-protected-resource');
    expect(config.oauthDiscoveryPath('/somewhere/else')).toBe('/somewhere/else');
  });
});
