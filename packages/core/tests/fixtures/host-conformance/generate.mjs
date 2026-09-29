#!/usr/bin/env node
/**
 * Generates the `generated/` host with the production generator (`nextspark prepare`'s
 * pipeline, packages/core/scripts/build/registry/host/prepare.mjs): `src/app` facades through the
 * facade emitter and the entity registries under `.nextspark/registries`, published with
 * `.nextspark/generation.json`, all git-ignored.
 *
 * Run: node packages/core/tests/fixtures/host-conformance/generate.mjs
 */
import { prepareHost } from '../../../scripts/build/registry/host/prepare.mjs'
import { GENERATED_ROOT, fixtureHostConfig } from './plan.mjs'

export { renderEntityRegistry } from './plan.mjs'

export async function generate(options = {}) {
  const { routes, files } = await prepareHost(fixtureHostConfig(options), { mode: 'production' })
  return { routes, files: files.map(file => file.path) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files } = await generate()
  console.log(`Generated ${files.length} files under ${GENERATED_ROOT}:\n${files.map(file => `  ${file}`).join('\n')}`)
}
