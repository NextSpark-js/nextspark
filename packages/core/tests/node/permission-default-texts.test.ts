/**
 * #553: the texts the registry generator writes for an entity permission with none, and the copy the Team Roles matrix
 * recognizes, are the same: if they drifted, a generated permission would stay in English.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultEntityPermissionTexts as generator } from '../../scripts/build/registry/generators/permissions-registry.mjs'
import { defaultEntityPermissionTexts as matrix } from '../../src/lib/permissions/permission-texts'

test('the generator and the matrix agree on the generated English text', () => {
  for (const [action, name] of [['create', 'Tasks'], ['unpublish', 'Blog Posts'], ['assign', 'Opportunities']]) {
    assert.deepEqual(generator(action, name), matrix(action, name))
  }
  assert.deepEqual(generator('create', 'Tasks'), { label: 'Create Tasks', description: 'Can create tasks' })
})
