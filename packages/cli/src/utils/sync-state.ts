import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What the last `sync:app` on this machine saw, in `.nextspark/`. `sync:app` is
 * gone (removed in 0.1.0-beta.192), but projects it managed still carry this
 * record, and `nextspark migrate` reads it - never writes it - as evidence of
 * which src/app files were core's untouched output.
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
