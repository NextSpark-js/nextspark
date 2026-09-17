import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { parse } from 'dotenv';

/**
 * Why core's registry build can't run in this project, or null when it can.
 *
 * The build exits with an error when NEXT_PUBLIC_ACTIVE_THEME is set neither in
 * the environment nor in the project's .env. Commands that run it as a side step
 * (`dev`, and `sync:app`, which core's postinstall runs before a project has a
 * .env) check first, so they can skip it with a reason instead of failing.
 */
export function registryBuildBlocker(projectRoot: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const envPath = join(projectRoot, '.env');
  const fileTheme = existsSync(envPath) ? parse(readFileSync(envPath)).NEXT_PUBLIC_ACTIVE_THEME : undefined;

  if (fileTheme || env.NEXT_PUBLIC_ACTIVE_THEME) return null;
  return existsSync(envPath)
    ? 'NEXT_PUBLIC_ACTIVE_THEME is not set in .env'
    : 'the project has no .env file with NEXT_PUBLIC_ACTIVE_THEME';
}

/** How many lines a pool of captured output holds at most, and how many UTF-8 bytes of them. */
export interface PoolCaps {
  lines: number;
  bytes: number;
}

/** What `captureOutput` keeps of a child's output. */
export interface CaptureLimits {
  /** UTF-8 bytes kept of any one line: what a longer line holds past them is counted, not kept. */
  line: number;
  /** The first lines. */
  head: PoolCaps;
  /** The last lines. */
  tail: PoolCaps;
  /** The first error lines, wherever they arrive. */
  errors: PoolCaps;
  /**
   * The stack lines right under those errors: at most `perError` under each
   * one. Which of them make the final cut is decided once every error is in,
   * by round among the errors that were kept - in round *r*, each error that
   * still has a frame *r* takes it if `lines` and `bytes` still have room, and
   * an error that doesn't fit takes no later frame either, so its kept ones
   * stay contiguous while the other errors keep going. The total across every
   * error's frames never passes `lines` or `bytes`.
   */
  stack: PoolCaps & { perError: number };
  /** The first warning lines, wherever they arrive. */
  warnings: PoolCaps;
}

const DEFAULT_LIMITS: CaptureLimits = {
  line: 4 * 1024,
  head: { lines: 10, bytes: 4 * 1024 },
  tail: { lines: 30, bytes: 16 * 1024 },
  errors: { lines: 10, bytes: 16 * 1024 },
  stack: { perError: 10, lines: 100, bytes: 16 * 1024 },
  warnings: { lines: 5, bytes: 4 * 1024 },
};

/** What a line can start with before its marker: spaces, tabs, and ANSI escape sequences, such as colors (CSI) and hyperlinks (OSC, ended by BEL or ST). */
const LINE_LEAD = /^(?:[ \t]|\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\))*/;

/** The marker core's `log(..., 'error')` starts a line with (`packages/core/scripts/utils/logging.mjs`). */
const CROSS_MARK = '\u274C';

/** The marker core's `log(..., 'warning')` starts a line with, which it follows with U+FE0F; a line that leaves the selector out is a warning too. */
const WARNING_SIGN = '\u26A0';

/** The heading of an error the way Node and core's `stackLines` print one: `Error:`, `TypeError:`, `Error [ERR_MODULE_NOT_FOUND]:`. */
const ERROR_HEADING = /^(?:[A-Z][A-Za-z]*)?Error(?: \[[A-Z0-9_]+\])?:/;

type LineKind = 'error' | 'warning' | 'stack' | 'other';

/** An escape JSON writes a character as: `\n`, `\t`, `\u2028` and the like. */
const JSON_ESCAPE = /\\[bfnrtu]/;

/**
 * What a line reports, read from the marker it starts with. core's console
 * guard prints a line that holds a control character quoted, with that
 * character escaped, so on a line that holds such an escape a marker can also
 * follow the opening quote.
 */
function lineKind(text: string): LineKind {
  if (text === '') return 'other';
  const lead = LINE_LEAD.exec(text)?.[0] ?? '';
  let rest = text.slice(lead.length);
  if (rest.startsWith('"') && JSON_ESCAPE.test(rest)) rest = rest.slice(1);

  if (rest.startsWith(CROSS_MARK) || ERROR_HEADING.test(rest)) return 'error';
  if (rest.startsWith(WARNING_SIGN)) return 'warning';
  if (/[ \t]/.test(lead) && rest.startsWith('at ')) return 'stack';
  return 'other';
}

interface CapturedLine {
  /** Its position among every line of the output, in the order the lines ended. */
  index: number;
  /** Bytes of every line before it. */
  offset: number;
  /** The line, or as much of its start as fits under the line cap. */
  text: string;
  /** Bytes of the line that `text` shows. */
  keptBytes: number;
  /** Bytes of the whole line as the child printed it, its line break left out. */
  bytes: number;
}

/** A line as it is shown: as kept, followed by how much of it was left out when it was cut. */
function shownCapturedLine(line: CapturedLine): string {
  return line.keptBytes < line.bytes ? `${line.text}… (${line.bytes - line.keptBytes} more byte(s) on this line)` : line.text;
}

/** A pool that keeps the lines offered to it until one doesn't fit, and from then on only counts them. */
function firstLines(caps: PoolCaps) {
  const kept: CapturedLine[] = [];
  let keptBytes = 0;
  let full = false;
  let droppedLines = 0;
  let droppedBytes = 0;

  return {
    kept,
    /** Whether the line was kept. */
    offer(line: CapturedLine): boolean {
      if (!full && kept.length < caps.lines && keptBytes + line.keptBytes <= caps.bytes) {
        kept.push(line);
        keptBytes += line.keptBytes;
        return true;
      }
      full = true;
      droppedLines++;
      droppedBytes += line.bytes;
      return false;
    },
    get droppedLines(): number {
      return droppedLines;
    },
    get droppedBytes(): number {
      return droppedBytes;
    },
  };
}

/** A pool that keeps the most recent lines, evicting the oldest past either cap. */
function lastLines(caps: PoolCaps) {
  const capacity = Math.max(0, caps.lines);
  const ring: (CapturedLine | undefined)[] = new Array(capacity);
  let first = 0;
  let count = 0;
  let keptBytes = 0;

  function evictOldest(): void {
    keptBytes -= ring[first]!.keptBytes;
    ring[first] = undefined;
    first = (first + 1) % capacity;
    count--;
  }

  return {
    add(line: CapturedLine): void {
      if (capacity === 0) return;
      if (count === capacity) evictOldest();
      ring[(first + count) % capacity] = line;
      count++;
      keptBytes += line.keptBytes;
      while (count > 0 && keptBytes > caps.bytes) evictOldest();
    },
    get kept(): CapturedLine[] {
      return Array.from({ length: count }, (_, position) => ring[(first + position) % capacity]!);
    },
  };
}

/** One of the child's streams: the line it is partway through, and the error line whose stack it may be printing. */
interface StreamState {
  /** Turns the bytes a line kept into text once the line ends. */
  decoder: StringDecoder;
  /** The first bytes of the line in progress: the line cap's worth, and one more, which tells whether a character runs past the cap. */
  start: Buffer;
  /** Bytes of the line in progress held in `start`. */
  held: number;
  /** Bytes of the line in progress so far. */
  bytes: number;
  /**
   * The candidate stack frames collected so far for the last line this stream
   * printed, when that line was a kept error or one of its stack lines, up to
   * `stack.perError` of them; `null` when this stream isn't under a kept error,
   * or has already collected as many candidates as an error can ever keep.
   */
  activeFrames: CapturedLine[] | null;
}

export interface CapturedOutput {
  /**
   * Take a chunk the child wrote to one of its streams, as the bytes it
   * arrived as. Reading `failureLines` or `successLines` ends the capture:
   * what is written after that is left out.
   */
  write(stream: 'stdout' | 'stderr', chunk: Buffer): void;
  /**
   * What a failed build printed worth showing, in the order the lines ended:
   * the first lines, the last lines, and the first error lines, each with the
   * stack lines under it, with how many lines and bytes sit between them.
   */
  readonly failureLines: string[];
  /** What a successful build flagged: its first error and warning lines, and how many more of each it printed. */
  readonly successLines: string[];
}

/**
 * Captures a child's output in bounded memory, by lines, counted in the bytes
 * the child printed.
 *
 * Each stream is split into lines on its own, at the line feeds in the bytes
 * as they arrive: in UTF-8 that byte never stands for part of a character, so
 * a character split across chunks stays whole. A line holds at most `line`
 * bytes of its start, and one more; past them, its bytes are counted as they
 * arrive and dropped up to its line break, so a line that never ends holds no
 * more memory than one that does. When the line ends, the stream's decoder
 * turns the bytes it kept into text of its own, leaving out whole a character
 * the cap cuts through, and showing bytes that aren't UTF-8 as U+FFFD.
 *
 * Each finished line is offered to pools capped both in lines and in bytes,
 * so empty lines are evicted like any others: the first lines, the last
 * lines, the first error lines, the stack lines right under each of those on
 * the same stream, and the first warning lines. Lines are ordered by when
 * they end, so a line one stream is partway through comes after a line the
 * other stream ends meanwhile. Errors and warnings keep the first ones they
 * are offered, since the cause of a failure is the first error it prints, and
 * count the rest. A line is an error or a warning by the marker its kept text
 * starts with, past any spaces and ANSI sequences: core's ❌ or ⚠️, or an error
 * heading such as `Error:`. Every count is of the bytes the child printed,
 * never of the text as kept or shown.
 */
export function captureOutput(limits: Partial<CaptureLimits> = {}): CapturedOutput {
  const caps: CaptureLimits = { ...DEFAULT_LIMITS, ...limits };
  const head = firstLines(caps.head);
  const tail = lastLines(caps.tail);
  const errors = firstLines(caps.errors);
  const warnings = firstLines(caps.warnings);
  // Each kept error's own candidate stack frames, in the order the errors
  // were kept; `errors.kept[i]`'s candidates are `errorFrames[i]`.
  const errorFrames: CapturedLine[][] = [];
  const streams = new Map<string, StreamState>();
  let totalLines = 0;
  let totalBytes = 0;
  let finished = false;

  function streamState(name: string): StreamState {
    let state = streams.get(name);
    if (!state) {
      state = { decoder: new StringDecoder('utf8'), start: Buffer.alloc(caps.line + 1), held: 0, bytes: 0, activeFrames: null };
      streams.set(name, state);
    }
    return state;
  }

  function extendLine(state: StreamState, chunk: Buffer, from: number, to: number): void {
    if (state.held < state.start.length) {
      state.held += chunk.copy(state.start, state.held, from, Math.min(to, from + state.start.length - state.held));
    }
    state.bytes += to - from;
  }

  function endLine(state: StreamState): void {
    let keptBytes = Math.min(state.bytes, caps.line);
    // A character the cap cuts through is left out whole: the bytes that continue one are 10xxxxxx
    if (state.bytes > caps.line) {
      for (let back = 0; back < 3 && keptBytes > 0 && (state.start[keptBytes] & 0xc0) === 0x80; back++) keptBytes--;
    }
    const text = keptBytes === 0 ? '' : state.decoder.write(state.start.subarray(0, keptBytes)) + state.decoder.end();
    const line: CapturedLine = { index: totalLines, offset: totalBytes, text, keptBytes, bytes: state.bytes };
    totalLines++;
    totalBytes += state.bytes;
    state.held = 0;
    state.bytes = 0;

    head.offer(line);
    tail.add(line);

    const kind = lineKind(line.text);
    if (kind === 'stack' && state.activeFrames !== null) {
      if (state.activeFrames.length < caps.stack.perError) {
        state.activeFrames.push(line);
      } else {
        // The candidates collected under an error stay contiguous: once it has
        // as many as it could ever keep, later frames of the same error are
        // never candidates either.
        state.activeFrames = null;
      }
      return;
    }
    if (kind === 'error') {
      if (errors.offer(line)) {
        const frames: CapturedLine[] = [];
        errorFrames.push(frames);
        state.activeFrames = caps.stack.perError > 0 ? frames : null;
      } else {
        state.activeFrames = null;
      }
      return;
    }
    state.activeFrames = null;
    if (kind === 'warning') warnings.offer(line);
  }

  function take(state: StreamState, chunk: Buffer): void {
    let start = 0;
    let newline: number;
    while ((newline = chunk.indexOf(0x0a, start)) !== -1) {
      if (newline > start) extendLine(state, chunk, start, newline);
      endLine(state);
      start = newline + 1;
    }
    if (start < chunk.length) extendLine(state, chunk, start, chunk.length);
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    for (const state of streams.values()) {
      if (state.bytes > 0) endLine(state);
    }
  }

  /**
   * The stack frames to show, chosen from each kept error's candidates by
   * round: in round *r*, every error that still has a candidate frame *r*
   * takes it if `caps.stack.lines` and `caps.stack.bytes` still have room for
   * it; once one doesn't fit, that error takes no later frame either, so its
   * kept frames stay contiguous, while the errors before and after it in the
   * round keep going.
   */
  function selectStackFrames(): CapturedLine[] {
    const kept: CapturedLine[] = [];
    let keptLines = 0;
    let keptBytes = 0;
    const stopped: boolean[] = new Array(errorFrames.length).fill(false);
    for (let round = 0; ; round++) {
      let offered = false;
      for (let i = 0; i < errorFrames.length; i++) {
        const frames = errorFrames[i];
        if (stopped[i] || round >= frames.length) continue;
        offered = true;
        const frame = frames[round];
        if (keptLines < caps.stack.lines && keptBytes + frame.keptBytes <= caps.stack.bytes) {
          kept.push(frame);
          keptLines++;
          keptBytes += frame.keptBytes;
        } else {
          stopped[i] = true;
        }
      }
      if (!offered) return kept;
    }
  }

  /** The lines of `pools` in order, each gap between them noted with the lines and bytes it holds. */
  function inOrder(pools: readonly (readonly CapturedLine[])[]): string[] {
    const byIndex = new Map<number, CapturedLine>();
    for (const pool of pools) {
      for (const line of pool) byIndex.set(line.index, line);
    }

    const shown: string[] = [];
    let nextIndex = 0;
    let nextOffset = 0;
    const noteGap = (index: number, offset: number) => {
      if (index > nextIndex) shown.push(`... ${index - nextIndex} line(s), ${offset - nextOffset} byte(s) omitted`);
    };
    for (const line of [...byIndex.values()].sort((a, b) => a.index - b.index)) {
      noteGap(line.index, line.offset);
      shown.push(shownCapturedLine(line));
      nextIndex = line.index + 1;
      nextOffset = line.offset + line.bytes;
    }
    noteGap(totalLines, totalBytes);
    return shown;
  }

  return {
    write(stream, chunk) {
      if (finished) return;
      take(streamState(stream), chunk);
    },

    get failureLines(): string[] {
      finish();
      const shown = inOrder([head.kept, errors.kept, selectStackFrames(), tail.kept]);
      if (errors.droppedLines > 0) {
        shown.push(`... and ${errors.droppedLines} more error line(s), ${errors.droppedBytes} byte(s), after the first ${errors.kept.length}`);
      }
      return shown;
    },

    get successLines(): string[] {
      finish();
      const shown = [...errors.kept, ...warnings.kept].sort((a, b) => a.index - b.index).map(shownCapturedLine);
      if (errors.droppedLines > 0) {
        shown.push(`... and ${errors.droppedLines} more error line(s), ${errors.droppedBytes} byte(s)`);
      }
      if (warnings.droppedLines > 0) {
        shown.push(`... and ${warnings.droppedLines} more warning line(s), ${warnings.droppedBytes} byte(s)`);
      }
      return shown;
    },
  };
}

/** Capture what `child` prints on stdout and on stderr together, in the order it arrives. */
export function captureChildOutput(child: ChildProcess, limits?: Partial<CaptureLimits>): CapturedOutput {
  const output = captureOutput(limits);
  child.stdout?.on('data', (chunk: Buffer) => output.write('stdout', chunk));
  child.stderr?.on('data', (chunk: Buffer) => output.write('stderr', chunk));
  return output;
}

/** What `captureLinesContaining` keeps: the matching lines, in the order they end, with how many more were dropped counted at the end. */
export interface MatchedLines {
  write(stream: 'stdout' | 'stderr', chunk: Buffer): void;
  /** Ends the line either stream is partway through, so it is offered too. */
  finish(): void;
  readonly lines: string[];
}

/**
 * A bounded pool of the lines across both streams that hold `needle`, in the
 * order they end. Every line is cut and decoded the way `captureOutput` cuts
 * one: bytes are copied into a buffer capped at `line + 1` before decoding, so
 * a kept line is a string of its own, never a slice of the chunk it arrived in
 * - the chunk a pipe delivers is already this capture's unit of memory, and a
 * decoded slice of it would keep the whole chunk reachable.
 */
export function captureLinesContaining(needle: string, caps: PoolCaps, line = DEFAULT_LIMITS.line): MatchedLines {
  const pool = firstLines(caps);
  interface LineState { decoder: StringDecoder; start: Buffer; held: number; bytes: number }
  const streams = new Map<string, LineState>();
  let index = 0;

  function streamState(name: string): LineState {
    let state = streams.get(name);
    if (!state) {
      state = { decoder: new StringDecoder('utf8'), start: Buffer.alloc(line + 1), held: 0, bytes: 0 };
      streams.set(name, state);
    }
    return state;
  }

  function endLine(state: LineState): void {
    let keptBytes = Math.min(state.bytes, line);
    if (state.bytes > line) {
      for (let back = 0; back < 3 && keptBytes > 0 && (state.start[keptBytes] & 0xc0) === 0x80; back++) keptBytes--;
    }
    const text = keptBytes === 0 ? '' : state.decoder.write(state.start.subarray(0, keptBytes)) + state.decoder.end();
    const bytes = state.bytes;
    state.held = 0;
    state.bytes = 0;
    if (text.includes(needle)) {
      pool.offer({ index: index++, offset: 0, text, keptBytes: Buffer.byteLength(text, 'utf8'), bytes });
    }
  }

  function extendLine(state: LineState, chunk: Buffer, from: number, to: number): void {
    if (state.held < state.start.length) {
      state.held += chunk.copy(state.start, state.held, from, Math.min(to, from + state.start.length - state.held));
    }
    state.bytes += to - from;
  }

  return {
    write(streamName, chunk) {
      const state = streamState(streamName);
      let start = 0;
      let newline: number;
      while ((newline = chunk.indexOf(0x0a, start)) !== -1) {
        if (newline > start) extendLine(state, chunk, start, newline);
        endLine(state);
        start = newline + 1;
      }
      if (start < chunk.length) extendLine(state, chunk, start, chunk.length);
    },
    finish() {
      for (const state of streams.values()) {
        if (state.bytes > 0) endLine(state);
      }
    },
    get lines(): string[] {
      const shown = pool.kept.map((kept) => kept.text);
      if (pool.droppedLines > 0) shown.push(`... and ${pool.droppedLines} more line(s), ${pool.droppedBytes} byte(s)`);
      return shown;
    },
  };
}

/** How many lines reporting what the build did to app/(templates) are kept: generous, since each one names a file a project's dev or sync:app run touched. */
const TEMPLATES_LINES_CAPS: PoolCaps = { lines: 2000, bytes: 256 * 1024 };

export interface RegistryBuildResult {
  status: 'built' | 'skipped' | 'failed';
  /** Why it was skipped. */
  reason?: string;
  /** What a failed build printed worth showing: the same lines `build` and `registry:build` show. */
  failureLines: string[];
  /** The lines reporting what the build did to app/(templates): files written, replaced or removed. */
  templatesLines: string[];
}

/**
 * Run core's registry build for a project: it regenerates `.nextspark/registries`
 * and `app/(templates)`.
 */
export function runRegistryBuild(
  coreDir: string,
  projectRoot: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<RegistryBuildResult> {
  const reason = registryBuildBlocker(projectRoot, env);
  if (reason) return Promise.resolve({ status: 'skipped', reason, failureLines: [], templatesLines: [] });

  return new Promise((resolve) => {
    const build = spawn('node', ['scripts/build/registry.mjs'], {
      cwd: coreDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...env, NEXTSPARK_PROJECT_ROOT: projectRoot },
    });

    // core reports a build's failure over stdout as often as over stderr, so the
    // cause is only complete when both streams are read together, in the order
    // they arrived - the same capture build and registry:build read theirs from
    const output = captureChildOutput(build);
    const templates = captureLinesContaining('app/(templates)', TEMPLATES_LINES_CAPS);
    build.stdout?.on('data', (chunk: Buffer) => templates.write('stdout', chunk));
    build.stderr?.on('data', (chunk: Buffer) => templates.write('stderr', chunk));

    build.on('error', (error) => {
      templates.finish();
      resolve({ status: 'failed', failureLines: [...output.failureLines, error.message], templatesLines: templates.lines });
    });
    build.on('close', (code) => {
      templates.finish();
      resolve({
        status: code === 0 ? 'built' : 'failed',
        failureLines: code === 0 ? [] : output.failureLines,
        templatesLines: templates.lines,
      });
    });
  });
}

/** What the registry build would change in `app/(templates)`, as paths from the project root. */
export interface TemplatesChanges {
  create: string[];
  /** Files it would give other content, backing up what they hold first. */
  replace: string[];
  /** Files it would remove, backing them up first. */
  remove: string[];
}

export interface TemplatesPlanResult {
  status: 'planned' | 'skipped' | 'failed';
  /** Why it was skipped, or why it couldn't be planned when that is known. */
  reason?: string;
  changes?: TemplatesChanges;
  /** Everything the plan printed, stdout and stderr interleaved. */
  output: string;
}

/** Marks the line core's templates-plan.mjs prints its result on. */
const TEMPLATES_PLAN_MARKER = 'nextspark-templates-plan:';

/**
 * Ask core what its registry build would change in `app/(templates)`, with
 * nothing written. The build copies app/ layouts into that tree, so the plan is
 * made against `appFiles` - the files under app/ that the sync about to run
 * writes (their content) or removes (null) - rather than app/ as it is now.
 */
export function planTemplatesChanges(
  coreDir: string,
  projectRoot: string,
  appFiles: Record<string, string | null>,
  env: NodeJS.ProcessEnv = process.env
): Promise<TemplatesPlanResult> {
  const reason = registryBuildBlocker(projectRoot, env);
  if (reason) return Promise.resolve({ status: 'skipped', reason, output: '' });
  if (!existsSync(join(coreDir, 'scripts', 'build', 'templates-plan.mjs'))) {
    return Promise.resolve({ status: 'failed', reason: 'this version of @nextsparkjs/core has no plan for it', output: '' });
  }

  return new Promise((resolve) => {
    let stdout = '';
    let output = '';
    const plan = spawn('node', ['scripts/build/templates-plan.mjs'], {
      cwd: coreDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...env, NEXTSPARK_PROJECT_ROOT: projectRoot },
    });

    plan.stdout?.on('data', (chunk) => { stdout += chunk.toString(); output += chunk.toString(); });
    plan.stderr?.on('data', (chunk) => { output += chunk.toString(); });
    // A plan that exits before reading its input is reported by its exit code, not by the broken pipe
    plan.stdin?.on('error', () => {});
    plan.stdin?.end(JSON.stringify(appFiles));

    plan.on('error', (error) => resolve({ status: 'failed', output: `${output}${error.message}\n` }));
    plan.on('close', (code) => {
      const line = stdout.split('\n').find((candidate) => candidate.startsWith(TEMPLATES_PLAN_MARKER));
      try {
        if (code === 0 && line) {
          resolve({ status: 'planned', changes: JSON.parse(line.slice(TEMPLATES_PLAN_MARKER.length)), output });
          return;
        }
      } catch {
        // An unreadable result is a failed plan
      }
      resolve({ status: 'failed', output });
    });
  });
}

/** One line per file in a plan of `app/(templates)`, marked the way sync:app's report marks its own. */
export function describeTemplatesChanges(changes: TemplatesChanges): string[] {
  return [
    ...changes.create.map((path) => `+ ${path}`),
    ...changes.replace.map((path) => `~ ${path} (replaced; what it holds is backed up first)`),
    ...changes.remove.map((path) => `- ${path} (removed; backed up first)`),
  ];
}

