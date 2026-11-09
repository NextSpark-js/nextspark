/**
 * apps/mobile bundles packages/ui and packages/mobile from source, and each of them has its own node_modules.
 * Metro resolves from the importing file's directory first, so without a rule their `react` is a second copy and
 * the first hook fails with "Cannot read property 'useState' of null". The test calls the metro config's resolver
 * the way Metro does and checks which directory the import is resolved from (#286).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const appDir = path.join(repo, 'apps/mobile')
// withNativeWind reads tailwind.config.js from the working directory, as Metro runs inside apps/mobile
const cwd = process.cwd()
process.chdir(appDir)
const metroConfig = createRequire(import.meta.url)(path.join(appDir, 'metro.config.js'))
process.chdir(cwd)

// The resolver Metro would fall back to: it reports the directory the import starts from.
const resolveFrom = (originModulePath, moduleName) =>
  metroConfig.resolver.resolveRequest(
    { originModulePath, resolveRequest: (context, name) => ({ type: 'sourceFile', filePath: `${context.originModulePath}::${name}` }) },
    moduleName,
    'ios',
  ).filePath

const fromPackage = path.join(repo, 'packages/mobile/src/providers/QueryProvider.tsx')

test('react, react-native, expo and react-query imported by the packages resolve from the app', () => {
  for (const name of ['react', 'react/jsx-runtime', 'react-native', 'expo-secure-store', '@tanstack/react-query', '@preeternal/react-native-cookie-manager']) {
    assert.equal(resolveFrom(fromPackage, name), `${path.join(appDir, 'index.js')}::${name}`, name)
  }
})

test('other imports of the packages, and every import inside the app dependencies, resolve from where they are', () => {
  assert.equal(resolveFrom(fromPackage, 'zod'), `${fromPackage}::zod`)
  const inDependency = path.join(appDir, 'node_modules/.pnpm/expo@1/node_modules/expo/index.js')
  assert.equal(resolveFrom(inDependency, 'react'), `${inDependency}::react`)
})
