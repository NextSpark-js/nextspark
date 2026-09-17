/**
 * The CLI's colors, with chalk's API for the styles the CLI uses. While chalk
 * colors the output they are not escape sequences yet but markers carrying a
 * nonce drawn once per process, which the output guard turns into sequences
 * as it prints. So the guard tells the CLI's own colors from an escape sequence
 * that comes in a value - a path, a name, a line another process printed -
 * which can't carry a nonce it never saw, and escapes the latter.
 */
import { randomBytes } from 'node:crypto';
import chalk from 'chalk';

const MARKER_START = '\uE000';
const MARKER_END = '\uE001';
const markerNonce = randomBytes(16).toString('hex');
const markerPattern = new RegExp(`${MARKER_START}${markerNonce}([0-9;]+)${MARKER_END}`, 'g');

type Style = {
  open: number;
  close: number;
};

const STYLES = {
  bold: { open: 1, close: 22 },
  black: { open: 30, close: 39 },
  red: { open: 31, close: 39 },
  green: { open: 32, close: 39 },
  yellow: { open: 33, close: 39 },
  blue: { open: 34, close: 39 },
  cyan: { open: 36, close: 39 },
  white: { open: 37, close: 39 },
  gray: { open: 90, close: 39 },
} as const satisfies Record<string, Style>;

type StyleName = keyof typeof STYLES;
type ColorBuilder = ((...arguments_: unknown[]) => string) &
  { level: typeof chalk.level } &
  { readonly [Name in StyleName]: ColorBuilder };

function marker(code: number): string {
  return `${MARKER_START}${markerNonce}${code}${MARKER_END}`;
}

/** Remove only style markers created by this process. */
export function stripColorMarkers(text: string): string {
  return text.replace(markerPattern, '');
}

/** Turn this process's style markers into terminal SGR sequences when colors are enabled. */
export function renderColorMarkers(text: string): string {
  return text.replace(markerPattern, (_match, code: string) => (chalk.level > 0 ? `\x1b[${code}m` : ''));
}

function applyStyles(styles: readonly Style[], text: string): string {
  if (chalk.level <= 0 || text.length === 0 || styles.length === 0) return text;

  const openAll = styles.map(({ open }) => marker(open)).join('');
  const closeAll = [...styles].reverse().map(({ close }) => marker(close)).join('');

  for (let index = styles.length - 1; index >= 0; index -= 1) {
    const { open, close } = styles[index];
    const closeMarker = marker(close);
    text = text.split(closeMarker).join(`${closeMarker}${marker(open)}`);
  }

  if (text.includes('\n')) {
    text = text.replace(/\r?\n/g, (lineBreak) => `${closeAll}${lineBreak}${openAll}`);
  }

  return `${openAll}${text}${closeAll}`;
}

function createBuilder(styles: readonly Style[] = []): ColorBuilder {
  const builder = ((...arguments_: unknown[]) => applyStyles(styles, arguments_.join(' '))) as ColorBuilder;

  Object.defineProperty(builder, 'level', {
    enumerable: true,
    get: () => chalk.level,
    set: (level: typeof chalk.level) => {
      chalk.level = level;
    },
  });

  for (const name of Object.keys(STYLES) as StyleName[]) {
    Object.defineProperty(builder, name, {
      configurable: true,
      get() {
        const styled = createBuilder([...styles, STYLES[name]]);
        Object.defineProperty(builder, name, { value: styled });
        return styled;
      },
    });
  }

  return builder;
}

const colors = createBuilder();

export default colors;
