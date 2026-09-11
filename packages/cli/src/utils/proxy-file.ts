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
 * Copy the template's proxy.ts into the project under the right name, removing
 * the other spelling so a project that changed Next major does not end up with
 * both files.
 *
 * @param templatesDir - The core package's templates directory.
 * @param projectRoot - Where the file should land.
 * @returns The file name written, or null when the template has no proxy.ts.
 */
export async function writeProxyFile(
  templatesDir: string,
  projectRoot: string
): Promise<string | null> {
  const sourcePath = join(templatesDir, 'proxy.ts');
  if (!await fs.pathExists(sourcePath)) return null;

  const fileName = proxyFileNameFor(getNextMajorVersion(projectRoot));
  const source = await fs.readFile(sourcePath, 'utf-8');

  await fs.writeFile(join(projectRoot, fileName), adaptProxySource(source, fileName), 'utf-8');

  const stale = fileName === 'proxy.ts' ? 'middleware.ts' : 'proxy.ts';
  await fs.remove(join(projectRoot, stale));

  return fileName;
}
