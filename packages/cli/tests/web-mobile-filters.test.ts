/**
 * Every `pnpm --filter X` the web-mobile generator writes (root package.json scripts and the README) must match a
 * package. A name filter such as `--filter mobile` matches nothing when the package is called `<slug>-mobile`, and
 * pnpm prints "No projects matched the filters" and exits 0, so `pnpm ios` did nothing at all.
 *
 * Pure: the root files are generated for real into a temporary directory next to the directories a web-mobile project
 * has (web/ and mobile/, each with a package.json named the way the generators name them); no install is needed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createMonorepoReadme, createRootPackageJson } from '../src/wizard/generators/monorepo-generator.js'
import { applyPreset } from '../src/wizard/presets.js'

const config = applyPreset({ projectName: 'App', projectSlug: 'app', projectDescription: 'App' }, 'saas', 'web-mobile')

/** The filters of a pnpm command line, `--filter X` and `--filter=X`. */
function filtersOf(text: string): string[] {
  return [...text.matchAll(/--filter[ =]([^\s`'"]+)/g)].map(match => match[1])
}

test('every pnpm --filter in the root scripts and the README resolves to a package directory', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-web-mobile-filters-')))
  try {
    // The packages as the generators name them: web is `web`, mobile is `<slug>-mobile`.
    for (const [dir, name] of [['web', 'web'], ['mobile', 'app-mobile']]) {
      fs.mkdirSync(path.join(root, dir))
      fs.writeFileSync(path.join(root, dir, 'package.json'), JSON.stringify({ name }))
    }
    await createRootPackageJson(root, config)
    await createMonorepoReadme(root, config)

    const scripts = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).scripts as Record<string, string>
    const filters = [...filtersOf(Object.values(scripts).join('\n')), ...filtersOf(fs.readFileSync(path.join(root, 'README.md'), 'utf8'))]

    assert.ok(filters.length >= 10, `expected the generated files to use filters, found ${filters.length}`)
    for (const filter of filters) {
      // A path filter (`./dir`) is what resolves whatever the package is called.
      assert.match(filter, /^\.\//, `--filter ${filter} is a name, and the mobile package is not called mobile`)
      const dir = path.join(root, filter)
      assert.ok(fs.existsSync(path.join(dir, 'package.json')), `--filter ${filter} matches no package directory`)
    }
    assert.ok(filters.includes('./mobile') && filters.includes('./web'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
