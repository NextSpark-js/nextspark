/**
 * Pieces of `nextspark migrate` that stand on their own (#203): the compatibility rewrites for the old
 * API URLs, the Next.js range check, the AI-workflow directories it leaves alone, and the contracts
 * package of a web+mobile workspace.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { CONTRACTS_PACKAGE_NAME, writeContractsPackage } from '../wizard/generators/contracts-package.js';

// ---------------------------------------------------------------------------------------------
// F9: rewrites for the URLs core's runtime dispatchers used to serve

export interface CompatRewrite {
  source: string;
  destination: string;
}

/** `/api/v1/theme/<theme>/**` is `/api/**` now, and a plugin's `/api/v1/plugin/<name>/**` is `/api/plugins/<name>/**`. */
export function compatRewrites(theme: string | null, plugins: readonly string[]): CompatRewrite[] {
  return [
    ...(theme ? [{ source: `/api/v1/theme/${theme}/:path*`, destination: '/api/:path*' }] : []),
    ...plugins.map(name => ({ source: `/api/v1/plugin/${name}/:path*`, destination: `/api/plugins/${name}/:path*` })),
  ];
}

export const COMPAT_MARKER = 'nextspark-compat-rewrites';

/** The block that wraps the project's own config; `typed` for a .ts config, whose compiler wants the annotations. */
function wrapperBlock(entries: readonly CompatRewrite[], typed: boolean, commonJs: boolean): string {
  const any = typed ? ': any' : '';
  const rest = typed ? '...args: any[]' : '...args';
  const list = entries.map(entry => `  { source: ${JSON.stringify(entry.source)}, destination: ${JSON.stringify(entry.destination)} },`).join('\n');
  return `
// ${COMPAT_MARKER}: apps already installed on people's phones, and other systems, still call the old
// /api/v1/theme/<theme>/** and /api/v1/plugin/<name>/** URLs; the routes now live at /api/** and
// /api/plugins/<name>/**. Delete this block (and restore the export above) once those callers have updated.
const __nextspark_compat_rewrites = [
${list}
]
const __nextspark_with_compat = (config${any}) => ({
  ...config,
  async rewrites() {
    const existing = typeof config.rewrites === 'function' ? await config.rewrites() : []
    return Array.isArray(existing)
      ? [...existing, ...__nextspark_compat_rewrites]
      : { ...existing, afterFiles: [...(existing.afterFiles ?? []), ...__nextspark_compat_rewrites] }
  },
})
${commonJs ? 'module.exports =' : 'export default'} typeof __nextspark_user_config === 'function'
  ? async (${rest}) => __nextspark_with_compat(await __nextspark_user_config(...args))
  : __nextspark_with_compat(__nextspark_user_config)
`;
}

export type CompatEdit = { source: string } | { error: string; snippet: string };

/**
 * The next config with the compatibility rewrites merged into whatever `rewrites()` it already has
 * (an array, or `{ beforeFiles, afterFiles, fallback }`; the wrapper does not read them, it only
 * appends). The project's `export default <expr>` (or `module.exports = <expr>`) becomes a constant
 * and the wrapper exports it, so the expression itself is never parsed. A config that does not have
 * exactly one such export is left alone, with the snippet to paste.
 */
export function addCompatRewrites(source: string, file: string, entries: readonly CompatRewrite[]): CompatEdit {
  const typed = /\.[cm]?ts$/.test(file);
  const esm = [...source.matchAll(/^export\s+default\s+/gm)];
  const cjs = [...source.matchAll(/^module\.exports\s*=\s*/gm)];
  const commonJs = esm.length === 0 && cjs.length === 1;
  const block = wrapperBlock(entries, typed, commonJs);
  const snippet = `${block.trim()}\n(before it, the config must be held in a constant: \`const __nextspark_user_config = <your config>\`)`;
  if (source.includes(COMPAT_MARKER)) return { source };
  if (!commonJs && !(esm.length === 1 && cjs.length === 0)) {
    return { error: `${file} does not have exactly one top-level \`export default\` or \`module.exports =\`, so migrate cannot edit it safely`, snippet };
  }
  // In a .ts config the captured value is `any`: a NextConfig narrows to never in the `typeof === 'function'`
  // branch, and a config function's own parameters would not match the wrapper's spread arguments.
  const declaration = `const __nextspark_user_config${typed ? ': any' : ''} = `;
  const head = commonJs ? source.replace(/^module\.exports\s*=\s*/m, declaration) : source.replace(/^export\s+default\s+/m, declaration);
  return { source: `${head.replace(/\s*$/, '\n')}${block}` };
}

/** Text the report shows next to the rewrites. */
export const COMPAT_NOTE = 'These rewrites exist for already-installed clients (mobile apps in the stores, integrations). They can be removed later, once those callers use the new URLs.';

// ---------------------------------------------------------------------------------------------
// F11: the Next.js range

export const REQUIRED_NEXT_RANGE = '~16.3.5';

export interface NextRangeCheck {
  required: string;
  members: { name: 'next' | 'eslint-config-next'; section: 'dependencies' | 'devDependencies'; value: string; action: 'ok' | 'update' | 'check'; note?: string }[];
}

/** True when a plain range stays inside `~16.3.5`: `16.3.x`, `~16.3.x`, `=16.3.x` with x >= 5. */
function insideRequiredRange(value: string): boolean {
  const match = /^[~=]?\s*v?16\.3\.(\d+)$/.exec(value.trim());
  return match !== null && Number(match[1]) >= 5;
}

const INDIRECT_SPEC = /^(?:catalog|workspace|npm|link|file|git\+?|github|https?):/;

const unquote = (value: string): string => value.replace(/\s+#.*$/, '').trim().replace(/^(['"])(.*)\1$/, '$2');

/**
 * `catalog:` / `catalogs:` of a pnpm-workspace.yaml: the version each catalog pins for a dependency.
 * Any indentation, CRLF and quoted keys are read; `catalog:default` is the `catalog:` map or `catalogs.default`.
 */
export function catalogVersion(yaml: string, catalog: string | null, dependency: string): string | null {
  const wanted = catalog === 'default' ? null : catalog;
  let section: 'catalog' | 'catalogs' | null = null;
  let childIndent: number | null = null;
  let named: string | null = null;
  for (const raw of yaml.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(raw)) continue;
    const indent = /^ */.exec(raw)?.[0].length ?? 0;
    const [, rawKey = '', rawValue = ''] = /^\s*(?:-\s+)?((?:'[^']*'|"[^"]*"|[^:'"]+)):(?:\s+(.*))?$/.exec(raw) ?? [];
    const key = unquote(rawKey);
    const value = unquote(rawValue ?? '');
    if (indent === 0) {
      section = key === 'catalog' ? 'catalog' : key === 'catalogs' ? 'catalogs' : null;
      childIndent = null;
      named = null;
      continue;
    }
    if (section === 'catalog' && wanted === null && key === dependency) return value || null;
    if (section === 'catalogs') {
      childIndent ??= indent;
      if (indent === childIndent) named = value === '' ? key : null;
      else if (named !== null && key === dependency && (wanted === null ? named === 'default' : named === wanted)) return value || null;
    }
  }
  return null;
}

export function checkNextRange(pkg: Record<string, unknown> | undefined, catalogs: (catalog: string | null, dependency: string) => string | null = () => null): NextRangeCheck {
  const members: NextRangeCheck['members'] = [];
  for (const section of ['dependencies', 'devDependencies'] as const) {
    const table = pkg?.[section] as Record<string, unknown> | undefined;
    for (const name of ['next', 'eslint-config-next'] as const) {
      const value = table?.[name];
      if (typeof value !== 'string') continue;
      const spec = value.trim();
      const catalog = /^catalog:(.*)$/.exec(spec);
      if (catalog) {
        const pinned = catalogs(catalog[1].trim() || null, name);
        members.push(pinned && insideRequiredRange(pinned)
          ? { name, section, value, action: 'ok', note: `the catalog pins ${pinned}` }
          : { name, section, value, action: 'check', note: pinned ? `the catalog pins ${pinned}; set it to ${REQUIRED_NEXT_RANGE}` : `migrate could not read the catalog entry; make sure it is ${REQUIRED_NEXT_RANGE}` });
      } else if (INDIRECT_SPEC.test(spec)) {
        members.push({ name, section, value, action: 'check', note: `migrate cannot change this spec; make sure it resolves to ${REQUIRED_NEXT_RANGE}` });
      } else {
        members.push({ name, section, value, action: insideRequiredRange(spec) ? 'ok' : 'update' });
      }
    }
  }
  return { required: REQUIRED_NEXT_RANGE, members };
}

/** The package.json text with the out-of-range values replaced, keeping the file's formatting. */
export function updateNextRange(text: string, check: NextRangeCheck): string {
  let next = text;
  for (const member of check.members.filter(entry => entry.action === 'update')) {
    const section = new RegExp(`("${member.section}"\\s*:\\s*\\{[^}]*?"${member.name}"\\s*:\\s*)"[^"]*"`);
    next = next.replace(section, `$1"${check.required}"`);
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// L8: workspace members that declare next / react / react-dom as peers

export interface PeerUpdate { name: 'next' | 'react' | 'react-dom'; from: string; to: string }

const parseVersion = (value: string): [number, number, number] | null => {
  const match = /^v?(\d+)(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:[-+].*)?$/.exec(value.trim());
  if (!match) return null;
  const part = (text: string | undefined) => text === undefined || /[xX*]/.test(text) ? -1 : Number(text);
  return [Number(match[1]), part(match[2]), part(match[3])];
};

const compareVersions = (left: number[], right: number[]): number => left[0] - right[0] || left[1] - right[1] || left[2] - right[2];

interface Bound { version: number[]; inclusive: boolean }
interface Interval { lower: Bound | null; upper: Bound | null }

/** The first version above everything a partial version (`16`, `16.3`) covers. */
const nextAbove = (base: number[]): number[] => base[1] === -1 ? [base[0] + 1, 0, 0] : base[2] === -1 ? [base[0], base[1] + 1, 0] : [base[0], base[1], base[2] + 1];
const floorOf = (base: number[]): number[] => [base[0], Math.max(base[1], 0), Math.max(base[2], 0)];

/** The interval one comparator (`^1.2.3`, `>=2`, `<3.x`, `1.2`) allows, or null when it is not understood. */
function comparatorInterval(token: string): Interval | null {
  if (token === '*' || token === 'x' || token === 'X') return { lower: null, upper: null };
  const match = /^(>=|<=|>|<|=|\^|~)?(.+)$/.exec(token);
  const base = match ? parseVersion(match[2]) : null;
  if (!match || !base) return null;
  switch (match[1] ?? '') {
    case '>=': return { lower: { version: floorOf(base), inclusive: true }, upper: null };
    case '>': return base[1] === -1 || base[2] === -1 ? { lower: { version: nextAbove(base), inclusive: true }, upper: null } : { lower: { version: base, inclusive: false }, upper: null };
    case '<': return { lower: null, upper: { version: floorOf(base), inclusive: false } };
    case '<=': return base[1] === -1 || base[2] === -1 ? { lower: null, upper: { version: nextAbove(base), inclusive: false } } : { lower: null, upper: { version: base, inclusive: true } };
    case '^': {
      const upper = base[0] > 0 || base[1] === -1 ? [base[0] + 1, 0, 0] : base[1] > 0 || base[2] === -1 ? [0, base[1] + 1, 0] : [0, 0, base[2] + 1];
      return { lower: { version: floorOf(base), inclusive: true }, upper: { version: upper, inclusive: false } };
    }
    case '~': return { lower: { version: floorOf(base), inclusive: true }, upper: { version: base[1] === -1 ? [base[0] + 1, 0, 0] : [base[0], base[1] + 1, 0], inclusive: false } };
    default: return { lower: { version: floorOf(base), inclusive: true }, upper: { version: nextAbove(base), inclusive: false } };
  }
}

/** The intervals of an npm range, one per `||` alternative (hyphen ranges, spaces as "and"); null when any part is not understood. */
function rangeIntervals(range: string): Interval[] | null {
  const intervals: Interval[] = [];
  for (const alternative of range.split('||')) {
    const tokens = alternative.trim().replace(/(\S+)\s+-\s+(\S+)/, '>=$1 <=$2').replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
    const merged: Interval = { lower: null, upper: null };
    for (const token of tokens) {
      const interval = comparatorInterval(token);
      if (!interval) return null;
      if (interval.lower && (!merged.lower || compareVersions(interval.lower.version, merged.lower.version) > 0)) merged.lower = interval.lower;
      if (interval.upper && (!merged.upper || compareVersions(interval.upper.version, merged.upper.version) < 0)) merged.upper = interval.upper;
    }
    intervals.push(merged);
  }
  return intervals;
}

/** Whether an npm range accepts a plain `x.y.z` version. Anything not understood is not claimed to accept. */
export function rangeAccepts(range: string, version: string): boolean {
  const wanted = parseVersion(version);
  const intervals = wanted ? rangeIntervals(range) : null;
  if (!wanted || !intervals) return false;
  return intervals.some(({ lower, upper }) => {
    const above = !lower || (compareVersions(wanted, lower.version) > 0 || (lower.inclusive && compareVersions(wanted, lower.version) === 0));
    const below = !upper || (compareVersions(wanted, upper.version) < 0 || (upper.inclusive && compareVersions(wanted, upper.version) === 0));
    return above && below;
  });
}

/** True only when every version the range accepts is below `version`: the one case where raising a peer range cannot lower it. */
export function rangeAllBelow(range: string, version: string): boolean {
  const target = parseVersion(version);
  const intervals = target ? rangeIntervals(range) : null;
  if (!target || !intervals) return false;
  return intervals.every(({ upper }) => upper !== null && (compareVersions(upper.version, target) < 0 || (!upper.inclusive && compareVersions(upper.version, target) === 0)));
}

export interface PeerNote { name: 'next' | 'react' | 'react-dom'; range: string; wanted: string }

/**
 * The peer ranges of a workspace member that the generated host would not satisfy. `next` that does
 * not accept the required release, and a `react` / `react-dom` that does not accept the host's own,
 * are raised (`updates`) only when every version they accept is below it; a range that reaches
 * higher (`^17`, `^19.2.4`) is never lowered, only reported (`kept`). pnpm installs a member's
 * unmet peers under the member, which makes a second copy.
 */
export function memberPeerUpdates(pkg: Record<string, unknown>, host: { react?: string; 'react-dom'?: string }): { updates: PeerUpdate[]; kept: PeerNote[] } {
  const peers = pkg.peerDependencies as Record<string, unknown> | undefined;
  const updates: PeerUpdate[] = [];
  const kept: PeerNote[] = [];
  if (!peers) return { updates, kept };
  const consider = (name: PeerUpdate['name'], value: unknown, version: string | null | undefined, to: string) => {
    if (typeof value !== 'string' || !version || INDIRECT_SPEC.test(value) || INDIRECT_SPEC.test(to) || rangeAccepts(value, version)) return;
    if (rangeAllBelow(value, version)) updates.push({ name, from: value, to });
    else kept.push({ name, range: value, wanted: to });
  };
  consider('next', peers.next, REQUIRED_NEXT_RANGE.replace(/^~/, ''), REQUIRED_NEXT_RANGE);
  for (const name of ['react', 'react-dom'] as const) {
    const hostRange = host[name];
    if (hostRange) consider(name, peers[name], /(\d+\.\d+\.\d+)/.exec(hostRange)?.[1], hostRange);
  }
  return { updates, kept };
}

export interface HostFrameworkFix { name: 'react' | 'react-dom'; section: 'dependencies' | 'devDependencies'; from: string; to: string; manual: boolean; /** The member's version is in another major: never raised automatically. */ major: boolean }

/**
 * Members that resolve a newer react / react-dom than the host installed: the host's own range is
 * raised to that version (never lowered, same major only, keeping `^` / `~` / exact) when it is a plain `^`, `~` or exact version that is
 * below it; any other spec (catalog, workspace, a union, a tag) is left to the person, with the command.
 */
export function hostFrameworkFixes(pkg: Record<string, unknown> | undefined, copies: readonly { name: string; version: string; host: string }[]): HostFrameworkFix[] {
  const fixes: HostFrameworkFix[] = [];
  for (const name of ['react', 'react-dom'] as const) {
    const newest = copies.filter(copy => copy.name === name && (() => { const own = parseVersion(copy.version); const host = parseVersion(copy.host); return own && host && compareVersions(own, host) > 0; })())
      .map(copy => copy.version).sort((a, b) => compareVersions(parseVersion(b) ?? [0, 0, 0], parseVersion(a) ?? [0, 0, 0]))[0];
    if (!newest) continue;
    for (const section of ['dependencies', 'devDependencies'] as const) {
      const from = (pkg?.[section] as Record<string, unknown> | undefined)?.[name];
      if (typeof from !== 'string') continue;
      const plain = /^[\^~]?\d+\.\d+\.\d+$/.test(from.trim());
      const base = plain ? parseVersion(from.replace(/^[\^~]/, '')) : null;
      const wanted = parseVersion(newest);
      // only raising: a range whose base is already at or above the member's version is not the cause
      if (plain && base && wanted && compareVersions(base, wanted) >= 0) continue;
      const major = !!(base && wanted && base[0] !== wanted[0]);
      // the operator stays: ~ stays ~, an exact pin stays exact
      fixes.push({ name, section, from, to: `${/^[\^~]/.exec(from.trim())?.[0] ?? (plain ? '' : '^')}${newest}`, manual: !plain || major, major });
    }
  }
  return fixes;
}

/** The package.json text with the host's react / react-dom ranges raised, keeping the file's formatting. */
export function updateHostFramework(text: string, fixes: readonly HostFrameworkFix[]): string {
  let next = text;
  for (const fix of fixes.filter(entry => !entry.manual)) {
    next = next.replace(new RegExp(`("${fix.section}"\\s*:\\s*\\{[^}]*?"${fix.name}"\\s*:\\s*)"[^"]*"`), `$1"${fix.to}"`);
  }
  return next;
}

/** The package.json text with those peer ranges replaced, keeping the file's formatting. */
export function updatePeerRanges(text: string, updates: PeerUpdate[]): string {
  let next = text;
  for (const update of updates) {
    const escaped = update.name.replace(/[-/]/g, '\\$&');
    next = next.replace(new RegExp(`("peerDependencies"\\s*:\\s*\\{[^}]*?"${escaped}"\\s*:\\s*)"[^"]*"`), `$1"${update.to}"`);
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// L11: the core imports of a converted file

/**
 * Whether the installed core exports `specifier` (`@nextsparkjs/core/lib/x`): its package.json
 * `exports` entry (exact, or the longest `./prefix/*` pattern) points at a file that exists.
 * `null` when it cannot tell (no readable manifest or `exports`): nothing is claimed missing then.
 */
export function coreExportsSpecifier(coreDir: string, specifier: string): boolean | null {
  let exportsMap: unknown;
  try {
    exportsMap = (JSON.parse(readFileSync(join(coreDir, 'package.json'), 'utf8')) as { exports?: unknown }).exports;
  } catch {
    return null;
  }
  if (typeof exportsMap !== 'object' || exportsMap === null) return null;
  const subpath = specifier === '@nextsparkjs/core' ? '.' : `.${specifier.slice('@nextsparkjs/core'.length)}`;
  const table = exportsMap as Record<string, unknown>;
  let target: unknown = table[subpath];
  if (target === undefined) {
    const pattern = Object.keys(table)
      .filter(key => key.includes('*') && subpath.startsWith(key.slice(0, key.indexOf('*'))) && subpath.endsWith(key.slice(key.indexOf('*') + 1)) && subpath.length >= key.length - 1)
      .sort((left, right) => right.indexOf('*') - left.indexOf('*'))[0];
    if (!pattern) return false;
    const matched = subpath.slice(pattern.indexOf('*'), subpath.length - (pattern.length - pattern.indexOf('*') - 1));
    const entry = table[pattern];
    const resolve = (value: unknown): unknown => typeof value === 'string' ? value.replace(/\*/g, matched) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, resolve(inner)])) : value;
    target = resolve(entry);
  }
  const file = typeof target === 'string' ? target : target && typeof target === 'object' ? ((target as Record<string, unknown>).import ?? (target as Record<string, unknown>).default ?? (target as Record<string, unknown>).require) : null;
  return typeof file === 'string' ? existsSync(join(coreDir, file)) : false;
}

// ---------------------------------------------------------------------------------------------
// F12: AI-workflow directories

const AI_WORKFLOW_DIRECTORY = /^(?:\.claude|\.codex[^/]*|\.gemini|\.cursor|\.superpowers|\.agents)$/;

// Whether the file sits under an AI-workflow directory: .claude, .codex (any suffix), .gemini, .cursor, .superpowers, .agents.
export function inAiWorkflowDirectory(repository: string, file: string): boolean {
  return relative(repository, file).split(sep).slice(0, -1).some(part => AI_WORKFLOW_DIRECTORY.test(part));
}

// ---------------------------------------------------------------------------------------------
// F13: the contracts package of a project with a mobile app

/** Where `nextspark prepare` looks for the contracts package, relative to the host (core's CONTRACTS_PACKAGE_CANDIDATES). */
const PREPARE_CONTRACTS_CANDIDATES = ['../packages/contracts', '../../packages/contracts', 'packages/contracts'];

export type WorkspaceGlobs = { globs: string[] } | { error: string };

const SCALAR = /^(?:'([^']*)'|"([^"]*)"|([^\s#'"[\]{},&*!|>%@`:][^#,[\]{}]*?))$/;

/** A plain or quoted scalar, or null when it is anything else (an anchor, a tag, a mapping, ...). */
function yamlScalar(value: string): string | null {
  const match = SCALAR.exec(value.trim());
  // a plain scalar with `: ` in it is a mapping (`- name: web`), not a string
  if (match?.[3] !== undefined && (/:(\s|$)/.test(match[3]) || /^[-?](\s|$)/.test(match[3]))) return null;
  return match ? (match[1] ?? match[2] ?? match[3]) : null;
}

const withoutComment = (value: string): string => value.replace(/\s+#.*$/, '').trim();

interface PackagesShape {
  eol: string;
  lines: string[];
  globs: string[];
  /** 'absent': no packages key; 'block': a list of `- item` lines; 'flow': `[a, b]` on the key's line. */
  kind: 'absent' | 'block' | 'flow';
  keyLine: number;
  /** Block: the index of the last item (or the key's line when there are none) and the items' indent and quote. */
  lastLine: number;
  indent: string;
  quote: string;
}

/**
 * The `packages:` of a pnpm-workspace.yaml, read only in the shapes this is certain about: a block list whose
 * items share one indent (any width, including none), or a one-line flow list (a trailing comma is fine); the
 * key may be quoted; the file is one document with one line-ending style. Anything else is an error.
 */
function readPackages(text: string): PackagesShape | { error: string } {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(eol);
  if (lines.join(eol) !== text || (eol === '\r\n' && /(?<!\r)\n/.test(text))) return { error: 'the file mixes line endings' };
  if (lines.some(line => /^(---|\.\.\.)/.test(line) || /^\s*\t/.test(line))) return { error: 'the file has several documents or tab indentation' };
  const keys = lines.flatMap((line, index) => /^(?:(["'])packages\1|packages)[ \t]*:(?:[ \t]|$)/.test(line) ? [index] : []);
  const none: Omit<PackagesShape, 'kind' | 'globs' | 'keyLine' | 'lastLine' | 'indent' | 'quote'> = { eol, lines };
  if (keys.length === 0) return { ...none, kind: 'absent', globs: [], keyLine: -1, lastLine: -1, indent: '  ', quote: "'" };
  if (keys.length > 1) return { error: 'packages: appears more than once' };
  const keyLine = keys[0];
  const rest = withoutComment(lines[keyLine].replace(/^(?:(["'])packages\1|packages)[ \t]*:/, ''));
  if (rest.startsWith('[') && rest.endsWith(']')) {
    const inner = rest.slice(1, -1);
    if (/[[\]{}]/.test(inner)) return { error: 'packages: is a nested flow list' };
    const parts = inner.split(',').map(part => part.trim());
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    const globs = parts.map(yamlScalar);
    if (globs.some(glob => glob === null || glob === '')) return { error: 'packages: has an entry that is not a plain or quoted string' };
    return { ...none, kind: 'flow', globs: globs as string[], keyLine, lastLine: keyLine, indent: '', quote: /^\s*"/.test(parts[0] ?? '') ? '"' : "'" };
  }
  if (rest !== '') return { error: 'packages: is written in a form this does not read' };
  const globs: string[] = [];
  let indent: string | null = null;
  let quote = "'";
  let lastLine = keyLine;
  for (let index = keyLine + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(#|$)/.test(line)) continue;
    const item = /^( *)-[ ]+(.+)$/.exec(line);
    if (!item) {
      if (/^\s/.test(line)) return { error: 'packages: has a line that is not a list item' };
      break;
    }
    if (indent !== null && item[1] !== indent) return { error: 'packages: items do not share one indent' };
    indent = item[1];
    const glob = yamlScalar(withoutComment(item[2]));
    if (glob === null || glob === '') return { error: 'packages: has an entry that is not a plain or quoted string' };
    if (globs.length === 0) quote = /^\s*"/.test(item[2]) ? '"' : "'";
    globs.push(glob);
    lastLine = index;
  }
  return { ...none, kind: 'block', globs, keyLine, lastLine, indent: indent ?? '  ', quote };
}

/** The globs of `packages:`, or why they are not read. */
export function workspaceGlobs(yaml: string): WorkspaceGlobs {
  const shape = readPackages(yaml.replace(/^\uFEFF/, ''));
  return 'error' in shape ? { error: shape.error } : { globs: shape.globs };
}

function globMatches(glob: string, path: string): boolean {
  const pattern = glob.replace(/^\.\//, '').replace(/\/$/, '').replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*');
  return new RegExp(`^${pattern}$`).test(path);
}

/** A workspace lists a path when a positive glob matches it and no `!` glob does. */
function workspaceIncludes(globs: readonly string[], path: string): boolean {
  return globs.some(glob => !glob.startsWith('!') && globMatches(glob, path)) && !globs.some(glob => glob.startsWith('!') && globMatches(glob.slice(1), path));
}

const NEW_GLOB = 'packages/contracts';

/**
 * The yaml with `packages/contracts` added to `packages:`. The new text is read back and must list the old
 * globs plus the new one, with every other byte as it was; if it does not, nothing is proposed and the
 * error carries the line to add by hand.
 */
export function addWorkspaceGlob(input: string): { text: string } | { error: string; line: string } {
  // A byte-order mark is not part of the first key: it is set aside and put back
  const bom = input.startsWith('\uFEFF') ? '\uFEFF' : '';
  const yaml = input.slice(bom.length);
  const edited = editWorkspaceGlob(yaml);
  return 'text' in edited ? { text: `${bom}${edited.text}` } : edited;
}

function editWorkspaceGlob(yaml: string): { text: string } | { error: string; line: string } {
  const shape = readPackages(yaml);
  const byHand = "- 'packages/contracts'   (under packages:)";
  if ('error' in shape) return { error: shape.error, line: byHand };
  // An exclusion that reaches packages/contracts would keep pnpm from seeing it: change that line instead
  const excluding = shape.globs.find(glob => glob.startsWith('!') && globMatches(glob.slice(1), NEW_GLOB));
  if (excluding) return { error: `packages: excludes packages/contracts (${excluding})`, line: `remove or narrow ${shape.quote}${excluding}${shape.quote} under packages:, then run migrate again` };
  if (workspaceIncludes(shape.globs, NEW_GLOB)) return { text: yaml };
  const { lines, eol } = shape;
  const entry = `${shape.quote}${NEW_GLOB}${shape.quote}`;
  let rebuilt: string[];
  if (shape.kind === 'absent') {
    rebuilt = [`packages:`, `  - ${entry}`, ...lines];
  } else if (shape.kind === 'flow') {
    const line = lines[shape.keyLine];
    const open = line.indexOf('[');
    const close = line.lastIndexOf(']');
    const inner = line.slice(open + 1, close).replace(/,\s*$/, '').trimEnd();
    rebuilt = [...lines];
    rebuilt[shape.keyLine] = `${line.slice(0, open + 1)}${inner}${inner.trim() === '' ? '' : ', '}${entry}${line.slice(close)}`;
  } else {
    rebuilt = [...lines];
    rebuilt.splice(shape.lastLine + 1, 0, `${shape.indent}- ${entry}`);
  }
  const text = rebuilt.join(eol);
  const back = readPackages(text);
  const expected = [...shape.globs, NEW_GLOB];
  const sameElsewhere = shape.kind === 'block'
    ? rebuilt.filter((_, index) => index !== shape.lastLine + 1).join(eol) === yaml
    : shape.kind === 'absent'
      ? text.endsWith(yaml) && text.slice(0, text.length - yaml.length) === `packages:${eol}  - ${entry}${eol}`
      : rebuilt.filter((_, index) => index !== shape.keyLine).join(eol) === lines.filter((_, index) => index !== shape.keyLine).join(eol);
  if ('error' in back || back.globs.length !== expected.length || back.globs.some((glob, index) => glob !== expected[index]) || !sameElsewhere) {
    return { error: 'the edited file did not read back as the old globs plus packages/contracts', line: byHand };
  }
  return { text };
}

export interface ContractsPlan {
  /** The mobile member that imports the package. */
  mobile: string;
  contractsDirectory: string;
  hostPath: string;
  /** What mobile's dependency says: `workspace:*` when the workspace lists mobile, a `file:` path otherwise (add:mobile's layout). */
  dependency: string;
  /** The pnpm-workspace.yaml text to write, when the workspace has to list the package. */
  workspaceText: string | null;
}

export interface ContractsResult {
  plan: ContractsPlan | null;
  /** Why the package is not created although the project has a mobile app and none. */
  skipped: string | null;
  /** What stops the migration: a workspace file migrate cannot edit. */
  blocker: string | null;
}

/** A project with a mobile member (`@nextsparkjs/mobile`) and no `packages/contracts`: what to create, or why not. */
export function planContractsPackage(repository: string, hostRoot: string, manifests: readonly { file: string; pkg: Record<string, unknown> }[]): ContractsResult {
  const none: ContractsResult = { plan: null, skipped: null, blocker: null };
  const contractsDirectory = join(repository, 'packages', 'contracts');
  if (existsSync(join(contractsDirectory, 'package.json'))) return none;
  const hostManifest = join(hostRoot, 'package.json');
  const mobile = manifests.find(entry => {
    const directory = dirname(entry.file);
    if (entry.file === hostManifest || directory === contractsDirectory) return false;
    // With the host below the root, the host's own members are not the app; at the root (add:mobile's layout) mobile/ sits inside it
    if (hostRoot !== repository && (directory === hostRoot || directory.startsWith(`${hostRoot}${sep}`))) return false;
    const table = { ...(entry.pkg.dependencies as object | undefined), ...(entry.pkg.devDependencies as object | undefined) } as Record<string, unknown>;
    return '@nextsparkjs/mobile' in table;
  });
  if (!mobile) return none;
  const toHost = relative(contractsDirectory, hostRoot).split(sep).join('/');
  const fromHost = relative(hostRoot, contractsDirectory).split(sep).join('/');
  if (!PREPARE_CONTRACTS_CANDIDATES.includes(fromHost)) {
    return { ...none, skipped: `packages/contracts is not created: nextspark prepare only looks for it at ${PREPARE_CONTRACTS_CANDIDATES.join(', ')} from the host (${relative(repository, hostRoot).split(sep).join('/') || '.'}), so it would stay empty. Create it beside a host at most two levels below the repository root, or generate the contracts into .nextspark/contracts` };
  }
  const mobileDirectory = dirname(mobile.file);
  const mobilePath = relative(repository, mobileDirectory).split(sep).join('/');
  const workspaceFile = join(repository, 'pnpm-workspace.yaml');
  let dependency = `file:${relative(mobileDirectory, contractsDirectory).split(sep).join('/')}`;
  let workspaceText: string | null = null;
  if (existsSync(workspaceFile)) {
    const yaml = readFileSync(workspaceFile, 'utf8');
    const listed = workspaceGlobs(yaml);
    if ('error' in listed) {
      return { ...none, blocker: `pnpm-workspace.yaml: ${listed.error}, so migrate cannot list packages/contracts in it. Add this line under packages: and run migrate again:\n${"  - 'packages/contracts'"}` };
    }
    if (workspaceIncludes(listed.globs, mobilePath)) {
      dependency = 'workspace:*';
      const edit = addWorkspaceGlob(yaml);
      if ('error' in edit) return { ...none, blocker: `pnpm-workspace.yaml: ${edit.error}, so migrate cannot list packages/contracts in it. Add this line under packages: and run migrate again:\n${edit.line}` };
      workspaceText = edit.text === yaml ? null : edit.text;
    }
  }
  return { plan: { mobile: mobileDirectory, contractsDirectory, hostPath: toHost, dependency, workspaceText }, skipped: null, blocker: null };
}

/** Create the package, list it in the workspace, and make mobile depend on it; `nextspark prepare` then fills src/. */
export async function applyContractsPackage(repository: string, plan: ContractsPlan): Promise<string[]> {
  const done: string[] = [];
  await writeContractsPackage(plan.contractsDirectory, { projectPath: plan.hostPath });
  done.push('packages/contracts created');
  if (plan.workspaceText !== null) {
    writeFileSync(join(repository, 'pnpm-workspace.yaml'), plan.workspaceText);
    done.push('pnpm-workspace.yaml lists packages/contracts');
  }
  const file = join(plan.mobile, 'package.json');
  const text = readFileSync(file, 'utf8');
  const pkg = JSON.parse(text) as { dependencies?: Record<string, string> };
  pkg.dependencies = { ...pkg.dependencies, [CONTRACTS_PACKAGE_NAME]: plan.dependency };
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 2;
  writeFileSync(file, `${JSON.stringify(pkg, null, indent)}\n`);
  done.push(`${relative(repository, file).split(sep).join('/')} depends on ${CONTRACTS_PACKAGE_NAME} (${plan.dependency})`);
  return done;
}

// ---------------------------------------------------------------------------------------------
// Block thumbnails: in 0.1.0-beta.192 BlockConfig.thumbnail is the image the registry imports, and
// the old string ("/theme/blocks/<slug>/thumbnail.png") fails the typecheck. Nothing ever read it.

const THUMBNAIL_LINE = /^[ \t]*thumbnail:[ \t]*['"]\/theme\/blocks\/[^'"]*['"],?[ \t]*$/;

/** Whether the path is a block's config: `blocks/<slug>/config.ts`, at any depth. */
export function isBlockConfig(path: string): boolean {
  return /(?:^|[\\/])blocks[\\/][^\\/]+[\\/]config\.ts$/.test(path);
}

/** How many old-style thumbnail lines the block config text has. */
export function countBlockThumbnails(text: string): number {
  return text.split('\n').filter(line => THUMBNAIL_LINE.test(line.replace(/\r$/, ''))).length;
}

/** The block config text without those lines. */
export function removeBlockThumbnails(text: string): string {
  return text.split('\n').filter(line => !THUMBNAIL_LINE.test(line.replace(/\r$/, ''))).join('\n');
}

// ---------------------------------------------------------------------------------------------
// pnpm 11 and later read the build-script allowlist only from pnpm-workspace.yaml

/**
 * The packages create-nextspark-app allows to run install scripts (`PACKAGES_ALLOWED_TO_BUILD` in its create.ts): pnpm 11
 * fails the install over each one left out, so a legacy list of two is completed with these.
 */
export const BUILD_ALLOWLIST = [
  '@nextsparkjs/ai-workflow',
  '@nextsparkjs/core',
  '@parcel/watcher',
  '@swc/core',
  'cypress',
  'esbuild',
  'protobufjs',
  'sharp',
  'unrs-resolver',
];

export interface PnpmBuildsPlan {
  /** What the project's package.json lists under pnpm.onlyBuiltDependencies (kept). */
  fromPackageJson: string[];
  /** Entries the workspace file gets (those it already has are not repeated). */
  added: string[];
  /** The workspace file does not exist yet. */
  createsFile: boolean;
  /** Set when the workspace file cannot be edited safely: nothing is written. */
  error?: string;
}

type BuildBlock = { names: Set<string>; denied: Set<string>; last: number; indent: string };

/** `allowBuilds` / `onlyBuiltDependencies` blocks of the workspace yaml: the names they hold (and those set to false), the line where each ends and the indentation of its entries, or an error for a shape that cannot be edited safely. */
function readBuildBlock(lines: string[], key: string): BuildBlock | null | { error: string } {
  const start = lines.findIndex(line => line.startsWith(`${key}:`));
  if (start === -1) return null;
  const byHand = { error: `${key} in pnpm-workspace.yaml is not a block this migration can edit (add the entries by hand)` };
  if (lines[start].slice(key.length + 1).replace(/#.*$/, '').trim() !== '') return byHand;
  const list = key !== 'allowBuilds';
  const block: BuildBlock = { names: new Set(), denied: new Set(), last: start, indent: '  ' };
  let indent: string | null = null;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    // A list may sit at column 0 (`key:\n- a`); anything else at column 0 ends the block
    if (!/^\s/.test(line) && !(list && /^-\s/.test(line))) break;
    const entry = list ? /^(\s*)-\s+(['"]?)([^'"#\s][^#]*?)\2\s*(?:#.*)?$/.exec(line) : /^(\s+)(['"]?)([^'"\s][^'"]*?)\2\s*:\s*([^#\s]+)\s*(?:#.*)?$/.exec(line);
    if (!entry) return byHand;
    if (indent !== null && entry[1] !== indent) return byHand;
    indent = entry[1];
    block.last = index;
    block.names.add(entry[3]);
    if (!list && entry[4] === 'false') block.denied.add(entry[3]);
  }
  if (indent !== null) block.indent = indent;
  return block;
}

/** The legacy `pnpm.onlyBuiltDependencies` of a package.json, or null when it has none. */
export function legacyBuildList(pkg: Record<string, unknown> | undefined): string[] | null {
  const list = (pkg?.pnpm as Record<string, unknown> | undefined)?.onlyBuiltDependencies;
  return Array.isArray(list) ? list.filter((entry): entry is string => typeof entry === 'string') : null;
}

/** The workspace yaml with the allowlist in both forms (`allowBuilds`: pnpm 11, `onlyBuiltDependencies`: pnpm 10), keeping every entry it has. */
export function addBuildAllowlist(yaml: string | null, entries: readonly string[]): { text: string; added: string[] } | { error: string } {
  const eol = yaml?.includes('\r\n') ? '\r\n' : '\n';
  const lines = yaml === null ? ['packages: []'] : yaml.split(/\r?\n/);
  // Only the bare `key:` spelling is edited: a quoted or spaced key (`'allowBuilds':`, `allowBuilds :`) would get a duplicate,
  // and a document marker after the first line would put the new keys in another document. Both are left to the user.
  const unusual = lines.some((line, index) => (index > 0 && /^(---|\.\.\.)\s*$/.test(line))
    || (/^['"]?(allowBuilds|onlyBuiltDependencies)['"]?\s*:/.test(line) && !/^(allowBuilds|onlyBuiltDependencies):/.test(line)));
  if (unusual) return { error: 'allowBuilds/onlyBuiltDependencies in pnpm-workspace.yaml are written in a form this migration does not edit (add the entries by hand)' };
  const added = new Set<string>();
  const forms: [string, (name: string, indent: string) => string][] = [['allowBuilds', (name, indent) => `${indent}'${name}': true`], ['onlyBuiltDependencies', (name, indent) => `${indent}- '${name}'`]];
  const denied = readBuildBlock(lines, 'allowBuilds');
  if (denied && 'error' in denied) return denied;
  for (const [key, format] of forms) {
    const block = readBuildBlock(lines, key);
    if (block && 'error' in block) return block;
    // A name allowBuilds sets to false is the user's explicit refusal: neither form adds it
    const missing = entries.filter(name => !block?.names.has(name) && !denied?.denied.has(name));
    missing.forEach(name => added.add(name));
    if (missing.length === 0) continue;
    if (block) lines.splice(block.last + 1, 0, ...missing.map(name => format(name, block.indent)));
    else {
      while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
      lines.push('', `${key}:`, ...missing.map(name => format(name, '  ')));
    }
  }
  const text = lines.join(eol);
  return { text: text.endsWith(eol) ? text : `${text}${eol}`, added: [...added] };
}

/** The package.json without `pnpm.onlyBuiltDependencies` (pnpm 11 ignores it and warns); the rest of the `pnpm` field stays. */
export function dropLegacyBuildList(text: string): string {
  const pkg = JSON.parse(text) as Record<string, unknown>;
  const pnpm = pkg.pnpm as Record<string, unknown> | undefined;
  if (!pnpm || !('onlyBuiltDependencies' in pnpm)) return text;
  delete pnpm.onlyBuiltDependencies;
  if (Object.keys(pnpm).length === 0) delete pkg.pnpm;
  const indent = /^\{\r?\n([ \t]+)"/.exec(text)?.[1] ?? 2;
  return `${JSON.stringify(pkg, null, indent)}${text.endsWith('\n') ? '\n' : ''}`;
}
