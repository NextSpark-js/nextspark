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

// extractLiteralIconCallNames matches a call site by its real import binding,
// so every snippet exercising a real DynamicIcon or resolveIcon call needs
// one of these in scope, the same way real theme and plugin source does.
const DYNAMIC_ICON_IMPORT = "import { DynamicIcon } from '@nextsparkjs/core/components/ui/dynamic-icon'\n"
const RESOLVE_ICON_IMPORT = "import { resolveIcon } from '@nextsparkjs/core/lib/icons'\n"

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

// --- isTestFilePath: test code is excluded from discovery entirely --------

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

// --- Transparent TypeScript wrappers ---------------------------------------
//
// `as`, `<T>x`, `satisfies` and `!` change nothing about the value at
// runtime, so a config or call site written with one of them must resolve
// exactly like the bare form — and still be reported as unresolved when the
// wrapped value itself doesn't resolve, rather than disappearing silently.

test('reads a string icon name through `as const`', async () => {
  const source = `export const config = { icon: 'Wallet' as const }`
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reads a lucide identifier through a non-null assertion', async () => {
  const source = `
    import { Wallet } from 'lucide-react'
    export const config = { icon: Wallet! }
  `
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reads a string icon name through `satisfies` and through parentheses', async () => {
  assert.deepEqual(
    await extractIconNames(`export const config = { icon: 'Wallet' satisfies string }`),
    ['Wallet']
  )
  assert.deepEqual(await extractIconNames(`export const config = { icon: ('Wallet') }`), ['Wallet'])
})

test('reads a lucide identifier through an angle-bracket type assertion', async () => {
  const source = `
    import { Wallet } from 'lucide-react'
    export const config = { icon: <any>Wallet }
  `
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reports a wrapped reference that still does not resolve, instead of dropping it silently', async () => {
  assert.deepEqual(
    await findUnresolvedIconRefs("export default { icon: Wallet! }"),
    ['Wallet!']
  )
  assert.deepEqual(
    await findUnresolvedIconRefs("export default { icon: Wallet as const }"),
    ['Wallet as const']
  )
})

test('reports a call result assigned to icon, instead of staying silent', async () => {
  // Neither a string literal nor a lucide identifier - `chooseIcon()` cannot
  // be resolved at build time, and unlike a bare identifier or a property
  // access it must still be reported, not just left out of both lists.
  assert.deepEqual(await extractIconNames('export default { icon: chooseIcon() as LucideIcon }'), [])
  assert.deepEqual(
    await findUnresolvedIconRefs('export default { icon: chooseIcon() as LucideIcon }'),
    ['chooseIcon() as LucideIcon']
  )
})

test('extracts a literal name through `satisfies` in a call argument', async () => {
  const source = `${RESOLVE_ICON_IMPORT}resolveIcon('Wallet' satisfies string)`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Wallet'])
})

test('extracts a literal name through a non-null-asserted callee', async () => {
  const source = `${RESOLVE_ICON_IMPORT}resolveIcon!('Wallet')`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Wallet'])
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
    await extractLiteralIconCallNames(DYNAMIC_ICON_IMPORT + '<DynamicIcon name="Wallet" className="h-4 w-4" />'),
    ['Wallet']
  )
  assert.deepEqual(
    await extractLiteralIconCallNames(DYNAMIC_ICON_IMPORT + "<DynamicIcon name={'pie-chart'} />"),
    ['pie-chart']
  )
})

test('extracts a literal name from resolveIcon, with or without a fallback argument', async () => {
  assert.deepEqual(await extractLiteralIconCallNames(RESOLVE_ICON_IMPORT + "resolveIcon('receipt')"), ['receipt'])
  assert.deepEqual(
    await extractLiteralIconCallNames(RESOLVE_ICON_IMPORT + 'resolveIcon("receipt", Box)'),
    ['receipt']
  )
})

test('ignores a runtime value handed to DynamicIcon or resolveIcon', async () => {
  assert.deepEqual(await extractLiteralIconCallNames(DYNAMIC_ICON_IMPORT + '<DynamicIcon name={item.icon} />'), [])
  assert.deepEqual(await extractLiteralIconCallNames(RESOLVE_ICON_IMPORT + 'resolveIcon(item.icon, Box)'), [])
  assert.deepEqual(await extractLiteralIconCallNames(RESOLVE_ICON_IMPORT + 'resolveIcon(iconName)'), [])
})

test('never yields anything but a bare name from a call, so nothing can be injected', async () => {
  const sources = [
    DYNAMIC_ICON_IMPORT + '<DynamicIcon name="X&quot;; process.exit(1); //" />',
    RESOLVE_ICON_IMPORT + 'resolveIcon(\'Users } from "x"; import evil from "y"; //\')'
  ]

  for (const source of sources) {
    for (const name of await extractLiteralIconCallNames(source)) {
      assert.match(name, /^[A-Za-z][\w$-]*$/, `unsafe name from: ${source}`)
    }
  }
})

// --- Import-binding resolution --------------------------------------------
//
// A call site is matched through the file's own imports and lexical scope
// rather than by comparing the identifier's text, so aliasing and namespacing
// resolve, a same-named local that never came from core does not, and a
// closer declaration of the same name shadows the import for its scope.

test('resolves resolveIcon through an aliased import', async () => {
  const source = "import { resolveIcon as ri } from '@nextsparkjs/core/lib/icons'\nri('Wallet')"
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Wallet'])
})

test('resolves DynamicIcon through an aliased import', async () => {
  const source = "import { DynamicIcon as DI } from '@nextsparkjs/core/components/ui/dynamic-icon'\n<DI name=\"Wallet\" />"
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Wallet'])
})

test('resolves resolveIcon and DynamicIcon through a namespace import', async () => {
  const source =
    "import * as Core from '@nextsparkjs/core/lib/icons'\nimport * as CoreUI from '@nextsparkjs/core/components/ui/dynamic-icon'\nCore.resolveIcon('Wallet');\n<CoreUI.DynamicIcon name=\"Receipt\" />;"
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Wallet', 'Receipt'])
})

test('ignores a same-named local that was never imported from core', async () => {
  // A theme's own helper named resolveIcon (or a JSX component named
  // DynamicIcon) is not core's, even though the text matches.
  const source = "function resolveIcon(x) { return x }\nresolveIcon('Wallet')\nfunction DynamicIcon(props) { return null }\n<DynamicIcon name=\"Receipt\" />"
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores resolveIcon imported from somewhere other than core', async () => {
  const source = "import { resolveIcon } from './local-icons'\nresolveIcon('Wallet')"
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a parameter that shadows the real core import', async () => {
  // The module does import resolveIcon from core, but the call inside f()
  // goes through f's own parameter of the same name, not the import.
  const source = `${RESOLVE_ICON_IMPORT}function f(resolveIcon) { resolveIcon('Wallet') }`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('still resolves the real import once the shadowing parameter goes out of scope', async () => {
  const source = `${RESOLVE_ICON_IMPORT}function f(resolveIcon) { resolveIcon('Wallet') }\nresolveIcon('Receipt')`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Receipt'])
})

test('ignores a call imported from a same-prefixed package that is not core', async () => {
  const source = "import { resolveIcon } from '@nextsparkjs/core-fake/lib/icons'\nresolveIcon('Wallet')"
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

// --- Decoy tests: a name in a non-code position must not reach the registry --
//
// A name written inside a comment, a docblock, or only in a test file is not
// something a real request can ever ask for by string, so discovery must not
// pick it up just because it looks the same as the code shapes above.

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
  const source = `${DYNAMIC_ICON_IMPORT}
    // <DynamicIcon name="Cherry" />
    export function Widget() { return null }
  `
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), [])
})

test('decoy: a `<DynamicIcon>` inside a block comment is not a call', async () => {
  const source = `${DYNAMIC_ICON_IMPORT}
    /* <DynamicIcon name="Bug" /> */
    export function Widget() { return null }
  `
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), [])
})

test('decoy: a `resolveIcon(...)` inside a block comment is not a call', async () => {
  const source = `${RESOLVE_ICON_IMPORT}
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
  const source = `${RESOLVE_ICON_IMPORT}resolveIcon('Citrus')`
  assert.deepEqual(await extractLiteralIconCallNames(source, 'widget.tsx'), ['Citrus'])
  assert.ok(isIconCallSourcePath('/p/themes/default/components/widget.test.tsx'))
  assert.ok(isTestFilePath('/p/themes/default/components/widget.test.tsx'))
})
