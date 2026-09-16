/**
 * What breaks a line in a terminal or a log, or reorders how it reads: C0 and C1
 * controls - a newline, a carriage return, ESC and the sequences it starts - DEL,
 * the line and paragraph separators, and the bidirectional marks, embeddings,
 * overrides and isolates.
 */
const BREAKS_A_LINE = /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/;

/**
 * Text as a line of output shows it - a path, or a line another process
 * printed: as it is, or, when it holds a character that breaks or reorders the
 * line, quoted, with each such character escaped. JSON escapes the C0 controls
 * but writes the rest as they are.
 */
export function shownPath(text: string): string {
  if (!BREAKS_A_LINE.test(text)) return text;
  return JSON.stringify(text).replace(new RegExp(BREAKS_A_LINE.source, 'g'), (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`
  );
}

/** What another process printed, as lines of output show it: each line the way `shownPath` shows one. */
export function shownLines(text: string): string {
  return text.split('\n').map(shownPath).join('\n');
}

/**
 * An error's stack as a line of output shows it: its message the way `shownPath`
 * shows one, which keeps a path the message names from breaking the stack into
 * lines of its own, and each line of the stack the way `shownPath` shows a line.
 */
export function shownStack(error: Error): string {
  const stack = error.stack ?? error.message;
  const withMessageShown = error.message && stack.includes(error.message)
    ? stack.replace(error.message, () => shownPath(error.message))
    : stack;
  return shownLines(withMessageShown);
}
