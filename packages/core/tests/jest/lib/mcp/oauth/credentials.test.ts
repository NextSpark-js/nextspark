jest.mock('@/core/lib/auth', () => ({ auth: {} }));
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn() }));
jest.mock('@/core/lib/api/auth', () => ({ validateScopesForUser: jest.fn() }));
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getById: jest.fn() } }));
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: { isMember: jest.fn() } }));

import { presentsApiKey, presentsOAuthBearer } from '@/core/lib/mcp/oauth/resource-server';

const KEY = `sk_live_${'a'.repeat(64)}`;
const request = (headers: Record<string, string>) => new Request('http://localhost/api/mcp', { method: 'POST', headers });

describe('which credential an MCP request presents (#541)', () => {
  it('an API key in x-api-key or as a bearer in the key format', () => {
    expect(presentsApiKey(request({ 'x-api-key': KEY }))).toBe(true);
    expect(presentsApiKey(request({ authorization: `Bearer ${KEY}` }))).toBe(true);
    expect(presentsApiKey(request({ authorization: `Bearer sk_test_${'b'.repeat(64)}` }))).toBe(true);
    expect(presentsOAuthBearer(request({ authorization: `Bearer ${KEY}` }))).toBe(false);
  });

  it('any other bearer is an OAuth one', () => {
    expect(presentsApiKey(request({ authorization: 'Bearer eyJhbGciOiJFZERTQSJ9.e30.sig' }))).toBe(false);
    expect(presentsOAuthBearer(request({ authorization: 'Bearer eyJhbGciOiJFZERTQSJ9.e30.sig' }))).toBe(true);
    // a token that only contains the key prefix further in is not a key
    expect(presentsApiKey(request({ authorization: 'Bearer xsk_live_abc' }))).toBe(false);
  });

  it('no credential presents neither, and both can be told apart when sent together', () => {
    expect(presentsApiKey(request({}))).toBe(false);
    expect(presentsOAuthBearer(request({}))).toBe(false);
    const both = request({ 'x-api-key': KEY, authorization: 'Bearer eyJhbGciOiJFZERTQSJ9.e30.sig' });
    expect(presentsApiKey(both) && presentsOAuthBearer(both)).toBe(true);
  });
});

describe('an empty x-api-key header (#541)', () => {
  it('is not a credential, so the request still gets the OAuth challenge', () => {
    expect(presentsApiKey(request({ 'x-api-key': '' }))).toBe(false);
    expect(presentsApiKey(request({ 'x-api-key': '   ' }))).toBe(false);
  });
});
