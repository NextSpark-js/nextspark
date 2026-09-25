import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  expectedPublishedPackageNames,
  loadAllowlist,
  missingExpectedPackages,
  parseArgs,
  publishablePackagesMissingFiles,
  pluginDirectoriesOutsideFiles,
  verifyDirectory,
} from './verify-tarballs.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'verify-tarballs.mjs')

/**
 * Builds a synthetic `.tgz` shaped like a real `pnpm pack` output (a single
 * top-level "package/" directory) from a flat map of relative-path -> file
 * content, and packs it with the system `tar` binary - the same tool the
 * checker and pack-templates.test.mjs both use to read real tarballs.
 */
function buildFixtureTarball(outputDir, tarballName, files) {
  const stageDir = mkdtempSync(join(tmpdir(), 'verify-tarballs-fixture-'))
  const pkgDir = join(stageDir, 'package')
  mkdirSync(pkgDir, { recursive: true })
  for (const [relPath, content] of Object.entries(files)) {
    const abs = join(pkgDir, relPath)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content)
  }
  const outputPath = join(outputDir, tarballName)
  const result = spawnSync('tar', ['czf', outputPath, '-C', stageDir, 'package'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  rmSync(stageDir, { recursive: true, force: true })
  return outputPath
}

function withFixtureDir(builder) {
  const dir = mkdtempSync(join(tmpdir(), 'verify-tarballs-run-'))
  try {
    return builder(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const VALID_PKG_JSON = (overrides = {}) =>
  JSON.stringify(
    {
      name: '@nextsparkjs/fixture',
      version: '0.1.0-beta.192',
      type: 'module',
      main: './dist/index.js',
      types: './dist/index.d.ts',
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './lib/*': { types: './dist/lib/*.d.ts', import: './dist/lib/*.js' },
      },
      dependencies: {},
      ...overrides,
    },
    null,
    2,
  )

test('a well-formed tarball passes with zero findings', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      'README.md': '# Fixture\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    assert.equal(results.length, 1)
    assert.deepEqual(results[0].findings, [], JSON.stringify(results[0].findings, null, 2))
  })
})

test('a missing exports/main target fails', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      // dist/index.js and dist/index.d.ts are intentionally absent.
      'README.md': '# Fixture\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const types = results[0].findings.map((f) => f.type)
    assert.ok(types.includes('entrypoint-missing'), types.join(', '))
    assert.ok(types.includes('exports-target-missing'), types.join(', '))
  })
})

test('a wildcard export with no matching file fails', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      // dist/lib/ exists but has no matching .js/.d.ts pair for the "*" export.
      'dist/lib/.gitkeep': '',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const finding = results[0].findings.find((f) => f.type === 'exports-target-missing')
    assert.ok(finding, JSON.stringify(results[0].findings, null, 2))
    assert.match(finding.message, /matched no files/)
  })
})

test('a workspace: protocol surviving in the packed package.json fails', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON({ dependencies: { '@nextsparkjs/testing': 'workspace:*' } }),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const finding = results[0].findings.find((f) => f.type === 'dependency-protocol')
    assert.ok(finding, JSON.stringify(results[0].findings, null, 2))
    assert.match(finding.message, /workspace:/)
  })
})

test('an internal @nextsparkjs dependency pinned to a different version than the one being packed fails', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON({ dependencies: { '@nextsparkjs/other': '^0.1.0-beta.2' } }),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })
    buildFixtureTarball(dir, 'nextsparkjs-other-0.1.0-beta.192.tgz', {
      'package.json': JSON.stringify({ name: '@nextsparkjs/other', version: '0.1.0-beta.192', main: './index.js' }),
      'index.js': 'export const y = 1;\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const fixtureResult = results.find((r) => r.pkgName === '@nextsparkjs/fixture')
    const finding = fixtureResult.findings.find((f) => f.type === 'internal-version-mismatch')
    assert.ok(finding, JSON.stringify(fixtureResult.findings, null, 2))
    assert.match(finding.message, /beta\.192/)
  })
})

test('a leaked /Users/ path fails and the report never prints the raw path', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': "export const x = '/Users/janedoe-maintainer/secret-project';\n",
      'dist/index.d.ts': 'export declare const x: string;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const finding = results[0].findings.find((f) => f.type === 'maintainer-path-unix')
    assert.ok(finding, JSON.stringify(results[0].findings, null, 2))
    assert.equal(finding.file, 'dist/index.js')
    assert.equal(finding.line, 1)
    assert.doesNotMatch(finding.message, /janedoe-maintainer/, 'the maintainer handle must be masked, not printed')
    assert.match(finding.message, /\[redacted\]/)
  })
})

test('a leaked PEM private key header fails and masks the match', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      'fixtures/leaked.pem': '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const finding = results[0].findings.find((f) => f.type === 'secret-pem')
    assert.ok(finding, JSON.stringify(results[0].findings, null, 2))
    assert.doesNotMatch(finding.message, /MIIEpAIBAAKCAQEA/)
  })
})

test('a stray .env file fails but .env.example is allowed', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      'templates/app/.env.example': 'DATABASE_URL=\n',
      'templates/app/.env': 'DATABASE_URL=postgres://leaked\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const dotenvFindings = results[0].findings.filter((f) => f.type === 'dotenv-file')
    assert.equal(dotenvFindings.length, 1)
    assert.equal(dotenvFindings[0].file, 'templates/app/.env')
  })
})

test('local build and test artifact directories fail', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      'coverage/clover.xml': '<file name="/Users/maintainer/project.ts" />\n',
      'node_modules/example/index.js': 'module.exports = {}\n',
      '.next/cache/build': 'cache\n',
      '.turbo/turbo-build.log': 'cache\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    assert.deepEqual(
      results[0].findings.filter((finding) => finding.type.startsWith('excluded-dir-')).map((finding) => finding.type).sort(),
      ['excluded-dir-coverage', 'excluded-dir-next', 'excluded-dir-node-modules', 'excluded-dir-turbo'],
    )
  })
})

test('an allowlisted finding with a reason is suppressed but still visible in the report', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON({ dependencies: { '@nextsparkjs/testing': 'workspace:*' } }),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })
    const allowlistPath = join(dir, 'allowlist.json')
    writeFileSync(
      allowlistPath,
      JSON.stringify([
        {
          package: '@nextsparkjs/fixture',
          type: 'dependency-protocol',
          match: 'dep-protocol:dependencies:@nextsparkjs/testing',
          reason: 'Test fixture: known false positive documented for this synthetic package only.',
        },
      ]),
    )

    const results = verifyDirectory(dir, allowlistPath)
    assert.deepEqual(results[0].findings, [])
    assert.equal(results[0].allowlisted.length, 1)
    assert.equal(results[0].allowlisted[0].reason.length > 0, true)
  })
})

test('an allowlist entry without a reason is rejected outright (fails closed)', () => {
  withFixtureDir((dir) => {
    const allowlistPath = join(dir, 'allowlist.json')
    writeFileSync(
      allowlistPath,
      JSON.stringify([{ package: '@nextsparkjs/fixture', type: 'dependency-protocol', match: 'dep-protocol:dependencies:@nextsparkjs/testing' }]),
    )
    assert.throws(() => loadAllowlist(allowlistPath), /reason/)
  })
})

test('parseArgs resolves a relative directory against the current working directory', () => {
  const args = parseArgs(['./some-dir'])
  assert.equal(args.dir, join(process.cwd(), 'some-dir'))
})

test('parseArgs accepts pnpm\'s argument separator before the directory', () => {
  const args = parseArgs(['--expect-all', '--', './some-dir'])
  assert.equal(args.dir, join(process.cwd(), 'some-dir'))
  assert.equal(args.expectAll, true)
})

test('the release-set expectation includes the published langchain plugin', () => {
  assert.ok(expectedPublishedPackageNames().includes('@nextsparkjs/plugin-langchain'))
})

test('every publishable package declares an explicit files allowlist', () => {
  assert.deepEqual(publishablePackagesMissingFiles(), [])
})

test('every top-level plugin directory is either shipped or deliberately excluded', () => {
  assert.deepEqual(pluginDirectoriesOutsideFiles(), [])
})

test('a plugin directory missing from files is reported, excluded ones are not', () => {
  const repo = mkdtempSync(join(tmpdir(), 'plugin-files-'))
  try {
    const plugin = join(repo, 'plugins', 'demo')
    for (const dir of ['api', 'entities', 'lib', 'tests', 'coverage']) mkdirSync(join(plugin, dir), { recursive: true })
    writeFileSync(join(plugin, 'package.json'), JSON.stringify({ name: '@x/plugin-demo', files: ['plugin.config.ts', 'lib', './api/**'] }))
    assert.deepEqual(pluginDirectoriesOutsideFiles(repo), [join('plugins', 'demo', 'entities')])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('the release-set expectation reports a missing published package tarball', () => {
  assert.deepEqual(
    missingExpectedPackages([{ pkgName: '@nextsparkjs/core' }], ['@nextsparkjs/core', '@nextsparkjs/plugin-langchain']),
    ['@nextsparkjs/plugin-langchain'],
  )
})

test('the CLI exits non-zero when it finds a real problem, and zero for a clean directory', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON({ dependencies: { '@nextsparkjs/testing': 'workspace:*' } }),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })
    const failing = spawnSync(process.execPath, [SCRIPT, dir, '--allowlist', join(dir, 'no-allowlist.json')], { encoding: 'utf8' })
    assert.equal(failing.status, 1, failing.stdout)
    assert.match(failing.stdout, /workspace:/)
  })

  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })
    const passing = spawnSync(process.execPath, [SCRIPT, dir, '--allowlist', join(dir, 'no-allowlist.json')], { encoding: 'utf8' })
    assert.equal(passing.status, 0, passing.stdout)
    assert.match(passing.stdout, /All 1 package\(s\) passed/)
  })
})

test('a bin-only package (no main/types/exports) passes cleanly', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': JSON.stringify({
        name: '@nextsparkjs/fixture',
        version: '0.1.0-beta.192',
        type: 'module',
        bin: { fixture: './bin/fixture.js' },
        dependencies: {},
      }),
      'bin/fixture.js': '#!/usr/bin/env node\nconsole.log("hi");\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    assert.deepEqual(results[0].findings, [], JSON.stringify(results[0].findings, null, 2))
  })
})

test('an internal @nextsparkjs dependency spec that is not a single version ("||" union) is a finding, not a silent skip', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON({
        dependencies: { '@nextsparkjs/other': '^0.1.0-beta.191 || ^9.0.0' },
      }),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
    })
    buildFixtureTarball(dir, 'nextsparkjs-other-0.1.0-beta.192.tgz', {
      'package.json': JSON.stringify({ name: '@nextsparkjs/other', version: '0.1.0-beta.192', main: './index.js' }),
      'index.js': 'export const y = 1;\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const fixtureResult = results.find((r) => r.pkgName === '@nextsparkjs/fixture')
    const finding = fixtureResult.findings.find((f) => f.type === 'internal-version-unparseable')
    assert.ok(finding, JSON.stringify(fixtureResult.findings, null, 2))
    assert.match(finding.message, /not a single pinned version/)
  })

  // A dist-tag and a wildcard are equally unverifiable and must also be findings.
  for (const spec of ['latest', '*']) {
    withFixtureDir((dir) => {
      buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
        'package.json': VALID_PKG_JSON({ dependencies: { '@nextsparkjs/other': spec } }),
        'dist/index.js': 'export const x = 1;\n',
        'dist/index.d.ts': 'export declare const x: number;\n',
        'dist/lib/foo.js': 'export const foo = 1;\n',
        'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      })
      buildFixtureTarball(dir, 'nextsparkjs-other-0.1.0-beta.192.tgz', {
        'package.json': JSON.stringify({ name: '@nextsparkjs/other', version: '0.1.0-beta.192', main: './index.js' }),
        'index.js': 'export const y = 1;\n',
      })

      const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
      const fixtureResult = results.find((r) => r.pkgName === '@nextsparkjs/fixture')
      const finding = fixtureResult.findings.find((f) => f.type === 'internal-version-unparseable')
      assert.ok(finding, `spec "${spec}": ${JSON.stringify(fixtureResult.findings, null, 2)}`)
    })
  }
})

test('a secret-looking tarball path (e.g. under node_modules/) is a finding and is masked everywhere it is reported', () => {
  withFixtureDir((dir) => {
    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      // node_modules/ itself is also an excluded-dir finding; the path
      // segment additionally looks like a Resend-style key.
      'node_modules/re_abcdefghijklmnopqrstuvwxyz/anything.js': 'module.exports = {};\n',
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const pathFinding = results[0].findings.find((f) => f.type === 'secret-resend' && f.matchKey.startsWith('path:'))
    assert.ok(pathFinding, JSON.stringify(results[0].findings, null, 2))
    assert.doesNotMatch(pathFinding.message, /re_abcdefghijklmnopqrstuvwxyz/, 'the path-embedded secret must be masked, not printed')

    // The excluded-dir(node_modules) finding's own example listing must not
    // leak the raw secret-looking path either.
    const excludedFinding = results[0].findings.find((f) => f.type === 'excluded-dir-node-modules')
    assert.ok(excludedFinding)
    assert.doesNotMatch(excludedFinding.message, /re_abcdefghijklmnopqrstuvwxyz/, 'excluded-dir example paths must be redacted too')

    // And the full CLI report (what actually reaches a human) must not
    // contain the raw secret anywhere either.
    const run = spawnSync(process.execPath, [SCRIPT, dir, '--allowlist', join(dir, 'no-allowlist.json')], { encoding: 'utf8' })
    assert.doesNotMatch(run.stdout, /re_abcdefghijklmnopqrstuvwxyz/)
  })
})

test('a binary DER-like file with a key-like filename is a finding', () => {
  withFixtureDir((dir) => {
    // A DER-encoded RSA private key has no PEM armor (no ASCII header) and
    // contains a NUL byte, so it would be skipped wholesale as "binary" by
    // the text scanner. Build a synthetic binary buffer carrying the
    // rsaEncryption OID magic bytes this checker looks for, with a NUL to
    // guarantee it is treated as binary.
    const derLike = Buffer.concat([
      Buffer.from([0x30, 0x82, 0x01, 0x00, 0x00]), // ASN.1 SEQUENCE header + a NUL byte
      Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]), // rsaEncryption OID
      Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]),
    ])
    assert.ok(derLike.includes(0), 'fixture must actually be binary for this test to be meaningful')

    buildFixtureTarball(dir, 'nextsparkjs-fixture-0.1.0-beta.192.tgz', {
      'package.json': VALID_PKG_JSON(),
      'dist/index.js': 'export const x = 1;\n',
      'dist/index.d.ts': 'export declare const x: number;\n',
      'dist/lib/foo.js': 'export const foo = 1;\n',
      'dist/lib/foo.d.ts': 'export declare const foo: number;\n',
      'fixtures/server.key': derLike,
    })

    const results = verifyDirectory(dir, join(dir, 'missing-allowlist.json'))
    const filenameFinding = results[0].findings.find((f) => f.type === 'key-like-filename')
    assert.ok(filenameFinding, JSON.stringify(results[0].findings, null, 2))
    assert.equal(filenameFinding.file, 'fixtures/server.key')

    const derFinding = results[0].findings.find((f) => f.type === 'secret-der-key')
    assert.ok(derFinding, JSON.stringify(results[0].findings, null, 2))
    assert.equal(derFinding.file, 'fixtures/server.key')
  })
})
