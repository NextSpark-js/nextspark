/**
 * Tests for the template-registry generator.
 *
 * What matters here is the BINDING the generator emits. A static
 * `import Template_0 from '...'` per template makes every route that touches
 * the registry pull in the whole template graph (#183), so both registries
 * have to emit a deferred import instead — and the server one has to do it
 * without a Suspense boundary, which would let a response commit a 200 before
 * a template's own notFound() runs (#129).
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/template-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  generateTemplateRegistry,
  generateTemplateRegistryClient
} from '../generators/template-registry.mjs'

const pageTemplate = {
  name: '(public)/page',
  themeName: 'default',
  templateType: 'page',
  fileName: 'page.tsx',
  relativePath: '(public)/page.tsx',
  appPath: 'app/(public)/page.tsx',
  templatePath: '@/contents/themes/default/templates/(public)/page.tsx',
  priority: 10
}

const protectedTemplate = {
  ...pageTemplate,
  name: 'dashboard/layout',
  templateType: 'layout',
  fileName: 'layout.meta.ts',
  relativePath: 'dashboard/layout.meta.ts',
  appPath: 'app/dashboard/layout.tsx',
  templatePath: '@/contents/themes/default/templates/dashboard/layout.meta.ts'
}

const config = { outputDir: '/tmp/registries', projectRoot: '/tmp/project' }

test('server registry defers the import instead of hoisting a static one', () => {
  const out = generateTemplateRegistry([pageTemplate], config)

  assert.match(
    out,
    /component: lazyTemplate\('app\/\(public\)\/page\.tsx', \(\) => import\('@\/contents\/themes\/default\/templates\/\(public\)\/page'\)\)/
  )
  assert.doesNotMatch(out, /^import Template_\d+ from/m)
})

test('names the template in the error when it has no default export', () => {
  const out = generateTemplateRegistry([pageTemplate], config)

  // Without the module loaded up front, React would otherwise fail with a bare
  // "invalid element type" and no clue which template is at fault
  assert.match(out, /has no default export/)
  assert.match(out, /if \(!templateModule\.default\)/)
})

test('server registry loads templates without a Suspense boundary', () => {
  const out = generateTemplateRegistry([pageTemplate], config)

  // An async Server Component awaits inline; next/dynamic would wrap the
  // template in Suspense and break notFound()'s hold on the status code.
  assert.match(out, /return async function TemplateOverride/)
  assert.doesNotMatch(out, /^import .* from 'next\/dynamic'/m)
})

test('metadata-only templates still carry no component', () => {
  const out = generateTemplateRegistry([protectedTemplate], config)

  assert.match(out, /component: null/)
  assert.doesNotMatch(out, /layout\.meta'\)\)/)
})

test('client registry defers the import through next/dynamic', async () => {
  const out = await generateTemplateRegistryClient([pageTemplate], config)

  assert.match(out, /import dynamic from 'next\/dynamic'/)
  assert.match(
    out,
    /'app\/\(public\)\/page\.tsx': dynamic\(\(\) => import\('@\/contents\/themes\/default\/templates\/\(public\)\/page'\)\)/
  )
  assert.doesNotMatch(out, /^import ClientTemplate_\d+ from/m)
})
