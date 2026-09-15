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

const PACKAGE_MOBILE_SRC = path.resolve(__dirname, '../../../../packages/mobile/src') + path.sep
const APP_ROOT = path.resolve(__dirname, '../..')

module.exports = (request, options) => {
  const isBarePackage = !request.startsWith('.') && !path.isAbsolute(request)
  const requestedFromPackageSrc = (options.basedir + path.sep).startsWith(PACKAGE_MOBILE_SRC)

  if (isBarePackage && requestedFromPackageSrc) {
    return options.defaultResolver(request, { ...options, basedir: APP_ROOT })
  }
  return options.defaultResolver(request, options)
}
