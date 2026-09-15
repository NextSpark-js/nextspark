/**
 * Tests for icon discovery.
 *
 * The parts that can silently produce an empty or wrong registry — which
 * degrades to every icon rendering as a Box, with no error anywhere — are the
 * path matchers and the name extraction. Both are pure, so both are tested
 * here directly; discoverIcons() itself only wires them to the filesystem.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/icons-discovery.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  findUnresolvedIconRefs,
  extractIconNames,
  isIconSourcePath,
  isIconCallSourcePath,
  isTestFilePath,
  extractLiteralIconCallNames
} from '../discovery/icons.mjs'

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

test('matches every config/*.config.ts of a theme or plugin, not only app.config.ts', () => {
  assert.ok(isIconSourcePath('/p/themes/crm/config/dashboard.config.ts'))
  assert.ok(isIconSourcePath('/p/themes/crm/config/features.config.ts'))
  assert.ok(isIconSourcePath('/p/themes/crm/config/flows.config.ts'))
  assert.ok(isIconSourcePath('/p/themes/default/config/theme.config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\themes\\crm\\config\\features.config.ts'))
})

test('ignores a config.ts nested deeper than a direct child of config/', () => {
  assert.equal(isIconSourcePath('/p/themes/default/config/sub/nested.config.ts'), false)
})

test('ignores files outside entities, blocks and config directories', () => {
  assert.equal(isIconSourcePath('/p/themes/default/entities/tasks/messages/en.ts'), false)
})

test('does not match a file that merely ends in config.ts', () => {
  assert.equal(isIconSourcePath('/p/themes/default/blocks/hero/notconfig.ts'), false)
})

// --- isTestFilePath: test code is excluded from discovery entirely (#200 review) --

test('flags .test. and .spec. files, ts and tsx', () => {
  assert.ok(isTestFilePath('/p/themes/default/components/wallet-badge.test.tsx'))
  assert.ok(isTestFilePath('/p/themes/default/components/wallet-badge.spec.ts'))
})

test('flags anything under __tests__, tests or cypress directories', () => {
  assert.ok(isTestFilePath('/p/themes/default/__tests__/wallet-badge.tsx'))
  assert.ok(isTestFilePath('/p/themes/default/tests/wallet-badge.tsx'))
  assert.ok(isTestFilePath('/p/themes/default/tests/cypress/e2e/wallet.cy.ts'))
  assert.ok(isTestFilePath('C:\\p\\themes\\default\\__tests__\\wallet-badge.tsx'))
})

test('does not flag ordinary component source', () => {
  assert.equal(isTestFilePath('/p/themes/default/components/wallet-badge.tsx'), false)
  assert.equal(isTestFilePath('/p/themes/default/entities/tasks/tasks.config.ts'), false)
})

test('reads an icon under a quoted key', async () => {
  const source = `
    import { Users } from 'lucide-react'
    export const config = { 'icon': Users }
  `
  assert.deepEqual(await extractIconNames(source), ['Users'])
})

test('reads an icon declared as a lucide import', async () => {
  const source = `
    import { Users, CheckSquare } from 'lucide-react'
    export const config = { icon: CheckSquare }
  `
  assert.deepEqual(await extractIconNames(source), ['CheckSquare'])
})

test('resolves an aliased import back to the lucide export name', async () => {
  // `icon: HouseIcon` is lucide's `Home`; the registry is keyed by the export
  const source = `
    import { Home as HouseIcon } from 'lucide-react'
    export const config = { icon: HouseIcon }
  `
  assert.deepEqual(await extractIconNames(source), ['Home'])
})

test('ignores an identifier that did not come from lucide', async () => {
  const source = `
    import { MyOwnIcon } from '@/components/icons'
    export const config = { icon: MyOwnIcon }
  `
  assert.deepEqual(await extractIconNames(source), [])
})

test('reads a string icon name, kebab-case included', async () => {
  const source = `export const config = { icon: 'pie-chart' }`
  assert.deepEqual(await extractIconNames(source), ['pie-chart'])
})

test('does not match a different key that ends in icon', async () => {
  const source = `
    import { Users } from 'lucide-react'
    export const config = { sidebarIcon: Users, my_icon: Users }
  `
  assert.deepEqual(await extractIconNames(source), [])
})

test('never yields anything but a bare name, so nothing can be injected', async () => {
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
    for (const name of await extractIconNames(source)) {
      assert.match(name, /^[A-Za-z][\w$-]*$/, `unsafe name from: ${source}`)
    }
  }
})

// Only a direct lucide import or a string literal reaches the registry, so
// every other shape has to be reported rather than silently rendering a Box.
test('reports an icon reference the build cannot resolve', async () => {
  assert.deepEqual(
    await findUnresolvedIconRefs("import * as I from 'lucide-react'\nexport default { icon: I.Users }"),
    ['I.Users']
  )
  assert.deepEqual(
    await findUnresolvedIconRefs("import { Users } from './icons'\nexport default { icon: Users }"),
    ['Users']
  )
  assert.deepEqual(
    await findUnresolvedIconRefs("import { Users } from 'lucide-react'\nconst Mine = Users\nexport default { icon: Mine }"),
    ['Mine']
  )
})

test('says nothing about a reference it can resolve', async () => {
  assert.deepEqual(
    await findUnresolvedIconRefs("import { Users } from 'lucide-react'\nexport default { icon: Users }"),
    []
  )
  assert.deepEqual(
    await findUnresolvedIconRefs("import { Home as HouseIcon } from 'lucide-react'\nexport default { icon: HouseIcon }"),
    []
  )
  assert.deepEqual(await findUnresolvedIconRefs("export default { icon: 'pie-chart' }"), [])
})

test('matches .ts and .tsx component files, with Windows separators too', () => {
  assert.ok(isIconCallSourcePath('/p/themes/default/components/wallet-badge.tsx'))
  assert.ok(isIconCallSourcePath('/p/themes/default/lib/format.ts'))
  assert.ok(isIconCallSourcePath('C:\\p\\themes\\default\\components\\wallet-badge.tsx'))
  assert.equal(isIconCallSourcePath('/p/themes/default/messages/en.json'), false)
  assert.equal(isIconCallSourcePath('/p/themes/default/README.md'), false)
})

test('extracts a literal name from DynamicIcon, either quoting style', async () => {
  assert.deepEqual(
    await extractLiteralIconCallNames('<DynamicIcon name="Wallet" className="h-4 w-4" />'),
    ['Wallet']
  )
  assert.deepEqual(
    await extractLiteralIconCallNames("<DynamicIcon name={'pie-chart'} />"),
    ['pie-chart']
  )
})

test('extracts a literal name from resolveIcon, with or without a fallback argument', async () => {
  assert.deepEqual(await extractLiteralIconCallNames("resolveIcon('receipt')"), ['receipt'])
  assert.deepEqual(
    await extractLiteralIconCallNames('resolveIcon("receipt", Box)'),
    ['receipt']
  )
})

test('ignores a runtime value handed to DynamicIcon or resolveIcon', async () => {
  assert.deepEqual(await extractLiteralIconCallNames('<DynamicIcon name={item.icon} />'), [])
  assert.deepEqual(await extractLiteralIconCallNames('resolveIcon(item.icon, Box)'), [])
  assert.deepEqual(await extractLiteralIconCallNames('resolveIcon(iconName)'), [])
})

test('never yields anything but a bare name from a call, so nothing can be injected', async () => {
  const sources = [
    '<DynamicIcon name="X&quot;; process.exit(1); //" />',
    'resolveIcon(\'Users } from "x"; import evil from "y"; //\')'
  ]

  for (const source of sources) {
    for (const name of await extractLiteralIconCallNames(source)) {
      assert.match(name, /^[A-Za-z][\w$-]*$/, `unsafe name from: ${source}`)
    }
  }
})

// --- Decoy regression tests (#200 review) ------------------------------
//
// A prior review seeded 7 decoys of valid lucide names in places the old
// regex-based scanner read as code: a comment, a docblock, and a test file.
// The registry grew from 70 to 77 icons, all 7 imported into the production
// bundle even though nothing at runtime could ever ask for them by name.
// Each decoy here is a contrafactual: it fails against the code this fixes
// (the regex scanner from cd8e54de) and passes once discovery reads syntax.

test('decoy: a line comment holding `icon: \'Ambulance\'` is not code', async () => {
  const source = `
    // icon: 'Ambulance'
    export const config = {}
  `
  assert.deepEqual(await extractIconNames(source), [])
})

test('decoy: a block comment holding `icon: \'Bird\'` is not code', async () => {
  const source = `
    /* icon: 'Bird' */
    export const config = {}
  `
  assert.deepEqual(await extractIconNames(source), [])
})

test('decoy: a docblock mentioning a lucide identifier is not code', async () => {
  const source = `
    import { Apple } from 'lucide-react'
    /**
     * Renders icon: Apple as an example of a config entry.
     */
    export const config = {}
  `
  assert.deepEqual(await extractIconNames(source), [])
})

test('decoy: a `<DynamicIcon>` inside a line comment is not a call', async () => {
  const source = `
    // <DynamicIcon name="Cherry" />
    export function Widget() { return null }
  `
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), [])
})

test('decoy: a `<DynamicIcon>` inside a block comment is not a call', async () => {
  const source = `
    /* <DynamicIcon name="Bug" /> */
    export function Widget() { return null }
  `
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), [])
})

test('decoy: a `resolveIcon(...)` inside a block comment is not a call', async () => {
  const source = `
    /* resolveIcon('Fish') */
    export function Widget() { return null }
  `
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), [])
})

test('decoy: `resolveIcon(...)` in a test file is excluded by path, not by content', async () => {
  // extractLiteralIconCallNames has no notion of "test file" - it reads real
  // code, and `resolveIcon('Citrus')` written directly is real code. The
  // decoy is only harmless because discoverIcons never hands it this file:
  // isIconCallSourcePath combined with isTestFilePath keeps *.test.tsx out of
  // the call-source scan entirely.
  const source = `resolveIcon('Citrus')`
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), ['Citrus'])
  assert.ok(isIconCallSourcePath('/p/themes/default/components/widget.test.tsx'))
  assert.ok(isTestFilePath('/p/themes/default/components/widget.test.tsx'))
})
