import { constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { loadCoreProjectFiles, type ProjectFiles } from './core-write-places.js';
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

/** The files among `names` in `dir`, by name. A directory with one of the names is no file, and is left to the check for what is in the way. */
function readNamedFiles(dir: string, names: readonly string[]): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const name of names) {
    const path = join(dir, name);
    if (existsSync(path) && statSync(path).isFile()) files.set(name, readFileSync(path));
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
    projectApp: readTree(join(projectRoot, 'src', 'app')),
    rootTemplates: readNamedFiles(join(coreDir, 'templates'), [...ROOT_TEMPLATE_FILES, 'proxy.ts']),
    projectRootFiles: readNamedFiles(projectRoot, [...ROOT_TEMPLATE_FILES, 'proxy.ts', 'middleware.ts']),
    usePprVariants: usesCacheComponents(projectRoot) && (nextMajor ?? 0) >= 16,
    nextMajor,
    state: readSyncState(projectRoot),
    overwrite: new Set(overwrite.map(toPlanPath)),
  };
}

/**
 * Write and remove what a plan says, and nothing else. A file an action marks
 * for backup is first copied, at its path from the project root, into a
 * directory under `backupsRoot` that belongs to this run alone - the time, and
 * a suffix no other run gets - created when the first file is backed up. A
 * backup is never written over.
 *
 * @returns The paths that were backed up, and the directory they went to (null when none was).
 */
export function applySyncPlan(
  projectRoot: string,
  actions: readonly SyncAction[],
  backupsRoot: string,
  files: ProjectFiles
): { backedUp: string[]; backupDir: string | null } {
  const backedUp: string[] = [];
  let backupDir: string | null = null;

  for (const action of actions) {
    const target = join(projectRoot, action.path);

    if (action.backup && existsSync(target)) {
      if (backupDir === null) {
        files.mkdirSync(backupsRoot, { recursive: true });
        backupDir = files.mkdtempSync(join(backupsRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-`));
      }
      const backupPath = join(backupDir, action.path);
      files.mkdirSync(dirname(backupPath), { recursive: true });
      files.copyFileSync(target, backupPath, constants.COPYFILE_EXCL);
      backedUp.push(action.path);
    }

    if ((action.kind === 'create' || action.kind === 'update' || action.kind === 'adopt') && action.content) {
      files.mkdirSync(dirname(target), { recursive: true });
      files.writeFileSync(target, action.content);
    } else if (action.kind === 'delete') {
      files.rmSync(target, { force: true });
    }
  }

  return { backedUp, backupDir };
}

/**
 * Tag the files a new project got from core that are identical to what
 * sync:app writes, and record them as this machine's last sync. Run once the
 * project's own changes to those files are done, so that what is tagged is what
 * the project starts from.
 *
 * @returns How many files were tagged.
 */
export async function tagGeneratedFiles(coreDir: string, projectRoot: string): Promise<number> {
  const files = await loadCoreProjectFiles(coreDir, projectRoot);
  const input = readSyncInput(coreDir, projectRoot);
  const actions = planSync(input);
  const adopted = actions.filter(({ kind }) => kind === 'adopt');

  applySyncPlan(projectRoot, adopted, '', files);
  writeSyncState(projectRoot, nextSyncState(actions, input), files);

  return adopted.length;
}
