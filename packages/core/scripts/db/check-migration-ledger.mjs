/**
 * The recorded migrations against the files on disk (#428): `nextspark doctor` runs this file. It reads the
 * ledgers of DATABASE_URL and writes nothing, not even the hash of a row that has none.
 *
 *   node check-migration-ledger.mjs   (in the project root, MIGRATE_DATABASE_URL or else DATABASE_URL in the environment)
 *   exit 0: the database was read; stdout is a JSON object
 *     { edited: [{ file, source }], accept: [<UPDATE>], renamed: [{ from, to, source, update }] };
 *   exit 2: no DATABASE_URL, or the database could not be read; stdout is the reason.
 */
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { getConfig } from '../build/registry/config.mjs'
import { collectAllMigrations, collectCoreMigrations } from './migration-files.mjs'
import { ledgerFiles, ledgerFindings, acceptStatements, renameStatement, describeMigration } from './migration-ledger.mjs'
import { scriptClient } from './ssl-config.mjs'
import { rememberSecrets, scrub } from './destination.mjs'

async function main() {
  // The ledgers are for the migration role: the application's role (nextspark_app) cannot read them
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL
  if (!url) {
    console.log('DATABASE_URL is not set')
    return 2
  }
  rememberSecrets(url)
  const client = scriptClient(url, { connectionTimeoutMillis: 10000 })
  try {
    const config = getConfig()
    const files = ledgerFiles({
      core: collectCoreMigrations(config.coreDir),
      migrations: collectAllMigrations({ projectRoot: config.projectRoot, projectName: config.projectName, plugins: config.plugins }),
    })
    await client.connect()
    const { edited, renamed } = await ledgerFindings(client, files, { write: false })
    console.log(JSON.stringify({
      edited: edited.map(item => ({ file: item.row.filename, source: describeMigration(item) })),
      accept: acceptStatements(edited),
      renamed: renamed.map(item => ({ from: item.row.filename, to: item.file.filename, source: describeMigration(item), update: renameStatement(item) })),
    }))
    return 0
  } catch (error) {
    // never the URL: it holds the password
    const hint = error.code === '42501' ? ' (the ledgers are for the migration role: set MIGRATE_DATABASE_URL to its connection)' : ''
    console.log(`Could not read the recorded migrations: ${scrub(error.message)}${hint}`)
    return 2
  } finally {
    await client.end().catch(() => {})
  }
}

// run directly, also through a symlink (a project's node_modules/@nextsparkjs/core under pnpm)
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = await main()
}
