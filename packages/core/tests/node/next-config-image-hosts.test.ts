/**
 * /_next/image fetches and resizes the remote hosts in images.remotePatterns on the server. The
 * template a new project copies lists exact hosts only: a wildcard host would let any account on
 * that service through. It keeps the Google avatar host the sign-in UI shows.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

test('the template next.config.mjs allows exact image hosts only, Google avatars included', async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-images-')))
  try {
    const copy = path.join(root, 'next.config.mjs')
    fs.copyFileSync(path.join(REPO, 'packages/core/templates/next.config.mjs'), copy)
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl')), path.join(root, 'node_modules', 'next-intl'), 'dir')
    const { default: config } = await import(pathToFileURL(copy).href)
    const hosts: string[] = config.images.remotePatterns.map((pattern: { hostname: string }) => pattern.hostname)
    assert.deepEqual(hosts.filter(host => host.includes('*')), [])
    assert.ok(hosts.includes('lh3.googleusercontent.com'))
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
