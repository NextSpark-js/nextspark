import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Detects the core package location
 * Priority:
 * 1. node_modules/@nextsparkjs/core (npm mode)
 * 2. ../../packages/core relative to cli (monorepo mode)
 */
export function getCoreDir(): string {
  const cwd = process.cwd();

  // Option 1: npm mode - look in node_modules
  const npmCorePath = resolve(cwd, 'node_modules', '@nextsparkjs', 'core');
  if (existsSync(npmCorePath)) {
    return npmCorePath;
  }

  // Option 2: monorepo mode - look relative to cli package
  // From packages/cli/dist/utils, go up to packages/core
  const monorepoCorePath = resolve(__dirname, '..', '..', '..', '..', 'core');
  if (existsSync(monorepoCorePath)) {
    return monorepoCorePath;
  }

  // Option 3: monorepo mode - look relative to cwd
  // If running from apps/dev, look in ../../packages/core
  const cwdMonorepoCorePath = resolve(cwd, '..', '..', 'packages', 'core');
  if (existsSync(cwdMonorepoCorePath)) {
    return cwdMonorepoCorePath;
  }

  throw new Error(
    'Could not find @nextsparkjs/core. Make sure it is installed as a dependency ' +
    'or you are running from within the monorepo.'
  );
}

/**
 * Gets the path to a core script
 */
export function getCoreScriptPath(scriptName: string): string {
  const coreDir = getCoreDir();
  return resolve(coreDir, 'scripts', `${scriptName}.js`);
}

/**
 * Gets the current working directory (where the CLI is being run from)
 */
export function getProjectRoot(): string {
  return process.cwd();
}

/**
 * Checks if we are running in monorepo mode
 */
export function isMonorepoMode(): boolean {
  const cwd = process.cwd();
  const npmCorePath = resolve(cwd, 'node_modules', '@nextsparkjs', 'core');
  return !existsSync(npmCorePath);
}

/**
 * Resolve the ai-workflow package path.
 * Checks node_modules first, then monorepo workspace.
 */
export function getAIWorkflowDir(): string | null {
  const cwd = process.cwd();

  // Check node_modules (consumer project — flat or workspace root)
  const nmPath = join(cwd, 'node_modules', '@nextsparkjs', 'ai-workflow');
  if (existsSync(nmPath)) return nmPath;

  // Check web/node_modules (monorepo with hoisted deps in web/)
  const webNmPath = join(cwd, 'web', 'node_modules', '@nextsparkjs', 'ai-workflow');
  if (existsSync(webNmPath)) return webNmPath;

  // Check monorepo workspace (packages/ai-workflow relative to project root)
  const monoPath = join(cwd, 'packages', 'ai-workflow');
  if (existsSync(monoPath)) return monoPath;

  return null;
}
