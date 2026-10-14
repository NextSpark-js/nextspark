import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Entity slugs with an underscore (`campaign_members`) are valid. `nextspark migrate --rename-entity-slugs`
 * offers to rename them to hyphens (`campaign-members`) for a project that wants the one spelling; it is
 * never required. This module finds those entities, plans and applies the rename, and writes the report of
 * what else a project has to change. It never touches the database and never runs SQL: it prints it.
 */

/** Written in the renamed entity's directory as `old -> new`: `db:migrate` takes over the migrations recorded under the old name, in that directory only. */
export const RENAMED_FROM_FILE = '.renamed-from';

export interface EntityRename {
  /** The directory name, which is also the old slug. */
  name: string;
  oldSlug: string;
  newSlug: string;
  /** The table: the old slug, or the `tableName` the config already sets. */
  tableName: string;
  /** False when the config already has a `tableName`, which is kept. */
  setsTableName: boolean;
}

export interface EntitySlugPlan {
  renames: EntityRename[];
  /** Entities with an underscore that the rename leaves alone, and why. */
  skipped: { name: string; reason: string }[];
}

export interface ReportSection {
  title: string;
  lines: string[];
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.next', '.git', '.nextspark', 'dist', 'coverage', '.turbo', '.claude', 'out']);
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;
const LISTED_AT_MOST = 20;

function directories(path: string): string[] {
  try {
    return readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory() && !entry.name.startsWith('.')).map(entry => entry.name).sort();
  } catch {
    return [];
  }
}

/** Where a project's entities live: the root-first `entities/`, and the active theme's before `migrate` moves it. */
function entityRoots(hostRoot: string, theme: string | null): string[] {
  return [join(hostRoot, 'entities'), ...(theme ? [join(hostRoot, 'contents', 'themes', theme, 'entities')] : [])].filter(root => existsSync(root));
}

/** Comments blanked and, unless `keepStrings`, string contents masked (same length), so braces and keys inside them are never read. */
function maskSource(text: string, keepStrings = false): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') out += ' ', i++;
      i--;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
    } else if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') out += keepStrings ? text[i] : 'x', i++;
        out += keepStrings || text[i] === '\n' ? text[i] : 'x';
        i++;
      }
      out += c;
    } else out += c;
  }
  return out;
}

type PropertyValue = { state: 'literal'; value: string } | { state: 'dynamic' } | { state: 'absent' };

/**
 * The top-level properties `slug` and `tableName` of a config: the ones at the shallowest brace depth where
 * `slug` is written, never a mention in a comment or in a nested object.
 */
function topLevelProperties(text: string): { slug: PropertyValue; tableName: PropertyValue } {
  const masked = maskSource(text);
  const depthAt = (index: number) => {
    let depth = 0;
    for (let i = 0; i < index; i++) {
      if (masked[i] === '{' || masked[i] === '[' || masked[i] === '(') depth++;
      else if (masked[i] === '}' || masked[i] === ']' || masked[i] === ')') depth--;
    }
    return depth;
  };
  const find = (name: string): { index: number; depth: number; value: PropertyValue }[] => {
    const found: { index: number; depth: number; value: PropertyValue }[] = [];
    for (const match of masked.matchAll(new RegExp(`(?<![\\w$.])(?:${name}|(['"])${name}\\1)\\s*:\\s*`, 'g'))) {
      const start = match.index + match[0].length;
      const quote = /^(['"])/.exec(masked.slice(start));
      const closing = quote ? masked.indexOf(quote[1], start + 1) : -1;
      // a plain string literal, and nothing else, as the value
      const literal = quote && closing !== -1 && /^[ \t]*(?:,|\}|\r?\n|$)/.test(masked.slice(closing + 1)) ? text.slice(start + 1, closing) : null;
      found.push({ index: match.index, depth: depthAt(match.index), value: literal !== null ? { state: 'literal', value: literal } : { state: 'dynamic' } });
    }
    return found;
  };
  const slugs = find('slug');
  if (slugs.length === 0) return { slug: { state: 'absent' }, tableName: { state: 'absent' } };
  const shallowest = Math.min(...slugs.map(item => item.depth));
  const slug = slugs.find(item => item.depth === shallowest) as (typeof slugs)[number];
  const tableName = find('tableName').find(item => item.depth === slug.depth) ?? { value: { state: 'absent' } as PropertyValue };
  return { slug: slug.value, tableName: tableName.value };
}

/** The entity config of a directory: the first `*.config.ts` that writes a `slug`. */
function entityConfig(directory: string): { file: string; slug: PropertyValue; tableName: PropertyValue; text: string } | null {
  let files: string[] = [];
  try {
    files = readdirSync(directory).filter(name => /\.config\.tsx?$/.test(name)).sort();
  } catch {
    return null;
  }
  for (const name of files) {
    const text = readFileSync(join(directory, name), 'utf8');
    const properties = topLevelProperties(text);
    if (properties.slug.state !== 'absent') return { file: join(directory, name), text, ...properties };
  }
  return null;
}

/**
 * The entities whose slug has an underscore, and what the rename would do to each. Reads only; the same
 * answer before `migrate` moves the theme's entities and after.
 */
export function planEntitySlugs(hostRoot: string, theme: string | null): EntitySlugPlan {
  const plan: EntitySlugPlan = { renames: [], skipped: [] };
  const seen = new Map<string, { directory: string; config: ReturnType<typeof entityConfig> }>();
  for (const root of entityRoots(hostRoot, theme)) {
    for (const name of directories(root)) {
      if (seen.has(name)) continue;
      seen.set(name, { directory: join(root, name), config: entityConfig(join(root, name)) });
    }
  }
  const names = new Set(seen.keys());
  for (const [name, { directory, config }] of seen) {
    const slug = config?.slug.state === 'literal' ? config.slug.value : name;
    if (!slug.includes('_') && !name.includes('_')) continue;
    const skip = (reason: string) => plan.skipped.push({ name, reason });
    if (!config || config.slug.state !== 'literal') {
      skip('no literal slug in its config (write slug: \'' + name + '\' as a string)');
      continue;
    }
    if (slug !== name) {
      skip(`its slug "${slug}" differs from its directory name; make them equal first (nextspark prepare requires it)`);
      continue;
    }
    if (config.tableName.state === 'dynamic') {
      skip('its tableName is not a string literal, so the table it points at cannot be kept; write it as a literal first');
      continue;
    }
    if (existsSync(join(directory, 'children')) && readdirSync(join(directory, 'children')).length > 0) {
      skip("its child entities' tables are named after this directory (<directory>_<child>), so renaming it would point them at tables that do not exist");
      continue;
    }
    const newSlug = slug.replace(/_/g, '-');
    if (names.has(newSlug)) {
      skip(`an entity named "${newSlug}" already exists`);
      continue;
    }
    names.add(newSlug);
    plan.renames.push({ name, oldSlug: slug, newSlug, tableName: config.tableName.state === 'literal' ? config.tableName.value : slug, setsTableName: config.tableName.state === 'absent' });
  }
  return plan;
}

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name) && !(entry.name === 'app' && directory === join(root, 'src'))) visit(path);
      } else if (SOURCE_FILE.test(entry.name) || entry.name.endsWith('.json')) files.push(path);
    }
  };
  visit(root);
  return files;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `slug: 'old'` becomes `slug: 'new'`, with `tableName: 'old'` after it unless the config sets one. */
export function rewriteEntityConfig(text: string, rename: EntityRename): string {
  const line = new RegExp(`^([ \\t]*)slug\\s*:\\s*(['"])${escapeRegExp(rename.oldSlug)}\\2\\s*,?[ \\t]*$`, 'm');
  if (line.test(text)) {
    return text.replace(line, (_all, indent: string) => `${indent}slug: '${rename.newSlug}',${rename.setsTableName ? `\n${indent}tableName: '${rename.tableName}',` : ''}`);
  }
  return text.replace(new RegExp(`(\\bslug\\s*:\\s*)(['"])${escapeRegExp(rename.oldSlug)}\\2`), (_all, key: string) => `${key}'${rename.newSlug}'${rename.setsTableName ? `, tableName: '${rename.tableName}'` : ''}`);
}

/**
 * Module specifiers that point into the renamed directory: `@/entities/old/x`, and `../old/x` from another
 * entity. Only `from '...'`, `import('...')`, `import '...'`, `require('...')`, `jest.mock('...')` and `vi.mock('...')` are rewritten; the same text
 * in a comment, a URL or any other string is left as it is.
 */
export function rewriteEntityImports(text: string, rename: EntityRename, fromEntities: boolean): string {
  const old = escapeRegExp(rename.oldSlug);
  const project = new RegExp(`(?<![A-Za-z0-9_-])entities/${old}(?=/|$)`);
  const sibling = new RegExp(`^((?:\\.\\./)+)${old}(?=/|$)`);
  return text.replace(/(\b(?:from|import|require|jest\.mock|vi\.mock)\s*\(?\s*)(['"`])([^'"`\n]+)\2/g, (all, lead: string, quote: string, specifier: string) => {
    const next = project.test(specifier)
      ? specifier.replace(project, `entities/${rename.newSlug}`)
      : fromEntities ? specifier.replace(sibling, `$1${rename.newSlug}`) : specifier;
    return next === specifier ? all : `${lead}${quote}${next}${quote}`;
  });
}

/** The entity key of a permissions config: `campaign_members: [` becomes `'campaign-members': [`. */
export function rewritePermissionKey(text: string, rename: EntityRename): string {
  return text.replace(new RegExp(`^([ \\t]*)(['"]?)${escapeRegExp(rename.oldSlug)}\\2(\\s*:\\s*\\[)`, 'gm'), `$1'${rename.newSlug}'$3`);
}

export interface AppliedRenames {
  /** Repository-relative paths (from the host root) of every file edited and directory renamed. */
  changed: string[];
}

const PERMISSIONS_CONFIG = /(?:^|[\\/])permissions\.config\.[cm]?[jt]s$/;

/** `slug:` or `'slug':` written as a key anywhere in the permissions config (comments aside), whatever follows it. */
const permissionKey = (text: string, slug: string) => new RegExp(`(?<![\\w-])['"]?${escapeRegExp(slug)}['"]?\\s*:`).test(maskSource(text, true));

/**
 * Rename the entity directories under `<hostRoot>/entities` and edit what the host cannot generate without:
 * the entity config (slug, tableName), the import specifiers that point into the directory and the entity key
 * of the permissions config. The old and new names go into `.renamed-from`. Everything else is in the report.
 * Every edit is read back: when the config does not say the new slug and the old table, or a permissions key
 * is not where it should be, every file and directory is put back and this throws.
 */
export function applyEntityRenames(hostRoot: string, renames: EntityRename[]): AppliedRenames {
  const changed: string[] = [];
  const rel = (path: string) => relative(hostRoot, path).split(sep).join('/');
  const entitiesRoot = join(hostRoot, 'entities');
  const originals = new Map<string, string>();
  const created: string[] = [];
  const moved: { from: string; to: string }[] = [];
  const write = (file: string, content: string) => {
    if (!originals.has(file)) originals.set(file, readFileSync(file, 'utf8'));
    writeFileSync(file, content);
  };
  const restore = () => {
    for (const [file, content] of originals) writeFileSync(file, content);
    for (const file of created) rmSync(file, { force: true });
    for (const { from, to } of [...moved].reverse()) renameSync(to, from);
  };
  try {
    for (const rename of renames) {
      const source = join(entitiesRoot, rename.name);
      const target = join(entitiesRoot, rename.newSlug);
      if (!existsSync(source)) throw new Error(`entities/${rename.name} is not there to rename`);
      if (existsSync(target)) throw new Error(`entities/${rename.newSlug} already exists`);
      renameSync(source, target);
      moved.push({ from: source, to: target });
      changed.push(`entities/${rename.name} -> entities/${rename.newSlug}`);
      const config = entityConfig(target);
      if (!config) throw new Error(`entities/${rename.newSlug} has no entity config with a literal slug`);
      write(config.file, rewriteEntityConfig(config.text, rename));
      changed.push(rel(config.file));
      const after = entityConfig(target);
      const table = after?.tableName.state === 'literal' ? after.tableName.value : after?.tableName.state === 'absent' ? rename.newSlug : null;
      if (after?.slug.state !== 'literal' || after.slug.value !== rename.newSlug || table !== rename.tableName) {
        throw new Error(`could not set slug '${rename.newSlug}' and tableName '${rename.tableName}' in ${rel(config.file)}; nothing was left changed`);
      }
      const marker = join(target, RENAMED_FROM_FILE);
      writeFileSync(marker, `${rename.oldSlug} -> ${rename.newSlug}\n`);
      created.push(marker);
      changed.push(rel(marker));
    }
    for (const file of sourceFiles(hostRoot)) {
      if (file.endsWith('.json')) continue;
      const before = readFileSync(file, 'utf8');
      let after = before;
      const inEntities = file.startsWith(`${entitiesRoot}${sep}`);
      const isPermissions = PERMISSIONS_CONFIG.test(file);
      for (const rename of renames) {
        after = rewriteEntityImports(after, rename, inEntities);
        if (isPermissions) after = rewritePermissionKey(after, rename);
      }
      if (after !== before) {
        write(file, after);
        changed.push(rel(file));
      }
      if (isPermissions) {
        const text = readFileSync(file, 'utf8');
        for (const rename of renames) {
          if (permissionKey(text, rename.oldSlug) || (permissionKey(before, rename.oldSlug) && !permissionKey(text, rename.newSlug))) {
            throw new Error(`could not rename the "${rename.oldSlug}" key of ${rel(file)}; nothing was left changed`);
          }
        }
      }
    }
  } catch (error) {
    restore();
    throw error;
  }
  return { changed: [...new Set(changed)] };
}

interface Occurrence {
  file: string;
  line: number;
}

function occurrences(hostRoot: string, files: string[], pattern: RegExp, skip: (file: string) => boolean = () => false): Occurrence[] {
  const found: Occurrence[] = [];
  for (const file of files) {
    if (skip(file)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (pattern.test(text)) found.push({ file: relative(hostRoot, file).split(sep).join('/'), line: index + 1 });
    });
  }
  return found;
}

const where = (items: Occurrence[]): string[] => items.length === 0
  ? ['none found in the project source']
  : [...items.slice(0, LISTED_AT_MOST).map(item => `${item.file}:${item.line}`), ...(items.length > LISTED_AT_MOST ? [`... and ${items.length - LISTED_AT_MOST} more`] : [])];

/** The API-key rewrite, printed and never run: scopes are `<slug>:read`, `<slug>:write` and `<slug>:delete`, compared exactly. */
export function apiKeyScopesSql(rename: EntityRename): string[] {
  const scopes = ['read', 'write', 'delete'].map(action => [`${rename.oldSlug}:${action}`, `${rename.newSlug}:${action}`]);
  return [
    'UPDATE "api_key"',
    `SET scopes = ${scopes.map(() => 'array_replace(').join('')}scopes,`,
    ...scopes.map(([from, to], index) => `  '${from}', '${to}')${index < scopes.length - 1 ? ',' : ''}`),
    `WHERE scopes && ARRAY[${scopes.map(([from]) => `'${from}'`).join(', ')}];`,
  ];
}

/** The old `/api/v1/<old>` URL kept for one release, with a deprecation notice: a manual step (it edits next.config). */
export function urlAliasSnippet(rename: EntityRename): string[] {
  const from = `/api/v1/${rename.oldSlug}`;
  const to = `/api/v1/${rename.newSlug}`;
  return [
    '// next.config: keep the old URL for one release, then delete this',
    'async rewrites() {',
    `  return [{ source: '${from}', destination: '${to}' }, { source: '${from}/:path*', destination: '${to}/:path*' }]`,
    '},',
    'async headers() {',
    `  return [{ source: '${from}/:path*', headers: [{ key: 'Deprecation', value: 'true' }, { key: 'Link', value: '<${to}>; rel="successor-version"' }] }]`,
    '},',
  ];
}

/**
 * What a project updates after the rename, as report sections. Works before the move (the theme's files are
 * under the host root) and after. `applied` says whether the permission key and the imports are already
 * rewritten (a dry run says what would be).
 */
export function entityRenameReport(hostRoot: string, plan: EntitySlugPlan, applied: boolean): ReportSection[] {
  const files = sourceFiles(hostRoot);
  const inEntity = (rename: EntityRename) => (file: string) => file.includes(`${sep}entities${sep}${rename.name}${sep}`) || file.includes(`${sep}entities${sep}${rename.newSlug}${sep}`) || file.includes(`${sep}migrations${sep}`);
  const sections: ReportSection[] = [];
  const tables: string[] = [];
  const permissions: string[] = [];
  const keys: string[] = [];
  const urls: string[] = [];
  const translations: string[] = [];
  const migrations: string[] = [];
  for (const rename of plan.renames) {
    const { oldSlug, newSlug } = rename;
    const token = escapeRegExp(oldSlug);
    tables.push(`${oldSlug} -> ${newSlug}: tableName ${rename.setsTableName ? `set to '${rename.tableName}' in the config, so the SQL table and its ${rename.tableName}_metas do not change` : `was already '${rename.tableName}' and is kept`}`);
    const actions = permissionActions(files, oldSlug);
    permissions.push(
      `${oldSlug} -> ${newSlug}: the "entities" key in the permissions config ${applied ? 'was renamed' : 'will be renamed'}; the permissions it grants are now ${actions.length ? actions.map(action => `${newSlug}.${action}`).join(', ') : `${newSlug}.<action>`} (were ${oldSlug}.<action>)`,
      `  code that checks them by string, update by hand: ${where(occurrences(hostRoot, files, new RegExp(`['"\`]${token}\\.[a-z][\\w-]*['"\`]`), inEntity(rename))).join('; ')}`,
    );
    keys.push(`-- ${oldSlug} -> ${newSlug}: keys whose stored scopes name the old slug stop matching (scopes are compared exactly; a key with * is unaffected). Review, then run it yourself:`, ...apiKeyScopesSql(rename), '');
    urls.push(
      `${oldSlug} -> ${newSlug}: /api/v1/${oldSlug} is now /api/v1/${newSlug}, /dashboard/${oldSlug} is now /dashboard/${newSlug}`,
      `  callers in the project source: ${where(occurrences(hostRoot, files, new RegExp(`/(?:api/v1|dashboard)/${token}(?![\\w-])`), inEntity(rename))).join('; ')}`,
      '  There is no alias: add one by hand only if clients you cannot update still call the old URL (and run the SQL above, or the old keys fail on the new scope):',
      ...urlAliasSnippet(rename).map(line => `    ${line}`),
    );
    translations.push(
      `${oldSlug} -> ${newSlug}: the entity's i18n namespace is its directory name; its own messages/ moved with it`,
      `  useTranslations/getTranslations of the old namespace: ${where(occurrences(hostRoot, files, new RegExp(`(?:useTranslations|getTranslations|useEntityTranslations)\\(\\s*['"]${token}['"]`), inEntity(rename))).join('; ')}`,
      `  keys for it in the project's other message files (a top-level "${oldSlug}" key): ${where(messageKeys(hostRoot, files, oldSlug)).join('; ')}`,
    );
    migrations.push(`${oldSlug} -> ${newSlug}: entities/${newSlug}/${RENAMED_FROM_FILE} names the old entity, so pnpm db:migrate records its already-applied migrations for the new name instead of running them again (it prints one line per migration; check that no CREATE ran)`);
  }
  migrations.push(
    'On a core older than this release, re-key the rows yourself before the next pnpm db:migrate (take a backup first; run it yourself):',
    ...plan.renames.map(rename => `  UPDATE "_entity_migrations" SET entity_name = '${rename.newSlug}' WHERE entity_name = '${rename.oldSlug}';`),
    'To go back after pnpm db:migrate has moved the rows (printed only, never run; take a backup first), and put the directory name back too:',
    ...plan.renames.map(rename => `  UPDATE "_entity_migrations" SET entity_name = '${rename.oldSlug}' WHERE entity_name = '${rename.newSlug}' AND source_type = 'project';`),
  );
  sections.push({ title: 'Entity slugs renamed to hyphens', lines: tables });
  sections.push({ title: 'Permission keys', lines: permissions });
  sections.push({ title: 'API keys (SQL printed, never run)', lines: keys });
  sections.push({ title: 'URLs', lines: urls });
  sections.push({ title: 'Translations', lines: translations });
  sections.push({ title: 'Entity migrations', lines: migrations });
  return sections;
}

function permissionActions(files: string[], slug: string): string[] {
  const actions = new Set<string>();
  for (const file of files.filter(path => /permissions\.config\.[cm]?[jt]s$/.test(path))) {
    const text = readFileSync(file, 'utf8');
    const block = new RegExp(`^[ \\t]*['"]?${escapeRegExp(slug)}['"]?\\s*:\\s*\\[([\\s\\S]*?)\\n[ \\t]*\\]`, 'm').exec(text)?.[1] ?? '';
    for (const match of block.matchAll(/\baction\s*:\s*['"]([\w-]+)['"]/g)) actions.add(match[1]);
  }
  return [...actions];
}

function messageKeys(hostRoot: string, files: string[], slug: string): Occurrence[] {
  const found: Occurrence[] = [];
  for (const file of files) {
    if (!file.endsWith('.json') || !/[\\/]messages[\\/][^\\/]+\.json$/.test(file)) continue;
    if (file.includes(`${sep}entities${sep}`)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && slug in parsed) found.push({ file: relative(hostRoot, file).split(sep).join('/'), line: 1 });
    } catch {
      // not JSON we can read: nothing to report from it
    }
  }
  return found;
}

/** The directories a rollback has to clean: what the rename created next to the ones git restores. */
export function renamedDirectories(plan: EntitySlugPlan): string[] {
  return plan.renames.map(rename => `entities/${rename.newSlug}`);
}
