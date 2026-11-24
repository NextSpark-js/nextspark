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
    // and sign-in has its production gate on top (production-gate.test.ts): here, with Redis configured
    expect(isMcpOAuthEnabled(env({ NODE_ENV: 'production', MCP_ENABLED: 'true', UPSTASH_REDIS_REST_URL: 'https://redis.example', UPSTASH_REDIS_REST_TOKEN: 'token' }))).toBe(true);
  });

  it('keeps the MCP kill switch as it was', () => {
    expect(isMcpEnabled(env({ NODE_ENV: 'development' }))).toBe(true);
    expect(isMcpEnabled(env({ NODE_ENV: 'development', MCP_ENABLED: 'false' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production' }))).toBe(false);
    expect(isMcpEnabled(env({ NODE_ENV: 'production', MCP_ENABLED: 'true' }))).toBe(true);
  });
});

describe('the URLs of MCP browser sign-in (#541)', () => {
  const saved = { base: process.env.__NEXT_ROUTER_BASEPATH, auth: process.env.BETTER_AUTH_URL, app: process.env.NEXT_PUBLIC_APP_URL };
  afterEach(() => {
    for (const [name, value] of [['__NEXT_ROUTER_BASEPATH', saved.base], ['BETTER_AUTH_URL', saved.auth], ['NEXT_PUBLIC_APP_URL', saved.app]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    jest.resetModules();
  });
  const load = ({ basePath = '', auth, app = 'https://app.example' }: { basePath?: string; auth?: string; app?: string }) => {
    jest.resetModules();
    if (basePath) process.env.__NEXT_ROUTER_BASEPATH = basePath;
    else delete process.env.__NEXT_ROUTER_BASEPATH;
    if (auth) process.env.BETTER_AUTH_URL = auth;
    else delete process.env.BETTER_AUTH_URL;
    process.env.NEXT_PUBLIC_APP_URL = app;
    return require('@/core/lib/mcp/oauth/config') as typeof import('@/core/lib/mcp/oauth/config');
  };

  it('one origin, no basePath: the documents are at the RFC locations', () => {
    const config = load({});
    expect(config.mcpResourceUrl()).toBe('https://app.example/api/mcp');
    expect(config.mcpOAuthIssuer()).toBe('https://app.example/api/auth');
    expect(config.mcpResourceMetadataUrl()).toBe('https://app.example/.well-known/oauth-protected-resource/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource/api/mcp')).toBe('/.well-known/oauth-protected-resource/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-authorization-server/api/auth')).toBe('/.well-known/oauth-authorization-server/api/auth');
  });

  it('a trailing slash in the app URL changes nothing', () => {
    expect(load({ app: 'https://app.example/' }).mcpResourceUrl()).toBe('https://app.example/api/mcp');
  });

  it('under a basePath the resource, the issuer and the metadata are inside it, and Better Auth is asked at the RFC location', () => {
    const config = load({ basePath: '/base' });
    expect(config.mcpResourceUrl()).toBe('https://app.example/base/api/mcp');
    expect(config.mcpOAuthIssuer()).toBe('https://app.example/base/api/auth');
    expect(config.mcpResourceMetadataUrl()).toBe('https://app.example/base/.well-known/oauth-protected-resource/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource/api/mcp')).toBe('/.well-known/oauth-protected-resource/base/api/mcp');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-authorization-server/api/auth')).toBe('/.well-known/oauth-authorization-server/base/api/auth');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource')).toBe('/.well-known/oauth-protected-resource');
    expect(config.oauthDiscoveryPath('/somewhere/else')).toBe('/somewhere/else');
  });

  it('a BETTER_AUTH_URL on another origin with a path of its own: the resource is the app\'s, the issuer is that URL as it is', () => {
    const config = load({ basePath: '/base', auth: 'https://auth.example.com/custom-auth', app: 'https://app.example.com' });
    expect(config.mcpResourceUrl()).toBe('https://app.example.com/base/api/mcp');
    expect(config.mcpResourceMetadataUrl()).toBe('https://app.example.com/base/.well-known/oauth-protected-resource/api/mcp');
    expect(config.mcpOAuthIssuer()).toBe('https://auth.example.com/custom-auth');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-authorization-server/api/auth')).toBe('/.well-known/oauth-authorization-server/custom-auth');
    expect(config.oauthDiscoveryPath('/.well-known/oauth-protected-resource/api/mcp')).toBe('/.well-known/oauth-protected-resource/base/api/mcp');
  });

  it('a BETTER_AUTH_URL on another origin without a path: the issuer is that origin with the base path and /api/auth', () => {
    const config = load({ auth: 'https://auth.example.com', app: 'https://app.example.com' });
    expect(config.mcpResourceUrl()).toBe('https://app.example.com/api/mcp');
    expect(config.mcpOAuthIssuer()).toBe('https://auth.example.com/api/auth');
  });
});
