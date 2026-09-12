import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateScheduledActionsRegistry } from '../generators/scheduled-actions-registry.mjs'

const theme = (name) => ({
  name,
  hasScheduledActions: true,
  scheduledActionsPath: `@/contents/themes/${name}/lib/scheduled-actions`,
})

test('generates a registry for a theme with scheduled actions', () => {
  const out = generateScheduledActionsRegistry([theme('default')], {})

  assert.match(out, /import \* as defaultScheduledActions from '@\/contents\/themes\/default\/lib\/scheduled-actions'/)
  assert.match(out, /'default': \{/)
  assert.match(out, /registerAllHandlers: defaultScheduledActions\.registerAllHandlers/)
})

test('a theme name that is not a valid identifier still produces one', () => {
  const out = generateScheduledActionsRegistry([theme('7startups'), theme('my-theme')], {})

  assert.match(out, /import \* as _7startupsScheduledActions from/)
  assert.match(out, /import \* as my_themeScheduledActions from/)
  assert.doesNotMatch(out, /import \* as 7startups/)
})

// The generated file is TypeScript shipped to the project: a build-script import
// leaking into it would not resolve there.
test('does not leak the generator\'s own imports into the generated file', () => {
  const out = generateScheduledActionsRegistry([theme('default')], {})

  assert.doesNotMatch(out, /identifier\.mjs/)
})

test('a project with no scheduled actions still gets a valid registry', () => {
  const out = generateScheduledActionsRegistry([{ name: 'starter', hasScheduledActions: false }], {})

  assert.match(out, /SCHEDULED_ACTIONS_REGISTRY/)
  assert.doesNotMatch(out, /starterScheduledActions/)
})
