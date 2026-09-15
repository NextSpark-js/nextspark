import { execSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { DependencyOwner } from '../types/nextspark-package.js'

export type DependencyInstallStatus = 'none' | 'skipped' | 'installed' | 'missing'

export interface DependencyInstallResult {
  status: DependencyInstallStatus
  /** Declared dependencies missing from their package's own node_modules after the attempt. */
  missing: string[]
  /** The command that installs them, for the user to run when they are missing. */
  command: string
}

export interface DependencyInstallOptions {
  /** Set by --no-deps. */
  skipDeps?: boolean
  /** Where the command runs: the directory that holds contents/. Defaults to the cwd. */
  projectRoot?: string
  /** Runs the install command; tests replace it. */
  run?: (command: string, cwd: string) => void
  /** The directories pnpm counts as projects of the workspace at a root; tests replace it. */
  listWorkspaceProjects?: (workspaceRoot: string) => string[]
}

const INSTALL_COMMAND = 'pnpm install'
/** The install that runs. Adding a theme or plugin changes the lockfile on purpose, and pnpm freezes it by default in CI. */
const RUN_COMMAND = 'pnpm install --no-frozen-lockfile'
const LIST_PROJECTS_COMMAND = 'pnpm ls -r --depth -1 --json'

/**
 * Install the dependencies declared by themes and plugins copied into the project.
 *
 * contents/themes/* and contents/plugins/* are packages of the project's pnpm
 * workspace, so one install at the workspace root links each one's
 * dependencies into its own node_modules. Copying one in does not, and until
 * that install runs its imports fail to resolve. The workspace root is the
 * nearest pnpm-workspace.yaml going up (the project itself, or the repository
 * root when the project is the web/ app of a monorepo), climbing past one that
 * has no lockfile of its own when an enclosing workspace lists it among its
 * projects and that workspace's lockfile already imports it: a generated
 * monorepo writes a pnpm-workspace.yaml into web/ too, but its install and its
 * lockfile belong to the repository root. A repository whose broad glob merely
 * matches a project it never installed does not qualify.
 *
 * pnpm stops at that file whatever it lists, so the install runs only when pnpm
 * itself lists every such package among that workspace's projects. Its reading
 * of `packages:` is the one that counts: negations, hidden directories, a file
 * without the key, and whatever else its glob engine does. A package it leaves
 * out, as in a project sitting inside some other repository, gets nothing run:
 * an install there would not reach it, and would change a workspace that is
 * not the project's.
 *
 * A non-zero exit is not a failure by itself: pnpm 10.1+ exits 1 over build
 * scripts it did not approve even when everything installed. What decides is
 * whether each dependency is in its package's own node_modules afterwards. A
 * copy higher up can be another version, so it does not count, and neither does
 * one that was already there when the install failed: it can be a version the
 * package no longer accepts.
 */
export function installWorkspaceDependencies(
  owners: DependencyOwner[],
  options: DependencyInstallOptions = {}
): DependencyInstallResult {
  const projectRoot = options.projectRoot ?? process.cwd()
  const declared = owners.flatMap(owner =>
    Object.keys(owner.dependencies ?? {}).map(name => ({ name, dir: owner.dir }))
  )
  const isPresent = ({ name, dir }: { name: string; dir: string }): boolean =>
    existsSync(join(dir, 'node_modules', name, 'package.json'))
  const findMissing = (): string[] => [...new Set(declared.filter(dep => !isPresent(dep)).map(({ name }) => name))]

  if (declared.length === 0) {
    return { status: 'none', missing: [], command: INSTALL_COMMAND }
  }
  if (options.skipDeps) {
    return { status: 'skipped', missing: findMissing(), command: INSTALL_COMMAND }
  }

  let unconfirmed: string[] = []
  const list = options.listWorkspaceProjects ?? listPnpmWorkspaceProjects
  const listings = new Map<string, Set<string>>()
  const projectsOf = (root: string): Set<string> => {
    if (!listings.has(root)) listings.set(root, new Set(list(root).map(canonicalPath)))
    return listings.get(root)!
  }

  const workspaceRoot = findWorkspaceRoot(projectRoot, projectsOf)
  if (workspaceRoot) {
    const projects = projectsOf(workspaceRoot)
    if (declared.every(({ dir }) => projects.has(canonicalPath(dir)))) {
      const run = options.run ?? ((command: string, cwd: string) => {
        execSync(command, { cwd, stdio: 'inherit' })
      })
      const presentBefore = declared.filter(isPresent).map(({ name }) => name)
      try {
        run(RUN_COMMAND, workspaceRoot)
      } catch {
        // Judged below by what reached node_modules, not by the exit code.
        unconfirmed = presentBefore
      }
    }
  }

  const missing = [...new Set([...findMissing(), ...unconfirmed])]
  return { status: missing.length > 0 ? 'missing' : 'installed', missing, command: INSTALL_COMMAND }
}

/** What to tell the user about an install, or null when there is nothing to say. */
export function dependencyInstallNotice(result: DependencyInstallResult): string | null {
  if (result.status === 'skipped' && result.missing.length > 0) {
    return `Dependencies not installed (--no-deps): ${result.missing.join(', ')}. Run "${result.command}" before starting the app.`
  }
  if (result.status === 'missing') {
    return `Could not install: ${result.missing.join(', ')}. Run "${result.command}" at the root of the pnpm workspace.`
  }
  return null
}

/**
 * The workspace an install for `start` belongs to: the nearest directory going
 * up with a pnpm-workspace.yaml, or, while that one has no pnpm-lock.yaml of its
 * own, the enclosing workspace that both lists it as a project and has it as an
 * importer in its lockfile.
 */
function findWorkspaceRoot(start: string, projectsOf: (root: string) => Set<string>): string | null {
  let root = nearestWorkspace(resolve(start))
  while (root && dirname(root) !== root && !existsSync(join(root, 'pnpm-lock.yaml'))) {
    const enclosing = nearestWorkspace(dirname(root))
    if (!enclosing || !projectsOf(enclosing).has(canonicalPath(root)) || !lockfileImports(enclosing, root)) break
    root = enclosing
  }
  return root
}

/** The nearest directory, from `start` upwards, that holds a pnpm-workspace.yaml. */
function nearestWorkspace(start: string): string | null {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** The project directories `pnpm ls -r` reports for the workspace at `root`; none when it cannot tell. */
function listPnpmWorkspaceProjects(root: string): string[] {
  try {
    const output = execSync(LIST_PROJECTS_COMMAND, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    })
    return parseProjectListing(output)
  } catch {
    return []
  }
}

/**
 * The project paths in `pnpm ls --json` output. Whatever a .pnpmfile.cjs prints
 * lands on the same stdout ahead of the listing, with or without a line break,
 * and it can be JSON itself, so the listing is taken to be the last non-empty
 * array whose entries all carry a path, rather than the whole output or the
 * first array in it.
 */
function parseProjectListing(output: string): string[] {
  const openings = [...output.matchAll(/\[(?=\s*[{\]])/g)].map(match => match.index ?? 0).reverse()
  const closings = [...output.matchAll(/\](?=[ \t]*(?:\r?\n|$))/g)].map(match => match.index ?? 0).reverse()
  for (const start of openings) {
    for (const end of closings) {
      if (end < start) break
      const paths = projectPaths(output.slice(start, end + 1))
      if (paths) return paths
    }
  }
  return []
}

/** The paths of a project listing, or null when the text is not one. */
function projectPaths(text: string): string[] | null {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!Array.isArray(value) || value.length === 0) return null
  const paths = value.map(project => (project as { path?: unknown } | null)?.path)
  return paths.every((path): path is string => typeof path === 'string') ? paths : null
}

/**
 * Whether the lockfile at `workspace` lists `dir` among its importers, pnpm having
 * installed it from there. An importer with no dependencies is written `dir: {}`.
 */
function lockfileImports(workspace: string, dir: string): boolean {
  let lockfile: string
  try {
    lockfile = readFileSync(join(workspace, 'pnpm-lock.yaml'), 'utf8')
  } catch {
    return false
  }
  const start = lockfile.search(/^importers:[ \t]*$/m)
  if (start === -1) return false
  const importers = lockfile.slice(start).split(/\n(?=\S)/)[0]
  const importer = relative(canonicalPath(workspace), canonicalPath(dir)).split(sep).join('/')
  const escaped = importer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^  ['"]?${escaped}['"]?:(?:[ \t]*\\{\\})?[ \t]*$`, 'm').test(importers)
}

/** A directory as pnpm reports it: absolute, with symlinks resolved (on macOS /var is /private/var). */
function canonicalPath(dir: string): string {
  try {
    return realpathSync(dir)
  } catch {
    return resolve(dir)
  }
}
