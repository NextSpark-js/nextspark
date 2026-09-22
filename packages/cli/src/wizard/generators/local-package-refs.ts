/**
 * A project's package.json can pin an `@nextsparkjs/*` package to an explicit
 * local reference -- `file:`, `link:` or `workspace:` -- instead of a version
 * create-nextspark-app or the wizard would otherwise resolve from the
 * registry. create-nextspark-app's src/create.ts writes one for
 * `@nextsparkjs/testing` when a version-matched local tarball sits alongside
 * locally-tarballed core/cli (so a mid-development, unpublished version
 * resolves from disk instead of failing against the registry), and the
 * /do:test-package validation flow can install one by hand before `nextspark
 * init` runs.
 *
 * Shared by index.ts (which must never clobber one back to a registry pin)
 * and monorepo-generator.ts (which must carry one from the root package.json
 * create-nextspark-app wrote into web/package.json, since the monorepo
 * generator replaces the root file and the wizard writes web/package.json as
 * a separate, brand new file).
 */
import path from 'path'

/**
 * True when a package.json dependency spec is an explicit local reference
 * (`file:`, `link:`, or `workspace:`) rather than something pnpm/npm resolved
 * from a registry. Used to protect a deliberately-local `@nextsparkjs/*`
 * install from being silently repinned to a published version.
 */
export function isLocalPackageRef(spec: string | undefined): boolean {
  return typeof spec === 'string' && /^(file:|link:|workspace:)/.test(spec)
}

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies'] as const
type DependencyField = (typeof DEPENDENCY_FIELDS)[number]

export interface LocalNextSparkRef {
  name: string
  field: DependencyField
  spec: string
}

interface ManifestLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

/**
 * Every `@nextsparkjs/*` dependency or devDependency in `manifest` whose spec
 * is an explicit local reference, together with which field it came from.
 */
export function extractLocalNextSparkRefs(manifest: ManifestLike): LocalNextSparkRef[] {
  const refs: LocalNextSparkRef[] = []
  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(manifest[field] ?? {})) {
      if (name.startsWith('@nextsparkjs/') && isLocalPackageRef(spec)) {
        refs.push({ name, field, spec })
      }
    }
  }
  return refs
}

/**
 * Rewrites a `file:`/`link:` spec's relative path so it still points at the
 * same file or directory once the package.json declaring it moves from
 * `fromDir` to `toDir` (e.g. a monorepo's root to its web/ subdirectory). A
 * `workspace:*` spec carries no path and is returned unchanged.
 */
export function rehomeLocalRefSpec(spec: string, fromDir: string, toDir: string): string {
  const match = /^(file:|link:)(.+)$/.exec(spec)
  if (!match) return spec

  const [, protocol, relPath] = match
  const absolute = path.resolve(fromDir, relPath)
  const rewritten = path.relative(toDir, absolute).split(path.sep).join('/')
  return `${protocol}${rewritten}`
}
