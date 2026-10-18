/**
 * #273: what the sitemap lists, against a real PostgreSQL. Published rows only (drafts, scheduled and archived rows
 * never), one URL per slug whatever the locales, nothing the public route would answer not found for, and nothing
 * from an entity that is not public (a team's tasks). The tables have the columns the sitemap reads of the pages and
 * posts templates (slug, status, locale, updatedAt, unique (slug, locale)).
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { buildSitemap } from '../../src/lib/seo/sitemap.ts'
import { readEntities } from '../../src/lib/seo/sitemap-entries.ts'
import type { EntityConfig } from '../../src/lib/entities/types.ts'

const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

const TABLE = (name: string) => `
  CREATE TABLE ${name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    "teamId" TEXT NOT NULL DEFAULT 'team-1',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (slug, locale)
  )`

const entity = (slug: string, access: Record<string, unknown>) =>
  ({ slug, tableName: slug, access, builder: { enabled: true }, ui: { public: { hasArchivePage: true } } }) as unknown as EntityConfig

test('the sitemap lists exactly the published rows of the public entities, as the service role reads them', { skip: !HAS_POSTGRES && 'initdb/pg_ctl are not on the PATH', timeout: 120_000 }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-pg-'))
  const port = await freePort()
  execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
  t.after(() => {
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })
  const client = new pg.Client({ connectionString: `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable` })
  client.on('error', () => {})
  await client.connect()
  t.after(() => client.end())

  for (const table of ['pages', 'posts', 'tasks']) await client.query(TABLE(table))
  await client.query(`
    INSERT INTO pages (slug, title, status, locale, "updatedAt") VALUES
      ('about', 'About', 'published', 'en', '2026-01-01T00:00:00Z'),
      ('about', 'Acerca', 'published', 'es', '2026-03-01T00:00:00Z'),
      ('contact', 'Contact', 'draft', 'en', '2026-01-02T00:00:00Z'),
      ('soon', 'Soon', 'scheduled', 'en', '2026-01-03T00:00:00Z'),
      ('old', 'Old', 'archived', 'en', '2026-01-04T00:00:00Z'),
      ('translated-only', 'Solo', 'published', 'es', '2026-01-05T00:00:00Z'),
      ('hidden-es', 'Oculta', 'draft', 'es', '2026-01-06T00:00:00Z'),
      ('hidden-es', 'Hidden', 'published', 'en', '2026-01-07T00:00:00Z');
    INSERT INTO posts (slug, title, status, "updatedAt") VALUES
      ('hello-world', 'Hello', 'published', '2026-02-01T00:00:00Z'),
      ('work-in-progress', 'WIP', 'draft', '2026-02-02T00:00:00Z'),
      ('release-1.0', 'Release', 'published', '2026-02-03T00:00:00Z'),
      ('logo.png', 'A file name', 'published', '2026-02-04T00:00:00Z'),
      ('robots.txt', 'Another', 'published', '2026-02-05T00:00:00Z');
    INSERT INTO tasks (slug, title, status) VALUES ('team-secret', 'Secret', 'published');`)

  const run = (sql: string, params: unknown[]) => client.query(sql, params) as unknown as Promise<{ rows: { slug: string; updatedAt: Date }[] }>
  const configs = [
    entity('pages', { public: true, basePath: '/' }),
    entity('posts', { public: true, basePath: '/blog' }),
    entity('tasks', { public: false, shared: false, basePath: '/tasks' }), // team-scoped: published rows, never listed
  ]

  const { entities, failed } = await readEntities(configs, run)
  assert.equal(failed, false)
  const sitemap = buildSitemap({ origin: 'https://example.com', entities })
  const byUrl = new Map(sitemap.map(entry => [entry.url, entry]))

  assert.deepEqual([...byUrl.keys()], [
    'https://example.com/about',
    'https://example.com/hidden-es',
    'https://example.com/translated-only',
    'https://example.com/blog',
    'https://example.com/blog/hello-world',
    'https://example.com/blog/release-1.0',
  ])
  // the same slug in two locales is one URL, dated by its latest edit
  assert.deepEqual(byUrl.get('https://example.com/about')!.lastModified, new Date('2026-03-01T00:00:00Z'))
  assert.deepEqual(byUrl.get('https://example.com/blog/hello-world')!.lastModified, new Date('2026-02-01T00:00:00Z'))
  // a draft, scheduled or archived row, a file name, and a team-scoped entity's published row are all absent
  for (const absent of ['contact', 'soon', 'old']) assert.equal(byUrl.has(`https://example.com/${absent}`), false, absent)
  for (const absent of ['work-in-progress', 'logo.png', 'robots.txt']) assert.equal(byUrl.has(`https://example.com/blog/${absent}`), false, absent)
  assert.equal([...byUrl.keys()].some(url => url.includes('team-secret') || url.includes('/tasks')), false)
})
