import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { parse } from 'dotenv';
import { getNextMajorVersion } from './next-bundler.js';
import { nextSyncState, planSync, ROOT_TEMPLATE_FILES, type SyncAction, type SyncInput } from './sync-plan.js';
import { readSyncState, writeSyncState } from './sync-state.js';

/** Names skipped on both sides of a sync. */
const IGNORED_NAMES = new Set(['.DS_Store', 'README.md']);

/**
 * Every file under a directory, keyed by its path relative to it with forward
 * slashes. Empty when the directory doesn't exist.
 */
export function readTree(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  if (!existsSync(root)) return files;

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORED_NAMES.has(entry.name)) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (entry.isFile()) {
        files.set(relative(root, path).split(sep).join('/'), readFileSync(path));
      }
    }
  };
  walk(root);

  return files;
}

function readNamedFiles(dir: string, names: readonly string[]): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const name of names) {
    const path = join(dir, name);
    if (existsSync(path)) files.set(name, readFileSync(path));
  }
  return files;
}

/** Whether the project turns on cacheComponents, which makes sync:app use PPR template variants on Next 16+. */
function usesCacheComponents(projectRoot: string): boolean {
  return ['next.config.mjs', 'next.config.js', 'next.config.ts'].some((name) => {
    const path = join(projectRoot, name);
    return existsSync(path) && /cacheComponents\s*:\s*true/.test(readFileSync(path, 'utf8'));
  });
}

function activeTheme(projectRoot: string, env: NodeJS.ProcessEnv): string | undefined {
  if (env.NEXT_PUBLIC_ACTIVE_THEME) return env.NEXT_PUBLIC_ACTIVE_THEME;
  const envPath = join(projectRoot, '.env');
  return existsSync(envPath) ? parse(readFileSync(envPath)).NEXT_PUBLIC_ACTIVE_THEME : undefined;
}

/** The version in core's package.json, or 'unknown'. */
export function readCoreVersion(coreDir: string): string {
  try {
    return JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf-8')).version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/** A path as sync:app plans it: from the project root, with forward slashes. */
export function toPlanPath(path: string): string {
  return path.split(sep).join('/').replace(/^\.\//, '');
}

export interface ReadSyncInputOptions {
  env?: NodeJS.ProcessEnv;
  /** Customized files to replace with core's version, from the project root. */
  overwrite?: readonly string[];
}

/** Read what planSync needs from core's templates, the project and the last sync on this machine. */
export function readSyncInput(coreDir: string, projectRoot: string, { env = process.env, overwrite = [] }: ReadSyncInputOptions = {}): SyncInput {
  const nextMajor = getNextMajorVersion(projectRoot);

  return {
    coreVersion: readCoreVersion(coreDir),
    appTemplates: readTree(join(coreDir, 'templates', 'app')),
    projectApp: readTree(join(projectRoot, 'app')),
    rootTemplates: readNamedFiles(join(coreDir, 'templates'), [...ROOT_TEMPLATE_FILES, 'proxy.ts']),
    projectRootFiles: readNamedFiles(projectRoot, [...ROOT_TEMPLATE_FILES, 'proxy.ts', 'middleware.ts']),
    usePprVariants: usesCacheComponents(projectRoot) && (nextMajor ?? 0) >= 16,
    nextMajor,
    activeTheme: activeTheme(projectRoot, env),
    state: readSyncState(projectRoot),
    overwrite: new Set(overwrite.map(toPlanPath)),
  };
}

/**
 * Write and remove what a plan says, and nothing else. A file an action marks
 * for backup is first copied under `backupDir`, at its path from the project root.
 *
 * @returns The paths that were backed up.
 */
export function applySyncPlan(projectRoot: string, actions: readonly SyncAction[], backupDir: string): string[] {
  const backedUp: string[] = [];

  for (const action of actions) {
    const target = join(projectRoot, action.path);

    if (action.backup && existsSync(target)) {
      const backupPath = join(backupDir, action.path);
      mkdirSync(dirname(backupPath), { recursive: true });
      copyFileSync(target, backupPath);
      backedUp.push(action.path);
    }

    if ((action.kind === 'create' || action.kind === 'update' || action.kind === 'adopt') && action.content) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, action.content);
    } else if (action.kind === 'delete') {
      rmSync(target, { force: true });
    }
  }

  return backedUp;
}

/**
 * Tag the files a new project got from core that are identical to what
 * sync:app writes, and record them as this machine's last sync. Run once the
 * project's own changes to those files are done, so that what is tagged is what
 * the project starts from.
 *
 * @returns How many files were tagged.
 */
export function tagGeneratedFiles(coreDir: string, projectRoot: string): number {
  const input = readSyncInput(coreDir, projectRoot);
  const actions = planSync(input);
  const adopted = actions.filter(({ kind }) => kind === 'adopt');

  applySyncPlan(projectRoot, adopted, '');
  writeSyncState(projectRoot, nextSyncState(actions, input));

  return adopted.length;
}
