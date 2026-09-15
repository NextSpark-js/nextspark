import { createHash } from 'node:crypto';

/**
 * The marker `sync:app` and `init` put on the first line of each file they
 * generate, with the core version that wrote it and a hash of the rest of the
 * file:
 *
 *   // @nextspark-generated core@0.1.0 sha256=<hash of everything below this line>
 *
 * While the hash matches, the file is core's to update. Once it doesn't, the
 * project changed the file and sync leaves it alone; deleting the line hands
 * the file over the same way.
 */
export const GENERATED_TAG = '@nextspark-generated';

export type TagStyle = 'line' | 'block';

const TAG_LINE = /^(?:\/\/|\/\*) @nextspark-generated core@(\S+) sha256=([0-9a-f]{64})(?: \*\/)?$/;

/**
 * How a file carries the tag: a line comment in JavaScript and TypeScript, a
 * block comment in CSS. Other files - binaries, JSON, Markdown, whose first line
 * is content - carry none and are recognised by comparing content instead.
 *
 * A comment is not a statement, so a 'use client' or 'use server' directive
 * right below the tag is still the file's directive.
 */
export function tagStyleFor(path: string): TagStyle | null {
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)) return 'line';
  if (path.endsWith('.css')) return 'block';
  return null;
}

/** Text with CRLF line endings turned into LF, so a checkout's line-ending setting doesn't change a hash. */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** The hash a tag records for the content below it. */
export function generatedHash(content: Buffer | string): string {
  return createHash('sha256').update(normalizeLineEndings(content.toString())).digest('hex');
}

/** Whether two text files are the same once line endings are normalized. */
export function sameText(a: Buffer, b: Buffer): boolean {
  return normalizeLineEndings(a.toString('utf-8')) === normalizeLineEndings(b.toString('utf-8'));
}

/** `content` with the tag for `coreVersion` on a line of its own above it; unchanged for a file with no tag style. */
export function withGeneratedTag(path: string, content: Buffer, coreVersion: string): Buffer {
  const style = tagStyleFor(path);
  if (!style) return content;

  const marker = `${GENERATED_TAG} core@${coreVersion} sha256=${generatedHash(content)}`;
  const line = style === 'line' ? `// ${marker}` : `/* ${marker} */`;
  return Buffer.concat([Buffer.from(`${line}\n`), content]);
}

export interface GeneratedTag {
  /** The core version that wrote the file. */
  coreVersion: string;
  /** The file below the tag line. */
  body: Buffer;
  /** Whether the file below the tag still hashes to what the tag recorded. */
  intact: boolean;
}

/** The tag on a file's first line, or null when the first line is not one. */
export function readGeneratedTag(content: Buffer): GeneratedTag | null {
  const text = content.toString('utf-8');
  const newline = text.indexOf('\n');
  const firstLine = (newline === -1 ? text : text.slice(0, newline)).replace(/\r$/, '');
  const match = TAG_LINE.exec(firstLine);
  if (!match) return null;

  const body = Buffer.from(newline === -1 ? '' : text.slice(newline + 1));
  return { coreVersion: match[1], body, intact: generatedHash(body) === match[2] };
}
