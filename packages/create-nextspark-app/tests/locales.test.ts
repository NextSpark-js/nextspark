/**
 * #443: `--locales` / `--default-locale` of create-nextspark-app. A bad value fails before the install; a good one
 * reaches the wizard. `pnpm` is replaced by a script on PATH that records what `pnpm exec` (the wizard) is given.
 * #444: the --preset help says a preset is configuration only.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { LOCALES } from '../src/utils/locales.js'
import { AVAILABLE_LOCALES } from '../../cli/src/wizard/types.js'

const PACKAGE_ROOT = path.resolve(import.meta.dirname, '..')

const FAKE_PNPM = `#!/bin/sh
case "$1" in
  --version) echo 10.34.6 ;;
  add) echo "$@" >> "$FAKE_LOG.add"; mkdir -p node_modules/@nextsparkjs/core ;;
  exec) echo "$@" > "$FAKE_LOG.exec" ;;
esac
exit 0
`

function run(...args: string[]) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-locales-')))
  fs.mkdirSync(path.join(root, 'bin'))
  fs.writeFileSync(path.join(root, 'bin', 'pnpm'), FAKE_PNPM, { mode: 0o755 })
  const tsx = path.join(PACKAGE_ROOT, 'node_modules/.bin/tsx')
  const result = spawnSync(tsx, [path.join(PACKAGE_ROOT, 'src/index.ts'), 'app', '-y', '--no-git', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`, FAKE_LOG: path.join(root, 'log') },
  })
  const read = (name: string) => (fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8') : null)
  const out = { status: result.status, output: `${result.stdout}${result.stderr}`, exec: read('log.exec'), installed: read('log.add') !== null, projectCreated: fs.existsSync(path.join(root, 'app')) }
  fs.rmSync(root, { recursive: true, force: true })
  return out
}

test('the locales checked before the install are the wizard\'s', () => {
  assert.deepEqual(LOCALES, Object.keys(AVAILABLE_LOCALES))
})

test('an unknown locale fails with the valid ones, before any install or directory', () => {
  const r = run('--locales', 'en,xx')
  assert.equal(r.status, 1)
  assert.match(r.output, /Unknown locale "xx".*en, es, fr, de, it, pt/)
  assert.equal(r.installed, false)
  assert.equal(r.projectCreated, false)
})

test('an empty list, a default outside the list and a default alone fail the same way', () => {
  for (const args of [['--locales', ','], ['--locales', 'en,es', '--default-locale', 'fr'], ['--default-locale', 'es']]) {
    const r = run(...args)
    assert.equal(r.status, 1, args.join(' '))
    assert.equal(r.installed, false, args.join(' '))
  }
})

test('--locales and --default-locale reach the wizard', () => {
  const r = run('--locales', 'en,es', '--default-locale', 'es')
  assert.equal(r.status, 0, r.output)
  assert.match(r.exec ?? '', /nextspark init .*--locales en,es --default-locale es --yes/)
})

test('no --locales passes nothing to the wizard', () => {
  const r = run()
  assert.equal(r.status, 0, r.output)
  assert.doesNotMatch(r.exec ?? '', /locale/)
})

test('--help documents the flags and that a preset is configuration only', () => {
  const r = spawnSync(path.join(PACKAGE_ROOT, 'node_modules/.bin/tsx'), [path.join(PACKAGE_ROOT, 'src/index.ts'), '--help'], { encoding: 'utf8' })
  const help = r.stdout.replace(/\s+/g, ' ') // commander wraps the lines
  assert.match(help, /--locales <list> Languages of the project, comma-separated \(en, es, fr, de, it, pt\)/)
  assert.match(help, /--default-locale <locale> Default language/)
  assert.match(help, /--preset <preset> .*configuration only, the template comes from --theme/)
})
