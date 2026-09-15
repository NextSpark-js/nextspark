import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import { updateGlobalsCss } from '../src/wizard/generators/config-generator.js'
import { tagGeneratedFiles } from '../src/utils/sync-files.js'
import { readGeneratedTag } from '../src/utils/generated-tag.js'
import type { WizardConfig } from '../src/wizard/types.js'

const TEMPLATE_GLOBALS = '@import "../../../themes/default/styles/globals.css";\n\nbody { margin: 0; }\n'

async function write(root: string, file: string, content: string) {
  await mkdir(dirname(join(root, file)), { recursive: true })
  await writeFile(join(root, file), content)
}

test('a project the wizard just generated has app/globals.css tagged, importing its own theme', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-tags-'))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  const previousCwd = process.cwd()
  const previousTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
  delete process.env.NEXT_PUBLIC_ACTIVE_THEME
  try {
    await write(core, 'package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
    await write(core, 'templates/app/globals.css', TEMPLATE_GLOBALS)
    await write(root, 'package.json', '{}')
    await write(root, 'app/globals.css', TEMPLATE_GLOBALS)
    await write(root, '.env', 'NEXT_PUBLIC_ACTIVE_THEME="acme"\n')

    process.chdir(root)
    await updateGlobalsCss({ projectSlug: 'acme' } as WizardConfig)
    tagGeneratedFiles(core, root)

    const globals = await readFile(join(root, 'app/globals.css'))
    const tag = readGeneratedTag(globals)
    assert.equal(tag?.intact, true, 'app/globals.css carries an intact tag')
    assert.match(tag!.body.toString(), /@import "\.\.\/contents\/themes\/acme\/styles\/globals\.css";/)
  } finally {
    process.chdir(previousCwd)
    if (previousTheme !== undefined) process.env.NEXT_PUBLIC_ACTIVE_THEME = previousTheme
    await rm(root, { recursive: true, force: true })
  }
})
