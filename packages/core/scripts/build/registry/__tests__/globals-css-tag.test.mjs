/**
 * Tests for how the registry build keeps app/globals.css's generated tag when it
 * points the file's import at another theme: a file sync:app tagged and nobody
 * changed since keeps an intact tag, and a file the project changed keeps the
 * tag it had, which no longer matches.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/globals-css-tag.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { syncAppGlobalsCss } from '../../theme.mjs'

const hashOf = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')

/** A globals.css as sync:app writes it: the tag line, then the file. */
function taggedGlobals(body, hash = hashOf(body)) {
  return `/* @nextspark-generated core@1.0.0 path=app/globals.css sha256=${hash} */\n${body}`
}

/** A project with two themes, whose app/globals.css is `content`. */
async function projectWith(content) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-globals-css-tag-'))
  for (const theme of ['acme', 'other']) {
    await mkdir(join(root, 'contents/themes', theme, 'styles'), { recursive: true })
    await writeFile(join(root, 'contents/themes', theme, 'styles/globals.css'), 'body {}\n')
  }
  await mkdir(join(root, 'app'), { recursive: true })
  await writeFile(join(root, 'app/globals.css'), content)
  return { root, config: { projectRoot: root, themesDir: join(root, 'contents/themes') } }
}

test('pointing an intact tagged globals.css at another theme leaves its tag intact', async () => {
  const body = '@import "../contents/themes/acme/styles/globals.css";\n\n.custom {}\n'
  const { root, config } = await projectWith(taggedGlobals(body))
  try {
    assert.equal(syncAppGlobalsCss(config, 'other'), true)

    const [tagLine, ...rest] = (await readFile(join(root, 'app/globals.css'), 'utf8')).split('\n')
    const newBody = rest.join('\n')
    assert.match(newBody, /@import "\.\.\/contents\/themes\/other\/styles\/globals\.css";/)
    assert.equal(tagLine, `/* @nextspark-generated core@1.0.0 path=app/globals.css sha256=${hashOf(newBody)} */`)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('pointing a customized globals.css at another theme leaves its tag as it was', async () => {
  const body = '@import "../contents/themes/acme/styles/globals.css";\n\n.custom {}\n'
  const staleTag = taggedGlobals(body, hashOf('what sync wrote before the project changed it\n'))
  const { root, config } = await projectWith(staleTag)
  try {
    assert.equal(syncAppGlobalsCss(config, 'other'), true)

    const content = await readFile(join(root, 'app/globals.css'), 'utf8')
    assert.equal(content.split('\n')[0], staleTag.split('\n')[0])
    assert.match(content, /@import "\.\.\/contents\/themes\/other\/styles\/globals\.css";/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
