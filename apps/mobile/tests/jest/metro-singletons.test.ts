/**
 * @jest-environment node
 *
 * apps/mobile bundles packages/ui and packages/mobile from source, and each has its own node_modules. Metro
 * resolves from the importing file's directory first, so without a rule their `react` is a second copy and the
 * first hook fails with "Cannot read property 'useState' of null". The test calls the metro config's resolver the
 * way Metro does and checks which directory an import is resolved from (#286).
 */
import path from 'path'

const appDir = path.resolve(__dirname, '../..')
const repo = path.resolve(appDir, '../..')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const metroConfig = require(path.join(appDir, 'metro.config.js'))

// The resolver Metro would fall back to: it reports the directory the import starts from.
const resolveFrom = (originModulePath: string, moduleName: string): string =>
  metroConfig.resolver.resolveRequest(
    { originModulePath, resolveRequest: (context: { originModulePath: string }, name: string) => ({ type: 'sourceFile', filePath: `${context.originModulePath}::${name}` }) },
    moduleName,
    'ios',
  ).filePath

const fromMobilePackage = path.join(repo, 'packages/mobile/src/providers/QueryProvider.tsx')
const fromUiPackage = path.join(repo, 'packages/ui/src/components/Switch.native.tsx')

describe('apps/mobile Metro config', () => {
  it.each([
    'react',
    'react/jsx-runtime',
    'react-native',
    'react-native-reanimated',
    'react-native-worklets',
    'react-native-svg',
    'expo-secure-store',
    '@tanstack/react-query',
    '@preeternal/react-native-cookie-manager',
  ])('resolves %s from the app for the packages bundled from source', (name) => {
    for (const origin of [fromMobilePackage, fromUiPackage]) {
      expect(resolveFrom(origin, name)).toBe(`${path.join(appDir, 'index.js')}::${name}`)
    }
  })

  it('leaves other imports, and every import inside the app dependencies, where they are', () => {
    expect(resolveFrom(fromMobilePackage, 'zod')).toBe(`${fromMobilePackage}::zod`)
    const inDependency = path.join(appDir, 'node_modules/.pnpm/expo@1/node_modules/expo/index.js')
    expect(resolveFrom(inDependency, 'react')).toBe(`${inDependency}::react`)
  })
})
