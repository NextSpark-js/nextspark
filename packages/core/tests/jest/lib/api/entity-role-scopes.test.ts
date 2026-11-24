/**
 * The one rule that turns a team role's permissions into API scopes. The generated scope registry calls it for API
 * keys and sessions, and MCP browser sign-in (#541) for what a consent may grant.
 */
import { entityScopesOfRole } from '@/core/lib/api/auth/entity-role-scopes';

describe('the API scopes of a role', () => {
  it('reading is listing or reading, writing is creating or updating, deleting is deleting', () => {
    expect(entityScopesOfRole(['tasks'], new Set(['tasks.list']))).toEqual(['tasks:read']);
    expect(entityScopesOfRole(['tasks'], new Set(['tasks.read']))).toEqual(['tasks:read']);
    expect(entityScopesOfRole(['tasks'], new Set(['tasks.create']))).toEqual(['tasks:write']);
    expect(entityScopesOfRole(['tasks'], new Set(['tasks.update']))).toEqual(['tasks:write']);
    expect(entityScopesOfRole(['tasks'], new Set(['tasks.delete']))).toEqual(['tasks:delete']);
  });

  it('follow the order of the entities, each once', () => {
    const permissions = new Set(['tasks.list', 'tasks.read', 'tasks.create', 'tasks.update', 'tasks.delete', 'customers.read']);
    expect(entityScopesOfRole(['tasks', 'customers', 'tasks'], permissions)).toEqual(['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read']);
  });

  it('a permission of an entity that is not named gives nothing, and neither does one that is not an entity action', () => {
    expect(entityScopesOfRole(['tasks'], new Set(['customers.read', 'tasks.export', 'teams.invite']))).toEqual([]);
  });

  it('a role with no permissions holds nothing', () => {
    expect(entityScopesOfRole(['tasks'], undefined)).toEqual([]);
    expect(entityScopesOfRole(['tasks'], new Set())).toEqual([]);
  });
});
