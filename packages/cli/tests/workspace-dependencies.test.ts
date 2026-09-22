import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { installWorkspaceDependencies, dependencyInstallNotice } from '../src/lib/workspace-dependencies.js'

const GENERATED_WORKSPACE = "packages:\n  - 'contents/themes/*'\n  - 'contents/plugins/*'\n"

const pnpmAvailable = spawnSync('pnpm', ['--version'], { stdio: 'ignore' }).status === 0

/** A package directory with the manifest pnpm looks for. */
async function pkg(dir: string, name: string): Promise<void> {
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name, version: '1.0.0' }))
}

/** A generated project with a theme and a plugin copied in; null leaves out the workspace file. */
async function project(workspace: string | null = GENERATED_WORKSPACE) {
  const root = await mkdtemp(join(tmpdir(), 'ns-deps-'))
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'app', private: true }))
  if (workspace !== null) {
    await writeFile(join(root, 'pnpm-workspace.yaml'), workspace)
  }
  const theme = join(root, 'contents', 'themes', 'blog')
  const plugin = join(root, 'contents', 'plugins', 'ai')
  await pkg(theme, 'theme-blog')
  await pkg(plugin, 'plugin-ai')
  return { root, theme, plugin, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/** What a package manager leaves behind for one installed dependency. */
function land(base: string, name: string): void {
  mkdirSync(join(base, 'node_modules', name), { recursive: true })
  writeFileSync(join(base, 'node_modules', name, 'package.json'), JSON.stringify({ name }))
}

/** A workspace listing with exactly these projects, in place of asking pnpm. */
const listing = (...dirs: string[]) => () => dirs

test('does nothing for a package that declares no dependencies', async () => {
  const p = await project()
  const calls: string[] = []
  const result = installWorkspaceDependencies([{ name: 'blog', dir: p.theme }], { projectRoot: p.root, run: c => calls.push(c) })
  assert.equal(result.status, 'none')
  assert.equal(calls.length, 0)
  await p.cleanup()
})

test('installs at the project root and succeeds once the dependency lands', async () => {
  const p = await project()
  const calls: Array<[string, string]> = []
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.root, p.theme), run: (c, cwd) => { calls.push([c, cwd]); land(p.theme, 'dompurify') } }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', p.root]])
  assert.equal(result.status, 'installed')
  assert.equal(dependencyInstallNotice(result), null)
  await p.cleanup()
})

test('a non-zero exit is still success when the dependency landed', async () => {
  const p = await project()
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: () => { land(p.theme, 'dompurify'); throw new Error('ERR_PNPM_IGNORED_BUILDS') } }
  )
  assert.equal(result.status, 'installed')
  await p.cleanup()
})

test('reports what is missing, and the command, when the install did not land it', async () => {
  const p = await project()
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: () => { throw new Error('ERR_PNPM_FETCH_404') } }
  )
  assert.equal(result.status, 'missing')
  assert.deepEqual(result.missing, ['dompurify'])
  assert.match(dependencyInstallNotice(result) ?? '', /dompurify.*pnpm install/)
  await p.cleanup()
})

test('--no-deps skips the install and says what to run', async () => {
  const p = await project()
  const calls: string[] = []
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, skipDeps: true, listWorkspaceProjects: listing(p.theme), run: c => calls.push(c) }
  )
  assert.equal(calls.length, 0)
  assert.equal(result.status, 'skipped')
  assert.match(dependencyInstallNotice(result) ?? '', /--no-deps.*dompurify/)
  await p.cleanup()
})

test("a copy at the project root does not stand in for the package's own", async () => {
  const p = await project()
  land(p.root, 'dompurify')
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: () => { throw new Error('simulated install failure') } }
  )
  assert.equal(result.status, 'missing')
  assert.deepEqual(result.missing, ['dompurify'])
  await p.cleanup()
})

test('installs from the repository root when the project is the web/ app of a monorepo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ns-deps-mono-'))
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'web'\n  - 'web/contents/themes/*'\n")
  const web = join(root, 'web')
  const theme = join(web, 'contents', 'themes', 'blog')
  await pkg(theme, 'theme-blog')
  const calls: Array<[string, string]> = []
  const asked: string[] = []
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: theme, dependencies: { dompurify: '^3.2.7' } }],
    {
      projectRoot: web,
      listWorkspaceProjects: workspaceRoot => { asked.push(workspaceRoot); return [root, web, theme] },
      run: (c, cwd) => { calls.push([c, cwd]); land(theme, 'dompurify') },
    }
  )
  assert.deepEqual(asked, [root])
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', root]])
  assert.equal(result.status, 'installed')
  await rm(root, { recursive: true, force: true })
})

test('runs a single install for a theme and the plugins added with it', async () => {
  const p = await project()
  const calls: string[] = []
  const result = installWorkspaceDependencies(
    [
      { name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } },
      { name: 'ai', dir: p.plugin, dependencies: { zod: '^4.0.0' } },
    ],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme, p.plugin), run: c => { calls.push(c); land(p.theme, 'dompurify'); land(p.plugin, 'zod') } }
  )
  assert.equal(calls.length, 1)
  assert.equal(result.status, 'installed')
  await p.cleanup()
})

test('does not run an install outside a pnpm workspace', async () => {
  const p = await project(null)
  const calls: string[] = []
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: c => calls.push(c) }
  )
  assert.equal(calls.length, 0)
  assert.equal(result.status, 'missing')
  await p.cleanup()
})

test('does not install when pnpm leaves a package out of the enclosing workspace', async () => {
  const outer = await mkdtemp(join(tmpdir(), 'ns-deps-foreign-'))
  await writeFile(join(outer, 'pnpm-workspace.yaml'), "packages:\n  - 'actual-member'\n")
  const app = join(outer, 'unrelated', 'my-nextspark-app')
  const theme = join(app, 'contents', 'themes', 'blog')
  await pkg(theme, 'theme-blog')
  const calls: string[] = []
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: app, listWorkspaceProjects: listing(outer, join(outer, 'actual-member')), run: c => calls.push(c) }
  )
  assert.equal(calls.length, 0)
  assert.equal(result.status, 'missing')
  await rm(outer, { recursive: true, force: true })
})

/**
 * Whether the pnpm that runs in this directory accepts its workspace file.
 * Extglob patterns are version-dependent: pnpm 9 takes them in, while later
 * majors reject the whole file with ERR_PNPM_WORKSPACE_INVALID_GLOB. The temp
 * projects sit outside this repository, so they run the global pnpm, not the
 * version pinned by packageManager.
 */
function pnpmAcceptsWorkspace(root: string): boolean {
  return spawnSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { cwd: root, stdio: 'ignore' }).status === 0
}

test('pnpm decides which packages a workspace takes in', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  // 'accepted': installs exactly when this pnpm accepts the workspace file.
  const cases: Array<[string, boolean | 'accepted']> = [
    [GENERATED_WORKSPACE, true],
    ["packages:\n  - 'contents/themes/*' # themes\n  - 'contents/plugins/*'\n", true],
    ["packages: ['contents/@(themes|plugins)/*']\n", 'accepted'],
    ["packages:\n  - 'contents/themes/*'\n  - '!contents/themes/blog'\n", false],
    ["packages:\n  - 'contents/plugins/*'\n", false],
  ]
  for (const [workspace, expected] of cases) {
    const p = await project(workspace)
    const installs = expected === 'accepted' ? pnpmAcceptsWorkspace(p.root) : expected
    const calls: string[] = []
    installWorkspaceDependencies(
      [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
      { projectRoot: p.root, run: c => calls.push(c) }
    )
    assert.equal(calls.length > 0, installs, workspace)
    await p.cleanup()
  }
})

test('a project inside another repository does not install into its workspace', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  const cases: Array<[string, string[]]> = [
    ["packages:\n  - 'actual-member'\n", ['unrelated', 'my-nextspark-app']],
    ["packages:\n  - '**'\n", ['.worktrees', 'my-nextspark-app']],
  ]
  for (const [workspace, appPath] of cases) {
    const outer = await mkdtemp(join(tmpdir(), 'ns-deps-outer-'))
    await writeFile(join(outer, 'package.json'), JSON.stringify({ name: 'outer', private: true }))
    await writeFile(join(outer, 'pnpm-workspace.yaml'), workspace)
    await pkg(join(outer, 'actual-member'), 'actual-member')
    const app = join(outer, ...appPath)
    await pkg(app, 'my-nextspark-app')
    const theme = join(app, 'contents', 'themes', 'blog')
    await pkg(theme, 'theme-blog')
    const calls: string[] = []
    const result = installWorkspaceDependencies(
      [{ name: 'blog', dir: theme, dependencies: { dompurify: '^3.2.7' } }],
      { projectRoot: app, run: c => calls.push(c) }
    )
    assert.equal(calls.length, 0, `${workspace} ${appPath.join('/')}`)
    assert.equal(result.status, 'missing')
    await rm(outer, { recursive: true, force: true })
  }
})

test('what a .pnpmfile.cjs prints ahead of the listing does not hide it', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  const p = await project()
  await writeFile(join(p.root, '.pnpmfile.cjs'), "console.log('[pnpmfile] notice')\nconsole.log('[]')\nconsole.log(JSON.stringify([{ path: '/decoy' }]))\nmodule.exports = { hooks: {} }\n")
  const calls: string[] = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, run: c => calls.push(c) }
  )
  assert.equal(calls.length, 1)
  await p.cleanup()
})

/** The layout a generated monorepo has: a workspace at the root and another one inside web/. */
async function monorepo() {
  const root = await mkdtemp(join(tmpdir(), 'ns-deps-nested-'))
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'mono', private: true }))
  await writeFile(join(root, 'pnpm-workspace.yaml'), "packages:\n  - 'web'\n  - 'web/contents/themes/*'\n  - 'web/contents/plugins/*'\n")
  const web = join(root, 'web')
  await pkg(web, 'web')
  await writeFile(join(web, 'pnpm-workspace.yaml'), GENERATED_WORKSPACE)
  const theme = join(web, 'contents', 'themes', 'blog')
  await pkg(theme, 'theme-blog')
  return { root, web, theme, cleanup: () => rm(root, { recursive: true, force: true }) }
}

test('installs at the monorepo root when web/ has a workspace file but no lockfile of its own', async () => {
  const m = await monorepo()
  await writeFile(join(m.root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies: {}\n\n  web:\n    dependencies: {}\n\npackages: {}\n")
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: m.theme, dependencies: { dompurify: '^3.2.7' } }],
    {
      projectRoot: m.web,
      listWorkspaceProjects: root => (root === m.root ? [m.root, m.web, m.theme] : [m.web, m.theme]),
      run: (c, cwd) => calls.push([c, cwd]),
    }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', m.root]])
  await m.cleanup()
})

test('stays in a nested workspace that has its own lockfile', async () => {
  const m = await monorepo()
  await writeFile(join(m.web, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n")
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: m.theme, dependencies: { dompurify: '^3.2.7' } }],
    {
      projectRoot: m.web,
      listWorkspaceProjects: root => (root === m.root ? [m.root, m.web, m.theme] : [m.web, m.theme]),
      run: (c, cwd) => calls.push([c, cwd]),
    }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', m.web]])
  await m.cleanup()
})

test('does not climb into an enclosing workspace that does not list the nested one', async () => {
  const m = await monorepo()
  await writeFile(join(m.root, 'pnpm-workspace.yaml'), "packages:\n  - 'actual-member'\n")
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: m.theme, dependencies: { dompurify: '^3.2.7' } }],
    {
      projectRoot: m.web,
      listWorkspaceProjects: root => (root === m.root ? [m.root] : [m.web, m.theme]),
      run: (c, cwd) => calls.push([c, cwd]),
    }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', m.web]])
  await m.cleanup()
})

test('pnpm itself places a generated monorepo install at the root', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  const m = await monorepo()
  await writeFile(join(m.root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies: {}\n\n  web:\n    dependencies: {}\n\npackages: {}\n")
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: m.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: m.web, run: (c, cwd) => calls.push([c, cwd]) }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', m.root]])
  await m.cleanup()
})

test('does not climb into a repository whose broad glob matches a project it never installed', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  const outer = await mkdtemp(join(tmpdir(), 'ns-deps-wide-'))
  await writeFile(join(outer, 'package.json'), JSON.stringify({ name: 'outer', private: true }))
  await writeFile(join(outer, 'pnpm-workspace.yaml'), "packages:\n  - '**'\n")
  await writeFile(join(outer, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n\nimporters:\n\n  .:\n    devDependencies: {}\n\npackages: {}\n")
  const app = join(outer, 'unrelated', 'web')
  await pkg(app, 'web')
  await writeFile(join(app, 'pnpm-workspace.yaml'), GENERATED_WORKSPACE)
  const theme = join(app, 'contents', 'themes', 'blog')
  await pkg(theme, 'theme-blog')
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: app, run: (c, cwd) => calls.push([c, cwd]) }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', app]])
  await rm(outer, { recursive: true, force: true })
})

test('climbs when the enclosing lockfile writes the nested importer as {}', async () => {
  const m = await monorepo()
  await writeFile(join(m.root, 'pnpm-lock.yaml'), "lockfileVersion: '9.0'\n\nimporters:\n\n  .: {}\n\n  web: {}\n\npackages: {}\n")
  const calls: Array<[string, string]> = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: m.theme, dependencies: { dompurify: '^3.2.7' } }],
    {
      projectRoot: m.web,
      listWorkspaceProjects: root => (root === m.root ? [m.root, m.web, m.theme] : [m.web, m.theme]),
      run: (c, cwd) => calls.push([c, cwd]),
    }
  )
  assert.deepEqual(calls, [['pnpm install --no-frozen-lockfile', m.root]])
  await m.cleanup()
})

test('what a .pnpmfile.cjs writes without a line break does not hide the listing', { skip: !pnpmAvailable && 'pnpm is not installed' }, async () => {
  const p = await project()
  await writeFile(join(p.root, '.pnpmfile.cjs'), "process.stdout.write('notice: ')\nmodule.exports = { hooks: {} }\n")
  const calls: string[] = []
  installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, run: c => calls.push(c) }
  )
  assert.equal(calls.length, 1)
  await p.cleanup()
})

test('a dependency already there does not count as installed when the install fails', async () => {
  const p = await project()
  land(p.theme, 'dompurify')
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: () => { throw new Error('ERR_PNPM_FETCH_404') } }
  )
  assert.equal(result.status, 'missing')
  assert.deepEqual(result.missing, ['dompurify'])
  assert.match(dependencyInstallNotice(result) ?? '', /dompurify.*pnpm install/)
  await p.cleanup()
})

test('a dependency already there counts once the install succeeds', async () => {
  const p = await project()
  land(p.theme, 'dompurify')
  const result = installWorkspaceDependencies(
    [{ name: 'blog', dir: p.theme, dependencies: { dompurify: '^3.2.7' } }],
    { projectRoot: p.root, listWorkspaceProjects: listing(p.theme), run: () => {} }
  )
  assert.equal(result.status, 'installed')
  await p.cleanup()
})

