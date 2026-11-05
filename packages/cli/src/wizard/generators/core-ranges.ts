/**
 * The ranges @nextsparkjs/core declares, for the dependencies a new project shares with it.
 * Core is installed before the wizard writes package.json (create-nextspark-app and `nextspark
 * init` both need its templates), so its package.json sits next to the templates directory; in
 * the monorepo the templates fallback finds the workspace copy.
 */
import fs from 'fs-extra'
import path from 'path'
import semver from 'semver'

/** Where core declares what it needs: update-core compares a project against these two fields. */
const CORE_FIELDS = ['dependencies', 'peerDependencies'] as const

/**
 * `own` unless core declares `name` with a range whose lowest version is higher or equal (or `own`
 * is not a range): then core's, so a new project never starts below core. A vetted floor of the
 * wizard that is higher than core's stays.
 */
export function rangeFromCore(name: string, own: string, core: Record<string, Record<string, string> | undefined>): string {
  for (const field of CORE_FIELDS) {
    const theirs = core[field]?.[name]
    if (!theirs || !semver.validRange(theirs)) continue
    if (!semver.validRange(own) || semver.minVersion(own)!.compare(semver.minVersion(theirs)!) <= 0) return theirs
    return own
  }
  return own
}

/** core's package.json, from the templates directory it ships (`<core>/templates`). */
export function readCoreManifest(templatesDir: string): Record<string, Record<string, string> | undefined> {
  try {
    return fs.readJsonSync(path.resolve(templatesDir, '..', 'package.json'))
  } catch {
    return {}
  }
}
