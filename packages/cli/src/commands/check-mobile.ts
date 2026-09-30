import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import chalk from '../utils/colors.js';
import { getCoreDir } from '../utils/paths.js';
import { readCoreVersion } from '../utils/core-write-places.js';
import { readPackageEntries } from '../wizard/generators/workspace-yaml.js';

export interface CheckMobileOptions {
  /** The mobile app's directory from the workspace root; found from the workspace when not given. */
  mobile?: string;
}

export interface CheckMobileResult {
  code: number;
  lines: string[];
}

interface BoundaryModule {
  checkMobileBoundary(options: { repoRoot: string; trees: unknown; manifests: unknown; serverPaths: unknown }): {
    violations: { file: string; specifier: string; reason: string; chain: string[] }[];
    filesChecked: number;
  };
  describeViolations(violations: unknown[]): string[];
  projectLayout(options: { mobileDir: string; webDir: string }): { trees: unknown; manifests: unknown; serverPaths: unknown };
}

/** The mobile boundary check ships in core: scripts/build/mobile-boundary.mjs. */
const BOUNDARY_MODULE = join('scripts', 'build', 'mobile-boundary.mjs');

/**
 * Every directory above `from` (not `from` itself, the web project) that holds a pnpm-workspace.yaml, nearest first. The walk
 * ends at the repository root (the first directory with a .git): a workspace outside the repository is not this project's.
 */
function findWorkspaceRoots(from: string): string[] {
  const roots: string[] = [];
  if (existsSync(join(resolve(from), '.git'))) return roots;
  for (let dir = dirname(resolve(from)); ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) roots.push(dir);
    if (existsSync(join(dir, '.git')) || dirname(dir) === dir) return roots;
  }
}

/** The workspace packages that are a mobile app: an Expo app, or one that depends on @nextsparkjs/mobile. */
function findMobileDirs(workspaceRoot: string): string[] {
  const entries = readPackageEntries(readFileSync(join(workspaceRoot, 'pnpm-workspace.yaml'), 'utf-8'));
  return entries.filter((entry) => {
    if (/[*!]/.test(entry)) return false;
    try {
      const manifest = JSON.parse(readFileSync(join(workspaceRoot, entry, 'package.json'), 'utf-8'));
      return ['dependencies', 'devDependencies'].some((field) => manifest[field]?.expo || manifest[field]?.['@nextsparkjs/mobile']);
    } catch {
      return false;
    }
  });
}

/**
 * Check that the workspace's mobile app imports portable code only (the contracts, `@nextsparkjs/ui`, `@nextsparkjs/mobile`,
 * React Native packages) and never the web project's server code, the database or a Node built-in, with the check the
 * installed core ships. Run from the web project, whose directory is the server code the mobile app must not reach.
 */
export async function runMobileCheck(cwd: string, coreDir: string, options: CheckMobileOptions = {}): Promise<CheckMobileResult> {
  // A web host may have its own pnpm-workspace.yaml (a separate Vercel root) inside the workspace that lists the mobile app:
  // the nearest one that holds the mobile app (the named one, or an app the workspace lists) is the workspace
  const roots = findWorkspaceRoots(cwd);
  const named = (root: string): string | null => {
    const value = options.mobile?.replace(/\/+$/, '');
    if (!value) return null;
    const inside = isAbsolute(value) ? relative(root, value).split('\\').join('/') : value;
    return inside === '' || inside.startsWith('..') ? null : inside;
  };
  const workspaceRoot = roots.find((root) => (options.mobile ? (named(root) !== null && existsSync(join(root, named(root) as string))) : findMobileDirs(root).length > 0)) ?? roots[0];
  const webDir = workspaceRoot ? relative(workspaceRoot, resolve(cwd)).split('\\').join('/') : '';
  if (!workspaceRoot && existsSync(join(resolve(cwd), '.git')) && (existsSync(join(resolve(cwd), 'mobile', 'package.json')) || (existsSync(join(resolve(cwd), 'pnpm-workspace.yaml')) && findMobileDirs(resolve(cwd)).length > 0))) {
    return { code: 1, lines: ['check:mobile needs the web project and the mobile app side by side (web/ and mobile/ under one workspace); here the mobile app is inside the web project.'] };
  }
  if (!workspaceRoot || webDir === '' || webDir.startsWith('..')) {
    return { code: 1, lines: ['Run check:mobile from the web project of a web+mobile workspace (a pnpm-workspace.yaml above it lists the mobile app).'] };
  }

  // A path from the workspace root; an absolute one inside it is taken as that, one outside is refused
  let mobileDir = options.mobile?.replace(/\/+$/, '');
  if (mobileDir && isAbsolute(mobileDir)) {
    const inside = named(workspaceRoot);
    if (inside === null) return { code: 1, lines: [`--mobile ${mobileDir} is not inside the workspace ${workspaceRoot}.`] };
    mobileDir = inside;
  }
  if (!mobileDir) {
    const found = findMobileDirs(workspaceRoot);
    if (found.length !== 1) {
      return {
        code: 1,
        lines: [found.length === 0 ? 'No mobile app in the workspace: pnpm-workspace.yaml lists no package that depends on expo or @nextsparkjs/mobile.' : `More than one mobile app in the workspace (${found.join(', ')}): name one with --mobile <dir>.`],
      };
    }
    mobileDir = found[0];
  }
  if (!existsSync(join(workspaceRoot, mobileDir))) return { code: 1, lines: [`The mobile app ${mobileDir}/ does not exist in ${workspaceRoot}.`] };

  const modulePath = join(coreDir, BOUNDARY_MODULE);
  if (!existsSync(modulePath)) {
    return { code: 1, lines: [`@nextsparkjs/core ${readCoreVersion(coreDir)} does not ship the mobile boundary check (${BOUNDARY_MODULE}).`, 'Install the @nextsparkjs/core that matches @nextsparkjs/cli.'] };
  }
  const boundary = (await import(pathToFileURL(modulePath).href)) as BoundaryModule;
  const layout = boundary.projectLayout({ mobileDir, webDir });
  const { violations, filesChecked } = boundary.checkMobileBoundary({ repoRoot: workspaceRoot, ...layout });
  if (violations.length > 0) {
    return {
      code: 1,
      lines: [`Mobile boundary: ${violations.length} violation(s). ${mobileDir}/ may import portable contracts and design primitives only.`, ...boundary.describeViolations(violations).map((line) => `  ${line}`)],
    };
  }
  return { code: 0, lines: [`Mobile boundary: ${filesChecked} files checked in ${mobileDir}/, nothing imports server code, the database, the registries, migrations or Node-only modules.`] };
}

export async function checkMobileCommand(options: CheckMobileOptions): Promise<void> {
  let result: CheckMobileResult;
  try {
    result = await runMobileCheck(process.cwd(), getCoreDir(), options);
  } catch (error) {
    result = { code: 1, lines: [error instanceof Error ? error.message : String(error)] };
  }
  for (const line of result.lines) (result.code === 0 ? console.log(chalk.green(line)) : console.error(chalk.red(line)));
  if (result.code !== 0) process.exit(result.code);
}
