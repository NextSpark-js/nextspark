/**
 * The project's src/proxy.ts and instrumentation.ts as facades over core (S114): an unchanged copy of an earlier
 * template is replaced by `nextspark prepare`, anything else is kept and gets a notice with the exact replacement.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  ENTRY_NOT_REPLACED,
  INSTRUMENTATION_FACADE_WARNING,
  INSTRUMENTATION_TEMPLATE_REPLACED,
  PROXY_FACADE_WARNING,
  PROXY_TEMPLATE_REPLACED,
  currentTemplate,
  isPreviousTemplate,
  projectEntryNotices,
  upgradeProjectEntries,
  usesCoreProxy,
} from '../project-entries.mjs'
import { proxyAreaNotices } from '../proxy-areas.mjs'
import { predictHost, prepareHost } from '../prepare.mjs'
import { PAGE, tempHost, write } from './host-helpers.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const PROXY = readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')
const INSTRUMENTATION = readFileSync(join(CORE_ROOT, 'templates/instrumentation.ts'), 'utf8')
const PREVIOUS = JSON.parse(readFileSync(join(CORE_ROOT, 'scripts/build/registry/host/previous-templates.json'), 'utf8'))
const sha256 = text => createHash('sha256').update(text).digest('hex')

const OLD_PROXY = "import { auth } from '@nextsparkjs/core/lib/auth'\nexport async function proxy(request) {\n  return null\n}\nexport const config = { matcher: ['/((?!_next/static/).*)'] }\n"
const OLD_INSTRUMENTATION = "export async function register() {\n  await import('@nextsparkjs/core/lib/scheduled-actions')\n}\n"
const previous = { 'proxy.ts': [sha256(OLD_PROXY)], 'instrumentation.ts': [sha256(OLD_INSTRUMENTATION)] }

function project() {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-entries-'))
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

/**
 * When a template changes, the hash of the one it replaces goes into previous-templates.json, or a project holding an
 * unchanged copy of it is no longer recognised. These pins fail on any change to remind you.
 */
test('the current templates are pinned; on a change, add the old hash to previous-templates.json and re-pin', () => {
  assert.equal(sha256(PROXY), '8c93e61e1a69b90e78957aadef83dc5c770fd00eeb677617c1ebbc9fe48c8d65', 'templates/proxy.ts changed')
  assert.equal(sha256(INSTRUMENTATION), 'dc391697bf33bcfeb07b97a0b18b82228e16fe607deef8a6388366bcbaf24d3a', 'templates/instrumentation.ts changed')
  assert.ok(!PREVIOUS['proxy.ts'].includes(sha256(PROXY)), 'the current proxy template is not a previous one')
  assert.ok(!PREVIOUS['instrumentation.ts'].includes(sha256(INSTRUMENTATION)), 'the current instrumentation template is not a previous one')
})

test('the templates are facades over the public entries', () => {
  assert.ok(usesCoreProxy(PROXY))
  assert.match(PROXY, /^export \{ proxy \} from '@nextsparkjs\/core\/proxy'$/m)
  assert.match(INSTRUMENTATION, /^export \{ register \} from '@nextsparkjs\/core\/instrumentation'$/m)
  assert.match(currentTemplate('proxy.ts', 'src/middleware.ts'), /^export \{ proxy as middleware \} from '@nextsparkjs\/core\/proxy'$/m)
})

test('an earlier template is recognised as written, with CRLF line ends and as the Next 15 middleware copy; an edit is not', () => {
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY, previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY.replace(/\n/g, '\r\n'), previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY.replace('function proxy(', 'function middleware('), previous), true)
  assert.equal(isPreviousTemplate('proxy.ts', OLD_PROXY.replace('return null', 'return undefined'), previous), false)
  assert.equal(isPreviousTemplate('proxy.ts', `${OLD_PROXY}\n`, previous), false)
  assert.equal(isPreviousTemplate('instrumentation.ts', OLD_PROXY, previous), false, 'each kind has its own list')
})

test('unchanged copies are replaced with the current templates and reported; edited ones are kept', () => {
  const { root, cleanup } = project()
  try {
    write(root, 'src/proxy.ts', OLD_PROXY)
    write(root, 'instrumentation.ts', OLD_INSTRUMENTATION)
    assert.deepEqual(projectEntryNotices(root, { previous }).map(notice => notice.code), [PROXY_FACADE_WARNING, INSTRUMENTATION_FACADE_WARNING])
    assert.match(projectEntryNotices(root, { previous })[0].message, /is an unchanged copy of an earlier core proxy template; nextspark prepare replaces it/)

    const replaced = upgradeProjectEntries(root, { previous })
    assert.deepEqual(replaced.map(notice => [notice.code, notice.target]), [[PROXY_TEMPLATE_REPLACED, 'src/proxy.ts'], [INSTRUMENTATION_TEMPLATE_REPLACED, 'instrumentation.ts']])
    assert.equal(readFileSync(join(root, 'src/proxy.ts'), 'utf8'), PROXY)
    assert.equal(readFileSync(join(root, 'instrumentation.ts'), 'utf8'), INSTRUMENTATION)
    assert.deepEqual(projectEntryNotices(root, { previous }), [], 'the facades get no notice')
    assert.deepEqual(upgradeProjectEntries(root, { previous }), [], 'a second run changes nothing')

    const edited = OLD_PROXY.replace('return null', "return request.nextUrl.pathname === '/x' ? null : null")
    write(root, 'src/proxy.ts', edited)
    write(root, 'instrumentation.ts', `${OLD_INSTRUMENTATION}// mine\n`)
    assert.deepEqual(upgradeProjectEntries(root, { previous }), [])
    assert.equal(readFileSync(join(root, 'src/proxy.ts'), 'utf8'), edited)
    const notices = projectEntryNotices(root, { previous })
    assert.deepEqual(notices.map(notice => [notice.code, notice.target]), [[PROXY_FACADE_WARNING, 'src/proxy.ts'], [INSTRUMENTATION_FACADE_WARNING, 'instrumentation.ts']])
    assert.ok(notices[0].message.includes("cp node_modules/@nextsparkjs/core/templates/proxy.ts src/proxy.ts"), 'the notice carries the exact replacement')
    assert.ok(!notices.some(notice => /[\r\n]/.test(notice.message)), 'one line each: the CLI shows a notice with a line break quoted')
    assert.match(notices[0].message, /config\/hooks\/proxy\.ts/)
    assert.match(notices[0].message, /createProxy\(\{ authenticatedPaths/)
    assert.match(notices[0].message, /A role check of your own .* goes in that page or its layout/)
    assert.ok(notices[1].message.includes("cp node_modules/@nextsparkjs/core/templates/instrumentation.ts instrumentation.ts. The template is export { register } from '@nextsparkjs/core/instrumentation'"))
    assert.match(notices[1].message, /registerNextSpark/)
  } finally {
    cleanup()
  }
})

test('a copy that cannot be written is left as it is with a warning that says why, and the rest is still replaced', { skip: process.getuid?.() === 0 && 'root writes read-only files' }, () => {
  const { root, cleanup } = project()
  try {
    write(root, 'old-proxy.ts', OLD_PROXY)
    write(root, 'src/.keep', '')
    symlinkSync(join(root, 'old-proxy.ts'), join(root, 'src/proxy.ts'))
    write(root, 'instrumentation.ts', OLD_INSTRUMENTATION)
    const notices = upgradeProjectEntries(root, { previous })
    assert.deepEqual(notices.map(notice => [notice.code, notice.target]), [[ENTRY_NOT_REPLACED, 'src/proxy.ts'], [INSTRUMENTATION_TEMPLATE_REPLACED, 'instrumentation.ts']])
    assert.match(notices[0].message, /could not replace it: .*symlink.* cp node_modules\/@nextsparkjs\/core\/templates\/proxy\.ts src\/proxy\.ts/)
    assert.ok(!/[\r\n]/.test(notices[0].message))
    assert.equal(readFileSync(join(root, 'old-proxy.ts'), 'utf8'), OLD_PROXY, 'nothing written through the symlink')

    write(root, 'instrumentation.ts', OLD_INSTRUMENTATION)
    chmodSync(join(root, 'instrumentation.ts'), 0o444)
    assert.deepEqual(upgradeProjectEntries(root, { previous }).map(notice => [notice.code, notice.target]), [[ENTRY_NOT_REPLACED, 'src/proxy.ts'], [ENTRY_NOT_REPLACED, 'instrumentation.ts']])
    assert.equal(readFileSync(join(root, 'instrumentation.ts'), 'utf8'), OLD_INSTRUMENTATION)
  } finally {
    cleanup()
  }
})

test('a Next 15 src/middleware.ts copy becomes the facade under the middleware name', () => {
  const { root, cleanup } = project()
  try {
    write(root, 'src/middleware.ts', OLD_PROXY.replace('function proxy(', 'function middleware('))
    assert.match(projectEntryNotices(root)[0].message, /cp node_modules\/@nextsparkjs\/core\/templates\/proxy\.ts src\/middleware\.ts, then rename the export: export \{ proxy as middleware \}/)
    upgradeProjectEntries(root, { previous })
    assert.match(readFileSync(join(root, 'src/middleware.ts'), 'utf8'), /^export \{ proxy as middleware \} from '@nextsparkjs\/core\/proxy'$/m)
  } finally {
    cleanup()
  }
})

test('a proxy built with createProxy, or re-exporting core\'s, gets neither the facade notice nor the older proxy notices', () => {
  const { root, cleanup } = project()
  try {
    write(root, 'src/proxy.ts', "import { createProxy } from '@nextsparkjs/core/proxy'\nexport const proxy = createProxy({ authenticatedPaths: ['/account'] })\nexport const config = { matcher: ['/((?!_next/static/|_next/image$|favicon\\\\.ico$).*)'] }\n")
    write(root, 'instrumentation.ts', "import { register as registerNextSpark } from '@nextsparkjs/core/instrumentation'\nexport async function register() {\n  await registerNextSpark()\n}\n")
    assert.deepEqual(projectEntryNotices(root), [])
    assert.deepEqual(proxyAreaNotices(root), [])
    write(root, 'src/proxy.ts', PROXY)
    assert.deepEqual(proxyAreaNotices(root), [])
  } finally {
    cleanup()
  }
})

/** The 0.1.0-beta.197 template, from git when the checkout has history (CI clones shallow and skips this). */
function gitShow(spec) {
  try {
    return execFileSync('git', ['show', spec], { cwd: CORE_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return null
  }
}
const BETA_197_PROXY = gitShow('ed2f3960:packages/core/templates/proxy.ts')
const BETA_197_INSTRUMENTATION = gitShow('ed2f3960:packages/core/templates/instrumentation.ts')

test('prepare replaces the 0.1.0-beta.197 templates once the generation is out, and drops the notices they had', { skip: !BETA_197_PROXY && 'no git history' }, async () => {
  assert.equal(isPreviousTemplate('proxy.ts', BETA_197_PROXY), true)
  assert.equal(isPreviousTemplate('instrumentation.ts', BETA_197_INSTRUMENTATION), true)
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  const root = mkdtempSync(join(tmpdir(), 'nextspark-entries-project-'))
  try {
    symlinkSync(join(CORE_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir')
    write(root, 'src/proxy.ts', BETA_197_PROXY)
    write(root, 'instrumentation.ts', BETA_197_INSTRUMENTATION)
    const predicted = await predictHost({ ...host.config, projectRoot: root })
    assert.deepEqual(predicted.notices.filter(notice => /_FACADE_MISSING$/.test(notice.code)).map(notice => notice.target), ['src/proxy.ts', 'instrumentation.ts'])
    assert.equal(readFileSync(join(root, 'src/proxy.ts'), 'utf8'), BETA_197_PROXY, 'a prediction writes nothing')

    const result = await prepareHost({ ...host.config, projectRoot: root }, { mode: 'production' })
    assert.equal(readFileSync(join(root, 'src/proxy.ts'), 'utf8'), PROXY)
    assert.equal(readFileSync(join(root, 'instrumentation.ts'), 'utf8'), INSTRUMENTATION)
    assert.deepEqual(result.notices.filter(notice => /^NS_(?:PROXY|INSTRUMENTATION)_/.test(notice.code)).map(notice => notice.code), [PROXY_TEMPLATE_REPLACED, INSTRUMENTATION_TEMPLATE_REPLACED])
  } finally {
    host.cleanup()
    rmSync(root, { recursive: true, force: true })
  }
})

test('prepare still succeeds when the 0.1.0-beta.197 proxy cannot be replaced, and says why instead of saying it replaces it', { skip: !BETA_197_PROXY && 'no git history' }, async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  const root = mkdtempSync(join(tmpdir(), 'nextspark-entries-project-'))
  try {
    symlinkSync(join(CORE_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir')
    write(root, 'old-proxy.ts', BETA_197_PROXY)
    write(root, 'src/.keep', '')
    symlinkSync(join(root, 'old-proxy.ts'), join(root, 'src/proxy.ts'))
    write(root, 'instrumentation.ts', BETA_197_INSTRUMENTATION)
    const result = await prepareHost({ ...host.config, projectRoot: root }, { mode: 'production' })
    const codes = result.notices.filter(notice => notice.target === 'src/proxy.ts').map(notice => notice.code)
    assert.ok(codes.includes(ENTRY_NOT_REPLACED), codes.join(' '))
    assert.ok(!codes.includes(PROXY_FACADE_WARNING), 'no notice saying prepare replaces a file it could not replace')
    assert.equal(readFileSync(join(root, 'old-proxy.ts'), 'utf8'), BETA_197_PROXY)
    assert.equal(readFileSync(join(root, 'instrumentation.ts'), 'utf8'), INSTRUMENTATION)
  } finally {
    host.cleanup()
    rmSync(root, { recursive: true, force: true })
  }
})

test('prepare shows the facade notices and a copy it could not replace as warnings, not as info', () => {
  const source = readFileSync(join(CORE_ROOT, 'scripts/build/registry/host/prepare-cli.mjs'), 'utf8')
  const warnings = source.match(/const WARNING_NOTICES = new Set\(\[([^\]]*)\]\)/)?.[1] ?? ''
  for (const code of [PROXY_FACADE_WARNING, INSTRUMENTATION_FACADE_WARNING, ENTRY_NOT_REPLACED]) assert.ok(warnings.includes(`'${code}'`), code)
})
