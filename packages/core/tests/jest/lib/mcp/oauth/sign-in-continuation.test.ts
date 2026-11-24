import { oauthAuthorizePath } from '@/core/lib/mcp/oauth/sign-in-continuation';

const LOGIN = '?response_type=code&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&scope=tasks%3Aread+offline_access&state=abc&client_id=https%3A%2F%2Fclaude.ai%2Foauth%2Fmcp-oauth-client-metadata&code_challenge=xyz&code_challenge_method=S256&resource=https%3A%2F%2Fapp.example%2Fapi%2Fmcp&exp=1795286161&ba_iat=1795285561805&ba_param=ba_iat&ba_param=client_id&ba_param=exp&sig=mDM5TRDBejqNEP0S%2BPQ%3D';

describe('the authorization a login page was opened for (#541)', () => {
  it('is the client\'s request again, without what the server added to sign it', () => {
    const path = oauthAuthorizePath(LOGIN)!;
    const url = new URL(path, 'http://x');
    expect(url.pathname).toBe('/api/auth/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
      scope: 'tasks:read offline_access',
      state: 'abc',
      client_id: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
      code_challenge: 'xyz',
      code_challenge_method: 'S256',
      resource: 'https://app.example/api/mcp',
    });
  });

  it('is none for an ordinary login page', () => {
    expect(oauthAuthorizePath('')).toBeNull();
    expect(oauthAuthorizePath('?callbackUrl=%2Fdashboard')).toBeNull();
    // parameters that look like a request but were not signed by the authorization server
    expect(oauthAuthorizePath('?response_type=code&client_id=x')).toBeNull();
    expect(oauthAuthorizePath('?sig=abc')).toBeNull();
    expect(oauthAuthorizePath('?sig=abc&client_id=x&response_type=token')).toBeNull();
  });

  it('always stays on the app\'s own authorization endpoint', () => {
    for (const search of ['?sig=a&response_type=code&client_id=//evil.example', '?sig=a&response_type=code&client_id=x&redirect_uri=https://evil.example']) {
      expect(oauthAuthorizePath(search)!.startsWith('/api/auth/oauth2/authorize?')).toBe(true);
    }
  });
});
