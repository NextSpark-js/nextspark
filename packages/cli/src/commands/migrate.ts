import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import * as tar from 'tar';
import { readGeneratedTagAt } from '../utils/generated-tag.js';
import { apiUrlMoves, applyAppConversion, assertContained, declareWebhookExtensions, loadCoreHost, planAppConversion, unrecognizedLines, type ApiUrlMove, type AppConversionPlan } from '../utils/app-tree.js';
import { coreHostMode, runHostPreparation } from '../utils/preparation.js';
import { closingBrace, sourceView, type SourceView } from '../utils/source-view.js';
import { getNextMajorVersion } from '../utils/next-bundler.js';
import { COMPAT_NOTE, addCompatRewrites, applyContractsPackage, catalogVersion, checkNextRange, compatRewrites, coreExportsSpecifier, countBlockThumbnails, inAiWorkflowDirectory, isBlockConfig, hostFrameworkFixes, memberPeerUpdates, removeBlockThumbnails, planContractsPackage, updateHostFramework, updateNextRange, updatePeerRanges, type CompatRewrite, type HostFrameworkFix, type ContractsPlan, type NextRangeCheck, type PeerNote, type PeerUpdate } from '../utils/migrate-extras.js';
import { pathToFileURL } from 'node:url';
import { adaptProxySource, planProxyFile, type ProxyFileName } from '../utils/proxy-file.js';
import { contentHash, readSyncState } from '../utils/sync-state.js';

interface MigrateOptions {
  dryRun?: boolean;
  /** `--no-prepare` sets this to false: convert the files, but do not run nextspark prepare afterwards. */
  prepare?: boolean;
  json?: boolean;
  yes?: boolean;
  /** `--no-simulate` sets this to false: a dry run does not convert a copy to run the host plan. */
  simulate?: boolean;
  /** Hidden: proof that this process is the simulation's child (see simulationVerified). */
  simulationNonce?: string;
}

interface FileChange {
  path: string;
  changedLines: number;
}

interface ToolingReference {
  path: string;
  kind: string;
  line: number;
  text: string;
  relativeDepth: boolean;
}

interface MigrateReport {
  hostRoot: { path: string; reason: string };
  warnings: string[];
  versions: {
    packageManager: { value: string | null; source: string | null };
    members: { path: string; packages: Record<string, string> }[];
    drift: boolean;
    driftVersions: string[];
  };
  activeTheme: {
    name: string | null;
    source: 'environment' | '.env.example' | null;
    themes: { name: string; files: number }[];
    plugins: { name: string; files: number }[];
  };
  appTemplates: {
    /** The app tree that is converted, when there is one no generation owns. */
    root: 'app' | 'src/app' | null;
    generated: string[];
    generatedBySyncState: string[];
    generatedByLegacyRegistry: string[];
    generatedByPreviousTemplate: string[];
    previousTemplateVersion: string | null;
    previousTemplateVersionSource: string | null;
    previousTemplateMethod: 'pnpm view tarball' | null;
    previousTemplateUnavailableReason: string | null;
    /** Files no evidence proves generated: the conversion decides what each one is. */
    unproven: number;
  };
  appConversion: {
    root: 'app' | 'src/app' | null;
    removed: { path: string; evidence: string }[];
    loaders: { path: string; template: string | null }[];
    overrides: { path: string; destination: string; core: string; baseline: string | null; diffLines: number; diff: string }[];
    projectFiles: { path: string; destination: string }[];
    webhookExtensions: { provider: string; module: string }[];
    /** What stops the migration before it writes anything. */
    blockers: string[];
    /** The blockers that also make it impossible to convert a copy for the host simulation (symbolic links, file collisions). */
    unsimulable: string[];
  };
  apiUrlMoves: ApiUrlMove[];
  rootProxyFiles: {
    generated: string[];
    customizations: string[];
  };
  routeRootGuard: {
    currentRoots: string[];
    checkedAfterMigration: boolean;
  };
  config: { plannedCreation: boolean; plugins: string[] };
  envExample: { action: 'none' | 'move' | 'deduplicate' | 'conflict'; path: string | null };
  coreScripts: { renamed: string[]; warnings: string[] };
  rootTemplates: {
    available: boolean;
    identical: string[];
    modified: FileChange[];
    missing: string[];
    generatorImportRewriteWarnings: string[];
  };
  imports: { themeOccurrences: number; themeFiles: number; pluginOccurrences: number; pluginFiles: number };
  toolingReferences: ToolingReference[];
  collisions: {
    reserved: { path: string; reason: string }[];
    files: { path: string; identical: boolean }[];
    /** L3: theme documents that move under another name because the project has a different file at their place. */
    renamed: { from: string; to: string }[];
  };
  untracked: string[];
  siblingThemeReferences: { path: string; occurrences: number }[];
  /** The native Next rewrites for the old API URLs, kept for already-installed clients. */
  compatRewrites: { entries: CompatRewrite[]; file: string | null; note: string };
  /** Old API URLs in sibling workspaces (mobile/, packages/*, ...): reported, not rewritten. */
  siblingApiUrlReferences: { path: string; occurrences: number }[];
  nextRange: NextRangeCheck;
  /** L8: peer ranges of the other workspace members that the generated host would not satisfy (--yes updates them). */
  memberPeers: { path: string; updates: PeerUpdate[]; /** Ranges that do not accept the target but reach higher: reported, never lowered. */ kept: PeerNote[] }[];
  /** L8: a copy of next / react / react-dom installed under a workspace member that differs from the host's. */
  duplicateCopies: { member: string; name: string; version: string; host: string }[];
  /** N5: the host's react / react-dom ranges that keep it on an older copy than its members resolve (--yes raises the plain ones). */
  hostFramework: HostFrameworkFix[];
  /** Old references inside AI-workflow directories: listed, never rewritten. */
  aiWorkflowReferences: { path: string; occurrences: number }[];
  contractsPackage: { needed: boolean; path: string; mobile: string | null; skipped: string | null; /** False when the directory already exists (without a package.json): rollback then removes only the files migrate writes. */ createsDirectory: boolean };
  /** Block configs whose old `thumbnail: "/theme/blocks/..."` line is removed (BlockConfig.thumbnail is the registry's import now). */
  blockThumbnails: { path: string; lines: number }[];
  /** What the generated host says about the converted layout (a dry run converts a temporary copy). */
  hostPlan: {
    simulated: boolean;
    /** Diagnostics that would stop the generation (the Next.js version ones are reported under nextRange). */
    conflicts: string[];
    /** App files a blocker keeps out of the converted copy: their routes are not in the plan below. */
    leftOut: string[];
    /** Information from the plan, e.g. NS_HOST_ENTITY_ROUTES_REPLACED. */
    notices: string[];
    /** True when the plan was simulated with blockers still open: `conflicts: []` is then not a clean bill. */
    partial: boolean;
    /** What ran, for `predictHost`: plan, emission, grammar, ownership, contracts, registries. */
    checks: Record<string, string> | null;
    /** The core's `predictHost`, or `prepare` run on the copy when the installed core has no predictHost. */
    method: 'predictHost' | 'prepare' | null;
    /** True when the prediction was attempted and failed: the plan is unknown, not clean. */
    unknown: boolean;
    reason: string | null;
  };
}

class MigrateAnalysisError extends Error {}
class MissingThemeStylesheetDependencyError extends MigrateAnalysisError {}

function pathFrom(root: string, file: string): string {
  const value = relative(root, file).split(sep).join('/');
  return value === '' ? '.' : value;
}

function isEnvironmentFile(name: string): boolean {
  return name === '.env' || name.startsWith('.env.');
}

/** Lists ordinary files only, keeping scanner reads inside the repository. */
function filesIn(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  // This is an explicitly archived, non-source area.  Do not rewrite or scan
  // its old imports while migrating the live project.
  const ignoredDirectories = new Set(['.git', 'node_modules', '.next', '.nextspark', 'dist', 'build', 'out', '.turbo', 'coverage', 'legacy-app-customizations']);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name) || isEnvironmentFile(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  visit(root);
  const ignored = gitIgnoredPaths(root, files);
  return files.filter(file => !ignored.has(pathFrom(root, file)));
}

/** Move planning must include examples and other environment-shaped files,
 * while all content readers intentionally continue to leave them unread. */
function moveFilesIn(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const ignoredDirectories = new Set(['.git', 'node_modules', '.next', '.nextspark', 'dist', 'build', 'out', '.turbo', 'coverage', 'legacy-app-customizations']);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  visit(root);
  return files;
}

/** Legacy app output must include ignored generated routes so app/ can become truly empty. */
function legacyAppFilesIn(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const ignoredDirectories = new Set(['.git', 'node_modules', '.next', '.nextspark', 'dist', 'build', 'out', '.turbo', 'coverage']);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name) || isEnvironmentFile(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  visit(root);
  return files;
}

/** Symbolic links (file or directory) anywhere in an app tree, from the project root: nothing can move them safely. */
function symlinksIn(root: string): string[] {
  if (!existsSync(root)) return [];
  const found: string[] = [];
  const skipped = new Set(['.git', 'node_modules', '.next', '.nextspark', 'dist', 'build', 'out', '.turbo', 'coverage']);
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (skipped.has(entry.name)) continue;
      const file = join(directory, entry.name);
      if (entry.isSymbolicLink()) found.push(file);
      else if (entry.isDirectory()) visit(file);
    }
  };
  visit(root);
  return found;
}

/** Ask git about a small batch without reading the contents of ignored files. */
function gitIgnoredPaths(root: string, files: string[]): Set<string> {
  if (files.length === 0) return new Set();
  const paths = files.map(file => pathFrom(root, file));
  try {
    const output = execFileSync('git', ['check-ignore', '-z', '--stdin'], {
      cwd: root,
      encoding: 'utf8',
      input: `${paths.join('\0')}\0`,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return new Set(output.split('\0').filter(Boolean));
  } catch {
    return new Set();
  }
}

function fileCount(directory: string): number {
  return filesIn(directory).length;
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function packageNextDependencyKind(pkg: Record<string, unknown>): 'runtime' | 'development' | null {
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = pkg[section];
    if (typeof dependencies === 'object' && dependencies !== null && Object.prototype.hasOwnProperty.call(dependencies, 'next')) return 'runtime';
  }
  const developmentDependencies = pkg.devDependencies;
  return typeof developmentDependencies === 'object' && developmentDependencies !== null && Object.prototype.hasOwnProperty.call(developmentDependencies, 'next')
    ? 'development'
    : null;
}

function packageNextsparkVersions(pkg: Record<string, unknown>): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const dependencies = pkg[section];
    if (typeof dependencies !== 'object' || dependencies === null) continue;
    for (const [name, version] of Object.entries(dependencies)) {
      if (name.startsWith('@nextsparkjs/') && typeof version === 'string') versions[name] = version;
    }
  }
  return versions;
}

/**
 * A simple npm range with only ^ or ~ resolves from the same concrete base
 * release as its bare form. Keep unfamiliar ranges verbatim: guessing their
 * resolution would hide real migration drift.
 */
function normalizedDeclaredVersion(version: string): string {
  const match = version.trim().match(/^[~^]?v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?)$/);
  return match?.[1] ?? version.trim();
}

function packageFiles(repositoryRoot: string): string[] {
  // an AI-workflow directory's package.json is not a workspace member
  return filesIn(repositoryRoot).filter(file => basename(file) === 'package.json' && !inAiWorkflowDirectory(repositoryRoot, file));
}

function nextConfigFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter(entry => entry.isFile() && /^next\.config\.[^.]+$/.test(entry.name))
    .map(entry => join(directory, entry.name))
    .sort();
}

function resolveHostRoot(repositoryRoot: string, cwd: string): { root: string; reason: string } {
  const candidates = new Map<string, { pkg: Record<string, unknown> | null; config: string[] }>();
  for (const manifest of packageFiles(repositoryRoot)) {
    const directory = dirname(manifest);
    candidates.set(directory, { pkg: readJson(manifest), config: nextConfigFiles(directory) });
  }
  for (const file of filesIn(repositoryRoot).filter(file => /^next\.config\.[^.]+$/.test(basename(file)))) {
    const directory = dirname(file);
    const existing = candidates.get(directory);
    candidates.set(directory, { pkg: existing?.pkg ?? readJson(join(directory, 'package.json')), config: [...(existing?.config ?? []), file] });
  }

  const scored = [...candidates.entries()]
    .map(([directory, candidate]) => {
      const nextDependency = candidate.pkg === null ? null : packageNextDependencyKind(candidate.pkg);
      const hasWorkspace = existsSync(join(directory, 'pnpm-workspace.yaml'));
      const hasLockfile = existsSync(join(directory, 'pnpm-lock.yaml'));
      // A runtime Next dependency plus a local config and lockfile is much
      // stronger deployment evidence than a root-level dev tool dependency.
      const score = (nextDependency === 'runtime' ? 6 : nextDependency === 'development' ? 1 : 0)
        + (candidate.config.length > 0 ? 5 : 0)
        + (hasWorkspace ? 1 : 0)
        + (hasLockfile ? 3 : 0);
      const underCwd = cwd === directory || cwd.startsWith(`${directory}${sep}`);
      const depth = pathFrom(repositoryRoot, directory).split('/').filter(part => part !== '.').length;
      return { directory, candidate, nextDependency, hasWorkspace, hasLockfile, score, underCwd, depth };
    })
    .filter(candidate => candidate.score >= 3)
    .sort((left, right) => right.score - left.score
      || Number(right.underCwd) - Number(left.underCwd)
      || left.depth - right.depth
      || pathFrom(repositoryRoot, left.directory).localeCompare(pathFrom(repositoryRoot, right.directory)));
  const selected = scored[0];
  if (!selected) throw new MigrateAnalysisError('No Next.js host found. Expected a package that depends on next or a next.config.* file.');

  const reasons: string[] = [];
  if (selected.candidate.config.length > 0) reasons.push(`has ${basename(selected.candidate.config[0])}`);
  if (selected.nextDependency === 'runtime') reasons.push('package.json depends on next');
  if (selected.nextDependency === 'development') reasons.push('package.json has next only in devDependencies');
  if (selected.hasWorkspace) reasons.push('has its own pnpm workspace metadata');
  if (selected.hasLockfile) reasons.push('has its own pnpm lockfile');
  const tiedSignals = scored.filter(candidate => candidate.score === selected.score);
  if (tiedSignals.length > 1) {
    const alternatives = tiedSignals.filter(candidate => candidate !== selected).map(candidate => pathFrom(repositoryRoot, candidate.directory));
    const tieBreak = tiedSignals.some(candidate => candidate.underCwd !== selected.underCwd)
      ? 'the directory containing the current working directory'
      : tiedSignals.some(candidate => candidate.depth !== selected.depth)
        ? 'the shallowest path'
        : 'lexicographic path order';
    reasons.push(`ambiguous host signals with ${alternatives.join(', ')}; selected by ${tieBreak}`);
  }
  return { root: selected.directory, reason: reasons.join('; ') };
}

function countOccurrences(text: string, expression: RegExp): number {
  return [...text.matchAll(expression)].length;
}

function changedLines(left: Buffer, right: Buffer): number {
  if (left.equals(right)) return 0;
  const leftText = left.toString('utf8');
  const rightText = right.toString('utf8');
  if (leftText.includes('\uFFFD') || rightText.includes('\uFFFD')) return 1;
  const leftLines = leftText.split(/\r?\n/);
  const rightLines = rightText.split(/\r?\n/);
  if (leftLines.length * rightLines.length > 2_000_000) return leftLines.length + rightLines.length;
  const previous = new Uint32Array(rightLines.length + 1);
  const current = new Uint32Array(rightLines.length + 1);
  for (const leftLine of leftLines) {
    for (let index = 1; index <= rightLines.length; index++) {
      current[index] = leftLine === rightLines[index - 1]
        ? previous[index - 1] + 1
        : Math.max(previous[index], current[index - 1]);
    }
    previous.set(current);
    current.fill(0);
  }
  return leftLines.length + rightLines.length - 2 * previous[rightLines.length];
}

/** Template output may cross a platform boundary; only newline encoding is immaterial. */
function matchesTemplateBytes(content: Buffer, template: Buffer): boolean {
  const normalizeLineEndings = (bytes: Buffer): Buffer => {
    const normalized: number[] = [];
    for (let index = 0; index < bytes.length; index++) {
      if (bytes[index] === 13 && bytes[index + 1] === 10) continue;
      normalized.push(bytes[index]);
    }
    return Buffer.from(normalized);
  };
  return content.equals(template) || normalizeLineEndings(content).equals(normalizeLineEndings(template));
}

function templateDirectory(hostRoot: string, repositoryRoot: string): string | null {
  let directory = hostRoot;
  while (true) {
    const candidate = join(directory, 'node_modules', '@nextsparkjs', 'core', 'templates');
    if (existsSync(candidate)) return candidate;
    if (directory === repositoryRoot) break;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

interface PreviousTemplates {
  version: string;
  method: 'pnpm view tarball';
  files: Map<string, Buffer>;
  rootFiles: Map<string, Buffer>;
}

interface PreviousTemplateLookup {
  templates: PreviousTemplates | null;
  unavailableReason: string | null;
  /** True when the lookup failed on the network (timeout, connection), so rerunning with network access can help. */
  networkFailure?: boolean;
}

interface CoreVersionEvidence {
  version: string;
  source: string;
}

const previousTemplatesCache = new Map<string, PreviousTemplateLookup>();
const DEFAULT_PREVIOUS_CORE_NETWORK_TIMEOUT_MS = 10_000;

/** One deadline shared by every network step of the historical-core lookup, so the wait is bounded in total. */
interface NetworkBudget {
  total: number;
  left(): number;
}

function networkBudget(total: number): NetworkBudget {
  const deadline = Date.now() + total;
  return { total, left: () => Math.max(1, deadline - Date.now()) };
}

/** A failed historical-core lookup; `network` says whether rerunning with network access can fix it. */
class PreviousTemplateLookupError extends Error {
  constructor(message: string, readonly network: boolean) {
    super(message);
  }
}

class PreviousTemplateTimeoutError extends PreviousTemplateLookupError {
  constructor(step: string, timeoutMs: number) {
    super(`timed out after ${timeoutMs}ms while ${step}`, true);
  }
}

function previousCoreNetworkTimeoutMs(): number {
  const configured = Number(process.env.NEXTSPARK_MIGRATE_NETWORK_TIMEOUT_MS);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : DEFAULT_PREVIOUS_CORE_NETWORK_TIMEOUT_MS;
}

function didProcessTimeOut(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (('code' in error && error.code === 'ETIMEDOUT') || ('signal' in error && error.signal === 'SIGTERM'));
}

function coreVersionFromSpecifier(specifier: string): string | null {
  const normalized = normalizedDeclaredVersion(specifier);
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(normalized)) return normalized;
  // pnpm records local tarballs as file: paths. `.tgz` is syntactically a
  // valid semver prerelease suffix, so matching the raw path turns
  // `core-0.1.0-beta.192.tgz` into the fictitious version
  // `0.1.0-beta.192.tgz`. Strip archive suffixes before extracting the
  // release embedded in the filename.
  const withoutQuery = specifier.trim().replace(/[?#].*$/, '');
  const archiveSuffix = /\.(?:tar\.gz|tgz)(?=$|\()/i.exec(withoutQuery);
  const withoutArchiveSuffix = archiveSuffix ? withoutQuery.slice(0, archiveSuffix.index) : withoutQuery;
  return withoutArchiveSuffix.match(/(?:^|[^0-9])(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:[^0-9A-Za-z.-]|$)/)?.[1] ?? null;
}

function exactCoreVersionFromSpecifier(specifier: string): string | null {
  const trimmed = specifier.trim();
  if (/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(trimmed)) return trimmed.replace(/^v/, '');
  if (/^(?:file|link):/.test(trimmed)) return coreVersionFromSpecifier(trimmed);
  return null;
}

function declaredCoreVersion(hostPackage: Record<string, unknown> | null | undefined): string | null {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const version = (hostPackage?.[section] as Record<string, unknown> | undefined)?.['@nextsparkjs/core'];
    if (typeof version !== 'string') continue;
    const normalized = coreVersionFromSpecifier(version);
    if (normalized) return normalized;
  }
  return null;
}

function coreVersionFromLockfile(content: string, importer: string): string | null {
  const escapedImporter = importer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const importerMatch = new RegExp(`^  ['"]?${escapedImporter}['"]?:[ \\t]*$`, 'm').exec(content);
  if (!importerMatch) return null;
  const importerStart = importerMatch.index + importerMatch[0].length;
  const importerTail = content.slice(importerStart);
  const nextImporter = /^  \S.*:[ \t]*$/m.exec(importerTail);
  const importerBlock = importerTail.slice(0, nextImporter?.index ?? importerTail.length);
  const marker = /^[ \t]+['"]?@nextsparkjs\/core['"]?:[ \t]*$/gm;
  for (const match of importerBlock.matchAll(marker)) {
    const block = importerBlock.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 600);
    const resolved = block.match(/^\s+version:\s*([^\n#]+)/m)?.[1]?.trim();
    const specifier = block.match(/^\s+specifier:\s*([^\n#]+)/m)?.[1]?.trim();
    const version = coreVersionFromSpecifier(resolved ?? '') ?? (specifier ? exactCoreVersionFromSpecifier(specifier) : null);
    if (version) return version;
  }
  return null;
}

function gitFile(repository: string, commit: string, path: string): string | null {
  try {
    return execFileSync('git', ['show', `${commit}:${path}`], { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** Find the last core release the committed project used, before its installed/current release. */
function previousCoreVersion(repository: string, hostRoot: string, currentVersion: string | null): CoreVersionEvidence | null {
  if (!currentVersion) return null;
  const packagePath = pathFrom(repository, join(hostRoot, 'package.json'));
  const lockEntries: { path: string; importer: string }[] = [];
  let lockDirectory = hostRoot;
  while (true) {
    lockEntries.push({
      path: pathFrom(repository, join(lockDirectory, 'pnpm-lock.yaml')),
      importer: pathFrom(lockDirectory, hostRoot),
    });
    if (lockDirectory === repository) break;
    const parent = dirname(lockDirectory);
    if (parent === lockDirectory) break;
    lockDirectory = parent;
  }
  const uniqueLocks = [...new Map(lockEntries.map(entry => [entry.path, entry])).values()];
  const historyPaths = [packagePath, ...uniqueLocks.map(entry => entry.path)];
  let commits: string[];
  try {
    commits = execFileSync('git', ['rev-list', '--max-count=50', 'HEAD', '--', ...historyPaths], {
      cwd: repository,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').filter(Boolean);
  } catch {
    return null;
  }
  for (const commit of commits) {
    for (const lock of uniqueLocks) {
      const lockContent = gitFile(repository, commit, lock.path);
      const lockVersion = lockContent ? coreVersionFromLockfile(lockContent, lock.importer) : null;
      if (lockVersion && lockVersion !== currentVersion) {
        return { version: lockVersion, source: `git ${commit.slice(0, 8)}:${lock.path}` };
      }
    }
    const packageContent = gitFile(repository, commit, packagePath);
    const historicalPackage = packageContent ? readJsonText(packageContent) : null;
    const packageSpecifier = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']
      .map(section => (historicalPackage?.[section] as Record<string, unknown> | undefined)?.['@nextsparkjs/core'])
      .find((value): value is string => typeof value === 'string');
    const packageVersion = packageSpecifier ? exactCoreVersionFromSpecifier(packageSpecifier) : null;
    if (packageVersion && packageVersion !== currentVersion) {
      return { version: packageVersion, source: `git ${commit.slice(0, 8)}:${packagePath}` };
    }
  }
  return null;
}

function readJsonText(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function installedCoreVersion(templates: string | null): string | null {
  if (!templates) return null;
  const pkg = readJson(join(dirname(templates), 'package.json'));
  return typeof pkg?.version === 'string' ? pkg.version : null;
}

function templateFiles(root: string): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const file of filesIn(root)) files.set(pathFrom(root, file), readFileSync(file));
  return files;
}

async function templatesFromCoreArchive(archive: string, directory: string, version: string, method: PreviousTemplates['method']): Promise<PreviousTemplates | null> {
  const unpack = join(directory, 'downloaded');
  mkdirSync(unpack, { recursive: true });
  await tar.x({ file: archive, cwd: unpack });
  const packageRoot = join(unpack, 'package');
  const manifest = readJson(join(packageRoot, 'package.json'));
  if (manifest?.name !== '@nextsparkjs/core' || manifest.version !== version) return null;
  const templatesRoot = [join(packageRoot, 'templates'), join(packageRoot, 'dist', 'templates')]
    .find(candidate => existsSync(candidate));
  const appRoot = templatesRoot && join(templatesRoot, 'app');
  if (!appRoot) return null;
  const files = templateFiles(appRoot);
  const rootFiles = new Map<string, Buffer>();
  for (const name of ['proxy.ts'] as const) {
    const file = join(templatesRoot, name);
    if (existsSync(file)) rootFiles.set(name, readFileSync(file));
  }
  return files.size > 0 ? { version, method, files, rootFiles } : null;
}

function pnpmConfigValue(key: string, directory: string, environment: NodeJS.ProcessEnv, budget: NetworkBudget): string | null {
  try {
    const value = execFileSync('pnpm', ['config', 'get', key, '--ignore-workspace'], {
      cwd: directory,
      env: environment,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: budget.left(),
    }).trim();
    return value === '' || value === 'undefined' || value === 'null' ? null : value;
  } catch (error) {
    if (didProcessTimeOut(error)) throw new PreviousTemplateTimeoutError('reading pnpm configuration', budget.total);
    return null;
  }
}

function configuredCoreRegistry(directory: string, environment: NodeJS.ProcessEnv, budget: NetworkBudget): URL | null {
  const configured = pnpmConfigValue('@nextsparkjs:registry', directory, environment, budget)
    ?? pnpmConfigValue('registry', directory, environment, budget);
  if (!configured) return null;
  try {
    return new URL(configured);
  } catch {
    return null;
  }
}

function approvedTarballUrl(value: string, directory: string, environment: NodeJS.ProcessEnv, budget: NetworkBudget): URL {
  let tarball: URL;
  try {
    tarball = new URL(value);
  } catch {
    throw new PreviousTemplateLookupError('pnpm did not return a valid tarball URL', false);
  }
  if (tarball.protocol === 'https:') return tarball;
  const registry = configuredCoreRegistry(directory, environment, budget);
  if (tarball.protocol !== 'http:' || registry?.protocol !== 'http:' || registry.host !== tarball.host) {
    throw new PreviousTemplateLookupError('pnpm did not return an HTTPS tarball URL or an HTTP URL from the configured registry host', false);
  }
  return tarball;
}

function tarballAuthorization(tarball: URL, directory: string, environment: NodeJS.ProcessEnv, budget: NetworkBudget): string | null {
  const prefix = `//${tarball.host}/:`;
  const token = pnpmConfigValue(`${prefix}_authToken`, directory, environment, budget);
  if (token) return `Bearer ${token}`;
  const auth = pnpmConfigValue(`${prefix}_auth`, directory, environment, budget);
  if (auth) return `Basic ${auth}`;
  const username = pnpmConfigValue(`${prefix}username`, directory, environment, budget);
  const encodedPassword = pnpmConfigValue(`${prefix}_password`, directory, environment, budget);
  if (!username || !encodedPassword) return null;
  try {
    return `Basic ${Buffer.from(`${username}:${Buffer.from(encodedPassword, 'base64').toString('utf8')}`).toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Look up an earlier core after the cheap local evidence has left a legacy
 * app file unclassified. pnpm pack only creates an archive for the current
 * directory; it does not retrieve a remote package. Resolve the exact tarball
 * with pnpm instead. Failure is deliberately non-fatal: old files remain
 * conservative customizations and the report says why.
 */
async function previousCoreTemplates(version: string | null, currentVersion: string | null): Promise<PreviousTemplateLookup> {
  if (!version || version === currentVersion) return { templates: null, unavailableReason: null };
  const cached = previousTemplatesCache.get(version);
  if (cached !== undefined) return cached;

  const directory = mkdtempSync(join(tmpdir(), 'nextspark-migrate-core-'));
  const budget = networkBudget(previousCoreNetworkTimeoutMs());
  try {
    // Never let a project's workspace policies influence this historical
    // lookup. In particular, pnpm 12 can apply minimumReleaseAge and build
    // policies to pack even though view succeeded a moment earlier.
    const environment = {
      ...process.env,
      // Keep the caller's registry, auth, and HOME/.npmrc configuration.
      // Only the workspace policy is deliberately bypassed for this isolated
      // historical-package lookup.
      npm_config_ignore_workspace: 'true',
      NPM_CONFIG_IGNORE_WORKSPACE: 'true',
      // What bounds the wait is the shared time budget: every step is killed at its deadline. These only
      // shorten pnpm's own retries so a failure can show before it. pnpm 9/10 read the npm_config_*
      // spelling and pnpm 12 only pnpm_config_*, so both are set; a caller's own setting wins.
      ...Object.fromEntries(Object.entries({ fetch_retries: '1', fetch_retry_mintimeout: '500', fetch_retry_maxtimeout: '2000' }).flatMap(([key, fallback]) => {
        const value = [`npm_config_${key}`, `NPM_CONFIG_${key.toUpperCase()}`, `pnpm_config_${key}`, `PNPM_CONFIG_${key.toUpperCase()}`]
          .map(name => process.env[name]).find(entry => entry !== undefined) ?? fallback;
        return [[`npm_config_${key}`, value], [`pnpm_config_${key}`, value]];
      })),
    };
    let url: string;
    try {
      url = execFileSync('pnpm', ['view', `@nextsparkjs/core@${version}`, 'dist.tarball', '--ignore-workspace'], {
        cwd: directory,
        env: environment,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: budget.left(),
      }).trim();
    } catch (viewError) {
      if (didProcessTimeOut(viewError)) throw new PreviousTemplateTimeoutError('running pnpm view', budget.total);
      // The registry answered and said no: rerunning with network access will not change that. pnpm 12
      // words a 401/403 as a "client error" under ERR_PNPM_RESOLVING_NPM_RESOLVER_NETWORK_ERROR and a
      // missing version as ERR_PNPM_PACKAGE_NOT_FOUND; pnpm 9/10 hand `view` to npm (E401, E403, E404).
      const stderr = String((viewError as { stderr?: unknown }).stderr ?? '');
      if (/client error \(40[13]\b|\bE40[13]\b|ERR_PNPM_FETCH_40[13]/.test(stderr)) {
        throw new PreviousTemplateLookupError(`the registry refused the credentials for @nextsparkjs/core@${version} (HTTP 401/403); check the registry token`, false);
      }
      if (/client error \(404\b|\bE404\b|\bETARGET\b|ERR_PNPM_FETCH_404|ERR_PNPM_PACKAGE_NOT_FOUND|ERR_PNPM_NO_MATCHING_VERSION/.test(stderr)) {
        throw new PreviousTemplateLookupError(`the registry does not serve @nextsparkjs/core@${version}`, false);
      }
      throw viewError;
    }
    const tarball = approvedTarballUrl(url, directory, environment, budget);
    const authorization = tarballAuthorization(tarball, directory, environment, budget);
    const signal = AbortSignal.timeout(budget.left());
    let response: Response;
    try {
      // The URL came from pnpm's configured registry. Reuse credentials only
      // for that exact URL host so private-registry tarballs work without
      // leaking an npm token to another host.
      response = await fetch(tarball, { signal, headers: authorization ? { authorization } : undefined });
    } catch (fetchError) {
      if (signal.aborted) throw new PreviousTemplateTimeoutError('fetching the core tarball', budget.total);
      throw fetchError;
    }
    if (!response.ok) {
      throw new PreviousTemplateLookupError(
        `the registry answered ${response.status} for the core tarball`,
        response.status >= 500 || response.status === 408 || response.status === 429,
      );
    }
    const archive = join(directory, 'core.tgz');
    writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
    let templates: PreviousTemplates | null;
    try {
      templates = await templatesFromCoreArchive(archive, directory, version, 'pnpm view tarball');
    } catch {
      throw new PreviousTemplateLookupError('the downloaded core package could not be unpacked', false);
    }
    const result = {
      templates,
      unavailableReason: templates ? null : 'downloaded package identity or templates/app did not match the requested core release',
      networkFailure: false,
    };
    previousTemplatesCache.set(version, result);
    return result;
  } catch (error) {
    const result = error instanceof PreviousTemplateLookupError
      ? { templates: null, unavailableReason: error.message, networkFailure: error.network }
      // pnpm or fetch failed without an answer from the registry: a connection problem
      : { templates: null, unavailableReason: 'pnpm could not retrieve or unpack the package', networkFailure: true };
    previousTemplatesCache.set(version, result);
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * The app tree the migration converts: `app/` (before the src/ layout) or `src/app/` (what the
 * wizard and `sync:app` wrote), unless a generation owns `src/app` (`.nextspark/generation.json`)
 * or it holds nothing. Both at once is ambiguous: Next.js would take `app/` and ignore `src/app`.
 */
async function appRootFor(hostRoot: string, coreDirectory: string | null): Promise<'app' | 'src/app' | null> {
  const legacy = existsSync(join(hostRoot, 'app'));
  const hasFiles = legacyAppFilesIn(join(hostRoot, 'src', 'app')).length > 0;
  // Ownership is core's decision: a record it validates, not the mere presence of a file. Without a
  // core that decides (an old one), an existing record is the best evidence there is.
  const mode = coreDirectory ? (await coreHostMode(coreDirectory, hostRoot)).mode : 'no-manifest';
  const source = mode === 'no-manifest'
    ? hasFiles && !existsSync(join(hostRoot, '.nextspark', 'generation.json'))
    : mode === 'legacy-app';
  if (legacy && source) throw new MigrateAnalysisError('Both app/ and src/app/ hold files; Next.js only reads app/. Remove or merge one of them, then run migrate again.');
  return legacy ? 'app' : source ? 'src/app' : null;
}

/** The expensive old-template lookup is only useful for files local evidence cannot classify. */
function hasUnclassifiedLegacyAppFiles(hostRoot: string, root: 'app' | 'src/app' | null): boolean {
  if (!root) return false;
  const appRoot = join(hostRoot, root);
  const state = readSyncState(hostRoot);
  return legacyAppFilesIn(appRoot).some(projectFile => {
    const file = pathFrom(appRoot, projectFile);
    const content = readFileSync(projectFile);
    if (file.startsWith('(templates)/') || readGeneratedTagAt(`${root}/${file}`, content)?.intact) return false;
    return state?.files[`${root}/${file}`]?.written !== contentHash(content);
  });
}

/** Root files the removed sync:app kept in step with core's templates. */
const ROOT_TEMPLATE_FILES: readonly string[] = ['next.config.mjs', 'tsconfig.json', 'i18n.ts', 'instrumentation.ts'];

const ROOT_PROXY_FILES = ['proxy.ts', 'middleware.ts'] as const;

/**
 * S21: the areas core's proxy template protects, and the roles it lets in. A proxy the project keeps that never names
 * one leaves it without the 307 a signed-in user without the role should get (core still refuses the page on the
 * server, with a client-side redirect). Same rule and message as core's `prepare` (host/proxy-areas.mjs).
 */
const PROXY_PROTECTED_AREAS = [
  { path: '/superadmin', roles: 'superadmin or developer' },
  { path: '/devtools', roles: 'developer' },
] as const;
export const PROXY_AREA_WARNING = 'NS_PROXY_PROTECTED_AREA_MISSING';

/** The warning for a kept proxy whose source never names some protected area as a path, or null. */
export function proxyProtectedAreaWarning(file: string, source: string): string | null {
  const missing = PROXY_PROTECTED_AREAS.filter(area => !new RegExp(`['"\`]${area.path}(?![\\w-])`).test(source));
  if (missing.length === 0) return null;
  return `[${PROXY_AREA_WARNING}] ${file} does not protect ${missing.map(area => area.path).join(' or ')}. core still refuses those pages on the server, ` +
    `but without the proxy check a signed-in user without the role gets a 200 with a client-side redirect instead of a 307. ` +
    `Add the protected-area check of node_modules/@nextsparkjs/core/templates/proxy.ts (protectedArea / authorize): ` +
    `${missing.map(area => `${area.path} needs ${area.roles}`).join(', ')}; no session goes to /login?callbackUrl=..., a session without the role to /dashboard?error=access_denied.`;
}

/** Whether an old root interception file needs previous-core evidence. */
function hasUnclassifiedRootProxyFiles(hostRoot: string): boolean {
  const state = readSyncState(hostRoot);
  return ROOT_PROXY_FILES.some(file => {
    const source = join(hostRoot, file);
    if (!existsSync(source)) return false;
    const content = readFileSync(source);
    return !readGeneratedTagAt(file, content)?.intact
      && state?.files[file]?.written !== contentHash(content);
  });
}

function migratedProxyTemplate(source: Buffer, file: typeof ROOT_PROXY_FILES[number], hostRoot: string): Buffer | null {
  try {
    return Buffer.from(rewriteRemovedMiddlewareApi(adaptProxySource(source.toString('utf8'), file), join(hostRoot, file), hostRoot));
  } catch (error) {
    // An old template whose middleware API cannot be rewritten is not proof
    // that a project-owned file is safe to remove.
    if (error instanceof MigrateAnalysisError) return null;
    throw error;
  }
}

/** Classify root files that Next 16 will stop loading once sync creates src/. */
function compareRootProxyFiles(hostRoot: string, templates: string | null, previous: PreviousTemplates | null): MigrateReport['rootProxyFiles'] {
  const state = readSyncState(hostRoot);
  const generated: string[] = [];
  const customizations: string[] = [];
  for (const file of ROOT_PROXY_FILES) {
    const source = join(hostRoot, file);
    if (!existsSync(source)) continue;
    const content = readFileSync(source);
    const tagged = readGeneratedTagAt(file, content)?.intact;
    const stateMatch = state?.files[file]?.written === contentHash(content);
    // applyMove runs this same codemod on root proxy files before removal, so
    // compare the bytes that migration will actually leave on disk.
    const migratedContent = migratedProxyTemplate(content, file, hostRoot);
    const candidates = [
      templates && existsSync(join(templates, 'proxy.ts')) ? readFileSync(join(templates, 'proxy.ts')) : undefined,
      previous?.rootFiles.get('proxy.ts'),
    ].flatMap(candidate => candidate ? [migratedProxyTemplate(candidate, file, hostRoot)] : [])
      .filter((candidate): candidate is Buffer => candidate !== null);
    if (tagged || stateMatch || (migratedContent !== null && candidates.some(candidate => matchesTemplateBytes(migratedContent, candidate)))) generated.push(file);
    else customizations.push(file);
  }
  return { generated: generated.sort(), customizations: customizations.sort() };
}

function legacyProjectUsedPpr(hostRoot: string): boolean {
  const enabled = nextConfigFiles(hostRoot).some(file => /cacheComponents\s*:\s*true/.test(readFileSync(file, 'utf8')));
  const nextPackage = readJson(join(hostRoot, 'node_modules', 'next', 'package.json'));
  const major = typeof nextPackage?.version === 'string' ? Number.parseInt(nextPackage.version.split('.')[0], 10) : null;
  return enabled && major !== null && major >= 16;
}

function previousTemplateCandidates(previous: PreviousTemplates | null, file: string, activeTheme: string | null, usePpr: boolean): Buffer[] {
  if (!previous) return [];
  const candidates = [previous.files.get(file)];
  if (file === 'layout.tsx' && usePpr) candidates.push(previous.files.get('layout.ppr.tsx'));
  if (file === 'globals.css' && activeTheme) {
    const original = previous.files.get(file);
    if (original) {
      candidates.push(Buffer.from(original.toString('utf8').replace(
        /@import\s+["'][^"']*themes\/[^"']*\/styles\/globals\.css["'];?/,
        `@import "../contents/themes/${activeTheme}/styles/globals.css";`,
      )));
    }
  }
  return candidates.filter((candidate): candidate is Buffer => candidate !== undefined);
}

/**
 * Which files of the app tree earlier evidence proves are untouched output of core: the generated
 * tag, what `sync:app` recorded, the registry's own `(templates)` output, or the previous core's
 * template. Everything else is for the conversion to place.
 */
function classifyApp(hostRoot: string, root: 'app' | 'src/app' | null, previous: PreviousTemplates | null, previousEvidence: CoreVersionEvidence | null, unavailableReason: string | null, activeTheme: string | null): { evidence: Map<string, string>; appTemplates: MigrateReport['appTemplates'] } {
  const appRoot = root ? join(hostRoot, root) : null;
  const projectFiles = appRoot ? legacyAppFilesIn(appRoot) : [];
  const generated: string[] = [];
  const generatedBySyncState: string[] = [];
  const generatedByLegacyRegistry: string[] = [];
  const generatedByPreviousTemplate: string[] = [];
  const evidence = new Map<string, string>();
  const state = readSyncState(hostRoot);
  const usePpr = legacyProjectUsedPpr(hostRoot);
  let unproven = 0;
  for (const projectFile of projectFiles) {
    const file = pathFrom(appRoot as string, projectFile);
    const content = readFileSync(projectFile);
    // A valid generated tag identifies an untouched generated host file even
    // when it came from an older core template revision.
    if (file.startsWith('(templates)/')) {
      generatedByLegacyRegistry.push(file);
      evidence.set(file, 'output of the legacy registry build');
    } else if (readGeneratedTagAt(`${root}/${file}`, content)?.intact) {
      generated.push(file);
      evidence.set(file, 'intact generated tag');
    } else if (state?.files[`${root}/${file}`]?.written === contentHash(content)) {
      // `core` is the old template hash. For taggable files, removing the tag
      // deliberately hands ownership to the project; only `written` proves
      // that an untaggable file is still exactly what sync left on disk.
      generatedBySyncState.push(file);
      evidence.set(file, 'sync-state hash');
    } else if (previousTemplateCandidates(previous, file, activeTheme, usePpr).some(candidate => matchesTemplateBytes(content, candidate))) {
      generatedByPreviousTemplate.push(file);
      evidence.set(file, `previous core template${previousEvidence?.version ? ` ${previousEvidence.version}` : ''}`);
    } else {
      unproven++;
    }
  }
  return {
    evidence,
    appTemplates: {
      root, generated: generated.sort(), generatedBySyncState: generatedBySyncState.sort(),
      generatedByLegacyRegistry: generatedByLegacyRegistry.sort(),
      generatedByPreviousTemplate: generatedByPreviousTemplate.sort(), previousTemplateVersion: previousEvidence?.version ?? null,
      previousTemplateVersionSource: previousEvidence?.source ?? null, previousTemplateMethod: previous?.method ?? null,
      previousTemplateUnavailableReason: unavailableReason, unproven,
    },
  };
}

function compareRoot(hostRoot: string, templates: string | null): MigrateReport['rootTemplates'] {
  if (!templates) return { available: false, identical: [], modified: [], missing: [], generatorImportRewriteWarnings: [] };
  const templateFiles = readdirSync(templates, { withFileTypes: true }).filter(entry => entry.isFile());
  const identical: string[] = [];
  const modified: FileChange[] = [];
  const missing: string[] = [];
  const generatorImportRewriteWarnings: string[] = [];
  for (const template of templateFiles) {
    const target = template.name === 'npmrc' ? '.npmrc' : template.name;
    const hostFile = join(hostRoot, target);
    if (!existsSync(hostFile)) {
      missing.push(target);
      continue;
    }
    const count = changedLines(readFileSync(hostFile), readFileSync(join(templates, template.name)));
    if (count === 0) identical.push(target);
    else modified.push({ path: target, changedLines: count });
  }
  for (const config of nextConfigFiles(hostRoot)) {
    const content = readFileSync(config, 'utf8');
    if (hasGeneratedRouteImportRewrite(content)) {
      generatorImportRewriteWarnings.push(pathFrom(hostRoot, config));
    }
  }
  return { available: true, identical: identical.sort(), modified: modified.sort((left, right) => left.path.localeCompare(right.path)), missing: missing.sort(), generatorImportRewriteWarnings: generatorImportRewriteWarnings.sort() };
}

function isGeneratedRoute(value: string): boolean {
  return /^(?:@\/)?app\/(?:[^'"`\r\n/]+\/)*(?:layout|page|route)\.[cm]?[jt]sx?$/i.test(value);
}

function isThemeTemplate(value: string): boolean {
  return /^(?:@\/)?(?:(?:\.{1,2}\/)*)(?:contents\/)?themes\/[^/]+\/templates(?:\/.*)?$/i.test(value);
}

function isGeneratedRouteTarget(value: string): boolean {
  return isGeneratedRoute(value) || isThemeTemplate(value);
}

function hasAliasAssignment(view: SourceView): boolean {
  return view.strings.some((source, index) => {
    const target = view.strings[index + 1];
    return target !== undefined
      && /\.alias\s*\[\s*$/.test(view.code.slice(0, source.start))
      && /^\s*\]\s*=\s*$/.test(view.code.slice(source.end, target.start))
      && (isGeneratedRouteTarget(source.value) || isGeneratedRouteTarget(target.value));
  });
}

function hasStringReplace(view: SourceView): boolean {
  return view.strings.some((source, index) => {
    const target = view.strings[index + 1];
    return target !== undefined
      && /\.replace\s*\(\s*$/.test(view.code.slice(0, source.start))
      && /^\s*,\s*$/.test(view.code.slice(source.end, target.start))
      && /^\s*\)/.test(view.code.slice(target.end))
      && (isGeneratedRouteTarget(source.value) || isGeneratedRouteTarget(target.value));
  });
}

function hasRouteObjectMapping(view: SourceView, start: number, end: number): boolean {
  const strings = view.strings.filter(string => string.start > start && string.end < end);
  return strings.some((source, index) => {
    const target = strings[index + 1];
    return (isGeneratedRouteTarget(source.value) && /^\s*:/.test(view.code.slice(source.end, end)))
      || (target !== undefined
        && /^\s*:\s*$/.test(view.code.slice(source.end, target.start))
        && isGeneratedRouteTarget(target.value));
  });
}

function hasAliasObjectMapping(view: SourceView): boolean {
  for (const match of view.code.matchAll(/(?:\.alias\s*=|\balias\s*:|\bresolveAlias\s*:)\s*\{/g)) {
    const start = (match.index ?? 0) + match[0].lastIndexOf('{');
    const end = closingBrace(view.code, start);
    if (end !== null && hasRouteObjectMapping(view, start, end)) return true;
  }
  return false;
}

function closingParenthesis(code: string, openingParenthesis: number): number | null {
  let depth = 0;
  for (let index = openingParenthesis; index < code.length; index++) {
    if (code[index] === '(') depth++;
    else if (code[index] === ')' && --depth === 0) return index;
  }
  return null;
}

function hasNormalModuleReplacement(view: SourceView): boolean {
  for (const match of view.code.matchAll(/\b(?:new\s+)?(?:[A-Za-z_$][\w$]*\.)?NormalModuleReplacementPlugin\s*\(/g)) {
    const start = (match.index ?? 0) + match[0].lastIndexOf('(');
    const end = closingParenthesis(view.code, start);
    if (end !== null && view.strings.some(string => string.start > start && string.end <= end && isGeneratedRouteTarget(string.value))) return true;
  }
  return false;
}

/** Detect generated-route rewrites, regardless of the surrounding Next config callback shape. */
function hasGeneratedRouteImportRewrite(content: string): boolean {
  const view = sourceView(content);
  return hasAliasAssignment(view)
    || hasAliasObjectMapping(view)
    || hasNormalModuleReplacement(view)
    || hasStringReplace(view);
}

function activeTheme(hostRoot: string): { name: string | null; source: 'environment' | '.env.example' | null } {
  if (process.env.NEXT_PUBLIC_ACTIVE_THEME) return { name: process.env.NEXT_PUBLIC_ACTIVE_THEME, source: 'environment' };
  const example = join(hostRoot, '.env.example');
  if (!existsSync(example)) return { name: null, source: null };
  const match = readFileSync(example, 'utf8').match(/^\s*(?:export\s+)?NEXT_PUBLIC_ACTIVE_THEME\s*=\s*["']?([^\s"'#]+)["']?/m);
  return match ? { name: match[1], source: '.env.example' } : { name: null, source: null };
}

function childDirectories(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
}

function toolingKind(file: string): string | null {
  const name = basename(file);
  const relativeFile = file.split(sep).join('/');
  if (name === 'pnpm-workspace.yaml') return 'workspace manifest';
  if (name === '.gitignore') return 'gitignore';
  if (/^tsconfig.*\.json$/.test(name)) return 'tsconfig';
  if (/^(?:jest|cypress)(?:\.config)?\.[^.]+/.test(name) || /(?:jest|cypress).*\.config\./.test(name)) return 'test config';
  if (/\.config\.[^.]+$/.test(name)) return 'tool config';
  if (relativeFile.includes('/scripts/') && /\.[cm]?[jt]sx?$/.test(name)) return 'helper script';
  return null;
}

function toolingReferences(repositoryRoot: string): ToolingReference[] {
  const references: ToolingReference[] = [];
  for (const file of filesIn(repositoryRoot)) {
    const name = basename(file);
    const kind = toolingKind(file);
    if (name === 'package.json') {
      const pkg = readJson(file);
      const scripts = pkg?.scripts;
      if (typeof scripts === 'object' && scripts !== null) {
        for (const [script, value] of Object.entries(scripts)) {
          if (typeof value !== 'string' || !value.includes('contents/')) continue;
          references.push({ path: pathFrom(repositoryRoot, file), kind: `package script: ${script}`, line: 0, text: value, relativeDepth: /(?:\.\.\/){2,}/.test(value) });
        }
      }
      continue;
    }
    if (!kind) continue;
    const content = readFileSync(file, 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (!line.includes('contents/')) return;
      references.push({ path: pathFrom(repositoryRoot, file), kind, line: index + 1, text: line.trim(), relativeDepth: /(?:\.\.\/){2,}/.test(line) });
    });
  }
  return references.sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
}

function collisions(hostRoot: string, themeDirectory: string | null): Omit<MigrateReport['collisions'], 'renamed'> {
  if (!themeDirectory) return { reserved: [], files: [] };
  const reserved: { path: string; reason: string }[] = [];
  const fileCollisions: { path: string; identical: boolean }[] = [];
  for (const file of filesIn(themeDirectory)) {
    const themePath = pathFrom(themeDirectory, file);
    const hook = hookDestination(hostRoot, themePath);
    const reservation = reservedThemePath(themePath);
    if (hook) reserved.push({ path: themePath, reason: 'Next reserves this root file name; migration maps it to config/hooks/' });
    else if (reservation) reserved.push(reservation);
    const destination = themeDestination(hostRoot, themePath);
    if (!destination) continue;
    if (existsSync(destination) && statSync(destination).isFile()) {
      fileCollisions.push({ path: themePath, identical: readFileSync(file).equals(readFileSync(destination)) });
    }
  }
  const uniqueReserved = [...new Map(reserved.map(item => [item.path, item])).values()];
  return { reserved: uniqueReserved.sort((left, right) => left.path.localeCompare(right.path)), files: fileCollisions.sort((left, right) => left.path.localeCompare(right.path)) };
}

function gitOutput(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function gitSucceeds(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function repositoryRoot(cwd: string): string {
  try {
    const top = gitOutput(cwd, ['rev-parse', '--show-toplevel']).trim();
    // Every write is checked against this root: it must be the physical directory, not a path through a link
    return realpathSync(top);
  } catch {
    throw new MigrateAnalysisError('This command must run inside a git repository.');
  }
}

/** The root every write is checked against is the physical (real) directory: nothing below it can be reached through a link above. */
function assertPhysicalRoot(repository: string, hostRoot: string): void {
  if (realpathSync(repository) !== repository) throw new MigrateAnalysisError(`The git toplevel ${repository} is not a physical path (${realpathSync(repository)}); run migrate from the real directory.`);
  if (realpathSync(hostRoot) !== hostRoot) throw new MigrateAnalysisError(`The host root ${hostRoot} is not a physical path (${realpathSync(hostRoot)}); it or a directory above it is a symbolic link.`);
}

function untrackedFiles(repositoryRoot: string): string[] {
  const output = gitOutput(repositoryRoot, ['ls-files', '--others', '--exclude-standard', '-z', '--', ':(exclude,glob)**/.env*']);
  return output.split('\0').filter(Boolean).filter(file => !isEnvironmentFile(basename(file))).sort();
}

function siblingReferences(repositoryRoot: string, hostRoot: string, theme: string | null): MigrateReport['siblingThemeReferences'] {
  if (!theme) return [];
  return siblingMatches(repositoryRoot, hostRoot, new RegExp(`contents/themes/${theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'));
}

/** Old references inside AI-workflow directories: migrate never rewrites them (#201 owns those), so it lists them. */
function aiWorkflowReferences(repository: string, theme: string | null): MigrateReport['aiWorkflowReferences'] {
  const escaped = theme ? theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const pattern = new RegExp(`${escaped ? `contents/themes/${escaped}|` : ''}contents/plugins/|/api/v1/(?:theme|plugin)/`, 'g');
  const references: { path: string; occurrences: number }[] = [];
  for (const file of filesIn(repository)) {
    if (!inAiWorkflowDirectory(repository, file)) continue;
    const buffer = readFileSync(file);
    if (!isText(buffer)) continue;
    const occurrences = countOccurrences(buffer.toString('utf8'), pattern);
    if (occurrences > 0) references.push({ path: pathFrom(repository, file), occurrences });
  }
  return references.sort((left, right) => left.path.localeCompare(right.path));
}

/** Occurrences of `pattern` in the workspace members outside the host, by file. */
function siblingMatches(repositoryRoot: string, hostRoot: string, pattern: RegExp): MigrateReport['siblingThemeReferences'] {
  const hostPath = resolve(hostRoot);
  const references: { path: string; occurrences: number }[] = [];
  const packageRoots = packageFiles(repositoryRoot).map(file => resolve(dirname(file)));
  const owner = (file: string) => packageRoots.filter(root => file === root || file.startsWith(`${root}${sep}`)).sort((left, right) => right.length - left.length)[0];
  for (const packageRoot of packageRoots) {
    if (resolve(packageRoot) === hostPath || packageRoot.startsWith(`${hostPath}${sep}`)) continue;
    for (const file of filesIn(packageRoot).filter(file => owner(file) === packageRoot)) {
      if (!isText(readFileSync(file))) continue;
      const occurrences = countOccurrences(readFileSync(file, 'utf8'), pattern);
      if (occurrences > 0) references.push({ path: pathFrom(repositoryRoot, file), occurrences });
    }
  }
  return references.sort((left, right) => left.path.localeCompare(right.path));
}

function requiredPlugins(themeRoot: string, hostPackage: Record<string, unknown> | undefined, pluginsRoot: string): { plugins: string[]; warnings: string[] } {
  const themePackage = readJson(join(themeRoot, 'package.json'));
  const values: unknown[] = [
    themePackage?.requiredPlugins,
    themePackage?.plugins,
    (themePackage?.nextspark as Record<string, unknown> | undefined)?.requiredPlugins,
    (themePackage?.nextspark as Record<string, unknown> | undefined)?.plugins,
    ((themePackage?.nextspark as Record<string, unknown> | undefined)?.postinstall as Record<string, unknown> | undefined)?.requiredPlugins,
    ((themePackage?.nextspark as Record<string, unknown> | undefined)?.postinstall as Record<string, unknown> | undefined)?.plugins,
  ];
  // Older themes sometimes kept this declaration in their own config rather
  // than package.json. This is intentionally a narrow string-list reader, not
  // an evaluator of project code.
  const warnings: string[] = [];
  for (const name of ['nextspark.config.ts', 'nextspark.config.js', 'theme.config.ts', 'theme.config.js', 'config/theme.config.ts', 'config/theme.config.js']) {
    const file = join(themeRoot, name);
    if (!existsSync(file)) continue;
    const content = readFileSync(file, 'utf8');
    const declarations = [...content.matchAll(/(?:requiredPlugins|plugins)\s*:/g)];
    if (declarations.length === 0) continue;
    const matches = [...content.matchAll(/(?:requiredPlugins|plugins)\s*:\s*\[([^\]]*)\]/g)];
    if (matches.length < declarations.length) {
      warnings.push(`${pathFrom(themeRoot, file)} has a non-literal plugin list; nextspark.config.ts plugins may be incomplete.`);
    }
    if (matches.length === 0) {
      continue;
    }
    for (const match of matches) {
      const literals = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(item => item[1]);
      // A list is safe to copy only when every item is a quoted literal.
      if (match[1].replace(/['"][^'"]+['"]|,|\s/g, '') !== '') {
        warnings.push(`${pathFrom(themeRoot, file)} has a non-literal plugin list; nextspark.config.ts plugins may be incomplete.`);
        continue;
      }
      values.push(literals);
    }
  }
  const names = values.flatMap(value => Array.isArray(value) ? value : []).filter((value): value is string => typeof value === 'string');
  const declaredPackages = new Set(['dependencies', 'devDependencies', 'optionalDependencies']
    .flatMap(section => Object.keys((hostPackage?.[section] as Record<string, unknown> | undefined) ?? {})));
  return { plugins: [...new Set(names.filter(plugin =>
    plugin.startsWith('@') ? declaredPackages.has(plugin) : existsSync(join(pluginsRoot, plugin))
  ))].sort(), warnings: [...new Set(warnings)].sort() };
}

function envExamplePlan(hostRoot: string, themeRoot: string): MigrateReport['envExample'] {
  const themeExample = join(themeRoot, '.env.example');
  if (!existsSync(themeExample)) return { action: 'none', path: null };
  const rootExample = join(hostRoot, '.env.example');
  if (!existsSync(rootExample)) return { action: 'move', path: pathFrom(hostRoot, themeExample) };
  return readFileSync(themeExample).equals(readFileSync(rootExample))
    ? { action: 'deduplicate', path: pathFrom(hostRoot, themeExample) }
    : { action: 'conflict', path: pathFrom(hostRoot, themeExample) };
}

const coreScriptRenames: Readonly<Record<string, string>> = {
  'scripts/test/jest-theme.mjs': 'scripts/test/jest.mjs',
};

function coreScripts(hostRoot: string, coreTemplates: string | null): MigrateReport['coreScripts'] {
  const packageFile = join(hostRoot, 'package.json');
  const scripts = readJson(packageFile)?.scripts;
  if (typeof scripts !== 'object' || scripts === null) return { renamed: [], warnings: [] };
  const coreDir = coreTemplates ? dirname(coreTemplates) : null;
  const renamed: string[] = [];
  const warnings: string[] = [];
  for (const [name, script] of Object.entries(scripts)) {
    if (typeof script !== 'string') continue;
    for (const [oldPath, nextPath] of Object.entries(coreScriptRenames)) {
      if (script.includes(`@nextsparkjs/core/${oldPath}`)) renamed.push(name);
      const references = [...script.matchAll(/@nextsparkjs\/core\/(scripts\/[^\s'"`;&|)]+)/g)].map(match => match[1]);
      for (const reference of references) {
        if (reference === oldPath || reference === nextPath) continue;
        if (!coreDir || !existsSync(join(coreDir, reference))) warnings.push(`${name}: @nextsparkjs/core/${reference} does not exist in the installed core`);
      }
    }
  }
  return { renamed: [...new Set(renamed)].sort(), warnings: [...new Set(warnings)].sort() };
}

const SIMULATION_MARKER = 'nextspark-simulation';

/** The simulation's child skips the blocker refusal only when its own repository is the temporary copy that holds the parent's nonce; the environment alone proves nothing. */
function simulationVerified(repository: string, nonce: string | undefined): boolean {
  if (!nonce || process.env.NEXTSPARK_MIGRATE_SIMULATION !== '1') return false;
  try {
    const real = realpathSync(repository);
    // the copy is a direct child of the temp directory: no nested path qualifies
    return readFileSync(join(repository, '.git', SIMULATION_MARKER), 'utf8') === nonce
      && dirname(real) === realpathSync(tmpdir())
      && basename(real).startsWith('nextspark-migrate-plan-');
  } catch {
    return false;
  }
}

/** What a host react / react-dom fix says, and for the ones --yes cannot make the exact command. */
function hostFrameworkLine(fix: HostFrameworkFix, hostPath: string): string {
  const where = `${hostPath === '.' ? '' : `${hostPath}/`}package.json`;
  const have = `${where}: ${fix.name} "${fix.from}" is below the ${fix.to.replace(/^[\^~]/, '')} that members resolve`;
  if (fix.from.startsWith('catalog:')) return `${have} and migrate cannot edit it: change the ${fix.name} entry in pnpm-workspace.yaml (the catalog) to ${fix.to}, then install`;
  if (fix.from.startsWith('workspace:')) return `${have} and migrate cannot edit it: set ${fix.name} to ${fix.to} in the package.json of the workspace package it points to, then install`;
  if (fix.major) return `${have}, in another major: migrate does not cross majors. Decide, then run  (cd ${hostPath} && pnpm add ${fix.section === 'devDependencies' ? '-D ' : ''}${fix.name}@${fix.to})`;
  return fix.manual
    ? `${have} and migrate cannot edit this spec safely: run  (cd ${hostPath} && pnpm add ${fix.section === 'devDependencies' ? '-D ' : ''}${fix.name}@${fix.to})`
    : `${where}: ${fix.name} "${fix.from}" -> "${fix.to}" (--yes raises it within the same major, keeping the operator, so the host and its members share one copy)`;
}

const FRAMEWORK_PACKAGES = ['next', 'react', 'react-dom'] as const;

function installedVersion(directory: string, name: string): string | null {
  const version = readJson(join(directory, 'node_modules', name, 'package.json'))?.version;
  return typeof version === 'string' ? version : null;
}

/** L8: members that installed their own next / react / react-dom next to the host's (two copies break types and context). */
function duplicateFrameworkCopies(repository: string, hostRoot: string, manifests: { file: string }[]): MigrateReport['duplicateCopies'] {
  const copies: MigrateReport['duplicateCopies'] = [];
  for (const { file } of manifests) {
    const member = dirname(file);
    if (member === hostRoot) continue;
    for (const name of FRAMEWORK_PACKAGES) {
      const own = installedVersion(member, name);
      const host = installedVersion(hostRoot, name);
      if (own && host && own !== host) copies.push({ member: pathFrom(repository, member), name, version: own, host });
    }
  }
  return copies;
}

async function analyze(cwd: string): Promise<{ report: MigrateReport; plan: AppConversionPlan | null }> {
  const repository = repositoryRoot(cwd);
  const host = resolveHostRoot(repository, cwd);
  const packageManifests = packageFiles(repository).map(file => ({ file, pkg: readJson(file) })).filter((entry): entry is { file: string; pkg: Record<string, unknown> } => entry.pkg !== null);
  const hostPackage = packageManifests.find(entry => dirname(entry.file) === host.root)?.pkg;
  const rootPackage = packageManifests.find(entry => dirname(entry.file) === repository)?.pkg;
  const packageManager = typeof hostPackage?.packageManager === 'string'
    ? { value: hostPackage.packageManager, source: pathFrom(repository, join(host.root, 'package.json')) }
    : typeof rootPackage?.packageManager === 'string'
      ? { value: rootPackage.packageManager, source: 'package.json' }
      : { value: null, source: null };
  const members = packageManifests.map(entry => ({ path: pathFrom(repository, dirname(entry.file)), packages: packageNextsparkVersions(entry.pkg) })).filter(member => Object.keys(member.packages).length > 0);
  const declaredVersions = [...new Set(members.flatMap(member => Object.values(member.packages).map(normalizedDeclaredVersion)))].sort();
  const selectedTheme = activeTheme(host.root);
  const themesDirectory = join(host.root, 'contents', 'themes');
  const pluginsDirectory = join(host.root, 'contents', 'plugins');
  const themes = childDirectories(themesDirectory).map(name => ({ name, files: fileCount(join(themesDirectory, name)) }));
  const plugins = childDirectories(pluginsDirectory).map(name => ({ name, files: fileCount(join(pluginsDirectory, name)) }));
  const themeDirectory = selectedTheme.name && existsSync(join(themesDirectory, selectedTheme.name)) ? join(themesDirectory, selectedTheme.name) : null;
  const templates = templateDirectory(host.root, repository);
  const declaredCore = declaredCoreVersion(hostPackage);
  // Hand-built/partial test installations occasionally omit core's manifest;
  // their declared version is the best available current-version evidence.
  const currentCore = installedCoreVersion(templates) ?? declaredCore;
  const syncStateVersion = readSyncState(host.root)?.coreVersion;
  const previousEvidence = (syncStateVersion && syncStateVersion !== currentCore ? { version: syncStateVersion, source: '.nextspark/sync-state.json' } : null)
    ?? previousCoreVersion(repository, host.root, currentCore)
    ?? (declaredCore && declaredCore !== currentCore ? { version: declaredCore, source: 'package.json' } : null);
  // The report is the one pre-write classification used by --yes below; do
  // not look up previous templates again after the tree starts changing.
  const appRoot = await appRootFor(host.root, templates ? dirname(templates) : null);
  const previousLookup = hasUnclassifiedLegacyAppFiles(host.root, appRoot) || hasUnclassifiedRootProxyFiles(host.root)
    ? await previousCoreTemplates(previousEvidence?.version ?? null, currentCore)
    : { templates: null, unavailableReason: null };
  const { evidence: generatedEvidence, appTemplates } = classifyApp(host.root, appRoot, previousLookup.templates, previousEvidence, previousLookup.unavailableReason, selectedTheme.name);
  const rootProxyFiles = compareRootProxyFiles(host.root, templates, previousLookup.templates);
  const configPlugins = themeDirectory ? requiredPlugins(themeDirectory, hostPackage, pluginsDirectory) : { plugins: [], warnings: [] };
  const envExample = themeDirectory ? envExamplePlan(host.root, themeDirectory) : { action: 'none' as const, path: null };
  const scripts = coreScripts(host.root, templates);
  const hostFiles = filesIn(host.root);
  const movePlan = themeDirectory ? planMove(host.root, themeDirectory, pluginsDirectory) : null;
  const usePpr = legacyProjectUsedPpr(host.root);
  // The app root, or a directory above it, being a symbolic link would carry every delete outside the project
  const rootLink = appRoot ? appRoot.split('/').reduce<{ path: string; link: string | null }>((state, part) => {
    const path = join(state.path, part);
    return { path, link: state.link ?? (existsSync(path) && lstatSync(path).isSymbolicLink() ? path : null) };
  }, { path: host.root, link: null }).link : null;
  const appPlan = appRoot && !rootLink
    ? await planAppConversion({
      hostRoot: host.root,
      root: appRoot,
      files: legacyAppFilesIn(join(host.root, appRoot)).map(file => pathFrom(join(host.root, appRoot), file)),
      generated: generatedEvidence,
      baselineFor: path => previousTemplateCandidates(previousLookup.templates, path, selectedTheme.name, usePpr)[0],
      core: await loadCoreHost(templates ? dirname(templates) : null),
      reserved: new Set(movePlan ? [...movePlan.moves, ...movePlan.duplicates].map(item => item.destination) : []),
      coreTemplates: templates,
    })
    : null;
  const blockers = appPlan ? unrecognizedLines(appPlan) : [];
  // core's own app/globals.css imports the active theme's stylesheet; without the theme name it reads as a project file, and the generic line hides the real cause
  if (!selectedTheme.name && appPlan) {
    const line = `${appPlan.root}/globals.css: `;
    const at = blockers.findIndex(entry => entry.startsWith(line));
    if (at >= 0) blockers[at] = `${line}no active theme was found (NEXT_PUBLIC_ACTIVE_THEME is not set and .env.example does not declare it), so migrate cannot tell core's own copy of this file from yours. Pass the theme: NEXT_PUBLIC_ACTIVE_THEME=<theme> nextspark migrate, or add NEXT_PUBLIC_ACTIVE_THEME=<theme> to .env.example (${themes.length > 0 ? `themes found: ${themes.map(theme => theme.name).join(', ')}` : 'no directory under contents/themes'}); if it is your own file: ${blockers[at].slice(line.length)}`;
  }
  const unsimulable: string[] = [];
  const blockSimulation = (line: string) => { blockers.push(line); unsimulable.push(line); };
  if (rootLink) blockSimulation(`${pathFrom(host.root, rootLink)}: it is a symbolic link (the app tree, or a directory above it); migrate would follow it and change files outside the project. Replace it with a real directory and run migrate again`);
  if (appRoot && !rootLink) {
    for (const link of symlinksIn(join(host.root, appRoot))) {
      blockSimulation(`${pathFrom(host.root, link)}: it is a symbolic link, which migrate cannot move or reproduce faithfully; replace it with a real file or directory (or import the target from where it lives) and run migrate again`);
    }
  }
  // L3: a moved file that lands on a different file already in the project would stop --yes after the report said all was well
  for (const collision of movePlan?.collisions ?? []) {
    const from = pathFrom(host.root, collision.source);
    const to = pathFrom(host.root, collision.destination);
    blockSimulation(`${from} would move to ${to}, where a different file already is. Rename one of them (for example  git mv ${from} ${from.replace(/(\.[^./]+)?$/, '-theme$1')}  keeps the theme's copy as a project file under a name that does not collide) or merge them, commit, and run migrate again`);
  }
  // L11: a file converted into an override or moved keeps its imports of core, which the installed core may no longer export
  if (templates) {
    const converted = [
      ...(appPlan && appRoot ? appPlan.files.filter(entry => entry.fate.kind === 'override' || entry.fate.kind === 'project').map(entry => ({ display: `${appRoot}/${entry.path}`, absolute: join(host.root, appRoot, entry.path) })) : []),
      // the root proxy that moves to src/ keeps its imports of core too
      ...rootProxyFiles.customizations.map(file => ({ display: file, absolute: join(host.root, file) })),
    ];
    for (const file of converted) {
      if (!/\.(?:[cm]?[jt]sx?)$/.test(file.absolute) || !existsSync(file.absolute)) continue;
      const missing = importReferences(readFileSync(file.absolute, 'utf8')).filter(reference => /^@nextsparkjs\/core(?:\/|$)/.test(reference.target) && coreExportsSpecifier(dirname(templates), reference.target) === false);
      for (const reference of missing) {
        blockers.push(`${file.display}:${reference.line}: imports ${reference.target}, which the installed @nextsparkjs/core does not export (removed or renamed since the core this file was copied from). Replace the import (see the upgrade notes of the release that removed it) in the file, commit, and run migrate again`);
      }
    }
  }
  const configFile = join(host.root, 'nextspark.config.ts');
  if (appPlan && appPlan.webhookExtensions.length > 0 && existsSync(configFile)) {
    const declared = declareWebhookExtensions(readFileSync(configFile, 'utf8'), appPlan.webhookExtensions);
    if ('error' in declared) blockers.push(declared.error);
  }
  const urlMoves = apiUrlMoves(hostFiles, host.root);
  // F9: the URLs core's dispatchers served keep answering through native Next rewrites, for installed clients
  const compatEntries = compatRewrites(
    themeDirectory && (existsSync(join(themeDirectory, 'api')) || urlMoves.some(move => move.from.startsWith('/api/v1/theme/'))) ? selectedTheme.name : null,
    plugins.filter(plugin => existsSync(join(pluginsDirectory, plugin.name, 'api'))).map(plugin => plugin.name),
  );
  const nextConfigFile = nextConfigFiles(host.root)[0] ?? null;
  if (compatEntries.length > 0) {
    const edit = nextConfigFile ? addCompatRewrites(readFileSync(nextConfigFile, 'utf8'), basename(nextConfigFile), compatEntries) : null;
    if (!edit || 'error' in edit) {
      const shown = edit ? edit.error : `${pathFrom(host.root, join(host.root, 'next.config.mjs'))} was not found`;
      blockers.push(`${shown}. Merge these rewrites into your next config by hand, then run migrate again:\n${(edit && 'snippet' in edit ? edit.snippet : compatEntries.map(entry => `  { source: '${entry.source}', destination: '${entry.destination}' },`).join('\n'))}`);
    }
  }
  // F11: the Next.js range the generated host needs
  const workspaceYamls = [join(host.root, 'pnpm-workspace.yaml'), join(repository, 'pnpm-workspace.yaml')].filter(file => existsSync(file)).map(file => readFileSync(file, 'utf8'));
  const nextRange = checkNextRange(hostPackage, (catalog, dependency) => workspaceYamls.map(yaml => catalogVersion(yaml, catalog, dependency)).find(version => version !== null) ?? null);
  const hostFramework = Object.fromEntries(['react', 'react-dom'].map(name => [name, [hostPackage?.dependencies, hostPackage?.devDependencies].map(table => (table as Record<string, unknown> | undefined)?.[name]).find((value): value is string => typeof value === 'string')]));
  const memberPeers = packageManifests
    .filter(entry => dirname(entry.file) !== host.root)
    .flatMap(entry => {
      const { updates, kept } = memberPeerUpdates(entry.pkg, hostFramework);
      return updates.length > 0 || kept.length > 0 ? [{ path: pathFrom(repository, entry.file), updates, kept }] : [];
    });
  const duplicateCopies = duplicateFrameworkCopies(repository, host.root, packageManifests);
  const hostFrameworkPlan = hostFrameworkFixes(hostPackage, duplicateCopies);
  const notices: string[] = [];
  for (const member of nextRange.members.filter(entry => entry.action === 'check')) {
    notices.push(`${member.name} is declared as "${member.value}" in ${pathFrom(repository, join(host.root, 'package.json'))}: ${member.note}. Migrate does not change it.`);
  }
  // F13: a project with a mobile app imports its API types from packages/contracts
  const contracts = planContractsPackage(repository, host.root, packageManifests);
  const contractsPlan = contracts.plan;
  if (contracts.blocker) blockers.push(contracts.blocker);
  if (contracts.skipped) notices.push(contracts.skipped);
  const proxyNotices: string[] = [];
  // L5: with src/app in place Next loads the proxy from src/ only, but Turbopack still compiles a root file whose imports are gone
  for (const file of rootProxyFiles.customizations) {
    if (!appPlan) {
      proxyNotices.push(`root ${file} holds project code and is left where it is: there is no app tree to convert, so migrate does not touch it. Make sure it only imports APIs the installed core still exports.`);
      continue;
    }
    const occupied = [...['proxy.ts', 'middleware.ts'].map(name => join('src', name)).filter(name => existsSync(join(host.root, name))), ...(file === rootProxyFiles.customizations[0] ? [] : [`src/${rootProxyFiles.customizations[0]}`])];
    if (occupied.length > 0) {
      blockers.push(`root ${file} holds project code and cannot move to src/${file}: Next loads only one proxy file and ${occupied.join(', ')} is taken (it exists, or is where the other root file goes). Merge ${file} into ${occupied[0]} by hand, delete the root file, commit, and run migrate again`);
      continue;
    }
    try {
      rewriteRemovedMiddlewareApi(readFileSync(join(host.root, file), 'utf8'), join(host.root, file), host.root);
      proxyNotices.push(`root ${file} holds project code: --yes moves it to src/${file} (where Next loads it next to src/app) with the renamed core middleware APIs (hasThemeMiddleware, executeThemeMiddleware, getThemeAppConfig) rewritten to their *Project* forms. Its logic is kept as written. It REPLACES core's current proxy template (migrate does not write src/${file} from it), so after migrating compare it with node_modules/@nextsparkjs/core/templates/proxy.ts for what the template gained since your copy: docs access control, the session hint cookie, the active-team header, protected-area checks.`);
    } catch (error) {
      blockers.push(`root ${file} holds project code that migrate cannot rewrite (${(error instanceof Error ? error.message : 'unknown shape').replace(/\.$/, '')}). Move it to src/${file} by hand with those calls updated to the *Project* forms, delete the root file, commit, and run migrate again`);
    }
  }
  // S21: every proxy the project keeps (an existing src/ one, or a root one that moves to src/) protects both areas
  const keptProxies = [
    ...['src/proxy.ts', 'src/middleware.ts'].filter(file => existsSync(join(host.root, file))).map(file => ({ file, label: file })),
    ...rootProxyFiles.customizations.map(file => ({ file, label: appPlan ? `${file} (moving to src/${file})` : file })),
  ];
  for (const { file, label } of keptProxies) {
    const warning = proxyProtectedAreaWarning(label, readFileSync(join(host.root, file), 'utf8'));
    if (warning) proxyNotices.push(warning);
  }
  const appConversion: MigrateReport['appConversion'] = {
    root: appRoot,
    removed: (appPlan?.files ?? []).flatMap(file => file.fate.kind === 'remove' ? [{ path: file.path, evidence: file.fate.evidence }] : []),
    loaders: (appPlan?.files ?? []).flatMap(file => file.fate.kind === 'loader' ? [{ path: file.path, template: file.fate.template }] : []),
    overrides: (appPlan?.files ?? []).flatMap(file => file.fate.kind === 'override'
      ? [{ path: file.path, destination: file.fate.destination, core: file.fate.core, baseline: file.fate.baseline, diffLines: file.fate.diffLines, diff: file.fate.diff }]
      : []),
    projectFiles: (appPlan?.files ?? []).flatMap(file => file.fate.kind === 'project' ? [{ path: file.path, destination: file.fate.destination }] : []),
    webhookExtensions: appPlan?.webhookExtensions ?? [],
    blockers,
    unsimulable,
  };
  const themeNeedle = selectedTheme.name ? new RegExp(`@/contents/themes/${selectedTheme.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'g') : null;
  const pluginNeedle = /@\/contents\/plugins\//g;
  const imports = hostFiles.reduce((counts, file) => {
    const content = readFileSync(file, 'utf8');
    const themeOccurrences = themeNeedle ? countOccurrences(content, themeNeedle) : 0;
    const pluginOccurrences = countOccurrences(content, pluginNeedle);
    return {
      themeOccurrences: counts.themeOccurrences + themeOccurrences,
      themeFiles: counts.themeFiles + Number(themeOccurrences > 0),
      pluginOccurrences: counts.pluginOccurrences + pluginOccurrences,
      pluginFiles: counts.pluginFiles + Number(pluginOccurrences > 0),
    };
  }, { themeOccurrences: 0, themeFiles: 0, pluginOccurrences: 0, pluginFiles: 0 });
  const untracked = untrackedFiles(repository);
  const warnings: string[] = [];
  if (!gitSucceeds(repository, ['diff', '--quiet']) || !gitSucceeds(repository, ['diff', '--cached', '--quiet']) || untracked.length > 0) warnings.push('Git working tree is dirty; report mode does not modify it.');
  if (!templates) warnings.push('Installed @nextsparkjs/core templates were not found; template comparisons are unavailable.');
  if (!selectedTheme.name) warnings.push('No active theme was found in NEXT_PUBLIC_ACTIVE_THEME or .env.example.');
  if (appConversion.blockers.length > 0) warnings.push(`BLOCKED: migration will not write anything until ${appConversion.blockers.length} blocker(s) are fixed by hand (see "App tree conversion").`);
  if (previousEvidence && !previousLookup.templates) {
    warnings.push(previousLookup.networkFailure
      ? `Could not fetch @nextsparkjs/core@${previousEvidence.version} (${previousLookup.unavailableReason}) to classify old generated files; that network step was skipped and unmatched files remain customizations. Rerun \`nextspark migrate\` with network access before applying anything (with --yes, roll back first with the commands printed in the move plan: files already moved can no longer be classified). The wait is ${previousCoreNetworkTimeoutMs() / 1000}s; NEXTSPARK_MIGRATE_NETWORK_TIMEOUT_MS overrides it.`
      : `Could not use @nextsparkjs/core@${previousEvidence.version} (${previousLookup.unavailableReason}) to classify old generated files; unmatched files remain customizations.`);
  }
  warnings.push(...proxyNotices);
  if (envExample.action === 'conflict') warnings.push(`${envExample.path} differs from the root .env.example and will not be merged.`);
  warnings.push(...notices);
  warnings.push(...configPlugins.warnings);
  warnings.push(...scripts.warnings);
  const report: MigrateReport = {
    hostRoot: { path: pathFrom(repository, host.root), reason: host.reason },
    warnings,
    versions: { packageManager, members, drift: declaredVersions.length > 1, driftVersions: declaredVersions },
    activeTheme: { ...selectedTheme, themes, plugins },
    appTemplates,
    appConversion,
    apiUrlMoves: urlMoves,
    rootProxyFiles,
    routeRootGuard: {
      currentRoots: ['app', 'pages'].filter(path => existsSync(join(host.root, path))),
      checkedAfterMigration: true,
    },
    config: { plannedCreation: !existsSync(join(host.root, 'nextspark.config.ts')), plugins: configPlugins.plugins },
    envExample,
    coreScripts: scripts,
    rootTemplates: compareRoot(host.root, templates),
    imports,
    toolingReferences: toolingReferences(repository),
    collisions: { ...collisions(host.root, themeDirectory), renamed: movePlan?.renamed ?? [] },
    untracked,
    siblingThemeReferences: siblingReferences(repository, host.root, selectedTheme.name),
    compatRewrites: { entries: compatEntries, file: nextConfigFile ? pathFrom(repository, nextConfigFile) : null, note: COMPAT_NOTE },
    siblingApiUrlReferences: siblingMatches(repository, host.root, /\/api\/v1\/(?:theme|plugin)\//g),
    nextRange,
    memberPeers,
    duplicateCopies,
    hostFramework: hostFrameworkPlan,
    aiWorkflowReferences: aiWorkflowReferences(repository, selectedTheme.name),
    contractsPackage: { needed: contractsPlan !== null, path: pathFrom(repository, join(repository, 'packages', 'contracts')), mobile: contractsPlan?.mobile ? pathFrom(repository, contractsPlan.mobile) : null, skipped: contracts.skipped, createsDirectory: contractsPlan !== null && !existsSync(contractsPlan.contractsDirectory) },
    blockThumbnails: hostFiles.filter(file => isBlockConfig(file) && !inAiWorkflowDirectory(repository, file)).flatMap(file => {
      const lines = countBlockThumbnails(readFileSync(file, 'utf8'));
      return lines > 0 ? [{ path: pathFrom(repository, file), lines }] : [];
    }),
    hostPlan: { simulated: false, conflicts: [], leftOut: appPlan ? appPlan.files.filter(file => file.fate.kind === 'unrecognized').map(file => `${appPlan.root}/${file.path}`) : [], notices: [], partial: false, checks: null, method: null, unknown: false, reason: null },
  };
  return { report, plan: appPlan };
}

function paths(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'none';
}

function section(title: string, lines: string[]): void {
  console.log('');
  console.log(title);
  for (const line of lines) console.log(`  ${line}`);
}

function printReport(report: MigrateReport): void {
  console.log('NextSpark 0.x → 1.0 migration report (dry run)');
  section('Host root', [`${report.hostRoot.path} (${report.hostRoot.reason})`]);
  section('Versions', [
    `package manager: ${report.versions.packageManager.value ?? 'not declared'}`,
    `members: ${report.versions.members.map(member => `${member.path} (${Object.entries(member.packages).map(([name, version]) => `${name}@${version}`).join(', ')})`).join('; ') || 'none'}`,
    `drift: ${report.versions.drift ? `yes (${report.versions.driftVersions.join(', ')})` : 'no'}`,
  ]);
  section('Active theme and local plugins', [
    `active theme: ${report.activeTheme.name ?? 'not found'}${report.activeTheme.source ? ` (${report.activeTheme.source})` : ''}`,
    `themes: ${report.activeTheme.themes.map(theme => `${theme.name} (${theme.files} files)`).join(', ') || 'none'}`,
    `plugins: ${report.activeTheme.plugins.map(plugin => `${plugin.name} (${plugin.files} files)`).join(', ') || 'none'}`,
  ]);
  section('App tree evidence', [
    `app tree: ${report.appTemplates.root ?? 'none (nothing to convert)'}`,
    `proven generated by intact tag (${report.appTemplates.generated.length}): ${paths(report.appTemplates.generated)}`,
    `proven generated by sync-state hash (${report.appTemplates.generatedBySyncState.length}): ${paths(report.appTemplates.generatedBySyncState)}`,
    `proven generated by legacy app/(templates) output (${report.appTemplates.generatedByLegacyRegistry.length}): ${paths(report.appTemplates.generatedByLegacyRegistry)}`,
    `proven generated by previous core template${report.appTemplates.previousTemplateVersion ? ` ${report.appTemplates.previousTemplateVersion} (${report.appTemplates.previousTemplateVersionSource}; ${report.appTemplates.previousTemplateMethod ?? report.appTemplates.previousTemplateUnavailableReason})` : ''} (${report.appTemplates.generatedByPreviousTemplate.length}): ${paths(report.appTemplates.generatedByPreviousTemplate)}`,
    `not proven by that evidence: ${report.appTemplates.unproven} (placed below)`,
  ]);
  const conversion = report.appConversion;
  section('App tree conversion (src/app is generated and git-ignored from now on)', [
    `removed, the generator emits them again (${conversion.removed.length}): ${paths(conversion.removed.map(file => file.path))}`,
    `runtime template lookups dropped, the project's template is a static override (${conversion.loaders.length}): ${paths(conversion.loaders.map(file => `${file.path}${file.template ? ` -> ${file.template}` : ' (no project template)'}`))}`,
    `customized core files converted into overrides (${conversion.overrides.length}): ${paths(conversion.overrides.map(file => `${file.path} -> ${file.destination}`))}`,
    `project-only files moved (${conversion.projectFiles.length}): ${paths(conversion.projectFiles.map(file => `${file.path} -> ${file.destination}`))}`,
    `billing webhook extensions declared in nextspark.config.ts (${conversion.webhookExtensions.length}): ${paths(conversion.webhookExtensions.map(item => `${item.provider}: ${item.module}`))}`,
    `unrecognized, migrate stops before writing (${conversion.blockers.length}): ${conversion.blockers.length ? '' : 'none'}`,
    ...conversion.blockers.map(line => `  - ${line}`),
  ]);
  for (const override of conversion.overrides) {
    section(`Override ${override.destination}: the project's ${conversion.root}/${override.path} against ${override.baseline ?? override.core} (${override.diffLines >= 0 ? `${override.diffLines} changed lines` : 'no baseline'})`, override.diff.split('\n'));
  }
  section('Project URLs that change (core dispatchers under /api/v1/theme/** and /api/v1/plugin/** are gone)', report.apiUrlMoves.length
    ? report.apiUrlMoves.map(move => `${move.file}:${move.line}: ${move.from} -> ${move.to}`)
    : ['none found in the project source']);
  section('Root proxy files', [
    `proven generated and will remove: ${paths(report.rootProxyFiles.generated)}`,
    `kept customizations: ${paths(report.rootProxyFiles.customizations)}`,
  ]);
  section('Post-migration route-root guard', [
    `current root(s): ${paths(report.routeRootGuard.currentRoots)}`,
    'will check after migration and fail if root app/ or pages/ remains alongside src/app (Next.js would ignore src/app)',
  ]);
  section('Root-first config and environment', [
    `nextspark.config.ts: ${report.config.plannedCreation ? `will create (plugins: ${report.config.plugins.join(', ') || 'none'})` : 'already exists; will not overwrite'}`,
    `.env.example: ${report.envExample.action}${report.envExample.path ? ` (${report.envExample.path})` : ''}`,
  ]);
  section('Core script references', [
    `renamed: ${paths(report.coreScripts.renamed)}`,
    `warnings: ${paths(report.coreScripts.warnings)}`,
  ]);
  section('Customized root files vs core templates', [
    `modified: ${report.rootTemplates.modified.map(file => `${file.path} (${file.changedLines} changed lines)`).join(', ') || 'none'}`,
    `generator import-rewrite warnings: ${paths(report.rootTemplates.generatorImportRewriteWarnings)}`,
  ]);
  section('Legacy import counts', [
    `theme: ${report.imports.themeOccurrences} occurrence(s) in ${report.imports.themeFiles} file(s)`,
    `plugins: ${report.imports.pluginOccurrences} occurrence(s) in ${report.imports.pluginFiles} file(s)`,
  ]);
  section('Tooling contents/ references', report.toolingReferences.length
    ? report.toolingReferences.map(reference => `${reference.path}:${reference.line || 'script'} (${reference.kind})${reference.relativeDepth ? ' [relative-depth]' : ''}: ${reference.text}`)
    : ['none']);
  section('Root-first collisions', [
    `reserved names: ${report.collisions.reserved.map(collision => collision.path).join(', ') || 'none'}`,
    `file collisions: ${report.collisions.files.map(collision => `${collision.path} (${collision.identical ? 'byte-identical duplicate' : 'different files'})`).join(', ') || 'none'}`,
    `theme documents renamed on the way, the project's file keeps its name: ${paths(report.collisions.renamed.map(item => `${item.from} -> ${item.to}`))}`,
  ]);
  section('Untracked non-ignored files', [paths(report.untracked)]);
  section('Sibling workspace references to the active theme', [report.siblingThemeReferences.length ? report.siblingThemeReferences.map(reference => `${reference.path} (${reference.occurrences})`).join(', ') : 'none']);
  section('Compatibility rewrites for the old API URLs (native Next rewrites in next.config)', report.compatRewrites.entries.length
    ? [`${report.compatRewrites.file ?? 'next.config'}:`, ...report.compatRewrites.entries.map(entry => `${entry.source} -> ${entry.destination}`), report.compatRewrites.note]
    : ['none: no project or plugin API routes move']);
  section('Old API URLs in sibling workspaces (reported, not rewritten; installed apps keep calling them through the rewrites above)', report.siblingApiUrlReferences.length ? report.siblingApiUrlReferences.map(reference => `${reference.path} (${reference.occurrences})`) : ['none']);
  section(`Next.js range (the generated host needs ${report.nextRange.required})`, report.nextRange.members.length
    ? report.nextRange.members.map(member => `${member.name} ${member.value} (${member.section}): ${member.action === 'ok' ? `ok${member.note ? ` (${member.note})` : ''}` : member.action === 'update' ? `--yes sets ${report.nextRange.required}, then install and run nextspark prepare` : `check it yourself: ${member.note}`}`)
    : [`next is not declared in the host package.json: add next@${report.nextRange.required}`]);
  section('Workspace members that declare next / react / react-dom as peers', [
    ...(report.memberPeers.length ? report.memberPeers.map(member => [
      member.updates.length ? `${member.path}: ${member.updates.map(update => `${update.name} "${update.from}" -> "${update.to}"`).join(', ')} (--yes updates it)` : null,
      member.kept.length ? `${member.path}: ${member.kept.map(note => `${note.name} "${note.range}" does not accept ${note.wanted} but reaches higher`).join(', ')} (not edited: check it yourself)` : null,
    ].filter(Boolean).join('; ')) : ['all satisfied']),
    ...report.duplicateCopies.map(copy => `${copy.member} has its own ${copy.name}@${copy.version} next to the host's ${copy.host}: two copies. After installing, check  pnpm why next react react-dom  shows one version each`),
    ...report.hostFramework.map(fix => hostFrameworkLine(fix, report.hostRoot.path)),
  ]);
  section('AI-workflow directories (.claude, .codex*, .gemini, .cursor, .superpowers, .agents): never rewritten', report.aiWorkflowReferences.length
    ? report.aiWorkflowReferences.map(reference => `${reference.path} (${reference.occurrences} old reference(s))`)
    : ['no old references']);
  section('Contracts package (a project with a mobile app)', report.contractsPackage.skipped ? [report.contractsPackage.skipped] : report.contractsPackage.needed
    ? [`${report.contractsPackage.path} is missing: --yes creates it, lists it in the workspace, makes ${report.contractsPackage.mobile} depend on it, and prepare fills it`]
    : ['nothing to create']);
  section('Block thumbnails (BlockConfig.thumbnail is the image the registry imports; the old string fails the typecheck and was never read)', report.blockThumbnails.length
    ? report.blockThumbnails.map(entry => `${entry.path}: ${entry.lines} thumbnail line(s) removed`)
    : ['none']);
  section('Generated host on the converted layout', report.hostPlan.unknown
    ? [`host plan: unknown (${report.hostPlan.reason ?? 'the prediction failed'})`]
    : report.hostPlan.simulated
    ? [
      ...(report.hostPlan.conflicts.length ? report.hostPlan.conflicts.map(line => `CONFLICT ${line}`) : [report.hostPlan.partial ? 'no conflicts in what was simulated (partial: blockers are still open)' : 'no conflicts']),
      ...report.hostPlan.notices.map(line => `notice ${line}`),
      ...(report.hostPlan.checks ? [`checks: ${Object.entries(report.hostPlan.checks).map(([name, state]) => `${name} ${state}`).join(', ')}`] : []),
      ...(report.hostPlan.method ? [`(${report.hostPlan.method === 'predictHost' ? "the installed core's predictHost" : 'nextspark prepare run on the copy: this core has no predictHost'})`] : []),
      ...(report.hostPlan.reason ? [report.hostPlan.reason] : []),
      ...(report.appConversion.blockers.length ? [`simulated with ${report.appConversion.blockers.length} blocker(s) still open: --yes would refuse. ${report.hostPlan.leftOut.length ? `Left out of the simulation (their routes are not in this plan): ${report.hostPlan.leftOut.join(', ')}` : 'No app file was left out.'}`] : []),
    ]
    : [report.hostPlan.reason ?? 'not simulated']);
  if (report.warnings.length > 0) section('Warnings', report.warnings.map(warning => `⚠ ${warning}`));
}

interface PlannedMove {
  source: string;
  destination: string;
  kind: 'theme' | 'plugin';
}

interface MovePlan {
  moves: PlannedMove[];
  duplicates: PlannedMove[];
  collisions: PlannedMove[];
  /** L3: a theme document that collided with a different project file moves under another name. */
  renamed: { from: string; to: string }[];
  reserved: { path: string; reason: string }[];
  unmoved: string[];
}

interface LegacyPathAlias {
  key: string;
  target: string;
  baseUrl: string;
}

interface TsconfigPathAliases {
  file: string;
  directory: string;
  aliases: LegacyPathAlias[];
  /** Path targets defined in this file that become legacy after this move. */
  deadTargets: Map<string, Set<number>>;
  include: string[] | null;
  exclude: string[];
  files: string[] | null;
}

interface AliasCatalog {
  configs: Map<string, TsconfigPathAliases>;
  warnings: string[];
}

function hookDestination(hostRoot: string, relativePath: string): string | null {
  if (relativePath.includes('/')) return null;
  const name = basename(relativePath);
  if (/^(?:middleware|proxy)\.[^.]+$/.test(name)) return join(hostRoot, 'config', 'hooks', `proxy.${name.split('.').slice(1).join('.')}`);
  if (/^instrumentation\.[^.]+$/.test(name)) return join(hostRoot, 'config', 'hooks', `instrumentation.${name.split('.').slice(1).join('.')}`);
  return null;
}

function reservedThemePath(relativePath: string): { path: string; reason: string } | null {
  const first = relativePath.split('/')[0];
  if (['app', 'pages', 'src'].includes(first)) return { path: `${first}/`, reason: 'Next reserves this root directory' };
  if (/^next\.config\.[^.]+$/.test(first)) return { path: first, reason: 'Next reserves next.config.* at the root' };
  return null;
}

function themeDestination(hostRoot: string, relativePath: string): string | null {
  const hook = hookDestination(hostRoot, relativePath);
  if (hook) return hook;
  if (reservedThemePath(relativePath)) return null;
  // Project source is root-first: named roots document common surfaces, while
  // every non-reserved top-level file or directory remains project-owned.
  return join(hostRoot, relativePath);
}

function planMove(hostRoot: string, themeRoot: string, pluginsRoot: string): MovePlan {
  const moves: PlannedMove[] = [];
  const duplicates: PlannedMove[] = [];
  const collisions: PlannedMove[] = [];
  const renamed: MovePlan['renamed'] = [];
  const reserved: { path: string; reason: string }[] = [];
  const unmoved: string[] = [];
  const plannedByDestination = new Map<string, PlannedMove>();
  const add = (source: string, destination: string, kind: PlannedMove['kind'], mayRename = true) => {
    const item = { source, destination, kind };
    const prior = plannedByDestination.get(destination);
    // Environment-shaped files are relocated without reading their values.
    // A destination collision is unsafe to resolve by byte comparison.
    if (isEnvironmentFile(basename(source))) {
      if (prior || existsSync(destination)) {
        collisions.push(item);
        unmoved.push(source);
      } else moves.push(item);
      plannedByDestination.set(destination, item);
      return;
    }
    // A document (README.md, ...) is no import target: it keeps the theme's copy next to the project's under a name that does not collide
    const rename = () => {
      if (!mayRename || kind !== 'theme' || dirname(source) !== themeRoot || !/\.(?:md|mdx|txt)$/i.test(source)) return false;
      const other = destination.replace(/(\.[^./\\]+)$/, '.theme$1');
      if (other === destination || existsSync(other) || plannedByDestination.has(other)) return false;
      add(source, other, kind, false);
      renamed.push({ from: pathFrom(hostRoot, destination), to: pathFrom(hostRoot, other) });
      return true;
    };
    if (prior) {
      if (readFileSync(source).equals(readFileSync(prior.source))) duplicates.push(item);
      else if (!rename()) {
        collisions.push(item);
        unmoved.push(source);
      }
      return;
    }
    if (!existsSync(destination)) moves.push(item);
    else if (statSync(destination).isFile() && readFileSync(source).equals(readFileSync(destination))) duplicates.push(item);
    else if (rename()) return;
    else {
      collisions.push(item);
      unmoved.push(source);
    }
    plannedByDestination.set(destination, item);
  };

  for (const source of moveFilesIn(themeRoot)) {
    const relativePath = pathFrom(themeRoot, source);
    // A theme manifest describes the legacy package (including its required
    // plugins); the host manifest remains the project's package.json.
    if (relativePath === 'package.json' || relativePath === '.env.example') {
      unmoved.push(source);
      continue;
    }
    const reservation = reservedThemePath(relativePath);
    if (reservation) {
      reserved.push(reservation);
      unmoved.push(source);
      continue;
    }
    const destination = themeDestination(hostRoot, relativePath);
    if (!destination) unmoved.push(source);
    else add(source, destination, 'theme');
  }
  for (const plugin of childDirectories(pluginsRoot)) {
    const root = join(pluginsRoot, plugin);
    for (const source of moveFilesIn(root)) add(source, join(hostRoot, 'plugins', plugin, pathFrom(root, source)), 'plugin');
  }
  const uniqueReserved = [...new Map(reserved.map(item => [item.path, item])).values()];
  return { moves, duplicates, collisions, renamed, reserved: uniqueReserved.sort((left, right) => left.path.localeCompare(right.path)), unmoved };
}

/** Parse the JSONC form TypeScript accepts without loading its dev-only runtime package. */
function parseJsonc(content: string): Record<string, unknown> | null {
  let output = '';
  let quote = '';
  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (quote) {
      output += character;
      if (character === '\\') output += content[++index] ?? '';
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      output += character;
      continue;
    }
    if (character === '/' && content[index + 1] === '/') {
      while (index < content.length && content[index] !== '\n') index++;
      output += content[index] ?? '';
      continue;
    }
    if (character === '/' && content[index + 1] === '*') {
      index += 2;
      while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) {
        output += content[index] === '\n' ? '\n' : ' ';
        index++;
      }
      index++;
      continue;
    }
    output += character;
  }
  // JSONC permits a trailing comma before a closing object or array. Do this
  // while tracking strings so a comma-shaped path inside a string is untouched.
  let withoutTrailingCommas = '';
  quote = '';
  for (let index = 0; index < output.length; index++) {
    const character = output[index];
    if (quote) {
      withoutTrailingCommas += character;
      if (character === '\\') withoutTrailingCommas += output[++index] ?? '';
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"') {
      quote = character;
      withoutTrailingCommas += character;
      continue;
    }
    if (character === ',') {
      let next = index + 1;
      while (/\s/.test(output[next] ?? '')) next++;
      if (output[next] === '}' || output[next] === ']') continue;
    }
    withoutTrailingCommas += character;
  }
  try {
    const value = JSON.parse(withoutTrailingCommas);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Find a named JSONC array without treating brackets in strings or comments as syntax. */
function jsoncPropertyArray(content: string, property: string): { open: number; close: number } | null {
  const skipTrivia = (start: number): number => {
    let index = start;
    while (index < content.length) {
      if (/\s/.test(content[index])) {
        index++;
      } else if (content[index] === '/' && content[index + 1] === '/') {
        index += 2;
        while (index < content.length && content[index] !== '\n') index++;
      } else if (content[index] === '/' && content[index + 1] === '*') {
        index += 2;
        while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) index++;
        index += 2;
      } else break;
    }
    return index;
  };
  const stringEnd = (start: number): number => {
    const quote = content[start];
    let index = start + 1;
    while (index < content.length) {
      if (content[index] === '\\') index += 2;
      else if (content[index++] === quote) return index;
    }
    return content.length;
  };

  for (let index = 0; index < content.length;) {
    if (content[index] === '/' && content[index + 1] === '/') {
      index = skipTrivia(index);
      continue;
    }
    if (content[index] === '/' && content[index + 1] === '*') {
      index = skipTrivia(index);
      continue;
    }
    if (content[index] !== '"') {
      index++;
      continue;
    }
    const end = stringEnd(index);
    if (content.slice(index + 1, end - 1) !== property) {
      index = end;
      continue;
    }
    let cursor = skipTrivia(end);
    if (content[cursor++] !== ':') {
      index = end;
      continue;
    }
    cursor = skipTrivia(cursor);
    if (content[cursor] !== '[') {
      index = end;
      continue;
    }
    const open = cursor++;
    let depth = 1;
    while (cursor < content.length) {
      if (content[cursor] === '"' || content[cursor] === "'") {
        cursor = stringEnd(cursor);
      } else if (content[cursor] === '/' && (content[cursor + 1] === '/' || content[cursor + 1] === '*')) {
        cursor = skipTrivia(cursor);
      } else if (content[cursor] === '[') {
        depth++;
        cursor++;
      } else if (content[cursor] === ']') {
        if (--depth === 0) return { open, close: cursor };
        cursor++;
      } else cursor++;
    }
    return null;
  }
  return null;
}

/** Whether the last JSONC token in an array body is its optional trailing comma. */
function jsoncArrayHasTrailingComma(content: string): boolean {
  let withoutComments = '';
  let quote = '';
  for (let index = 0; index < content.length; index++) {
    const character = content[index];
    if (quote) {
      withoutComments += character;
      if (character === '\\') withoutComments += content[++index] ?? '';
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      withoutComments += character;
      continue;
    }
    if (character === '/' && content[index + 1] === '/') {
      while (index < content.length && content[index] !== '\n') index++;
      withoutComments += content[index] ?? '';
      continue;
    }
    if (character === '/' && content[index + 1] === '*') {
      index += 2;
      while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) index++;
      index++;
      continue;
    }
    withoutComments += character;
  }
  return withoutComments.trimEnd().endsWith(',');
}

function pathAliasMatch(key: string, value: string): string | null {
  const wildcard = key.indexOf('*');
  if (wildcard === -1) return key === value ? '' : null;
  const prefix = key.slice(0, wildcard);
  const suffix = key.slice(wildcard + 1);
  if (!value.startsWith(prefix) || !value.endsWith(suffix)) return null;
  return value.slice(prefix.length, value.length - suffix.length);
}

function pathAliasTarget(alias: LegacyPathAlias, value: string): string | null {
  const wildcard = pathAliasMatch(alias.key, value);
  if (wildcard === null) return null;
  return resolve(alias.baseUrl, alias.target.replace(/\*/g, wildcard));
}

function staticPathAliasTarget(alias: LegacyPathAlias): string {
  return resolve(alias.baseUrl, alias.target.slice(0, alias.target.indexOf('*') === -1 ? alias.target.length : alias.target.indexOf('*')));
}

function isWithin(file: string, directory: string): boolean {
  return file === directory || file.startsWith(`${directory}${sep}`);
}

function tsconfigFile(value: string): string | null {
  if (existsSync(value) && statSync(value).isFile()) return value;
  if (existsSync(`${value}.json`) && statSync(`${value}.json`).isFile()) return `${value}.json`;
  if (existsSync(join(value, 'tsconfig.json')) && statSync(join(value, 'tsconfig.json')).isFile()) return join(value, 'tsconfig.json');
  return null;
}

/** Resolve both relative and package-name extends without importing TypeScript at runtime. */
function resolveTsconfigExtends(file: string, value: string): string | null {
  if (value.startsWith('.') || value.startsWith('/')) return tsconfigFile(resolve(dirname(file), value));
  let directory = dirname(file);
  while (true) {
    const packageName = value.startsWith('@') ? value.split('/').slice(0, 2).join('/') : value.split('/')[0];
    const packageDirectory = join(directory, 'node_modules', packageName);
    const subpath = value.slice(packageName.length).replace(/^\//, '');
    if (subpath) {
      const direct = tsconfigFile(join(packageDirectory, subpath));
      if (direct) return direct;
    }
    const manifest = readJson(join(packageDirectory, 'package.json'));
    const configured = typeof manifest?.tsconfig === 'string' ? tsconfigFile(join(packageDirectory, manifest.tsconfig)) : null;
    if (configured) return configured;
    const fallback = tsconfigFile(packageDirectory);
    if (fallback) return fallback;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value as string[] : null;
}

function globExpression(pattern: string): RegExp {
  let expression = '^';
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?';
        index += 2;
      } else {
        expression += '.*';
        index++;
      }
    } else if (character === '*') expression += '[^/]*';
    else if (character === '?') expression += '[^/]';
    else expression += escapeRegExp(character);
  }
  return new RegExp(`${expression}$`);
}

function matchesTsconfigPattern(file: string, pattern: string): boolean {
  const normalized = pattern.replace(/^\.\//, '').replace(/\\/g, '/');
  return globExpression(normalized).test(file) || (!/[?*]/.test(normalized) && file.startsWith(`${normalized}/`));
}

function configAppliesToFile(config: TsconfigPathAliases, file: string): number | null {
  if (!isWithin(file, config.directory)) return null;
  const relativeFile = pathFrom(config.directory, file);
  if (config.files) {
    const exact = config.files.some(item => relativeFile === item.replace(/^\.\//, ''));
    return exact ? 10_000 : null;
  }
  if (config.exclude.some(pattern => matchesTsconfigPattern(relativeFile, pattern))) return null;
  if (config.include === null) return 0;
  const scores = config.include
    .filter(pattern => matchesTsconfigPattern(relativeFile, pattern))
    .map(pattern => pattern.replace(/[?*]/g, '').length);
  return scores.length ? Math.max(...scores) + 1 : null;
}

function configForFile(file: string, catalog: AliasCatalog): TsconfigPathAliases | null {
  const candidates = [...catalog.configs.values()]
    .map(config => ({ config, score: configAppliesToFile(config, file) }))
    .filter((item): item is { config: TsconfigPathAliases; score: number } => item.score !== null)
    .sort((left, right) => right.config.directory.length - left.config.directory.length || right.score - left.score || left.config.file.localeCompare(right.config.file));
  return candidates[0]?.config ?? null;
}

/**
 * Read effective path aliases through extends. Alias targets retain the baseUrl
 * of the configuration file that declared them, matching TypeScript's paths
 * semantics even when a child config changes its own baseUrl.
 */
function legacyPathAliases(hostRoot: string, themeRoot: string, pluginsRoot: string, plan: MovePlan): AliasCatalog {
  const configs = new Map<string, TsconfigPathAliases>();
  const warnings = new Set<string>();
  const loading = new Set<string>();
  const fullyMoved = (directory: string): boolean => {
    if (isWithin(directory, pluginsRoot)) return ![...plan.unmoved].some(file => isWithin(file, directory));
    if (isWithin(directory, themeRoot)) return ![...plan.unmoved].some(file => isWithin(file, directory));
    const themesRoot = dirname(themeRoot);
    return directory === themesRoot
      && childDirectories(themesRoot).every(name => name === basename(themeRoot))
      && ![...plan.unmoved].some(file => isWithin(file, themesRoot));
  };
  const load = (file: string): TsconfigPathAliases | null => {
    const cached = configs.get(file);
    if (cached) return cached;
    if (loading.has(file)) {
      warnings.add(`${pathFrom(hostRoot, file)} (extends cycle)`);
      return null;
    }
    loading.add(file);
    const parsed = parseJsonc(readFileSync(file, 'utf8'));
    if (!parsed) {
      warnings.add(pathFrom(hostRoot, file));
      loading.delete(file);
      return null;
    }
    const compilerOptions = typeof parsed.compilerOptions === 'object' && parsed.compilerOptions !== null && !Array.isArray(parsed.compilerOptions)
      ? parsed.compilerOptions as Record<string, unknown> : {};
    const inherited: LegacyPathAlias[] = [];
    const extendsValue = parsed.extends;
    if (typeof extendsValue === 'string') {
      const parentFile = resolveTsconfigExtends(file, extendsValue);
      if (!parentFile) warnings.add(`${pathFrom(hostRoot, file)} (cannot resolve extends ${extendsValue})`);
      else inherited.push(...(load(parentFile)?.aliases ?? []));
    }
    const paths = typeof compilerOptions.paths === 'object' && compilerOptions.paths !== null && !Array.isArray(compilerOptions.paths)
      ? compilerOptions.paths as Record<string, unknown> : {};
    const localAliases: LegacyPathAlias[] = [];
    const deadTargets = new Map<string, Set<number>>();
    const baseUrl = resolve(dirname(file), typeof compilerOptions.baseUrl === 'string' ? compilerOptions.baseUrl : '.');
    for (const [key, values] of Object.entries(paths)) {
      if (!Array.isArray(values)) continue;
      for (let index = 0; index < values.length; index++) {
        const target = values[index];
        if (typeof target !== 'string') continue;
        const alias = { key, target, baseUrl };
        localAliases.push(alias);
        const staticTarget = staticPathAliasTarget(alias);
        if ((isWithin(staticTarget, dirname(themeRoot)) || isWithin(staticTarget, pluginsRoot)) && fullyMoved(staticTarget)) {
          const targets = deadTargets.get(key) ?? new Set<number>();
          targets.add(index);
          deadTargets.set(key, targets);
        }
      }
    }
    // A child paths entry replaces the inherited entry for the same key.
    const localKeys = new Set(localAliases.map(alias => alias.key));
    const aliases = [...inherited.filter(alias => !localKeys.has(alias.key)), ...localAliases];
    const config: TsconfigPathAliases = {
      file,
      directory: dirname(file),
      aliases,
      deadTargets,
      include: stringArray(parsed.include),
      exclude: stringArray(parsed.exclude) ?? [],
      files: stringArray(parsed.files),
    };
    configs.set(file, config);
    loading.delete(file);
    return config;
  };

  for (const file of filesIn(hostRoot).filter(item => /^tsconfig(?:\.[^.]+)*\.json$/.test(basename(item)))) load(file);
  return { configs, warnings: [...warnings].sort() };
}

function rewriteDeadTsconfigAliases(content: string, config: TsconfigPathAliases): string {
  if (config.deadTargets.size === 0) return content;
  const parsed = parseJsonc(content);
  if (!parsed) return content;
  const compilerOptions = parsed.compilerOptions;
  if (typeof compilerOptions !== 'object' || compilerOptions === null || Array.isArray(compilerOptions)) return content;
  const paths = (compilerOptions as Record<string, unknown>).paths;
  if (typeof paths !== 'object' || paths === null || Array.isArray(paths)) return content;
  let changed = false;
  for (const [key, indexes] of config.deadTargets) {
    const values = (paths as Record<string, unknown>)[key];
    if (!Array.isArray(values)) continue;
    const kept = values.filter((_value, index) => !indexes.has(index));
    if (kept.length === values.length) continue;
    changed = true;
    if (kept.length === 0) delete (paths as Record<string, unknown>)[key];
    else (paths as Record<string, unknown>)[key] = kept;
  }
  if (!changed) return content;
  const indentation = content.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  return `${JSON.stringify(parsed, null, indentation)}${content.endsWith('\n') ? '\n' : ''}`;
}

function relativeSpecifier(fromFile: string, toFile: string): string {
  let value = relative(dirname(fromFile), toFile).split(sep).join('/');
  if (!value.startsWith('.')) value = `./${value}`;
  return value;
}

function isText(buffer: Buffer): boolean {
  return !buffer.includes(0) && !buffer.toString('utf8').includes('\uFFFD');
}

const moduleTargetSuffixes = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '/index.ts', '/index.tsx'];

function directMoveDestination(target: string, planned: Map<string, string>): string | null {
  const exact = planned.get(target);
  if (exact) return exact;
  for (const suffix of moduleTargetSuffixes) {
    const destination = planned.get(`${target}${suffix}`);
    if (destination) return destination.slice(0, -suffix.length);
  }
  return null;
}

function projectedDirectoryDestination(directory: string, planned: Map<string, string>, unmoved: Set<string>): string | null {
  if ([...unmoved].some(file => file === directory || file.startsWith(`${directory}${sep}`))) return null;
  const candidates = new Set<string>();
  for (const [source, destination] of planned) {
    if (!source.startsWith(`${directory}${sep}`)) continue;
    const depth = relative(directory, source).split(sep).length;
    let candidate = destination;
    for (let index = 0; index < depth; index++) candidate = dirname(candidate);
    candidates.add(candidate);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

function movedReferenceDestination(target: string, planned: Map<string, string>, unmoved: Set<string>, themeRoot: string, hostRoot: string): string | null {
  const wildcard = target.search(/[*?[{]/);
  const literal = wildcard === -1 ? target : target.slice(0, wildcard).replace(/[\\/]$/, '');
  const wildcardSuffix = wildcard === -1 ? '' : target.slice(literal.length);
  const direct = directMoveDestination(literal, planned);
  if (direct) return `${direct}${wildcardSuffix}`;

  let current = literal;
  while (current === themeRoot || current.startsWith(`${themeRoot}${sep}`) || [...planned.keys()].some(source => source.startsWith(`${current}${sep}`))) {
    const mapped = current === themeRoot && ![...unmoved].some(file => file === themeRoot || file.startsWith(`${themeRoot}${sep}`))
      ? hostRoot
      : projectedDirectoryDestination(current, planned, unmoved);
    if (mapped) return join(mapped, relative(current, literal)) + wildcardSuffix;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

/** TypeScript resolves these extensionful spellings, but source imports must not emit them. */
function canonicalAliasSpecifier(hostRoot: string, target: string, sourceTarget = target): string {
  let value = pathFrom(hostRoot, target).replace(/\.(?:ts|tsx|mts|cts)$/i, '');
  // `dir/index.ts` and `dir.ts` have different meanings when both exist.
  // Keep the explicit index spelling in that ambiguity rather than changing
  // TypeScript's resolution order.
  if (/(?:^|\/)index$/.test(value)) {
    const directory = value.replace(/(?:^|\/)index$/, '');
    const sibling = resolve(hostRoot, directory);
    const sourceSibling = sourceTarget.replace(/\.(?:ts|tsx|mts|cts)$/i, '').replace(/(?:^|\/)index$/, '');
    if (!moduleTargetSuffixes.some(suffix => suffix.startsWith('.') && (existsSync(`${sibling}${suffix}`) || existsSync(`${sourceSibling}${suffix}`)))) {
      value = directory;
    }
  }
  return `@/${value}`;
}

/** Resolve a specifier using the aliases of the tsconfig that governs its file. */
function aliasResolution(value: string, aliases: LegacyPathAlias[]): { alias: LegacyPathAlias; target: string } | null {
  const keys = [...new Set(aliases.map(alias => alias.key))]
    .filter(key => pathAliasMatch(key, value) !== null)
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
  for (const key of keys) {
    const candidates = aliases.filter(alias => alias.key === key)
      .map(alias => ({ alias, target: pathAliasTarget(alias, value) }))
      .filter((item): item is { alias: LegacyPathAlias; target: string } => item.target !== null);
    const current = candidates.find(candidate => importTargetExists(candidate.target)) ?? candidates[0];
    if (current) return current;
  }
  return null;
}

/** Rewrites only aliases whose current TypeScript resolution is legacy source. */
function rewriteLegacyAliasImports(content: string, source: string, catalog: AliasCatalog, themeRoot: string, pluginsRoot: string, hostRoot: string, planned: Map<string, string>, unmoved: Set<string>): string {
  const aliases = configForFile(source, catalog)?.aliases ?? [];
  let next = content;
  for (const key of [...new Set(aliases.map(alias => alias.key))].sort((left, right) => right.length - left.length)) {
    const wildcard = key.indexOf('*');
    // The quote following a tsconfig property name is followed by a colon;
    // import specifiers and ordinary string values are not.
    const boundary = "(?=(?:['\"`](?!\\s*:)|\\s|\\)|,|$))";
    const pattern = wildcard === -1
      ? new RegExp(`${escapeRegExp(key)}${boundary}`, 'g')
      : new RegExp(`${escapeRegExp(key.slice(0, wildcard))}([^'\"\`\\s)]*)${escapeRegExp(key.slice(wildcard + 1))}${boundary}`, 'g');
    next = next.replace(pattern, (match, captured = '') => {
      const value = wildcard === -1 ? key : `${key.slice(0, wildcard)}${captured}${key.slice(wildcard + 1)}`;
      const current = aliasResolution(value, aliases);
      // A textual match is never enough: do not rewrite a valid non-legacy import.
      if (!current || current.alias.key !== key || (!isWithin(current.target, themeRoot) && !isWithin(current.target, pluginsRoot))) return match;
      const mapped = movedReferenceDestination(current.target, planned, unmoved, themeRoot, hostRoot);
      return mapped ? canonicalAliasSpecifier(hostRoot, mapped, current.target) : match;
    });
  }
  return next;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteLegacyPaths(content: string, source: string, destination: string, themeRoot: string, pluginsRoot: string, hostRoot: string, theme: string, planned: Map<string, string>, unmoved: Set<string>, catalog: AliasCatalog): string {
  const escapedTheme = theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const themePattern = `contents/themes/${escapedTheme}`;
  const mapThemeSuffix = (suffix: string): string | null => {
    const normalized = suffix.replace(/^\//, '');
    const mapped = movedReferenceDestination(join(themeRoot, normalized), planned, unmoved, themeRoot, hostRoot);
    return mapped ? pathFrom(hostRoot, mapped) : null;
  };
  const mapPluginSuffix = (suffix: string): string | null => {
    const normalized = suffix.replace(/^\//, '');
    const mapped = movedReferenceDestination(join(pluginsRoot, normalized), planned, unmoved, themeRoot, hostRoot);
    return mapped ? pathFrom(hostRoot, mapped) : null;
  };
  let next = content
    .replace(new RegExp(`@/${themePattern}/([^'"\`\\s)]*)`, 'g'), (all, suffix: string) => {
      const mapped = mapThemeSuffix(suffix);
      return mapped ? `@/${mapped}` : all;
    })
    .replace(/@\/contents\/plugins\/([^'"`\s)]*)/g, (all, suffix: string) => {
      const mapped = mapPluginSuffix(suffix);
      return mapped ? `@/${mapped}` : all;
    });

  // Jest aliases use a capture placeholder rather than a filesystem glob, so
  // they cannot be resolved by movedReferenceDestination. Rehome the known
  // root-first aliases while the active theme name is still available.
  next = next
    .replace(
      /(['"])\^@\/themes\/\(\.\*\)\$\1(\s*:\s*)(['"])<rootDir>\/contents\/themes\/\$1\3/g,
      (_all, keyQuote: string, separator: string, valueQuote: string) => `${keyQuote}__NEXTSPARK_THEME_ALIAS__${keyQuote}${separator}${valueQuote}<rootDir>/$1${valueQuote}`,
    )
    .replace(/<rootDir>\/contents\/entities\/\$1/g, () => '<rootDir>/entities/$1')
    .replace(/<rootDir>\/contents\/plugins\/\$1/g, () => '<rootDir>/plugins/$1')
    .replace(/<rootDir>\/contents\/\$1/g, () => '<rootDir>/$1');

  // A relative legacy path has to be recalculated from the file's new home;
  // this covers imports, CSS @import, tsconfig paths, and helper scripts alike.
  next = next.replace(new RegExp(`((?:\\.\\.?/)+)${themePattern}(/[^'"\`\\s)]*)?`, 'g'), (all, _prefix: string, _suffix = '') => {
    const oldTarget = resolve(dirname(source), all);
    if (!(oldTarget === themeRoot || oldTarget.startsWith(`${themeRoot}${sep}`))) return all;
    const mapped = movedReferenceDestination(oldTarget, planned, unmoved, themeRoot, hostRoot);
    return mapped ? relativeSpecifier(destination, mapped) : all;
  });
  // The theme root itself becomes the host root: after `web/` that is `web/`, not `web/.`. A reference starts at a word boundary
  // (not `mycontents/...`) and outside a URL; the punctuation that ends a sentence stays where it was.
  const inUrl = (whole: string, offset: number) => /:\/\//.test(whole.slice(0, offset).split(/[\s'"`(]/).pop() ?? '');
  const themeReference = (mapped: string | null, all: string, offset: number, whole: string, slash: string, punctuation: string): string => {
    if (mapped === null || inUrl(whole, offset)) return all;
    if (mapped !== '.') return `${mapped}${punctuation}`;
    return `${offset > 0 && whole[offset - 1] === '/' ? '' : `.${slash}`}${punctuation}`;
  };
  next = next.replace(new RegExp(`(?<![\\w@-])${themePattern}/([^'"\`\\s)]*)`, 'g'), (all, suffix: string, offset: number, whole: string) => {
    // trailing sentence punctuation stays outside the path
    let end = suffix.length;
    while (end > 0 && '.,;:!?'.includes(suffix[end - 1])) end -= 1;
    return themeReference(mapThemeSuffix(suffix.slice(0, end)), all, offset, whole, '/', suffix.slice(end));
  });
  next = next.replace(new RegExp(`(?<![\\w@-])${themePattern}(?=[.,;:!?]*(?:['"\`\\s)\\]]|$))`, 'g'), (all, offset: number, whole: string) => themeReference(mapThemeSuffix(''), all, offset, whole, '', ''));
  // Themes stop being workspace members. Keep the host package in a workspace
  // manifest rather than leaving a glob that points at a removed directory.
  const themesRoot = dirname(themeRoot);
  // L6: git matches no pattern that starts with './', so a .gitignore loses the glob with its slash instead (a pattern that starts with the glob gets a leading /, which keeps it anchored as the path was; after a prefix (web/contents/themes/*/x, /contents/themes/*/x) the glob and its slash just go)
  if (childDirectories(themesRoot).every(name => name === theme) && mapThemeSuffix('')) next = next.replace(basename(source) === '.gitignore' ? /contents\/themes\/\*(?:\/|(?=\s|$))/g : /contents\/themes\/\*/g, (all: string, offset: number, whole: string) => basename(source) !== '.gitignore' ? '.' : all.endsWith('/') && (offset === 0 || whole[offset - 1] === '\n' || (whole[offset - 1] === '!' && (offset === 1 || whole[offset - 2] === '\n'))) ? '/' : '');
  next = next.replace(/contents\/plugins\/([^'"`\s)]*)/g, (all, suffix: string) => mapPluginSuffix(suffix) ?? all);
  return rewriteLegacyAliasImports(next, source, catalog, themeRoot, pluginsRoot, hostRoot, planned, unmoved)
    .replace(/__NEXTSPARK_THEME_ALIAS__/g, `^@/themes/${theme}/(.*)$`);
}

/**
 * Where a relative reference lands after the move when its target is not a moved file (L7): a
 * plugin's files (including its node_modules) follow the plugin to plugins/<name>, a file outside
 * contents/ stays where it is. A theme file that stays behind has no new place.
 */
function unmovedReferenceDestination(target: string, themeRoot: string, pluginsRoot: string, hostRoot: string, unmoved: Set<string>): string | null {
  // a file that stays (reserved, colliding) is still where it was; a directory holding one has no single new place
  if (unmoved.has(target)) return target;
  if ([...unmoved].some(file => file.startsWith(`${target}${sep}`))) return null;
  if (isWithin(target, pluginsRoot)) return join(hostRoot, 'plugins', relative(pluginsRoot, target));
  if (isWithin(target, join(hostRoot, 'contents'))) return null;
  return target;
}

function rewriteMovedRelativeImports(content: string, source: string, destination: string, planned: Map<string, string>, themeRoot: string, pluginsRoot: string, hostRoot: string, unmoved: Set<string>): string {
  const replace = (_all: string, before: string, quote: string, value: string, after: string) => {
    if (!value.startsWith('.')) return `${before}${quote}${value}${quote}${after}`;
    if (quote === '`' && value.includes('${')) return `${before}${quote}${value}${quote}${after}`;
    const target = resolve(dirname(source), value);
    // A path in a string (jest.mock, require.resolve, ...) that leaves the directory it was written in keeps pointing at the same file
    const targetDestination = directMoveDestination(target, planned) ?? unmovedReferenceDestination(target, themeRoot, pluginsRoot, hostRoot, unmoved);
    // Do not manufacture a new import when the old target is absent from the move. The post-move
    // check reports it as a broken import instead.
    if (!targetDestination) return `${before}${quote}${value}${quote}${after}`;
    // Only a path whose meaning changes when this file moves needs adjustment.
    if (dirname(source) === dirname(destination) && targetDestination === target) return `${before}${quote}${value}${quote}${after}`;
    return `${before}${quote}${relativeSpecifier(destination, targetDestination)}${quote}${after}`;
  };
  return content
    .replace(/(\bfrom\s*|\bimport\s*\(\s*|\brequire(?:\.resolve|\.requireActual)?\s*\(\s*|\bjest\.(?:mock|doMock|unmock|dontMock|requireActual|requireMock|createMockFromModule)\s*\(\s*|\bimport\s*)(['"`])(\.[^'"`]*)\2(\s*\)?)/g, replace);
}

function stylesheetReferenceParts(value: string, glob: boolean): { path: string; suffix: string } {
  if (glob) return { path: value, suffix: '' };
  const suffix = value.search(/[?#]/);
  return suffix === -1
    ? { path: value, suffix: '' }
    : { path: value.slice(0, suffix), suffix: value.slice(suffix) };
}

function stylesheetLiteralTarget(target: string): string {
  const wildcard = target.search(/[*[{]/);
  return (wildcard === -1 ? target : target.slice(0, wildcard)).replace(/[\\/]$/, '');
}

function stylesheetDependencyName(target: string, themeNodeModules: string): string {
  const segments = relative(themeNodeModules, target).split(sep).filter(Boolean);
  if (segments[0]?.startsWith('@') && segments[1]) return `${segments[0]}/${segments[1]}`;
  return segments[0] ?? 'the dependency';
}

/** Remove repeated Tailwind source directives after two legacy paths converge. */
function deduplicateStylesheetSources(content: string): string {
  const seen = new Set<string>();
  return content.replace(/^[ \t]*@source\s+(['"])([^'"]+)\1\s*;?[ \t]*(?:\r\n|\n|\r|$)/gm, line => {
    const match = /^[ \t]*@source\s+(['"])([^'"]+)\1/.exec(line);
    if (!match || !seen.has(match[2])) {
      if (match) seen.add(match[2]);
      return line;
    }
    return '';
  });
}

/** Keep relative CSS references attached to their old target when a theme file moves. */
function rewriteMovedStylesheetReferences(content: string, source: string, destination: string, planned: Map<string, string>, unmoved: Set<string>, themeRoot: string, pluginsRoot: string, hostRoot: string): string {
  if (!/\.(?:css|scss|pcss)$/i.test(source)) return content;
  const contentsRoot = join(hostRoot, 'contents');
  const themeNodeModules = join(themeRoot, 'node_modules');
  const rebase = (value: string, index: number, glob = false): string => {
    if (!value.startsWith('.')) return value;
    const parts = stylesheetReferenceParts(value, glob);
    const oldTarget = resolve(dirname(source), parts.path);
    const oldLiteral = stylesheetLiteralTarget(oldTarget);
    let target = isWithin(oldLiteral, themeRoot) || isWithin(oldLiteral, pluginsRoot)
      ? movedReferenceDestination(oldTarget, planned, unmoved, themeRoot, hostRoot)
      : directMoveDestination(oldTarget, planned);
    // Legacy theme styles scanned contents/ because that was the source root.
    // Once the selected theme becomes root-first, that scan root is the host.
    if (!target && glob && oldLiteral === contentsRoot) {
      target = `${hostRoot}${oldTarget.slice(oldLiteral.length)}`;
    }
    // A legacy theme package can leave its manifest behind while its CSS is
    // promoted to the host. Its dependencies must resolve from the project,
    // never by retaining an old theme-local node_modules reference.
    if (isWithin(oldLiteral, themeNodeModules)) {
      const hostTarget = `${join(hostRoot, 'node_modules')}${oldTarget.slice(themeNodeModules.length)}`;
      if (existsSync(stylesheetLiteralTarget(hostTarget))) {
        target = hostTarget;
      } else {
        const line = content.slice(0, index).split(/\r?\n/).length;
        const dependency = stylesheetDependencyName(oldLiteral, themeNodeModules);
        throw new MissingThemeStylesheetDependencyError(`Cannot safely rebase relative stylesheet reference in ${pathFrom(hostRoot, source)}:${line}: ${value} requires ${dependency}, which is unavailable from the project node_modules. Add ${dependency} to the project package.json and install it, then rerun.`);
      }
    }
    target ??= oldTarget;
    const targetLiteral = stylesheetLiteralTarget(target);
    if (!isWithin(targetLiteral, hostRoot)) {
      const line = content.slice(0, index).split(/\r?\n/).length;
      throw new MigrateAnalysisError(`Cannot safely rebase relative stylesheet reference in ${pathFrom(hostRoot, source)}:${line}: ${value} would point outside the project root.`);
    }
    return `${relativeSpecifier(destination, target)}${parts.suffix}`;
  };

  let next = content
    .replace(/(@source\s+)(['"])(\.[^'"]*)\2/g, (all, before: string, quote: string, value: string, index: number) => `${before}${quote}${rebase(value, index, true)}${quote}`)
    .replace(/(@import\s+)(['"])(\.[^'"]*)\2/g, (all, before: string, quote: string, value: string, index: number) => `${before}${quote}${rebase(value, index)}${quote}`)
    .replace(/url\(\s*(?:(['"])(\.[^'"]*)\1|(\.[^)'"\s]+))\s*\)/g, (all, quote: string | undefined, quoted: string | undefined, bare: string | undefined, index: number) => {
      const value = quoted ?? bare;
      if (!value) return all;
      const rewritten = rebase(value, index);
      return `url(${quote ?? ''}${rewritten}${quote ?? ''})`;
    });
  next = deduplicateStylesheetSources(next);
  return next;
}

/** Some test runners encode their root in a relative path rather than naming the theme. */
function rewriteMovedDepthConfig(content: string, source: string, destination: string, planned: Map<string, string>, unmoved: Set<string>, themeRoot: string, hostRoot: string): string {
  const rebase = (value: string): string => {
    const oldTarget = resolve(dirname(source), value);
    const legacyPluginsRoot = join(hostRoot, 'contents', 'plugins');
    const movedTarget = isWithin(oldTarget, themeRoot) || isWithin(oldTarget, legacyPluginsRoot)
      ? movedReferenceDestination(oldTarget, planned, unmoved, themeRoot, hostRoot)
      : null;
    const target = movedTarget
      ?? planned.get(oldTarget)
      ?? oldTarget;
    return relativeSpecifier(destination, target);
  };
  const replace = (_all: string, before: string, quote: string, value: string, after = '') => {
    if (!value.startsWith('.')) return `${before}${quote}${value}${quote}${after}`;
    return `${before}${quote}${rebase(value)}${quote}${after}`;
  };
  const parsedOriginal = parseJsonc(content);
  const originalCompilerOptions = parsedOriginal?.compilerOptions;
  const originalBaseUrlValue = typeof originalCompilerOptions === 'object' && originalCompilerOptions !== null && !Array.isArray(originalCompilerOptions)
    && typeof (originalCompilerOptions as Record<string, unknown>).baseUrl === 'string'
    ? (originalCompilerOptions as Record<string, string>).baseUrl
    : '.';
  const originalBaseUrl = resolve(dirname(source), originalBaseUrlValue);
  let next = content
    .replace(/(\brootDir\s*[:=]\s*)(['"])(\.[^'"]*)\2/g, (all, before: string, quote: string, value: string) => replace(all, before, quote, value))
    .replace(/(\b(?:path\.)?resolve\(\s*__dirname\s*,\s*)(['"])(\.[^'"]*)\2(\s*\))/g, replace);

  if (!/^tsconfig(?:\.[^.]+)*\.json$/.test(basename(source))) return next;
  next = next.replace(/("(?:extends|baseUrl)"\s*:\s*)(")(\.[^"]*)\2/g, (all, before: string, quote: string, value: string) => replace(all, before, quote, value));
  for (const property of ['include', 'files']) {
    const array = jsoncPropertyArray(next, property);
    if (!array) continue;
    const body = next.slice(array.open + 1, array.close)
      .replace(/(")(\.[^"]*)\1/g, (_all, quote: string, value: string) => `${quote}${rebase(value)}${quote}`);
    next = `${next.slice(0, array.open + 1)}${body}${next.slice(array.close)}`;
  }
  const parsedMoved = parseJsonc(next);
  const movedCompilerOptions = parsedMoved?.compilerOptions;
  const movedBaseUrlValue = typeof movedCompilerOptions === 'object' && movedCompilerOptions !== null && !Array.isArray(movedCompilerOptions)
    && typeof (movedCompilerOptions as Record<string, unknown>).baseUrl === 'string'
    ? (movedCompilerOptions as Record<string, string>).baseUrl
    : '.';
  const movedBaseUrl = resolve(dirname(destination), movedBaseUrlValue);
  const paths = typeof movedCompilerOptions === 'object' && movedCompilerOptions !== null && !Array.isArray(movedCompilerOptions)
    ? (movedCompilerOptions as Record<string, unknown>).paths
    : null;
  if (typeof paths === 'object' && paths !== null && !Array.isArray(paths)) {
    for (const [key, rawValues] of Object.entries(paths)) {
      if (!Array.isArray(rawValues) || !rawValues.every(value => typeof value === 'string')) continue;
      const values = rawValues as string[];
      const rewritten = values.map(value => {
        if (!value.startsWith('.')) return value;
        const oldTarget = resolve(originalBaseUrl, value);
        const legacyContentsRoot = join(hostRoot, 'contents');
        const target = oldTarget === `${legacyContentsRoot}${sep}*`
          ? join(hostRoot, '*')
          : isWithin(oldTarget, legacyContentsRoot)
          ? movedReferenceDestination(oldTarget, planned, unmoved, themeRoot, hostRoot) ?? oldTarget
          : planned.get(oldTarget) ?? oldTarget;
        let rebased = relative(movedBaseUrl, target).split(sep).join('/');
        if (!rebased.startsWith('.')) rebased = `./${rebased}`;
        return rebased;
      });
      if (rewritten.every((value, index) => value === values[index])) continue;
      const array = jsoncPropertyArray(next, key);
      if (!array) continue;
      next = `${next.slice(0, array.open + 1)}${rewritten.map(value => JSON.stringify(value)).join(', ')}${next.slice(array.close)}`;
    }
  }
  return next;
}

function rewriteHookExport(content: string, destination: string): string {
  if (!/config[\\/]hooks[\\/]proxy\./.test(destination)) return content;
  let next = content
    .replace(/export\s+(?:async\s+)?function\s+(?:middleware|proxy)\b/g, match => match.replace(/(?:middleware|proxy)\b/, 'proxyHook'))
    .replace(/export\s+(const|let|var)\s+(?:middleware|proxy)\b/g, 'export $1 proxyHook')
    .replace(/export\s+default\s+((?:async\s+)?function)\s*(?:middleware|proxy)?\s*\(/g, 'export $1 proxyHook(')
    .replace(/export\s+default\s+((?:async\s+)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)/g, 'export const proxyHook = $1')
    .replace(/export\s+default\s+(middleware|proxy)\s*;?/g, 'export { $1 as proxyHook };')
    .replace(/export\s*\{\s*(middleware|proxy)\s*\}/g, 'export { $1 as proxyHook }');
  if (!/export\s+(?:(?:async\s+)?function|const|let|var)\s+proxyHook\b/.test(next)
    && !/export\s*\{[^}]*\bproxyHook\b[^}]*\}/.test(next)) {
    throw new MigrateAnalysisError(`Refusing to rename ${pathFrom(dirname(dirname(dirname(destination))), destination)}: its middleware export shape is not recognized.`);
  }
  return next;
}

function rewriteHookImports(content: string, destination: string, hostRoot: string): string {
  let importedLocalBinding: string | null = null;
  const rewritten = content.replace(/import\s*(\{[^}]*\})(\s*from\s*['"][^'"]*config\/hooks\/proxy[^'"]*['"])/g, (all, clause: string, from: string) => {
    const local = hookMiddlewareImportLocalBinding(clause);
    if (!local) return all;
    importedLocalBinding = local;
    const preserveTestBinding = isWithin(destination, join(hostRoot, 'tests')) && local === 'middleware';
    const importName = preserveTestBinding || local !== 'middleware' ? `proxyHook as ${local}` : 'proxyHook';
    return `import { ${importName} }${from}`;
  });
  // A test's imported local is deliberately still named `middleware`. Its
  // re-export must retain that local binding, rather than exporting an
  // unbound `proxyHook` identifier.
  return importedLocalBinding === 'middleware' && !isWithin(destination, join(hostRoot, 'tests'))
    ? rewritten.replace(/export\s*\{\s*middleware\s*\}/g, 'export { proxyHook }')
    : rewritten;
}

/** The only legacy hook import shape whose export rename is unambiguous. */
function hookMiddlewareImportLocalBinding(clause: string): string | null {
  const match = /^\{\s*middleware\s*(?:as\s+([A-Za-z_$][\w$]*))?\s*\}$/.exec(clause);
  return match?.[1] ?? (match ? 'middleware' : null);
}

/** Refuse default, namespace, side-effect, type, and mixed legacy hook imports before writes. */
function validateLegacyHookImportShapes(hostRoot: string, hookSource: string, catalog: AliasCatalog): void {
  const staticImport = /\bimport\s+([^;]*?)\s+from\s*(['"])([^'"]+)\2/g;
  const sideEffectImport = /\bimport\s*(['"])([^'"]+)\1/g;
  const validate = (file: string, target: string, clause: string | null, index: number) => {
    const resolved = resolvedImportTarget(target, file, hostRoot, catalog, true);
    if (!resolved || !importTargetSuffixes.some(suffix => `${resolved}${suffix}` === hookSource)) return;
    if (clause !== null && hookMiddlewareImportLocalBinding(clause.trim())) return;
    const line = readFileSync(file, 'utf8').slice(0, index).split(/\r?\n/).length;
    throw new MigrateAnalysisError(`Cannot safely rewrite legacy middleware import in ${pathFrom(hostRoot, file)}:${line}; only named middleware imports are supported.`);
  };
  for (const file of filesIn(hostRoot).filter(item => !inAiWorkflowDirectory(hostRoot, item))) {
    const content = readFileSync(file, 'utf8');
    const view = sourceView(content);
    const isCodeImport = (index: number) => view.code.slice(index, index + 'import'.length) === 'import';
    for (const match of content.matchAll(staticImport)) {
      if (isCodeImport(match.index ?? 0)) validate(file, match[3], match[1], match.index ?? 0);
    }
    for (const match of content.matchAll(sideEffectImport)) {
      if (isCodeImport(match.index ?? 0)) validate(file, match[2], null, match.index ?? 0);
    }
  }
}

/** Rehome filesystem and regex references used by tests that inspect the old theme host. */
function rewriteRootFirstTestContracts(content: string, destination: string, hostRoot: string, theme: string): string {
  if (!isWithin(destination, join(hostRoot, 'tests'))) return content;
  const escapedLegacyHook = `@/contents/themes/${theme}/middleware`.replaceAll('/', '\\/');
  const escapedProjectHook = '@/config/hooks/proxy'.replaceAll('/', '\\/');
  return content
    .replace(/\bjoin\(\s*APP_ROOT\s*,\s*(['"])app\1\s*,/g, "join(APP_ROOT, 'src', 'app',")
    .replace(/(['"])middleware\.ts\1/g, "$1config/hooks/proxy.ts$1")
    .replaceAll(escapedLegacyHook, escapedProjectHook);
}

/** Root-first middleware has one project-wide registry rather than a theme-keyed registry. */
function rewriteRemovedMiddlewareApi(content: string, destination: string, hostRoot: string): string {
  if (!content.includes('@nextsparkjs/core/lib/middleware')) return content;
  let next = content;

  // The old predicate's theme selector is intentionally discarded: root-first has one project hook.
  next = next.replace(
    /\b([A-Za-z_$][\w$]*)\s*&&\s*hasThemeMiddleware\s*\(\s*\1\s*\)/g,
    'hasProjectMiddleware()',
  );
  next = next.replace(/\bhasThemeMiddleware\s*\(\s*[^()]*\)/g, 'hasProjectMiddleware()');
  if (/\bhasThemeMiddleware\s*\(/.test(next)) {
    throw new MigrateAnalysisError(`Cannot safely migrate ${pathFrom(hostRoot, destination)}: replace hasThemeMiddleware(themeName) with hasProjectMiddleware().`);
  }

  // These adjacent APIs made the same theme-keyed to project-wide signature change.
  next = next
    .replace(/\bexecuteThemeMiddleware\s*\(\s*[^,()]+\s*,\s*/g, 'executeProjectMiddleware(')
    .replace(/\bgetThemeAppConfig\s*\(\s*[^()]*\)/g, 'getProjectAppConfig()');
  if (/\b(?:executeThemeMiddleware|getThemeAppConfig)\s*\(/.test(next)) {
    throw new MigrateAnalysisError(`Cannot safely migrate ${pathFrom(hostRoot, destination)}: use the root-first project middleware APIs without a theme argument.`);
  }
  return next
    .replace(/\bhasThemeMiddleware\b/g, 'hasProjectMiddleware')
    .replace(/\bexecuteThemeMiddleware\b/g, 'executeProjectMiddleware')
    .replace(/\bgetThemeAppConfig\b/g, 'getProjectAppConfig');
}

function rewriteActiveThemeUse(content: string, destination: string, hostRoot: string, theme: string): string {
  // A root-first project no longer selects a theme at runtime. Tests moved
  // out of that theme may still assert that the old runner selected the
  // fixture they are exercising; preserve that assertion as the known source
  // theme instead of turning it into `undefined`.
  const replacement = isWithin(destination, join(hostRoot, 'tests')) ? JSON.stringify(theme) : 'undefined';
  return content
    .replace(/process\.env\.NEXT_PUBLIC_ACTIVE_THEME/g, replacement)
    .replace(/NEXT_PUBLIC_ACTIVE_THEME/g, 'ROOT_FIRST_PROJECT');
}

function removeActiveThemeFromExample(hostRoot: string): boolean {
  const file = join(hostRoot, '.env.example');
  if (!existsSync(file)) return false;
  assertContained(hostRoot, file);
  const original = readFileSync(file, 'utf8');
  const next = original.replace(/^.*NEXT_PUBLIC_ACTIVE_THEME.*(?:\r?\n|$)/gm, '');
  if (next === original) return false;
  writeFileSync(file, next);
  return true;
}

function removeEmptyAncestors(directory: string, stop: string): void {
  let current = directory;
  while (current !== stop && current.startsWith(`${stop}${sep}`)) {
    try { rmdirSync(current); } catch { break; }
    current = dirname(current);
  }
}

function assertMoveRootsAreLocal(hostRoot: string, themeRoot: string, pluginsRoot: string): void {
  const hostReal = realpathSync(hostRoot);
  const candidates = [dirname(themeRoot), themeRoot, pluginsRoot];
  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (entry.isDirectory() || entry.isSymbolicLink()) candidates.push(join(pluginsRoot, entry.name));
    }
  }
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const label = pathFrom(hostRoot, candidate);
    const symbolic = lstatSync(candidate).isSymbolicLink();
    const resolved = realpathSync(candidate);
    const outside = resolved !== hostReal && !resolved.startsWith(`${hostReal}${sep}`);
    if (symbolic || outside) {
      const reason = symbolic ? 'is a symbolic link' : 'resolves outside the host root';
      throw new MigrateAnalysisError(`Refusing to move ${label}: it ${reason} (${resolved}). Moving it would remove files from outside ${hostReal}.`);
    }
  }
}

function validateHookExports(plan: MovePlan): void {
  for (const item of [...plan.moves, ...plan.duplicates]) {
    if (/config[\\/]hooks[\\/]proxy\./.test(item.destination)) rewriteHookExport(readFileSync(item.source, 'utf8'), item.destination);
  }
}

function writeRootFirstConfig(hostRoot: string, plugins: string[]): boolean {
  const file = join(hostRoot, 'nextspark.config.ts');
  if (existsSync(file)) return false;
  assertContained(hostRoot, file);
  writeFileSync(file, `import { defineConfig } from '@nextsparkjs/core/lib/config'\n\nexport default defineConfig({\n  plugins: ${JSON.stringify(plugins)},\n})\n`);
  return true;
}

function moveThemeEnvExample(hostRoot: string, themeRoot: string, plan: MigrateReport['envExample']): boolean {
  if (!plan.path) return false;
  const source = join(hostRoot, plan.path);
  const destination = join(hostRoot, '.env.example');
  assertContained(hostRoot, source);
  assertContained(hostRoot, destination);
  if (plan.action === 'move') {
    renameSync(source, destination);
    return true;
  }
  if (plan.action === 'deduplicate') {
    unlinkSync(source);
    return true;
  }
  return false;
}

function rewriteCoreScripts(hostRoot: string): number {
  const file = join(hostRoot, 'package.json');
  const pkg = readJson(file);
  const scripts = pkg?.scripts;
  if (!pkg || typeof scripts !== 'object' || scripts === null) return 0;
  let changed = 0;
  for (const [name, value] of Object.entries(scripts)) {
    if (typeof value !== 'string') continue;
    let next = value;
    for (const [oldPath, newPath] of Object.entries(coreScriptRenames)) {
      next = next.replaceAll(`@nextsparkjs/core/${oldPath}`, `@nextsparkjs/core/${newPath}`);
    }
    if (next !== value) {
      (scripts as Record<string, unknown>)[name] = next;
      changed++;
    }
  }
  if (changed > 0) {
    assertContained(hostRoot, file);
    const original = readFileSync(file, 'utf8');
    const indentation = original.match(/\n([ \t]+)"/)?.[1] ?? '  ';
    writeFileSync(file, `${JSON.stringify(pkg, null, indentation)}${original.endsWith('\n') ? '\n' : ''}`);
  }
  return changed;
}

/** Keep archived root-app source out of the template's broad TypeScript include. */
/**
 * With src/app in place Next loads the request-interception file from src/ only. `sync:app` used to
 * put core's template there; it is gone, so migrate writes it once when the project has none.
 */
function ensureSourceProxy(hostRoot: string, templates: string | null): string | null {
  const source = templates ? join(templates, 'proxy.ts') : null;
  if (!source || !existsSync(source)) return null;
  const existing: Partial<Record<ProxyFileName, string>> = {};
  for (const name of ['proxy.ts', 'middleware.ts'] as const) {
    const file = join(hostRoot, 'src', name);
    if (existsSync(file)) existing[name] = readFileSync(file, 'utf8');
  }
  if (Object.keys(existing).length > 0) return null;
  const plan = planProxyFile(readFileSync(source, 'utf8'), getNextMajorVersion(hostRoot), existing);
  if (plan.content === null) return null;
  assertContained(hostRoot, join(hostRoot, 'src', plan.fileName));
  mkdirSync(join(hostRoot, 'src'), { recursive: true });
  writeFileSync(join(hostRoot, 'src', plan.fileName), plan.content);
  return `src/${plan.fileName}`;
}

/** Remove only root interception files the pre-write report proved generated. */
function removeGeneratedRootProxyFiles(hostRoot: string, files: string[]): void {
  for (const file of files) {
    const source = join(hostRoot, file);
    assertContained(hostRoot, source);
    if (existsSync(source)) unlinkSync(source);
  }
}

/** A root proxy/middleware holding project code becomes the src/ one Next loads now, keeping its logic. */
function moveProjectRootProxyFiles(hostRoot: string, files: string[]): string[] {
  const moved: string[] = [];
  for (const file of files) {
    const source = join(hostRoot, file);
    const destination = join(hostRoot, 'src', file);
    assertContained(hostRoot, source);
    assertContained(hostRoot, destination);
    if (!existsSync(source)) continue;
    // the file is one directory deeper: relative references keep pointing at the same files
    const content = rewriteMovedRelativeImports(rewriteRemovedMiddlewareApi(readFileSync(source, 'utf8'), source, hostRoot), source, destination, new Map(), join(hostRoot, 'contents', 'themes'), join(hostRoot, 'contents', 'plugins'), hostRoot, new Set());
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
    unlinkSync(source);
    moved.push(file);
  }
  return moved;
}

function isOtherThemeFile(file: string, themesRoot: string, selected: string): boolean {
  if (!(file === themesRoot || file.startsWith(`${themesRoot}${sep}`))) return false;
  const rel = pathFrom(themesRoot, file);
  return rel !== '.' && rel.split('/')[0] !== selected;
}

interface RemainingContents {
  path: string;
  reason: string;
}

function remainingContents(hostRoot: string, themeRoot: string, plan: MovePlan, envPlan: MigrateReport['envExample']): RemainingContents[] {
  const root = join(hostRoot, 'contents');
  const unmoved = new Set(plan.unmoved);
  const entries: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else entries.push(file);
    }
  };
  if (existsSync(root)) visit(root);
  // installed dependencies are not project files: the package manager recreates them in the plugin's new place
  return entries.filter(file => !pathFrom(hostRoot, file).split('/').includes('node_modules')).map(file => {
    const path = pathFrom(hostRoot, file);
    if (envPlan.action === 'conflict' && envPlan.path === path) return { path, reason: 'differs from root .env.example; not merged' };
    if (file === join(themeRoot, 'package.json')) return { path, reason: 'legacy theme manifest has no root-first destination' };
    if (unmoved.has(file)) return { path, reason: 'no safe root-first destination' };
    return { path, reason: 'not moved because its destination conflicts or is reserved' };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function removeEmptyDirectories(root: string): void {
  if (!existsSync(root)) return;
  const remove = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) remove(join(directory, entry.name));
    }
    try { rmdirSync(directory); } catch { /* non-empty content is reported, not discarded */ }
  };
  remove(root);
}

/** Roots Next.js reads before src/app: while one exists, the generated src/app is ignored. */
function legacyRouteRoots(hostRoot: string): string[] {
  return ['app', 'pages'].filter(path => existsSync(join(hostRoot, path)));
}

function applyMove(repository: string, hostRoot: string, themeRoot: string, pluginsRoot: string, theme: string, plan: MovePlan, tsconfigAliases: AliasCatalog, envPlan: MigrateReport['envExample'], configPlugins: string[], rootProxyCustomizations: string[]): { moved: number; deduplicated: number; rewritten: number; envRemoved: boolean; configCreated: boolean; scriptsRenamed: number; contentsRemoved: boolean; remainingContents: RemainingContents[] } {
  const plannedItems = [...plan.moves, ...plan.duplicates];
  const planned = new Map(plannedItems.map(item => [item.source, item.destination]));
  const unmoved = new Set(plan.unmoved);
  const duplicateByDestination = new Map(plan.duplicates.map(item => [item.destination, item]));
  // AI-workflow directories are left as they are (#201); the report lists what they still reference
  const files = filesIn(repository).filter(file => !isOtherThemeFile(file, join(hostRoot, 'contents', 'themes'), theme) && !inAiWorkflowDirectory(repository, file));
  let rewritten = 0;
  for (const file of files) {
    if (plan.duplicates.some(item => item.source === file) || plan.collisions.some(item => item.source === file)) continue;
    const buffer = readFileSync(file);
    if (!isText(buffer)) continue;
    const duplicate = duplicateByDestination.get(file);
    const source = duplicate?.source ?? file;
    const destination = planned.get(file) ?? file;
    const preservedRootProxy = rootProxyCustomizations.some(path => destination === join(hostRoot, path));
    let next = rewriteLegacyPaths(buffer.toString('utf8'), source, destination, themeRoot, pluginsRoot, hostRoot, theme, planned, unmoved, tsconfigAliases);
    const tsconfig = tsconfigAliases.configs.get(file);
    if (tsconfig) next = rewriteDeadTsconfigAliases(next, tsconfig);
    if (planned.has(file) || duplicate) {
      next = rewriteMovedRelativeImports(next, source, destination, planned, themeRoot, pluginsRoot, hostRoot, unmoved);
      next = rewriteMovedStylesheetReferences(next, source, destination, planned, unmoved, themeRoot, pluginsRoot, hostRoot);
      next = rewriteMovedDepthConfig(next, source, destination, planned, unmoved, themeRoot, hostRoot);
      next = rewriteHookExport(next, destination);
    }
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteActiveThemeUse(next, destination, hostRoot, theme);
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteHookImports(next, destination, hostRoot);
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteRootFirstTestContracts(next, destination, hostRoot, theme);
    if (!preservedRootProxy && (destination === file || destination.startsWith(`${hostRoot}${sep}`))) next = rewriteRemovedMiddlewareApi(next, destination, hostRoot);
    if (next !== buffer.toString('utf8')) {
      assertContained(repository, file);
      writeFileSync(file, next);
      rewritten++;
    }
  }
  moveThemeEnvExample(hostRoot, themeRoot, envPlan);
  const envRemoved = removeActiveThemeFromExample(hostRoot);
  for (const item of plan.moves) {
    assertContained(repository, item.source);
    assertContained(repository, item.destination);
    mkdirSync(dirname(item.destination), { recursive: true });
    renameSync(item.source, item.destination);
  }
  for (const item of plan.duplicates) {
    assertContained(repository, item.source);
    unlinkSync(item.source);
  }
  removeEmptyAncestors(themeRoot, hostRoot);
  for (const plugin of childDirectories(pluginsRoot)) removeEmptyAncestors(join(pluginsRoot, plugin), hostRoot);
  removeEmptyDirectories(join(hostRoot, 'contents'));
  const configCreated = writeRootFirstConfig(hostRoot, configPlugins);
  const scriptsRenamed = rewriteCoreScripts(hostRoot);
  const leftovers = remainingContents(hostRoot, themeRoot, plan, envPlan);
  return {
    moved: plan.moves.length,
    deduplicated: plan.duplicates.length,
    rewritten,
    envRemoved,
    configCreated,
    scriptsRenamed,
    contentsRemoved: !existsSync(join(hostRoot, 'contents')),
    remainingContents: leftovers,
  };
}

/** Reject unavailable legacy theme stylesheet dependencies before migration writes. */
function preflightMovedStylesheetDependencies(hostRoot: string, themeRoot: string, pluginsRoot: string, plan: MovePlan): void {
  const plannedItems = [...plan.moves, ...plan.duplicates];
  const planned = new Map(plannedItems.map(item => [item.source, item.destination]));
  const unmoved = new Set(plan.unmoved);
  for (const item of plannedItems) {
    if (!/\.(?:css|scss|pcss)$/i.test(item.source)) continue;
    try {
      rewriteMovedStylesheetReferences(readFileSync(item.source, 'utf8'), item.source, item.destination, planned, unmoved, themeRoot, pluginsRoot, hostRoot);
    } catch (error) {
      if (error instanceof MissingThemeStylesheetDependencyError) throw error;
      if (!(error instanceof MigrateAnalysisError)) throw error;
      // Other rebase analysis errors retain their existing failure-and-rollback path.
    }
  }
}

function cleanWorkingTree(repository: string, untracked: string[]): boolean {
  return gitSucceeds(repository, ['diff', '--quiet'])
    && gitSucceeds(repository, ['diff', '--cached', '--quiet'])
    && untracked.length === 0;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const GENERATED_HOST_ROLLBACK_PATHS = [
  'src/app',
  'src/app/(templates)',
  '.nextspark/sync-state.json',
  '.nextspark/generation.json',
  '.nextspark/generation.lock',
  '.nextspark/registries',
  '.nextspark/backups',
] as const;

/** Kept until a failed migration's printed rollback has restored its originals. */
const MIGRATION_ROLLBACK_BACKUP_PATH = '.nextspark/migrate-rollback';

function migrationRollbackBackup(hostRoot: string): string {
  return join(hostRoot, MIGRATION_ROLLBACK_BACKUP_PATH);
}

/** Copy a pre-existing path without following links, so rollback can put it back byte-for-byte. */
function copyForMigrationRollback(root: string, source: string, destination: string): void {
  // The source is read without following links (a link is copied as a link); where it lives, and
  // where the copy goes, must be inside the project with no link on the way
  assertContained(root, dirname(source));
  assertContained(root, destination);
  const entry = lstatSync(source);
  if (entry.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const child of readdirSync(source, { withFileTypes: true })) {
      copyForMigrationRollback(root, join(source, child.name), join(destination, child.name));
    }
    return;
  }
  mkdirSync(dirname(destination), { recursive: true });
  if (entry.isSymbolicLink()) {
    symlinkSync(readlinkSync(source), destination);
    return;
  }
  if (entry.isFile()) {
    copyFileSync(source, destination);
    return;
  }
  throw new MigrateAnalysisError(`Refusing to back up unsupported path type: ${source}`);
}

/**
 * Every path migration or its guarded sync can overwrite or remove directly.
 * Tracked entries also come back through git checkout, but ignored entries do
 * not, so this snapshot deliberately includes both kinds.
 */
function migrationRollbackPaths(hostRoot: string, plan: MovePlan, report: MigrateReport, hadLegacyApp: boolean): string[] {
  const paths = new Set<string>([
    'package.json',
    'tsconfig.json',
    'nextspark.config.ts',
    '.gitignore',
    '.env.example',
    'app',
    ...ROOT_TEMPLATE_FILES,
    'proxy.ts',
    'middleware.ts',
    'src/proxy.ts',
    'src/middleware.ts',
    ...GENERATED_HOST_ROLLBACK_PATHS,
  ]);
  if (!hadLegacyApp) paths.delete('app');
  if (report.envExample.path && report.envExample.action !== 'none' && report.envExample.action !== 'conflict') paths.add(report.envExample.path);
  for (const item of [...plan.moves, ...plan.duplicates]) paths.add(pathFrom(hostRoot, item.source));
  return [...paths].sort();
}

function snapshotMigrationRollback(hostRoot: string, plan: MovePlan, report: MigrateReport, hadLegacyApp: boolean): void {
  const backup = migrationRollbackBackup(hostRoot);
  // A link at .nextspark or at the backup would carry the copies (and their cleanup) outside the project
  assertContained(hostRoot, join(hostRoot, '.nextspark'));
  assertContained(hostRoot, backup);
  if (existsSync(backup)) {
    throw new MigrateAnalysisError(`Refusing to overwrite migration rollback backup: ${MIGRATION_ROLLBACK_BACKUP_PATH}. Run the prior migration's printed rollback first.`);
  }
  try {
    const files = join(backup, 'files');
    for (const path of migrationRollbackPaths(hostRoot, plan, report, hadLegacyApp)) {
      const source = join(hostRoot, path);
      if (existsSync(source) || isLink(source)) copyForMigrationRollback(hostRoot, source, join(files, path));
    }
  } catch (error) {
    removeMigrationRollbackBackup(hostRoot);
    throw error;
  }
}

function isLink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function removeMigrationRollbackBackup(hostRoot: string): void {
  const backup = migrationRollbackBackup(hostRoot);
  // rm never follows a link inside the backup, but a link at .nextspark or at the backup itself is refused
  assertContained(hostRoot, backup);
  rmSync(backup, { recursive: true, force: true });
}

/**
 * Record every pre-existing entry below each generated-host target before the
 * first migration write. A rollback can then remove only entries migration
 * added below a directory the project already owned.
 */
function snapshotGeneratedHostPaths(hostRoot: string): Map<string, Set<string>> {
  const snapshot = new Map<string, Set<string>>();
  const visit = (file: string, entries: Set<string>) => {
    entries.add(pathFrom(hostRoot, file));
    if (!lstatSync(file).isDirectory()) return;
    for (const entry of readdirSync(file, { withFileTypes: true })) visit(join(file, entry.name), entries);
  };
  for (const path of GENERATED_HOST_ROLLBACK_PATHS) {
    const file = join(hostRoot, path);
    const entries = new Set<string>();
    if (existsSync(file)) visit(file, entries);
    snapshot.set(path, entries);
  }
  return snapshot;
}

/** Remove entries absent from the pre-write snapshot, while retaining user-owned directories and files. */
function cleanNewEntriesCommand(repository: string, hostRoot: string, path: string, existing: Set<string>): string | null {
  const root = join(hostRoot, path);
  if (existing.size === 0 || !lstatSync(root).isDirectory()) return null;
  const repositoryRoot = pathFrom(repository, root);
  const preserved = [...existing]
    .filter(file => file !== path)
    .map(file => `! -path ${shellQuote(pathFrom(repository, join(hostRoot, file)))}`)
    .join(' ');
  return `(cd ${shellQuote(repository)} && if [ -d ${shellQuote(repositoryRoot)} ]; then find ${shellQuote(repositoryRoot)} -depth -mindepth 1 ${preserved} -delete; fi)`;
}

/** Restore ignored or untracked originals after git has restored tracked files and cleaned new output. */
function restoreMigrationBackupCommand(repository: string, hostRoot: string): string {
  const backup = pathFrom(repository, migrationRollbackBackup(hostRoot));
  const files = `${backup}/files`;
  const destination = pathFrom(repository, hostRoot);
  return `(cd ${shellQuote(repository)} && if [ -d ${shellQuote(files)} ]; then cp -pR ${shellQuote(`${files}/.`)} ${shellQuote(destination)} && rm -rf ${shellQuote(backup)}; fi)`;
}

function rollbackCommands(repository: string, hostRoot: string, plan: MovePlan, report: MigrateReport, hadLegacyApp: boolean, generatedHostSnapshot: Map<string, Set<string> | null> | null): string[] {
  const commands = [`git -C ${shellQuote(repository)} checkout -- .`];
  // `checkout` restores tracked sources and edits.  Clean every path this
  // migration can newly create as well, including sync:app's generated state.
  const destinations = new Set(plan.moves.map(item => pathFrom(repository, item.destination)));
  // sync:app can create these integration files before it creates its state.
  // Only clean names that did not exist before migration, never user-owned files.
  for (const path of [...ROOT_TEMPLATE_FILES, 'proxy.ts', 'middleware.ts', 'src/proxy.ts', 'src/middleware.ts', 'src/app/globals.css', '.gitignore']) {
    if (!existsSync(join(hostRoot, path))) destinations.add(pathFrom(repository, join(hostRoot, path)));
  }
  if (report.config.plannedCreation) destinations.add(pathFrom(repository, join(hostRoot, 'nextspark.config.ts')));
  // Overrides and moved project files created from the app tree
  for (const file of [...report.appConversion.overrides, ...report.appConversion.projectFiles]) destinations.add(pathFrom(repository, join(hostRoot, file.destination)));
  if (report.envExample.action === 'move') destinations.add(pathFrom(repository, join(hostRoot, '.env.example')));
  // A packages/contracts this migration creates is untracked, so `checkout` leaves it behind
  if (report.contractsPackage.needed) {
    // Only what did not exist before: a directory the user already had keeps its own (even ignored) files
    if (report.contractsPackage.createsDirectory) destinations.add(report.contractsPackage.path);
    else for (const name of ['package.json', 'tsconfig.json', 'README.md']) if (!existsSync(join(repository, report.contractsPackage.path, name))) destinations.add(`${report.contractsPackage.path}/${name}`);
  }
  const selectiveCleanup: string[] = [];
  if (hadLegacyApp) {
    for (const path of GENERATED_HOST_ROLLBACK_PATHS) {
      const existing = generatedHostSnapshot?.get(path) ?? null;
      if (!existing || existing.size === 0) {
        destinations.add(pathFrom(repository, join(hostRoot, path)));
        continue;
      }
      const cleanup = cleanNewEntriesCommand(repository, hostRoot, path, existing);
      if (cleanup) selectiveCleanup.push(cleanup);
    }
  }
  const created = [...destinations].sort();
  if (created.length > 0) {
    commands.push(`git -C ${shellQuote(repository)} clean -fdx -- ${created.map(shellQuote).join(' ')}${selectiveCleanup.length > 0 ? ` && ${selectiveCleanup.join(' && ')}` : ''} && ${restoreMigrationBackupCommand(repository, hostRoot)}`);
  } else if (selectiveCleanup.length > 0) {
    commands.push(`git -C ${shellQuote(repository)} rev-parse --is-inside-work-tree >/dev/null && ${selectiveCleanup.join(' && ')} && ${restoreMigrationBackupCommand(repository, hostRoot)}`);
  } else {
    commands.push(`git -C ${shellQuote(repository)} rev-parse --is-inside-work-tree >/dev/null && ${restoreMigrationBackupCommand(repository, hostRoot)}`);
  }
  return commands;
}

function printRollback(rollback: string[]): void {
  section('Rollback after migration failure', [
    'Run these commands from any directory to restore the pre-migration tree. They restore the snapshot taken when migrate started (git checkout plus .nextspark/migrate-rollback), so run them right away, before editing or committing anything else: files you changed since come back as the older copies.',
    ...rollback,
  ]);
}

interface BrokenImport {
  file: string;
  source: string;
  line: number;
  target: string;
}

const importTargetSuffixes = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '/index.ts', '/index.tsx', '/index.js', '/index.jsx', '/index.mjs', '/index.cjs'];
const importExpression = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire(?:\.resolve)?\s*\(\s*|\bimport\s*)(['"])([^'"`]+)\1|@import\s+(?:url\(\s*)?(['"])([^'"]+)\3\s*\)?/g;

function importReferences(content: string): { line: number; target: string }[] {
  const view = sourceView(content);
  const imports: { line: number; target: string }[] = [];
  for (const match of content.matchAll(importExpression)) {
    const syntax = view.code.slice(match.index ?? 0, (match.index ?? 0) + match[0].length);
    if (!/\b(?:from|import|require)\b|@import/.test(syntax)) continue;
    const target = match[2] ?? match[4];
    if (target) imports.push({ line: content.slice(0, match.index ?? 0).split(/\r?\n/).length, target });
  }
  return imports;
}

function importTargetExists(target: string): boolean {
  return importTargetSuffixes.some(suffix => {
    const candidate = `${target}${suffix}`;
    return existsSync(candidate) && statSync(candidate).isFile();
  });
}

function aliasImportTarget(target: string, file: string, catalog: AliasCatalog): string | null {
  return aliasResolution(target, configForFile(file, catalog)?.aliases ?? [])?.target ?? null;
}

function resolvedImportTarget(target: string, file: string, hostRoot: string, catalog: AliasCatalog, preferCanonical = false): string | null {
  if (target.startsWith('.')) return resolve(dirname(file), target);
  const canonical = target.startsWith('@/') ? join(hostRoot, target.slice(2)) : null;
  // @/contents/... is the explicit legacy spelling handled independently of a
  // broad @/* catch-all alias.
  if (target.startsWith('@/contents/')) return canonical;
  if (preferCanonical && canonical && importTargetExists(canonical)) return canonical;
  return aliasImportTarget(target, file, catalog) ?? canonical;
}

interface ImportScanFile {
  file: string;
  source: string;
  display: string;
}

/** Scan local module references using the tsconfig that applies at this phase. */
function brokenImports(hostRoot: string, files: ImportScanFile[], catalog: AliasCatalog): BrokenImport[] {
  const broken: BrokenImport[] = [];
  for (const entry of files) {
    if (!existsSync(entry.file)) continue;
    const content = readFileSync(entry.file, 'utf8');
    for (const reference of importReferences(content)) {
      const target = reference.target;
      const aliasTarget = aliasImportTarget(target, entry.file, catalog);
      if (!target || (!target.startsWith('.') && !target.startsWith('@/') && !aliasTarget)) continue;
      const resolved = resolvedImportTarget(target, entry.file, hostRoot, catalog, true);
      // Registries are generated after sync:app/registry:build. They are a
      // valid target even before this migration's post-move scan sees files.
      if (resolved && isWithin(resolved, join(hostRoot, '.nextspark'))) continue;
      if (!resolved || importTargetExists(resolved)) continue;
      broken.push({ file: entry.display, source: entry.source, line: reference.line, target });
    }
  }
  return broken.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.target.localeCompare(right.target));
}

function printBrokenImports(introduced: BrokenImport[], preExisting: BrokenImport[]): void {
  if (introduced.length > 0) {
    console.log('');
    console.log('MIGRATION FAILED: migration introduced broken imports.');
    for (const item of introduced) console.log(`  ${item.file}:${item.line} → ${item.target}`);
    if (preExisting.length > 0) {
      console.log('Pre-existing broken imports (not caused by this migration):');
      for (const item of preExisting) console.log(`  ${item.file}:${item.line} → ${item.target}`);
    }
    console.log('  Rollback commands were printed in the move plan above.');
    return;
  }
  if (preExisting.length > 0) {
    console.log('');
    console.log('WARNING: migration completed; these imports were already broken before migration (exit 0):');
    for (const item of preExisting) console.log(`  ${item.file}:${item.line} → ${item.target}`);
  }
}

function legacyContentsImportCount(plan: MovePlan): number {
  return [...new Set([...plan.moves, ...plan.duplicates].map(item => item.destination))]
    .filter(file => existsSync(file) && !isEnvironmentFile(basename(file)))
    .flatMap(file => importReferences(readFileSync(file, 'utf8')))
    .filter(reference => reference.target.includes('contents/')).length;
}

function printMoveSummary(plan: MovePlan, result: { moved: number; deduplicated: number; rewritten: number; envRemoved: boolean; configCreated: boolean; scriptsRenamed: number; contentsRemoved: boolean; remainingContents: RemainingContents[] }, report: MigrateReport, hostRoot: string, remainingContentsImports: number): void {
  console.log('');
  console.log('Migration complete.');
  console.log(`  moved: ${result.moved} owned file(s); verified and deduplicated: ${result.deduplicated}`);
  console.log(`  rewritten: ${result.rewritten} file(s)${result.envRemoved ? '; removed NEXT_PUBLIC_ACTIVE_THEME from .env.example' : ''}`);
  console.log(`  nextspark.config.ts: ${result.configCreated ? 'created' : 'preserved'}; core scripts renamed: ${result.scriptsRenamed}`);
  console.log(`  legacy contents/ imports in moved output: ${remainingContentsImports}`);
  console.log(`  contents/: ${result.contentsRemoved ? 'removed' : result.remainingContents.map(item => `${item.path} (${item.reason})`).join('; ') || 'still exists (no ordinary entries could be enumerated)'}`);
  console.log('  post-migration route-root guard: passed (no root app/ or pages/ beside src/app)');
  console.log(`  reserved source left in place: ${paths(plan.reserved.map(item => item.path))}`);
  console.log(`  other themes left untouched: ${report.activeTheme.themes.filter(item => item.name !== report.activeTheme.name).map(item => item.name).join(', ') || 'none'}`);
  console.log('  Rollback commands were printed in the move plan above.');
}

/** Add `.nextspark/`, `src/app/` and `next-env.d.ts` (Next rewrites it on every build) to the project's .gitignore: all are generated. */
function ignoreGeneratedPaths(hostRoot: string): boolean {
  const file = join(hostRoot, '.gitignore');
  assertContained(hostRoot, file);
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const lines = new Set(current.split(/\r?\n/).map(line => line.trim()));
  const missing = ['.nextspark/', 'src/app/', 'next-env.d.ts'].filter(entry => !lines.has(entry) && !lines.has(entry.replace(/\/$/, '')) && !lines.has(`/${entry}`));
  if (missing.length === 0) return false;
  writeFileSync(file, `${current}${current === '' || current.endsWith('\n') ? '' : '\n'}\n# Generated by NextSpark (nextspark dev, build and prepare write all of it; never edit)\n${missing.join('\n')}\n`);
  return true;
}

/** Which of src/app's files git tracks: they stay in the index until the project removes them from it. */
function trackedGeneratedFiles(repository: string, hostRoot: string): number {
  try {
    const output = execFileSync('git', ['ls-files', '-z', '--', pathFrom(repository, join(hostRoot, 'src', 'app'))], { cwd: repository, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return output.split('\0').filter(Boolean).length;
  } catch {
    return 0;
  }
}

/**
 * What the generated host says about the converted layout, without touching the project: convert a
 * temporary copy (git files only; node_modules linked, not copied) with `migrate --yes`, which ends by
 * running the host plan, and read its diagnostics. The current host plan API is the only contract:
 * `nextspark prepare` inside the copy. The Next.js version check is reported on its own (nextRange).
 */
function lstatExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Env files hold secrets and are never copied; the .example/.sample/.template ones are placeholders migrate itself reads. */
function copiesToSimulation(file: string): boolean {
  const name = basename(file);
  return !isEnvironmentFile(name) || /\.(?:example|sample|template)$/.test(name);
}

/** What a child that failed says, for the report: its first `Error` line, never Node's version banner. */
function firstErrorLine(output: string): string | null {
  const lines = output.split('\n').map(line => line.trim()).filter(line => line !== '' && !/^Node\.js v\d/.test(line));
  return lines.find(line => /(?:^|\s)(?:[A-Z][A-Za-z]*)?Error\b/.test(line)) ?? lines.find(line => line.startsWith('nextspark migrate:')) ?? lines[lines.length - 1] ?? null;
}

// Windows has no HOME/TMPDIR: its shell, profile and temp locations travel under these names (env names are case-insensitive there)
const SIMULATION_ENV = /^(?:PATH|HOME|TMPDIR|NODE_OPTIONS|SystemRoot|USERPROFILE|APPDATA|LOCALAPPDATA|PATHEXT|ComSpec|TEMP|TMP)$/i;

/** The simulation's children get only what they need: PATH, HOME, TMPDIR, NODE_OPTIONS, COREPACK_*, on Windows SystemRoot/USERPROFILE/APPDATA/LOCALAPPDATA/PATHEXT/ComSpec/TEMP/TMP, the package-manager settings, NEXTSPARK_* and the active theme migrate resolved (which may come from the environment, not from .env.example). */
export function simulationEnvironment(theme: string | null): NodeJS.ProcessEnv {
  const kept: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (SIMULATION_ENV.test(name) || /^(?:npm_config_|NPM_CONFIG_|pnpm_config_|PNPM_CONFIG_|COREPACK_|NEXTSPARK_)/.test(name)) kept[name] = value;
  }
  return { ...kept, ...(theme ? { NEXT_PUBLIC_ACTIVE_THEME: theme } : {}), NEXTSPARK_MIGRATE_SIMULATION: '1', NEXTSPARK_AUTH_PREFLIGHT: 'off' };
}

interface SimulationChild {
  code: number | null;
  output: string;
}

function runAndCollect(command: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number }, track: (child: ChildProcess | null) => void): Promise<SimulationChild> {
  return new Promise(resolvePromise => {
    // its own process group, so a signal to the simulation reaches everything the migration started
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    track(child);
    let output = '';
    // whole characters, however a chunk splits a multi-byte name
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = options.timeoutMs ? setTimeout(() => { try { process.kill(-(child.pid as number), 'SIGKILL'); } catch { child.kill('SIGKILL'); } }, options.timeoutMs) : null;
    child.on('error', error => { if (timer) clearTimeout(timer); track(null); resolvePromise({ code: 1, output: `${output}\n${error.message}` }); });
    child.on('close', code => { if (timer) clearTimeout(timer); track(null); resolvePromise({ code, output }); });
  });
}

/**
 * What the generated host says about the converted layout, without touching the project: clone the
 * repository (hardlinked objects, no file hashing) into a temporary directory, lay the uncommitted state
 * over it, convert it with `migrate --yes`, which ends by running the host plan, and read its diagnostics.
 * The current host plan API is the only contract: `nextspark prepare` inside the copy. The Next.js version
 * check is reported on its own (nextRange). The copy is removed however the run ends, Ctrl-C included.
 */
async function simulateHostPlan(repository: string, report: MigrateReport, coreDirectory: string | null, simulate: boolean | undefined): Promise<void> {
  if (simulate === false || process.env.NEXTSPARK_MIGRATE_NO_SIMULATION === '1' || process.env.NEXTSPARK_MIGRATE_SIMULATION === '1') {
    report.hostPlan.reason = 'not simulated (--no-simulate, or disabled by the environment)';
    return;
  }
  if (!coreDirectory || (await coreHostMode(coreDirectory, resolve(repository, report.hostRoot.path))).mode === 'no-manifest') {
    report.hostPlan.reason = 'not simulated: the installed @nextsparkjs/core cannot generate the host';
    return;
  }
  process.stderr.write('Simulating the generated host on a converted copy of the project (--no-simulate skips this)...\n');
  const copy = mkdtempSync(join(tmpdir(), 'nextspark-migrate-plan-'));
  let running: ChildProcess | null = null;
  const track = (child: ChildProcess | null) => { running = child; };
  const cleanUp = () => {
    const child = running as ChildProcess | null;
    if (child?.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }
    rmSync(copy, { recursive: true, force: true });
  };
  const onSignal = (signal: NodeJS.Signals) => {
    cleanUp();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    const git = (args: string[], cwd = copy) => runAndCollect('git', ['-c', 'user.email=plan@nextspark.local', '-c', 'user.name=plan', ...args], { cwd }, track);
    // No checkout at first: tracked env files must never land on disk, so only the other paths are checked out
    const cloned = await git(['clone', '--quiet', '--local', '--no-checkout', repository, copy], repository);
    if (cloned.code !== 0) throw new Error(`could not clone the repository: ${cloned.output.trim().split('\n')[0]}`);
    const tracked = (await git(['ls-tree', '-r', '-z', '--name-only', 'HEAD'])).output.split('\0').filter(Boolean).filter(copiesToSimulation);
    const pathspec = join(tmpdir(), `nextspark-migrate-pathspec-${process.pid}`);
    writeFileSync(pathspec, tracked.join('\0'));
    try {
      const checkedOut = await git(['--literal-pathspecs', 'checkout', 'HEAD', `--pathspec-from-file=${pathspec}`, '--pathspec-file-nul']);
      if (checkedOut.code !== 0) throw new Error(`could not check out the copy: ${checkedOut.output.trim().split('\n')[0]}`);
    } finally {
      rmSync(pathspec, { force: true });
    }
    // The working state (a dry run does not need a clean tree), staged or not: what differs from HEAD, plus new files
    const listed = (args: string[]) => execFileSync('git', args, { cwd: repository, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\0').filter(Boolean);
    const changes = listed(['diff', '--name-status', '--no-renames', '-z', 'HEAD']);
    const touched: string[] = [];
    for (let index = 0; index + 1 < changes.length; index += 2) touched.push(changes[index + 1]);
    for (const file of [...touched, ...listed(['ls-files', '-z', '--others', '--exclude-standard'])].filter(copiesToSimulation)) {
      const source = join(repository, file);
      // a directory (a submodule's gitlink) is not a file to copy, and its empty folder in the copy stays
      if (lstatExists(source) && !lstatSync(source).isSymbolicLink() && lstatSync(source).isDirectory()) continue;
      rmSync(join(copy, file), { force: true });
      if (!lstatExists(source)) continue;
      mkdirSync(dirname(join(copy, file)), { recursive: true });
      if (lstatSync(source).isSymbolicLink()) symlinkSync(readlinkSync(source), join(copy, file));
      else copyFileSync(source, join(copy, file));
    }
    for (const manifest of packageFiles(repository)) {
      const modules = join(dirname(manifest), 'node_modules');
      const link = join(copy, pathFrom(repository, modules));
      // a project that tracks its node_modules already has them in the copy
      if (existsSync(modules) && !lstatExists(link)) symlinkSync(modules, link);
    }
    await git(['add', '-A']);
    await git(['commit', '--quiet', '--no-verify', '--allow-empty', '-m', 'plan']);
    const hostCopy = join(copy, report.hostRoot.path === '.' ? '' : report.hostRoot.path);
    const copiedTemplates = templateDirectory(hostCopy, copy);
    const prepareModule = copiedTemplates ? join(dirname(copiedTemplates), 'scripts', 'build', 'registry', 'host', 'prepare.mjs') : null;
    // The core the project uses decides: one that exports predictHost answers without running the registry build
    const hasPredict = prepareModule !== null && existsSync(prepareModule) && /export\s+(?:async\s+)?function\s+predictHost\b/.test(readFileSync(prepareModule, 'utf8'));
    const simulationEnv = simulationEnvironment(report.activeTheme.name);
    const nonce = randomBytes(16).toString('hex');
    writeFileSync(join(copy, '.git', SIMULATION_MARKER), nonce);
    const migrated = await runAndCollect(process.execPath, [process.argv[1], 'migrate', '--yes', '--simulation-nonce', nonce, ...(hasPredict ? ['--no-prepare'] : [])], {
      cwd: join(copy, pathFrom(repository, process.cwd())),
      env: simulationEnv,
      timeoutMs: 600_000,
    }, track);
    const lines = migrated.output.split('\n').map(line => line.trim()).filter(Boolean);
    if (hasPredict && migrated.code === 0) {
      report.hostPlan.method = 'predictHost';
      const script = "const mod = await import(process.argv[1]); try { const config = mod.projectHostConfig({ projectRoot: process.cwd() }); const result = await mod.predictHost(config); console.log('__NEXTSPARK_PREDICT__' + JSON.stringify({ ok: result.ok, routes: result.routes.length, notices: result.notices, diagnostics: result.diagnostics, checks: result.checks })) } catch (error) { console.log('__NEXTSPARK_PREDICT_ERROR__' + JSON.stringify({ message: String(error && error.message || error).split('\\n')[0], diagnostics: Array.isArray(error && error.diagnostics) ? error.diagnostics : [] })) }";
      const predicted = await runAndCollect(process.execPath, ['--input-type=module', '-e', script, pathToFileURL(prepareModule as string).href], { cwd: hostCopy, env: simulationEnv, timeoutMs: 600_000 }, track);
      const marker = predicted.output.split('\n').find(line => line.startsWith('__NEXTSPARK_PREDICT__'));
      if (!marker) {
        report.hostPlan.unknown = true;
        // L4: the diagnostics the prediction stopped on (codes and messages), never a source line of the stack
        const failure = predicted.output.split('\n').find(line => line.startsWith('__NEXTSPARK_PREDICT_ERROR__'));
        const stopped = failure ? JSON.parse(failure.slice('__NEXTSPARK_PREDICT_ERROR__'.length)) as { message: string; diagnostics: { code?: string; message?: string; file?: string }[] } : null;
        report.hostPlan.reason = stopped
          ? `predictHost did not answer: ${stopped.diagnostics.length > 0 ? stopped.diagnostics.map(entry => `${entry.code ?? 'NS_HOST'}: ${entry.message ?? ''}${entry.file ? ` (${entry.file})` : ''}`.trim()).join('; ') : stopped.message}`
          : `predictHost did not answer (exit ${predicted.code}${predicted.output.trim() ? `: ${predicted.output.trim().split('\n').filter(line => !/^\s+at |^Node\.js v/.test(line)).slice(-1)[0]}` : ''})`;
        return;
      }
      const result = JSON.parse(marker.slice('__NEXTSPARK_PREDICT__'.length)) as { notices: { code?: string; message?: string }[]; diagnostics: { code?: string; message?: string; file?: string }[]; checks: Record<string, string> };
      const describe = (entry: { code?: string; message?: string; file?: string }) => `${entry.code ?? 'NS_HOST'}: ${entry.message ?? ''}${entry.file ? ` (${entry.file})` : ''}`.trim();
      report.hostPlan.conflicts = result.diagnostics.filter(entry => entry.code !== 'NS_HOST_UNSUPPORTED_NEXT_VERSION').map(describe);
      report.hostPlan.notices = result.notices.map(describe);
      report.hostPlan.checks = result.checks;
      // The Next.js range section owns the version diagnostic; without this the checks would say "emission failed" for no visible reason
      const unsupported = result.diagnostics.find(entry => entry.code === 'NS_HOST_UNSUPPORTED_NEXT_VERSION');
      if (unsupported && result.checks.emission === 'failed') {
        const installed = /resolves next@(\S+)/.exec(unsupported.message ?? '')?.[1];
        // Only the diagnostic that names the installed version gets the short form; any other reason (not resolvable, no schema) is shown as the diagnostic gives it
        result.checks.emission = `not checked (${installed ? `installed next ${installed} is not ${report.nextRange.required}` : (unsupported.message ?? 'the installed next is not supported').split('\n')[0]}; see Next.js range)`;
        for (const step of ['grammar', 'ownership']) if (result.checks[step] === 'skipped') result.checks[step] = 'skipped (needs emission)';
      }
      report.hostPlan.simulated = true;
      return;
    }
    report.hostPlan.method = hasPredict ? null : 'prepare';
    report.hostPlan.conflicts = lines.filter(line => /NS_HOST_/.test(line) && !/NS_HOST_UNSUPPORTED_NEXT_VERSION/.test(line));
    if (migrated.code !== 0 && report.hostPlan.conflicts.length === 0) {
      // No answer from the host plan: not a clean plan
      report.hostPlan.unknown = true;
      report.hostPlan.reason = `the simulation stopped before the host plan: ${firstErrorLine(migrated.output) ?? `exit ${migrated.code}`}`;
    } else report.hostPlan.simulated = true;
  } catch (error) {
    report.hostPlan.unknown = true;
    report.hostPlan.reason = `not simulated: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`;
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    cleanUp();
  }
}

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  let rollback: string[] | null = null;
  let writesStarted = false;
  let printRollbackOnFailure = false;
  try {
    const { report, plan: appPlan } = await analyze(process.cwd());
    if (options.dryRun) {
      if (appPlan && report.appConversion.unsimulable.length > 0) {
        report.hostPlan.reason = `not simulated: ${report.appConversion.unsimulable.length} blocker(s) make it impossible to convert a copy (symbolic links or files that collide): fix ${report.appConversion.unsimulable.map(line => line.split(': ')[0]).join(', ')} and run the dry run again to see the host conflicts`;
      } else if (appPlan) {
        const templates = templateDirectory(resolve(repositoryRoot(process.cwd()), report.hostRoot.path), repositoryRoot(process.cwd()));
        await simulateHostPlan(repositoryRoot(process.cwd()), report, templates ? dirname(templates) : null, options.simulate);
      }
      report.hostPlan.partial = report.hostPlan.simulated && report.appConversion.blockers.length > 0;
      if (!report.hostPlan.simulated) report.hostPlan.leftOut = [];
      if (options.json) {
        const json = JSON.stringify(report).replace(/[\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
        process.stdout.write(`${json}\n`);
      } else printReport(report);
      // A dry run is a report; it exits 1 only when the migration would refuse to run
      if (report.appConversion.blockers.length > 0 || report.hostPlan.conflicts.length > 0) process.exitCode = 1;
      return;
    }
    if (options.json) throw new MigrateAnalysisError('--json is available only with --dry-run.');
    printReport(report);
    // The simulation converts a copy in spite of the blockers, to report the host conflicts in the same pass
    const simulation = simulationVerified(repositoryRoot(process.cwd()), options.simulationNonce);
    if (report.appConversion.blockers.length > 0 && !simulation) {
      throw new MigrateAnalysisError(`Refusing to migrate: ${report.appConversion.blockers.length} blocker(s) (app files that cannot be placed with certainty, or files that collide). Nothing was written. Fix them as described above, then rerun nextspark migrate.\n${report.appConversion.blockers.map(line => `  - ${line}`).join('\n')}`);
    }
    const repository = repositoryRoot(process.cwd());
    if (!cleanWorkingTree(repository, report.untracked)) throw new MigrateAnalysisError('Refusing to move files on a dirty git tree. Commit, stash, or remove untracked files first.');
    const theme = report.activeTheme.name;
    const hostRoot = resolve(repository, report.hostRoot.path);
    // A project that is root-first already (no contents/) only has an app tree left to convert
    const appTreeOnly = !existsSync(join(hostRoot, 'contents')) && appPlan !== null;
    if (!theme && !appTreeOnly) throw new MigrateAnalysisError('No active theme was found; set it in .env.example before migrating.');
    const themeRoot = join(hostRoot, 'contents', 'themes', theme ?? '');
    if (!appTreeOnly && !existsSync(themeRoot)) throw new MigrateAnalysisError(`Active theme ${theme} was not found under contents/themes/.`);
    const pluginsRoot = join(hostRoot, 'contents', 'plugins');
    if (!appTreeOnly) assertMoveRootsAreLocal(hostRoot, themeRoot, pluginsRoot);
    const plan: MovePlan = appTreeOnly ? { moves: [], duplicates: [], collisions: [], renamed: [], reserved: [], unmoved: [] } : planMove(hostRoot, themeRoot, pluginsRoot);
    validateHookExports(plan);
    assertPhysicalRoot(repository, hostRoot);
    // Every path the move will read, write or remove is inside the project with no link on the way, before anything is written
    for (const item of [...plan.moves, ...plan.duplicates]) {
      assertContained(repository, item.source);
      assertContained(repository, item.destination);
    }
    const hadLegacyApp = appPlan !== null;
    if (existsSync(migrationRollbackBackup(hostRoot))) {
      throw new MigrateAnalysisError(`Refusing to overwrite migration rollback backup: ${MIGRATION_ROLLBACK_BACKUP_PATH}. Run the prior migration's printed rollback first.`);
    }
    const generatedHostSnapshot = hadLegacyApp ? snapshotGeneratedHostPaths(hostRoot) : null;
    rollback = rollbackCommands(repository, hostRoot, plan, report, hadLegacyApp, generatedHostSnapshot);
    section('Move plan', [
      `owned files to move: ${plan.moves.length}; byte-identical duplicates verified: ${plan.duplicates.length}`,
      `reserved source left in place: ${paths(plan.reserved.map(item => item.path))}`,
      `host collisions: ${paths(plan.collisions.map(item => pathFrom(hostRoot, item.source)) )}`,
      `theme documents renamed (the project has a different file at their name): ${paths(plan.renamed.map(item => `${item.from} -> ${item.to}`))}`,
      `Rollback repository root: ${repository}`,
      ...rollback,
    ]);
    if (plan.collisions.length > 0) {
      throw new MigrateAnalysisError(`Refusing to overwrite different host files: ${paths(plan.collisions.map(item => pathFrom(hostRoot, item.destination)))}`);
    }
    if (!options.yes) {
      if (!process.stdin.isTTY) throw new MigrateAnalysisError('Review the report above, then rerun with --yes to perform this move.');
      process.stdout.write('Perform this move? [y/N] ');
      const answer = readFileSync(0, 'utf8').trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') throw new MigrateAnalysisError('Migration cancelled.');
    }
    const templates = templateDirectory(hostRoot, repository);
    const coreDirectory = templates ? dirname(templates) : null;
    const aliasesBeforeMove = appTreeOnly ? null : legacyPathAliases(hostRoot, themeRoot, pluginsRoot, plan);
    if (aliasesBeforeMove && aliasesBeforeMove.warnings.length > 0) {
      section('Alias configuration warnings', aliasesBeforeMove.warnings.map(file => `could not parse or resolve ${file}; aliases from it were not derived`));
    }
    const legacyHook = [...plan.moves, ...plan.duplicates].find(item => /config[\\/]hooks[\\/]proxy\.[^.]+$/.test(item.destination));
    if (legacyHook && aliasesBeforeMove) validateLegacyHookImportShapes(hostRoot, legacyHook.source, aliasesBeforeMove);
    const plannedItems = [...plan.moves, ...plan.duplicates];
    // Environment-shaped files are moved as opaque bytes, never parsed as
    // source or inspected by the import validator.
    const sourceFiles = plannedItems.filter(item => !isEnvironmentFile(basename(item.source)));
    const beforeFiles = sourceFiles.map(item => ({ file: item.source, source: item.source, display: pathFrom(hostRoot, item.destination) }));
    const brokenBeforeMove = aliasesBeforeMove ? brokenImports(hostRoot, beforeFiles, aliasesBeforeMove) : [];
    if (!appTreeOnly) preflightMovedStylesheetDependencies(hostRoot, themeRoot, pluginsRoot, plan);
    snapshotMigrationRollback(hostRoot, plan, report, hadLegacyApp);
    writesStarted = true;
    // L8: before the move, so a plugin's manifest is edited where it still is and moves with the change
    for (const member of report.memberPeers.filter(entry => entry.updates.length > 0)) {
      const manifest = join(repository, member.path);
      assertContained(repository, manifest);
      writeFileSync(manifest, updatePeerRanges(readFileSync(manifest, 'utf8'), member.updates));
      console.log(`  ${member.path}: peer ranges set to ${member.updates.map(update => `${update.name} ${update.to}`).join(', ')}.`);
    }
    const result = appTreeOnly
      ? null
      : applyMove(repository, hostRoot, themeRoot, pluginsRoot, theme as string, plan, aliasesBeforeMove as AliasCatalog, report.envExample, report.config.plugins, hadLegacyApp ? report.rootProxyFiles.customizations : []);
    let nextUpdated = false;
    {
      const thumbnails = filesIn(hostRoot).filter(file => isBlockConfig(file) && !inAiWorkflowDirectory(repository, file) && countBlockThumbnails(readFileSync(file, 'utf8')) > 0);
      for (const file of thumbnails) {
        assertContained(repository, file);
        writeFileSync(file, removeBlockThumbnails(readFileSync(file, 'utf8')));
      }
      if (thumbnails.length > 0) console.log(`  Block configs: removed the old thumbnail line from ${thumbnails.length} file(s).`);
      const nextConfig = nextConfigFiles(hostRoot)[0];
      if (report.compatRewrites.entries.length > 0 && nextConfig) {
        const edit = addCompatRewrites(readFileSync(nextConfig, 'utf8'), basename(nextConfig), report.compatRewrites.entries);
        if ('error' in edit) throw new MigrateAnalysisError(`${edit.error}. Merge these rewrites by hand:\n${edit.snippet}`);
        assertContained(repository, nextConfig);
        writeFileSync(nextConfig, edit.source);
        console.log(`  ${pathFrom(repository, nextConfig)}: rewrites ${report.compatRewrites.entries.map(entry => entry.source).join(', ')} added for already-installed clients (${report.compatRewrites.note})`);
      }
      const hostPackageFile = join(hostRoot, 'package.json');
      if (!simulation && report.nextRange.members.some(member => member.action === 'update')) {
        writeFileSync(hostPackageFile, updateNextRange(readFileSync(hostPackageFile, 'utf8'), report.nextRange));
        nextUpdated = true;
        console.log(`  ${pathFrom(repository, hostPackageFile)}: next and eslint-config-next set to ${report.nextRange.required}. Run your package manager's install, then nextspark prepare.`);
      }
      const frameworkFixes = report.hostFramework.filter(fix => !fix.manual);
      if (!simulation && frameworkFixes.length > 0) {
        writeFileSync(hostPackageFile, updateHostFramework(readFileSync(hostPackageFile, 'utf8'), frameworkFixes));
        console.log(`  ${pathFrom(repository, hostPackageFile)}: ${frameworkFixes.map(fix => `${fix.name} ${fix.to}`).join(', ')} (the range now accepts the version the members resolve). Run your package manager's install.`);
      }
      if (report.contractsPackage.needed) {
        const manifests = packageFiles(repository).map(file => ({ file, pkg: readJson(file) })).filter((entry): entry is { file: string; pkg: Record<string, unknown> } => entry.pkg !== null);
        const created = planContractsPackage(repository, hostRoot, manifests).plan;
        if (created) for (const line of await applyContractsPackage(repository, created)) console.log(`  Contracts: ${line}.`);
      }
    }
    if (appPlan) {
      const converted = applyAppConversion(hostRoot, appPlan);
      console.log(`  App tree: removed ${converted.removed} generated file(s); converted ${converted.overrides} customized core file(s) into overrides and moved ${converted.moved - converted.overrides} project file(s).`);
      if (appPlan.webhookExtensions.length > 0) {
        const configFile = join(hostRoot, 'nextspark.config.ts');
        const declared = declareWebhookExtensions(readFileSync(configFile, 'utf8'), appPlan.webhookExtensions);
        if ('error' in declared) throw new MigrateAnalysisError(declared.error);
        assertContained(hostRoot, configFile);
        writeFileSync(configFile, declared.source);
        console.log(`  nextspark.config.ts: billing.webhookExtensions declared for ${appPlan.webhookExtensions.map(item => item.provider).join(', ')}.`);
      }
      if (ignoreGeneratedPaths(hostRoot)) console.log('  .gitignore: added .nextspark/, src/app/ and next-env.d.ts (generated).');
      removeGeneratedRootProxyFiles(hostRoot, report.rootProxyFiles.generated);
      for (const moved of moveProjectRootProxyFiles(hostRoot, report.rootProxyFiles.customizations)) console.log(`  ${moved}: the project's root proxy moved to src/ (Next loads it from there next to src/app), core middleware APIs renamed. It replaces core's current proxy template: compare it with node_modules/@nextsparkjs/core/templates/proxy.ts.`);
      const proxy = ensureSourceProxy(hostRoot, templates);
      if (proxy) console.log(`  ${proxy}: written from core's template (Next loads the request proxy from src/ next to src/app).`);
      const routeRoots = legacyRouteRoots(hostRoot);
      if (routeRoots.length > 0) {
        throw new MigrateAnalysisError(`Post-migration route-root check failed: ${routeRoots.join(', ')} remains next to src/app. Remove it before Next.js can use src/app.`);
      }
      if (options.prepare === false || nextUpdated) {
        console.log(nextUpdated
          ? '  Skipped generating src/app: the installed next is not the one just set in package.json. Install, then run "nextspark prepare".'
          : '  Skipped generating src/app (--no-prepare). Run "nextspark prepare" to generate it.');
      } else if (coreDirectory && (await coreHostMode(coreDirectory, hostRoot)).mode === 'host') {
        const generation = await runHostPreparation(coreDirectory, hostRoot, {});
        if (generation.code !== 0) {
          console.error('MIGRATION FAILED: nextspark prepare did not generate the new src/app from the converted project.');
          for (const line of generation.failureLines) console.error(`  ${line}`);
          throw new MigrateAnalysisError('The project was converted but its generated host could not be built; roll back with the commands printed below, fix the reported route, and rerun.');
        }
        console.log('  src/app and the registries generated by nextspark prepare.');
      } else {
        console.log('  Run "nextspark prepare" to generate src/app.');
      }
      const tracked = trackedGeneratedFiles(repository, hostRoot);
      if (tracked > 0) console.log(`  Git still tracks ${tracked} file(s) under src/app: remove them from the index with  git rm -r -q --cached ${pathFrom(repository, join(hostRoot, 'src', 'app'))}  and commit.`);
      const nextEnv = pathFrom(repository, join(hostRoot, 'next-env.d.ts'));
      if (gitSucceeds(repository, ['ls-files', '--error-unmatch', '--', nextEnv])) console.log(`  Git tracks ${nextEnv}, which Next rewrites on every build: remove it from the index with  git rm -q --cached ${nextEnv}  and commit.`);
    }
    const aliasesAfterMove = appTreeOnly ? null : legacyPathAliases(hostRoot, themeRoot, pluginsRoot, plan);
    if (aliasesAfterMove && result) {
      const afterFiles = sourceFiles.map(item => ({ file: item.destination, source: item.source, display: pathFrom(hostRoot, item.destination) }));
      const brokenAfterMove = brokenImports(hostRoot, afterFiles, aliasesAfterMove);
      const brokenBeforeKeys = new Set(brokenBeforeMove.map(item => `${item.source}:${item.line}`));
      const preExisting = brokenAfterMove.filter(item => brokenBeforeKeys.has(`${item.source}:${item.line}`));
      const introduced = brokenAfterMove.filter(item => !brokenBeforeKeys.has(`${item.source}:${item.line}`));
      if (introduced.length > 0) {
        printBrokenImports(introduced, preExisting);
        throw new MigrateAnalysisError('Migration introduced broken imports.');
      }
      printMoveSummary(plan, result, report, hostRoot, legacyContentsImportCount(plan));
      if (preExisting.length > 0) printBrokenImports([], preExisting);
    }
    if (report.duplicateCopies.length > 0 || report.memberPeers.length > 0) {
      section('next / react / react-dom copies', [
        ...report.duplicateCopies.map(copy => `${copy.member} has its own ${copy.name}@${copy.version} next to the host's ${copy.host}`),
        ...report.hostFramework.filter(fix => fix.manual).map(fix => hostFrameworkLine(fix, report.hostRoot.path)),
        'After you install, run  pnpm why next react react-dom : each must resolve to one version. A workspace member whose peer range the host does not satisfy gets its own copy, and two copies of Next or React break types and context.',
      ]);
    }
    if (report.apiUrlMoves.length > 0) {
      // L9: where the files are now, not where they were
      const movedTo = new Map(plan.moves.map(item => [pathFrom(hostRoot, item.source), pathFrom(hostRoot, item.destination)]));
      section('Project URLs that changed (update their callers)', report.apiUrlMoves.map(move => `${movedTo.get(move.file) ?? move.file}:${move.line}: ${move.from} -> ${move.to}`));
    }
    removeMigrationRollbackBackup(hostRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not analyze this project.';
    console.error(`nextspark migrate: ${message}`);
    if ((writesStarted || printRollbackOnFailure) && rollback) printRollback(rollback);
    process.exitCode = 1;
  }
}
