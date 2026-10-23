/**
 * The dependencies a project declares that are below what the @nextsparkjs/core it just
 * installed needs. update-core raises the ones that cannot sit next to a second copy (see
 * floorsToRaise) and lists the rest, with the `pnpm add` that moves them.
 */

/** Packages that cannot sit next to a second copy of themselves, raised besides core's peer dependencies. */
const RAISED_ALWAYS = ['better-auth', 'zod']

const SCOPE = '@nextsparkjs/'
const PROJECT_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies']
const CORE_FIELDS = ['dependencies', 'peerDependencies']

/**
 * The project's declared ranges (`manifest`) whose lowest version is below the lowest version
 * of the range core (`coreManifest`) declares for the same package, as
 * `{ name, field, declared, required }`. A spec that is not a semver range (a protocol, a path,
 * a tag) on either side is not compared; neither are the @nextsparkjs packages, which
 * update-core pins itself. `semver` is the semver package.
 */
export function dependenciesBelowCore(manifest, coreManifest, semver) {
  const lowest = (range) => (semver.validRange(range) ? semver.minVersion(range) : null)
  const below = []
  for (const field of CORE_FIELDS) {
    for (const [name, required] of Object.entries(coreManifest?.[field] ?? {})) {
      if (name.startsWith(SCOPE) || below.some((entry) => entry.name === name)) continue
      const projectField = PROJECT_FIELDS.find((candidate) => manifest?.[candidate]?.[name] !== undefined)
      if (!projectField) continue
      const declared = manifest[projectField][name]
      const declaredLowest = lowest(declared)
      const requiredLowest = lowest(required)
      if (declaredLowest && requiredLowest && semver.lt(declaredLowest, requiredLowest)) {
        below.push({ name, field: projectField, declared, required })
      }
    }
  }
  return below.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The entries of `below` update-core writes by default: core's peer dependencies (next, react,
 * react-dom and the optional ones the project declares) and RAISED_ALWAYS. The rest is only listed:
 * core uses its own copy of them, so a project's major version is its own to change.
 */
export function floorsToRaise(below, coreManifest) {
  return below.filter(({ name }) => RAISED_ALWAYS.includes(name) || coreManifest?.peerDependencies?.[name] !== undefined)
}

/** The `pnpm add` lines for these entries: one for dependencies, and one each with -D for devDependencies and -O for optionalDependencies. */
export function addCommands(below) {
  const word = ({ name, required }) => `'${`${name}@${required}`.replace(/'/g, "'\\''")}'`
  const line = (entries, flag = '') => `pnpm add${flag} ${entries.map(word).join(' ')}`
  const of = (field) => below.filter((entry) => entry.field === field)
  return [
    ...(of('dependencies').length > 0 ? [line(of('dependencies'))] : []),
    ...(of('devDependencies').length > 0 ? [line(of('devDependencies'), ' -D')] : []),
    ...(of('optionalDependencies').length > 0 ? [line(of('optionalDependencies'), ' -O')] : []),
  ]
}
