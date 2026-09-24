/**
 * What `sync:app` does to a project, decided from file contents alone. The
 * command reads core's templates and the project's files into a SyncInput,
 * planSync turns them into one action per file, and only then is anything
 * written - or, with --dry-run, only described. src/app/(templates) is the registry
 * build's, and core plans it apart (registry-build.ts).
 *
 * Which files are core's to replace:
 * - A file whose generated tag (generated-tag.ts) names the path it is at and
 *   still matches its content is core's: it is updated when core's version
 *   changed. A copy of it at another path is the project's.
 * - A tagged file that no longer matches was changed by the project: it is kept
 *   and reported, and replaced - after a backup - only with --overwrite.
 * - A file without a tag is tagged when it is identical to what core would
 *   write, and otherwise treated as changed by the project.
 * - A file that can't hold the tag (JSON, Markdown, anything that isn't text)
 *   is core's while it is identical to core's version or to what the last sync
 *   on this machine wrote. With no record of that sync, one that differs may be
 *   an older version of core's as much as the project's change: it is kept, and
 *   the report says so until a sync is recorded.
 * - src/app/globals.css always imports the project-owned root stylesheet.
 */

import { readGeneratedTag, readGeneratedTagAt, sameText, tagStyleFor, withGeneratedTag } from './generated-tag.js';
import { adaptProxySource, isGeneratedProxySource, proxyFileNameFor, type ProxyFileName } from './proxy-file.js';
import { contentHash, type SyncState, type SyncStateEntry } from './sync-state.js';

/**
 * Root files core ships next to src/app/. The proxy file is planned apart: its
 * name follows the Next version. instrumentation.ts follows the same rules as
 * the others here (create it when the project doesn't have one, keep a
 * customized copy, update an untouched one core changed) so `sync:app` closes
 * the same gap as the wizard's PROJECT_ROOT_ITEMS for a project generated
 * before this file existed.
 */
export const ROOT_TEMPLATE_FILES: readonly string[] = ['next.config.mjs', 'tsconfig.json', 'i18n.ts', 'instrumentation.ts'];

/**
 * Template files that stand in for another one: on a project that uses PPR,
 * layout.tsx gets layout.ppr.tsx's content. They stay in core and are not
 * copied into projects.
 */
export const PPR_TEMPLATE_VARIANTS: Readonly<Record<string, string>> = { 'layout.tsx': 'layout.ppr.tsx' };

/** The part of src/app/ the registry build generates; sync:app leaves it to that build. */
const GENERATED_APP_PREFIX = '(templates)';

export type SyncActionKind = 'create' | 'update' | 'adopt' | 'unchanged' | 'keep' | 'delete';

/**
 * - `app`: a file core ships under templates/app, or tagged there by an earlier sync
 * - `root`: one of ROOT_TEMPLATE_FILES
 * - `proxy`: proxy.ts or middleware.ts
 * - `generated`: a file under src/app/(templates)
 * - `variant`: a PPR variant in the project's src/app/
 * - `project`: a file in src/app/ that core doesn't ship and never wrote
 */
export type SyncCategory = 'app' | 'root' | 'proxy' | 'generated' | 'variant' | 'project';

export interface SyncAction {
  /** Path from the project root, with forward slashes. */
  path: string;
  kind: SyncActionKind;
  category: SyncCategory;
  /** Why the file gets this action, in words for the report. */
  reason: string;
  /** What is written, for create, update and adopt. */
  content?: Buffer;
  /** Copy the current file aside before it is replaced or removed. */
  backup?: boolean;
  /** The project changed this file since core wrote it: it is kept, or replaced only because of --overwrite. */
  customized?: boolean;
  /** For a kept customized file: whether core's version changed since the last sync on this machine, or there is no record. */
  coreChanged?: boolean;
  /**
   * A kept file with no generated tag that differs from core's, and no record
   * of an earlier sync on this machine: an older version of core's and the
   * project's own change look the same.
   */
  undecided?: boolean;
  /** For a file left as it is because what core writes there can't be worked out for this project: why. */
  blockedBy?: string;
  /** Hash of core's version of the file, recorded in the sync state. */
  coreHash?: string;
  /** For a file with no generated tag that ends up with core's content: the hash of that content. */
  writtenHash?: string;
}

export interface SyncInput {
  /** The version of core being synced from, written into each generated tag. */
  coreVersion: string;
  /** Core's templates/app, by path relative to it. */
  appTemplates: ReadonlyMap<string, Buffer>;
  /** The project's src/app/, by path relative to it. */
  projectApp: ReadonlyMap<string, Buffer>;
  /** Core's root templates (ROOT_TEMPLATE_FILES and proxy.ts), by name. */
  rootTemplates: ReadonlyMap<string, Buffer>;
  /** The project's files with those names, and its middleware.ts, by name. */
  projectRootFiles: ReadonlyMap<string, Buffer>;
  /** Whether PPR variants replace the files they stand in for (cacheComponents on Next 16+). */
  usePprVariants: boolean;
  /** The project's Next major version, which names its proxy file; null when unknown. */
  nextMajor: number | null;
  /** What the last sync on this machine recorded, or null when there is no record. */
  state: SyncState | null;
  /** Paths, from the project root, of customized files to replace with core's version. */
  overwrite: ReadonlySet<string>;
}

export function planSync(input: SyncInput): SyncAction[] {
  return [...planAppFiles(input), ...planRootFiles(input), ...planProxy(input)];
}

function isGenerated(file: string): boolean {
  return file.startsWith(GENERATED_APP_PREFIX);
}

function isVariant(file: string): boolean {
  return Object.values(PPR_TEMPLATE_VARIANTS).includes(file);
}

/** Point src/app/globals.css at the project-owned root stylesheet. */
export function withProjectStyles(css: string): string {
  return css.replace(
    /@import\s+["'][^"']*styles\/globals\.css["'];?/,
    '@import "../../styles/globals.css";'
  );
}

type AppFileContent = { content: Buffer; reason: string } | { blockedBy: string };

/** What core writes at src/app/<file>, after the substitutions this project needs, or why one of them can't be worked out. */
function appFileContent(file: string, template: Buffer, input: SyncInput): AppFileContent {
  const variant = PPR_TEMPLATE_VARIANTS[file];
  const variantContent = variant ? input.appTemplates.get(variant) : undefined;
  if (input.usePprVariants && variantContent) {
    return { content: variantContent, reason: `core's ${variant}, since the project uses PPR` };
  }

  if (file === 'globals.css') {
    return {
      content: Buffer.from(withProjectStyles(template.toString('utf-8'))),
      reason: "core's file, importing the project's styles",
    };
  }

  return { content: template, reason: "core's file" };
}

interface ManagedFile {
  path: string;
  category: SyncCategory;
  /** The project's file, when it has one. */
  current: Buffer | undefined;
  /** What core writes there, before the generated tag. */
  expected: Buffer;
  reason: string;
  /** For an untagged file that differs from core's: whether an earlier release generated it anyway. */
  generatedEarlier?: (current: Buffer) => boolean;
}

/** Decide one file core writes, following the rules at the top of this module. */
function planManagedFile(file: ManagedFile, input: SyncInput): SyncAction {
  const { path, category, current, expected, reason, generatedEarlier } = file;
  const coreHash = contentHash(expected);
  const entry: SyncStateEntry | undefined = input.state?.files[path];
  const taggable = tagStyleFor(path, expected) !== null;
  const content = withGeneratedTag(path, expected, input.coreVersion);
  const writtenHash = taggable ? undefined : coreHash;

  if (current === undefined) {
    return { path, category, coreHash, writtenHash, kind: 'create', reason, content };
  }

  // A tag naming another path came with a copy of that file, and says nothing about this one
  const tag = taggable ? readGeneratedTagAt(path, current) : null;

  if (taggable) {
    if (tag?.intact) {
      // A tag without a path can't show the file was generated here, so what it holds is backed up before it is replaced
      if (!sameText(tag.body, expected)) {
        return { path, category, coreHash, kind: 'update', reason: `${reason}, changed by core`, content, ...(tag.path === null ? { backup: true } : {}) };
      }
      return tag.path === null
        ? { path, category, coreHash, kind: 'adopt', reason: 'identical to core; tagged again, with its path', content }
        : { path, category, coreHash, kind: 'unchanged', reason };
    }
    if (!tag && sameText(current, expected)) {
      return { path, category, coreHash, kind: 'adopt', reason: 'identical to core; tagged so later releases can update it', content };
    }
    if (!tag && generatedEarlier?.(current)) {
      return { path, category, coreHash, kind: 'update', reason: `${reason}, generated by an earlier release`, content, backup: true };
    }
  } else {
    if (current.equals(expected)) {
      return { path, category, coreHash, writtenHash, kind: 'unchanged', reason };
    }
    if (entry?.written === contentHash(current)) {
      return { path, category, coreHash, writtenHash, kind: 'update', reason: `${reason}, changed by core`, content };
    }
  }

  if (input.overwrite.has(path)) {
    return {
      path, category, coreHash, writtenHash,
      kind: 'update',
      reason: "customized; replaced with core's version by --overwrite",
      content,
      backup: true,
      customized: true,
    };
  }

  if (!taggable && entry === undefined) {
    return {
      path, category, coreHash,
      kind: 'keep',
      reason: 'differs from core, with no record of an earlier sync on this machine',
      undecided: true,
    };
  }

  return {
    path, category, coreHash,
    kind: 'keep',
    reason: tag ? 'changed since sync wrote it' : 'differs from core',
    customized: true,
    coreChanged: entry?.core !== coreHash,
  };
}

/**
 * A file in the project's src/app/ that core doesn't ship. Core's once - tagged for
 * this path, or with no tag style and still what the last sync wrote - and
 * untouched, it is removed; changed by the project, it is kept and reported.
 * Anything else, a copy of a generated file included, is the project's own file.
 */
function planRetiredFile(path: string, current: Buffer, input: SyncInput): SyncAction {
  const entry = input.state?.files[path];
  const tag = tagStyleFor(path, current) ? readGeneratedTag(current) : null;
  const ownTag = tag?.path === path ? tag : null;
  const writtenBySync = entry?.written !== undefined && entry.written === contentHash(current);

  if (!ownTag && !writtenBySync) {
    return { path, kind: 'keep', category: 'project', reason: "core doesn't ship it" };
  }

  if (writtenBySync || ownTag?.intact) {
    return { path, kind: 'delete', category: 'app', reason: 'core no longer ships it' };
  }

  if (input.overwrite.has(path)) {
    return { path, kind: 'delete', category: 'app', reason: 'core no longer ships it; removed by --overwrite', backup: true, customized: true };
  }

  return {
    path,
    kind: 'keep',
    category: 'app',
    reason: 'core no longer ships it, but it changed since sync wrote it',
    customized: true,
    coreChanged: input.state === null || entry !== undefined,
  };
}

/**
 * A PPR variant in the project's src/app/, which sync:app reads from core instead:
 * removed when it is what core ships or what sync wrote at that path, kept and
 * reported otherwise.
 */
function planVariant(file: string, current: Buffer, input: SyncInput): SyncAction {
  const path = `src/app/${file}`;
  const core = input.appTemplates.get(file);
  const coreHash = core ? contentHash(core) : undefined;
  const tag = readGeneratedTag(current);
  const ownTag = tag?.path === path ? tag : null;
  const reason = "PPR variants stay in core, where sync:app reads them when a project uses PPR";

  if (ownTag ? ownTag.intact : !tag && core !== undefined && sameText(current, core)) {
    return { path, kind: 'delete', category: 'variant', reason };
  }

  if (input.overwrite.has(path)) {
    return { path, kind: 'delete', category: 'variant', reason: `${reason}; removed by --overwrite`, backup: true, customized: true };
  }

  return {
    path,
    kind: 'keep',
    category: 'variant',
    reason: `${reason}, but this one differs from core's`,
    customized: true,
    coreChanged: input.state?.files[path]?.core !== coreHash,
    coreHash,
  };
}

function planAppFiles(input: SyncInput): SyncAction[] {
  const actions: SyncAction[] = [];
  const synced = new Set<string>();

  for (const [file, template] of input.appTemplates) {
    if (isGenerated(file) || isVariant(file)) continue;
    synced.add(file);
    const path = `src/app/${file}`;
    const planned = appFileContent(file, template, input);
    actions.push(
      'blockedBy' in planned
        ? { path, kind: 'keep', category: 'app', reason: 'left as it is', blockedBy: planned.blockedBy }
        : planManagedFile({ path, category: 'app', current: input.projectApp.get(file), expected: planned.content, reason: planned.reason }, input)
    );
  }

  for (const [file, current] of input.projectApp) {
    if (synced.has(file)) continue;
    if (isGenerated(file)) {
      actions.push({ path: `src/app/${file}`, kind: 'keep', category: 'generated', reason: 'generated by the registry build' });
    } else if (isVariant(file)) {
      actions.push(planVariant(file, current, input));
    } else {
      actions.push(planRetiredFile(`src/app/${file}`, current, input));
    }
  }

  return actions;
}

function planRootFiles(input: SyncInput): SyncAction[] {
  const actions: SyncAction[] = [];

  for (const name of ROOT_TEMPLATE_FILES) {
    const template = input.rootTemplates.get(name);
    if (!template) continue;
    actions.push(planManagedFile({ path: name, category: 'root', current: input.projectRootFiles.get(name), expected: template, reason: "core's file" }, input));
  }

  return actions;
}

function planProxy(input: SyncInput): SyncAction[] {
  const template = input.rootTemplates.get('proxy.ts');
  if (!template) return [];

  const source = template.toString('utf-8');
  const fileName = proxyFileNameFor(input.nextMajor);
  const other: ProxyFileName = fileName === 'proxy.ts' ? 'middleware.ts' : 'proxy.ts';
  const generatedEarlier = (current: Buffer) => isGeneratedProxySource(current.toString('utf-8'), source);

  const actions = [
    planManagedFile(
      {
        path: fileName,
        category: 'proxy',
        current: input.projectRootFiles.get(fileName),
        expected: Buffer.from(adaptProxySource(source, fileName)),
        reason: "core's proxy, under the name Next loads in this project",
        generatedEarlier,
      },
      input
    ),
  ];

  const otherContent = input.projectRootFiles.get(other);
  if (otherContent !== undefined) {
    const tag = readGeneratedTagAt(other, otherContent);
    if (tag ? tag.intact : generatedEarlier(otherContent)) {
      // Only a tag naming this path shows sync wrote exactly this file here; anything else is backed up first
      actions.push({ path: other, kind: 'delete', category: 'proxy', reason: `Next loads ${fileName} in this project instead`, ...(tag?.path ? {} : { backup: true }) });
    } else {
      actions.push({
        path: other,
        kind: 'keep',
        category: 'proxy',
        reason: `not core's; Next loads ${fileName} in this project, not this file`,
        customized: true,
        coreChanged: input.state === null || input.state.files[other] !== undefined,
      });
    }
  }

  return actions;
}

/**
 * The state to record after applying `actions`: what core had for each file it
 * manages, and what sync left of it. A file left as it is because core's
 * version couldn't be worked out keeps what was recorded before.
 */
export function nextSyncState(actions: readonly SyncAction[], input: SyncInput): SyncState {
  const files: Record<string, SyncStateEntry> = {};

  for (const action of actions) {
    if (action.blockedBy) {
      const previous = input.state?.files[action.path];
      if (previous) files[action.path] = previous;
      continue;
    }
    if (!action.coreHash || action.kind === 'delete') continue;
    const written = action.kind === 'keep' ? input.state?.files[action.path]?.written : action.writtenHash;
    files[action.path] = written ? { core: action.coreHash, written } : { core: action.coreHash };
  }

  return { coreVersion: input.coreVersion, files };
}

/**
 * The files under src/app/ that applying `actions` writes or removes, by path from
 * the project root: the content written, or null for a file removed.
 */
export function plannedAppFiles(actions: readonly SyncAction[]): Record<string, string | null> {
  const files: Record<string, string | null> = {};

  for (const { path, kind, content } of actions) {
    if (!path.startsWith('src/app/')) continue;
    const appPath = path.replace(/^src\//, '');
    if (kind === 'delete') {
      files[appPath] = null;
    } else if (content && (kind === 'create' || kind === 'update' || kind === 'adopt')) {
      files[appPath] = content.toString('utf-8');
    }
  }

  return files;
}

export interface ReportLine {
  text: string;
  tone: 'change' | 'warning' | 'muted';
}

/**
 * The report of a plan, one line per category: what core wrote or would write,
 * what was tagged, what was removed, what couldn't be worked out, what can't be
 * told apart, what the project changed, and what sync left to others. Under a
 * line, the files that changed are named. A customized file is named only when
 * core changed it since the last sync on this machine, so running sync again
 * with the same core doesn't repeat the list; --verbose names every file.
 */
export function describeSyncPlan(
  actions: readonly SyncAction[],
  { dryRun = false, verbose = false }: { dryRun?: boolean; verbose?: boolean } = {}
): ReportLine[] {
  const lines: ReportLine[] = [];
  const say = (past: string, future: string) => (dryRun ? future : past);

  const written = actions.filter(({ kind }) => kind === 'create' || kind === 'update');
  const adopted = actions.filter(({ kind }) => kind === 'adopt');
  const unchanged = actions.filter(({ kind }) => kind === 'unchanged');
  const removed = actions.filter(({ kind }) => kind === 'delete');
  const blocked = actions.filter(({ blockedBy }) => blockedBy);
  const undecided = actions.filter(({ undecided }) => undecided);
  const customized = actions.filter(({ kind, customized }) => kind === 'keep' && customized);
  const project = actions.filter(({ category }) => category === 'project');
  const generated = actions.filter(({ category }) => category === 'generated');

  lines.push({
    tone: 'muted',
    text: `${say('Wrote', 'Would write')} ${written.length} file(s) from core; ${unchanged.length} already ${say('matched', 'match')} core`,
  });
  for (const action of written) {
    lines.push({ tone: 'change', text: `  ${action.kind === 'create' ? '+' : '~'} ${action.path} (${action.reason})` });
  }
  if (verbose) {
    for (const action of unchanged) lines.push({ tone: 'muted', text: `  = ${action.path}` });
  }

  if (adopted.length > 0) {
    lines.push({ tone: 'muted', text: `${say('Tagged', 'Would tag')} ${adopted.length} file(s) identical to core, so later releases can update them` });
    if (verbose) {
      for (const action of adopted) lines.push({ tone: 'muted', text: `  # ${action.path}` });
    }
  }

  if (removed.length > 0) {
    lines.push({ tone: 'change', text: `${say('Removed', 'Would remove')} ${removed.length} file(s)` });
    for (const action of removed) lines.push({ tone: 'change', text: `  - ${action.path} (${action.reason})` });
  }

  if (blocked.length > 0) {
    lines.push({ tone: 'warning', text: `${say('Left', 'Would leave')} ${blocked.length} file(s) untouched: core's version of them can't be worked out for this project` });
    for (const action of blocked) lines.push({ tone: 'warning', text: `  ! ${action.path} (${action.blockedBy})` });
  }

  if (undecided.length > 0) {
    lines.push({
      tone: 'warning',
      text: `${say('Kept', 'Would keep')} ${undecided.length} file(s) that differ from core, with no record of an earlier sync on this machine: sync can't tell whether each is an older version of core's or the project's own change`,
    });
    for (const action of undecided) {
      lines.push({ tone: 'warning', text: `  ? ${action.path} (to take core's version, backing this one up first: nextspark sync:app --overwrite ${action.path})` });
    }
  }

  if (customized.length > 0) {
    const changedByCore = customized.filter(({ coreChanged }) => coreChanged);
    lines.push({
      tone: changedByCore.length > 0 ? 'warning' : 'muted',
      text:
        changedByCore.length > 0
          ? `Kept ${customized.length} customized file(s); core changed ${changedByCore.length} of them since the last sync`
          : `Kept ${customized.length} customized file(s); core changed none of them since the last sync`,
    });
    for (const action of verbose ? customized : changedByCore) {
      lines.push({ tone: 'warning', text: `  ! ${action.path} (${action.reason})` });
    }
    if (changedByCore.length > 0) {
      lines.push({ tone: 'muted', text: "  To take core's version of one: nextspark sync:app --overwrite <path> (the current file is backed up first)" });
    }
  }

  if (project.length > 0) {
    lines.push({ tone: 'muted', text: `Left ${project.length} file(s) in src/app/ that core doesn't ship` });
    if (verbose) {
      for (const action of project) lines.push({ tone: 'muted', text: `  . ${action.path}` });
    }
  }

  if (generated.length > 0) {
    lines.push({ tone: 'muted', text: `Left ${generated.length} file(s) in src/app/(templates) to the registry build` });
  }

  return lines;
}
