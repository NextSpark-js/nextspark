import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCoreVersion } from './sync-files.js';

export interface UnsafeWritePlace {
  path: string;
  problem: string;
}

/** What the .gitignore of .nextspark/backups or .nextspark/registries is, as core reads it. */
export type OwnGitignoreState = 'missing' | 'in place' | 'symlink' | 'not a file' | 'unreadable' | 'other';

/**
 * Core's check of where its registry build writes, and the .gitignore files it
 * keeps in .nextspark/backups and .nextspark/registries, from the core installed
 * in the project.
 */
export interface CoreWritePlaces {
  unsafeWritePlaces(projectRoot: string, written?: readonly string[], options?: { activeTheme?: string }): UnsafeWritePlace[];
  unsafeWritePlacesLines(unsafe: UnsafeWritePlace[]): string[];
  BACKUPS_GITIGNORE: string;
  REGISTRIES_GITIGNORE: string;
  ownGitignoreState(projectRoot: string, path: string): OwnGitignoreState;
  ensureBackupsGitignore(projectRoot: string): Promise<boolean>;
  /** The files git tracks under a directory of the project; none outside a repository or without git. */
  trackedFilesUnder(projectRoot: string, directory: string): string[];
  /** What to say when git tracks registries, one line each: the warning, then how to stop tracking them. */
  trackedRegistriesLines(count: number): string[];
}

/**
 * The calls through which what changes a project - core's generator and
 * sync:app - writes, creates directories, renames and removes, bound to a root:
 * core's `projectFiles`. Each refuses, throwing an error with the code
 * UNSAFE_WRITE before touching anything, a path outside the root, through a
 * symlink inside it, or into a file with other hard links. Paths are absolute,
 * or from the root.
 */
export interface ProjectFiles {
  readonly root: string;
  writeFileSync(path: string, data: string | Uint8Array, options?: BufferEncoding | { encoding?: BufferEncoding; flag?: 'w' | 'wx' }): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  mkdtempSync(prefix: string): string;
  copyFileSync(source: string, destination: string, mode?: number): void;
  rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  rmdirSync(path: string): void;
  unlinkSync(path: string): void;
  renameSync(from: string, to: string): void;
}

const WRITE_PLACES_MODULE = join('scripts', 'build', 'registry', 'write-places.mjs');
const OWN_GITIGNORES_MODULE = join('scripts', 'build', 'registry', 'post-build', 'own-gitignores.mjs');
const SAFE_FS_MODULE = join('scripts', 'build', 'safe-fs.mjs');

/**
 * Load core's check of the places its registry build writes under - the check
 * the build itself runs before writing - for a command that writes before the
 * build runs, or starts something alongside it, to run before its first step.
 * Taken from `coreDir`, the core the build runs from, so the command and the
 * build ask the same question.
 *
 * A core without the check is a core whose build doesn't run one either: this
 * throws, and the command stops before writing anything.
 */
export async function loadCoreWritePlaces(coreDir: string): Promise<CoreWritePlaces> {
  const writePlaces = join(coreDir, WRITE_PLACES_MODULE);
  const ownGitignores = join(coreDir, OWN_GITIGNORES_MODULE);
  if (!existsSync(writePlaces) || !existsSync(ownGitignores)) {
    throw new Error(
      `@nextsparkjs/core ${readCoreVersion(coreDir)} has no check of where its registry build writes, which this version of the CLI runs before writing. ` +
        'Install the @nextsparkjs/core that matches @nextsparkjs/cli.'
    );
  }
  const [places, gitignores] = await Promise.all([
    import(pathToFileURL(writePlaces).href),
    import(pathToFileURL(ownGitignores).href),
  ]);
  return {
    unsafeWritePlaces: places.unsafeWritePlaces,
    unsafeWritePlacesLines: places.unsafeWritePlacesLines,
    BACKUPS_GITIGNORE: gitignores.BACKUPS_GITIGNORE,
    REGISTRIES_GITIGNORE: gitignores.REGISTRIES_GITIGNORE,
    ownGitignoreState: gitignores.ownGitignoreState,
    ensureBackupsGitignore: gitignores.ensureBackupsGitignore,
    trackedFilesUnder: gitignores.trackedFilesUnder,
    trackedRegistriesLines: gitignores.trackedRegistriesLines,
  };
}

/**
 * The calls sync:app writes through in the project at `root`, from the core
 * installed there: the same ones core's generator writes through. A core
 * without them is one whose generator doesn't write that way either: this
 * throws, and the command stops before writing anything.
 */
export async function loadCoreProjectFiles(coreDir: string, root: string): Promise<ProjectFiles> {
  const safeFs = join(coreDir, SAFE_FS_MODULE);
  if (!existsSync(safeFs)) {
    throw new Error(
      `@nextsparkjs/core ${readCoreVersion(coreDir)} has no guarded way to write in a project, which this version of the CLI writes through. ` +
        'Install the @nextsparkjs/core that matches @nextsparkjs/cli.'
    );
  }
  const { projectFiles } = await import(pathToFileURL(safeFs).href);
  return projectFiles(root) as ProjectFiles;
}
