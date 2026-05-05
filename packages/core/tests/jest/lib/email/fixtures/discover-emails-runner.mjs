#!/usr/bin/env node
/**
 * Test runner for email discovery + generator.
 *
 * Invoked by Jest tests via `execFileSync` because Jest with the ts-jest CJS
 * transform cannot dynamic-import .mjs modules. This runner imports the real
 * production code and writes `{ emails, generated }` as JSON to the output
 * file path passed as argv[4]. We use a file (not stdout) because the
 * imported modules' transitive deps (dotenv, etc.) write banner output to
 * stdout that would otherwise pollute the JSON.
 *
 * Usage: node discover-emails-runner.mjs <fixtureRoot> <activeTheme> <outputJsonPath>
 *   <fixtureRoot>:    tmp dir layout root (must contain `core/src/emails/` and
 *                     `themes/<active>/emails/`)
 *   <activeTheme>:    theme name to use, or empty string for null
 *   <outputJsonPath>: where to write the JSON result
 */

import { discoverEmails } from '../../../../../scripts/build/registry/discovery/emails.mjs'
import { generateEmailRegistry } from '../../../../../scripts/build/registry/generators/email-registry.mjs'
import { join } from 'path'
import { writeFileSync } from 'fs'

const fixtureRoot = process.argv[2]
const activeThemeArg = process.argv[3]
const outputPath = process.argv[4]

if (!fixtureRoot || !outputPath) {
  process.stderr.write('discover-emails-runner: missing args (need fixtureRoot, activeTheme, outputJsonPath)\n')
  process.exit(2)
}

const config = {
  isNpmMode: false,
  coreDir: join(fixtureRoot, 'core'),
  themesDir: join(fixtureRoot, 'themes'),
  activeTheme: activeThemeArg ? activeThemeArg : null,
  outputDir: join(fixtureRoot, '.nextspark', 'registries'),
}

const emails = await discoverEmails(config)
const generated = generateEmailRegistry(emails, config)

writeFileSync(outputPath, JSON.stringify({ emails, generated }))
