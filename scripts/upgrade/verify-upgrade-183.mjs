#!/usr/bin/env node
/**
 * The oldest supported upgrade (G0 decision 9): a project as 0.1.0-beta.183 creates it, upgraded with the `nextspark
 * migrate` of this tree. Everything but the tarballs comes from the npm registry and from this file; no private data.
 *
 *   create      `create-nextspark-app@0.1.0-beta.183` (published) makes a `contents/themes/` project, and the .183 CLI migrates
 *               its database
 *   customize   a theme template and entity are edited or added, plus a theme API route, a local plugin with a migration, a
 *               page and a Route Handler of the project's own, and a user edit of a generated file; committed with
 *               `node_modules/` and `.next/` ignored (the first thing the upgrade guide asks of such a project)
 *   bump        cli, core, ui and testing become this tree's tarballs; `pnpm install`
 *   migrate     `nextspark migrate --dry-run` (exit 0), then `--yes`, then install, `prepare` and `prepare --check`
 *   database    `pnpm db:migrate` applies only what is new: no row of `_migrations` is lost or applied twice
 *   build       `pnpm build` (the three placeholder lines of .env removed, as the guide says) and `next start`
 *   serve       /login, the edited template, the new page, the health route, the theme route at its new and at its old URL, and
 *               the Route Handler answer; the moved files hold the user's edits
 *
 *   node scripts/upgrade/verify-upgrade-183.mjs --packages <tarball dir> [--work DIR] [--logs DIR] [--pnpm 10.34.6]
 *        [--port 4950] [--database upgrade183_ci] [--keep]
 *
 * --packages  the tarballs `scripts/packages/pack.sh --all` writes (cli, core, ui and testing are used)
 * --work      scratch directory outside this repository (default: a new one under $TMPDIR); must be new or empty;
 *             removed when the run passes, unless --keep
 * --pnpm      the pnpm the project uses, through Corepack (default 10.34.6: later pnpm refuse the .183 build allowlist with
 *             ERR_PNPM_IGNORED_BUILDS until migrate has rewritten it, which the upgrade guide describes)
 * ENVIRONMENT PGHOST (localhost), PGPORT (5432), PGUSER ($USER), PGPASSWORD: a PostgreSQL where this user can create and
 *             drop databases; psql, createdb and dropdb, git, curl-free (Node's fetch), pnpm via Corepack.
 * Logs: one file per step in --logs. Exit 0 every step passed, 1 a step failed, 2 usage or environment error. The server is
 * stopped by process group and the database dropped, also when a step fails.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir, userInfo } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const FIXTURE_VERSION = '0.1.0-beta.183'
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const { values } = parseArgs({
  options: {
    packages: { type: 'string' },
    work: { type: 'string' },
    logs: { type: 'string' },
    pnpm: { type: 'string', default: '10.34.6' },
    port: { type: 'string', default: '4950' },
    database: { type: 'string', default: 'upgrade183_ci' },
    keep: { type: 'boolean', default: false },
  },
})
const usage = (message) => {
  console.error(`${message}\nusage: verify-upgrade-183.mjs --packages <tarball dir> [--work DIR] [--logs DIR] [--pnpm VERSION] [--port N] [--database NAME] [--keep]`)
  process.exit(2)
}
if (!values.packages || !existsSync(values.packages)) usage('--packages must be a directory of tarballs')
if (!/^[a-z0-9_]+$/.test(values.database)) usage('--database takes lower-case letters, digits and underscores')
const packages = path.resolve(values.packages)
const tarball = (name) => {
  const file = readdirSync(packages).find(entry => entry.startsWith(`${name}-`) && entry.endsWith('.tgz') && /^\d/.test(entry.slice(name.length + 1)))
  if (!file) usage(`${packages} holds no ${name} tarball`)
  return path.join(packages, file)
}
const tarballs = { '@nextsparkjs/cli': tarball('nextsparkjs-cli'), '@nextsparkjs/core': tarball('nextsparkjs-core'), '@nextsparkjs/ui': tarball('nextsparkjs-ui'), '@nextsparkjs/testing': tarball('nextsparkjs-testing') }

const work = path.resolve(values.work ?? mkdtempSync(path.join(tmpdir(), 'upgrade-183.')))
if (`${work}${path.sep}`.startsWith(`${repoRoot}${path.sep}`)) usage('--work must be outside this repository')
if (values.work && existsSync(work) && readdirSync(work).length > 0) usage('--work must be a new or empty directory: it is removed when the run passes')
mkdirSync(work, { recursive: true })
const logs = path.resolve(values.logs ?? path.join(work, 'logs'))
mkdirSync(logs, { recursive: true })
const app = path.join(work, 'app')
const pg = { PGHOST: process.env.PGHOST ?? 'localhost', PGPORT: process.env.PGPORT ?? '5432', PGUSER: process.env.PGUSER ?? userInfo().username }
if (process.env.PGPASSWORD) pg.PGPASSWORD = process.env.PGPASSWORD

// Corepack gives the project the pnpm it is meant to run with: the packageManager of the nearest package.json above it
writeFileSync(path.join(work, 'package.json'), JSON.stringify({ packageManager: `pnpm@${values.pnpm}` }))
const pnpmBin = path.join(work, 'pnpm-bin')
mkdirSync(pnpmBin, { recursive: true })
const env = {
  ...process.env,
  ...pg,
  PATH: `${pnpmBin}${path.delimiter}${process.env.PATH}`,
  COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  CYPRESS_INSTALL_BINARY: '0',
  NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google',
  FORCE_COLOR: '0',
  NO_COLOR: '1',
}
delete env.NODE_ENV
const databaseUrl = () => {
  const credentials = pg.PGPASSWORD ? `${encodeURIComponent(pg.PGUSER)}:${encodeURIComponent(pg.PGPASSWORD)}` : encodeURIComponent(pg.PGUSER)
  return `postgresql://${credentials}@${pg.PGHOST}:${pg.PGPORT}/${values.database}?sslmode=disable`
}

let stepNumber = 0
/** Runs a command; its output goes to a numbered log. Secrets are not in any command line or output. */
function run(label, command, args, { cwd = app, input } = {}) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28, input: input ?? '' })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  stepNumber += 1
  writeFileSync(path.join(logs, `${String(stepNumber).padStart(2, '0')}-${label}.log`), `$ ${command} ${args.join(' ')}\n${output}\nexit ${result.status}\n`)
  return { ok: result.status === 0, status: result.status, output }
}
const tail = (output) => output.split('\n').slice(-25).join('\n')
const must = (label, command, args, options) => {
  const result = run(label, command, args, options)
  if (!result.ok) throw new Error(`${label} failed (exit ${result.status}):\n${tail(result.output)}`)
  return result.output
}
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}
const read = (file) => readFileSync(path.join(app, file), 'utf8')
const write = (file, text) => {
  mkdirSync(path.dirname(path.join(app, file)), { recursive: true })
  writeFileSync(path.join(app, file), text)
}
const exists = (file) => existsSync(path.join(app, file))

const psql = (sql, { database = values.database } = {}) => {
  const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At', '-d', database, '-c', sql], { env, encoding: 'utf8' })
  if (result.status !== 0) throw new Error(`psql failed: ${(result.stderr ?? '').split('\n')[0]}`)
  return result.stdout.trim()
}
/**
 * The rows `db:migrate` recorded: every row of every table of `public` with "migration" in its name (core's, the entities'
 * and the plugins'), as `table|json` without the id and the timestamps, sorted.
 */
function migrationRows() {
  const tables = psql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%migration%' ORDER BY 1").split('\n').filter(Boolean)
  assert(tables.length > 0, 'the database has no table of migrations')
  const rows = []
  for (const table of tables) {
    for (const line of psql(`SELECT to_jsonb(t) FROM public."${table}" t`).split('\n').filter(Boolean)) {
      const row = JSON.parse(line)
      for (const key of Object.keys(row)) if (/^id$|(_at|At)$|^created|^executed|^applied/.test(key)) delete row[key]
      rows.push(`${table}|${JSON.stringify(Object.fromEntries(Object.entries(row).sort()))}`)
    }
  }
  return rows.sort()
}

/** Copies a directory, giving every file name and every text in it the new entity word. */
function copyEntity(from, to, rename) {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name)
    const target = path.join(to, rename(entry.name))
    if (entry.isDirectory()) {
      mkdirSync(target, { recursive: true })
      copyEntity(source, target, rename)
    } else {
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, rename(readFileSync(source, 'utf8')))
    }
  }
}

const CUSTOM = {
  support: 'Get help with the upgrade fixture custom support text.',
  hello: 'upgrade-fixture-hello',
  pong: 'upgrade-fixture',
}
const toWidgets = (text) => text.replace(/tasks/g, 'widgets').replace(/Tasks/g, 'Widgets').replace(/task/g, 'widget').replace(/Task/g, 'Widget')

let server = null
let serverLog = ''
async function startServer() {
  server = spawn('pnpm', ['start'], { cwd: app, env: { ...env, PORT: values.port }, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverLog += chunk })
  const url = `http://localhost:${values.port}/login`
  for (let attempt = 0; attempt < 90; attempt++) {
    if (await fetch(url, { signal: AbortSignal.timeout(5000) }).catch(() => null)) return
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('the server never answered /login')
}
function stopServer() {
  if (!server) return
  // the server and the shell pnpm started share the process group; stop it by its id
  try { process.kill(-server.pid, 'SIGTERM') } catch { /* already gone */ }
  server = null
}
async function get(urlPath) {
  const answer = await fetch(`http://localhost:${values.port}${urlPath}`, { redirect: 'manual', signal: AbortSignal.timeout(60000) })
  return { status: answer.status, body: await answer.text() }
}

const steps = [
  ['create the project with create-nextspark-app@' + FIXTURE_VERSION, async () => {
    must('corepack', 'corepack', ['enable', '--install-directory', pnpmBin, 'pnpm'], { cwd: work })
    const used = must('pnpm-version', 'pnpm', ['--version'], { cwd: work }).trim()
    assert(used === values.pnpm, `the project would use pnpm ${used}, not ${values.pnpm}`)
    must('create', 'pnpm', ['dlx', `create-nextspark-app@${FIXTURE_VERSION}`, 'app', '--preset', 'saas', '--theme', 'default', '--type', 'web', '--name', 'app', '--slug', 'app', '--description', 'Upgrade fixture', '--yes'], { cwd: work })
    assert(exists('contents/themes/app/config/theme.config.ts'), 'the project has no contents/themes/app: it is not the 0.x layout')
    assert(JSON.parse(read('package.json')).dependencies?.['@nextsparkjs/core'] === FIXTURE_VERSION || JSON.parse(read('package.json')).devDependencies?.['@nextsparkjs/core'] === FIXTURE_VERSION, `the project's core is not ${FIXTURE_VERSION}`)
  }],
  ['migrate its database with the .183 CLI', async (state) => {
    run('drop-database', 'dropdb', ['--if-exists', values.database])
    must('create-database', 'createdb', [values.database])
    const env183 = read('.env').replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl()}"`)
    write('.env', env183)
    must('db-migrate-183', 'pnpm', ['db:migrate'])
    state.before = migrationRows()
    assert(state.before.length > 0, 'the .183 db:migrate recorded no migration')
  }],
  ['customize it and commit', async () => {
    const theme = 'contents/themes/app'
    // 1. an edited theme template
    const support = `${theme}/templates/(public)/support/page.tsx`
    const original = read(support)
    assert(original.includes('Get help with the Starter theme.'), 'the support template of the .183 theme changed: update the fixture')
    write(support, original.replace('Get help with the Starter theme.', CUSTOM.support))
    // 2. a new entity with migrations, copied from tasks
    copyEntity(path.join(app, theme, 'entities/tasks'), path.join(app, theme, 'entities/widgets'), toWidgets)
    // 3. a theme API route
    write(`${theme}/api/ping/route.ts`, `import { NextResponse } from 'next/server'\nexport async function GET() { return NextResponse.json({ pong: '${CUSTOM.pong}' }) }\n`)
    // 4. a local plugin with a migration
    write('contents/plugins/fixtureplug/plugin.config.ts', `import { definePlugin } from '@nextsparkjs/core/types/plugin'
import type { PluginConfig } from '@nextsparkjs/core/types/plugin'
export const fixturePluginConfig: PluginConfig = definePlugin({
  name: 'fixtureplug',
  capabilities: ['server', 'web'],
  displayName: 'Fixture plugin',
  version: '1.0.0',
  enabled: true,
  dependencies: [],
})
export default fixturePluginConfig
`)
    write('contents/plugins/fixtureplug/package.json', JSON.stringify({ name: '@local/fixtureplug', version: '1.0.0', private: true, main: './plugin.config.ts' }))
    write('contents/plugins/fixtureplug/migrations/001_fixtureplug.sql', '-- Migration: 001_fixtureplug.sql\nCREATE TABLE IF NOT EXISTS public."fixtureplug_items" (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, label TEXT);\n')
    const themeConfig = read(`${theme}/config/theme.config.ts`)
    assert(themeConfig.includes("plugins: ['langchain']"), "the theme config's plugins list changed: update the fixture")
    write(`${theme}/config/theme.config.ts`, themeConfig.replace("plugins: ['langchain']", "plugins: ['langchain', 'fixtureplug']"))
    // 5. a page and a Route Handler of the project's own, in app/
    write('app/fixture-page/page.tsx', `export default function FixturePage() { return <main data-cy="fixture-page">${CUSTOM.hello}</main> }\n`)
    write('app/api/fixture-hook/route.ts', "export async function POST() { return Response.json({ ok: true }) }\n")
    // 6. a user edit of a generated route
    write('app/api/health/route.ts', `${read('app/api/health/route.ts')}\n// FIXTURE-CUSTOM: user edit of the generated health route\n`)
    // The guide's first step for a project of this age: node_modules/ and .next/ are not in its .gitignore
    write('.gitignore', `${read('.gitignore').replace(/\n*$/, '\n')}node_modules/\n.next/\n`)
    must('git-init', 'git', ['init', '-q'])
    must('git-add', 'git', ['add', '-A'])
    must('git-commit', 'git', ['-c', 'user.email=fixture@example.test', '-c', 'user.name=fixture', 'commit', '-q', '-m', 'fixture: a 0.1.0-beta.183 project'])
  }],
  ['bump the packages to this tree', async () => {
    const manifest = JSON.parse(read('package.json'))
    for (const [name, file] of Object.entries(tarballs)) {
      for (const field of ['dependencies', 'devDependencies']) if (manifest[field]?.[name]) manifest[field][name] = `file:${file}`
    }
    write('package.json', `${JSON.stringify(manifest, null, 2)}\n`)
    must('install-bumped', 'pnpm', ['install', '--no-frozen-lockfile'])
    must('git-commit-bump', 'git', ['add', '-A'])
    must('git-commit-bump-2', 'git', ['-c', 'user.email=fixture@example.test', '-c', 'user.name=fixture', 'commit', '-q', '-m', 'bump to this tree'])
  }],
  ['nextspark migrate --dry-run, then --yes', async (state) => {
    const dry = run('migrate-dry-run', 'pnpm', ['exec', 'nextspark', 'migrate', '--dry-run'])
    assert(dry.ok, `migrate --dry-run exited ${dry.status}:\n${tail(dry.output)}`)
    must('migrate-yes', 'pnpm', ['exec', 'nextspark', 'migrate', '--yes'])
    // what stays of contents/ is the install's node_modules directories, which git ignores
    const left = exists('contents') ? readdirSync(path.join(app, 'contents'), { recursive: true }).filter(file => !/(^|[\\/])node_modules([\\/]|$)/.test(file) && statSync(path.join(app, 'contents', file)).isFile()) : []
    assert(left.length === 0, `contents/ still holds files after migrate:\n${left.join('\n')}`)
    assert(exists('nextspark.config.ts') && exists('src/proxy.ts'), 'migrate wrote no nextspark.config.ts and src/proxy.ts')
    state.config = read('nextspark.config.ts')
    assert(/fixtureplug/.test(state.config) && /langchain/.test(state.config), `nextspark.config.ts does not list both plugins:\n${state.config}`)
    // migrate moved next and eslint-config-next to ~16.4.2, so the lockfile no longer matches (the guide's step 6)
    must('install-after-migrate', 'pnpm', ['install', '--no-frozen-lockfile'])
    must('prepare', 'pnpm', ['exec', 'nextspark', 'prepare'])
    must('prepare-check', 'pnpm', ['exec', 'nextspark', 'prepare', '--check'])
  }],
  ['pnpm db:migrate applies only what is new', async (state) => {
    must('db-migrate-current', 'pnpm', ['db:migrate'])
    const after = migrationRows()
    const lost = state.before.filter(row => !after.includes(row))
    assert(lost.length === 0, `rows of _migrations from before the upgrade are gone or changed:\n${lost.join('\n')}`)
    const added = after.filter(row => !state.before.includes(row))
    assert(added.some(row => /widgets/.test(row)) && added.some(row => /fixtureplug/.test(row)), `the entity and plugin migrations were not applied once:\n${added.join('\n')}`)
    assert(new Set(after).size === after.length, 'a migration is recorded twice')
    // a re-run does nothing
    must('db-migrate-again', 'pnpm', ['db:migrate'])
    assert(migrationRows().length === after.length, 'a second db:migrate recorded more rows')
  }],
  ['build', async () => {
    // The guide: a placeholder in .env is a value, not a missing one, so the build refuses it. The three lines go; the
    // auth secret, which that .env also leaves as a placeholder, is a random one made for this run.
    const secret = randomBytes(32).toString('base64')
    const lines = read('.env').split('\n').filter(line => !/^(RESEND_API_KEY|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=/.test(line))
    write('.env', lines.map(line => (/^BETTER_AUTH_SECRET=/.test(line) ? `BETTER_AUTH_SECRET="${secret}"` : line)).join('\n'))
    must('build', 'pnpm', ['build'])
  }],
  ['serve and request', async () => {
    try {
      await startServer()
      const expectations = [
        ['/login', 200, null],
        ['/support', 200, CUSTOM.support],
        ['/fixture-page', 200, CUSTOM.hello],
        ['/api/health', 200, null],
        ['/api/ping', 200, CUSTOM.pong],
        // the old URL of a theme route keeps working through the rewrite migrate added
        ['/api/v1/theme/app/ping', 200, CUSTOM.pong],
      ]
      for (const [urlPath, status, text] of expectations) {
        const answer = await get(urlPath)
        assert(answer.status === status, `GET ${urlPath} answered ${answer.status}, not ${status}`)
        if (text) assert(answer.body.includes(text), `GET ${urlPath} does not contain "${text}"`)
      }
      const hook = await fetch(`http://localhost:${values.port}/api/fixture-hook`, { method: 'POST', signal: AbortSignal.timeout(60000) })
      assert(hook.status === 200 && (await hook.json()).ok === true, `POST /api/fixture-hook answered ${hook.status}`)
      const dashboard = await get('/dashboard')
      assert(dashboard.status === 307, `a signed-out GET /dashboard answered ${dashboard.status}, not 307`)
    } finally {
      stopServer()
      writeFileSync(path.join(logs, 'server.log'), serverLog)
    }
  }],
  ['the files the user edited kept their edits', async () => {
    const holders = {
      'the edited template': [/^templates\/\(public\)\/support\/page\.tsx$/, CUSTOM.support],
      'the user edit of the health route': [/health\/route\.ts$/, 'FIXTURE-CUSTOM'],
      'the theme API route': [/^api\/ping\/route\.ts$/, CUSTOM.pong],
      'the user page': [/fixture-page\/page\.tsx$/, CUSTOM.hello],
    }
    const files = []
    const walk = (dir) => {
      for (const entry of readdirSync(path.join(app, dir), { withFileTypes: true })) {
        if (['node_modules', '.next', '.git', 'src', '.nextspark'].includes(entry.name)) continue
        const relative = path.posix.join(dir, entry.name)
        if (entry.isDirectory()) walk(relative)
        else files.push(relative)
      }
    }
    for (const entry of readdirSync(app, { withFileTypes: true })) {
      if (['node_modules', '.next', '.git', 'src', '.nextspark'].includes(entry.name)) continue
      if (entry.isDirectory()) walk(entry.name)
      else files.push(entry.name)
    }
    for (const [what, [pattern, text]] of Object.entries(holders)) {
      const found = files.find(file => pattern.test(file) && readFileSync(path.join(app, file), 'utf8').includes(text))
      assert(found, `${what} is not in the migrated project (looked for ${pattern} holding "${text}")`)
    }
    for (const directory of ['entities/widgets', 'plugins/fixtureplug']) assert(exists(directory) && statSync(path.join(app, directory)).isDirectory(), `${directory} is not in the migrated project`)
  }],
]

const state = {}
let failed = false
try {
  for (const [name, step] of steps) {
    const started = Date.now()
    try {
      await step(state)
      console.log(`PASS  ${name} (${Math.round((Date.now() - started) / 1000)}s)`)
    } catch (error) {
      failed = true
      console.log(`FAIL  ${name}\n${error.message}`)
      break
    }
  }
} finally {
  stopServer()
  run('drop-database-end', 'dropdb', ['--if-exists', values.database], { cwd: work })
  if (!values.keep && !failed) rmSync(work, { recursive: true, force: true })
}
console.log(failed ? 'upgrade from 0.1.0-beta.183: failed' : 'upgrade from 0.1.0-beta.183: all steps passed')
process.exit(failed ? 1 : 0)
