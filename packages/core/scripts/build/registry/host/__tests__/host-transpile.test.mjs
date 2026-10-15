import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { PrepareError, prepareHost } from '../prepare.mjs'
import { packagedPluginTranspile } from '../transpile.mjs'
import { PAGE, tempHost } from './host-helpers.mjs'

const PACKAGED = { name: 'walkme', packageName: '@nextsparkjs/plugin-walkme', kind: 'packaged' }
const LOCAL = { name: 'mine', packageName: null, kind: 'local' }
const check = (files, plugins) => {
  const { source, cleanup } = tempHost(files)
  try {
    return packagedPluginTranspile({ projectRoot: source, plugins })
  } finally {
    cleanup()
  }
}

test('a packaged plugin missing from transpilePackages is an error naming the package and the line to set', () => {
  const { diagnostics } = check({ 'next.config.mjs': "export default { transpilePackages: ['@nextsparkjs/core'] }\n" }, [PACKAGED])
  assert.equal(diagnostics.length, 1)
  assert.equal(diagnostics[0].code, 'NS_PLUGIN_TRANSPILE_MISSING')
  assert.match(diagnostics[0].message, /"@nextsparkjs\/plugin-walkme"/)
  assert.ok(diagnostics[0].message.includes("transpilePackages: ['@nextsparkjs/core', '@nextsparkjs/plugin-walkme'],"))
})

test('a config without transpilePackages, or without a next.config, is an error too', () => {
  assert.equal(check({ 'next.config.mjs': 'export default {}\n' }, [PACKAGED]).diagnostics.length, 1)
  assert.equal(check({}, [PACKAGED]).diagnostics.length, 1)
})

test('a packaged plugin listed in transpilePackages passes, comments ignored', () => {
  const config = "export default {\n  // transpilePackages: ['x']\n  transpilePackages: ['@nextsparkjs/core', \"@nextsparkjs/plugin-walkme\"],\n}\n"
  assert.deepEqual(check({ 'next.config.mjs': config }, [PACKAGED]), { diagnostics: [], notices: [] })
})

test('a config that cannot be read statically is a warning, not an error', () => {
  for (const config of [
    "import base from './base.mjs'\nexport default { ...base }\n",
    "const list = ['@nextsparkjs/core']\nexport default { transpilePackages: list }\n",
    "export default { transpilePackages: [...shared, '@nextsparkjs/core'] }\n",
    "const transpilePackages = ['@nextsparkjs/core']\nexport default { transpilePackages }\n",
    "export default { 'transpilePackages': ['@nextsparkjs/core'] }\n",
    "const c = {}\nc.transpilePackages = ['@nextsparkjs/core']\nexport default c\n",
  ]) {
    const { diagnostics, notices } = check({ 'next.config.mjs': config }, [PACKAGED])
    assert.deepEqual(diagnostics, [])
    assert.equal(notices.length, 1)
    assert.equal(notices[0].code, 'NS_PLUGIN_TRANSPILE_UNREADABLE')
    assert.match(notices[0].message, /@nextsparkjs\/plugin-walkme/)
  }
})

test('a local plugin needs nothing', () => {
  assert.deepEqual(check({ 'next.config.mjs': 'export default {}\n' }, [LOCAL]), { diagnostics: [], notices: [] })
})

test('prepare stops before generating anything', async () => {
  const { hostRoot, config, cleanup } = tempHost({ 'templates/about/page.tsx': PAGE('About'), 'next.config.mjs': "export default { transpilePackages: ['@nextsparkjs/core'] }\n" }, { plugins: [{ ...PACKAGED, root: '/nowhere', importBase: PACKAGED.packageName }] })
  try {
    await assert.rejects(prepareHost(config), error => error instanceof PrepareError && error.diagnostics[0].code === 'NS_PLUGIN_TRANSPILE_MISSING')
    assert.equal(existsSync(join(hostRoot, 'src')), false)
    assert.equal(existsSync(join(hostRoot, '.nextspark/generation.json')), false)
    assert.equal(existsSync(join(hostRoot, '.nextspark/registries')), false)
  } finally {
    cleanup()
  }
})

test('a /* inside a string is not a comment: the list after it is still read', () => {
  const config = "export default {\n  async rewrites() { return [{ source: '/api/*', destination: '/x' }] },\n  transpilePackages: ['@nextsparkjs/core', '@nextsparkjs/plugin-walkme'], // done */\n}\n"
  assert.deepEqual(check({ 'next.config.mjs': config }, [PACKAGED]), { diagnostics: [], notices: [] })
  assert.equal(check({ 'next.config.mjs': config.replace(", '@nextsparkjs/plugin-walkme'", '') }, [PACKAGED]).diagnostics.length, 1)
})

test('with several next.config files the one Next loads is checked (js, mjs, ts), and a warning says so', () => {
  const listed = "export default { transpilePackages: ['@nextsparkjs/core', '@nextsparkjs/plugin-walkme'] }\n"
  const unlisted = "export default { transpilePackages: ['@nextsparkjs/core'] }\n"
  const ok = check({ 'next.config.js': listed, 'next.config.ts': unlisted }, [PACKAGED])
  assert.deepEqual(ok.diagnostics, [])
  assert.equal(ok.notices[0].code, 'NS_PLUGIN_TRANSPILE_SEVERAL_CONFIGS')
  assert.match(ok.notices[0].message, /^next\.config\.js and next\.config\.ts/)
  assert.equal(check({ 'next.config.mjs': unlisted, 'next.config.ts': listed }, [PACKAGED]).diagnostics.length, 1)
})
