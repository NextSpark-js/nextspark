import { isClientAllowed, usableHosts } from '@/core/lib/mcp/oauth/allowed-clients';

const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';

describe('which applications may connect by MCP browser sign-in (#541)', () => {
  it('every application may while the project sets no list, or an empty or unusable one', () => {
    for (const list of [undefined, null, [], 'claude.ai', [''], [42], ['not a host!']]) {
      expect(isClientAllowed(CLAUDE, list)).toBe(true);
      expect(isClientAllowed('https://anything.example/client.json', list)).toBe(true);
      expect(isClientAllowed('opaque-id', list)).toBe(true);
    }
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

  it('hosts are compared without case, surrounding space, port or a trailing dot', () => {
    expect(isClientAllowed('https://CLAUDE.AI:443/client.json', [' Claude.ai. '])).toBe(true);
    expect(isClientAllowed('https://claude.ai:8443/client.json', ['claude.ai'])).toBe(true);
  });

  it('entries that do not name a host are dropped, and the rest still count', () => {
    expect(usableHosts(['claude.ai', 'https://chatgpt.com', '', 7, '*.example.com', 'a b'])).toEqual(['claude.ai', '*.example.com']);
    expect(isClientAllowed('https://chatgpt.com/client.json', ['claude.ai', 'https://chatgpt.com'])).toBe(false);
  });
});
