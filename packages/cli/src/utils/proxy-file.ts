import { join } from 'node:path';
import fs from 'fs-extra';
import { getNextMajorVersion } from './next-bundler.js';

/**
 * Write the request-interception file under the name the project's Next.js
 * actually looks for.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`. Copying the template under its
 * own name is right for 16 and silently wrong for 15, whose loader only knows
 * `middleware` (MIDDLEWARE_FILENAME): the file lands in the project, nothing
 * ever loads it, and the app runs with no route protection and none of the
 * `x-user-id` / `x-pathname` headers downstream layouts read. Nothing fails —
 * which is what makes it worth spelling out here.
 *
 * The template exports `proxy`; Next 15 expects that function to be called
 * `middleware`, so the export is renamed along with the file.
 */

/** What Next calls this file, per major version. */
export function proxyFileNameFor(nextMajor: number | null): 'proxy.ts' | 'middleware.ts' {
  // Unknown version: keep the template's own name rather than rewriting it.
  if (nextMajor === null) return 'proxy.ts';
  return nextMajor >= 16 ? 'proxy.ts' : 'middleware.ts';
}

/** Rename the exported function to match the file Next will load. */
export function adaptProxySource(source: string, fileName: string): string {
  if (fileName !== 'middleware.ts') return source;

  return source
    .replace(/export\s+async\s+function\s+proxy\s*\(/, 'export async function middleware(')
    .replace(/export\s+function\s+proxy\s*\(/, 'export function middleware(');
}

/**
 * The tag the template carries, and the project's way of taking the file over:
 * delete the line and sync stops replacing it.
 */
const GENERATED_TAG = '@nextspark-generated';

/**
 * Whether a file in the project is NextSpark's to replace.
 *
 * `middleware.ts` is the conventional Next file name, so a project may well
 * have its own there. Overwriting or deleting it is silent code loss, and this
 * runs unattended: core's postinstall calls `sync:app --force`.
 *
 * The tag is what makes a release able to ship changes to this file at all:
 * matching the current template byte for byte would freeze anything an earlier
 * release generated, since it no longer equals what ships today.
 */
async function isGeneratedFile(path: string, source: string): Promise<boolean> {
  if (!await fs.pathExists(path)) return false;

  const existing = await fs.readFile(path, 'utf-8');
  if (existing.includes(GENERATED_TAG)) return true;

  // A file from a release that predates the tag: only recognisable by being
  // exactly what that template produced.
  return existing === adaptProxySource(source, 'proxy.ts')
    || existing === adaptProxySource(source, 'middleware.ts');
}

export interface ProxyFileResult {
  /** The file name that Next will load for this project. */
  fileName: 'proxy.ts' | 'middleware.ts';
  /** False when the project's own file was left in place instead. */
  written: boolean;
  /** Files left alone because their content is not ours to replace. */
  preserved: string[];
}

/**
 * Copy the template's proxy.ts into the project under the right name, removing
 * the other spelling so a project that changed Next major does not end up with
 * both files.
 *
 * Anything that does not match the template verbatim is left where it is: it
 * belongs to the project, and this reports it so the caller can say so.
 *
 * @param templatesDir - The core package's templates directory.
 * @param projectRoot - Where the file should land.
 * @returns What happened, or null when the template has no proxy.ts.
 */
export async function writeProxyFile(
  templatesDir: string,
  projectRoot: string
): Promise<ProxyFileResult | null> {
  const sourcePath = join(templatesDir, 'proxy.ts');
  if (!await fs.pathExists(sourcePath)) return null;

  const fileName = proxyFileNameFor(getNextMajorVersion(projectRoot));
  const source = await fs.readFile(sourcePath, 'utf-8');
  const preserved: string[] = [];

  const targetPath = join(projectRoot, fileName);
  const targetIsOurs = !await fs.pathExists(targetPath) || await isGeneratedFile(targetPath, source);

  if (targetIsOurs) {
    await fs.writeFile(targetPath, adaptProxySource(source, fileName), 'utf-8');
  } else {
    preserved.push(fileName);
  }

  const stale = fileName === 'proxy.ts' ? 'middleware.ts' : 'proxy.ts';
  const stalePath = join(projectRoot, stale);
  if (await fs.pathExists(stalePath)) {
    if (await isGeneratedFile(stalePath, source)) {
      await fs.remove(stalePath);
    } else {
      preserved.push(stale);
    }
  }

  return { fileName, written: targetIsOurs, preserved };
}
