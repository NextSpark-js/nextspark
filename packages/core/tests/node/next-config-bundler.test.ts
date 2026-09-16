/**
 * next.config.mjs hands webpack a function that points `@nextsparkjs/registries`
 * at the generated directory and stubs the Node built-ins client bundles reach.
 * A webpack build of a project cannot resolve the registries without it, and
 * Turbopack never reads it. Either bundler runs on either major: Next 15 builds
 * with webpack unless given --turbopack, Next 16 with Turbopack unless given
 * --webpack. The same config ships in core's templates and runs apps/dev.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const CONFIGS = ['packages/core/templates/next.config.mjs', 'apps/dev/next.config.mjs']

type Bundler = 'webpack' | 'turbopack'

/**
 * `process.env.TURBOPACK` as each major leaves it by the time it loads
 * next.config. Next 15's `build` and `dev` set '1' for --turbopack and nothing
 * otherwise. Next 16 parses the bundler first: 'auto' with no flag, '1' for
 * --turbopack, unset for --webpack.
 */
const CASES: Array<{ next: string; bundler: Bundler; command: string; turbopackEnv?: string }> = [
  { next: '15.5.24', bundler: 'webpack', command: 'next build' },
  { next: '15.5.24', bundler: 'turbopack', command: 'next build --turbopack', turbopackEnv: '1' },
  { next: '16.3.5', bundler: 'webpack', command: 'next build --webpack' },
  { next: '16.3.5', bundler: 'turbopack', command: 'next build', turbopackEnv: 'auto' },
  { next: '16.3.5', bundler: 'turbopack', command: 'next build --turbopack', turbopackEnv: '1' },
]

/** A project holding `configFile`, whose installed Next reports `nextVersion`. */
function projectWith(configFile: string, nextVersion: string): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-')))
  fs.copyFileSync(path.join(REPO, configFile), path.join(root, 'next.config.mjs'))

  const nextDir = path.join(root, 'node_modules', 'next')
  fs.mkdirSync(nextDir, { recursive: true })
  fs.writeFileSync(path.join(nextDir, 'package.json'), JSON.stringify({ name: 'next', version: nextVersion }))

  const nextIntl = fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl'))
  fs.symlinkSync(nextIntl, path.join(root, 'node_modules', 'next-intl'), 'dir')
  return root
}

/** Loads the config as Next would with `turbopackEnv`, and runs whatever webpack function it exposes. */
async function loadAndRunWebpack(root: string, turbopackEnv: string | undefined) {
  const previous = process.env.TURBOPACK
  if (turbopackEnv === undefined) delete process.env.TURBOPACK
  else process.env.TURBOPACK = turbopackEnv

  try {
    const { default: config } = await import(pathToFileURL(path.join(root, 'next.config.mjs')).href)
    const webpackConfig = { context: root, resolve: { alias: {} as Record<string, unknown>, fallback: {} as Record<string, unknown> } }
    if (typeof config.webpack === 'function') {
      config.webpack(webpackConfig, { isServer: false })
    }
    return webpackConfig.resolve
  } finally {
    if (previous === undefined) delete process.env.TURBOPACK
    else process.env.TURBOPACK = previous
  }
}

for (const configFile of CONFIGS) {
  for (const { next, bundler, command, turbopackEnv } of CASES) {
    test(`${configFile}: \`${command}\` on Next ${next} ${bundler === 'webpack' ? 'gets' : 'does not get'} the webpack aliases and fallbacks`, async () => {
      const root = projectWith(configFile, next)
      try {
        const resolve = await loadAndRunWebpack(root, turbopackEnv)

        if (bundler === 'webpack') {
          assert.equal(resolve.alias['@nextsparkjs/registries'], path.join(root, '.nextspark/registries'))
          assert.equal(resolve.alias['pg-native'], false)
          assert.equal(resolve.fallback.fs, false)
        } else {
          assert.equal(resolve.alias['@nextsparkjs/registries'], undefined)
          assert.equal(resolve.alias['pg-native'], undefined)
          assert.equal(resolve.fallback.fs, undefined)
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    })
  }
}

test('the TURBOPACK values assumed for Next 16 are the ones its bundler parsing sets', () => {
  const requireFromDev = createRequire(path.join(REPO, 'apps/dev/package.json'))
  const installed = requireFromDev('next/package.json').version as string
  assert.equal(Number.parseInt(installed, 10), 16, `apps/dev runs Next ${installed}`)

  const { parseBundlerArgs } = requireFromDev('next/dist/lib/bundler.js') as {
    parseBundlerArgs: (options: { webpack?: boolean; turbopack?: boolean }) => number
  }
  const previous = process.env.TURBOPACK

  try {
    for (const { command, turbopackEnv } of CASES.filter((c) => c.next.startsWith('16.'))) {
      delete process.env.TURBOPACK
      parseBundlerArgs({ webpack: command.includes('--webpack'), turbopack: command.includes('--turbopack') })
      assert.equal(process.env.TURBOPACK, turbopackEnv, command)
    }
  } finally {
    if (previous === undefined) delete process.env.TURBOPACK
    else process.env.TURBOPACK = previous
  }
})
