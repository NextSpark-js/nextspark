const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Force @nextsparkjs/ui to use the native entry point for consistent styling
// across web and native platforms (uses React Native primitives)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@nextsparkjs/ui") {
    // Resolve to the native entry point in node_modules
    const pkgPath = path.dirname(require.resolve("@nextsparkjs/ui/package.json"));
    const nativeEntry = path.join(pkgPath, "dist", "index.native.js");
    return {
      filePath: nativeEntry,
      type: "sourceFile",
    };
  }
  // Fall back to default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/styles/globals.css" });
