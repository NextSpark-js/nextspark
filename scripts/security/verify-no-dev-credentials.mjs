#!/usr/bin/env node
/**
 * Fails when credential-like values from a project's config/dev.config.ts are
 * present in its production browser assets (.next/static).
 *
 * Usage: node scripts/security/verify-no-dev-credentials.mjs <next-project-dir>
 */
import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')
const CREDENTIAL_KEY = /(?:email|pass(?:word|phrase)?|credential|secret|token|api[_-]?key|private[_-]?key|access[_-]?key|client[_-]?(?:id|secret)|username)/i
const EMAIL_VALUE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function devConfigExportName(source) {
  return source.match(/export\s+const\s+([a-zA-Z_$][\w$]*(?:DEV_CONFIG|DevConfig))\s*[:=]/)?.[1]
    ?? source.match(/export\s+default\s+([a-zA-Z_$][\w$]*(?:DEV_CONFIG|DevConfig))\b/)?.[1]
    ?? null
}

/** Loads dev.config.ts using the same jiti-based TypeScript loading strategy as the registry build. */
export async function loadDevConfig(buildDir) {
  const configPath = join(buildDir, 'config', 'dev.config.ts')
  if (!existsSync(configPath)) throw new Error(`Missing development config: ${configPath}`)

  const source = await readFile(configPath, 'utf8')
  const exportName = devConfigExportName(source)
  let loaded
  try {
    const jiti = createJiti(import.meta.url, { interopDefault: true, fsCache: false })
    loaded = jiti(configPath)
  } catch (error) {
    throw new Error(`Could not load ${configPath}: ${error.message}`, { cause: error })
  }

  const config = exportName ? loaded?.[exportName] : loaded?.default ?? loaded
  if (!config || typeof config !== 'object') {
    throw new Error(`Development config ${configPath} did not export an object`)
  }
  return config
}

/** Returns unique email and credential-like string values without logging them. */
export function collectCredentialValues(config) {
  const values = new Set()
  const visit = (value, key = '') => {
    if (typeof value === 'string') {
      if (value.length > 0 && (CREDENTIAL_KEY.test(key) || EMAIL_VALUE.test(value))) values.add(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) visit(item, key)
      return
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value)) visit(childValue, childKey)
    }
  }
  visit(config)
  return [...values]
}

async function staticFiles(directory) {
  if (!existsSync(directory)) throw new Error(`Missing Next static directory: ${directory}`)
  const files = []
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name)
      if (entry.isDirectory()) await visit(path)
      else if (entry.isFile()) files.push(path)
    }
  }
  await visit(directory)
  return files
}

/** Checks every emitted browser asset and throws without echoing credentials. */
export async function verifyNoDevCredentials(buildDir) {
  const resolvedBuildDir = resolve(buildDir)
  const credentials = collectCredentialValues(await loadDevConfig(resolvedBuildDir))
  if (credentials.length === 0) {
    throw new Error(`No credential-like values found in ${join(resolvedBuildDir, 'config', 'dev.config.ts')}`)
  }

  const files = await staticFiles(join(resolvedBuildDir, '.next', 'static'))
  const matches = []
  for (const file of files) {
    const contents = await readFile(file)
    if (credentials.some((credential) => contents.includes(Buffer.from(credential)))) {
      matches.push(file)
    }
  }

  if (matches.length > 0) {
    throw new Error(`Dev credentials found in production static assets (${matches.length} file${matches.length === 1 ? '' : 's'}): ${matches.map((file) => file.slice(resolvedBuildDir.length + 1)).join(', ')}`)
  }
  return { credentialsChecked: credentials.length, staticFilesChecked: files.length }
}

export function parseArguments(args) {
  if (args.length !== 1 || args[0] === '--help' || args[0] === '-h') {
    throw new Error('Usage: node scripts/security/verify-no-dev-credentials.mjs <next-project-dir>')
  }
  return args[0]
}

function isMainModule() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

if (isMainModule()) {
  try {
    const result = await verifyNoDevCredentials(parseArguments(process.argv.slice(2)))
    console.log(`Verified ${result.credentialsChecked} development credential values are absent from ${result.staticFilesChecked} static asset files.`)
  } catch (error) {
    console.error(`Credential bundle verification failed: ${error.message}`)
    process.exitCode = 1
  }
}
