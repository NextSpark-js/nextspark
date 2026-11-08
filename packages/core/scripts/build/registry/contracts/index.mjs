/**
 * The portable contracts of a project (#203 stage 7b): `nextspark prepare` generates a module of DTO
 * types and zod schemas from the project's entities, for clients that must not import server code
 * (the mobile app).
 *
 * Where it goes:
 * - web-only project: `<project>/.nextspark/contracts` (git-ignored, regenerated with the host);
 * - web+mobile monorepo: `packages/contracts` beside `web/` and `mobile/` (committed, consumed by mobile/);
 * - this repository: `packages/contracts`, fed by `apps/dev`.
 *
 * A contracts package opts in to being written by declaring which project feeds it, in its package.json:
 *
 * ```json
 * { "name": "@project/contracts", "nextspark": { "contractsProject": "../web" } }
 * ```
 *
 * The path is relative to the package and must lead back to the project being prepared; the package
 * is looked for at `<project>/../packages/contracts`, `<project>/../../packages/contracts` and
 * `<project>/packages/contracts`. Without such a package the module goes to `.nextspark/contracts`.
 *
 * @module core/scripts/build/registry/contracts/index
 */

import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { projectFiles } from '../../safe-fs.mjs'
import { discoverAllEntities } from '../discovery/all-entities.mjs'
import { entityConfigFile, routableEntities } from '../host/entity-routes.mjs'
import { PortableSourcesError, loadResponseShape, readPortableSources } from './portable.mjs'
import { Sources, readChildDefinition, readEntityContract } from './read-entities.mjs'
import { SHARED_EXPORTS, entityNames, exportedNames, renderContracts } from './render.mjs'
import { CONTRACTS_GENERATION_FILE, ContractsPublishError, checkContracts, foreignDiagnostic, planPublication, publishContracts, readContractsRecord } from './publish.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

export { CONTRACTS_GENERATION_FILE, ContractsPublishError }

export const DEFAULT_CONTRACTS_DIR = '.nextspark/contracts'
export const CONTRACTS_PACKAGE_CANDIDATES = ['../packages/contracts', '../../packages/contracts', 'packages/contracts']

const realOrNull = path => {
  try {
    return realpathSync(path)
  } catch {
    return null
  }
}

/**
 * Where the contracts module of `projectRoot` is written.
 * @returns {{ root: string, kind: 'package' | 'default', label: string }}
 */
export function resolveContractsTarget(projectRoot) {
  const project = realOrNull(projectRoot) ?? resolve(projectRoot)
  for (const candidate of CONTRACTS_PACKAGE_CANDIDATES) {
    const root = resolve(projectRoot, candidate)
    const manifest = join(root, 'package.json')
    if (!existsSync(manifest)) continue
    let linked
    try {
      linked = JSON.parse(readFileSync(manifest, 'utf8'))?.nextspark?.contractsProject
    } catch {
      continue
    }
    if (typeof linked !== 'string') continue
    if (realOrNull(resolve(root, linked)) === project) return { root, kind: 'package', label: candidate }
  }
  return { root: join(projectRoot, DEFAULT_CONTRACTS_DIR), kind: 'default', label: DEFAULT_CONTRACTS_DIR }
}

/**
 * The files of the contracts module of the project, in memory: `{ files, warnings, diagnostics, entities }`.
 * Entities are the project's and its enabled plugins' top-level entities that have an external API;
 * core's own entities (users, teams, ...) are not part of a project's contracts.
 *
 * @param {object} input
 * @param {object[]} input.entities - `discoverAllEntities(config, { includeCore: false })`
 * @param {string} input.projectRoot - where the `@/` sources are and where TypeScript resolves from
 * @param {string} input.coreRoot - the core the contracts are generated with (its portable schema sources are copied into the module)
 * @param {object[]} [input.plugins] - `{ root, importBase }` of the enabled plugins
 */
export async function planContracts({ entities, projectRoot, coreRoot, plugins = [] }) {
  let portable
  let shape
  try {
    portable = readPortableSources(coreRoot)
    shape = await loadResponseShape(coreRoot, projectRoot)
  } catch (error) {
    if (!(error instanceof PortableSourcesError)) throw error
    return { files: [], warnings: [], diagnostics: [{ code: 'NS_CONTRACTS_NO_PORTABLE_SOURCES', message: error.message }] }
  }
  const ts = await loadTypeScriptFor(projectRoot)
  const sources = new Sources(ts, projectRoot)
  const diagnostics = []
  const warnings = []
  const contracts = []
  for (const entity of routableEntities(entities).filter(entity => entity.enabled !== false)) {
    const file = entityConfigFile(entity, { projectRoot, plugins })
    if (!file || !existsSync(file)) {
      diagnostics.push({ code: 'NS_CONTRACTS_ENTITY_UNREADABLE', message: `entity "${entity.name}" (${entity.configPath}): the config file cannot be found` })
      continue
    }
    const read = await readEntityContract({ file, exportName: entity.exportName, projectRoot, sources, migrationDirs: [join(dirname(file), 'migrations'), join(projectRoot, 'migrations')] })
    if (read.error) {
      diagnostics.push({ code: 'NS_CONTRACTS_ENTITY_UNREADABLE', message: `entity "${entity.name}" (${entity.configPath}) ${read.error}` })
      continue
    }
    if (read.skipped) continue
    if (!/^[a-z][a-z0-9_-]*$/.test(read.contract.slug)) {
      diagnostics.push({ code: 'NS_CONTRACTS_BAD_SLUG', message: `entity "${entity.name}": slug ${JSON.stringify(read.contract.slug)} is not a lowercase identifier a module can be named after (a letter, then letters, digits, - or _)` })
      continue
    }
    for (const warning of read.contract.warnings) warnings.push(`${read.contract.slug}: ${warning}`)
    contracts.push({ contract: read.contract, source: entity.configPath, name: entity.name })
  }
  contracts.sort((a, b) => (a.contract.slug < b.contract.slug ? -1 : a.contract.slug > b.contract.slug ? 1 : 0))

  // The child entities the child routes serve: the registry's entries whose `parent` is one of these entities (nested
  // `children/<child>/` directories). The routes resolve them from the registry, so the client follows the same source.
  const parents = new Map(contracts.map(entry => [entry.name, entry.contract.slug]))
  const children = []
  for (const entity of entities) {
    if (!entity.parent || !parents.has(entity.parent) || !/(?:Child|Entity)Config$/.test(entity.exportName ?? '')) continue
    const parent = parents.get(entity.parent)
    const file = entityConfigFile(entity, { projectRoot, plugins })
    const read = file && existsSync(file) ? await readChildDefinition({ file, exportName: entity.exportName, projectRoot, sources }) : { error: 'the config file cannot be found' }
    if (read.error) warnings.push(`${parent}: child entity "${entity.name}" (${entity.configPath}) ${read.error}, so it has no client`)
    else children.push({ parent, name: entity.name, fields: read.fields, source: entity.configPath })
  }
  children.sort((a, b) => `${a.parent}\0${a.name}` < `${b.parent}\0${b.name}` ? -1 : 1)

  const seenSlugs = new Map()
  const seenNames = new Map(SHARED_EXPORTS.map(name => [name, 'the shared envelope and field schemas']))
  for (const { contract } of contracts) {
    if (seenSlugs.has(contract.slug)) diagnostics.push({ code: 'NS_CONTRACTS_NAME_CLASH', message: `two entities have the slug "${contract.slug}"` })
    seenSlugs.set(contract.slug, true)
    for (const name of new Set(exportedNames(contract))) {
      const owner = seenNames.get(name)
      if (owner && owner !== contract.slug) diagnostics.push({ code: 'NS_CONTRACTS_NAME_CLASH', message: `entities "${owner}" and "${contract.slug}" would both export ${name} (${entityNames(contract).base}); give one of them a different names.singular` })
      else seenNames.set(name, contract.slug)
    }
  }
  // `entities` ({ contract, source }, slug order) feed the typed client generated from the same contracts (client/)
  return { files: diagnostics.length > 0 ? [] : renderContracts(contracts, { portable, shape }), warnings, diagnostics, entities: contracts, children }
}

/**
 * The contracts step of a host config (`config.contracts`), for a real project.
 * `plan()` renders in memory; `publish()` writes; `check()` compares.
 */
export function projectContracts({ projectRoot, coreRoot, currentConfig, plugins }) {
  const target = () => resolveContractsTarget(projectRoot)
  const plan = async () => {
    const config = currentConfig()
    const entities = await discoverAllEntities(config, { includeCore: false })
    return planContracts({ entities, projectRoot, coreRoot, plugins: plugins(config) })
  }
  return { target, plan }
}

/** Write the contracts module of `plan` to `target`. */
export function publishContractsPlan({ target, projectRoot, plan }) {
  const ensureRoot = target.kind === 'default' ? () => projectFiles(projectRoot).mkdirSync(target.root, { recursive: true }) : undefined
  return publishContracts({ root: target.root, files: plan.files, ensureRoot })
}

/** Refuse, before anything is written, a publication that would run into a file that is not ours. */
export function preflightContractsPlan({ target, plan }) {
  const previous = readContractsRecord(target.root)
  const { foreign } = planPublication({ root: target.root, files: plan.files, previous })
  if (foreign.length > 0) throw new ContractsPublishError([foreignDiagnostic(foreign)])
}

/** Compare the contracts module of `plan` with `target`. */
export function checkContractsPlan({ target, plan }) {
  return checkContracts({ root: target.root, files: plan.files })
}
