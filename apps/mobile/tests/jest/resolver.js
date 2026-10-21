/**
 * @nextsparkjs/mobile resolves to packages/mobile/src (see jest.config.js),
 * which lives outside apps/mobile and has its own, separately-installed
 * node_modules from the pnpm workspace. Node's default resolution walks up
 * from the requiring file, so a bare import there (react-native, expo-*, a
 * babel helper) would load a second, un-mocked copy from that tree instead
 * of the one apps/mobile's Jest setup configured.
 *
 * Metro avoids this with a fixed nodeModulesPaths list (see metro.config.js);
 * this does the same for Jest: a bare import whose requesting file is under
 * packages/mobile/src resolves as if it were requested from apps/mobile.
 */
const path = require('path')

// packages/contracts/src is the same case: workspace source with its own node_modules, compiled here by
// Babel, which needs its runtime helpers from the one install this app's Jest setup configured. It also
// imports zod, which only its own install has, so a bare import the app does not have falls back to it.
const WORKSPACE_SOURCES = [
  path.resolve(__dirname, '../../../../packages/mobile/src') + path.sep,
  path.resolve(__dirname, '../../../../packages/contracts/src') + path.sep,
  // The native UI components, rendered directly by tests/jest/ui
  path.resolve(__dirname, '../../../../packages/ui/src') + path.sep,
]
const CONTRACTS_SRC = path.resolve(__dirname, '../../../../packages/contracts/src') + path.sep
const APP_ROOT = path.resolve(__dirname, '../..')

module.exports = (request, options) => {
  const isBarePackage = !request.startsWith('.') && !path.isAbsolute(request)
  const requestedFromPackageSrc = WORKSPACE_SOURCES.some(source => (options.basedir + path.sep).startsWith(source))

  // zod always comes from the contracts' own install: pnpm run puts the app's private hoist (.pnpm/node_modules)
  // on NODE_PATH, and a transitive zod 3 of Expo's tooling lives there, which has no z.looseObject
  const fromContracts = (options.basedir + path.sep).startsWith(CONTRACTS_SRC)
  if (isBarePackage && fromContracts && (request === 'zod' || request.startsWith('zod/'))) {
    return options.defaultResolver(request, options)
  }

  if (isBarePackage && requestedFromPackageSrc) {
    try {
      return options.defaultResolver(request, { ...options, basedir: APP_ROOT })
    } catch (error) {
      // Only what the app does not install resolves from where the source lives (zod, for the contracts)
      return options.defaultResolver(request, options)
    }
  }
  return options.defaultResolver(request, options)
}
