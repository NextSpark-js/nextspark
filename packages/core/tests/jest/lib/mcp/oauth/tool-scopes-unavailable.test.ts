/**
 * Where the MCP overrides cannot be loaded late (#541): a runtime that runs core's built ES modules as they are,
 * such as `nextspark worker`, has no `require`. Auth must still load there.
 */
jest.mock('@nextsparkjs/registries/entity-registry', () => {
  const entity = (slug: string) => ({
    name: slug,
    config: { slug, enabled: true, access: { api: true }, names: { singular: slug, plural: slug }, fields: [] },
  });
  return { ENTITY_REGISTRY: { tasks: entity('tasks'), patterns: entity('patterns') } };
});
jest.mock('@nextsparkjs/registries/mcp-registry', () => {
  throw new ReferenceError('require is not defined in ES module scope');
});

import { mcpToolScopes } from '@/core/lib/mcp/oauth/tool-scopes';

describe('the scopes some tool of the app needs, where the overrides cannot be loaded (#541)', () => {
  it('are computed without them instead of failing, and say so once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // every generated tool of an exposed entity: what an override would have excluded is still there
    expect(mcpToolScopes()).toEqual(['tasks:delete', 'tasks:read', 'tasks:write']);
    expect(mcpToolScopes()).toEqual(['tasks:delete', 'tasks:read', 'tasks:write']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/overrides could not be loaded/);
    warn.mockRestore();
  });

  it('an override that fails to load for any other reason is not hidden', () => {
    jest.resetModules();
    jest.doMock('@nextsparkjs/registries/mcp-registry', () => {
      throw new ReferenceError("Cannot access 'auth' before initialization");
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('@/core/lib/mcp/oauth/tool-scopes') as typeof import('@/core/lib/mcp/oauth/tool-scopes');
    expect(() => fresh.mcpToolScopes()).toThrow(/before initialization/);
  });
});
