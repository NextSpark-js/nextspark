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
  unsafeWritePlaces(projectRoot: string, written?: readonly string[]): UnsafeWritePlace[];
  unsafeWritePlacesLines(unsafe: UnsafeWritePlace[]): string[];
  BACKUPS_GITIGNORE: string;
  REGISTRIES_GITIGNORE: string;
  ownGitignoreState(projectRoot: string, path: string): OwnGitignoreState;
  ensureBackupsGitignore(projectRoot: string): Promise<boolean>;
}

const WRITE_PLACES_MODULE = join('scripts', 'build', 'registry', 'write-places.mjs');
const OWN_GITIGNORES_MODULE = join('scripts', 'build', 'registry', 'post-build', 'own-gitignores.mjs');

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
  };
}
