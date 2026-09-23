import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

interface MigrateOptions {
  dryRun?: boolean;
  json?: boolean;
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
    modified: FileChange[];
    projectOnly: string[];
  };
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
  const ignoredDirectories = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.turbo', 'coverage']);
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

function compareApp(hostRoot: string, templates: string | null): MigrateReport['appTemplates'] {
  const appRoot = join(hostRoot, 'app');
  const projectFiles = filesIn(appRoot);
  if (!templates || !existsSync(join(templates, 'app'))) {
    return { available: false, identical: [], modified: [], projectOnly: projectFiles.map(file => pathFrom(appRoot, file)).sort() };
  }
  const coreRoot = join(templates, 'app');
  const identical: string[] = [];
  const modified: FileChange[] = [];
  const projectOnly: string[] = [];
  for (const projectFile of projectFiles) {
    const file = pathFrom(appRoot, projectFile);
    const coreFile = join(coreRoot, file);
    if (!existsSync(coreFile)) projectOnly.push(file);
    else {
      const count = changedLines(readFileSync(projectFile), readFileSync(coreFile));
      if (count === 0) identical.push(file);
      else modified.push({ path: file, changedLines: count });
    }
  }
  return { available: true, identical: identical.sort(), modified: modified.sort((left, right) => left.path.localeCompare(right.path)), projectOnly: projectOnly.sort() };
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
    const first = themePath.split('/')[0];
    if (['app', 'pages', 'src'].includes(first)) reserved.push({ path: `${first}/`, reason: 'Next reserves this root directory' });
    else if (/^(?:middleware|proxy|instrumentation)(?:\..+)?$/.test(first)) reserved.push({ path: first, reason: 'Next reserves this root file name' });
    else if (/^next\.config\..+$/.test(first)) reserved.push({ path: first, reason: 'Next reserves next.config.* at the root' });
    const destination = join(hostRoot, themePath);
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

function reportFor(cwd: string): MigrateReport {
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
  return {
    hostRoot: { path: pathFrom(repository, host.root), reason: host.reason },
    warnings,
    versions: { packageManager, members, drift: declaredVersions.length > 1, driftVersions: declaredVersions },
    activeTheme: { ...selectedTheme, themes, plugins },
    appTemplates: compareApp(host.root, templates),
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
    `identical: ${paths(report.appTemplates.identical)}`,
    `modified: ${report.appTemplates.modified.map(file => `${file.path} (${file.changedLines} changed lines)`).join(', ') || 'none'}`,
    `project-only: ${paths(report.appTemplates.projectOnly)}`,
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

export function migrateCommand(options: MigrateOptions): void {
  if (!options.dryRun) {
    console.error('nextspark migrate: only report mode exists yet; run `pnpm exec nextspark migrate --dry-run`.');
    process.exitCode = 1;
    return;
  }
  try {
    const report = reportFor(process.cwd());
    if (options.json) {
      const json = JSON.stringify(report).replace(/[\u007f-\u009f\u061c\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069]/g, character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
      process.stdout.write(`${json}\n`);
    }
    else printReport(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not analyze this project.';
    console.error(`nextspark migrate: ${message}`);
    process.exitCode = 1;
  }
}
