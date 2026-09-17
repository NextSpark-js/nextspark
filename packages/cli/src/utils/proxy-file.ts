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
 * The comment the proxy.ts template opened with in 0.1.0-beta.189, the one
 * release that marked it this way, and so every file generated from it:
 * `/**`, then ` * @nextspark-generated` on the next line. The bare tag counts
 * only there. Anywhere else in a file it is text in the project's own code.
 */
const PUBLISHED_TAG_HEADER = /^\/\*\*\r?\n \* @nextspark-generated\r?\n/;

/**
 * Whether a file in the project is NextSpark's to replace, judged the way
 * releases before the generated tag with a hash marked it.
 *
 * `middleware.ts` is the conventional Next file name, so a project may well
 * have its own there. Overwriting or deleting it is silent code loss, and this
 * runs unattended: core's postinstall calls `sync:app --force`.
 */
export function isGeneratedProxySource(existing: string, source: string): boolean {
  if (PUBLISHED_TAG_HEADER.test(existing)) return true;

  // A file from a release that predates the tag: only recognisable by being
  // exactly what that template produced.
  return existing === adaptProxySource(source, 'proxy.ts')
    || existing === adaptProxySource(source, 'middleware.ts');
}

export type ProxyFileName = 'proxy.ts' | 'middleware.ts';

export interface ProxyFilePlan {
  /** The file name that Next will load for this project. */
  fileName: ProxyFileName;
  /** What to write under that name, or null when the project's own file stays. */
  content: string | null;
  /** The other spelling, when the project has it and it is ours to remove. */
  remove: ProxyFileName | null;
  /** Files left alone because their content is not ours to replace. */
  preserved: ProxyFileName[];
}

/**
 * Decide what the project's request-interception file becomes: the template
 * under the name the project's Next loads, with the other spelling removed so a
 * project that changed Next major does not end up with both. A file that is not
 * ours stays where it is and is listed in `preserved`, so the caller can say so.
 *
 * @param source - The template's proxy.ts.
 * @param nextMajor - The project's Next major version, or null when unknown.
 * @param existing - The project's current proxy.ts and middleware.ts, when present.
 */
export function planProxyFile(
  source: string,
  nextMajor: number | null,
  existing: Partial<Record<ProxyFileName, string>>
): ProxyFilePlan {
  const fileName = proxyFileNameFor(nextMajor);
  const preserved: ProxyFileName[] = [];

  const current = existing[fileName];
  const targetIsOurs = current === undefined || isGeneratedProxySource(current, source);
  if (!targetIsOurs) preserved.push(fileName);

  const stale: ProxyFileName = fileName === 'proxy.ts' ? 'middleware.ts' : 'proxy.ts';
  const staleContent = existing[stale];
  let remove: ProxyFileName | null = null;
  if (staleContent !== undefined) {
    if (isGeneratedProxySource(staleContent, source)) {
      remove = stale;
    } else {
      preserved.push(stale);
    }
  }

  return { fileName, content: targetIsOurs ? adaptProxySource(source, fileName) : null, remove, preserved };
}
