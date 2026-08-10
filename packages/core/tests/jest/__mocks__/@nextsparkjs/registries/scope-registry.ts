/**
 * Mock Scope Registry for Jest tests
 *
 * Shape MUST match the real generated `scope-registry.ts`
 * (`ScopeConfig`/`ApiConfig`, see
 * packages/core/scripts/build/registry/generators/scope-registry.mjs) — the
 * previous version of this mock only exported an empty `SCOPE_REGISTRY` with
 * unrelated `{name, description}`/`{basePath, version}` interfaces, which
 * meant `scope.service.test.ts` failed on every assertion the moment it was
 * force-run and had to be excluded from the suite.
 *
 * The role names below (superadmin/admin/manager/member) are an arbitrary
 * fixture for exercising ScopeService's lookup/immutability/edge-case
 * behavior — they are NOT meant to represent real `AVAILABLE_ROLES` (which
 * are `owner/admin/member/viewer` + theme customs). ScopeService itself is
 * agnostic to what role names exist; it's a pure Record lookup.
 */

export interface ScopeConfig {
  base: string[]
  roles: Record<string, string[]>
  flags: Record<string, string[]>
  restrictions: Record<string, { remove?: string[]; allow_only?: string[] }>
}

export interface ApiConfig {
  filters: {
    allowed: string[]
  }
  entityPaths: string[]
}

export const SCOPE_CONFIG: ScopeConfig = {
  base: ['tasks:read'],
  roles: {
    superadmin: ['admin:users', 'admin:api-keys', 'tasks:delete'],
    admin: ['admin:users', 'tasks:read', 'tasks:write', 'tasks:delete'],
    manager: ['tasks:read', 'tasks:write'],
    member: ['tasks:read'],
  },
  flags: {
    beta_tester: ['beta:features'],
    vip: ['vip:features', 'advanced:export'],
    early_adopter: ['early:features'],
    power_user: ['advanced:features', 'bulk:operations'],
  },
  restrictions: {
    restricted: {
      remove: ['delete', 'admin'],
    },
    limited_access: {
      allow_only: ['read', 'tasks:write'],
    },
  },
}

export const API_CONFIG: ApiConfig = {
  filters: {
    allowed: ['status', 'role', 'completed', 'userId'],
  },
  entityPaths: ['/api/v1/tasks'],
}

// Kept for any legacy import still expecting SCOPE_REGISTRY to exist.
export const SCOPE_REGISTRY: Record<string, unknown> = {}
