/**
 * Tests for icon discovery.
 *
 * The two halves that can silently produce an empty or wrong registry — which
 * degrades to every icon rendering as a Box, with no error anywhere — are the
 * path matcher and the name extraction. Both are pure, so both are tested here
 * directly; discoverIcons() itself only wires them to the filesystem.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/icons-discovery.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findUnresolvedIconRefs, extractIconNames, isIconSourcePath } from '../discovery/icons.mjs'

test('matches entity, block and app configs', () => {
  assert.ok(isIconSourcePath('/p/contents/themes/default/entities/tasks/tasks.config.ts'))
  assert.ok(isIconSourcePath('/p/themes/default/blocks/hero/config.ts'))
  assert.ok(isIconSourcePath('/p/themes/default/config/app.config.ts'))
})

test('matches the same paths with Windows separators', () => {
  assert.ok(isIconSourcePath('C:\\p\\contents\\themes\\default\\entities\\tasks\\tasks.config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\themes\\default\\blocks\\hero\\config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\themes\\default\\config\\app.config.ts'))
})

test('ignores configs whose icons never reach resolveIcon', () => {
  assert.equal(isIconSourcePath('/p/themes/crm/config/features.config.ts'), false)
  assert.equal(isIconSourcePath('/p/themes/default/config/theme.config.ts'), false)
  assert.equal(isIconSourcePath('/p/themes/default/entities/tasks/messages/en.ts'), false)
})

test('does not match a file that merely ends in config.ts', () => {
  assert.equal(isIconSourcePath('/p/themes/default/blocks/hero/notconfig.ts'), false)
})

test('reads an icon under a quoted key', () => {
  const source = `
    import { Users } from 'lucide-react'
    export const config = { 'icon': Users }
  `
  assert.deepEqual(extractIconNames(source), ['Users'])
})

test('reads an icon declared as a lucide import', () => {
  const source = `
    import { Users, CheckSquare } from 'lucide-react'
    export const config = { icon: CheckSquare }
  `
  assert.deepEqual(extractIconNames(source), ['CheckSquare'])
})

test('resolves an aliased import back to the lucide export name', () => {
  // `icon: HouseIcon` is lucide's `Home`; the registry is keyed by the export
  const source = `
    import { Home as HouseIcon } from 'lucide-react'
    export const config = { icon: HouseIcon }
  `
  assert.deepEqual(extractIconNames(source), ['Home'])
})

test('ignores an identifier that did not come from lucide', () => {
  const source = `
    import { MyOwnIcon } from '@/components/icons'
    export const config = { icon: MyOwnIcon }
  `
  assert.deepEqual(extractIconNames(source), [])
})

test('reads a string icon name, kebab-case included', () => {
  const source = `export const config = { icon: 'pie-chart' }`
  assert.deepEqual(extractIconNames(source), ['pie-chart'])
})

test('does not match a different key that ends in icon', () => {
  const source = `
    import { Users } from 'lucide-react'
    export const config = { sidebarIcon: Users, my_icon: Users }
  `
  assert.deepEqual(extractIconNames(source), [])
})

test('never yields anything but a bare name, so nothing can be injected', () => {
  // The generated registry is TypeScript built from these strings, and every
  // name becomes a named import. Whatever a config holds, what comes out here
  // is a bare name — and discoverIcons then drops any that lucide doesn't
  // export, which 'X' is.
  const sources = [
    `export const config = { icon: 'X"; process.exit(1); //' }`,
    `export const config = { icon: 'Users } from "x"; import evil from "y"; //' }`,
    'export const config = { icon: `${danger}` }'
  ]

  for (const source of sources) {
    for (const name of extractIconNames(source)) {
      assert.match(name, /^[A-Za-z][\w$-]*$/, `unsafe name from: ${source}`)
    }
  }
})

// Only a direct lucide import or a string literal reaches the registry, so
// every other shape has to be reported rather than silently rendering a Box.
test('reports an icon reference the build cannot resolve', () => {
  assert.deepEqual(
    findUnresolvedIconRefs("import * as I from 'lucide-react'\nexport default { icon: I.Users }"),
    ['I.Users']
  )
  assert.deepEqual(
    findUnresolvedIconRefs("import { Users } from './icons'\nexport default { icon: Users }"),
    ['Users']
  )
  assert.deepEqual(
    findUnresolvedIconRefs("import { Users } from 'lucide-react'\nconst Mine = Users\nexport default { icon: Mine }"),
    ['Mine']
  )
})

test('says nothing about a reference it can resolve', () => {
  assert.deepEqual(
    findUnresolvedIconRefs("import { Users } from 'lucide-react'\nexport default { icon: Users }"),
    []
  )
  assert.deepEqual(
    findUnresolvedIconRefs("import { Home as HouseIcon } from 'lucide-react'\nexport default { icon: HouseIcon }"),
    []
  )
  assert.deepEqual(findUnresolvedIconRefs("export default { icon: 'pie-chart' }"), [])
})
