import { isClientAllowed, isRequestAllowed, presentedClientIds, readAllowList } from '@/core/lib/mcp/oauth/allowed-clients';

const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const jwt = (payload: Record<string, unknown>) => `e30.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;

describe('which applications may connect by MCP browser sign-in (#541)', () => {
  it('every application may while the project sets no list or an empty one, and only then', () => {
    for (const list of [undefined, []]) {
      expect(readAllowList(list)).toEqual({ open: true, hosts: [], unusable: [] });
      expect(isClientAllowed(CLAUDE, list)).toBe(true);
      expect(isClientAllowed('https://anything.example/client.json', list)).toBe(true);
      expect(isClientAllowed('opaque-id', list)).toBe(true);
    }
  });

  it('a list that is there and names no usable host closes the server to every application: it does not open it', () => {
    // `null` too: only a setting that is not there at all means no list
    for (const list of [['not a host!'], [''], [42], ['https//claude.ai'], ['claude.ai:8443'], ['claude.ai/path'], ['user@claude.ai'], 'claude.ai', { 0: 'claude.ai' }, null, 0, false]) {
      expect(readAllowList(list).open).toBe(false);
      expect(isClientAllowed(CLAUDE, list)).toBe(false);
      expect(isClientAllowed('https://anything.example/client.json', list)).toBe(false);
    }
  });

  it('one unusable entry among usable ones is left out and reported, and the others still decide', () => {
    expect(readAllowList(['claude.ai', 'a b', 7, '*.example.com'])).toEqual({ open: false, hosts: ['claude.ai', '*.example.com'], unusable: ['a b', '7'] });
    expect(isClientAllowed(CLAUDE, ['claude.ai', 'a b'])).toBe(true);
    expect(isClientAllowed('https://evil.example/client.json', ['claude.ai', 'a b'])).toBe(false);
  });

  it('an entry pasted as a URL, or written as an international name, names its host', () => {
    expect(readAllowList(['https://claude.ai', 'ChatGPT.com/', ' *.Example.COM '])).toEqual({ open: false, hosts: ['claude.ai', 'chatgpt.com', '*.example.com'], unusable: [] });
    // compared in the ASCII form a URL carries
    expect(readAllowList(['éxample.com'])).toEqual({ open: false, hosts: ['xn--xample-9ua.com'], unusable: [] });
    expect(isClientAllowed('https://éxample.com/client.json', ['éxample.com'])).toBe(true);
    // http is not a way to name an accepted host
    expect(readAllowList(['http://claude.ai']).open).toBe(false);
    expect(isClientAllowed(CLAUDE, ['http://claude.ai'])).toBe(false);
  });

  it('with a list, only a client id that is an https URL on one of its hosts', () => {
    const list = ['claude.ai', 'chatgpt.com'];
    expect(isClientAllowed(CLAUDE, list)).toBe(true);
    expect(isClientAllowed('https://chatgpt.com/oauth/client.json', list)).toBe(true);
    expect(isClientAllowed('https://evil.example/claude.ai/client.json', list)).toBe(false);
    // the host is what counts, not what the URL contains
    expect(isClientAllowed('https://claude.ai.evil.example/client.json', list)).toBe(false);
    expect(isClientAllowed('https://evilclaude.ai/client.json', list)).toBe(false);
    expect(isClientAllowed('https://claude.ai@evil.example/client.json', list)).toBe(false);
    // credentials in the URL are no part of an application's id
    expect(isClientAllowed('https://user@claude.ai/client.json', list)).toBe(false);
    expect(isClientAllowed('https://user:secret@claude.ai/client.json', list)).toBe(false);
    // a subdomain is another host unless the list says otherwise
    expect(isClientAllowed('https://api.claude.ai/client.json', list)).toBe(false);
    expect(isClientAllowed('http://claude.ai/client.json', list)).toBe(false);
  });

  it('an id that names no host is refused once there is a list', () => {
    for (const id of ['opaque-id', '', null, undefined, 'claude.ai']) expect(isClientAllowed(id, ['claude.ai'])).toBe(false);
  });

  it('`*.` in front of a host accepts its subdomains, and not the host itself or a look-alike', () => {
    const list = ['*.example.com'];
    expect(isClientAllowed('https://apps.example.com/client.json', list)).toBe(true);
    expect(isClientAllowed('https://a.b.example.com/client.json', list)).toBe(true);
    expect(isClientAllowed('https://example.com/client.json', list)).toBe(false);
    expect(isClientAllowed('https://evilexample.com/client.json', list)).toBe(false);
  });

  it('hosts are compared without case, surrounding space or a trailing dot; the port of the client id does not count', () => {
    expect(isClientAllowed('https://CLAUDE.AI:443/client.json', [' Claude.ai. '])).toBe(true);
    expect(isClientAllowed('https://claude.ai:8443/client.json', ['claude.ai'])).toBe(true);
  });
});

const basic = (clientId: string) => `Basic ${Buffer.from(`${encodeURIComponent(clientId)}:secret`).toString('base64')}`;
const EVIL = 'https://evil.example/client.json';

describe('the clients a request after authorization names', () => {
  it('are the client_id of the body, the subject of a client assertion, the user of HTTP Basic and the azp of an access token', () => {
    expect(presentedClientIds({ body: { grant_type: 'refresh_token', client_id: CLAUDE } })).toEqual([CLAUDE]);
    expect(presentedClientIds({ body: {}, authorization: basic(CLAUDE) })).toEqual([CLAUDE]);
    expect(presentedClientIds({ body: { client_assertion: jwt({ sub: CLAUDE, iss: CLAUDE }) } })).toEqual([CLAUDE]);
    expect(presentedClientIds({ authorization: `Bearer ${jwt({ azp: CLAUDE, sub: 'user-1' })}` })).toEqual([CLAUDE]);
    expect(presentedClientIds({ authorization: `DPoP ${jwt({ client_id: CLAUDE })}` })).toEqual([CLAUDE]);
    // the access token as a form field (RFC 6750 section 2.2), which the identity endpoint accepts too
    expect(presentedClientIds({ body: { access_token: jwt({ azp: CLAUDE }) } })).toEqual([CLAUDE]);
  });

  it('are all of them when a request names more than one, wherever each is', () => {
    expect(presentedClientIds({ body: { client_id: CLAUDE }, authorization: basic(EVIL) })).toEqual([CLAUDE, EVIL]);
    expect(presentedClientIds({ body: { access_token: jwt({ azp: EVIL }) }, authorization: `Bearer ${jwt({ azp: CLAUDE })}` })).toEqual([EVIL, CLAUDE]);
    expect(presentedClientIds({ body: { client_id: CLAUDE, client_assertion: jwt({ sub: EVIL, iss: CLAUDE }) } })).toEqual([CLAUDE, EVIL]);
  });

  it('are none for a request that names no client, or names it in a way that cannot be read', () => {
    for (const request of [{}, { body: null }, { body: { client_id: '' } }, { authorization: 'Bearer not-a-jwt' }, { authorization: 'Basic ###' }, { authorization: 'Bearer' }, { body: { client_assertion: 'x.y' } }, { authorization: `Bearer ${jwt({ sub: 'user-1' })}` }, { body: { access_token: 'opaque-token' } }]) {
      expect(presentedClientIds(request)).toEqual([]);
    }
  });
});

describe('a request after authorization, under a list of accepted applications', () => {
  const list = ['claude.ai'];

  it('goes on when the one client it names is accepted, and not when it is not', () => {
    expect(isRequestAllowed({ body: { client_id: CLAUDE } }, list)).toBe(true);
    expect(isRequestAllowed({ authorization: basic(CLAUDE) }, list)).toBe(true);
    expect(isRequestAllowed({ body: { client_id: EVIL } }, list)).toBe(false);
    expect(isRequestAllowed({ authorization: basic(EVIL) }, list)).toBe(false);
  });

  it('naming an accepted client beside another one gains nothing, whichever the endpoint would go by', () => {
    // the authorization server authenticates the Basic client and takes the body's client_id for a mere parameter
    expect(isRequestAllowed({ body: { client_id: CLAUDE }, authorization: basic(EVIL) }, list)).toBe(false);
    expect(isRequestAllowed({ body: { client_id: EVIL }, authorization: basic(CLAUDE) }, list)).toBe(false);
    expect(isRequestAllowed({ body: { client_id: CLAUDE, client_assertion: jwt({ sub: EVIL }) } }, list)).toBe(false);
    expect(isRequestAllowed({ body: { access_token: jwt({ azp: EVIL }) }, authorization: `Bearer ${jwt({ azp: CLAUDE })}` }, list)).toBe(false);
    // the same accepted client named twice is one client
    expect(isRequestAllowed({ body: { client_id: CLAUDE }, authorization: basic(CLAUDE) }, list)).toBe(true);
  });

  it('is refused when it names no client that can be read', () => {
    expect(isRequestAllowed({ body: {} }, list)).toBe(false);
    expect(isRequestAllowed({ authorization: 'Bearer opaque-token' }, list)).toBe(false);
  });

  it('with no list every request goes on, whatever it names', () => {
    for (const none of [undefined, []]) {
      expect(isRequestAllowed({ body: { client_id: CLAUDE }, authorization: basic(EVIL) }, none)).toBe(true);
      expect(isRequestAllowed({ body: {} }, none)).toBe(true);
    }
  });
});
