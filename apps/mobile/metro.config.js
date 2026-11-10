const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the shared packages from monorepo
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/ui'),
  path.resolve(monorepoRoot, 'packages/mobile'),
  path.resolve(monorepoRoot, 'packages/contracts'),
];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// One copy of what holds state or native bindings. packages/ui and packages/mobile are bundled
// from source, and each has its own node_modules (react, react-native, expo, react-query): Metro
// resolves from the importing file's directory first, so their imports would load a second React
// next to the app's, and the first hook fails with "Cannot read property 'useState' of null".
const SINGLETONS = /^(react|react-dom|react-native(-[^/]+)?|expo|expo-[^/]+|@expo\/[^/]+|@preeternal\/[^/]+|@tanstack\/[^/]+)(\/|$)/;
const APP_ORIGIN = path.join(projectRoot, 'index.js');

// Resolve @nextsparkjs packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETONS.test(moduleName) && !context.originModulePath.startsWith(path.join(projectRoot, 'node_modules'))) {
    try {
      return context.resolveRequest({ ...context, originModulePath: APP_ORIGIN }, moduleName, platform);
    } catch {
      // not a dependency of the app: resolve it the usual way
    }
  }
  // For @nextsparkjs/ui, redirect to the native source (for development,
  // same as @nextsparkjs/mobile below) so bundling never depends on a
  // `packages/ui` build having run first
  if (moduleName === '@nextsparkjs/ui') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'packages/ui/src/index.native.ts'
      ),
      type: 'sourceFile',
    };
  }
  // For @nextsparkjs/mobile, redirect to the source (for development)
  if (moduleName === '@nextsparkjs/mobile') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'packages/mobile/src/index.ts'
      ),
      type: 'sourceFile',
    };
  }
  // For @project/contracts (the API contracts nextspark prepare generates from
  // apps/dev's entities), redirect to the source. It imports zod and nothing else.
  if (moduleName === '@project/contracts') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'packages/contracts/src/index.ts'
      ),
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/styles/globals.css' });
