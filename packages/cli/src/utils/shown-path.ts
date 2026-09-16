import { format } from 'node:util';
import chalk from 'chalk';
import ora from 'ora';

/**
 * What breaks a line in a terminal or a log, or reorders how it reads: C0 and C1
 * controls - a newline, a carriage return, ESC and the sequences it starts - DEL,
 * the line and paragraph separators, and the bidirectional marks, embeddings,
 * overrides and isolates.
 */
const BREAKS_A_LINE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

/** Whether `text` holds a character that breaks or reorders a line. */
export function breaksALine(text: string): boolean {
  return BREAKS_A_LINE.test(text);
}

/**
 * Text as a line of output shows it - a path, or a line another process
 * printed: as it is, or, when it holds a character that breaks or reorders the
 * line, quoted, with each such character escaped. JSON escapes the C0 controls
 * but writes the rest as they are.
 */
export function shownPath(text: string): string {
  if (!breaksALine(text)) return text;
  return JSON.stringify(text).replace(new RegExp(BREAKS_A_LINE.source, 'g'), (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

/** A Select Graphic Rendition sequence: a color or a style, which sets how text looks and neither breaks nor moves it. */
const SGR = /\x1b\[[0-9;]*m/g;

/**
 * What one call prints, as a line of output shows it. The newlines and spaces
 * it starts with and the newlines it ends with are kept, as the blank lines
 * around it and its indent; when what is between them holds a character that
 * breaks or reorders a line, all of it is shown the way `shownPath` shows text,
 * on the one line, without colors. While
 * chalk colors the output, its color sequences don't count as such characters.
 *
 * A newline inside a call can't be told from one in a name the call prints, so
 * what spans lines is printed one call per line, and a call starts with its own
 * text rather than with a name.
 */
export function shownLine(text: string): string {
  const plain = chalk.level > 0 ? text.replace(SGR, '') : text;
  const [, before, body, after] = /^([\n ]*)([\s\S]*?)(\n*)$/.exec(plain)!;
  return BREAKS_A_LINE.test(body) ? `${before}${shownPath(body)}${after}` : text;
}

const GUARDED = Symbol.for('nextspark.shownLine');

type Guarded = { [GUARDED]?: true };

/**
 * Make each call to `target`'s log, info, warn, error and debug print what it
 * formats the way `shownLine` shows it.
 */
export function guardConsole(target: Console = console): void {
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = target[method] as ((...args: unknown[]) => void) & Guarded;
    if (typeof original !== 'function' || original[GUARDED]) continue;
    const guarded: ((...args: unknown[]) => void) & Guarded = (...args) => original.call(target, shownLine(format(...args)));
    guarded[GUARDED] = true;
    target[method] = guarded;
  }
}

const SPINNER_TEXTS = ['text', 'prefixText', 'suffixText'] as const;

/**
 * Make what an ora spinner prints - its text, prefix and suffix, and what it
 * leaves when it stops - read the way `shownLine` shows a line. A spinner writes
 * to its stream itself, not through the console.
 */
export function guardSpinners(): void {
  const prototype = Object.getPrototypeOf(ora({ isEnabled: false, isSilent: true })) as Record<string | symbol, unknown> & Guarded;
  if (prototype[GUARDED]) return;

  for (const name of SPINNER_TEXTS) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    const set = descriptor?.set;
    if (!descriptor || !set) continue;
    Object.defineProperty(prototype, name, {
      ...descriptor,
      set(value: unknown) {
        set.call(this, typeof value === 'string' ? shownLine(value) : value);
      },
    });
  }

  const stopAndPersist = prototype.stopAndPersist as (options?: Record<string, unknown>) => unknown;
  prototype.stopAndPersist = function (options: Record<string, unknown> = {}) {
    const shown = { ...options };
    for (const name of SPINNER_TEXTS) {
      if (typeof shown[name] === 'string') shown[name] = shownLine(shown[name] as string);
    }
    return stopAndPersist.call(this, shown);
  };
  prototype[GUARDED] = true;
}

/**
 * Guard what the CLI prints, once, before anything is printed: the console and
 * the spinners, so every line of output is escaped where it is printed.
 */
export function guardOutput(): void {
  guardConsole();
  guardSpinners();
}

/**
 * An error whose message is `lines`, one per line. What the CLI prints of an
 * error is printed one line per call, and only the lines an error carries this
 * way are taken as lines of their own: a newline anywhere else in a message
 * belongs to a name in it.
 */
export function errorWithLines(lines: string[]): Error & { lines: string[] } {
  return Object.assign(new Error(lines.join('\n')), { lines });
}

/** The lines of an error's message, each printed with a call of its own: the ones `errorWithLines` gave it, or else the whole message as one. */
export function errorLines(error: Error): string[] {
  const { lines } = error as Error & { lines?: unknown };
  return Array.isArray(lines) && lines.every((line) => typeof line === 'string') ? lines : [error.message];
}

/**
 * An error's stack as lines, each printed with a call of its own: its heading
 * with the whole message on it, and then each frame - split where the next
 * `    at ` starts, since a frame names a file whose path can hold a newline.
 */
export function stackLines(error: Error): string[] {
  const stack = error.stack ?? error.message;
  const at = error.message ? stack.indexOf(error.message) : -1;
  if (at === -1) return stack.split(/\n(?= {4}at )/);
  const frames = stack.slice(at + error.message.length).replace(/^\n/, '');
  return [`${stack.slice(0, at)}${error.message}`, ...(frames ? frames.split(/\n(?= {4}at )/) : [])];
}
