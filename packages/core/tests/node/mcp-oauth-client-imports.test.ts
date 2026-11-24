/**
 * #541: client code asks whether the project was built with MCP browser sign-in from `lib/mcp/oauth/built`, never
 * from `lib/mcp/oauth/config`. The auth client and `useAuth` are in the JavaScript of every page; `config` reads
 * the app configuration, and importing the flag from there put the dashboard's settings helpers in the chunks of
 * the signed-out routes (the route JavaScript budget of the generated starter failed on it).
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')
const read = (file: string) => fs.readFileSync(path.join(SRC, file), 'utf8')
const importsOf = (source: string) => [...source.matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map(match => match[1])

test('the client modules of MCP sign-in do not import its server configuration', () => {
  const clientModules = [
    'lib/auth-client.ts',
    'hooks/useAuth.ts',
    'components/settings/ConnectedApps.tsx',
    'components/auth/OAuthConsent.tsx',
    'components/auth/OAuthTeamSelect.tsx',
  ]
  for (const file of clientModules) {
    const offenders = importsOf(read(file)).filter(specifier => /mcp\/oauth\/config$/.test(specifier))
    assert.deepEqual(offenders, [], `${file} imports the server configuration of MCP sign-in`)
  }
})

test('the flag module client code imports reaches nothing but the generated flags', () => {
  assert.deepEqual(importsOf(read('lib/mcp/oauth/built.ts')), ['@nextsparkjs/registries/features'])
  // and the other two modules of the feature that client code imports stay free of imports
  assert.deepEqual(importsOf(read('lib/mcp/oauth/sign-in-continuation.ts')), [])
  assert.deepEqual(importsOf(read('lib/mcp/oauth/scope-names.ts')), [])
})
