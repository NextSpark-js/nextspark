import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const CORE_TEMPLATE_APP = join(REPO_ROOT, 'packages/core/templates/app')
const PACK_SCRIPT = join(REPO_ROOT, 'scripts/packages/pack.sh')

function packCore(outputDir) {
  return spawnSync('bash', [PACK_SCRIPT, '--package', 'core', '--skip-build', '--output', outputDir], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  })
}

/**
 * Core ships no app tree (#203): src/app is generated in each project by `nextspark prepare`, so
 * the tarball carries the route modules the generated facades import, and pack.sh refuses to pack
 * when a templates/app left by the removed sync:templates is lying around.
 */
test('the core tarball ships the route modules and no templates/app', () => {
  assert.equal(existsSync(CORE_TEMPLATE_APP), false, 'packages/core/templates/app must not exist; delete the generated leftover')
  const outputDir = mkdtempSync(join(tmpdir(), 'pack-templates-test-'))
  try {
    const result = packCore(outputDir)
    assert.equal(result.status, 0, result.stderr || result.stdout)

    const archive = readdirSync(outputDir).find((file) => /^nextsparkjs-core-.*\.tgz$/.test(file))
    assert.ok(archive, `expected a core tarball in ${outputDir}`)
    const listed = spawnSync('tar', ['tzf', join(outputDir, archive)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    assert.equal(listed.status, 0, listed.stderr || listed.stdout)
    assert.doesNotMatch(listed.stdout, /package\/(dist\/)?templates\/app\//, 'the core tarball must not include templates/app')

    const unpacked = spawnSync('tar', ['xzf', join(outputDir, archive), '-C', outputDir], { encoding: 'utf8' })
    assert.equal(unpacked.status, 0, unpacked.stderr || unpacked.stdout)

    // With --skip-build there may be no dist to ship, so the route logic is read from the module
    // core builds it from.
    const builtRoutes = existsSync(join(REPO_ROOT, 'packages/core/dist/routes'))
    const shippedRoute = (route) => {
      const shipped = join(outputDir, `package/dist/routes/${route}.js`)
      if (builtRoutes) {
        assert.ok(existsSync(shipped), `the core tarball must ship dist/routes/${route}.js`)
        return readFileSync(shipped, 'utf8')
      }
      return readFileSync(join(REPO_ROOT, `packages/core/src/routes/${route}.ts`), 'utf8')
    }
    assert.match(
      shippedRoute('api/auth/[...all]/route'),
      /getAuthReadinessResponse/,
      'the shipped auth route must enforce runtime provider readiness',
    )
    assert.match(
      shippedRoute('api/v1/auth/signup-with-invite/route'),
      /isPasswordLoginEnabled/,
      'the shipped invite signup route must enforce the password backend switch',
    )
    assert.ok(existsSync(join(outputDir, 'package/dist/routes/manifest.json')) || !builtRoutes, 'the core tarball must ship the route manifest')
    if (builtRoutes) {
      // The registry build reads each core route's docs and presets next to its module
      assert.ok(existsSync(join(outputDir, 'package/dist/routes/api/v1/teams/docs.md')), 'core route docs ship next to their route')
      assert.ok(existsSync(join(outputDir, 'package/dist/routes/api/v1/teams/presets.ts')), 'core route presets ship as source')
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true })
  }
})
