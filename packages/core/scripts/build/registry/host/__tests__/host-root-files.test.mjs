/**
 * The root files of a host (#480): `nextspark prepare` lists the files of public/'s root and the root routes with a dot
 * in `.nextspark/registries/root-files.ts`, which `createProxy({ rejectUnknownRootFiles: true })` reads.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/host-root-files.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { notFoundRewritePath, rootFileNames } from '../root-files.mjs'
import { prepareHost } from '../prepare.mjs'
import { PAGE, ROUTE, hostConfig, read, write } from './host-helpers.mjs'

const route = (kind, target) => ({ kind, target })

test('public/ root files, root metadata routes and root routes with a dot are listed; folders, nested and dynamic ones are not', () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-root-files-'))
  try {
    write(root, 'public/favicon.ico', '')
    write(root, 'public/ads.txt', '')
    write(root, 'public/images/logo.png', '')
    write(root, 'public/LICENSE', '')
    mkdirSync(join(root, 'public/assets.v2'))
    symlinkSync(join(root, 'public/ads.txt'), join(root, 'public/app-ads.txt'))
    const names = rootFileNames({
      hostRoot: root,
      routes: [
        route('robots', 'robots.ts'),
        route('sitemap', 'sitemap.ts'),
        route('manifest', 'manifest.ts'),
        route('icon', 'icon.tsx'),
        route('route', 'llms.txt/route.ts'),
        route('route', '(public)/feed.xml/route.ts'),
        route('page', '(public)/[slug]/page.tsx'),
        route('page', '(public)/blog/[...slug]/page.tsx'),
        route('route', 'api/v1/data.json/route.ts'),
        route('sitemap', 'blog/sitemap.ts'),
        route('page', '(public)/page.tsx'),
      ],
    })
    assert.deepEqual(names, ['ads.txt', 'app-ads.txt', 'favicon.ico', 'feed.xml', 'llms.txt', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a host without public/ lists only its routes', () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-root-files-'))
  try {
    assert.deepEqual(rootFileNames({ hostRoot: root, routes: [route('robots', 'robots.ts')] }), ['robots.txt'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('prepare writes the list with the registries, from the plan and the host public/', async () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-root-files-host-'))
  try {
    write(root, 'source/templates/pricing/page.tsx', PAGE('Pricing'))
    write(root, 'source/templates/llms.txt/route.ts', ROUTE)
    write(root, 'host/public/favicon.ico', '')
    const run = await prepareHost(hostConfig(root))
    const file = run.files.find(entry => entry.path === '.nextspark/registries/root-files.ts')
    assert.ok(file, 'root-files.ts is published')
    assert.equal(read(join(root, 'host'), '.nextspark/registries/root-files.ts'), file.content)
    assert.match(file.content, /export const ROOT_FILES = \[\n {2}"favicon\.ico",\n {2}"llms\.txt"\n\] as readonly string\[\]/)
    assert.match(file.content, /\nexport const NOT_FOUND_REWRITE_PATH = "\/_ns\/not-found"\n/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('under Cache Components the not-found rewrite goes to /_not-found only when a route serves /_ns/not-found: a dynamic route of two or more segments at the root (#480)', () => {
  const at = (...targets) => notFoundRewritePath({ cacheComponents: true, routes: targets.map(target => route('page', target)) })
  for (const target of ['(public)/[...slug]/page.tsx', '[[...slug]]/page.tsx', '(public)/[a]/[b]/page.tsx', '[a]/not-found/page.tsx', '(public)/[a]/[...rest]/page.tsx', '%5Fns/not-found/page.tsx', '(marketing)/@modal/[...x]/page.tsx']) {
    assert.equal(at(target), '/_not-found', target)
  }
  assert.equal(notFoundRewritePath({ cacheComponents: true, routes: [route('route', '[...path]/route.ts')] }), '/_not-found')
  for (const target of ['(public)/[slug]/page.tsx', '(public)/blog/[...slug]/page.tsx', '[a]/[b]/[c]/page.tsx', '[a]/other/page.tsx', '_ns/not-found/page.tsx', 'page.tsx', 'docs/[section]/[page]/page.tsx']) {
    assert.equal(at(target), '/_ns/not-found', target)
  }
  assert.equal(notFoundRewritePath({ cacheComponents: true, routes: [route('layout', '[...slug]/layout.tsx')] }), '/_ns/not-found')
})

test('a legacy ISR route answers /_ns/not-found with its own 404, so it keeps that destination; per-route modes count only cc routes (#480)', () => {
  const catchAll = { kind: 'page', target: '(public)/[...slug]/page.tsx' }
  assert.equal(notFoundRewritePath({ cacheComponents: false, routes: [catchAll] }), '/_ns/not-found')
  assert.equal(notFoundRewritePath({ routes: [catchAll] }), '/_ns/not-found')
  assert.equal(notFoundRewritePath({ cacheComponents: true, routes: [{ ...catchAll, mode: 'isr' }] }), '/_ns/not-found')
  assert.equal(notFoundRewritePath({ routes: [{ ...catchAll, mode: 'cc' }] }), '/_not-found')
})

test("prepare writes /_not-found for a project's own root catch-all under Cache Components, and /_ns/not-found for a legacy host (#480)", async () => {
  const root = mkdtempSync(join(tmpdir(), 'nextspark-root-files-host-'))
  try {
    write(root, 'source/templates/(public)/[...path]/page.tsx', PAGE('Any'))
    mkdirSync(join(root, 'host'))
    const destination = async cacheComponents => {
      const run = await prepareHost(hostConfig(root, { modes: [], cacheComponents }))
      return /\nexport const NOT_FOUND_REWRITE_PATH = "([^"]+)"\n/.exec(run.files.find(entry => entry.path === '.nextspark/registries/root-files.ts').content)?.[1]
    }
    assert.equal(await destination(true), '/_not-found')
    // Legacy ISR: the catch-all's notFound() answers 404 itself
    assert.equal(await destination(false), '/_ns/not-found')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
