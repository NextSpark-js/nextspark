/**
 * A project's proxy that never names /superadmin or /devtools (#203, S21): core still refuses those pages on the server,
 * but only the proxy can answer a signed-in user without the role with a 307, so `nextspark prepare` warns
 * (NS_PROXY_PROTECTED_AREA_MISSING), naming each area missing and what core's proxy template does for it.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-proxy-areas.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { PROXY_AREA_WARNING, missingProxyAreas, proxyAreaNotice, proxyAreaNotices } from '../proxy-areas.mjs'
import { predictHost } from '../prepare.mjs'
import { PAGE, tempHost, write } from './host-helpers.mjs'

const CORE_ROOT = join(import.meta.dirname, '../../../../..')
const PASS_THROUGH = "import { NextResponse } from 'next/server'\nexport function proxy() { return NextResponse.next() }\n"

test("core's proxy template protects both areas", () => {
  assert.deepEqual(missingProxyAreas(readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), [])
})

test('an area counts only when the proxy names its path; a look-alike prefix or a comment word does not', () => {
  assert.deepEqual(missingProxyAreas(PASS_THROUGH).map(area => area.path), ['/superadmin', '/devtools'])
  assert.deepEqual(missingProxyAreas("const PROTECTED = ['/dashboard', '/superadmin']").map(area => area.path), ['/devtools'])
  assert.deepEqual(missingProxyAreas('if (pathname.startsWith(`/devtools`)) {} // superadmin later').map(area => area.path), ['/superadmin'])
  assert.deepEqual(missingProxyAreas("const docs = '/superadmin-guide'; const tips = \"/devtools-tips\"").map(area => area.path), ['/superadmin', '/devtools'])
})

test("a proxy that re-exports core's template has the check; a re-export of anything else does not", () => {
  assert.deepEqual(missingProxyAreas("export { proxy } from '../../../packages/core/templates/proxy'\nexport const config = { matcher: [] }"), [])
  assert.deepEqual(missingProxyAreas("export { proxy } from '@nextsparkjs/core/templates/proxy'"), [])
  assert.deepEqual(missingProxyAreas("export { proxy } from './my-proxy'").map(area => area.path), ['/superadmin', '/devtools'])
  assert.deepEqual(missingProxyAreas("export { other } from '@nextsparkjs/core/templates/proxy'").map(area => area.path), ['/superadmin', '/devtools'])
  const both = ['/superadmin', '/devtools']
  assert.deepEqual(missingProxyAreas("export { proxy as coreProxy } from '@nextsparkjs/core/templates/proxy'\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { other as proxy } from '@nextsparkjs/core/templates/proxy'").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { proxy } from './vendor/core/templates/proxy'").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("// export { proxy } from '@nextsparkjs/core/templates/proxy'\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("/*\nexport { proxy } from '@nextsparkjs/core/templates/proxy'\n*/\nexport function proxy() {}").map(a => a.path), both)
  assert.deepEqual(missingProxyAreas("export { config, proxy } from '@nextsparkjs/core/templates/proxy.ts'"), [])
})

test('the warning names the file, each missing area, its roles and where the check comes from', () => {
  const notice = proxyAreaNotice('src/proxy.ts', "const PROTECTED = ['/superadmin']")
  assert.equal(notice.code, PROXY_AREA_WARNING)
  assert.deepEqual(notice.areas, ['/devtools'])
  assert.match(notice.message, /^src\/proxy\.ts does not protect \/devtools\./)
  assert.match(notice.message, /\/devtools needs developer/)
  assert.match(notice.message, /node_modules\/@nextsparkjs\/core\/templates\/proxy\.ts/)
  assert.equal(proxyAreaNotice('src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8')), null)
})

test('the proxy Next loads is the one checked; a project without one is not warned about', () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-proxy-areas-'))
  try {
    assert.deepEqual(proxyAreaNotices(root), [])
    write(root, 'src/middleware.ts', PASS_THROUGH)
    assert.deepEqual(proxyAreaNotices(root).map(notice => [notice.target, notice.areas]), [['src/middleware.ts', ['/superadmin', '/devtools']]])
    write(root, 'src/proxy.ts', readFileSync(join(CORE_ROOT, 'templates/proxy.ts'), 'utf8'))
    assert.deepEqual(proxyAreaNotices(root), [], 'src/proxy.ts wins over src/middleware.ts')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("prepare's prediction carries the warning among its notices", async () => {
  const host = tempHost({ 'templates/about/page.tsx': PAGE('About') })
  const project = mkdtempSync(join(tmpdir(), 'nextspark-proxy-areas-project-'))
  try {
    symlinkSync(join(CORE_ROOT, 'node_modules'), join(project, 'node_modules'), 'dir')
    write(project, 'src/proxy.ts', PASS_THROUGH)
    const result = await predictHost({ ...host.config, projectRoot: project })
    assert.equal(result.ok, true, JSON.stringify(result.diagnostics))
    assert.deepEqual(result.notices.filter(notice => notice.code === PROXY_AREA_WARNING).map(notice => notice.areas), [['/superadmin', '/devtools']])
  } finally {
    host.cleanup()
    rmSync(project, { recursive: true, force: true })
  }
})
