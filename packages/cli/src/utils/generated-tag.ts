import { createHash } from 'node:crypto';

/**
 * The marker `sync:app` and `init` put in each file they generate, naming the
 * core version that wrote it, the path it was written for, and a hash of the
 * rest of the file:
 *
 *   // @nextspark-generated core@0.1.0 path=app/layout.tsx sha256=<hash of everything but this line>
 *
 * The path is written as a JSON string when writing it plain would make the line
 * unreadable - a space would end it early, and a `*\/` would close a CSS tag's
 * comment before the line does:
 *
 *   // @nextspark-generated core@0.1.0 path="app/(marketing site)/page.tsx" sha256=<hash>
 *
 * It is the file's first line, or its second when the first is a shebang. While
 * the file sits at that path and the hash matches, the file is core's to update.
 * Once the hash doesn't match, the project changed the file and sync leaves it
 * alone; deleting the line hands the file over the same way. A copy of the file
 * at any other path is the project's: the tag says where core wrote it.
 */
export const GENERATED_TAG = '@nextspark-generated';

export type TagStyle = 'line' | 'block';

/**
 * The tag line. The path runs up to the ` sha256=` that ends it, so a path
 * written plain reads back whole however many spaces it has - which is also how
 * tags written before paths were quoted read. Tags written before the path was
 * recorded at all have no `path=`.
 */
const TAG_LINE = /^(?:\/\/|\/\*) @nextspark-generated core@(\S+)(?: path=(.+?))? sha256=([0-9a-f]{64})(?: \*\/)?$/;

/** A path the tag line carries as it is: nothing in it needs escaping to read back. */
const PLAIN_PATH = /^[^\s"\\\u0000-\u001f\u007f]+$/;

/**
 * The path as the tag line carries it: plain, or as a JSON string when plain
 * would be unreadable. `*\/` is escaped as `*\\/`, which JSON reads as `*\/`
 * and a CSS block comment doesn't close on.
 */
function encodeTagPath(path: string): string {
  if (PLAIN_PATH.test(path) && !path.includes('*/')) return path;
  return JSON.stringify(path).replace(/\*\//g, '*\\/');
}

/** The path a tag line carries, or null when it carries one that can't be read. */
function decodeTagPath(encoded: string): string | null {
  if (!encoded.startsWith('"')) return encoded;
  try {
    const path: unknown = JSON.parse(encoded);
    return typeof path === 'string' ? path : null;
  } catch {
    return null;
  }
}

const UTF8 = new TextDecoder('utf-8', { fatal: true });

/** The control bytes text files carry: tab, line feed, form feed and carriage return. */
const TEXT_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0c, 0x0d]);

/**
 * Whether content is text: valid UTF-8, carrying no control byte beyond the ones
 * text uses. Bytes NUL apart still make content nobody writes as source, and a
 * comment line prepended to it would alter a file core has no business tagging.
 */
export function isText(content: Buffer): boolean {
  for (const byte of content) {
    if (byte === 0x7f || (byte < 0x20 && !TEXT_CONTROL_BYTES.has(byte))) return false;
  }
  try {
    UTF8.decode(content);
    return true;
  } catch {
    return false;
  }
}

/**
 * How a file carries the tag: a line comment in JavaScript and TypeScript, a
 * block comment in CSS. Other files - JSON, Markdown, whose first line is
 * content, and anything that isn't text whatever its extension - carry none and
 * are recognised by comparing content instead.
 *
 * A comment is not a statement, so a 'use client' or 'use server' directive
 * right below the tag is still the file's directive.
 */
export function tagStyleFor(path: string, content?: Buffer): TagStyle | null {
  if (content !== undefined && !isText(content)) return null;
  if (/\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)) return 'line';
  if (path.endsWith('.css')) return 'block';
  return null;
}

/**
 * Text with CRLF line endings turned into LF. The hash covers this rather than
 * the bytes on disk: a Windows checkout with core.autocrlf rewrites every line
 * ending, and a hash of the raw bytes would make every generated file there look
 * changed by the project, so none would be updated again.
 */
function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

/** The hash a tag records for the rest of the file. */
export function generatedHash(content: Buffer | string): string {
  return createHash('sha256').update(normalizeLineEndings(content.toString())).digest('hex');
}

/** Whether two text files are the same once line endings are normalized. */
export function sameText(a: Buffer, b: Buffer): boolean {
  return normalizeLineEndings(a.toString('utf-8')) === normalizeLineEndings(b.toString('utf-8'));
}

/** How many characters a shebang line takes at the start of `text`, its line ending included; 0 without one. */
function shebangLength(text: string): number {
  if (!text.startsWith('#!')) return 0;
  const newline = text.indexOf('\n');
  return newline === -1 ? text.length : newline + 1;
}

/**
 * `content` with the tag for `path` and `coreVersion` on a line of its own:
 * right after a shebang, which has to stay the first line, or at the top.
 * Content with no tag style, or that is only a shebang, is returned unchanged.
 */
export function withGeneratedTag(path: string, content: Buffer, coreVersion: string): Buffer {
  const style = tagStyleFor(path, content);
  if (!style) return content;

  const text = content.toString('utf-8');
  const head = shebangLength(text);
  if (head === text.length && head > 0 && !text.endsWith('\n')) return content;

  const marker = `${GENERATED_TAG} core@${coreVersion} path=${encodeTagPath(path)} sha256=${generatedHash(content)}`;
  const line = style === 'line' ? `// ${marker}` : `/* ${marker} */`;
  return Buffer.from(`${text.slice(0, head)}${line}\n${text.slice(head)}`);
}

export interface GeneratedTag {
  /** The core version that wrote the file. */
  coreVersion: string;
  /** The path the file was generated for, or null for a tag written before paths were recorded. */
  path: string | null;
  /** The file without the tag line. */
  body: Buffer;
  /** Whether the file without the tag line still hashes to what the tag recorded. */
  intact: boolean;
}

/** The tag on a file's first line - or second, after a shebang - or null when there is none. */
export function readGeneratedTag(content: Buffer): GeneratedTag | null {
  if (!isText(content)) return null;

  const text = content.toString('utf-8');
  const head = shebangLength(text);
  const newline = text.indexOf('\n', head);
  const tagLine = text.slice(head, newline === -1 ? text.length : newline).replace(/\r$/, '');
  const match = TAG_LINE.exec(tagLine);
  if (!match) return null;

  // A tag whose path can't be read is not one this version wrote, so it claims no file
  const path = match[2] === undefined ? null : decodeTagPath(match[2]);
  if (match[2] !== undefined && path === null) return null;

  const body = Buffer.from(text.slice(0, head) + (newline === -1 ? '' : text.slice(newline + 1)));
  return { coreVersion: match[1], path, body, intact: generatedHash(body) === match[3] };
}

/**
 * The tag of the file at `path`: null when the file has none, and also when its
 * tag names another path, since a copy of a generated file is the project's
 * wherever it lands. A tag with no path is returned as it is; the caller decides
 * how far to trust it.
 */
export function readGeneratedTagAt(path: string, content: Buffer): GeneratedTag | null {
  const tag = readGeneratedTag(content);
  return tag && (tag.path === null || tag.path === path) ? tag : null;
}
