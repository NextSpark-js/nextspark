/**
 * CORS on /api is answered by core's routes per request (addCorsHeaders), from api.cors.allowedOrigins,
 * additionalOrigins and CORS_ADDITIONAL_ORIGINS. Headers from next.config apply on top of whatever a route
 * sets, so neither next.config may name CORS headers, in production or not, while the security headers stay.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

type HeaderRule = { source: string; headers: Array<{ key: string; value: string }> }

async function configHeaders(file: string, nodeEnv: string): Promise<HeaderRule[]> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-cors-')))
  const previous = process.env.NODE_ENV
  try {
    // A unique file name per load, so each import evaluates the config afresh
    const copy = path.join(root, `next.config.${nodeEnv}.mjs`)
    fs.copyFileSync(path.join(REPO, file), copy)
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl')), path.join(root, 'node_modules', 'next-intl'), 'dir')
    const { default: config } = await import(pathToFileURL(copy).href)
    ;(process.env as Record<string, string | undefined>).NODE_ENV = nodeEnv
    return await config.headers()
  } finally {
    ;(process.env as Record<string, string | undefined>).NODE_ENV = previous
    fs.rmSync(root, { recursive: true, force: true })
  }
}

for (const file of ['packages/core/templates/next.config.mjs', 'apps/dev/next.config.mjs']) {
  for (const nodeEnv of ['production', 'development']) {
    test(`${file} (${nodeEnv}) names no CORS header and keeps the security headers`, async () => {
      const rules = await configHeaders(file, nodeEnv)
      const keys = rules.flatMap(rule => rule.headers.map(header => header.key.toLowerCase()))
      assert.deepEqual(keys.filter(key => key.startsWith('access-control-')), [])
      for (const key of ['content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy']) {
        assert.ok(keys.includes(key), `${key} is still sent`)
      }
      assert.equal(keys.includes('strict-transport-security'), nodeEnv === 'production')
    })
  }
}
