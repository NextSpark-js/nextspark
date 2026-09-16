import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * Ignore rules read the way git reads them, for deciding what a project's
 * .gitignore files keep out of git before anything is written: whether a
 * directory is ignored as a whole, what a line added at the end of the
 * .gitignore would change, and whether a rule could take back a directory
 * whose name is only known once it is created. Git can't be asked any of
 * these: it answers about paths, and only as the files stand.
 *
 * Paths and patterns are handled as git handles them, byte by byte: a string
 * here holds one byte per character (latin1), so `?` takes one byte of a UTF-8
 * name, as in git.
 */

/** One pattern of an ignore file, parsed as git's parse_path_pattern parses it. */
export interface IgnorePattern {
  /** The file it comes from, from the top of the repository, for naming it. */
  source: string;
  /** Its line in that file, from 1. */
  line: number;
  /** The line as git took it, for naming it. */
  text: string;
  /** The directory the file is in, from the top of the repository: '' or ending in '/'. */
  base: string;
  negative: boolean;
  /** A trailing slash: it only matches a directory. */
  mustBeDir: boolean;
  /** No slash but a trailing one: it matches a path's last segment, at any depth. */
  basenameOnly: boolean;
  /** The pattern without `!`, its trailing slash, and - when it is anchored - its leading slash. */
  body: string;
}

/**
 * Where git takes ignore rules from for a project: the .gitignore of each
 * directory, and the exclude files - info/exclude, then core.excludesFile.
 */
export interface IgnoreSources {
  /** Patterns of the .gitignore in each directory, by the directory from the top ('' or ending in '/'). */
  byDirectory: Map<string, IgnorePattern[]>;
  excludeFiles: IgnorePattern[][];
  /** core.ignorecase, or null when it is not known and both readings count. */
  ignoreCase: boolean | null;
}

const SLASH = 0x2f;

/** A line's pattern as git's trim_trailing_spaces leaves it: spaces at the end go, unless a backslash escapes the last. */
function trimTrailingSpaces(line: string): string {
  let lastSpace = -1;
  for (let index = 0; index < line.length; index++) {
    if (line[index] === ' ') {
      if (lastSpace === -1) lastSpace = index;
    } else {
      if (line[index] === '\\') index++;
      lastSpace = -1;
    }
  }
  return lastSpace === -1 ? line : line.slice(0, lastSpace);
}

/**
 * The patterns of an ignore file's content, one byte per character, as git's
 * add_patterns_from_buffer reads them: without a byte order mark at the start,
 * blank lines and comments, a line's closing carriage return, or its trailing
 * spaces.
 */
export function parseIgnoreFile(content: string, base: string, source: string): IgnorePattern[] {
  const patterns: IgnorePattern[] = [];
  const lines = content.replace(/^\xef\xbb\xbf/, '').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();

  lines.forEach((raw, index) => {
    if (raw === '' || raw.startsWith('#')) return;
    const text = trimTrailingSpaces(raw.replace(/\r$/, ''));
    let body = text;
    const negative = body.startsWith('!');
    if (negative) body = body.slice(1);
    const mustBeDir = body.endsWith('/');
    if (mustBeDir) body = body.slice(0, -1);
    const basenameOnly = !body.includes('/');
    if (!basenameOnly && body.startsWith('/')) body = body.slice(1);
    patterns.push({ source, line: index + 1, text, base, negative, mustBeDir, basenameOnly, body });
  });
  return patterns;
}

/** Bytes of a string as one character each. */
export function asBytes(text: string): string {
  return Buffer.from(text, 'utf-8').toString('latin1');
}

const isUpper = (c: number) => c >= 0x41 && c <= 0x5a;
const isLower = (c: number) => c >= 0x61 && c <= 0x7a;
const isDigit = (c: number) => c >= 0x30 && c <= 0x39;
const isAlpha = (c: number) => isUpper(c) || isLower(c);
const isPrint = (c: number) => c >= 0x20 && c <= 0x7e;
const isSpace = (c: number) => c === 0x09 || c === 0x0a || c === 0x0d || c === 0x20;

/** wildmatch's [:name:] classes, with git's own reading of each. */
const CHARACTER_CLASSES: Record<string, (c: number, caseFold: boolean) => boolean> = {
  alnum: (c) => isAlpha(c) || isDigit(c),
  alpha: isAlpha,
  blank: (c) => c === 0x20 || c === 0x09,
  cntrl: (c) => c <= 0x1f || c === 0x7f,
  digit: isDigit,
  graph: (c) => c >= 0x21 && c <= 0x7e,
  lower: isLower,
  print: isPrint,
  punct: (c) => isPrint(c) && !isAlpha(c) && !isDigit(c) && c !== 0x20,
  space: isSpace,
  upper: (c, caseFold) => isUpper(c) || (caseFold && isLower(c)),
  xdigit: (c) => isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66),
};

/** Tests whether a byte, as wildmatch sees it once lowered under case folding, can stand at a point of a pattern. */
type ByteTest = (c: number) => boolean;

/**
 * A pattern as a nondeterministic automaton over bytes: state i goes to i + 1
 * on a byte `step[i]` accepts, stays at i on a byte `loop[i]` accepts, and
 * moves to i + 1 without a byte when `skip[i]`. The last state accepts; a
 * pattern that can't match anything has no way there.
 */
interface Automaton {
  step: (ByteTest | null)[];
  loop: (ByteTest | null)[];
  skip: boolean[];
}

const NEVER: ByteTest = () => false;

/**
 * Compile `head`, plain text, followed by a glob read the way git's dowild
 * reads it, with WM_PATHNAME and the glob's start as the pattern's: `?`, `*` and
 * a bracket expression never match a slash; `**` between slashes, or at an end,
 * matches across them, and `**` followed by a slash matches no directory too;
 * any other run of stars is one star. A trailing backslash, an unclosed bracket
 * or an unknown [:class:] leave a pattern that matches nothing.
 */
function compileGlob(head: string, glob: string, caseFold: boolean): Automaton {
  const step: (ByteTest | null)[] = [];
  const loop: (ByteTest | null)[] = [];
  const skip: boolean[] = [];
  const fold = (c: number) => (caseFold && isUpper(c) ? c + 0x20 : c);
  const push = (entry: { step?: ByteTest; loop?: ByteTest; skip?: boolean }) => {
    step.push(entry.step ?? null);
    loop.push(entry.loop ?? null);
    skip.push(entry.skip ?? false);
  };
  const never = () => ({ step: [NEVER], loop: [null], skip: [false] });

  for (let index = 0; index < head.length; index++) {
    const literal = fold(head.charCodeAt(index));
    push({ step: (t) => t === literal });
  }

  let i = 0;
  while (i < glob.length) {
    const c = glob.charCodeAt(i);
    if (c === 0x5c) {
      if (i + 1 >= glob.length) return never();
      // The escaped byte is compared as it is, against the lowered one
      const literal = glob.charCodeAt(i + 1);
      push({ step: (t) => t === literal });
      i += 2;
    } else if (c === 0x3f) {
      push({ step: (t) => t !== SLASH });
      i++;
    } else if (c === 0x2a) {
      let j = i;
      while (j < glob.length && glob.charCodeAt(j) === 0x2a) j++;
      const atBoundary = j - i >= 2
        && (i === 0 || glob.charCodeAt(i - 1) === SLASH)
        && (j === glob.length || glob.charCodeAt(j) === SLASH || (glob.charCodeAt(j) === 0x5c && glob.charCodeAt(j + 1) === SLASH));
      if (atBoundary && glob.charCodeAt(j) === SLASH) {
        // `**/`: no directory at all, or any bytes up to a slash
        push({ loop: () => true, step: (t) => t === SLASH, skip: true });
        i = j + 1;
      } else {
        push({ loop: atBoundary ? () => true : (t) => t !== SLASH, skip: true });
        i = j;
      }
    } else if (c === 0x5b) {
      const parsed = parseBracket(glob, i, caseFold);
      if (!parsed) return never();
      push({ step: (t) => t !== SLASH && parsed.test(t) });
      i = parsed.end;
    } else {
      const literal = fold(c);
      push({ step: (t) => t === literal });
      i++;
    }
  }
  return { step, loop, skip };
}

/**
 * A bracket expression starting at `start`, read as dowild reads one, as a test
 * of the lowered byte and the index past its closing bracket; null when it can
 * never match.
 */
function parseBracket(glob: string, start: number, caseFold: boolean): { test: ByteTest; end: number } | null {
  const at = (index: number) => (index < glob.length ? glob.charCodeAt(index) : 0);
  const members: ((t: number) => boolean)[] = [];
  let p = start + 1;
  let pc = at(p);
  if (pc === 0x5e) pc = 0x21;
  const negated = pc === 0x21;
  if (negated) pc = at(++p);

  let previous = 0;
  do {
    if (!pc) return null;
    if (pc === 0x5c) {
      pc = at(++p);
      if (!pc) return null;
      const literal = pc;
      members.push((t) => t === literal);
    } else if (pc === 0x2d && previous && at(p + 1) && at(p + 1) !== 0x5d) {
      pc = at(++p);
      if (pc === 0x5c) {
        pc = at(++p);
        if (!pc) return null;
      }
      const low = previous;
      const high = pc;
      members.push((t) => (t <= high && t >= low) || (caseFold && isLower(t) && t - 0x20 <= high && t - 0x20 >= low));
      pc = 0;
    } else if (pc === 0x5b && at(p + 1) === 0x3a) {
      const nameStart = p + 2;
      p = nameStart;
      while (at(p) && at(p) !== 0x5d) p++;
      if (!at(p)) return null;
      if (p - nameStart - 1 < 0 || at(p - 1) !== 0x3a) {
        // No ":]" before the next "]": a "[" of the set, read on from the ":"
        p = nameStart - 2;
        pc = 0x5b;
        members.push((t) => t === 0x5b);
        previous = pc;
        pc = at(++p);
        continue;
      }
      const test = CHARACTER_CLASSES[glob.slice(nameStart, p - 1)];
      if (!test) return null;
      members.push((t) => test(t, caseFold));
      pc = 0;
    } else {
      const literal = pc;
      members.push((t) => t === literal);
    }
    previous = pc;
    pc = at(++p);
  } while (pc !== 0x5d);

  return { test: (t) => members.some((member) => member(t)) !== negated, end: p + 1 };
}

/** The states an automaton can be in once it can move without a byte from `states`. */
function closure(automaton: Automaton, states: Set<number>): Set<number> {
  const reached = new Set(states);
  const pending = [...states];
  while (pending.length > 0) {
    const state = pending.pop()!;
    if (automaton.skip[state] && !reached.has(state + 1)) {
      reached.add(state + 1);
      pending.push(state + 1);
    }
  }
  return reached;
}

/** The states after reading `byte`, already lowered under case folding, from `states`. */
function advance(automaton: Automaton, states: Set<number>, byte: number): Set<number> {
  const next = new Set<number>();
  for (const state of states) {
    if (automaton.loop[state]?.(byte)) next.add(state);
    if (automaton.step[state]?.(byte)) next.add(state + 1);
  }
  return closure(automaton, next);
}

/** The states after reading `text` from the start, lowered under case folding. */
function statesAfter(automaton: Automaton, text: string, caseFold: boolean): Set<number> {
  let states = closure(automaton, new Set([0]));
  for (let index = 0; index < text.length && states.size > 0; index++) {
    const raw = text.charCodeAt(index);
    states = advance(automaton, states, caseFold && isUpper(raw) ? raw + 0x20 : raw);
  }
  return states;
}

function accepts(automaton: Automaton, text: string, caseFold: boolean): boolean {
  return statesAfter(automaton, text, caseFold).has(automaton.step.length);
}

/**
 * Whether some bytes with no slash among them, read after `text`, can take the
 * automaton to its last state.
 */
function acceptsSomeNameAfter(automaton: Automaton, text: string, caseFold: boolean): boolean {
  const canTake = (test: ByteTest | null) => {
    if (!test) return false;
    for (let byte = 1; byte < 256; byte++) {
      if (byte !== SLASH && test(caseFold && isUpper(byte) ? byte + 0x20 : byte)) return true;
    }
    return false;
  };
  const reached = statesAfter(automaton, text, caseFold);
  const pending = [...reached];
  while (pending.length > 0) {
    const state = pending.pop()!;
    if (state === automaton.step.length) return true;
    if ((automaton.skip[state] || canTake(automaton.step[state])) && !reached.has(state + 1)) {
      reached.add(state + 1);
      pending.push(state + 1);
    }
  }
  return false;
}

/** How much of a pattern git compares as plain text before any glob: up to its first `*`, `?`, `[` or backslash. */
function literalLength(body: string): number {
  const index = body.search(/[*?[\\]/);
  return index === -1 ? body.length : index;
}

const lowered = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase());
const sameText = (a: string, b: string, caseFold: boolean) => (caseFold ? lowered(a) === lowered(b) : a === b);

/**
 * What a pattern is matched against for `path` - from the top of the
 * repository, one byte per character - as git's match_basename and
 * match_pathname split it: the last segment, for a pattern without a slash;
 * otherwise the path below the pattern's directory, whose plain text before
 * the first glob is compared as text, the glob starting where it ends. Null
 * when the path is not below that directory, or that text already differs.
 *
 * With `open`, `path` is only the start of a path whose name goes on with any
 * bytes but a slash, and the plain text it doesn't reach is left in `head`,
 * for those bytes to match.
 */
function subjectOf(pattern: IgnorePattern, path: string, caseFold: boolean, open: boolean): { text: string; head: string; glob: string } | null {
  if (pattern.basenameOnly) {
    return { text: path.slice(path.lastIndexOf('/') + 1), head: '', glob: pattern.body };
  }
  if (path.length <= pattern.base.length || !sameText(path.slice(0, pattern.base.length), pattern.base, caseFold)) return null;
  const rest = path.slice(pattern.base.length);
  const literal = literalLength(pattern.body);
  if (literal > rest.length) {
    if (!open || !sameText(rest, pattern.body.slice(0, rest.length), caseFold)) return null;
    return { text: '', head: pattern.body.slice(rest.length, literal), glob: pattern.body.slice(literal) };
  }
  if (!sameText(rest.slice(0, literal), pattern.body.slice(0, literal), caseFold)) return null;
  return { text: rest.slice(literal), head: '', glob: pattern.body.slice(literal) };
}

/** Whether `pattern` matches `path`, a directory or not, as git matches it. */
export function patternMatches(pattern: IgnorePattern, path: string, isDirectory: boolean, caseFold: boolean): boolean {
  if (pattern.mustBeDir && !isDirectory) return false;
  const subject = subjectOf(pattern, path, caseFold, false);
  return subject !== null && accepts(compileGlob(subject.head, subject.glob, caseFold), subject.text, caseFold);
}

/**
 * Whether `pattern` matches some directory whose path is `prefix` followed by
 * any bytes but a slash: a directory named as it is created.
 */
export function patternMatchesSomeDirectory(pattern: IgnorePattern, prefix: string, caseFold: boolean): boolean {
  const subject = subjectOf(pattern, prefix, caseFold, true);
  return subject !== null && acceptsSomeNameAfter(compileGlob(subject.head, subject.glob, caseFold), subject.text, caseFold);
}

/** The .gitignore directories whose patterns apply to `path`, deepest first. */
function directoriesAbove(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return parts.map((_, index) => `${parts.slice(0, parts.length - index).join('/')}/`).concat('');
}

/** The pattern that decides `path` among the sources, as git's last_matching_pattern_from_lists finds it, or null. */
function decidingPattern(sources: IgnoreSources, path: string, isDirectory: boolean, caseFold: boolean): IgnorePattern | null {
  const lists = [...directoriesAbove(path).map((directory) => sources.byDirectory.get(directory) ?? []), ...sources.excludeFiles];
  for (const patterns of lists) {
    for (let index = patterns.length - 1; index >= 0; index--) {
      if (patternMatches(patterns[index], path, isDirectory, caseFold)) return patterns[index];
    }
  }
  return null;
}

/** The case readings that count: core.ignorecase when it is known, both otherwise. */
function caseReadings(sources: IgnoreSources): boolean[] {
  return sources.ignoreCase === null ? [false, true] : [sources.ignoreCase];
}

/**
 * Whether git leaves `path` out, a directory or a file, and when it doesn't,
 * the negation that takes it back, if one does. A directory above it that git
 * ignores leaves it out, since git doesn't look inside one. Under both case
 * readings it counts as left out only when both leave it out.
 */
export function ignoredByRules(sources: IgnoreSources, path: string, isDirectory: boolean): { ignored: boolean; takenBackBy: IgnorePattern | null } {
  for (const caseFold of caseReadings(sources)) {
    const parts = path.split('/');
    let ignored = false;
    let takenBackBy: IgnorePattern | null = null;
    for (let depth = 1; depth <= parts.length && !ignored; depth++) {
      const pattern = decidingPattern(sources, parts.slice(0, depth).join('/'), depth < parts.length || isDirectory, caseFold);
      if (pattern?.negative) takenBackBy = pattern;
      ignored = pattern !== null && !pattern.negative;
    }
    if (!ignored) return { ignored: false, takenBackBy };
  }
  return { ignored: true, takenBackBy: null };
}

/**
 * Whether some name with no slash in it, after `prefix`, makes a directory that
 * `negation` matches and none of `leftOut` does: one the negation takes back
 * and no pattern git reads over it leaves out again. Each pattern is read as an
 * automaton over the bytes of the name, and all of them are run together over
 * every name at once, until a set of states repeats.
 */
function someDirectoryTakenBack(negation: IgnorePattern, leftOut: readonly IgnorePattern[], prefix: string, caseFold: boolean): boolean {
  const automata: Automaton[] = [];
  const start: Set<number>[] = [];
  for (const pattern of [negation, ...leftOut]) {
    const subject = subjectOf(pattern, prefix, caseFold, true);
    // The negation comes first; a pattern whose plain text already differs from the prefix matches no name
    if (!subject) {
      if (pattern === negation) return false;
      continue;
    }
    const automaton = compileGlob(subject.head, subject.glob, caseFold);
    automata.push(automaton);
    start.push(statesAfter(automaton, subject.text, caseFold));
  }

  const accepts = (states: Set<number>[], index: number) => states[index].has(automata[index].step.length);
  const key = (states: Set<number>[]) => states.map((set) => [...set].sort((a, b) => a - b).join(',')).join('|');
  const seen = new Set([key(start)]);
  let reached = [start];
  while (reached.length > 0) {
    const next: Set<number>[][] = [];
    for (const states of reached) {
      if (accepts(states, 0) && !states.slice(1).some((_, index) => accepts(states, index + 1))) return true;
      if (states[0].size === 0) continue;
      for (let byte = 1; byte < 256; byte++) {
        if (byte === SLASH || (caseFold && isUpper(byte))) continue;
        const moved = states.map((set, index) => advance(automata[index], set, byte));
        const movedKey = key(moved);
        if (seen.has(movedKey)) continue;
        seen.add(movedKey);
        next.push(moved);
      }
    }
    reached = next;
  }
  return false;
}

/**
 * Whether git leaves out every directory at `prefix` followed by a name with no
 * slash in it, and when it doesn't, the negation that can take one back, if
 * one can. `coversEvery` tells a pattern that matches every such name; a
 * pattern that matches only some of them leaves the rest to the patterns git
 * reads before it, and a negation takes back only a name no pattern git reads
 * after it leaves out again. The directories above `prefix` are taken as not
 * ignored.
 */
export function everyDirectoryIgnored(
  sources: IgnoreSources,
  prefix: string,
  coversEvery: (pattern: IgnorePattern) => boolean,
): { ignored: boolean; takenBackBy: IgnorePattern | null } {
  const lists = [...directoriesAbove(`${prefix}x`).map((directory) => sources.byDirectory.get(directory) ?? []), ...sources.excludeFiles];
  for (const caseFold of caseReadings(sources)) {
    let covered = false;
    // The patterns read after the one at hand that leave out some of the names
    const leftOut: IgnorePattern[] = [];
    search: for (const patterns of lists) {
      for (let index = patterns.length - 1; index >= 0; index--) {
        const pattern = patterns[index];
        if (!patternMatchesSomeDirectory(pattern, prefix, caseFold)) continue;
        if (pattern.negative) {
          if (someDirectoryTakenBack(pattern, leftOut, prefix, caseFold)) return { ignored: false, takenBackBy: pattern };
          continue;
        }
        if (coversEvery(pattern)) {
          covered = true;
          break search;
        }
        leftOut.push(pattern);
      }
    }
    if (!covered) return { ignored: false, takenBackBy: null };
  }
  return { ignored: true, takenBackBy: null };
}

/** A regular file's content, one byte per character, or null for anything else: git reads no .gitignore through a symlink. */
function readRegularFile(path: string, followSymlinks: boolean): string | null {
  try {
    const stat = followSymlinks ? statSync(path) : lstatSync(path);
    return stat.isFile() ? readFileSync(path).toString('latin1') : null;
  } catch {
    return null;
  }
}

function git(projectRoot: string, args: string[]): { status: number | null; stdout: string } | null {
  const run = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  return run.error ? null : { status: run.status, stdout: run.stdout };
}

/**
 * Where git takes ignore rules from for paths in this project: the .gitignore
 * of the project root and of each directory in `directories` (from the project
 * root, ending in '/'), and, when git is there to say, the .gitignore of each
 * directory above the project up to the top of its repository, info/exclude,
 * core.excludesFile and core.ignorecase. Paths in the sources start with
 * `prefix`, the project root from the top.
 */
export function ignoreSourcesFor(projectRoot: string, directories: readonly string[]): { sources: IgnoreSources; prefix: string } {
  const byDirectory = new Map<string, IgnorePattern[]>();
  const excludeFiles: IgnorePattern[][] = [];
  let ignoreCase: boolean | null = null;
  let prefix = '';

  const repository = git(projectRoot, ['rev-parse', '--show-prefix', '--git-path', 'info/exclude']);
  if (repository?.status === 0) {
    const [shownPrefix, excludePath] = repository.stdout.split('\n');
    prefix = asBytes(shownPrefix);
    const exclude = readRegularFile(resolve(projectRoot, excludePath), true);
    if (exclude !== null) excludeFiles.push(parseIgnoreFile(exclude, '', '.git/info/exclude'));

    const segments = shownPrefix.split('/').filter(Boolean);
    let above = realpathSync(projectRoot);
    for (let depth = segments.length - 1; depth >= 0; depth--) {
      above = dirname(above);
      const directory = segments.slice(0, depth).map((segment) => `${segment}/`).join('');
      const content = readRegularFile(join(above, '.gitignore'), false);
      if (content !== null) byDirectory.set(asBytes(directory), parseIgnoreFile(content, asBytes(directory), `${directory}.gitignore`));
    }

    const caseSetting = git(projectRoot, ['config', '--type=bool', '--get', 'core.ignorecase']);
    ignoreCase = caseSetting?.status === 0 ? caseSetting.stdout.trim() === 'true' : false;
  }

  const excludesFile = git(projectRoot, ['config', '--path', '--get', 'core.excludesFile']);
  if (excludesFile) {
    const path = excludesFile.status === 0
      ? excludesFile.stdout.trim()
      : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'git', 'ignore');
    const content = readRegularFile(resolve(projectRoot, path), true);
    if (content !== null) excludeFiles.push(parseIgnoreFile(content, '', path));
  }

  for (const directory of ['', ...directories]) {
    const content = readRegularFile(join(projectRoot, directory, '.gitignore'), false);
    if (content === null) continue;
    const base = `${prefix}${asBytes(directory)}`;
    byDirectory.set(base, parseIgnoreFile(content, base, `${directory}.gitignore`));
  }

  return { sources: { byDirectory, excludeFiles, ignoreCase }, prefix };
}

/**
 * The same sources with the project root's .gitignore holding `content` - one
 * byte per character, or null for none git reads - instead: what git would
 * read once lines are added to it.
 */
export function withProjectGitignore(sources: IgnoreSources, prefix: string, content: string | null): IgnoreSources {
  const byDirectory = new Map(sources.byDirectory);
  if (content === null) byDirectory.delete(prefix);
  else byDirectory.set(prefix, parseIgnoreFile(content, prefix, '.gitignore'));
  return { ...sources, byDirectory };
}
