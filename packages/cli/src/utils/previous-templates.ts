import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The project files core's templates wrote that core may replace while they are unchanged: `src/proxy.ts` (or
 * `src/middleware.ts`) and `instrumentation.ts`. Up to 0.1.0-beta.197 both were full copies of core's code; they are
 * now facades over `@nextsparkjs/core/proxy` and `@nextsparkjs/core/instrumentation`.
 *
 * The installed core lists the sha256 of every earlier template in
 * scripts/build/registry/host/previous-templates.json, the list `nextspark prepare` uses too
 * (host/project-entries.mjs). A core without the list recognises nothing.
 */
export type TemplateKind = 'proxy.ts' | 'instrumentation.ts';

export type PreviousTemplates = Partial<Record<TemplateKind, string[]>>;

/** The previous-template hashes the core whose templates are in `templatesDir` ships, or none. */
export function readPreviousTemplates(templatesDir: string | null): PreviousTemplates {
  if (!templatesDir) return {};
  const file = join(templatesDir, '..', 'scripts', 'build', 'registry', 'host', 'previous-templates.json');
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const list = (kind: TemplateKind) => Array.isArray(parsed[kind]) ? (parsed[kind] as unknown[]).filter((hash): hash is string => typeof hash === 'string') : [];
    return { 'proxy.ts': list('proxy.ts'), 'instrumentation.ts': list('instrumentation.ts') };
  } catch {
    return {};
  }
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/**
 * Whether `content` is exactly an earlier `kind` template: as written, with CRLF line ends, or, for the proxy, with the
 * `middleware` export the Next 15 copy got. Same rule as core's host/project-entries.mjs `isPreviousTemplate`.
 */
export function isPreviousTemplate(kind: TemplateKind, content: string, previous: PreviousTemplates): boolean {
  const known = new Set(previous[kind] ?? []);
  if (known.size === 0) return false;
  const lf = content.replace(/\r\n/g, '\n');
  const candidates = [content, lf];
  if (kind === 'proxy.ts') {
    candidates.push(lf
      .replace(/export\s+async\s+function\s+middleware\s*\(/, 'export async function proxy(')
      .replace(/export\s+function\s+middleware\s*\(/, 'export function proxy('));
  }
  return candidates.some(candidate => known.has(sha256(candidate)));
}
