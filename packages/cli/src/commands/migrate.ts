import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import * as tar from 'tar';
import { syncApp, SyncAppError } from './sync-app.js';
import { readGeneratedTagAt } from '../utils/generated-tag.js';
import { ROOT_TEMPLATE_FILES } from '../utils/sync-plan.js';
import { contentHash, readSyncState } from '../utils/sync-state.js';

interface MigrateOptions {
  dryRun?: boolean;
  json?: boolean;
  yes?: boolean;
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
    available: boolean;
    identical: string[];
    generated: string[];
    generatedBySyncState: string[];
    generatedByLegacyRegistry: string[];
    generatedByPreviousTemplate: string[];
    previousTemplateVersion: string | null;
    previousTemplateVersionSource: string | null;
    previousTemplateMethod: 'pnpm pack' | 'pnpm view tarball' | null;
    previousTemplateUnavailableReason: string | null;
    modified: FileChange[];
    projectOnly: string[];
  };
  generatedHost: {
    customizations: string[];
    customizationsDestination: string;
    nextStep: string | null;
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
  };
  untracked: string[];
  siblingThemeReferences: { path: string; occurrences: number }[];
}

class MigrateAnalysisError extends Error {}

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
  return filesIn(repositoryRoot).filter(file => basename(file) === 'package.json');
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
  method: 'pnpm pack' | 'pnpm view tarball';
  files: Map<string, Buffer>;
}

interface PreviousTemplateLookup {
  templates: PreviousTemplates | null;
  unavailableReason: string | null;
}

interface CoreVersionEvidence {
  version: string;
  source: string;
}

const previousTemplatesCache = new Map<string, PreviousTemplateLookup>();
const DEFAULT_PREVIOUS_CORE_NETWORK_TIMEOUT_MS = 60_000;

class PreviousTemplateTimeoutError extends Error {
  constructor(step: string, timeoutMs: number) {
    super(`timed out after ${timeoutMs}ms while ${step}`);
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
  const unpack = join(directory, method === 'pnpm pack' ? 'packed' : 'downloaded');
  mkdirSync(unpack, { recursive: true });
  await tar.x({ file: archive, cwd: unpack });
  const packageRoot = join(unpack, 'package');
  const manifest = readJson(join(packageRoot, 'package.json'));
  // pnpm 11/12 accepts the extra package argument to `pnpm pack` but silently
  // packs the current directory instead. Never classify against that archive.
  if (manifest?.name !== '@nextsparkjs/core' || manifest.version !== version) return null;
  const appRoot = [join(packageRoot, 'templates', 'app'), join(packageRoot, 'dist', 'templates', 'app')]
    .find(candidate => existsSync(candidate));
  if (!appRoot) return null;
  const files = templateFiles(appRoot);
  return files.size > 0 ? { version, method, files } : null;
}

/**
 * Look up an earlier core after the cheap local evidence has left a legacy
 * app file unclassified. `pnpm pack` is preferred. Older pnpm releases reject
 * a remote package argument, so use pnpm to resolve its tarball as a
 * compatible fallback. Failure is deliberately non-fatal: old files remain
 * conservative customizations and the report says why.
 */
async function previousCoreTemplates(version: string | null, currentVersion: string | null): Promise<PreviousTemplateLookup> {
  if (!version || version === currentVersion) return { templates: null, unavailableReason: null };
  const cached = previousTemplatesCache.get(version);
  if (cached !== undefined) return cached;

  const directory = mkdtempSync(join(tmpdir(), 'nextspark-migrate-core-'));
  const timeoutMs = previousCoreNetworkTimeoutMs();
  try {
    const environment = { ...process.env, npm_config_cache: join(directory, '.npm-cache') };
    let templates: PreviousTemplates | null = null;
    try {
      execFileSync('pnpm', ['pack', `@nextsparkjs/core@${version}`, '--pack-destination', directory], {
        cwd: directory,
        env: environment,
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: timeoutMs,
      });
      const archive = readdirSync(directory).find(file => file.endsWith('.tgz'));
      if (archive) templates = await templatesFromCoreArchive(join(directory, archive), directory, version, 'pnpm pack');
    } catch (error) {
      if (didProcessTimeOut(error)) throw new PreviousTemplateTimeoutError('running pnpm pack', timeoutMs);
    }
    if (!templates) {
      // Some pnpm releases reject a remote package argument; newer ones may
      // ignore it and pack cwd. Resolve the exact tarball URL with pnpm, then
      // validate its package identity before using any template bytes.
      let url: string;
      try {
        url = execFileSync('pnpm', ['view', `@nextsparkjs/core@${version}`, 'dist.tarball'], {
          cwd: directory,
          env: environment,
          encoding: 'utf8',
          stdio: 'pipe',
          timeout: timeoutMs,
        }).trim();
      } catch (viewError) {
        if (didProcessTimeOut(viewError)) throw new PreviousTemplateTimeoutError('running pnpm view', timeoutMs);
        throw viewError;
      }
      if (!/^https:\/\//.test(url)) throw new Error('pnpm did not return an HTTPS tarball URL');
      const signal = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetch(url, { signal });
      } catch (fetchError) {
        if (signal.aborted) throw new PreviousTemplateTimeoutError('fetching the core tarball', timeoutMs);
        throw fetchError;
      }
      if (!response.ok) throw new Error(`tarball request failed (${response.status})`);
      const archive = join(directory, 'core.tgz');
      writeFileSync(archive, Buffer.from(await response.arrayBuffer()));
      templates = await templatesFromCoreArchive(archive, directory, version, 'pnpm view tarball');
    }
    const result = {
      templates,
      unavailableReason: templates ? null : 'downloaded package identity or templates/app did not match the requested core release',
    };
    previousTemplatesCache.set(version, result);
    return result;
  } catch (error) {
    const result = {
      templates: null,
      unavailableReason: error instanceof PreviousTemplateTimeoutError
        ? error.message
        : 'pnpm could not retrieve or unpack the package',
    };
    previousTemplatesCache.set(version, result);
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The expensive old-template lookup is only useful for files local evidence cannot classify. */
function hasUnclassifiedLegacyAppFiles(hostRoot: string): boolean {
  const appRoot = join(hostRoot, 'app');
  const state = readSyncState(hostRoot);
  return legacyAppFilesIn(appRoot).some(projectFile => {
    const file = pathFrom(appRoot, projectFile);
    const content = readFileSync(projectFile);
    if (file.startsWith('(templates)/') || readGeneratedTagAt(`app/${file}`, content)?.intact) return false;
    return state?.files[`app/${file}`]?.written !== contentHash(content);
  });
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

function compareApp(hostRoot: string, templates: string | null, previous: PreviousTemplates | null, previousEvidence: CoreVersionEvidence | null, unavailableReason: string | null, activeTheme: string | null): MigrateReport['appTemplates'] {
  const appRoot = join(hostRoot, 'app');
  const projectFiles = legacyAppFilesIn(appRoot);
  if (!templates || !existsSync(join(templates, 'app'))) {
    const generatedByLegacyRegistry = projectFiles.map(file => pathFrom(appRoot, file)).filter(file => file.startsWith('(templates)/')).sort();
    const generatedSet = new Set(generatedByLegacyRegistry);
    return {
      available: false, identical: [], generated: [], generatedBySyncState: [], generatedByLegacyRegistry, generatedByPreviousTemplate: [],
      previousTemplateVersion: previousEvidence?.version ?? null, previousTemplateVersionSource: previousEvidence?.source ?? null,
      previousTemplateMethod: previous?.method ?? null, previousTemplateUnavailableReason: unavailableReason,
      modified: [], projectOnly: projectFiles.map(file => pathFrom(appRoot, file)).filter(file => !generatedSet.has(file)).sort(),
    };
  }
  const coreRoot = join(templates, 'app');
  const identical: string[] = [];
  const generated: string[] = [];
  const generatedBySyncState: string[] = [];
  const generatedByLegacyRegistry: string[] = [];
  const generatedByPreviousTemplate: string[] = [];
  const modified: FileChange[] = [];
  const projectOnly: string[] = [];
  const state = readSyncState(hostRoot);
  const usePpr = legacyProjectUsedPpr(hostRoot);
  for (const projectFile of projectFiles) {
    const file = pathFrom(appRoot, projectFile);
    const coreFile = join(coreRoot, file);
    const content = readFileSync(projectFile);
    // A valid generated tag identifies an untouched generated host file even
    // when it came from an older core template revision.
    if (file.startsWith('(templates)/')) generatedByLegacyRegistry.push(file);
    else if (readGeneratedTagAt(`app/${file}`, content)?.intact) generated.push(file);
    else if ([`app/${file}`].some(path => {
      const entry = state?.files[path];
      const hash = contentHash(content);
      // `core` is the old template hash. For taggable files, removing the tag
      // deliberately hands ownership to the project; only `written` proves
      // that an untaggable file is still exactly what sync left on disk.
      return entry?.written === hash;
    })) generatedBySyncState.push(file);
    else if (existsSync(coreFile) && matchesTemplateBytes(content, readFileSync(coreFile))) identical.push(file);
    else if (previousTemplateCandidates(previous, file, activeTheme, usePpr).some(candidate => matchesTemplateBytes(content, candidate))) generatedByPreviousTemplate.push(file);
    else if (!existsSync(coreFile)) projectOnly.push(file);
    else {
      const count = changedLines(content, readFileSync(coreFile));
      modified.push({ path: file, changedLines: count });
    }
  }
  return {
    available: true, identical: identical.sort(), generated: generated.sort(), generatedBySyncState: generatedBySyncState.sort(),
    generatedByLegacyRegistry: generatedByLegacyRegistry.sort(),
    generatedByPreviousTemplate: generatedByPreviousTemplate.sort(), previousTemplateVersion: previousEvidence?.version ?? null,
    previousTemplateVersionSource: previousEvidence?.source ?? null, previousTemplateMethod: previous?.method ?? null,
    previousTemplateUnavailableReason: unavailableReason,
    modified: modified.sort((left, right) => left.path.localeCompare(right.path)), projectOnly: projectOnly.sort(),
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

interface SourceString {
  start: number;
  end: number;
  value: string;
}

interface SourceView {
  code: string;
  strings: SourceString[];
}

/** Mask comments and string contents so config syntax is never found in prose. */
function sourceView(source: string): SourceView {
  const code = source.split('');
  const strings: SourceString[] = [];
  const mask = (start: number, end: number) => {
    for (let index = start; index < end; index++) code[index] = ' ';
  };
  for (let index = 0; index < source.length;) {
    if (source[index] === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index);
      mask(index, end === -1 ? source.length : end);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const close = source.indexOf('*/', index + 2);
      const end = close === -1 ? source.length : close + 2;
      mask(index, end);
      index = end;
      continue;
    }
    if (!['"', "'", '`'].includes(source[index])) {
      index++;
      continue;
    }
    const start = index;
    const quote = source[index++];
    while (index < source.length && source[index] !== quote) {
      index += source[index] === '\\' ? 2 : 1;
    }
    const end = Math.min(index + 1, source.length);
    strings.push({ start, end, value: source.slice(start + 1, index) });
    mask(start, end);
    index = end;
  }
  return { code: code.join(''), strings };
}

function closingBrace(code: string, openingBrace: number): number | null {
  let depth = 0;
  for (let index = openingBrace; index < code.length; index++) {
    if (code[index] === '{') depth++;
    else if (code[index] === '}' && --depth === 0) return index;
  }
  return null;
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

function collisions(hostRoot: string, themeDirectory: string | null): MigrateReport['collisions'] {
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
    return gitOutput(cwd, ['rev-parse', '--show-toplevel']).trim();
  } catch {
    throw new MigrateAnalysisError('This command must run inside a git repository.');
  }
}

function untrackedFiles(repositoryRoot: string): string[] {
  const output = gitOutput(repositoryRoot, ['ls-files', '--others', '--exclude-standard', '-z', '--', ':(exclude,glob)**/.env*']);
  return output.split('\0').filter(Boolean).filter(file => !isEnvironmentFile(basename(file))).sort();
}

function siblingReferences(repositoryRoot: string, hostRoot: string, theme: string | null): MigrateReport['siblingThemeReferences'] {
  if (!theme) return [];
  const needle = `contents/themes/${theme}`;
  const hostPath = resolve(hostRoot);
  const references: { path: string; occurrences: number }[] = [];
  const packageRoots = packageFiles(repositoryRoot).map(file => resolve(dirname(file)));
  const owner = (file: string) => packageRoots.filter(root => file === root || file.startsWith(`${root}${sep}`)).sort((left, right) => right.length - left.length)[0];
  for (const packageRoot of packageRoots) {
    if (resolve(packageRoot) === hostPath || packageRoot.startsWith(`${hostPath}${sep}`)) continue;
    for (const file of filesIn(packageRoot).filter(file => owner(file) === packageRoot)) {
      const occurrences = countOccurrences(readFileSync(file, 'utf8'), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
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

function missingGeneratedHostSyncSupport(templates: string | null): string[] {
  const coreDir = templates ? dirname(templates) : null;
  if (!coreDir) return ['templates/app', 'scripts/build/registry.mjs', 'scripts/build/registry/write-places.mjs', 'scripts/build/registry/post-build/own-gitignores.mjs', 'scripts/build/safe-fs.mjs'];
  return [
    'templates/app',
    'scripts/build/registry.mjs',
    'scripts/build/registry/write-places.mjs',
    'scripts/build/registry/post-build/own-gitignores.mjs',
    'scripts/build/safe-fs.mjs',
  ].filter(path => !existsSync(join(coreDir, path)));
}

function canRunGeneratedHostSync(templates: string | null): boolean {
  return missingGeneratedHostSyncSupport(templates).length === 0;
}

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

async function reportFor(cwd: string): Promise<MigrateReport> {
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
  const previousLookup = hasUnclassifiedLegacyAppFiles(host.root)
    ? await previousCoreTemplates(previousEvidence?.version ?? null, currentCore)
    : { templates: null, unavailableReason: null };
  const appTemplates = compareApp(host.root, templates, previousLookup.templates, previousEvidence, previousLookup.unavailableReason, selectedTheme.name);
  const appCustomizations = [...appTemplates.modified.map(file => file.path), ...appTemplates.projectOnly].sort();
  const configPlugins = themeDirectory ? requiredPlugins(themeDirectory, hostPackage, pluginsDirectory) : { plugins: [], warnings: [] };
  const envExample = themeDirectory ? envExamplePlan(host.root, themeDirectory) : { action: 'none' as const, path: null };
  const scripts = coreScripts(host.root, templates);
  const hostFiles = filesIn(host.root);
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
  if (appCustomizations.length > 0) warnings.push(`Legacy app customizations will move to legacy-app-customizations/: ${appCustomizations.join(', ')}`);
  if (previousEvidence && !previousLookup.templates) {
    warnings.push(`Could not fetch @nextsparkjs/core@${previousEvidence.version} (${previousLookup.unavailableReason}) to classify old generated app files; unmatched files remain customizations.`);
  }
  if (envExample.action === 'conflict') warnings.push(`${envExample.path} differs from the root .env.example and will not be merged.`);
  warnings.push(...configPlugins.warnings);
  warnings.push(...scripts.warnings);
  return {
    hostRoot: { path: pathFrom(repository, host.root), reason: host.reason },
    warnings,
    versions: { packageManager, members, drift: declaredVersions.length > 1, driftVersions: declaredVersions },
    activeTheme: { ...selectedTheme, themes, plugins },
    appTemplates,
    generatedHost: {
      customizations: appCustomizations,
      customizationsDestination: 'legacy-app-customizations',
      nextStep: existsSync(join(host.root, 'app')) && !canRunGeneratedHostSync(templates)
        ? 'nextspark sync:app --force'
        : null,
    },
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
    collisions: collisions(host.root, themeDirectory),
    untracked,
    siblingThemeReferences: siblingReferences(repository, host.root, selectedTheme.name),
  };
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
  section('App vs core templates', [
    `identical current template (${report.appTemplates.identical.length}): ${paths(report.appTemplates.identical)}`,
    `known generated by intact tag (${report.appTemplates.generated.length}): ${paths(report.appTemplates.generated)}`,
    `known generated by sync-state hash (${report.appTemplates.generatedBySyncState.length}): ${paths(report.appTemplates.generatedBySyncState)}`,
    `known generated by legacy app/(templates) output (${report.appTemplates.generatedByLegacyRegistry.length}): ${paths(report.appTemplates.generatedByLegacyRegistry)}`,
    `known generated by previous core template${report.appTemplates.previousTemplateVersion ? ` ${report.appTemplates.previousTemplateVersion} (${report.appTemplates.previousTemplateVersionSource}; ${report.appTemplates.previousTemplateMethod ?? report.appTemplates.previousTemplateUnavailableReason})` : ''} (${report.appTemplates.generatedByPreviousTemplate.length}): ${paths(report.appTemplates.generatedByPreviousTemplate)}`,
    `modified customization (${report.appTemplates.modified.length}): ${report.appTemplates.modified.map(file => `${file.path} (${file.changedLines} changed lines)`).join(', ') || 'none'}`,
    `project-only customization (${report.appTemplates.projectOnly.length}): ${paths(report.appTemplates.projectOnly)}`,
  ]);
  section('Generated app host', [
    `customizations: ${paths(report.generatedHost.customizations)}`,
    `customization destination: ${report.generatedHost.customizationsDestination}/`,
    report.generatedHost.nextStep ? `next step: ${report.generatedHost.nextStep}` : 'next step: sync:app will run during migration',
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
  ]);
  section('Untracked non-ignored files', [paths(report.untracked)]);
  section('Sibling workspace references to the active theme', [report.siblingThemeReferences.length ? report.siblingThemeReferences.map(reference => `${reference.path} (${reference.occurrences})`).join(', ') : 'none']);
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
  const reserved: { path: string; reason: string }[] = [];
  const unmoved: string[] = [];
  const plannedByDestination = new Map<string, PlannedMove>();
  const add = (source: string, destination: string, kind: PlannedMove['kind']) => {
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
    if (prior) {
      if (readFileSync(source).equals(readFileSync(prior.source))) duplicates.push(item);
      else {
        collisions.push(item);
        unmoved.push(source);
      }
      return;
    }
    if (!existsSync(destination)) moves.push(item);
    else if (statSync(destination).isFile() && readFileSync(source).equals(readFileSync(destination))) duplicates.push(item);
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
  return { moves, duplicates, collisions, reserved: uniqueReserved.sort((left, right) => left.path.localeCompare(right.path)), unmoved };
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
  next = next.replace(new RegExp(`${themePattern}/([^'"\`\\s)]*)`, 'g'), (all, suffix: string) => mapThemeSuffix(suffix) ?? all);
  next = next.replace(new RegExp(`${themePattern}(?=['"\`\\s),]|$)`, 'g'), all => mapThemeSuffix('') ?? all);
  // Themes stop being workspace members. Keep the host package in a workspace
  // manifest rather than leaving a glob that points at a removed directory.
  const themesRoot = dirname(themeRoot);
  if (childDirectories(themesRoot).every(name => name === theme) && mapThemeSuffix('')) next = next.replace(/contents\/themes\/\*/g, '.');
  next = next.replace(/contents\/plugins\/([^'"`\s)]*)/g, (all, suffix: string) => mapPluginSuffix(suffix) ?? all);
  return rewriteLegacyAliasImports(next, source, catalog, themeRoot, pluginsRoot, hostRoot, planned, unmoved)
    .replace(/__NEXTSPARK_THEME_ALIAS__/g, `^@/themes/${theme}/(.*)$`);
}

function rewriteMovedRelativeImports(content: string, source: string, destination: string, planned: Map<string, string>): string {
  const replace = (_all: string, before: string, quote: string, value: string, after: string) => {
    if (!value.startsWith('.')) return `${before}${quote}${value}${quote}${after}`;
    if (quote === '`' && value.includes('${')) return `${before}${quote}${value}${quote}${after}`;
    const target = resolve(dirname(source), value);
    const targetDestination = directMoveDestination(target, planned);
    // Do not manufacture a new import when the old target is absent from the
    // move. The post-move check reports it as a broken import instead.
    if (!targetDestination) return `${before}${quote}${value}${quote}${after}`;
    // Only a path whose meaning changes when this file moves needs adjustment.
    if (dirname(source) === dirname(destination) && targetDestination === target) return `${before}${quote}${value}${quote}${after}`;
    return `${before}${quote}${relativeSpecifier(destination, targetDestination)}${quote}${after}`;
  };
  const cssReplace = (_all: string, before: string, quote: string, value: string) => replace('', before, quote, value, '');
  return content
    .replace(/(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)(['"`])(\.[^'"`]*)\2(\s*\)?)/g, replace)
    .replace(/(@import\s*)(['"])(\.[^'"]*)\2/g, cssReplace);
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
  for (const file of filesIn(hostRoot)) {
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
  writeFileSync(file, `import { defineConfig } from '@nextsparkjs/core/lib/config'\n\nexport default defineConfig({\n  plugins: ${JSON.stringify(plugins)},\n})\n`);
  return true;
}

function moveThemeEnvExample(hostRoot: string, themeRoot: string, plan: MigrateReport['envExample']): boolean {
  if (!plan.path) return false;
  const source = join(hostRoot, plan.path);
  const destination = join(hostRoot, '.env.example');
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
    const original = readFileSync(file, 'utf8');
    const indentation = original.match(/\n([ \t]+)"/)?.[1] ?? '  ';
    writeFileSync(file, `${JSON.stringify(pkg, null, indentation)}${original.endsWith('\n') ? '\n' : ''}`);
  }
  return changed;
}

/** Keep archived root-app source out of the template's broad TypeScript include. */
function excludeLegacyAppCustomizations(hostRoot: string): boolean {
  const file = join(hostRoot, 'tsconfig.json');
  if (!existsSync(file)) return false;
  const content = readFileSync(file, 'utf8');
  const parsed = parseJsonc(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
  const current = stringArray((parsed as Record<string, unknown>).exclude) ?? [];
  if (current.includes('legacy-app-customizations')) return false;

  // Retain comments and formatting in the common JSONC form used by the
  // shipped template.  Falling back to the formatter is only for unusual
  // valid JSONC shapes where a surgical array edit cannot be located.
  const array = jsoncPropertyArray(content, 'exclude');
  if (array) {
    const body = content.slice(array.open + 1, array.close);
    const elementMatches = [...body.matchAll(/\n([ \t]+)"/g)];
    const elementIndent = elementMatches.length > 0 ? elementMatches[elementMatches.length - 1][1] : '  ';
    const closingIndent = body.match(/\n([ \t]*)$/)?.[1];
    const bodyBeforeClosingIndent = closingIndent === undefined ? body : body.slice(0, -closingIndent.length);
    const comma = current.length > 0 && !jsoncArrayHasTrailingComma(body) ? ',' : '';
    const insertion = `${comma}${bodyBeforeClosingIndent.endsWith('\n') ? '' : '\n'}${elementIndent}"legacy-app-customizations"\n`;
    writeFileSync(file, `${content.slice(0, array.open + 1)}${bodyBeforeClosingIndent}${insertion}${closingIndent ?? ''}${content.slice(array.close)}`);
    return true;
  }
  (parsed as Record<string, unknown>).exclude = [...current, 'legacy-app-customizations'];
  const indentation = content.match(/\n([ \t]+)"/)?.[1] ?? '  ';
  writeFileSync(file, `${JSON.stringify(parsed, null, indentation)}${content.endsWith('\n') ? '\n' : ''}`);
  return true;
}

function moveLegacyApp(hostRoot: string, app: MigrateReport['appTemplates']): { removed: number; customized: number; tsconfigExcluded: boolean } {
  const sourceRoot = join(hostRoot, 'app');
  if (!existsSync(sourceRoot)) return { removed: 0, customized: 0, tsconfigExcluded: false };
  const custom = new Set([...app.modified.map(file => file.path), ...app.projectOnly]);
  const generated = new Set([...app.identical, ...app.generated, ...app.generatedBySyncState, ...app.generatedByLegacyRegistry, ...app.generatedByPreviousTemplate]);
  const destinationRoot = join(hostRoot, 'legacy-app-customizations');
  for (const file of custom) {
    const destination = join(destinationRoot, file);
    if (existsSync(destination)) throw new MigrateAnalysisError(`Refusing to overwrite legacy app customization: ${pathFrom(hostRoot, destination)}`);
  }
  for (const file of custom) {
    const source = join(sourceRoot, file);
    const destination = join(destinationRoot, file);
    mkdirSync(dirname(destination), { recursive: true });
    renameSync(source, destination);
  }
  for (const file of generated) {
    const source = join(sourceRoot, file);
    if (existsSync(source)) unlinkSync(source);
  }
  removeEmptyDirectories(sourceRoot);
  removeEmptyAncestors(sourceRoot, hostRoot);
  return { removed: generated.size, customized: custom.size, tsconfigExcluded: custom.size > 0 && excludeLegacyAppCustomizations(hostRoot) };
}

async function syncGeneratedHost(hostRoot: string, templates: string | null): Promise<boolean> {
  // Tests and incomplete installations can compare templates but cannot run the
  // full sync path. Leave an exact command rather than pretending it ran.
  mkdirSync(join(hostRoot, 'src', 'app'), { recursive: true });
  if (!canRunGeneratedHostSync(templates)) return false;
  const cwd = process.cwd();
  try {
    process.chdir(hostRoot);
    const result = await syncApp({ force: true });
    if (result.status !== 'success') throw new SyncAppError('sync:app did not complete');
  } finally {
    process.chdir(cwd);
  }
  return true;
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
  return entries.map(file => {
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

function legacyRouteRoots(hostRoot: string): string[] {
  if (!existsSync(join(hostRoot, 'src', 'app'))) return [];
  return ['app', 'pages'].filter(path => existsSync(join(hostRoot, path)));
}

function applyMove(repository: string, hostRoot: string, themeRoot: string, pluginsRoot: string, theme: string, plan: MovePlan, tsconfigAliases: AliasCatalog, envPlan: MigrateReport['envExample'], configPlugins: string[]): { moved: number; deduplicated: number; rewritten: number; envRemoved: boolean; configCreated: boolean; scriptsRenamed: number; contentsRemoved: boolean; remainingContents: RemainingContents[] } {
  const plannedItems = [...plan.moves, ...plan.duplicates];
  const planned = new Map(plannedItems.map(item => [item.source, item.destination]));
  const unmoved = new Set(plan.unmoved);
  const duplicateByDestination = new Map(plan.duplicates.map(item => [item.destination, item]));
  const files = filesIn(repository).filter(file => !isOtherThemeFile(file, join(hostRoot, 'contents', 'themes'), theme));
  let rewritten = 0;
  for (const file of files) {
    if (plan.duplicates.some(item => item.source === file) || plan.collisions.some(item => item.source === file)) continue;
    const buffer = readFileSync(file);
    if (!isText(buffer)) continue;
    const duplicate = duplicateByDestination.get(file);
    const source = duplicate?.source ?? file;
    const destination = planned.get(file) ?? file;
    let next = rewriteLegacyPaths(buffer.toString('utf8'), source, destination, themeRoot, pluginsRoot, hostRoot, theme, planned, unmoved, tsconfigAliases);
    const tsconfig = tsconfigAliases.configs.get(file);
    if (tsconfig) next = rewriteDeadTsconfigAliases(next, tsconfig);
    if (planned.has(file) || duplicate) {
      next = rewriteMovedRelativeImports(next, source, destination, planned);
      next = rewriteMovedDepthConfig(next, source, destination, planned, unmoved, themeRoot, hostRoot);
      next = rewriteHookExport(next, destination);
    }
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteActiveThemeUse(next, destination, hostRoot, theme);
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteHookImports(next, destination, hostRoot);
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteRootFirstTestContracts(next, destination, hostRoot, theme);
    if (destination === file || destination.startsWith(`${hostRoot}${sep}`)) next = rewriteRemovedMiddlewareApi(next, destination, hostRoot);
    if (next !== buffer.toString('utf8')) {
      writeFileSync(file, next);
      rewritten++;
    }
  }
  moveThemeEnvExample(hostRoot, themeRoot, envPlan);
  const envRemoved = removeActiveThemeFromExample(hostRoot);
  for (const item of plan.moves) {
    mkdirSync(dirname(item.destination), { recursive: true });
    renameSync(item.source, item.destination);
  }
  for (const item of plan.duplicates) unlinkSync(item.source);
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
  'legacy-app-customizations',
  '.nextspark/sync-state.json',
  '.nextspark/registries',
  '.nextspark/backups',
] as const;

/** Kept until a failed migration's printed rollback has restored its originals. */
const MIGRATION_ROLLBACK_BACKUP_PATH = '.nextspark/migrate-rollback';

function migrationRollbackBackup(hostRoot: string): string {
  return join(hostRoot, MIGRATION_ROLLBACK_BACKUP_PATH);
}

/** Copy a pre-existing path without following links, so rollback can put it back byte-for-byte. */
function copyForMigrationRollback(source: string, destination: string): void {
  const entry = lstatSync(source);
  if (entry.isDirectory()) {
    mkdirSync(destination, { recursive: true });
    for (const child of readdirSync(source, { withFileTypes: true })) {
      copyForMigrationRollback(join(source, child.name), join(destination, child.name));
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
    '.gitignore',
    '.env.example',
    'app',
    ...ROOT_TEMPLATE_FILES,
    'proxy.ts',
    'middleware.ts',
    ...GENERATED_HOST_ROLLBACK_PATHS,
  ]);
  if (!hadLegacyApp) paths.delete('app');
  if (report.envExample.path && report.envExample.action !== 'none' && report.envExample.action !== 'conflict') paths.add(report.envExample.path);
  for (const item of [...plan.moves, ...plan.duplicates]) paths.add(pathFrom(hostRoot, item.source));
  return [...paths].sort();
}

function snapshotMigrationRollback(hostRoot: string, plan: MovePlan, report: MigrateReport, hadLegacyApp: boolean): void {
  const backup = migrationRollbackBackup(hostRoot);
  if (existsSync(backup)) {
    throw new MigrateAnalysisError(`Refusing to overwrite migration rollback backup: ${MIGRATION_ROLLBACK_BACKUP_PATH}. Run the prior migration's printed rollback first.`);
  }
  try {
    const files = join(backup, 'files');
    for (const path of migrationRollbackPaths(hostRoot, plan, report, hadLegacyApp)) {
      const source = join(hostRoot, path);
      if (existsSync(source)) copyForMigrationRollback(source, join(files, path));
    }
  } catch (error) {
    rmSync(backup, { recursive: true, force: true });
    throw error;
  }
}

function removeMigrationRollbackBackup(hostRoot: string): void {
  rmSync(migrationRollbackBackup(hostRoot), { recursive: true, force: true });
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
  // sync:app can create these root files before it creates its state.  Only
  // clean names that did not exist before migration, never user-owned files.
  for (const path of [...ROOT_TEMPLATE_FILES, 'proxy.ts', 'middleware.ts', 'src/app/globals.css', '.gitignore']) {
    if (!existsSync(join(hostRoot, path))) destinations.add(pathFrom(repository, join(hostRoot, path)));
  }
  if (report.config.plannedCreation) destinations.add(pathFrom(repository, join(hostRoot, 'nextspark.config.ts')));
  if (report.envExample.action === 'move') destinations.add(pathFrom(repository, join(hostRoot, '.env.example')));
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
    'Run these commands from any directory to restore the pre-migration tree:',
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

export async function migrateCommand(options: MigrateOptions): Promise<void> {
  let rollback: string[] | null = null;
  let writesStarted = false;
  let printRollbackOnFailure = false;
  try {
    const report = await reportFor(process.cwd());
    if (options.dryRun) {
      if (options.json) {
        const json = JSON.stringify(report).replace(/[\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
        process.stdout.write(`${json}\n`);
      } else printReport(report);
      return;
    }
    if (options.json) throw new MigrateAnalysisError('--json is available only with --dry-run.');
    printReport(report);
    const repository = repositoryRoot(process.cwd());
    if (!cleanWorkingTree(repository, report.untracked)) throw new MigrateAnalysisError('Refusing to move files on a dirty git tree. Commit, stash, or remove untracked files first.');
    const theme = report.activeTheme.name;
    const hostRoot = resolve(repository, report.hostRoot.path);
    if (!theme) throw new MigrateAnalysisError('No active theme was found; set it in .env.example before migrating.');
    const themeRoot = join(hostRoot, 'contents', 'themes', theme);
    if (!existsSync(themeRoot)) throw new MigrateAnalysisError(`Active theme ${theme} was not found under contents/themes/.`);
    const pluginsRoot = join(hostRoot, 'contents', 'plugins');
    assertMoveRootsAreLocal(hostRoot, themeRoot, pluginsRoot);
    const plan = planMove(hostRoot, themeRoot, pluginsRoot);
    validateHookExports(plan);
    for (const file of report.generatedHost.customizations) {
      const destination = join(hostRoot, report.generatedHost.customizationsDestination, file);
      if (existsSync(destination)) throw new MigrateAnalysisError(`Refusing to overwrite legacy app customization: ${pathFrom(hostRoot, destination)}`);
    }
    const hadLegacyApp = existsSync(join(hostRoot, 'app'));
    if (existsSync(migrationRollbackBackup(hostRoot))) {
      throw new MigrateAnalysisError(`Refusing to overwrite migration rollback backup: ${MIGRATION_ROLLBACK_BACKUP_PATH}. Run the prior migration's printed rollback first.`);
    }
    const generatedHostSnapshot = hadLegacyApp ? snapshotGeneratedHostPaths(hostRoot) : null;
    rollback = rollbackCommands(repository, hostRoot, plan, report, hadLegacyApp, generatedHostSnapshot);
    section('Move plan', [
      `owned files to move: ${plan.moves.length}; byte-identical duplicates verified: ${plan.duplicates.length}`,
      `reserved source left in place: ${paths(plan.reserved.map(item => item.path))}`,
      `host collisions: ${paths(plan.collisions.map(item => pathFrom(hostRoot, item.source)) )}`,
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
    if (hadLegacyApp && !canRunGeneratedHostSync(templates)) {
      printRollbackOnFailure = true;
      const missing = missingGeneratedHostSyncSupport(templates);
      throw new MigrateAnalysisError(`Cannot migrate legacy app/: installed @nextsparkjs/core is missing guarded sync support: ${missing.join(', ')}. Upgrade @nextsparkjs/core to the same version as the CLI, then rerun nextspark migrate.`);
    }
    const aliasesBeforeMove = legacyPathAliases(hostRoot, themeRoot, pluginsRoot, plan);
    if (aliasesBeforeMove.warnings.length > 0) {
      section('Alias configuration warnings', aliasesBeforeMove.warnings.map(file => `could not parse or resolve ${file}; aliases from it were not derived`));
    }
    const legacyHook = [...plan.moves, ...plan.duplicates].find(item => /config[\\/]hooks[\\/]proxy\.[^.]+$/.test(item.destination));
    if (legacyHook) validateLegacyHookImportShapes(hostRoot, legacyHook.source, aliasesBeforeMove);
    const plannedItems = [...plan.moves, ...plan.duplicates];
    // Environment-shaped files are moved as opaque bytes, never parsed as
    // source or inspected by the import validator.
    const sourceFiles = plannedItems.filter(item => !isEnvironmentFile(basename(item.source)));
    const beforeFiles = sourceFiles.map(item => ({ file: item.source, source: item.source, display: pathFrom(hostRoot, item.destination) }));
    const brokenBeforeMove = brokenImports(hostRoot, beforeFiles, aliasesBeforeMove);
    snapshotMigrationRollback(hostRoot, plan, report, hadLegacyApp);
    writesStarted = true;
    const result = applyMove(repository, hostRoot, themeRoot, pluginsRoot, theme, plan, aliasesBeforeMove, report.envExample, report.config.plugins);
    if (hadLegacyApp) {
      let synced: boolean;
      try {
        synced = await syncGeneratedHost(hostRoot, templateDirectory(hostRoot, repository));
      } catch (error) {
        console.error('MIGRATION FAILED: sync:app did not generate the new src/app host. The legacy app/ has been preserved.');
        throw error;
      }
      const legacyApp = moveLegacyApp(hostRoot, report.appTemplates);
      const legacySummary = `Generated host: removed ${legacyApp.removed} generated file(s); moved ${legacyApp.customized} customization(s)${legacyApp.tsconfigExcluded ? '; excluded legacy-app-customizations from tsconfig' : ''}.`;
      if (!synced) console.log(`  ${legacySummary} Run "nextspark sync:app --force" to finish generating src/app.`);
      else console.log(`  ${legacySummary}`);
    }
    const routeRoots = legacyRouteRoots(hostRoot);
    if (routeRoots.length > 0) {
      throw new MigrateAnalysisError(`Post-migration route-root check failed: ${routeRoots.join(', ')} remains next to src/app. Remove it before Next.js can use src/app.`);
    }
    const aliasesAfterMove = legacyPathAliases(hostRoot, themeRoot, pluginsRoot, plan);
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
    removeMigrationRollbackBackup(hostRoot);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not analyze this project.';
    console.error(`nextspark migrate: ${message}`);
    if ((writesStarted || printRollbackOnFailure) && rollback) printRollback(rollback);
    process.exitCode = 1;
  }
}
