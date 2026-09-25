import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { findPublicRouteThemeLeaks, verifyPublicRouteThemeBoundary } from './verify-public-route-theme-boundary.mjs'

function fixture() {
  const nextDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-theme-boundary-'))
  const appDir = path.join(nextDir, 'server', 'app', '(public)', 'page')
  const chunks = path.join(nextDir, 'static', 'chunks')
  fs.mkdirSync(appDir, { recursive: true })
  fs.mkdirSync(chunks, { recursive: true })
  fs.writeFileSync(path.join(appDir, 'page_client-reference-manifest.js'), `globalThis.__RSC_MANIFEST = {
    '/(public)/page': { entryJSFiles: { main: ['/_next/static/chunks/public.js'] }, clientModules: {} }
  }`)
  fs.writeFileSync(path.join(chunks, 'public.js'), 'safe public chunk')
  return nextDir
}

test('accepts public chunks without server-only theme configuration', () => {
  const nextDir = fixture()
  try {
    assert.deepEqual(findPublicRouteThemeLeaks(nextDir), [])
    assert.doesNotThrow(() => verifyPublicRouteThemeBoundary(nextDir))
  } finally {
    fs.rmSync(nextDir, { recursive: true, force: true })
  }
})

test('fails when a public chunk contains a forbidden configuration marker', () => {
  const nextDir = fixture()
  try {
    fs.writeFileSync(path.join(nextDir, 'static', 'chunks', 'public.js'), 'dashboard.search.placeholder')
    assert.throws(() => verifyPublicRouteThemeBoundary(nextDir), /dashboard config/)
  } finally {
    fs.rmSync(nextDir, { recursive: true, force: true })
  }
})

test('does not inspect dashboard chunks', () => {
  const nextDir = fixture()
  try {
    const appDir = path.join(nextDir, 'server', 'app', 'dashboard', 'page')
    fs.mkdirSync(appDir, { recursive: true })
    fs.writeFileSync(path.join(appDir, 'page_client-reference-manifest.js'), `globalThis.__RSC_MANIFEST = {
      '/dashboard/page': { entryJSFiles: { main: ['/_next/static/chunks/dashboard.js'] }, clientModules: {} }
    }`)
    fs.writeFileSync(path.join(nextDir, 'static', 'chunks', 'dashboard.js'), 'carlos.mendoza@nextspark.dev')
    assert.deepEqual(findPublicRouteThemeLeaks(nextDir), [])
  } finally {
    fs.rmSync(nextDir, { recursive: true, force: true })
  }
})

test('does not mistake a dashboard route group for a public route', () => {
  const nextDir = fixture()
  try {
    const appDir = path.join(nextDir, 'server', 'app', '(templates)', 'dashboard', 'page')
    fs.mkdirSync(appDir, { recursive: true })
    fs.writeFileSync(path.join(appDir, 'page_client-reference-manifest.js'), `globalThis.__RSC_MANIFEST = {
      '/(templates)/dashboard/page': { entryJSFiles: { main: ['/_next/static/chunks/dashboard.js'] }, clientModules: {} }
    }`)
    fs.writeFileSync(path.join(nextDir, 'static', 'chunks', 'dashboard.js'), 'carlos.mendoza@nextspark.dev')
    assert.deepEqual(findPublicRouteThemeLeaks(nextDir), [])
  } finally {
    fs.rmSync(nextDir, { recursive: true, force: true })
  }
})
