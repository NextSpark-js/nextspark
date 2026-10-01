import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeOrder } from './publish-order.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ORDER_CLI = join(HERE, 'publish-order.mjs')
const PUBLISH = join(HERE, 'publish.sh')
const names = (manifests) => computeOrder(manifests).map((m) => m.name)

const set = [
  { name: 'create-nextspark-app', dependencies: { '@nextsparkjs/cli': '1.0.0' } },
  { name: '@nextsparkjs/plugin-ai', peerDependencies: { '@nextsparkjs/core': '>=1.0.0' } },
  { name: '@nextsparkjs/core', dependencies: { '@nextsparkjs/ui': '1.0.0', react: '^19' } },
  { name: '@nextsparkjs/cli', peerDependencies: { '@nextsparkjs/ai-workflow': '>=1' }, optionalDependencies: { '@nextsparkjs/testing': '1' } },
  { name: '@nextsparkjs/ui' },
  { name: '@nextsparkjs/testing' },
  { name: '@nextsparkjs/ai-workflow' },
]

test('every package comes after the internal packages it depends on or peers on', () => {
  const order = names(set)
  assert.equal(order.length, set.length)
  for (const m of set) {
    for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const dep of Object.keys(m[field] ?? {})) {
        if (order.includes(dep)) assert.ok(order.indexOf(dep) < order.indexOf(m.name), `${dep} must precede ${m.name}`)
      }
    }
  }
  assert.ok(order.indexOf('@nextsparkjs/ui') < order.indexOf('@nextsparkjs/core'))
})

test('the order does not depend on the input order', () => {
  assert.deepEqual(names([...set].reverse()), names(set))
})

test('a dependency cycle fails and names the packages', () => {
  const cycle = [
    { name: 'a', dependencies: { b: '1' } },
    { name: 'b', peerDependencies: { a: '1' } },
    { name: 'c' },
  ]
  assert.throws(() => computeOrder(cycle), /cycle[\s\S]*a -> b[\s\S]*b -> a/)
})

function fixtureTarballs(manifests) {
  const dir = mkdtempSync(join(tmpdir(), 'publish-order-'))
  for (const m of manifests) {
    const pkgDir = join(dir, 'src', m.name.replace(/\W/g, '_'), 'package')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '1.0.0', ...m }))
    const tar = spawnSync('tar', ['czf', join(dir, `${m.name.replace(/\W/g, '-')}-1.0.0.tgz`), '-C', join(pkgDir, '..'), 'package'])
    assert.equal(tar.status, 0)
  }
  return dir
}

test('the CLI reads tarball manifests and prints tgz, name and version in order', () => {
  const dir = fixtureTarballs(set)
  try {
    const r = spawnSync('node', [ORDER_CLI, dir], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
    const rows = r.stdout.trim().split('\n').map((l) => l.split('\t'))
    assert.deepEqual(rows.map((row) => row[1]), names(set))
    assert.ok(rows.every(([file, , version]) => file.endsWith('.tgz') && version === '1.0.0'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('the CLI exits 1 on a cycle', () => {
  const dir = fixtureTarballs([{ name: 'a', dependencies: { b: '1' } }, { name: 'b', dependencies: { a: '1' } }])
  try {
    const r = spawnSync('node', [ORDER_CLI, dir], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /cycle/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('publish.sh refuses --skip-auth-check without --dry-run and an --also-tag equal to --tag', () => {
  const dir = fixtureTarballs([{ name: 'a' }])
  try {
    const skip = spawnSync('bash', [PUBLISH, dir, '--skip-auth-check'], { encoding: 'utf8' })
    assert.equal(skip.status, 1)
    assert.match(skip.stdout, /only valid with --dry-run/)
    const same = spawnSync('bash', [PUBLISH, dir, '--tag', 'beta', '--also-tag', 'beta', '--dry-run'], { encoding: 'utf8' })
    assert.equal(same.status, 1)
    assert.match(same.stdout, /must differ/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// The full dry run verifies real tarballs (pkg:validate, verify-tarballs --expect-all), so it needs a
// complete `pack.sh --all` output: PUBLISH_TEST_PACKS=/path/to/packs node --test scripts/packages/publish-order.test.mjs
test('publish.sh --dry-run lists the packages in dependency order and the dist-tag commands', { skip: !process.env.PUBLISH_TEST_PACKS }, () => {
  const r = spawnSync('bash', [PUBLISH, process.env.PUBLISH_TEST_PACKS, '--tag', 'latest', '--also-tag', 'beta', '--dry-run', '--skip-auth-check'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  const out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  const published = [...out.matchAll(/Would publish (\S+)\.tgz/g)].map((m) => m[1])
  const tagged = [...out.matchAll(/Would run: npm dist-tag add (\S+)@(\S+) beta/g)].map((m) => m[1])
  assert.equal(published.length, 12)
  assert.equal(tagged.length, 12)
  assert.ok(tagged.indexOf('@nextsparkjs/ui') < tagged.indexOf('@nextsparkjs/core'))
  assert.ok(tagged.indexOf('@nextsparkjs/core') < tagged.indexOf('@nextsparkjs/plugin-ai'))
  assert.ok(tagged.indexOf('@nextsparkjs/cli') < tagged.indexOf('create-nextspark-app'))
  assert.match(out, /DRY RUN - No packages were actually published/)
})

// publish.sh against a fake npm on PATH (real publish never runs). Needs the same complete packs as above.
// FAKE_NPM_PUBLISHED: names whose version is already live; FAKE_NPM_FAIL_PUBLISH / FAKE_NPM_FAIL_TAG: a name fragment that fails.
const FAKE_NPM = `#!/bin/bash
echo "$@" >> "$FAKE_NPM_LOG"
case "$1" in
  whoami) echo tester ;;
  view) [[ ",$FAKE_NPM_PUBLISHED," == *",\${2%@*},"* ]] || exit 1 ;;
  publish) if [ -n "$FAKE_NPM_FAIL_PUBLISH" ] && [[ "$2" == *"$FAKE_NPM_FAIL_PUBLISH"* ]]; then echo "npm error 500 fake publish failure"; exit 1; fi ;;
  dist-tag) if [ -n "$FAKE_NPM_FAIL_TAG" ] && [[ "$3" == *"$FAKE_NPM_FAIL_TAG"* ]]; then exit 1; fi ;;
esac
exit 0
`
const withFakeNpm = process.env.PUBLISH_TEST_PACKS ? test : (name, fn) => test(name, { skip: true }, fn)

function runWithFakeNpm(env) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-npm-'))
  const log = join(dir, 'calls.log')
  writeFileSync(log, '')
  writeFileSync(join(dir, 'npm'), FAKE_NPM, { mode: 0o755 })
  const r = spawnSync('bash', [PUBLISH, process.env.PUBLISH_TEST_PACKS, '--tag', 'latest', '--also-tag', 'beta', '--no-cleanup'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FAKE_NPM_LOG: log, ...env },
  })
  const calls = readFileSync(log, 'utf8').trim().split('\n')
  rmSync(dir, { recursive: true, force: true })
  return { r, out: (r.stdout + r.stderr).replace(/\x1b\[[0-9;]*m/g, ''), calls }
}
const callsOf = (calls, verb) => calls.filter((c) => c.startsWith(`${verb} `))

withFakeNpm('a re-run skips what is already published and still moves the beta tag', () => {
  const { r, out, calls } = runWithFakeNpm({ FAKE_NPM_PUBLISHED: '@nextsparkjs/ai-workflow,@nextsparkjs/cli,@nextsparkjs/mobile,@nextsparkjs/testing,@nextsparkjs/ui' })
  assert.equal(r.status, 0, out)
  assert.equal([...out.matchAll(/\[SKIP\] already published/g)].length, 5)
  assert.equal(callsOf(calls, 'publish').length, 7)
  assert.equal(callsOf(calls, 'dist-tag').length, 12)
})

withFakeNpm('a failed publish runs npm publish once, prints its output and stops before the dependents', () => {
  const { r, out, calls } = runWithFakeNpm({ FAKE_NPM_FAIL_PUBLISH: 'nextsparkjs-core-' })
  assert.equal(r.status, 1)
  assert.equal(callsOf(calls, 'publish').filter((c) => c.includes('nextsparkjs-core-')).length, 1)
  assert.match(out, /npm error 500 fake publish failure/)
  assert.ok(!callsOf(calls, 'publish').some((c) => c.includes('plugin-')))
  assert.ok(!callsOf(calls, 'dist-tag').some((c) => c.includes('core@')))
})

withFakeNpm('a failed dist-tag exits 1, keeps publishing and prints the command to re-run', () => {
  const { r, out, calls } = runWithFakeNpm({ FAKE_NPM_FAIL_TAG: '@nextsparkjs/mobile@' })
  assert.equal(r.status, 1)
  assert.equal(callsOf(calls, 'publish').length, 12)
  assert.match(out, /Failed dist-tag commands[\s\S]*npm dist-tag add @nextsparkjs\/mobile@\S+ beta/)
})
