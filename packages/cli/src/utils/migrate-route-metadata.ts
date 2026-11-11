import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { assertContained } from './app-tree.js';

/**
 * The metadata-only overrides of a 0.x project (#431).
 *
 * A 0.x theme could set the title and description of a route without a component: `templates/layout.meta.ts` for the
 * root layout, `templates/(auth)/layout.meta.ts` for a group, `page.meta.ts` for a page. The template registry read those
 * files, and a `.meta.ts` next to a `layout.tsx` took precedence over the metadata that file exported. The generated host
 * reads none of them: a route's metadata is what its route file exports. A migrated project therefore showed the default
 * title until someone wrote that file by hand, and migrate did not say so.
 *
 * Only the root one has a safe equivalent. The root layout is composed, never replaced (core's providers stay around the
 * project's `templates/layout.tsx`), so a layout that re-exports the metadata and renders its children is the same page as
 * 0.x had. A group layout or a page override replaces core's UI for the route, so for those (and for a `.meta.ts` that has
 * a route file beside it) the plan says exactly what to add and changes nothing.
 */
export interface RouteMetadataEntry {
  /** Where the file is after the migration, from the host root. */
  path: string;
  /** The route file it was for, without its extension: `layout`, `(auth)/layout`, `blog/page`. */
  route: string;
  /** The file migrate writes to carry it over (`templates/layout.tsx`), when it does. */
  carriedTo: string | null;
  /** The export the layout migrate writes re-exports, when it writes one. */
  reexports?: 'metadata' | 'generateMetadata';
  /** What to do by hand when migrate does not carry it over. */
  todo: string | null;
}

const ROUTE_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];
const META_FILE = /^(page|layout)\.meta\.ts$/;

/** The root layout migrate writes: core's root layout stays around it, so it only passes its children through. */
export function rootLayoutFromMetadata(name: 'metadata' | 'generateMetadata'): string {
  return `import type { ReactNode } from 'react'

// The title and description of every page, as templates/layout.meta.ts set them in 0.x.
export { ${name} } from './layout.meta'

// Core's root layout (providers, fonts, protections) renders around this layout, so it adds nothing of its own.
export default function RootTemplate({ children }: { children: ReactNode }) {
  return children
}
`;
}

export const ROOT_LAYOUT_FROM_METADATA = rootLayoutFromMetadata('metadata');

/** Which metadata export a `.meta.ts` declares: the layout can only re-export a name the file has. */
export function declaredMetadataExport(source: string | null): 'metadata' | 'generateMetadata' | null {
  if (source === null) return null;
  for (const name of ['metadata', 'generateMetadata'] as const) {
    if (new RegExp(`\\bexport\\s+(?:const|let|var|function|async\\s+function)\\s+${name}\\b`).test(source)) return name;
  }
  return null;
}

/**
 * @param hostRoot the host root
 * @param finalTemplates every file that is under templates/ once the migration is done (there now, moved, or converted)
 * @param fromTheme the files of that set that this run moves out of a 0.x theme, with where each one is now
 */
export function planRouteMetadata(hostRoot: string, finalTemplates: ReadonlySet<string>, fromTheme: ReadonlyMap<string, string>): RouteMetadataEntry[] {
  const templatesRoot = join(hostRoot, 'templates');
  const entries: RouteMetadataEntry[] = [];
  for (const file of [...finalTemplates].sort()) {
    const inside = relative(templatesRoot, file);
    if (inside === '' || inside.startsWith('..') || inside.split(sep).includes('node_modules')) continue;
    const at = inside.split(sep).join('/');
    const name = posix.basename(at);
    const kind = META_FILE.exec(name)?.[1];
    if (!kind) continue;
    const directory = posix.dirname(at);
    const route = directory === '.' ? kind : `${directory}/${kind}`;
    const path = `templates/${at}`;
    const companion = ROUTE_EXTENSIONS.map(extension => `${directory === '.' ? '' : `${directory}/`}${kind}.${extension}`).find(candidate => finalTemplates.has(join(templatesRoot, ...candidate.split('/'))));
    const reexport = `export { metadata } from './${kind}.meta'`;
    const unread = `${path} is not read by the generated host, which takes a route's metadata from the route file itself`;
    if (companion) {
      entries.push({
        path, route, carriedTo: null,
        todo: `${unread}, and in 0.x it took precedence over a metadata export of templates/${companion}. Add  ${reexport}  to templates/${companion} and delete any other metadata export in it.`,
      });
    } else if (route === 'layout') {
      const source = fromTheme.get(file);
      let declared: ReturnType<typeof declaredMetadataExport> = null;
      if (source !== undefined) {
        try {
          declared = declaredMetadataExport(readFileSync(source, 'utf8'));
        } catch {
          declared = null;
        }
      }
      if (source !== undefined && declared) entries.push({ path, route, carriedTo: 'templates/layout.tsx', reexports: declared, todo: null });
      else if (source !== undefined) entries.push({ path, route, carriedTo: null, todo: `${unread}, and it exports no metadata or generateMetadata (declared with export const, let, var or function), so migrate does not write a layout that re-exports it. Move what it holds into a metadata export of templates/layout.tsx (a default export that returns its children, rendered inside core's root layout).` });
      else entries.push({ path, route, carriedTo: null, todo: `${unread}. Create templates/layout.tsx with  ${reexport}  and a default export that returns its children (it renders inside core's root layout).` });
    } else {
      entries.push({
        path, route, carriedTo: null,
        todo: `${unread}. Core's ${route} keeps its own metadata; to change it, override the route in templates/${route}.tsx and export the metadata there (${reexport} keeps this file).`,
      });
    }
  }
  return entries;
}

/** Write `templates/layout.tsx` for the root `layout.meta.ts` that moved. Never overwrites. */
export function writeRootLayoutFromMetadata(hostRoot: string, name: 'metadata' | 'generateMetadata' = 'metadata'): void {
  const target = join(hostRoot, 'templates', 'layout.tsx');
  if (ROUTE_EXTENSIONS.some(extension => existsSync(join(hostRoot, 'templates', `layout.${extension}`)))) {
    throw new Error('Refusing to overwrite templates/layout.tsx');
  }
  assertContained(hostRoot, target);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, rootLayoutFromMetadata(name));
}
