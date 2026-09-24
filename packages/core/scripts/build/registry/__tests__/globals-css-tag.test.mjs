/** Tests for root-first app/globals.css synchronization. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { syncAppGlobalsCss } from '../../theme.mjs'

const hashOf = text => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')
const taggedGlobals = (body, hash = hashOf(body)) => `/* @nextspark-generated core@1.0.0 path=src/app/globals.css sha256=${hash} */\n${body}`

async function projectWith(content) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-globals-css-tag-'))
  await mkdir(join(root, 'styles'), { recursive: true })
  await writeFile(join(root, 'styles/globals.css'), 'body {}\n')
  await mkdir(join(root, 'src', 'app'), { recursive: true })
  await writeFile(join(root, 'src/app/globals.css'), content)
  return { root, config: { projectRoot: root, projectSourceDir: root } }
}

test('an intact root-first globals.css import and tag are left unchanged', async () => {
  const body = '@import "../../styles/globals.css";\n\n.custom {}\n'
  const { root, config } = await projectWith(taggedGlobals(body))
  try {
    assert.equal(syncAppGlobalsCss(config), false)
    assert.equal(await readFile(join(root, 'src/app/globals.css'), 'utf8'), taggedGlobals(body))
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('a stale import is rewritten while a customized tag remains stale', async () => {
  const body = '@import "../old/styles.css";\n\n.custom {}\n'
  const staleTag = taggedGlobals(body, hashOf('what sync wrote before the project changed it\n'))
  const { root, config } = await projectWith(staleTag)
  try {
    assert.equal(syncAppGlobalsCss(config), true)
    const content = await readFile(join(root, 'src/app/globals.css'), 'utf8')
    assert.equal(content.split('\n')[0], staleTag.split('\n')[0])
    assert.match(content, /@import "\.\.\/\.\.\/styles\/globals\.css";/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
