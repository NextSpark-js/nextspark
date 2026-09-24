import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'
import { writeAiOnboarding } from '../src/wizard/generators/ai-onboarding.js'
import { runWizard } from '../src/wizard/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

const cli = buildCli()
const catalog = ['nextspark-auth', 'nextspark-blocks', 'nextspark-cli']
const packageVersion = JSON.parse(readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'package.json'), 'utf8')).version

function run(args: string[], cwd: string) {
  return execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' })
}

test('built CLI exposes a deterministic, versioned skills catalog away from the repository', () => {
  const project = mkdtempSync(join(tmpdir(), 'nextspark-skills-project-'))
  try {
    const first = JSON.parse(run(['skills', 'list', '--json'], project))
    const second = JSON.parse(run(['skills', 'list', '--json'], project))
    assert.deepEqual(first, second)
    assert.equal(first.version, packageVersion)
    assert.deepEqual(first.skills.map((skill: { name: string }) => skill.name), catalog)
    for (const skill of first.skills) {
      assert.equal(typeof skill.description, 'string')
      assert.ok(skill.description.length > 0)
    }

    const guide = run(['skills', 'get', 'nextspark-blocks'], project)
    assert.match(guide, /NextSpark blocks/)
    assert.match(guide, /blocks\/\{slug\}\//)
    assert.match(guide, /config\.ts`.*, `schema\.ts`.*, `fields\.ts`.*, `component\.tsx`.*, and `index\.ts/)
    assert.match(guide, /baseBlockSchema/)
    const guideJson = JSON.parse(run(['skills', 'get', 'nextspark-blocks', '--json'], project))
    assert.equal(guideJson.version, first.version)
    assert.equal(guideJson.name, 'nextspark-blocks')
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

test('built guides name current NextSpark APIs and CLI commands', () => {
  const project = mkdtempSync(join(tmpdir(), 'nextspark-guides-'))
  try {
    const auth = run(['skills', 'get', 'nextspark-auth'], project)
    assert.match(auth, /authenticateRequest\(request, \{ requiredScope/)
    assert.match(auth, /createAuthFailureResponse/)
    assert.match(auth, /config\/permissions\.config\.ts/)

    const cliGuide = run(['skills', 'get', 'nextspark-cli'], project)
    assert.match(cliGuide, /pnpm nextspark generate/)
    assert.match(cliGuide, /pnpm nextspark registry:build/)
    assert.match(cliGuide, /pnpm nextspark dev:registry/)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

test('built CLI rejects unknown and path-like skill names without reading project files', () => {
  const project = mkdtempSync(join(tmpdir(), 'nextspark-skills-safe-'))
  try {
    writeFileSync(join(project, 'outside.md'), 'not a guide')
    for (const name of ['missing', '../outside.md', 'nextspark-blocks/../outside.md']) {
      const result = spawnSync(process.execPath, [cli, 'skills', 'get', name], { cwd: project, encoding: 'utf8' })
      assert.notEqual(result.status, 0, name)
      assert.match(`${result.stdout}\n${result.stderr}`, /Unknown NextSpark skill/)
    }
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

async function runSyntheticWizard(projectRoot: string, projectType: WizardConfig['projectType']): Promise<void> {
  const originalCwd = process.cwd()
  mkdirSync(join(projectRoot, 'node_modules', '@nextsparkjs', 'core'), { recursive: true })
  if (projectType === 'web-mobile') {
    mkdirSync(join(projectRoot, 'node_modules', '@nextsparkjs', 'mobile'), { recursive: true })
  }

  process.chdir(projectRoot)
  try {
    await runWizard({
      mode: 'interactive',
      yes: true,
      name: 'Wizard test',
      slug: 'wizard-test',
      description: 'Synthetic wizard integration test',
      type: projectType,
      theme: 'none',
      plugins: [],
    }, {
      async generateProject(config: WizardConfig) {
        assert.equal(config.projectType, projectType)
        if (config.projectType === 'web-mobile') mkdirSync(join(projectRoot, 'web'), { recursive: true })
      },
      installProjectDependencies() {},
      buildRegistries() {},
    })
  } finally {
    process.chdir(originalCwd)
  }
}

test('runWizard --yes writes onboarding to web targets, preserves both files, and skips the legacy pack', async () => {
  const project = mkdtempSync(join(tmpdir(), 'nextspark-wizard-onboarding-'))
  try {
    const web = join(project, 'web-project')
    mkdirSync(web)
    await runSyntheticWizard(web, 'web')
    for (const file of ['AGENTS.md', 'CLAUDE.md']) assert.ok(existsSync(join(web, file)), file)
    assert.equal(existsSync(join(web, '.claude')), false)

    const monorepo = join(project, 'web-mobile-project')
    mkdirSync(join(monorepo, 'web'), { recursive: true })
    const preserved = new Map([
      ['AGENTS.md', 'project-owned agent rules'],
      ['CLAUDE.md', 'project-owned Claude rules'],
    ])
    for (const [file, contents] of preserved) writeFileSync(join(monorepo, 'web', file), contents)

    await runSyntheticWizard(monorepo, 'web-mobile')

    for (const [file, contents] of preserved) {
      assert.equal(readFileSync(join(monorepo, 'web', file), 'utf8'), contents, file)
      assert.equal(existsSync(join(monorepo, file)), false, `root ${file}`)
    }
    assert.equal([
      join(monorepo, '.claude'),
      join(monorepo, 'web', '.claude'),
    ].some(existsSync), false)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})

test('onboarding remains small, does not overwrite user rules, and does not install an AI pack', () => {
  const project = mkdtempSync(join(tmpdir(), 'nextspark-onboarding-'))
  try {
    const first = writeAiOnboarding(project)
    assert.deepEqual(first, { agents: 'created', claude: 'created' })
    const agents = join(project, 'AGENTS.md')
    const claude = join(project, 'CLAUDE.md')
    assert.ok(existsSync(agents))
    assert.ok(existsSync(claude))
    assert.ok(Buffer.byteLength(readFileSync(agents)) + Buffer.byteLength(readFileSync(claude)) <= 4096)
    assert.match(readFileSync(agents, 'utf8'), /pnpm nextspark skills get nextspark-blocks/)
    assert.match(readFileSync(agents, 'utf8'), /generated|Generated/i)
    assert.equal(existsSync(join(project, '.claude')), false)

    writeFileSync(agents, 'user rules')
    const second = writeAiOnboarding(project)
    assert.equal(second.agents, 'preserved')
    assert.equal(readFileSync(agents, 'utf8'), 'user rules')
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})
