import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { updateGlobalsCss } from '../src/wizard/generators/config-generator.js'
import { tagGeneratedFiles } from '../src/utils/sync-files.js'
import { readGeneratedTag } from '../src/utils/generated-tag.js'
import type { WizardConfig } from '../src/wizard/types.js'

/** Core's guarded writes, which tagging loads from the core installed in the project. */
const CORE_SOURCE = join(dirname(fileURLToPath(import.meta.url)), '../../core')

const TEMPLATE_GLOBALS = '@import "../../styles/globals.css";\n\nbody { margin: 0; }\n'

async function write(root: string, file: string, content: string) {
  await mkdir(dirname(join(root, file)), { recursive: true })
  await writeFile(join(root, file), content)
}

test('a project the wizard just generated has src/app/globals.css tagged, importing its own theme', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-tags-'))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  const previousCwd = process.cwd()
  try {
    await write(core, 'package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
    await write(core, 'templates/app/globals.css', TEMPLATE_GLOBALS)
    await write(core, 'scripts/build/safe-fs.mjs', await readFile(join(CORE_SOURCE, 'scripts/build/safe-fs.mjs'), 'utf8'))
    await write(root, 'package.json', '{}')
    await write(root, 'src/app/globals.css', TEMPLATE_GLOBALS)

    process.chdir(root)
    await updateGlobalsCss({ projectSlug: 'acme' } as WizardConfig)
    await tagGeneratedFiles(core, root)

    const globals = await readFile(join(root, 'src/app/globals.css'))
    const tag = readGeneratedTag(globals)
    assert.equal(tag?.intact, true, 'src/app/globals.css carries an intact tag')
    assert.match(tag!.body.toString(), /@import "\.\.\/\.\.\/styles\/globals\.css";/)
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})
