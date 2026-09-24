import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  asBytes,
  everyDirectoryIgnored,
  ignoredByRules,
  parseIgnoreFile,
  type IgnoreSources,
} from '../src/utils/gitignore-rules.js'

/** Patterns aimed at the places sync:app writes, and at how git reads a glob. */
const PATTERNS = [
  'src/app/(templates)/', 'src/app/(templates)', '/src/app/(templates)/', 'src/app/(templates)/**', 'src/app/(templates)/*', 'src/app/**', 'src/app/*',
  '**/(templates)', '**/(templates)/', '(templates)/', '(templates)', '(TEMPLATES)/', 'App/(Templates)/',
  'src/app/(templates)/middleware.ts', 'src/app/(templates)/dashboard/layout.tsx', '*.tsx', '**/*.tsx', 'src/app/**/layout.tsx', 'src/app/**/',
  '[a]pp/', '[!b]pp/(templates)/', '[^b]pp/', '[[:alpha:]]pp/', '[[:upper:]]pp/', '[[:lower:]]pp/', '[A-Z]pp/', 'ap?/', 'app\\/(templates)', '\\src/app/',
  'src/app/(temp*)/', 'src/app/(templates', 'src/app/[(]templates[)]/', 'src/app/[[:foo:]]/', 'src/app/[]', 'src/app/[]]', 'src/app/**(templates)/',
  'app**/(templates)/', 'src/app/***/', 'a**/', '**', '*', '*/', '/*', '/*/', '**/', 'src/app/\\(templates)/', 'src/app/(templates)\\',
  '.nextspark/', '.nextspark', '.nextspark/backups/', '.nextspark/*', '.nextspark/sync-state.json', '/.nextspark/sync-state.json/',
  'sync-state.json', '*.json', '.nextspark/**/', '.next*/', '.nextspark/backups', 'backups/', '/backups/',
  'app.backup.v*/', 'app.backup.*', 'app.backup.v[0-9]*/', '*-XXXXXX/', '*-a1b2c3/', 'app.backup.v?/', 'APP.BACKUP.V*/',
  '\\#src/app/', 'src/app/ ', 'src/app/\\ ', ' src/app/', 'src/app/\t', '[[:space:]]src/app/', 'app[[:punct:]]backup.v1/', 'app.backup.v[!0-9]/',
  'app.backup.v??/', '!app.backup.v?', 'app.backup.v\u00e9/', '[[:alpha:]]pp.backup.v1', 'app.backup.v1\\', 'app.backup.v**/',
]

/** Probes from a case directory: [path, is a directory]. */
const PROBES: [string, boolean][] = [
  ['app', true], ['src/app/(templates)', true], ['src/app/(templates)/dashboard', true], ['src/app/(templates)/middleware.ts', false],
  ['src/app/(templates)/dashboard/layout.tsx', false], ['src/app/layout.tsx', false], ['.nextspark', true], ['.nextspark/backups', true],
  ['.nextspark/sync-state.json', false], ['app.backup.v1', true], ['app.backup.vX', true], ['app.backup.v0.1.0-beta.190.2026-09-16T18-27-46-049Z-xUXIjT', true],
  ['app.backup.v[', true], ['app.backup.v\u00e9', true], [' app', true], ['app\t', true],
]

type Case = { root: string[]; app?: string[]; nextspark?: string[] }

function cases(): Case[] {
  const all: Case[] = []
  for (const pattern of PATTERNS) {
    all.push({ root: [pattern] })
    all.push({ root: ['*', `!${pattern}`] })
    all.push({ root: [pattern, '!src/app/(templates)/', '!.nextspark/'] })
    all.push({ root: ['src/app/', '.nextspark/', `!${pattern}`] })
    all.push({ root: ['src/app/(templates)/'], app: [`!${pattern}`] })
    all.push({ root: ['src/app/(templates)/', '.nextspark/sync-state.json'], app: [pattern], nextspark: [`!${pattern}`] })
  }
  return all
}

/** Every case in a directory of its own in one repository, and git's answer for each probe in each. */
async function askGit(ignoreCase: boolean): Promise<{ top: string; caseList: Case[]; answers: Map<string, boolean> }> {
  const top = await mkdtemp(join(tmpdir(), 'nextspark-gitignore-rules-'))
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', XDG_CONFIG_HOME: top }
  spawnSync('git', ['init', '-q'], { cwd: top, env })
  spawnSync('git', ['config', 'core.ignorecase', String(ignoreCase)], { cwd: top, env })
  const caseList = cases()
  const asked: string[] = []
  for (const [index, { root, app, nextspark }] of caseList.entries()) {
    const dir = `case-${index}`
    for (const [path, isDirectory] of PROBES) {
      const absolute = join(top, dir, path)
      if (isDirectory) await mkdir(absolute, { recursive: true })
      else {
        await mkdir(join(absolute, '..'), { recursive: true })
        await writeFile(absolute, '')
      }
      asked.push(`${dir}/${path}`)
    }
    await writeFile(join(top, dir, '.gitignore'), `${root.join('\n')}\n`)
    if (app) await writeFile(join(top, dir, 'src/app/.gitignore'), `${app.join('\n')}\n`)
    if (nextspark) await writeFile(join(top, dir, '.nextspark/.gitignore'), `${nextspark.join('\n')}\n`)
  }

  const run = spawnSync('git', ['check-ignore', '--no-index', '--stdin', '-z', '--verbose', '--non-matching'], {
    cwd: top, env, input: asked.map((path) => `${path}\0`).join(''), encoding: 'utf-8', maxBuffer: Infinity,
  })
  const fields = run.stdout.split('\0')
  assert.equal(fields.length, asked.length * 4 + 1, run.stderr)
  const answers = new Map<string, boolean>()
  asked.forEach((path, index) => {
    const pattern = fields[index * 4 + 2]
    answers.set(path, pattern !== '' && !pattern.startsWith('!'))
  })
  return { top, caseList, answers }
}

function sourcesOf(index: number, { root, app, nextspark }: Case, ignoreCase: boolean): IgnoreSources {
  const byDirectory = new Map()
  const dir = `case-${index}/`
  byDirectory.set(dir, parseIgnoreFile(asBytes(`${root.join('\n')}\n`), dir, '.gitignore'))
  if (app) byDirectory.set(`${dir}src/app/`, parseIgnoreFile(asBytes(`${app.join('\n')}\n`), `${dir}src/app/`, 'src/app/.gitignore'))
  if (nextspark) byDirectory.set(`${dir}.nextspark/`, parseIgnoreFile(asBytes(`${nextspark.join('\n')}\n`), `${dir}.nextspark/`, '.nextspark/.gitignore'))
  return { byDirectory, excludeFiles: [], ignoreCase }
}

for (const ignoreCase of [false, true]) {
  test(`what git ignores is read as git reads it, directory by directory, and a directory named as it is created counts as ignored only when every such name is, with core.ignorecase ${ignoreCase}`, async () => {
    const { top, caseList, answers } = await askGit(ignoreCase)
    try {
      const universal = new Set(['app.backup.v*', 'app.backup.*'])
      const differ: string[] = []
      caseList.forEach((rules, index) => {
        const sources = sourcesOf(index, rules, ignoreCase)
        for (const [path, isDirectory] of PROBES) {
          const git = answers.get(`case-${index}/${path}`)
          const read = ignoredByRules(sources, asBytes(`case-${index}/${path}`), isDirectory).ignored
          if (git !== read) differ.push(`${JSON.stringify(rules)} ${JSON.stringify(path)}: git ${git}, read ${read}`)
        }

        const { ignored } = everyDirectoryIgnored(sources, asBytes(`case-${index}/app.backup.v`),
          (pattern) => !pattern.negative && universal.has(pattern.body) && (pattern.basenameOnly || pattern.base === `case-${index}/`))
        const leftIn = PROBES.filter(([path]) => path.startsWith('app.backup.v') && !answers.get(`case-${index}/${path}`)).map(([path]) => path)
        if (ignored && leftIn.length > 0) differ.push(`${JSON.stringify(rules)}: every app.backup.v* read as ignored, git leaves in ${leftIn.join(', ')}`)
      })
      assert.deepEqual(differ, [])
    } finally {
      await rm(top, { recursive: true, force: true })
    }
  })
}
