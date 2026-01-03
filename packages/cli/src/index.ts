/**
 * @nextsparkjs/cli
 *
 * CLI for NextSpark - Professional SaaS Boilerplate
 *
 * Commands:
 * - nextspark dev         - Start development server with registry watcher
 * - nextspark build       - Build for production
 * - nextspark generate    - Generate all registries
 * - nextspark registry:build  - Build registries
 * - nextspark registry:watch  - Watch and rebuild registries
 */

// Export commands for programmatic usage
export { devCommand } from './commands/dev.js';
export { buildCommand } from './commands/build.js';
export { generateCommand } from './commands/generate.js';
export { registryBuildCommand, registryWatchCommand } from './commands/registry.js';

// Export utilities
export { getCoreDir, getCoreScriptPath, getProjectRoot, isMonorepoMode } from './utils/paths.js';
