/**
 * Where the registries of the app cannot be loaded late (#541): a runtime that runs core's built ES modules as
 * they are, such as `nextspark worker`, has no `require`. Auth must still load there, and that process must not
 * pass its empty list for the app's.
 */
jest.mock('@nextsparkjs/registries/entity-registry', () => {
  throw new ReferenceError('require is not defined in ES module scope');
});
jest.mock('@nextsparkjs/registries/mcp-registry', () => {
  throw new ReferenceError('require is not defined in ES module scope');
});

import { mcpToolScopes, mcpToolScopesKnown } from '@/core/lib/mcp/oauth/tool-scopes';

describe('the scopes some tool of the app needs, where the registries cannot be loaded (#541)', () => {
  it('are an empty list marked as not known instead of a failure, and it says so once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mcpToolScopes()).toEqual([]);
    expect(mcpToolScopes()).toEqual([]);
    expect(mcpToolScopesKnown()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/registries of the app could not be loaded/);
    warn.mockRestore();
  });

  it('an override that fails to load for any other reason is not hidden', () => {
    jest.resetModules();
    jest.doMock('@nextsparkjs/registries/entity-registry', () => ({ ENTITY_REGISTRY: {} }));
    jest.doMock('@nextsparkjs/registries/mcp-registry', () => {
      throw new ReferenceError("Cannot access 'auth' before initialization");
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('@/core/lib/mcp/oauth/tool-scopes') as typeof import('@/core/lib/mcp/oauth/tool-scopes');
    expect(() => fresh.mcpToolScopes()).toThrow(/before initialization/);
  });
});
