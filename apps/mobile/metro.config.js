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
];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve @nextsparkjs packages
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/styles/globals.css' });
