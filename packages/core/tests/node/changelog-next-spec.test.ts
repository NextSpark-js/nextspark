/**
 * A new project gets its Next from two places that write different specs:
 * create-nextspark-app installs a pinned version, and `nextspark init` adds a
 * caret range to a package.json that declares no `next` yet. Core's changelog
 * tells projects which one they get, so it names both as the code writes them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (file: string) => fs.readFileSync(path.join(REPO, file), 'utf8')

test('the changelog names the next spec create-nextspark-app and init each write', () => {
  const pinned = read('packages/create-nextspark-app/src/create.ts').match(/'next@(\d+\.\d+\.\d+)'/)?.[1]
  assert.ok(pinned, 'create-nextspark-app installs a pinned next@X.Y.Z')

  const range = read('packages/cli/src/wizard/generators/index.ts').match(/'next': '(\^\d+\.\d+\.\d+)'/)?.[1]
  assert.ok(range, 'init adds a next range')

  const changelog = read('packages/core/CHANGELOG.md')
  assert.ok(changelog.includes(`\`next@${pinned}\``), `the changelog names \`next@${pinned}\``)
  assert.ok(changelog.includes(`\`next@${range}\``), `the changelog names \`next@${range}\``)

  const stated = [...changelog.matchAll(/`next@([^`]+)`/g)].map((match) => match[1])
  const unknown = stated.filter((spec) => spec !== pinned && spec !== range && !/^1[0-5]\./.test(spec))
  assert.deepEqual(unknown, [], 'every Next 16 spec the changelog names is one the code writes')
})
