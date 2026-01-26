const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the shared packages from monorepo
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/types'),
  path.resolve(monorepoRoot, 'packages/ui'),
];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve @nextsparkjs packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // For @nextsparkjs/ui, redirect to the native entry point
  if (moduleName === '@nextsparkjs/ui') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'packages/ui/dist/index.native.js'
      ),
      type: 'sourceFile',
    };
  }
  // For @nextsparkjs/types, redirect to the dist entry point
  if (moduleName === '@nextsparkjs/types') {
    return {
      filePath: path.resolve(
        monorepoRoot,
        'packages/types/dist/index.js'
      ),
      type: 'sourceFile',
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/styles/globals.css' });
