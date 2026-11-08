/**
 * The typed entity client of a project (#277): `nextspark prepare` generates, beside the registries, a client and
 * TanStack Query hooks for every entity that is in the portable contracts (the project's and its enabled plugins'
 * top-level entities with an external API), and for their child entities.
 *
 * The client is a registry file group (`.nextspark/registries/entity-client/`): it is recorded and owned by the
 * generation like the rest, git-ignored with it, and imported as `@nextsparkjs/registries/entity-client`. Its
 * types come from the contracts module by `import type`, wherever that module is written (`.nextspark/contracts`,
 * or a linked `packages/contracts`).
 *
 * @module core/scripts/build/registry/client/index
 */

import { isAbsolute, join, relative, sep } from 'node:path'

import { CLIENT_DIR, clientExportedNames, renderClient } from './render.mjs'

export { CLIENT_DIR }

/**
 * The module path of the contracts' `src` directory as the client files import it: relative to
 * `<project>/.nextspark/registries/entity-client`.
 */
export function contractsDirFrom(projectRoot, target) {
  const path = relative(join(projectRoot, CLIENT_DIR), join(target.root, 'src')).split(sep).join('/')
  return isAbsolute(path) || path.startsWith('.') ? path : `./${path}`
}

/**
 * The files of the client, in memory: `{ files, diagnostics }`.
 *
 * @param {object} input
 * @param {{ contract: object, source: string }[]} input.entities - `planContracts(...).entities`
 * @param {{ parent: string, name: string, fields: object[], source: string }[]} [input.children] - `planContracts(...).children`
 * @param {string} input.projectRoot
 * @param {{ root: string }} input.target - where the contracts module is written (`resolveContractsTarget`)
 */
export function planClient({ entities, children = [], projectRoot, target }) {
  const diagnostics = []
  const owners = new Map()
  for (const { contract } of entities) {
    for (const name of new Set(clientExportedNames(contract, children.filter(child => child.parent === contract.slug)))) {
      const owner = owners.get(name)
      if (owner && owner !== contract.slug) diagnostics.push({ code: 'NS_CLIENT_NAME_CLASH', message: `entities "${owner}" and "${contract.slug}" would both export ${name} from the generated client; give one of them a different names.singular` })
      else owners.set(name, contract.slug)
    }
  }
  if (diagnostics.length > 0) return { files: [], diagnostics }
  return { files: renderClient(entities, { children, contractsDir: contractsDirFrom(projectRoot, target) }), diagnostics }
}
