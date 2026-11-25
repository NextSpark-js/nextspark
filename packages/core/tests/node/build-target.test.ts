/**
 * The output of `pnpm build` in packages/core is what a project's own build bundles for the browser. tsup's default
 * target (node16) made esbuild rewrite `a?.b` and `a ?? b` into longer code, and every client route downloaded it
 * (#568); core keeps ES2022 as written, for the tsup entries and for the route modules `onSuccess` transpiles.
 *
 * Run: cd packages/core && pnpm exec tsx --test tests/node/build-target.test.ts
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'

const config = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../tsup.config.ts'), 'utf8')
// Every target the build config states: the tsup option and the route modules' transform
const targets = [...config.matchAll(/^\s*target:\s*'([^']+)'/gm)].map(match => match[1])

test('the build config states one target for the tsup entries and one for the route modules, both ES2022', () => {
  assert.deepEqual(targets, ['es2022', 'es2022'])
})

test('that target keeps optional chaining and nullish coalescing as written', async () => {
  for (const target of targets) {
    const { code } = await transform('export const f = (a) => a?.b?.c ?? a?.d', { target })
    assert.match(code, /a\?\.b\?\.c \?\? a\?\.d/, `target ${target} rewrote the operators`)
  }
})
