import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * What the last `sync:app` on this machine saw, in `.nextspark/` - which
 * projects don't commit, so each machine keeps its own. For each file sync:app
 * manages it records the hash of core's version at the time and, for a file
 * that can't carry the generated tag, the hash of what sync left on disk.
 *
 * The first is how the report lists only the customized files core changed
 * since then. The second is how a file with no tag keeps receiving core's
 * changes while nobody has touched it since sync wrote it.
 */
export const SYNC_STATE_FILE = join('.nextspark', 'sync-state.json');

export interface SyncStateEntry {
  /** Hash of core's version of the file. */
  core: string;
  /** Hash of the file sync left on disk, for a file with no generated tag. */
  written?: string;
}

export interface SyncState {
  coreVersion: string;
  files: Record<string, SyncStateEntry>;
}

export function contentHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** The recorded state, or null when sync:app never ran on this machine or the file can't be read. */
export function readSyncState(projectRoot: string): SyncState | null {
  const path = join(projectRoot, SYNC_STATE_FILE);
  if (!existsSync(path)) return null;

  try {
    const state = JSON.parse(readFileSync(path, 'utf-8'));
    return state && typeof state.files === 'object' && state.files !== null ? state : null;
  } catch {
    return null;
  }
}

export function writeSyncState(projectRoot: string, state: SyncState): void {
  const path = join(projectRoot, SYNC_STATE_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}
