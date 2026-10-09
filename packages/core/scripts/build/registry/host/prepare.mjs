/**
 * `nextspark prepare` for the generated host (#203): plan, render, stage, validate, publish.
 *
 * `prepareHost(config)` is the whole pipeline for any host - a real project (`projectHostConfig`)
 * or the conformance fixture - described by a host config:
 *
 * ```js
 * {
 *   hostRoot,          // where src/app, .nextspark/registries and .nextspark/generation.json live
 *   projectRoot,       // where TypeScript and Next.js resolve from
 *   loadCoreRoutes,    // async () => loadCoreRouteManifest(...) (null: the core ships none)
 *   plugins,           // [{ name, root, importBase }]
 *   project,           // { root, importBase, label }
 *   entities,          // async ({ manifest }) => ({ routes, diagnostics }) - per-entity routes (entity-routes.mjs)
 *   webhooks,          // () => ({ routes, diagnostics }) - composed billing webhook routes (webhooks.mjs)
 *   stylesheet,        // the project's global stylesheet specifier the root layout imports
 *   modes, pageExtensions, cacheComponents,   // see render.mjs
 *   registries,        // async ({ mode }) => [{ path, content, grammar }] - staged registry files
 *   contracts,         // { target(), plan() } - the portable contracts module (contracts/index.mjs), optional
 *   inputs,            // () => hashInputs(...)
 *   versions,          // { core, cli, next }
 * }
 * ```
 *
 * Nothing is written before every facade is emitted, the registries are staged and every file
 * passes validation; publication then follows generation.mjs. `checkHost` runs the same planning
 * and rendering in memory and compares.
 *
 * @module core/scripts/build/registry/host/prepare
 */

import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, watch as watchFs } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { projectFiles } from '../../safe-fs.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { getConfig } from '../config.mjs'
import { resolveNextPackage } from './facade-emitter.mjs'
import { coreRouteManifestPath, coreRouteVariantsPath, hasCoreRouteManifest, loadCoreRouteManifest, resolveCoreRouteFile } from './core-routes.mjs'
import { discoverAllEntities } from '../discovery/all-entities.mjs'
import { PluginCapabilityError, withDeclaredCapabilities } from '../discovery/plugin-capabilities.mjs'
import { ContractsPublishError, checkContractsPlan, preflightContractsPlan, projectContracts, publishContractsPlan } from '../contracts/index.mjs'
import { planEntityRoutes, readAllEntityFacts } from './entity-routes.mjs'
import { webhookRoutes } from './webhooks.mjs'
import { proxyAreaNotices } from './proxy-areas.mjs'
import { ENTRY_NOT_REPLACED, projectEntryNotices, upgradeProjectEntries } from './project-entries.mjs'
import { HostPlanError, compareTargets, planHost } from './plan.mjs'
import { DEV_DIAGNOSTIC_FILE, DEV_STATUS_FILE, devDiagnosticModule, devFailureDiagnostic, renderHost } from './render.mjs'
import {
  GENERATION_FILE,
  GenerationError,
  REGISTRIES_DIR,
  acquireLock,
  checkGeneration,
  generationRecord,
  hashInputs,
  preflight,
  publishGeneration,
  readGeneration,
  sweepInterruptedWrites,
  validateFiles,
  writeOwnedFile,
} from './generation.mjs'

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** Thrown for any generation that cannot be published; `diagnostics` holds every problem found. */
export class PrepareError extends Error {
  constructor(diagnostics, headline = 'nextspark prepare failed; the previous generation is unchanged') {
    super(`${headline}:\n${diagnostics.map(d => `  - [${d.code}] ${d.message}`).join('\n')}`)
    this.name = 'PrepareError'
    this.diagnostics = diagnostics
  }
}

/** Raised when the installed core ships no route manifest: the host cannot be generated. */
export class NoCoreRouteManifestError extends Error {
  constructor(coreRoot) {
    super(`The installed @nextsparkjs/core (${coreRoot}) ships no route manifest (@nextsparkjs/core/routes/manifest.json), so it cannot generate src/app.`)
    this.name = 'NoCoreRouteManifestError'
  }
}

function describeDiagnostic(diagnostic) {
  const where = diagnostic.file ? `${diagnostic.source ?? diagnostic.file}${diagnostic.line ? `:${diagnostic.line}` : ''}` : diagnostic.source
  const message = diagnostic.exportName ? `(export "${diagnostic.exportName}") ${diagnostic.message}` : diagnostic.message
  return { ...diagnostic, message: where && !diagnostic.message.includes(where) ? `${where}: ${message}` : message }
}

/**
 * Plan and render the host in memory: `{ routes, appFiles }` or a PrepareError with every
 * planning and emission diagnostic.
 */
export async function renderHostFiles(config, { devStatus = false, cache } = {}) {
  const manifest = await config.loadCoreRoutes()
  if (!manifest) throw new NoCoreRouteManifestError(config.coreRoot ?? '(unknown core)')
  const declared = await withDeclaredCapabilities(config.plugins ?? [], { projectRoot: config.projectRoot })
  let entityPlan
  try {
    entityPlan = config.entities ? await config.entities({ manifest }) : { routes: [], diagnostics: [] }
  } catch (error) {
    if (error instanceof PluginCapabilityError) throw new PrepareError(error.diagnostics)
    throw error
  }
  const webhookPlan = config.webhooks ? config.webhooks() : { routes: {}, diagnostics: [] }
  const planned = planHost({
    coreRoutes: manifest.routes,
    entityRoutes: entityPlan.routes,
    entityNames: entityPlan.entities,
    webhooks: webhookPlan.routes,
    plugins: declared.plugins,
    project: config.project,
    modes: config.modes ?? [],
    extensions: config.extensions,
  })
  const { routes } = planned
  const notices = [...(planned.notices ?? []), ...proxyAreaNotices(config.projectRoot), ...projectEntryNotices(config.projectRoot)]
  const diagnostics = [...declared.diagnostics, ...entityPlan.diagnostics, ...webhookPlan.diagnostics, ...planned.diagnostics]
  if (diagnostics.length > 0) throw Object.assign(new PrepareError(diagnostics), { notices, stage: 'plan' })
  const rendered = await renderHost({
    routes,
    projectRoot: config.projectRoot,
    modes: config.modes ?? [],
    cacheComponents: config.cacheComponents,
    pageExtensions: config.pageExtensions,
    stylesheet: config.stylesheet,
    wrappers: config.compositionWrappers,
    cache,
    devStatus,
  })
  if (rendered.diagnostics.length > 0) throw Object.assign(new PrepareError(rendered.diagnostics.map(describeDiagnostic)), { notices, routes, stage: 'emission' })
  return { routes, manifest, appFiles: rendered.files, notices }
}

/**
 * What `prepareHost` would decide, without writing anything and without throwing for a diagnostic. For dry runs
 * (`nextspark migrate --dry-run`) and tools that predict a generation.
 *
 * Runs, read-only, every step of a generation but the registry build: the route plan (with its notices, such as project
 * templates replacing an entity's dashboard routes), the facade emission, the grammar gate of the emitted files, the
 * ownership preflight of `src/app` against the host's current files and generation record, and the contracts plan
 * with its ownership preflight. The registry build runs the registry compiler into a staging directory (a write),
 * so it is not run: `checks.registries` is `'skipped'`, and so is the ownership check of the registry files.
 *
 * `checks` says what ran: each of `plan`, `emission`, `grammar`, `ownership`, `contracts` is `'passed'`, `'failed'`,
 * `'skipped'` (an earlier step failed, or it is never run here) or `'none'` (the host has no contracts module).
 *
 * @param {object} config - a host config (see the module comment; `projectHostConfig({ projectRoot })` for a project)
 * @param {{ devStatus?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, routes: object[], notices: object[], diagnostics: object[], checks: Record<string, string> }>}
 */
export async function predictHost(config, { devStatus = false } = {}) {
  const checks = { plan: 'skipped', emission: 'skipped', grammar: 'skipped', ownership: 'skipped', contracts: config.contracts ? 'skipped' : 'none', registries: 'skipped' }
  const diagnostics = []
  let routes = []
  let notices = []
  let appFiles = null
  try {
    const rendered = await renderHostFiles(config, { devStatus })
    ;({ routes, notices, appFiles } = rendered)
    checks.plan = 'passed'
    checks.emission = 'passed'
  } catch (error) {
    if (error instanceof NoCoreRouteManifestError) {
      diagnostics.push({ code: 'NS_HOST_NO_CORE_MANIFEST', message: error.message })
    } else if (error instanceof PrepareError || error instanceof HostPlanError) {
      diagnostics.push(...error.diagnostics)
      notices = error.notices ?? []
      if (error.stage === 'emission') {
        checks.plan = 'passed'
        checks.emission = 'failed'
        routes = error.routes ?? []
      } else checks.plan = 'failed'
    } else throw error
  }
  if (appFiles) {
    const invalid = await validateFiles(appFiles, { projectRoot: config.projectRoot, wrappers: config.compositionWrappers })
    diagnostics.push(...invalid)
    checks.grammar = invalid.length > 0 ? 'failed' : 'passed'
    const ownership = preflight({ hostRoot: config.hostRoot, previous: readGeneration(config.hostRoot), files: appFiles })
    diagnostics.push(...ownership)
    checks.ownership = ownership.length > 0 ? 'failed' : 'passed'
  }
  if (config.contracts) {
    try {
      const plan = await config.contracts.plan()
      diagnostics.push(...plan.diagnostics)
      if (plan.diagnostics.length === 0) preflightContractsPlan({ target: config.contracts.target(), plan })
      checks.contracts = plan.diagnostics.length > 0 ? 'failed' : 'passed'
    } catch (error) {
      if (!(error instanceof ContractsPublishError || error instanceof PrepareError)) throw error
      diagnostics.push(...error.diagnostics)
      checks.contracts = 'failed'
    }
  }
  return { ok: diagnostics.length === 0, routes, notices, diagnostics, checks }
}

/**
 * Generate and publish the host.
 *
 * @param {object} config - the host config (see the module comment)
 * @param {object} [options]
 * @param {'development'|'production'} [options.mode]
 * @param {boolean} [options.devStatus] - include the dev status module (nextspark dev only)
 * @param {Map} [options.cache] - facade cache shared by a watcher
 * @returns {Promise<{ routes: object[], files: object[], record: object, written: string[], deleted: string[], unchanged: number }>}
 */
export async function prepareHost(config, { mode = 'development', devStatus = false, cache, staleAfterMs, reportFailure = false, changed = [] } = {}) {
  const release = acquireLock(config.hostRoot, { staleAfterMs })
  try {
    sweepInterruptedWrites(config.hostRoot)
    return await generateAndPublish(config, { mode, devStatus, cache })
  } catch (error) {
    // `nextspark dev`: the failure goes to the browser under the same lock, so no other writer's
    // newer, successful generation can land between this failure and its diagnostic. Not while a
    // source does not parse: Next reports that itself, and rewriting a module of the graph then makes
    // Turbopack drop the fix that follows (it keeps serving the code from before the error).
    const unparsable = reportFailure && devStatus ? await unparsableSources(changed, config.projectRoot) : []
    const parseError = hasParseError(error) || unparsable.length > 0
    if (parseError) error.parseError = true
    if (reportFailure && devStatus && !parseError && !(error instanceof NoCoreRouteManifestError)) {
      try {
        error.statusWritten = writeOwnedFile(config.hostRoot, DEV_DIAGNOSTIC_FILE, devDiagnosticModule(devFailureDiagnostic(diagnosticLines(error).join('\n'))))
      } catch {
        error.statusWritten = false // no owned diagnostic module (a production generation): the terminal still says it
      }
    }
    throw error
  } finally {
    release()
  }
}

async function generateAndPublish(config, { mode, devStatus, cache }) {
  try {
    const { routes, manifest, appFiles, notices } = await renderHostFiles(config, { devStatus, cache })
    const registryFiles = config.registries ? await config.registries({ mode, hostRoot: config.hostRoot }) : []
    const files = [...appFiles, ...registryFiles]
    const invalid = await validateFiles(files, { projectRoot: config.projectRoot, wrappers: config.compositionWrappers })
    if (invalid.length > 0) throw new PrepareError(invalid)

    // The contracts module is planned and preflighted with everything else: nothing is written when any part fails
    const contracts = await planContractsStep(config)

    const previous = readGeneration(config.hostRoot)
    const inputs = config.inputs ? config.inputs({ manifest }) : null
    const record = generationRecord({ mode, versions: config.versions, inputs, files })
    try {
      const published = publishGeneration({ hostRoot: config.hostRoot, previous, files, record })
      const contractsResult = publishContractsStep(config, contracts)
      // Once the generation is out: an unchanged copy of an earlier proxy or instrumentation template becomes the
      // current one, and the notices about what that copy lacked go with it
      const replaced = upgradeProjectEntries(config.projectRoot)
      const replacedFiles = new Set(replaced.filter(notice => notice.code !== ENTRY_NOT_REPLACED).map(notice => notice.target))
      // A copy that could not be written gets NS_PROJECT_ENTRY_NOT_REPLACED in place of the notice saying prepare replaces it
      const failedFiles = new Set(replaced.filter(notice => notice.code === ENTRY_NOT_REPLACED).map(notice => notice.target))
      const kept = notices.filter(notice =>
        !(replacedFiles.has(notice.target) && /^NS_(?:PROXY|INSTRUMENTATION)_/.test(notice.code)) &&
        !(failedFiles.has(notice.target) && /^NS_(?:PROXY|INSTRUMENTATION)_FACADE_MISSING$/.test(notice.code)))
      return { routes, files, record, notices: [...replaced, ...kept], ...published, contracts: contractsResult }
    } catch (error) {
      if (error instanceof GenerationError || error instanceof ContractsPublishError) throw new PrepareError(error.diagnostics)
      throw error
    }
  } catch (error) {
    if (error instanceof GenerationError || error instanceof ContractsPublishError) throw new PrepareError(error.diagnostics)
    throw error
  }
}

/** Plan the contracts module in memory (null: the host has none) and refuse what it could not publish. */
async function planContractsStep(config) {
  if (!config.contracts) return null
  const target = config.contracts.target()
  const plan = await config.contracts.plan()
  if (plan.diagnostics.length > 0) throw new PrepareError(plan.diagnostics)
  preflightContractsPlan({ target, plan })
  return { target, plan }
}

function publishContractsStep(config, contracts) {
  if (!contracts) return null
  const published = publishContractsPlan({ target: contracts.target, projectRoot: config.projectRoot, plan: contracts.plan })
  return { ...published, root: contracts.target.root, label: contracts.target.label, kind: contracts.target.kind, warnings: contracts.plan.warnings, files: contracts.plan.files.length }
}

/**
 * Generate and publish only the portable contracts module (`prepare --contracts-only`, and the step
 * a legacy project runs after its registry build): no src/app, no registries. Same ownership rules
 * and the same lock as a full generation.
 */
export async function prepareContractsOnly(config, { staleAfterMs } = {}) {
  if (!config.contracts) throw new PrepareError([{ code: 'NS_CONTRACTS_UNAVAILABLE', message: 'this project has no contracts step' }])
  const release = acquireLock(config.hostRoot, { staleAfterMs })
  try {
    sweepInterruptedWrites(config.hostRoot, { app: false })
    const contracts = await planContractsStep(config)
    return publishContractsStep(config, contracts)
  } catch (error) {
    if (error instanceof ContractsPublishError) throw new PrepareError(error.diagnostics)
    throw error
  } finally {
    release()
  }
}

/** `prepare --contracts-only --check`: compare only the contracts module with what prepare would generate. */
export async function checkContractsOnly(config) {
  const target = config.contracts.target()
  const plan = await config.contracts.plan()
  if (plan.diagnostics.length > 0) return { ok: false, problems: plan.diagnostics.map(d => ({ state: 'invalid', detail: `[${d.code}] ${d.message}` })) }
  const { ok, problems } = checkContractsPlan({ target, plan })
  return { ok, problems: problems.map(problem => ({ ...problem, path: `${target.label}/${problem.path}` })) }
}

/**
 * `prepare --check`: compare the host on disk with what prepare would generate now, writing
 * nothing. The expected host is the one `nextspark prepare` / `build` write; with `dev`, the one
 * `nextspark dev` writes (its status files and composed root layout). A dev generation is
 * therefore never fresh for a plain check - what CI checks is the production host.
 */
export async function checkHost(config, { dev = false } = {}) {
  let previous
  try {
    previous = readGeneration(config.hostRoot)
  } catch (error) {
    if (!(error instanceof GenerationError)) throw error
    return { ok: false, problems: error.diagnostics.map(d => ({ state: 'stale', path: GENERATION_FILE, detail: d.message })) }
  }
  let rendered
  try {
    rendered = await renderHostFiles(config, { devStatus: dev })
  } catch (error) {
    if (!(error instanceof PrepareError)) throw error
    return { ok: false, problems: error.diagnostics.map(d => ({ state: 'invalid', detail: `[${d.code}] ${d.message}` })) }
  }
  const inputs = config.inputs ? config.inputs({ manifest: rendered.manifest }) : null
  const result = checkGeneration({ hostRoot: config.hostRoot, previous, appFiles: rendered.appFiles, inputs, versions: config.versions })
  const isDevGeneration = Boolean(previous?.files?.[DEV_STATUS_FILE])
  if (previous && isDevGeneration !== dev) {
    result.problems.unshift({
      state: 'stale',
      path: GENERATION_FILE,
      detail: isDevGeneration
        ? 'this is the development host nextspark dev writes (status files, composed root layout); run nextspark prepare for the production host, or check it with --check --dev'
        : 'this is not the development host nextspark dev writes; run nextspark dev, or check without --dev',
    })
    result.ok = false
  }
  if (config.contracts) {
    const target = config.contracts.target()
    let plan
    try {
      plan = await config.contracts.plan()
    } catch (error) {
      if (!(error instanceof PrepareError)) throw error
      plan = { diagnostics: error.diagnostics, files: [] }
    }
    if (plan.diagnostics.length > 0) {
      result.problems.push(...plan.diagnostics.map(d => ({ state: 'invalid', detail: `[${d.code}] ${d.message}` })))
    } else {
      for (const problem of checkContractsPlan({ target, plan }).problems) result.problems.push({ ...problem, path: `${target.label}/${problem.path}` })
    }
    result.ok = result.problems.length === 0
  }
  return result
}

// ---------------------------------------------------------------------------
// Real projects
// ---------------------------------------------------------------------------

/**
 * The source directories and files whose content decides the generation: the route sources and
 * every place the registry build reads. From `tests/` and `docs/` only what it reads: the Cypress
 * specs whose tags feed testing-registry (`tests/cypress/e2e`) and the two documentation roots of
 * docs-registry. The rest of `tests/` (videos, screenshots, reports, and the fixtures the registry
 * build itself writes) and of `docs/` never changes the generation, so hashing it would only make
 * `--check` report test runs as stale sources.
 */
export const PROJECT_INPUT_DIRS = [
  'templates', 'api', 'entities', 'config', 'blocks', 'components', 'lib', 'messages', 'styles', 'emails', 'auth',
  'docs/public', 'docs/superadmin', 'tests/cypress/e2e',
]
export const PROJECT_INPUT_FILES = ['nextspark.config.ts', 'package.json', 'next.config.ts', 'next.config.mjs', 'next.config.js']

function readVersion(packageJsonPath) {
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version ?? null
  } catch {
    return null
  }
}

function walkFiles(root, dir = root) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(root, path))
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'))
  }
  return files.sort(compareTargets)
}

/** The fixed time generated registries of a generated host carry, so the same inputs give the same bytes. */
export const DETERMINISTIC_BUILD_TIME = '1970-01-01T00:00:00.000Z'
const BUILD_TIME_LINE = /^(.*(?:Generated at:|generatedAt:|generatedAt =)\s*['"]?)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z(['"]?,?\s*)$/gm

/**
 * The registry generators stamp the wall-clock time into each file (`Generated at: <ISO>`,
 * `generatedAt: '<ISO>'`). A generated host replaces exactly those timestamps with a fixed one:
 * otherwise every prepare would rewrite every registry (and Next recompile them) and the same
 * sources would never give the same bytes.
 */
export function withoutBuildTime(content) {
  return content.replace(BUILD_TIME_LINE, `$1${DETERMINISTIC_BUILD_TIME}$2`)
}

/**
 * Run the registry build with its output in a staging directory under .nextspark and read what
 * it wrote. The build runs as a child process (it ends with process.exit on failure).
 */
export function stagedRegistryBuild({ projectRoot, coreRoot, env = process.env }) {
  return async ({ mode }) => {
    const fs = projectFiles(projectRoot)
    fs.mkdirSync(join(projectRoot, '.nextspark'), { recursive: true })
    const staging = fs.mkdtempSync(join('.nextspark', 'staging-'))
    try {
      const outputDir = join(staging, 'registries')
      const result = await new Promise(resolve => {
        const child = spawn(process.execPath, [join(coreRoot, 'scripts/build/registry.mjs'), '--build'], {
          cwd: projectRoot,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...env,
            ...(mode === 'production' ? { NODE_ENV: 'production' } : {}),
            NEXTSPARK_REGISTRIES_OUT: relative(projectRoot, outputDir),
          },
        })
        let output = ''
        child.stdout.on('data', chunk => { output += chunk })
        child.stderr.on('data', chunk => { output += chunk })
        child.on('error', error => resolve({ code: 1, output: `${output}${error.message}\n` }))
        child.on('close', (code, signal) => resolve({ code: code ?? (signal ? 1 : 0), output }))
      })
      if (result.code !== 0 || !existsSync(outputDir)) {
        const tail = result.output.trim().split('\n').slice(-40).join('\n')
        throw new PrepareError([{ code: 'NS_HOST_REGISTRY_BUILD_FAILED', message: `the registry build failed (exit ${result.code}):\n${tail}` }])
      }
      // The build's output is dropped when it succeeds, except its WARNING/ERROR lines (e.g. a thumbnail.png that is not a PNG)
      for (const line of result.output.split('\n')) if (line.includes('WARNING') || line.includes('ERROR')) process.stderr.write(`${line}\n`)
      return walkFiles(outputDir).map(path => ({ path: `${REGISTRIES_DIR}/${path}`, content: withoutBuildTime(readFileSync(join(outputDir, path), 'utf8')), grammar: null }))
    } finally {
      fs.rmSync(staging, { recursive: true, force: true })
    }
  }
}

/**
 * The host's `cacheComponents`, when next.config states it as a literal (`cacheComponents: true`
 * or `false`, comments ignored); undefined when it has no next.config, never mentions it, or
 * says it more than one way (computed configs cannot be read without running them). It selects
 * core's cacheComponents route variants and lets the emitter reject segment config Next would
 * refuse; undefined keeps the manifest entries and leaves that check to `next build`.
 */
export function readCacheComponents(projectRoot) {
  const values = new Set()
  for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.js']) {
    const path = join(projectRoot, name)
    if (!existsSync(path)) continue
    const source = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    for (const match of source.matchAll(/\bcacheComponents\s*:\s*([A-Za-z_$][\w$.]*)/g)) values.add(match[1])
  }
  if (values.size !== 1) return undefined
  const [value] = values
  return value === 'true' ? true : value === 'false' ? false : undefined
}

/**
 * The host config of a real root-first project: core routes from the installed core's
 * manifest, enabled plugins from nextspark.config.ts, project `templates/` and `api/`,
 * registries from the registry build.
 */
export function projectHostConfig({ projectRoot = process.cwd(), env = process.env } = {}) {
  const config = getConfig(projectRoot)
  const coreRoot = config.coreDir ?? CORE_ROOT
  const pluginsOf = loaded => (loaded.pluginSources ?? []).map(source => ({ name: source.name, root: source.sourceDir, importBase: source.importBase, kind: source.kind, packageName: source.packageName }))
  // nextspark.config.ts is read again for every generation, so a long-lived watcher follows an
  // edit (a plugin enabled or removed) instead of the config it started with.
  const currentConfig = () => {
    try {
      return getConfig(config.projectRoot)
    } catch (error) {
      throw new PrepareError([{ code: 'NS_HOST_PROJECT_CONFIG', message: error.message }])
    }
  }
  const currentPlugins = () => pluginsOf(currentConfig())
  const plugins = pluginsOf(config)
  const next = resolveNextPackage(config.projectRoot)
  return {
    hostRoot: config.projectRoot,
    projectRoot: config.projectRoot,
    coreRoot,
    loadCoreRoutes: () => loadCoreRouteManifest({ coreRoot, cacheComponents: readCacheComponents(config.projectRoot) }),
    // Read on every generation: the dev watcher follows a next.config edit too.
    get cacheComponents() {
      return readCacheComponents(config.projectRoot)
    },
    get plugins() {
      return currentPlugins()
    },
    project: { root: config.projectRoot, importBase: '@', label: '.' },
    // The project's global stylesheet: the root layout imports it (a project without one has none to import).
    get stylesheet() {
      return existsSync(join(config.projectRoot, 'styles', 'globals.css')) ? '@/styles/globals.css' : undefined
    },
    // One concrete set of routes per entity, from the entities discovered now (a watcher follows a new entity).
    entities: async ({ manifest }) => {
      const current = currentConfig()
      const entities = await discoverAllEntities(current, { includeCore: false })
      const facts = await readAllEntityFacts({ entities, projectRoot: config.projectRoot, plugins: pluginsOf(current) })
      return planEntityRoutes({
        entities,
        facts,
        coreRoutes: manifest.routes,
        resolveFile: specifier => resolveCoreRouteFile(coreRoot, specifier),
        cacheComponents: readCacheComponents(config.projectRoot),
      })
    },
    // The contracts are generated with the core that runs this script (its portable sources are what the server runs too)
    contracts: projectContracts({ projectRoot: config.projectRoot, coreRoot: CORE_ROOT, currentConfig, plugins: pluginsOf }),
    webhooks: () =>
      webhookRoutes({
        webhookExtensions: currentConfig().billing?.webhookExtensions,
        projectRoot: config.projectRoot,
        resolveFile: specifier => resolveCoreRouteFile(coreRoot, specifier),
      }),
    registries: stagedRegistryBuild({ projectRoot: config.projectRoot, coreRoot, env }),
    inputs: ({ manifest } = {}) => {
      const enabled = currentPlugins()
      return hashInputs({
        root: config.projectRoot,
        dirs: [...PROJECT_INPUT_DIRS, ...enabled.filter(plugin => plugin.kind === 'local').map(plugin => relative(config.projectRoot, plugin.root))],
        files: PROJECT_INPUT_FILES,
        extra: {
          'core-routes': manifest?.hash ?? 'none',
          ...Object.fromEntries(enabled.filter(plugin => plugin.kind === 'packaged').map(plugin => [`plugin:${plugin.packageName}`, readVersion(join(plugin.root, 'package.json')) ?? '?'])),
        },
      })
    },
    versions: {
      core: readVersion(join(coreRoot, 'package.json')) ?? 'unknown',
      next: next?.version ?? 'unresolved',
      ...(env.NEXTSPARK_CLI_VERSION ? { cli: env.NEXTSPARK_CLI_VERSION } : {}),
    },
    watch: {
      // Not tests/cypress/e2e: a spec saved while tests run would regenerate the host; --check still sees it.
      dirs: ['templates', 'api', 'plugins', 'entities', 'config', 'blocks', 'messages', 'emails', 'auth', 'docs/public', 'docs/superadmin'].map(dir => join(config.projectRoot, dir)),
      files: [
        join(config.projectRoot, 'nextspark.config.ts'),
        ...[coreRouteManifestPath(coreRoot), coreRouteVariantsPath(coreRoot)].filter(Boolean),
        ...['next.config.ts', 'next.config.mjs', 'next.config.js'].map(name => join(config.projectRoot, name)),
        ...plugins.filter(plugin => plugin.kind === 'packaged').map(plugin => join(plugin.root, 'package.json')),
      ],
    },
  }
}

export { hasCoreRouteManifest }

// ---------------------------------------------------------------------------
// Watch (nextspark dev)
// ---------------------------------------------------------------------------

const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
// Not imported by the app (the Next and NextSpark configs, tests): a failure in them cannot reach the bundler's graph, and the
// panel is the only place it shows
const OUTSIDE_GRAPH = /(^|[\\/])(nextspark|next)\.config\.[cm]?[jt]s$|[\\/]__tests__[\\/]|\.(test|spec|cy)\.[cm]?[jt]sx?$/

/**
 * The changed files of a watch batch that are sources the app imports (TypeScript or JavaScript: a template, a config
 * under config/, an entity or plugin config...) and do not parse. Parsed with the project's TypeScript; unreadable or
 * removed files are skipped.
 */
export async function unparsableSources(changed, projectRoot) {
  const candidates = changed.filter(path => SOURCE_FILE.test(path) && !OUTSIDE_GRAPH.test(path))
  if (candidates.length === 0) return []
  const ts = await loadTypeScriptFor(projectRoot)
  const broken = []
  for (const path of candidates) {
    let source
    try {
      source = readFileSync(path, 'utf8')
    } catch {
      continue
    }
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, false, ts.getScriptKindFromFileName(path))
    if ((file.parseDiagnostics ?? []).length > 0) broken.push(path)
  }
  return broken
}

/** True when a failure includes a source that does not parse (a template, a route or an entity config). */
export function hasParseError(error) {
  return Boolean(error?.diagnostics?.some(diagnostic => diagnostic.code === 'NS_HOST_PARSE_ERROR' || diagnostic.parseError === true))
}

/** Diagnostics as terminal lines. */
export function diagnosticLines(error) {
  if (error instanceof PrepareError || error instanceof HostPlanError) return error.message.split('\n')
  return [`nextspark prepare failed: ${error?.stack ?? error}`]
}

/**
 * Watch the sources of a host and regenerate on change (nextspark dev).
 *
 * Each batch of changes (debounced) runs `prepareHost` with a shared facade cache, so only
 * changed sources are parsed again and only changed files are written. When a regeneration
 * fails, the last valid generation stays published and keeps being served, the diagnostic goes
 * to `onFailure`, and - when the generation has the dev status files - the diagnostic module is
 * rewritten so the dev reporter logs it in the browser (Next's dev indicator lists it); the next
 * successful regeneration empties it and the issue clears. Nothing throws: routes keep rendering.
 * Except while a source does not parse (a route, an entity config, or any changed source of the
 * batch): then nothing is written at all, since Next reports the syntax error itself and a write to
 * the graph at that moment makes Turbopack drop the fix that follows (see `prepareHost`).
 *
 * @returns {{ close(): void, regenerate(): Promise<object> }}
 */
export function watchHost(config, { debounceMs = 150, devStatus = true, onSuccess = () => {}, onFailure = () => {}, watchPaths = config.watch } = {}) {
  const cache = new Map()
  const watchers = new Map()
  let timer = null
  let running = null
  let again = false
  let closed = false
  let changed = new Set()
  let unparsed = []

  const regenerate = async () => {
    if (running) {
      again = true
      return running
    }
    const batch = [...changed].sort(compareTargets)
    changed = new Set()
    // Sources that did not parse in an earlier batch count until they parse again, whatever this batch changed
    const suspects = [...new Set([...batch, ...unparsed])]
    running = (async () => {
      try {
        unparsed = await unparsableSources(suspects, config.projectRoot).catch(() => [])
        const result = await prepareHost(config, { mode: 'development', devStatus, cache, reportFailure: true, changed: unparsed })
        onSuccess({ ...result, changed: batch })
        return { ok: true, result }
      } catch (error) {
        // Written by prepareHost under its lock; false when the lock was held by another writer
        // (whose generation will be the one published) or the host has no dev diagnostic module.
        const statusWritten = error?.statusWritten === true
        onFailure({ error, lines: diagnosticLines(error), changed: batch, statusWritten })
        return { ok: false, error }
      } finally {
        running = null
        if (again && !closed) {
          again = false
          schedule()
        }
      }
    })()
    return running
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void regenerate()
    }, debounceMs)
  }

  const record = path => {
    if (/(^|[\\/])(node_modules|\.git|\.next[^\\/]*)([\\/]|$)/.test(path) || /\.nextspark-tmp$/.test(path)) return
    changed.add(path)
    schedule()
  }

  const attach = (path, recursive) => {
    if (closed || watchers.has(path) || !existsSync(path)) return
    try {
      const watcher = watchFs(path, { recursive }, (event, name) => record(name ? join(path, String(name)) : path))
      watcher.on('error', () => {
        watchers.delete(path)
        watcher.close()
      })
      watchers.set(path, watcher)
    } catch {
      // Unwatchable (removed in between): the parent watcher re-attaches it when it comes back.
    }
  }

  const dirs = watchPaths?.dirs ?? []
  const files = watchPaths?.files ?? []
  for (const dir of dirs) attach(dir, true)
  for (const file of files) attach(file, false)
  // Parents catch a source directory or file created (or re-created) after start.
  const parents = [...new Set([...dirs, ...files].map(path => dirname(path)))]
  for (const parent of parents) {
    try {
      const watcher = watchFs(parent, { recursive: false }, (event, name) => {
        const path = name ? join(parent, String(name)) : parent
        if (dirs.includes(path) || files.includes(path)) {
          if (!existsSync(path) && watchers.has(path)) {
            watchers.get(path).close()
            watchers.delete(path)
          }
          attach(path, dirs.includes(path))
          record(path)
        }
      })
      watchers.set(`${parent}\0parent`, watcher)
    } catch {
      // A missing parent (an uninstalled plugin package) is simply not watched.
    }
  }

  return {
    regenerate,
    close() {
      closed = true
      clearTimeout(timer)
      for (const watcher of watchers.values()) watcher.close()
      watchers.clear()
    },
  }
}
