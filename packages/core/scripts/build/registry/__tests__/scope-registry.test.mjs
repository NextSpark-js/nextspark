/**
 * Tests for the scope-registry generator.
 *
 * The role→scope computation no longer happens at generation time (see the
 * rationale comment at the top of `generators/scope-registry.mjs`) — it's
 * emitted as TypeScript that computes `SCOPE_CONFIG.roles` at IMPORT time,
 * from the sibling generated `entity-registry.ts`/`permissions-registry.ts`.
 * So this generator-level test can only assert on the EMITTED source: the
 * correct static imports, the defensive entity-registry guard, the
 * role/permission-derived scope logic, and the untouched flag/restriction
 * literals. The actual `SCOPE_CONFIG.roles` VALUES for a real role are
 * covered by `packages/core/tests/jest/services/scope.service.test.ts`
 * (against a realistic mock) and by manual inspection of the real generated
 * output after `node packages/core/scripts/build/registry.mjs`.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/scope-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateScopeRegistry } from '../generators/scope-registry.mjs'

test('imports ENTITY_REGISTRY and AVAILABLE_ROLES/PERMISSIONS_BY_ROLE from sibling generated registries', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /import \{ ENTITY_REGISTRY \} from '\.\/entity-registry'/)
  assert.match(out, /import \{ AVAILABLE_ROLES, PERMISSIONS_BY_ROLE \} from '\.\/permissions-registry'/)
})

test('does not reintroduce the old generation-time entities/config computation', () => {
  const out = generateScopeRegistry([{ name: 'ignored', api: { endpoints: { create: true } } }], { some: 'config' })
  // The old bug read entity.api.endpoints/entity.features/entity.fields directly —
  // none of those property paths should appear in the emitted output at all,
  // since the real computation now reads ENTITY_REGISTRY's real EntityConfig.
  assert.doesNotMatch(out, /entity\.api\.endpoints/)
  assert.doesNotMatch(out, /entity\.features/)
})

test('base scopes are empty — nothing granted irrespective of role', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /base:\s*\[\]/)
})

test('role scopes are computed from PERMISSIONS_BY_ROLE per AVAILABLE_ROLES, not hardcoded role names', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /for \(const role of AVAILABLE_ROLES\)/)
  assert.match(out, /const perms = PERMISSIONS_BY_ROLE\[role\]/)
  // The old hardcoded roleScopes literal (superadmin/admin/manager/member keys,
  // referencing a nonexistent "products" entity) must be gone.
  assert.doesNotMatch(out, /'manager'/)
  assert.doesNotMatch(out, /products:write/)
  assert.doesNotMatch(out, /products:delete/)
})

test('read/write/delete scopes are derived from list|read / create|update / delete permissions', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /\$\{slug\}\.list.*Permission.*\|\|.*perms\?\.has\(`\$\{slug\}\.read`/)
  assert.match(out, /\$\{slug\}\.create.*Permission.*\|\|.*perms\?\.has\(`\$\{slug\}\.update`/)
  assert.match(out, /\$\{slug\}\.delete.*Permission/)
  assert.match(out, /scopes\.push\(`\$\{slug\}:read`\)/)
  assert.match(out, /scopes\.push\(`\$\{slug\}:write`\)/)
  assert.match(out, /scopes\.push\(`\$\{slug\}:delete`\)/)
})

test('guards against ChildEntityDefinition entries (no access/slug) in ENTITY_REGISTRY', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /if \(!cfg\?\.access\?\.api \|\| !cfg\.slug\) return null/)
})

test('flag scopes and restrictions are preserved unchanged', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /beta_tester/)
  assert.match(out, /vip:features/)
  assert.match(out, /"remove": \[\s*"delete",\s*"admin"\s*\]/)
  assert.match(out, /"allow_only": \[\s*"read",\s*"tasks:write"\s*\]/)
})

test('superadmin is not hardcoded into SCOPE_CONFIG.roles — handled as a global-role bypass elsewhere', () => {
  const out = generateScopeRegistry([], {})
  assert.doesNotMatch(out, /'superadmin':\s*\[/)
  assert.match(out, /Superadmin is a GLOBAL role/)
})

test('is a pure function of its output shape — always emits both SCOPE_CONFIG and API_CONFIG exports', () => {
  const out = generateScopeRegistry([], {})
  assert.match(out, /export const SCOPE_CONFIG: ScopeConfig = \{/)
  assert.match(out, /export const API_CONFIG: ApiConfig = \{/)
})
