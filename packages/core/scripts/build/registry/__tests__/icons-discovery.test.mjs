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
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  discoverIcons,
  findUnresolvedIconRefs,
  extractIconNames,
  isIconSourcePath,
  isIconCallSourcePath,
  isTestFilePath,
  extractLiteralIconCallNames
} from '../discovery/icons.mjs'

test('discovers core entity icons through the resolution owner coreDir', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-icons-core-dir-'))
  const coreDir = join(root, 'installed-core')
  const projectRoot = join(root, 'project')
  const projectSourceDir = join(root, 'source')
  const pluginsDir = join(root, 'plugins')

  await mkdir(join(coreDir, 'src', 'entities', 'probe'), { recursive: true })
  await mkdir(projectSourceDir, { recursive: true })
  await mkdir(pluginsDir, { recursive: true })
  await mkdir(projectRoot, { recursive: true })
  await writeFile(join(projectRoot, 'package.json'), '{}\n')
  await writeFile(
    join(coreDir, 'src', 'entities', 'probe', 'probe.config.ts'),
    "export default { icon: 'Telescope' }\n"
  )

  try {
    const icons = await discoverIcons([], {
      coreDir,
      projectRoot,
      projectSourceDir,
      pluginsDir,
    })
    assert.ok(icons.includes('Telescope'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scans only local plugins enabled by nextspark.config.ts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-icons-enabled-plugins-'))
  const coreDir = join(root, 'core')
  const projectRoot = join(root, 'project')
  const pluginsDir = join(root, 'plugins')

  await mkdir(join(coreDir, 'src', 'entities'), { recursive: true })
  await mkdir(projectRoot, { recursive: true })
  await mkdir(join(pluginsDir, 'enabled', 'components'), { recursive: true })
  await mkdir(join(pluginsDir, 'disabled', 'components'), { recursive: true })
  await writeFile(join(projectRoot, 'package.json'), '{}\n')
  await writeFile(
    join(pluginsDir, 'enabled', 'components', 'probe.tsx'),
    `${DYNAMIC_ICON_IMPORT}<DynamicIcon name="Telescope" />\n`
  )
  await writeFile(
    join(pluginsDir, 'disabled', 'components', 'probe.tsx'),
    `${DYNAMIC_ICON_IMPORT}<DynamicIcon name="Satellite" />\n`
  )

  try {
    const icons = await discoverIcons([], {
      coreDir,
      projectRoot,
      projectSourceDir: projectRoot,
      pluginsDir,
      plugins: ['enabled'],
      pluginSources: [{ name: 'enabled', sourceDir: join(pluginsDir, 'enabled'), importBase: '@/plugins/enabled' }],
    })
    assert.ok(icons.includes('Telescope'))
    assert.equal(icons.includes('Satellite'), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// extractLiteralIconCallNames matches a call site by its real import binding,
// so every snippet exercising a real DynamicIcon or resolveIcon call needs
// one of these in scope, the same way real theme and plugin source does.
const DYNAMIC_ICON_IMPORT = "import { DynamicIcon } from '@nextsparkjs/core/components/ui/dynamic-icon'\n"
const RESOLVE_ICON_IMPORT = "import { resolveIcon } from '@nextsparkjs/core/lib/icons'\n"

test('matches entity, block and app configs', () => {
  assert.ok(isIconSourcePath('/p/entities/tasks/tasks.config.ts'))
  assert.ok(isIconSourcePath('/p/blocks/hero/config.ts'))
  assert.ok(isIconSourcePath('/p/config/app.config.ts'))
})

test('matches the same paths with Windows separators', () => {
  assert.ok(isIconSourcePath('C:\\p\\entities\\tasks\\tasks.config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\blocks\\hero\\config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\config\\app.config.ts'))
})

test('matches every config/*.config.ts of a theme or plugin, not only app.config.ts', () => {
  assert.ok(isIconSourcePath('/p/config/dashboard.config.ts'))
  assert.ok(isIconSourcePath('/p/config/features.config.ts'))
  assert.ok(isIconSourcePath('/p/config/flows.config.ts'))
  assert.ok(isIconSourcePath('/p/config/theme.config.ts'))
  assert.ok(isIconSourcePath('C:\\p\\config\\features.config.ts'))
})

test('ignores a config.ts nested deeper than a direct child of config/', () => {
  assert.equal(isIconSourcePath('/p/config/sub/nested.config.ts'), false)
})

test('ignores files outside entities, blocks and config directories', () => {
  assert.equal(isIconSourcePath('/p/entities/tasks/messages/en.ts'), false)
})

test('does not match a file that merely ends in config.ts', () => {
  assert.equal(isIconSourcePath('/p/blocks/hero/notconfig.ts'), false)
})

// --- isTestFilePath: test code is excluded from discovery entirely --------

test('flags .test. and .spec. files, ts and tsx', () => {
  assert.ok(isTestFilePath('/p/components/wallet-badge.test.tsx'))
  assert.ok(isTestFilePath('/p/components/wallet-badge.spec.ts'))
})

test('flags anything under __tests__, tests or cypress directories', () => {
  assert.ok(isTestFilePath('/p/__tests__/wallet-badge.tsx'))
  assert.ok(isTestFilePath('/p/tests/wallet-badge.tsx'))
  assert.ok(isTestFilePath('/p/tests/cypress/e2e/wallet.cy.ts'))
  assert.ok(isTestFilePath('C:\\p\\__tests__\\wallet-badge.tsx'))
})

test('does not flag ordinary component source', () => {
  assert.equal(isTestFilePath('/p/components/wallet-badge.tsx'), false)
  assert.equal(isTestFilePath('/p/entities/tasks/tasks.config.ts'), false)
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

test('reads an icon from a shorthand property, where the name doubles as the value', async () => {
  const source = `
    import { Wallet as icon } from 'lucide-react'
    export default { icon }
  `
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reads an icon written under a computed property key', async () => {
  const source = `export default { ['icon']: 'Wallet' }`
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reads an icon under the iconName key, not only icon', async () => {
  const source = `export default { iconName: 'Wallet' }`
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reports a shorthand icon property that does not resolve, instead of staying silent', async () => {
  assert.deepEqual(
    await findUnresolvedIconRefs("import { icon } from './local-icons'\nexport default { icon }"),
    ['icon']
  )
})

test('reads an icon written as a get accessor, the same as a plain property', async () => {
  const source = `export default { get icon() { return 'Wallet' } }`
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
  assert.deepEqual(await findUnresolvedIconRefs(source), [])
})

test('reads a get accessor icon returning a lucide import', async () => {
  const source = `
    import { Wallet } from 'lucide-react'
    export default { get icon() { return Wallet } }
  `
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
})

test('reports a get accessor icon whose return value cannot be read statically, instead of staying silent', async () => {
  const source = `export default { get icon() {\n  const computed = someHelper()\n  return computed\n} }`
  assert.deepEqual(await extractIconNames(source), [])
  assert.equal((await findUnresolvedIconRefs(source)).length, 1)
})

test('reports an icon written as a method, whose value is the function rather than a name', async () => {
  const source = `export default { icon() { return 'Wallet' } }`
  assert.deepEqual(await extractIconNames(source), [])
  assert.deepEqual(await findUnresolvedIconRefs(source), ["icon() { return 'Wallet' }"])
})

test('reports a set accessor icon with no getter beside it, whose value reads as undefined', async () => {
  const source = `export default { set icon(value) {} }`
  assert.deepEqual(await extractIconNames(source), [])
  assert.deepEqual(await findUnresolvedIconRefs(source), ['set icon(value) {}'])
})

test('says nothing about a set accessor icon when a getter beside it supplies the name', async () => {
  const source = `export default { get icon() { return 'Wallet' }, set icon(value) {} }`
  assert.deepEqual(await extractIconNames(source), ['Wallet'])
  assert.deepEqual(await findUnresolvedIconRefs(source), [])
})

test('reads an icon written as a class field, and reports one that does not resolve', async () => {
  assert.deepEqual(await extractIconNames(`export class Config { icon = 'Wallet' }`), ['Wallet'])
  assert.deepEqual(await findUnresolvedIconRefs(`export class Config { icon = pickIcon() }`), ['pickIcon()'])
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
  assert.ok(isIconCallSourcePath('/p/components/wallet-badge.tsx'))
  assert.ok(isIconCallSourcePath('/p/lib/format.ts'))
  assert.ok(isIconCallSourcePath('C:\\p\\components\\wallet-badge.tsx'))
  assert.equal(isIconCallSourcePath('/p/messages/en.json'), false)
  assert.equal(isIconCallSourcePath('/p/README.md'), false)
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

// --- Function parameter initializer scope ----------------------------------
//
// Parameter defaults run before a function body is entered. Parameters and a
// named function expression shadow imports there, but body declarations do
// not; those declarations still shadow calls made by the body itself.

test('discovers a constructor default that a var in the constructor body does not shadow', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Probe {\n  constructor(icon = resolveIcon('Telescope')) {\n    var resolveIcon = () => null\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Telescope'])
})

test('discovers a constructor default despite a function declaration in its body', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Probe {\n  constructor(icon = resolveIcon('Satellite')) {\n    function resolveIcon() {}\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Satellite'])
})

test('discovers a method default despite a function declaration in its body', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Probe {\n  render(icon = resolveIcon('Map')) {\n    function resolveIcon() {}\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Map'])
})

test('discovers an arrow default despite a function declaration in its block body', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const render = (icon = resolveIcon('Rocket')) => {\n  function resolveIcon() {}\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Rocket'])
})

test('discovers a destructured parameter default that a body var does not shadow', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const render = ({ icon = resolveIcon('Compass') } = {}) => {\n  var resolveIcon = () => null\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Compass'])
})

test('discovers a computed destructured parameter key that a body var does not shadow', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const render = ({ [resolveIcon('Globe')]: icon } = {}) => {\n  var resolveIcon = () => null\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Globe'])
})

test('keeps a body var shadowing calls made by the function body', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Probe {\n  constructor(a = 1) {\n    var resolveIcon = f\n    resolveIcon('Anchor')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test("discovers a method's computed name, which its own parameters do not shadow", async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Probe {\n  [resolveIcon('Flag')](resolveIcon) {\n    var resolveIcon\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Flag'])
})

test('keeps an earlier parameter shadowing a later parameter default', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const render = (resolveIcon, icon = resolveIcon('Kite')) => {}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call imported from a same-prefixed package that is not core', async () => {
  const source = "import { resolveIcon } from '@nextsparkjs/core-fake/lib/icons'\nresolveIcon('Wallet')"
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

// --- Block-wide shadowing ---------------------------------------------------
//
// A local declaration shadows an import for the rest of the block it is
// declared in, not merely for its own immediate subtree: a sibling statement
// later in the same block has to see the shadow too, the way it would at
// runtime.

test('ignores a call through a local variable that shadows the import later in the same block', async () => {
  const source = `${RESOLVE_ICON_IMPORT}function f(local) {\n  const resolveIcon = local\n  resolveIcon('Wallet')\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a local function declaration that shadows the import', async () => {
  const source = `${RESOLVE_ICON_IMPORT}function outer() {\n  function resolveIcon(x) { return x }\n  resolveIcon('Wallet')\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call inside a named function expression that shadows the import with its own name', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const wrapped = function resolveIcon(x) {\n  resolveIcon('Wallet')\n  return x\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a local namespace that shadows the imported namespace', async () => {
  const source = "import * as Core from '@nextsparkjs/core/lib/icons'\nfunction f() {\n  const Core = { resolveIcon: () => {} }\n  Core.resolveIcon('Wallet')\n}"
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a var that shadows the import, hoisted out of the if that declares it', async () => {
  // var is function-scoped, not block-scoped: the call after the if still
  // sees the local declaration, not the import.
  const source = `${RESOLVE_ICON_IMPORT}function f() {\n  if (true) {\n    var resolveIcon = (name) => name\n  }\n  return resolveIcon('Wallet')\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test("ignores a call through a for loop's own initializer that shadows the import for the whole loop body", async () => {
  const source = `${RESOLVE_ICON_IMPORT}function f() {\n  for (const resolveIcon = (name) => name; false; ) {\n    resolveIcon('Wallet')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a let declared in one switch case that shadows the import in a later case', async () => {
  // Every clause of a switch shares one lexical scope, unlike a block per case.
  const source = `${RESOLVE_ICON_IMPORT}function f(x) {\n  switch (x) {\n    case 1:\n      let resolveIcon = (name) => name\n      break\n    case 2:\n      resolveIcon('Wallet')\n      break\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a class declaration that shadows the import with its own name', async () => {
  const source = `${RESOLVE_ICON_IMPORT}function f() {\n  class resolveIcon {\n    static call(name) { return name }\n  }\n  return resolveIcon('Wallet')\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

// --- Accessor, constructor, class and namespace scopes ----------------------
//
// Getters, setters and constructors are functions like any other: their
// parameters and every var hoisted in their bodies shadow the import inside
// them and nowhere else. A named class expression binds its own name only
// inside its body. A class `static { }` block and a TypeScript namespace are
// var scopes of their own, so a var declared in one neither leaks out to
// shadow the module's real import nor stays unseen inside.

test('ignores a call through a var hoisted out of an if inside a getter', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export const menu = {\n  get icon() {\n    if (true) {\n      var resolveIcon = (name) => name\n    }\n    return resolveIcon('Wallet')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a setter parameter that shadows the import', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export const menu = {\n  set icon(resolveIcon) {\n    resolveIcon('Wallet')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a constructor parameter that shadows the import', async () => {
  const source = `${RESOLVE_ICON_IMPORT}export class Menu {\n  constructor(resolveIcon) {\n    resolveIcon('Wallet')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test("ignores a call through a named class expression's own name", async () => {
  const source = `${RESOLVE_ICON_IMPORT}export const Menu = class resolveIcon {\n  static render() {\n    return resolveIcon('Wallet')\n  }\n}`
  assert.deepEqual(await extractLiteralIconCallNames(source), [])
})

test('ignores a call through a var hoisted inside a getter, setter or constructor body, in a class too', async () => {
  const hoisted = "if (true) { var resolveIcon = (name) => name }\n    resolveIcon('Wallet')"
  for (const member of [`get icon() {\n    ${hoisted}\n  }`, `set icon(value) {\n    ${hoisted}\n  }`, `constructor() {\n    ${hoisted}\n  }`]) {
    assert.deepEqual(await extractLiteralIconCallNames(`${RESOLVE_ICON_IMPORT}export class Menu {\n  ${member}\n}`), [], member)
  }
})

test('still resolves the real import outside a setter, constructor or class expression that shadowed it', async () => {
  const source = `${RESOLVE_ICON_IMPORT}const a = { set icon(resolveIcon) {} }\nclass B { constructor(resolveIcon) {} }\nconst C = class resolveIcon {}\nresolveIcon('Receipt')`
  assert.deepEqual(await extractLiteralIconCallNames(source), ['Receipt'])
})

test('a var inside a class static block stays in that block, shadowing inside it and not after it', async () => {
  const inside = `${RESOLVE_ICON_IMPORT}class Menu {\n  static {\n    if (true) { var resolveIcon = (name) => name }\n    resolveIcon('Wallet')\n  }\n}`
  const after = `${RESOLVE_ICON_IMPORT}class Menu {\n  static {\n    var resolveIcon = (name) => name\n  }\n}\nresolveIcon('Receipt')`
  assert.deepEqual(await extractLiteralIconCallNames(inside), [])
  assert.deepEqual(await extractLiteralIconCallNames(after), ['Receipt'])
})

test('a declaration inside a namespace shadows the import there and nowhere else', async () => {
  const inside = `${RESOLVE_ICON_IMPORT}namespace Menu {\n  const resolveIcon = (name: string) => name\n  resolveIcon('Wallet')\n}`
  const after = `${RESOLVE_ICON_IMPORT}namespace Menu {\n  var resolveIcon = (name: string) => name\n}\nresolveIcon('Receipt')`
  assert.deepEqual(await extractLiteralIconCallNames(inside, 'menu.ts'), [])
  assert.deepEqual(await extractLiteralIconCallNames(after, 'menu.ts'), ['Receipt'])
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
  assert.ok(isIconCallSourcePath('/p/components/widget.test.tsx'))
  assert.ok(isTestFilePath('/p/components/widget.test.tsx'))
})
