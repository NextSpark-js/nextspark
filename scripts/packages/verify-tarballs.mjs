#!/usr/bin/env node
/**
 * verify-tarballs.mjs - Verify NextSpark .tgz packages are installable and safe
 *
 * Implements release gate G3 ("Installable, reproducible distribution") for
 * the tarballs scripts/packages/pack.sh produces:
 *
 *   1. Every path `main`, `module`, `types`, `bin` and every `exports`
 *      condition/subpath points at actually exists inside the tarball.
 *      Wildcard subpaths (`./lib/*`) are expanded: the target directory must
 *      exist and at least one file must match the target pattern.
 *   2. `workspace:`, `link:` and `file:` protocols do not survive in
 *      dependencies/devDependencies/peerDependencies/optionalDependencies of
 *      the packed package.json, and internal @nextsparkjs/* runtime
 *      dependencies point at the version being packed in this same run. A
 *      runtime dependency spec this script cannot parse down to one exact
 *      version (a "||" union, a hyphen range, "*", a dist-tag) is a finding
 *      too, not a silent skip - it could hide real drift just as easily.
 *   3. No maintainer-local absolute path, stray .env file, or
 *      private-key/credential-looking material ships in the tarball, in
 *      either file content OR file/directory paths themselves. Binary files
 *      are still checked for a key-like filename (id_rsa, *.pem, *.key, ...)
 *      and for DER-encoded key material by byte signature. Every reported
 *      message is redacted before it is ever assembled - this script never
 *      prints a secret or maintainer path, even inside an example path.
 *   4. Tarball size and file count are reported per package.
 *   5. With --expect-all, every publishable package under repository-root
 *      packages/* and plugins/* must have a tarball in the verified set.
 *
 * A committed, explicit allowlist (see ALLOWLIST) can suppress a specific,
 * justified finding. Every entry requires a `reason` string; there is no
 * glob or wildcard matching - entries compare equal by exact string against
 * a finding's own identity key, so an entry only ever silences the one
 * finding it names.
 *
 * Usage:
 *   node scripts/packages/verify-tarballs.mjs [dir] [--allowlist <path>] [--expect-all]
 *
 *   dir          Directory of .tgz files to verify (default: <repo>/.packages)
 *   --allowlist  Path to the allowlist JSON file
 *                (default: scripts/packages/verify-tarballs.allowlist.json)
 *
 * Exit codes:
 *   0: every package passed (after the allowlist is applied)
 *   1: at least one finding remains, no tarballs were found, or the
 *      allowlist/tarball directory could not be read
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const SCRIPT_DIR = join(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_OUTPUT_DIR = join(REPO_ROOT, '.packages')
const DEFAULT_ALLOWLIST = join(SCRIPT_DIR, 'verify-tarballs.allowlist.json')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const NC = '\x1b[0m'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export function parseArgs(argv) {
  let dir
  let allowlistPath = DEFAULT_ALLOWLIST
  let expectAll = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') {
      continue
    } else if (arg === '--allowlist') {
      allowlistPath = argv[++i]
      if (!allowlistPath) throw new Error('--allowlist requires a path')
    } else if (arg === '--expect-all') {
      expectAll = true
    } else if (arg === '-h' || arg === '--help') {
      return { help: true }
    } else if (!dir) {
      dir = arg
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return { dir: dir ? resolvePath(dir) : DEFAULT_OUTPUT_DIR, allowlistPath: resolvePath(allowlistPath), expectAll }
}

function resolvePath(p) {
  return p.startsWith('/') ? p : join(process.cwd(), p)
}

// ---------------------------------------------------------------------------
// Allowlist
// ---------------------------------------------------------------------------

/**
 * Loads and validates the allowlist. Every entry must name an exact
 * `package`, `type` and `match` (a finding's `matchKey`, compared with
 * strict string equality - never as a glob or regex) plus a non-empty
 * `reason`. A malformed entry fails the whole run rather than being
 * silently ignored, so a bad edit cannot quietly widen what is allowed.
 */
export function loadAllowlist(path) {
  if (!existsSync(path)) return []
  let raw
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Could not parse allowlist ${path}: ${error.message}`)
  }
  if (!Array.isArray(raw)) throw new Error(`Allowlist ${path} must be a JSON array`)

  const REQUIRED = ['package', 'type', 'match', 'reason']
  raw.forEach((entry, index) => {
    for (const field of REQUIRED) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim().length === 0) {
        throw new Error(`Allowlist ${path} entry ${index} is missing a non-empty "${field}"`)
      }
    }
    const extra = Object.keys(entry).filter((key) => !REQUIRED.includes(key))
    if (extra.length > 0) {
      throw new Error(`Allowlist ${path} entry ${index} has unexpected field(s): ${extra.join(', ')}`)
    }
  })
  return raw
}

function isAllowlisted(finding, allowlist) {
  return allowlist.find(
    (entry) => entry.package === finding.package && entry.type === finding.type && entry.match === finding.matchKey,
  )
}

// ---------------------------------------------------------------------------
// Tarball extraction
// ---------------------------------------------------------------------------

function listTarballs(dir) {
  if (!existsSync(dir)) throw new Error(`Directory not found: ${dir}`)
  return readdirSync(dir)
    .filter((name) => name.endsWith('.tgz'))
    .sort()
    .map((name) => join(dir, name))
}

function extractTarball(tgzPath) {
  const dest = mkdtempSync(join(tmpdir(), 'verify-tarballs-'))
  const result = spawnSync('tar', ['xzf', tgzPath, '-C', dest], { encoding: 'utf8' })
  if (result.status !== 0) {
    rmSync(dest, { recursive: true, force: true })
    throw new Error(`Failed to extract ${tgzPath}: ${result.stderr || result.stdout}`)
  }
  const pkgRoot = join(dest, 'package')
  if (!existsSync(pkgRoot)) {
    rmSync(dest, { recursive: true, force: true })
    throw new Error(`${tgzPath} has no top-level "package/" directory`)
  }
  return { tmpDir: dest, pkgRoot }
}

function walkFiles(root) {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile()) files.push(relative(root, abs).split(sep).join('/'))
    }
  }
  walk(root)
  return files
}

// ---------------------------------------------------------------------------
// Finding helpers
// ---------------------------------------------------------------------------

function makeFinding({ pkgName, tarball, type, message, file = null, line = null, matchKey }) {
  return { package: pkgName, tarball, type, message, file, line, matchKey }
}

function maskPath(match) {
  // Keep enough to show *which kind* of local path leaked without shipping
  // the maintainer's username/handle in the report.
  const parts = match.split('/')
  return `${parts.slice(0, 2).join('/')}/[redacted]`
}

function maskWindowsPath(match) {
  const parts = match.split('\\')
  return `${parts.slice(0, 2).join('\\')}\\[redacted]`
}

function maskSecret(match) {
  if (match.length <= 8) return '*'.repeat(match.length)
  return `${match.slice(0, 4)}${'*'.repeat(6)}(${match.length} chars)`
}

// ---------------------------------------------------------------------------
// Entry point / exports checks
// ---------------------------------------------------------------------------

function targetPathOf(pattern) {
  return pattern.startsWith('./') ? pattern.slice(2) : pattern.replace(/^\//, '')
}

function wildcardDir(relTarget) {
  const starIdx = relTarget.indexOf('*')
  const prefix = relTarget.slice(0, starIdx)
  if (prefix.endsWith('/')) return prefix.slice(0, -1)
  const lastSlash = prefix.lastIndexOf('/')
  return lastSlash === -1 ? '' : prefix.slice(0, lastSlash)
}

function wildcardRegex(relTarget) {
  const escaped = relTarget.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '(.*)')
  return new RegExp(`^${escaped}$`)
}

/**
 * Checks one exports/main/module/types/bin target. `pattern` is the raw
 * string from package.json (may contain a `*` wildcard). Pushes a finding
 * via `report` (already scoped to package/tarball) when the target - or, for
 * a wildcard, at least one matching file - is missing.
 */
function checkTarget(pattern, fileSet, report, { type, matchKey, label }) {
  if (typeof pattern !== 'string') return
  const relTarget = targetPathOf(pattern)
  if (relTarget.includes('*')) {
    const dir = wildcardDir(relTarget)
    const dirExists = dir === '' || fileSet.some((f) => f === dir || f.startsWith(`${dir}/`))
    if (!dirExists) {
      report({
        type,
        matchKey,
        message: `${label} target directory "${dir}" does not exist for pattern "${pattern}"`,
      })
      return
    }
    const regex = wildcardRegex(relTarget)
    const matched = fileSet.some((f) => regex.test(f))
    if (!matched) {
      report({
        type,
        matchKey,
        message: `${label} pattern "${pattern}" matched no files under "${dir}"`,
      })
    }
  } else if (!fileSet.includes(relTarget)) {
    report({ type, matchKey, message: `${label} target "${pattern}" does not exist in the tarball` })
  }
}

/** Recursively walks an `exports` map, distinguishing subpaths (keys that
 * start with ".") from conditions (keys that do not), the same rule Node
 * uses to resolve package exports. */
function walkExports(node, subpath, conditionPath, fileSet, report) {
  if (typeof node === 'string') {
    const conditions = conditionPath.length > 0 ? conditionPath.join('.') : 'default'
    checkTarget(node, fileSet, report, {
      type: 'exports-target-missing',
      matchKey: `exports:${subpath}:${conditions}`,
      label: `exports["${subpath}"]${conditionPath.length ? ` (${conditions})` : ''}`,
    })
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkExports(item, subpath, conditionPath, fileSet, report)
    return
  }
  if (node === null || typeof node !== 'object') return

  const keys = Object.keys(node)
  const isSubpathMap = keys.some((k) => k.startsWith('.'))
  for (const key of keys) {
    if (isSubpathMap) {
      walkExports(node[key], key, [], fileSet, report)
    } else {
      walkExports(node[key], subpath, [...conditionPath, key], fileSet, report)
    }
  }
}

function checkEntryPoints(pkgJson, fileSet, report) {
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof pkgJson[field] === 'string') {
      checkTarget(pkgJson[field], fileSet, report, {
        type: 'entrypoint-missing',
        matchKey: `entrypoint:${field}`,
        label: field,
      })
    }
  }
  if (pkgJson.bin) {
    if (typeof pkgJson.bin === 'string') {
      checkTarget(pkgJson.bin, fileSet, report, {
        type: 'entrypoint-missing',
        matchKey: `bin:${pkgJson.name}`,
        label: 'bin',
      })
    } else if (typeof pkgJson.bin === 'object') {
      for (const [name, target] of Object.entries(pkgJson.bin)) {
        checkTarget(target, fileSet, report, {
          type: 'entrypoint-missing',
          matchKey: `bin:${name}`,
          label: `bin["${name}"]`,
        })
      }
    }
  }
  if (pkgJson.exports) {
    walkExports(pkgJson.exports, '.', [], fileSet, report)
  }
}

// ---------------------------------------------------------------------------
// Dependency checks
// ---------------------------------------------------------------------------

const BAD_PROTOCOLS = ['workspace:', 'link:', 'file:']
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']

function checkDependencyProtocols(pkgJson, report) {
  for (const field of DEP_FIELDS) {
    const deps = pkgJson[field]
    if (!deps || typeof deps !== 'object') continue
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== 'string') continue
      const badProtocol = BAD_PROTOCOLS.find((p) => spec.startsWith(p))
      if (badProtocol) {
        report({
          type: 'dependency-protocol',
          matchKey: `dep-protocol:${field}:${name}`,
          message: `${field}["${name}"] = "${spec}" still uses the unresolved "${badProtocol}" protocol`,
        })
      }
    }
  }
}

/**
 * Classifies an internal @nextsparkjs/* runtime dependency spec. Only a spec
 * that reduces to one exact version - optionally behind a single leading
 * range operator (^, ~, >=, ...) - can be compared against "the version
 * being packed in this run". A "||" union, a hyphen range, "*", or a
 * dist-tag (latest, next, beta, ...) does not reduce to one version, so it
 * is reported as unparseable rather than silently skipped: a union like
 * "^0.1.0-beta.191 || ^9.0.0" could just as easily be masking real drift as
 * a legitimate compatibility range, and this checker cannot tell which
 * without a human decision.
 */
function classifySpec(spec) {
  const trimmed = spec.trim()
  const match = trimmed.match(/^(\^|~|>=|<=|>|<|=)?(\d[\w.+-]*)$/)
  if (match) return { version: match[2] }
  return { unparseable: true }
}

/**
 * `dependencies` on other @nextsparkjs/* packages should point at the exact
 * version being packed in this run (peerDependencies intentionally use
 * broad ranges like ">=0.1.0-0" across betas and are not checked here).
 * Packages not included in this run's `versionMap` cannot be verified and
 * are skipped rather than flagged.
 */
function checkInternalVersions(pkgJson, versionMap, report) {
  const deps = pkgJson.dependencies
  if (!deps || typeof deps !== 'object') return
  for (const [name, spec] of Object.entries(deps)) {
    if (!name.startsWith('@nextsparkjs/')) continue
    const targetVersion = versionMap.get(name)
    if (!targetVersion) continue // not packed in this run - nothing to compare against
    const classified = classifySpec(spec)
    if (classified.unparseable) {
      report({
        type: 'internal-version-unparseable',
        matchKey: `dep-version:dependencies:${name}`,
        message: `dependencies["${name}"] = "${spec}" is not a single pinned version/range this checker can verify against ${name}@${targetVersion}, the version packed in this run (a union, wildcard or dist-tag) - pin it to one version or allowlist it with a reason`,
      })
      continue
    }
    if (classified.version !== targetVersion) {
      report({
        type: 'internal-version-mismatch',
        matchKey: `dep-version:dependencies:${name}`,
        message: `dependencies["${name}"] = "${spec}" does not point at ${name}@${targetVersion}, the version packed in this run`,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Content scanning (maintainer paths, .env files, secrets, generated caches)
// ---------------------------------------------------------------------------

const SECRET_RULES = [
  { type: 'maintainer-path-unix', label: 'Maintainer-local /Users path', regex: /\/Users\/[^\s"'`)]+/g, mask: maskPath },
  {
    // Requires a further path segment after the account name so an app
    // route like "/home/dashboard" does not trip this.
    type: 'maintainer-path-home',
    label: 'Maintainer-local /home path',
    regex: /\/home\/[a-zA-Z0-9_.-]{2,}\/[^\s"'`)]+/g,
    mask: maskPath,
  },
  { type: 'maintainer-path-windows', label: 'Maintainer-local Windows path', regex: /C:\\Users\\[^\s"'`)]+/g, mask: maskWindowsPath },
  {
    type: 'secret-pem',
    label: 'PEM private key header',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g,
    mask: maskSecret,
  },
  { type: 'secret-resend', label: 'Resend-style API key', regex: /\bre_[A-Za-z0-9_]{20,}\b/g, mask: maskSecret },
  {
    type: 'secret-aws',
    label: 'AWS access key id',
    regex: /\b(?:AKIA|ASIA|AGPA|AROA|AIDA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g,
    mask: maskSecret,
  },
  { type: 'secret-github', label: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, mask: maskSecret },
]

/**
 * Redacts every SECRET_RULES match in `text` before it is ever assembled
 * into a finding message, so no code path - present or future - can print a
 * raw secret or maintainer path, whether it came from file content, a file
 * path, or an example listed inside another finding's own message.
 */
function redact(text) {
  let result = text
  for (const rule of SECRET_RULES) {
    result = result.replace(rule.regex, (m) => rule.mask(m))
  }
  return result
}

function isProbablyBinary(buf) {
  return buf.subarray(0, 8000).includes(0)
}

/** Runs every SECRET_RULES pattern against a tarball-relative path itself
 * (not its content) - a secret can leak into a filename or directory name
 * just as easily as into a file's contents.
 *
 * Uses matchAll rather than a manual exec()/lastIndex loop: `report()`
 * calls `redact()` for every match, which itself replaces on these same
 * shared rule.regex objects - an exec() loop driven by the object's own
 * mutable `lastIndex` would have that index reset out from under it by the
 * nested redact() call and spin forever re-matching position 0. matchAll
 * clones the regex internally, so it has no externally-visible lastIndex
 * for a reentrant call to corrupt. */
function scanPathForSecrets(relPath, report) {
  for (const rule of SECRET_RULES) {
    for (const m of relPath.matchAll(rule.regex)) {
      report({
        type: rule.type,
        file: relPath,
        matchKey: `path:${relPath}:${rule.type}`,
        message: `${rule.label} in the tarball path ${relPath} - ${rule.mask(m[0])}`,
      })
    }
  }
}

const KEY_LIKE_FILENAME = /^id_(rsa|dsa|ecdsa|ed25519)$|\.(pem|p12|pfx|key|der)$/i

/**
 * DER-encoded key material has no PEM armor for the text scan below to
 * catch, and isProbablyBinary() would otherwise skip it wholesale. These are
 * the ASN.1 OID byte sequences (rsaEncryption, id-ecPublicKey) that appear
 * inside RSA/EC private and public keys regardless of the surrounding
 * structure - the same "magic bytes" secret scanners commonly look for in
 * binaries that have no readable header.
 */
const DER_KEY_MARKERS = [
  Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]), // rsaEncryption OID
  Buffer.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01]), // id-ecPublicKey OID
]

function bufferHasDerKeyMarker(buf) {
  return DER_KEY_MARKERS.some((marker) => buf.includes(marker))
}

/** Flags a private-key-like filename (independent of its content), and
 * binary content carrying a DER key marker - the two checks this script
 * still applies to a file isProbablyBinary() would otherwise skip entirely. */
function checkKeyLikeFile(relPath, buf, report) {
  const basename = relPath.split('/').pop() ?? relPath
  if (KEY_LIKE_FILENAME.test(basename)) {
    report({
      type: 'key-like-filename',
      file: relPath,
      matchKey: `keyfile:${relPath}`,
      message: `${relPath} has a private-key-like filename and should not ship`,
    })
  }
  if (buf && bufferHasDerKeyMarker(buf)) {
    report({
      type: 'secret-der-key',
      file: relPath,
      matchKey: `content:${relPath}:der-key`,
      message: `${relPath} contains DER-encoded key material (binary)`,
    })
  }
}

// See the comment on scanPathForSecrets for why matchAll, not a manual
// exec()/lastIndex loop, is required here: report() -> redact() replaces on
// these same shared regex objects mid-scan.
function scanFileContent(relPath, buf, report) {
  if (!buf || isProbablyBinary(buf)) return
  const lines = buf.toString('utf8').split(/\r\n|\r|\n/)
  lines.forEach((line, idx) => {
    for (const rule of SECRET_RULES) {
      for (const m of line.matchAll(rule.regex)) {
        report({
          type: rule.type,
          file: relPath,
          line: idx + 1,
          matchKey: `content:${relPath}:${idx + 1}:${rule.type}`,
          message: `${rule.label} in ${relPath}:${idx + 1} - ${rule.mask(m[0])}`,
        })
      }
    }
  })
}

const EXCLUDED_DIR_NAMES = new Map([
  ['.git', 'excluded-dir-git'],
  ['.cache', 'excluded-dir-cache'],
  ['.next', 'excluded-dir-next'],
  ['.nyc_output', 'excluded-dir-nyc-output'],
  ['.turbo', 'excluded-dir-turbo'],
  ['node_modules', 'excluded-dir-node-modules'],
  ['.nextspark', 'excluded-dir-nextspark'],
  ['coverage', 'excluded-dir-coverage'],
])

function scanFilePaths(fileSet, report) {
  const excludedHits = new Map() // type -> examples[]
  for (const relPath of fileSet) {
    const segments = relPath.split('/')
    const basename = segments[segments.length - 1]

    const isDotenv = /^\.env(\..+)?$/.test(basename)
    if (isDotenv && basename !== '.env.example') {
      report({
        type: 'dotenv-file',
        file: relPath,
        matchKey: `dotenv:${relPath}`,
        message: `${relPath} looks like an environment file (not .env.example)`,
      })
    }

    if (basename.endsWith('.tsbuildinfo')) {
      report({
        type: 'tsbuildinfo',
        file: relPath,
        matchKey: `tsbuildinfo:${relPath}`,
        message: `${relPath} is a TypeScript incremental build cache and should not ship`,
      })
    }

    for (const [dirName, type] of EXCLUDED_DIR_NAMES) {
      if (segments.includes(dirName)) {
        const list = excludedHits.get(type) ?? []
        if (list.length < 3) list.push(relPath)
        excludedHits.set(type, list)
      }
    }
  }
  for (const [type, examples] of excludedHits) {
    report({
      type,
      matchKey: `excluded-dir:${type}`,
      message: `${type.replace('excluded-dir-', '')} directory ships in the tarball, e.g. ${examples.join(', ')}`,
    })
  }
}

// ---------------------------------------------------------------------------
// Per-package verification
// ---------------------------------------------------------------------------

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(1)} ${units[unit]}`
}

function readPackedVersion(tgzPath) {
  const result = spawnSync('tar', ['xzOf', tgzPath, 'package/package.json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (result.status !== 0) return null
  try {
    const pkg = JSON.parse(result.stdout)
    return { name: pkg.name, version: pkg.version }
  } catch {
    return null
  }
}

export function expectedPublishedPackageNames(repoRoot = REPO_ROOT) {
  return ['packages', 'plugins'].flatMap((parent) => {
    const root = join(repoRoot, parent)
    if (!existsSync(root)) return []
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) return []
      const manifestPath = join(root, entry.name, 'package.json')
      if (!existsSync(manifestPath)) return []
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      return manifest.private === true || typeof manifest.name !== 'string' ? [] : [manifest.name]
    })
  }).sort()
}

/**
 * Returns publishable package manifests that do not use a non-empty `files`
 * allowlist.  Keep this separate from tarball inspection: package managers
 * always include a few metadata files, so inspecting a clean tarball cannot
 * prove that a local scratch file would be excluded on a maintainer's machine.
 */
export function publishablePackagesMissingFiles(repoRoot = REPO_ROOT) {
  return ['packages', 'plugins'].flatMap((parent) => {
    const root = join(repoRoot, parent)
    if (!existsSync(root)) return []
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) return []
      const manifestPath = join(root, entry.name, 'package.json')
      if (!existsSync(manifestPath)) return []
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
      if (manifest.private === true || typeof manifest.name !== 'string') return []
      return Array.isArray(manifest.files) && manifest.files.length > 0 ? [] : [join(parent, entry.name, 'package.json')]
    })
  }).sort()
}

/**
 * Top-level plugin directories that are deliberately kept out of the tarball.
 * Every other directory must be named in the plugin's `files` allowlist: the
 * compiler reads api/, entities/, presets/ and friends straight from the
 * installed package, so an allowlist that forgets one ships a plugin that
 * installs cleanly and silently loses its routes or entities.
 */
export const PLUGIN_DIRS_NEVER_SHIPPED = new Set([
  '__tests__', 'tests', 'test', ...EXCLUDED_DIR_NAMES.keys(),
])

/**
 * Returns `plugins/<name>/<dir>` for every top-level directory of a publishable
 * plugin that is neither listed in its `files` allowlist nor in
 * PLUGIN_DIRS_NEVER_SHIPPED.
 */
export function pluginDirectoriesOutsideFiles(repoRoot = REPO_ROOT) {
  const root = join(repoRoot, 'plugins')
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return []
    const pluginDir = join(root, entry.name)
    const manifestPath = join(pluginDir, 'package.json')
    if (!existsSync(manifestPath)) return []
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.private === true || typeof manifest.name !== 'string' || !Array.isArray(manifest.files)) return []
    const listed = new Set(manifest.files.map(item => String(item).replace(/^\.\//, '').split('/')[0]))
    return readdirSync(pluginDir, { withFileTypes: true })
      .filter(child => child.isDirectory() && !listed.has(child.name) && !PLUGIN_DIRS_NEVER_SHIPPED.has(child.name))
      .map(child => join('plugins', entry.name, child.name))
  }).sort()
}

export function missingExpectedPackages(results, expectedNames = expectedPublishedPackageNames()) {
  const packed = new Set(results.map(result => result.pkgName))
  return expectedNames.filter(name => !packed.has(name))
}

function verifyTarball(tgzPath, versionMap, allowlist) {
  const tarball = tgzPath.split('/').pop()
  const size = statSync(tgzPath).size
  const { tmpDir, pkgRoot } = extractTarball(tgzPath)

  try {
    const pkgJsonPath = join(pkgRoot, 'package.json')
    if (!existsSync(pkgJsonPath)) {
      throw new Error(`${tarball} has no package/package.json`)
    }
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
    const pkgName = pkgJson.name || tarball

    const findings = []
    const allowlisted = []
    // Every finding's message is redacted here, once, regardless of which
    // check produced it - the single choke point every reported string
    // passes through before it can be printed or stored.
    const report = (partial) => {
      const finding = makeFinding({ pkgName, tarball, ...partial, message: redact(partial.message) })
      const allow = isAllowlisted(finding, allowlist)
      if (allow) allowlisted.push({ ...finding, reason: allow.reason })
      else findings.push(finding)
    }

    const fileSet = walkFiles(pkgRoot)

    checkEntryPoints(pkgJson, fileSet, report)
    checkDependencyProtocols(pkgJson, report)
    checkInternalVersions(pkgJson, versionMap, report)
    scanFilePaths(fileSet, report)
    for (const relPath of fileSet) {
      let buf = null
      try {
        buf = readFileSync(join(pkgRoot, relPath))
      } catch {
        // Unreadable (broken symlink, permissions): nothing more to scan.
      }
      checkKeyLikeFile(relPath, buf, report)
      scanPathForSecrets(relPath, report)
      scanFileContent(relPath, buf, report)
    }

    return {
      pkgName,
      tarball,
      size,
      fileCount: fileSet.length,
      findings,
      allowlisted,
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(results, missingPackages = []) {
  console.log()
  console.log(`${CYAN}========================================${NC}`)
  console.log(`${CYAN}  NextSpark - Verify Tarballs${NC}`)
  console.log(`${CYAN}========================================${NC}`)
  console.log()

  let totalFindings = 0
  for (const result of results) {
    const status = result.findings.length === 0 ? `${GREEN}[OK]${NC}` : `${RED}[FAIL]${NC}`
    console.log(`${status} ${CYAN}${result.pkgName}${NC} (${result.tarball})`)
    console.log(`    size: ${humanSize(result.size)}, files: ${result.fileCount}`)

    if (result.allowlisted.length > 0) {
      console.log(`    ${YELLOW}allowlisted (${result.allowlisted.length}):${NC}`)
      for (const finding of result.allowlisted) {
        console.log(`      - [${finding.type}] ${finding.message}`)
        console.log(`        reason: ${finding.reason}`)
      }
    }

    if (result.findings.length > 0) {
      totalFindings += result.findings.length
      for (const finding of result.findings) {
        console.log(`    ${RED}- [${finding.type}] ${finding.message}${NC}`)
      }
    }
    console.log()
  }

  if (missingPackages.length > 0) {
    totalFindings += missingPackages.length
    console.log(`${RED}[FAIL]${NC} ${CYAN}release package set${NC}`)
    for (const packageName of missingPackages) {
      console.log(`    ${RED}- [missing-tarball] ${packageName} was not packed${NC}`)
    }
    console.log()
  }

  console.log(`${CYAN}========================================${NC}`)
  if (totalFindings === 0) {
    console.log(`${GREEN}All ${results.length} package(s) passed.${NC}`)
  } else {
    console.log(`${RED}${totalFindings} finding(s) across ${results.length} package(s).${NC}`)
    console.log('To allowlist a justified false positive, add an entry with an explicit reason to:')
    console.log(`  ${DEFAULT_ALLOWLIST}`)
  }
  console.log()
  return totalFindings === 0
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function verifyDirectory(dir, allowlistPath) {
  const allowlist = loadAllowlist(allowlistPath)
  const tarballs = listTarballs(dir)
  if (tarballs.length === 0) {
    throw new Error(`No .tgz files found in ${dir}`)
  }

  // First pass: build a name -> version map for every package in this run,
  // so internal @nextsparkjs/* dependency versions can be checked against
  // "the version being packed" rather than an arbitrary published version.
  const versionMap = new Map()
  for (const tgzPath of tarballs) {
    const info = readPackedVersion(tgzPath)
    if (info?.name && info?.version) versionMap.set(info.name, info.version)
  }

  const results = tarballs.map((tgzPath) => verifyTarball(tgzPath, versionMap, allowlist))
  return results
}

async function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${RED}${error.message}${NC}`)
    process.exitCode = 1
    return
  }
  if (args.help) {
    console.log('Usage: node scripts/packages/verify-tarballs.mjs [dir] [--allowlist <path>] [--expect-all]')
    console.log(`  dir          Directory of .tgz files (default: ${DEFAULT_OUTPUT_DIR})`)
    console.log(`  --allowlist  Allowlist JSON path (default: ${DEFAULT_ALLOWLIST})`)
    console.log('  --expect-all Verify every publishable root package has a tarball, and that its files allowlist covers it')
    return
  }

  let results
  try {
    results = verifyDirectory(args.dir, args.allowlistPath)
  } catch (error) {
    console.error(`${RED}${error.message}${NC}`)
    process.exitCode = 1
    return
  }

  const missingPackages = args.expectAll ? missingExpectedPackages(results) : []
  const ok = printReport(results, missingPackages)
  const manifestsOk = args.expectAll ? printManifestFindings() : true
  process.exitCode = ok && manifestsOk ? 0 : 1
}

// A tarball can only show what was packed, not what a missing allowlist would
// let slip in on another machine or what a too-narrow one dropped, so the
// release-set run also checks the manifests behind the tarballs.
function printManifestFindings() {
  const withoutFiles = publishablePackagesMissingFiles()
  const unshippedDirs = pluginDirectoriesOutsideFiles()
  for (const manifest of withoutFiles) {
    console.error(`${RED}[FAIL]${NC} ${manifest} has no "files" allowlist; local artifacts would be packed`)
  }
  for (const dir of unshippedDirs) {
    console.error(`${RED}[FAIL]${NC} ${dir} is neither in its plugin's "files" allowlist nor a never-shipped directory`)
  }
  return withoutFiles.length === 0 && unshippedDirs.length === 0
}

// Run only when invoked directly (so tests can import the helpers above
// without triggering a real verification run).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
