import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { isText, readGeneratedTag, readGeneratedTagAt, sameText, tagStyleFor, withGeneratedTag } from '../src/utils/generated-tag.js'

test('the tag goes in a line comment in scripts, a block comment in CSS, and nowhere in other files', () => {
  for (const path of ['app/page.tsx', 'i18n.ts', 'next.config.mjs', 'app/route.js', 'app/legacy.cjs', 'app/widget.jsx']) {
    assert.equal(tagStyleFor(path), 'line', path)
  }
  assert.equal(tagStyleFor('app/globals.css'), 'block')
  for (const path of ['app/favicon.ico', 'tsconfig.json', 'app/api/v1/users/docs.md']) {
    assert.equal(tagStyleFor(path), null, path)
  }
})

test('a tagged file reads back as intact, with the version that wrote it and the content below the tag', () => {
  const content = Buffer.from("'use client'\n\nexport default function Page() { return null }\n")

  const tagged = withGeneratedTag('app/page.tsx', content, '0.1.0-beta.190')

  const [first, second] = tagged.toString().split('\n')
  assert.match(first, /^\/\/ @nextspark-generated core@0\.1\.0-beta\.190 path=app\/page\.tsx sha256=[0-9a-f]{64}$/)
  assert.equal(second, "'use client'", 'the directive comes right after the tag')

  const tag = readGeneratedTag(tagged)
  assert.equal(tag?.coreVersion, '0.1.0-beta.190')
  assert.equal(tag?.intact, true)
  assert.ok(tag?.body.equals(content))
})

test('an edit below the tag leaves it not intact, while converting line endings does not', () => {
  const tagged = withGeneratedTag('app/page.tsx', Buffer.from('export const a = 1\nexport const b = 2\n'), '1.0.0').toString()

  assert.equal(readGeneratedTag(Buffer.from(tagged.replace('a = 1', 'a = 3')))?.intact, false)
  assert.equal(readGeneratedTag(Buffer.from(tagged.replace(/\n/g, '\r\n')))?.intact, true)
})

test('CSS carries the tag as a block comment', () => {
  const tagged = withGeneratedTag('app/globals.css', Buffer.from('@import "../contents/themes/acme/styles/globals.css";\n'), '1.0.0')

  assert.match(tagged.toString().split('\n')[0], /^\/\* @nextspark-generated core@1\.0\.0 path=app\/globals\.css sha256=[0-9a-f]{64} \*\/$/)
  assert.equal(readGeneratedTag(tagged)?.intact, true)
})

test('a file with no tag style is written as it is, and a file whose first line is not the tag has none', () => {
  const json = Buffer.from('{}\n')
  assert.ok(withGeneratedTag('tsconfig.json', json, '1.0.0').equals(json))

  assert.equal(readGeneratedTag(Buffer.from('// a comment\nexport {}\n')), null)
  assert.equal(readGeneratedTag(Buffer.from('/**\n * @nextspark-generated\n */\nexport {}\n')), null)
})

test('text compares equal across line endings, and only across line endings', () => {
  assert.equal(sameText(Buffer.from('a\r\nb\r\n'), Buffer.from('a\nb\n')), true)
  assert.equal(sameText(Buffer.from('a\nb\n'), Buffer.from('a\nc\n')), false)
})

test('a script with a shebang keeps it on the first line, and still runs', async () => {
  const script = Buffer.from("#!/usr/bin/env node\nconsole.log('ran')\n")
  const tagged = withGeneratedTag('scripts/run.js', script, '1.0.0')

  const lines = tagged.toString().split('\n')
  assert.equal(lines[0], '#!/usr/bin/env node')
  assert.match(lines[1], /^\/\/ @nextspark-generated core@1\.0\.0 /)
  assert.equal(readGeneratedTag(tagged)?.intact, true)

  const dir = await mkdtemp(join(tmpdir(), 'nextspark-generated-tag-'))
  try {
    await writeFile(join(dir, 'run.js'), tagged)
    assert.equal(execFileSync(process.execPath, [join(dir, 'run.js')], { encoding: 'utf-8' }), 'ran\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('content that is not text gets no tag, whatever its extension', () => {
  const binary = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00])
  assert.ok(withGeneratedTag('app/wasm-shim.ts', binary, '1.0.0').equals(binary))
})

test('a path with spaces, quotes or a comment terminator in it reads back as the path the tag was written for', () => {
  const paths = [
    'app/(marketing site)/page.tsx',
    'app/say "hi"/page.tsx',
    'app/back\\slash/page.tsx',
    'app/star*/page.tsx',
    'app/niños/[id]/page.tsx',
  ]

  for (const path of paths) {
    const content = Buffer.from('export default function Page() { return null }\n')
    const tagged = withGeneratedTag(path, content, '1.0.0')

    const tag = readGeneratedTag(tagged)
    assert.equal(tag?.path, path, `path=${path}`)
    assert.equal(tag?.intact, true, `intact for ${path}`)
    assert.ok(readGeneratedTagAt(path, tagged), `the file is still core's at ${path}`)
    assert.equal(readGeneratedTagAt('app/other/page.tsx', tagged), null, `a copy elsewhere is the project's, from ${path}`)
  }
})

test('a CSS path with a comment terminator in it leaves the tag a single closed comment', () => {
  const tagged = withGeneratedTag('app/star*/globals.css', Buffer.from('@import "x";\n'), '1.0.0').toString()

  const [tagLine, ...body] = tagged.split('\n')
  assert.equal(tagLine.indexOf('*/'), tagLine.length - 2, `the comment closes only at its end: ${tagLine}`)
  assert.equal(body[0], '@import "x";')
})

test('a tag written before paths were quoted still reads back', () => {
  const body = 'export default function Page() { return null }\n'
  const hash = readGeneratedTag(withGeneratedTag('app/page.tsx', Buffer.from(body), '1.0.0'))
  assert.ok(hash)

  const legacy = Buffer.from(`// @nextspark-generated core@0.1.0-beta.189 path=app/page.tsx sha256=${'0'.repeat(64)}\n${body}`)
  assert.equal(readGeneratedTag(legacy)?.path, 'app/page.tsx')

  const noPath = Buffer.from(`// @nextspark-generated core@0.1.0-beta.188 sha256=${'0'.repeat(64)}\n${body}`)
  assert.equal(readGeneratedTag(noPath)?.path, null)
})

test('bytes no text file carries make content binary, so it gets no tag', () => {
  const controls = Buffer.from([0x01, 0x02, 0x03, 0x04])
  assert.equal(isText(controls), false)
  assert.ok(withGeneratedTag('app/shim.ts', controls, '1.0.0').equals(controls))
  assert.equal(tagStyleFor('app/shim.ts', controls), null)

  assert.equal(isText(Buffer.from('a\tb\r\nc\n\fd\n')), true, 'tab, CR, LF and form feed are text')
  assert.equal(isText(Buffer.from('áé\n')), true, 'multi-byte UTF-8 is text')
})
