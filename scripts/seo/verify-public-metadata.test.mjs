import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { judge, readMetadata, verifyPublicMetadata } from './verify-public-metadata.mjs'

const head = ({ title, path, desc = 'A description', og = true, canonical = true }) =>
  `<html><head><title>${title}</title>` +
  (canonical ? `<link rel="canonical" href="https://app.example${path}"/>` : '') +
  (og ? `<meta property="og:title" content="${title}"/><meta property="og:description" content="${desc}"/>` : '') +
  '</head><body></body></html>'

test('reads the title, canonical and og tags, whatever the attribute order', () => {
  const html = '<title>A &amp; B</title><link href="https://x.example/a" rel="canonical"/><meta content="T" property="og:title"/><meta property="og:description" content="D"/>'
  assert.deepEqual(readMetadata(html), { title: 'A & B', canonical: 'https://x.example/a', ogTitle: 'T', ogDescription: 'D' })
  assert.deepEqual(readMetadata('<title>x</title>'), { title: 'x', canonical: null, ogTitle: null, ogDescription: null })
})

test('flags what #365 describes: shared title, no canonical, no og tags', () => {
  const page = (path, html) => ({ path, ...readMetadata(html) })
  assert.deepEqual(judge([page('/', head({ title: 'Home', path: '/' })), page('/support', head({ title: 'Support', path: '/support' }))]), [])
  const bad = judge([page('/', head({ title: 'App', path: '/', canonical: false, og: false })), page('/support', head({ title: 'App', path: '/support' }))])
  assert.ok(bad.includes('/: no canonical link'))
  assert.ok(bad.includes('/: no og:title'))
  assert.ok(bad.includes('/: no og:description'))
  assert.ok(bad.some(p => /^\/support: shares the title "App" with \//.test(p)))
  assert.ok(judge([page('/docs', head({ title: 'Docs', path: '/support' }))])[0].includes("not this page's URL"))
  assert.ok(judge([{ path: '/x', title: 'X', canonical: '/x', ogTitle: 'X', ogDescription: 'D' }])[0].includes('not an absolute URL'))
})

test('requests every path of a running server', async t => {
  const server = createServer((req, res) => {
    const title = req.url === '/' ? 'Home' : req.url.slice(1)
    res.writeHead(200).end(head({ title, path: req.url }))
  })
  await new Promise(resolve => server.listen(0, resolve))
  t.after(() => server.close())
  const result = await verifyPublicMetadata({ baseUrl: `http://localhost:${server.address().port}` })
  assert.equal(result.ok, true, result.problems.join('\n'))
  assert.equal(result.pages.length, 4)
})
